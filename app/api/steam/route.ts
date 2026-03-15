import { NextRequest, NextResponse } from "next/server";

const STEAM_API_KEY = process.env.STEAM_API_KEY;
const STEAM_API_BASE = "https://api.steampowered.com";
const STORE_API_BASE = "https://store.steampowered.com";

async function resolveVanityUrl(vanity: string): Promise<string | null> {
  const res = await fetch(
    `${STEAM_API_BASE}/ISteamUser/ResolveVanityURL/v1/?key=${STEAM_API_KEY}&vanityurl=${vanity}`
  );
  const data = await res.json();
  if (data?.response?.success === 1) return data.response.steamid;
  return null;
}

async function extractSteamId(input: string): Promise<string | null> {
  input = input.trim();
  if (/^\d{17}$/.test(input)) return input;
  const vanityMatch = input.match(/steamcommunity\.com\/id\/([^\/]+)/);
  if (vanityMatch) return resolveVanityUrl(vanityMatch[1]);
  const idMatch = input.match(/steamcommunity\.com\/profiles\/(\d{17})/);
  if (idMatch) return idMatch[1];
  if (/^[a-zA-Z0-9_-]+$/.test(input)) return resolveVanityUrl(input);
  return null;
}

async function getOwnedGames(steamId: string): Promise<any[]> {
  const res = await fetch(
    `${STEAM_API_BASE}/IPlayerService/GetOwnedGames/v1/?key=${STEAM_API_KEY}&steamid=${steamId}&include_appinfo=true&include_played_free_games=false`
  );
  const data = await res.json();
  return data?.response?.games ?? [];
}

async function getPlayerSummary(steamId: string): Promise<any> {
  const res = await fetch(
    `${STEAM_API_BASE}/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_API_KEY}&steamids=${steamId}`
  );
  const data = await res.json();
  return data?.response?.players?.[0] ?? null;
}

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

const MULTIPLAYER_CATEGORY_IDS = new Set([1, 9, 27, 36, 38, 49, 60]);

async function isMultiplayer(appId: number): Promise<boolean> {
  const details = await getAppDetails(appId);
  if (!details?.categories) return false;
  return details.categories.some((cat: any) => MULTIPLAYER_CATEGORY_IDS.has(cat.id));
}

function buildGameList(appIds: number[], gameMaps: Record<number, any>[], validUsers: any[]) {
  return appIds.map((appId) => {
    // Use the first map that has this game for base info
    const baseMap = gameMaps.find((m) => m[appId]);
    const base = baseMap?.[appId];
    const totalPlaytime = gameMaps.reduce(
      (sum, m) => sum + (m[appId]?.playtime_forever ?? 0),
      0
    );
    const ownersCount = gameMaps.filter((m) => !!m[appId]).length;
    return {
      appId,
      name: base?.name ?? `App ${appId}`,
      iconUrl: base?.img_icon_url
        ? `https://media.steampowered.com/steamcommunity/public/images/apps/${appId}/${base.img_icon_url}.jpg`
        : null,
      totalPlaytime,
      ownersCount,
      storeUrl: `https://store.steampowered.com/app/${appId}`,
    };
  });
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
    return NextResponse.json({ error: "Please provide at least 2 Steam users." }, { status: 400 });
  }

  const resolvedIds = await Promise.all(users.map(extractSteamId));

  const results = await Promise.all(
    resolvedIds.map(async (steamId, i) => {
      if (!steamId) return { input: users[i], steamId: null, profile: null, games: [] };
      const [profile, games] = await Promise.all([getPlayerSummary(steamId), getOwnedGames(steamId)]);
      return { input: users[i], steamId, profile, games };
    })
  );

  const failed = results.filter((r) => !r.steamId || r.games.length === 0);
  const valid = results.filter((r) => r.steamId && r.games.length > 0);

  if (valid.length < 2) {
    return NextResponse.json({
      error: "Could not fetch libraries for enough users. Make sure their profiles are public.",
      failed: failed.map((f) => f.input),
    });
  }

  // Build per-user game maps
  const gameMaps = valid.map((u) => {
    const map: Record<number, any> = {};
    for (const g of u.games) map[g.appid] = g;
    return map;
  });

  // Collect all unique appIds across all users
  const allAppIds = new Set<number>();
  for (const map of gameMaps) Object.keys(map).forEach((id) => allAppIds.add(Number(id)));

  // Separate into "all own" and "at least 2 but not all own"
  const commonAppIds: number[] = [];
  const partialAppIds: number[] = [];

  for (const appId of allAppIds) {
    const count = gameMaps.filter((m) => !!m[appId]).length;
    if (count === valid.length) {
      commonAppIds.push(appId);
    } else if (count >= 2) {
      partialAppIds.push(appId);
    }
  }

  let commonGames = buildGameList(commonAppIds, gameMaps, valid);
  let partialGames = buildGameList(partialAppIds, gameMaps, valid);

  // Sort partial by most owners first, then least playtime
  partialGames.sort((a, b) => {
    if (b.ownersCount !== a.ownersCount) return b.ownersCount - a.ownersCount;
    return a.totalPlaytime - b.totalPlaytime;
  });

  // Multiplayer filter
  if (filterMultiplayer) {
    const toCheckCommon = commonGames.slice(0, 80);
    const commonFlags = await Promise.all(toCheckCommon.map((g) => isMultiplayer(g.appId)));
    commonGames = toCheckCommon.filter((_, i) => commonFlags[i]);

    const toCheckPartial = partialGames.slice(0, 80);
    const partialFlags = await Promise.all(toCheckPartial.map((g) => isMultiplayer(g.appId)));
    partialGames = toCheckPartial.filter((_, i) => partialFlags[i]);
  }

  // Sort common: least total playtime first (discover neglected games)
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
    partialGames,
    totalCommon: commonGames.length,
    filterMultiplayer,
  });
}
