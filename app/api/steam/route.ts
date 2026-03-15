import { NextRequest, NextResponse } from "next/server";

const STEAM_API_KEY = process.env.STEAM_API_KEY;
const STEAM_API_BASE = "https://api.steampowered.com";
const STORE_API_BASE = "https://store.steampowered.com";

// Resolve vanity URL (e.g. "gaben") to SteamID64
async function resolveVanityUrl(vanity: string): Promise<string | null> {
  const res = await fetch(
    `${STEAM_API_BASE}/ISteamUser/ResolveVanityURL/v1/?key=${STEAM_API_KEY}&vanityurl=${vanity}`
  );
  const data = await res.json();
  if (data?.response?.success === 1) return data.response.steamid;
  return null;
}

// Extract SteamID64 from various input formats
async function extractSteamId(input: string): Promise<string | null> {
  input = input.trim();

  // Already a SteamID64 (17-digit number)
  if (/^\d{17}$/.test(input)) return input;

  // Profile URL with /id/ (vanity)
  const vanityMatch = input.match(/steamcommunity\.com\/id\/([^\/]+)/);
  if (vanityMatch) return resolveVanityUrl(vanityMatch[1]);

  // Profile URL with /profiles/ (steamid64)
  const idMatch = input.match(/steamcommunity\.com\/profiles\/(\d{17})/);
  if (idMatch) return idMatch[1];

  // Plain vanity name (no slashes, no spaces)
  if (/^[a-zA-Z0-9_-]+$/.test(input)) return resolveVanityUrl(input);

  return null;
}

// Get owned games for a Steam user
async function getOwnedGames(steamId: string): Promise<any[]> {
  const res = await fetch(
    `${STEAM_API_BASE}/IPlayerService/GetOwnedGames/v1/?key=${STEAM_API_KEY}&steamid=${steamId}&include_appinfo=true&include_played_free_games=false`
  );
  const data = await res.json();
  return data?.response?.games ?? [];
}

// Get player summary (display name + avatar)
async function getPlayerSummary(steamId: string): Promise<any> {
  const res = await fetch(
    `${STEAM_API_BASE}/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_API_KEY}&steamids=${steamId}`
  );
  const data = await res.json();
  return data?.response?.players?.[0] ?? null;
}

// Get app details from Steam store (for multiplayer tags)
// We cache these in-memory per request to avoid redundant calls
const appDetailsCache: Record<number, any> = {};

async function getAppDetails(appId: number): Promise<any> {
  if (appDetailsCache[appId]) return appDetailsCache[appId];
  try {
    const res = await fetch(
      `${STORE_API_BASE}/api/appdetails?appids=${appId}&filters=categories,genres`,
      { signal: AbortSignal.timeout(4000) }
    );
    const data = await res.json();
    const details = data?.[appId]?.data ?? null;
    appDetailsCache[appId] = details;
    return details;
  } catch {
    return null;
  }
}

// Category IDs from Steam store that indicate multiplayer
const MULTIPLAYER_CATEGORY_IDS = new Set([
  1,   // Multi-player
  9,   // Co-op
  27,  // Cross-Platform Multiplayer
  36,  // Online Co-op
  38,  // Online PvP
  49,  // PvP
  60,  // Remote Play Together
]);

async function isMultiplayer(appId: number): Promise<boolean> {
  const details = await getAppDetails(appId);
  if (!details?.categories) return false;
  return details.categories.some((cat: any) =>
    MULTIPLAYER_CATEGORY_IDS.has(cat.id)
  );
}

export async function POST(req: NextRequest) {
  if (!STEAM_API_KEY) {
    return NextResponse.json(
      { error: "Steam API key not configured. Add STEAM_API_KEY to .env.local" },
      { status: 500 }
    );
  }

  const body = await req.json();
  const { users, filterMultiplayer } = body as {
    users: string[];
    filterMultiplayer: boolean;
  };

  if (!users || users.length < 2) {
    return NextResponse.json(
      { error: "Please provide at least 2 Steam users." },
      { status: 400 }
    );
  }

  // Resolve all Steam IDs in parallel
  const resolvedIds = await Promise.all(users.map(extractSteamId));

  const results = await Promise.all(
    resolvedIds.map(async (steamId, i) => {
      if (!steamId)
        return { input: users[i], steamId: null, profile: null, games: [] };
      const [profile, games] = await Promise.all([
        getPlayerSummary(steamId),
        getOwnedGames(steamId),
      ]);
      return { input: users[i], steamId, profile, games };
    })
  );

  // Identify failed lookups
  const failed = results.filter((r) => !r.steamId || r.games.length === 0);
  const valid = results.filter((r) => r.steamId && r.games.length > 0);

  if (valid.length < 2) {
    return NextResponse.json({
      error:
        "Could not fetch libraries for enough users. Make sure their profiles are public.",
      failed: failed.map((f) => f.input),
    });
  }

  // Intersect: find appIds owned by ALL valid users
  const gameMaps = valid.map((u) => {
    const map: Record<number, any> = {};
    for (const g of u.games) map[g.appid] = g;
    return map;
  });

  const firstUserAppIds = Object.keys(gameMaps[0]).map(Number);
  let commonAppIds = firstUserAppIds.filter((id) =>
    gameMaps.every((m) => m[id])
  );

  // Build common game objects with aggregate playtime
  let commonGames = commonAppIds.map((appId) => {
    const base = gameMaps[0][appId];
    const totalPlaytime = valid.reduce(
      (sum, u, i) => sum + (gameMaps[i][appId]?.playtime_forever ?? 0),
      0
    );
    const ownersCount = valid.filter((_, i) => !!gameMaps[i][appId]).length;
    return {
      appId,
      name: base.name,
      iconUrl: base.img_icon_url
        ? `https://media.steampowered.com/steamcommunity/public/images/apps/${appId}/${base.img_icon_url}.jpg`
        : null,
      totalPlaytime, // in minutes
      ownersCount,
      storeUrl: `https://store.steampowered.com/app/${appId}`,
    };
  });

  // Filter multiplayer if requested (calls store API per game — can be slow for large libraries)
  if (filterMultiplayer && commonGames.length > 0) {
    // Limit to first 80 to avoid timeout; sort by name first so we get a reasonable spread
    const toCheck = commonGames.slice(0, 80);
    const multiplayerFlags = await Promise.all(
      toCheck.map((g) => isMultiplayer(g.appId))
    );
    commonGames = toCheck.filter((_, i) => multiplayerFlags[i]);
  }

  // Sort: fewest total minutes first (neglected games = new experience)
  commonGames.sort((a, b) => a.totalPlaytime - b.totalPlaytime);

  return NextResponse.json({
    users: valid.map((u) => ({
      input: u.input,
      steamId: u.steamId,
      displayName: u.profile?.personaname ?? u.steamId,
      avatar: u.profile?.avatarmedium ?? null,
      gameCount: u.games.length,
    })),
    failed: failed.map((f) => f.input),
    commonGames,
    totalCommon: commonGames.length,
    filterMultiplayer,
  });
}
