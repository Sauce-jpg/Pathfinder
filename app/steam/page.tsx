"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import styles from "./steam.module.css";

// ── Types ──────────────────────────────────────────────────

interface UserResult {
  steamId: string;
  displayName: string;
  avatar: string | null;
  gameCount: number;
}

interface UserPlaytime {
  steamId: string;
  displayName: string;
  avatar: string | null;
  playtime: number | null; // null = doesn't own
}

interface Game {
  appId: number;
  name: string;
  iconUrl: string | null;
  totalPlaytime: number;
  ownersCount: number;
  storeUrl: string;
  categories: string[];
  genres: string[];
  userPlaytimes: UserPlaytime[];
}

interface UserLibraryGame {
  appId: number;
  name: string;
  iconUrl: string | null;
  playtime: number;
  storeUrl: string;
}

interface UserLibrary {
  steamId: string;
  games: UserLibraryGame[];
}

interface ApiResponse {
  users?: UserResult[];
  commonGames?: Game[];
  partialGames?: Game[];
  userLibraries?: UserLibrary[];
  totalCommon?: number;
  failed?: string[];
  error?: string;
}

// ── Constants ──────────────────────────────────────────────

const STORAGE_KEY = "steam-picker-profiles";
const CROSSED_KEY = "steam-picker-crossed";

const CATEGORY_FILTERS = [
  { label: "Multi-player",      match: "Multi-player" },
  { label: "Co-op",             match: "Co-op" },
  { label: "Online Co-op",      match: "Online Co-op" },
  { label: "Remote Play Together", match: "Remote Play Together" },
  { label: "PvP",               match: "PvP" },
  { label: "Cross-Platform",    match: "Cross-Platform Multiplayer" },
];

const GENRE_FILTERS = [
  "Action", "Adventure", "RPG", "Strategy",
  "Simulation", "Sports", "Racing", "Indie", "Casual",
];

// ── Helpers ────────────────────────────────────────────────

function formatPlaytime(minutes: number): string {
  if (minutes === 0) return "unplayed";
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 60).toLocaleString()}h`;
}

// ── Game Detail Modal ──────────────────────────────────────

function GameModal({ game, userCount, onClose }: {
  game: Game;
  userCount: number;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.modalClose} onClick={onClose}>✕</button>

        <div className={styles.modalHeader}>
          {game.iconUrl && (
            <img src={game.iconUrl} alt={game.name} className={styles.modalIcon} />
          )}
          <div>
            <h2 className={styles.modalTitle}>{game.name}</h2>
            <div className={styles.modalMeta}>
              Owned by {game.ownersCount} of {userCount} ·{" "}
              {formatPlaytime(game.totalPlaytime)} total group playtime
            </div>
          </div>
        </div>

        {/* Ownership & per-user playtime */}
        <div className={styles.modalSection}>
          <h3 className={styles.modalSectionTitle}>Who owns it</h3>
          <div className={styles.modalPlayerList}>
            {game.userPlaytimes.map((u) => (
              <div key={u.steamId} className={`${styles.modalPlayer} ${u.playtime === null ? styles.modalPlayerMissing : ""}`}>
                {u.avatar ? (
                  <img src={u.avatar} alt={u.displayName} className={styles.modalPlayerAvatar} />
                ) : (
                  <div className={styles.modalPlayerAvatarPlaceholder}>👤</div>
                )}
                <div className={styles.modalPlayerInfo}>
                  <span className={styles.modalPlayerName}>{u.displayName}</span>
                  <span className={styles.modalPlayerPlaytime}>
                    {u.playtime === null
                      ? "Doesn't own"
                      : u.playtime === 0
                      ? "Owns · unplayed"
                      : `${formatPlaytime(u.playtime)} played`}
                  </span>
                </div>
                {u.playtime !== null && (
                  <div className={styles.modalPlayerBar}>
                    <div
                      className={styles.modalPlayerBarFill}
                      style={{
                        width: `${Math.min(100, (u.playtime / Math.max(...game.userPlaytimes.map(p => p.playtime ?? 0), 1)) * 100)}%`
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tags */}
        {(game.categories.length > 0 || game.genres.length > 0) && (
          <div className={styles.modalSection}>
            <h3 className={styles.modalSectionTitle}>Tags</h3>
            <div className={styles.modalTags}>
              {game.categories.map((c) => (
                <span key={c} className={`${styles.modalTag} ${styles.modalTagCat}`}>{c}</span>
              ))}
              {game.genres.map((g) => (
                <span key={g} className={`${styles.modalTag} ${styles.modalTagGenre}`}>{g}</span>
              ))}
            </div>
          </div>
        )}

        <a
          href={game.storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.modalStoreBtn}
        >
          View on Steam ↗
        </a>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────

type MainTab = "all" | "partial" | "library";

export default function SteamPickerPage() {
  const [inputs, setInputs] = useState<string[]>(["", ""]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [pickedGame, setPickedGame] = useState<Game | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [crossedIds, setCrossedIds] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<MainTab>("all");
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [modalGame, setModalGame] = useState<Game | null>(null);
  const [libraryUser, setLibraryUser] = useState<string | null>(null);
  const [librarySearch, setLibrarySearch] = useState("");

  // Active filters
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set());
  const [activeGenres, setActiveGenres] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<"least-played" | "most-played" | "alpha">("least-played");

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const profiles: string[] = JSON.parse(saved);
        if (profiles.length >= 2) setInputs(profiles);
      }
      const crossed = localStorage.getItem(CROSSED_KEY);
      if (crossed) setCrossedIds(new Set(JSON.parse(crossed)));
    } catch {}
    setProfilesLoaded(true);
  }, []);

  useEffect(() => {
    if (!profilesLoaded) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs)); } catch {}
  }, [inputs, profilesLoaded]);

  useEffect(() => {
    try { localStorage.setItem(CROSSED_KEY, JSON.stringify([...crossedIds])); } catch {}
  }, [crossedIds]);

  const addUser = () => { if (inputs.length < 8) setInputs((p) => [...p, ""]); };
  const removeUser = (i: number) => { if (inputs.length > 2) setInputs((p) => p.filter((_, idx) => idx !== i)); };
  const updateUser = (i: number, val: string) => setInputs((p) => p.map((v, idx) => idx === i ? val : v));

  const toggleCrossed = (e: React.MouseEvent, appId: number) => {
    e.preventDefault();
    e.stopPropagation();
    setCrossedIds((prev) => {
      const next = new Set(prev);
      if (next.has(appId)) next.delete(appId);
      else next.add(appId);
      return next;
    });
    if (pickedGame?.appId === appId) setPickedGame(null);
  };

  const toggleCategory = (cat: string) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const toggleGenre = (genre: string) => {
    setActiveGenres((prev) => {
      const next = new Set(prev);
      if (next.has(genre)) next.delete(genre); else next.add(genre);
      return next;
    });
  };

  const clearFilters = () => { setActiveCategories(new Set()); setActiveGenres(new Set()); };

  const fetchGames = useCallback(async () => {
    const filled = inputs.filter((s) => s.trim());
    if (filled.length < 2) { setError("Enter at least 2 Steam usernames or profile URLs."); return; }
    setLoading(true);
    setError(null);
    setResult(null);
    setPickedGame(null);
    setActiveTab("all");
    clearFilters();

    try {
      const res = await fetch("/api/steam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users: filled }),
      });
      const data: ApiResponse = await res.json();
      if (data.error) setError(data.error);
      else { setResult(data); setLibraryUser(data.users?.[0]?.steamId ?? null); }
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [inputs]);

  // Apply filters + sort to a game list
  const applyFilters = useCallback((games: Game[]): Game[] => {
    let filtered = games;
    if (activeCategories.size > 0) {
      filtered = filtered.filter((g) =>
        [...activeCategories].every((cat) => {
          const match = CATEGORY_FILTERS.find((f) => f.label === cat)?.match ?? cat;
          return g.categories.includes(match);
        })
      );
    }
    if (activeGenres.size > 0) {
      filtered = filtered.filter((g) =>
        [...activeGenres].some((genre) => g.genres.includes(genre))
      );
    }
    return [...filtered].sort((a, b) => {
      if (sortMode === "alpha") return a.name.localeCompare(b.name);
      if (sortMode === "most-played") return b.totalPlaytime - a.totalPlaytime;
      return a.totalPlaytime - b.totalPlaytime; // least-played
    });
  }, [activeCategories, activeGenres, sortMode]);

  const displayedGames = useMemo(() => {
    const base = activeTab === "all" ? result?.commonGames : result?.partialGames;
    return applyFilters(base ?? []);
  }, [activeTab, result, applyFilters]);

  const eligibleCount = useMemo(
    () => displayedGames.filter((g) => !crossedIds.has(g.appId)).length,
    [displayedGames, crossedIds]
  );

  const pickRandom = () => {
    const eligible = displayedGames.filter((g) => !crossedIds.has(g.appId));
    if (!eligible.length) return;
    const pick = eligible[Math.floor(Math.random() * eligible.length)];
    setPickedGame(pick);
    setTimeout(() => {
      document.getElementById("random-pick")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  };

  // Library view
  const currentLibrary = useMemo(() => {
    if (!result?.userLibraries || !libraryUser) return [];
    const lib = result.userLibraries.find((l) => l.steamId === libraryUser);
    if (!lib) return [];
    const q = librarySearch.toLowerCase();
    return lib.games.filter((g) => !q || g.name.toLowerCase().includes(q));
  }, [result, libraryUser, librarySearch]);

  const filtersActive = activeCategories.size + activeGenres.size;

  return (
    <div className={styles.page}>
      {/* Modal */}
      {modalGame && (
        <GameModal
          game={modalGame}
          userCount={result?.users?.length ?? 0}
          onClose={() => setModalGame(null)}
        />
      )}

      <header className={styles.hero}>
        <div className={styles.heroPattern} />
        <div className={styles.heroContent}>
          <span className={styles.badge}>🎮 Game Night</span>
          <h1 className={styles.title}>What do we <em>play</em> tonight?</h1>
          <p className={styles.subtitle}>
            Add your crew's Steam profiles, find games you all own, and let fate decide.
          </p>
        </div>
      </header>

      <div className={styles.main}>
        {/* Input card */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Your crew</h2>
            <span className={styles.savedNote}>💾 Profiles saved in browser</span>
          </div>

          <div className={styles.inputList}>
            {inputs.map((val, i) => (
              <div key={i} className={styles.inputRow}>
                <span className={styles.inputIndex}>{i + 1}</span>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="steamcommunity.com/id/username  or  username  or  SteamID64"
                  value={val}
                  onChange={(e) => updateUser(i, e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchGames()}
                />
                {inputs.length > 2 && (
                  <button className={styles.removeBtn} onClick={() => removeUser(i)} title="Remove">✕</button>
                )}
              </div>
            ))}
          </div>

          <div className={styles.inputActions}>
            {inputs.length < 8 && (
              <button className={styles.addBtn} onClick={addUser}>+ Add person</button>
            )}
          </div>

          {error && <div className={styles.errorBox}>{error}</div>}

          <button className={styles.searchBtn} onClick={fetchGames} disabled={loading}>
            {loading ? <span className={styles.spinner} /> : "Find common games →"}
          </button>

          <p className={styles.hint}>
            Profiles are automatically saved in your browser. Supports profile links, plain usernames, or SteamID64.{" "}
            <strong>Profiles must be public.</strong>
          </p>
        </section>

        {result && (
          <>
            {/* User chips */}
            {result.users && result.users.length > 0 && (
              <div className={styles.userRow}>
                {result.users.map((u) => (
                  <div key={u.steamId} className={styles.userChip}>
                    {u.avatar && <img src={u.avatar} alt={u.displayName} className={styles.userAvatar} />}
                    <div>
                      <div className={styles.userName}>{u.displayName}</div>
                      <div className={styles.userSub}>{u.gameCount.toLocaleString()} games</div>
                    </div>
                  </div>
                ))}
                {result.failed && result.failed.length > 0 && (
                  <div className={styles.failedChip}>⚠️ Couldn't load: {result.failed.join(", ")}</div>
                )}
              </div>
            )}

            {/* Main tabs */}
            <div className={styles.tabBar}>
              <div className={styles.tabs}>
                <button
                  className={`${styles.tab} ${activeTab === "all" ? styles.tabActive : ""}`}
                  onClick={() => { setActiveTab("all"); setPickedGame(null); }}
                >
                  Everyone owns
                  <span className={styles.tabCount}>{result.commonGames?.length ?? 0}</span>
                </button>
                {(result.partialGames?.length ?? 0) > 0 && (
                  <button
                    className={`${styles.tab} ${activeTab === "partial" ? styles.tabActive : ""}`}
                    onClick={() => { setActiveTab("partial"); setPickedGame(null); }}
                  >
                    Most own
                    <span className={styles.tabCount}>{result.partialGames?.length ?? 0}</span>
                  </button>
                )}
                <button
                  className={`${styles.tab} ${activeTab === "library" ? styles.tabActive : ""}`}
                  onClick={() => { setActiveTab("library"); setPickedGame(null); }}
                >
                  Individual libraries
                </button>
              </div>
            </div>

            {/* ── Library view ── */}
            {activeTab === "library" && (
              <div className={styles.libraryView}>
                {/* User selector */}
                <div className={styles.libraryUserPicker}>
                  {result.users?.map((u) => (
                    <button
                      key={u.steamId}
                      className={`${styles.libraryUserBtn} ${libraryUser === u.steamId ? styles.libraryUserBtnActive : ""}`}
                      onClick={() => { setLibraryUser(u.steamId); setLibrarySearch(""); }}
                    >
                      {u.avatar && <img src={u.avatar} alt={u.displayName} className={styles.libraryUserAvatar} />}
                      {u.displayName}
                      <span className={styles.libraryUserCount}>{u.gameCount.toLocaleString()}</span>
                    </button>
                  ))}
                </div>

                <div className={styles.librarySearchRow}>
                  <input
                    className={styles.librarySearch}
                    type="text"
                    placeholder="Search games…"
                    value={librarySearch}
                    onChange={(e) => setLibrarySearch(e.target.value)}
                  />
                  <span className={styles.libraryCount}>{currentLibrary.length} games</span>
                </div>

                <div className={styles.libraryGrid}>
                  {currentLibrary.map((g) => (
                    <a
                      key={g.appId}
                      href={g.storeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.libraryCard}
                    >
                      {g.iconUrl
                        ? <img src={g.iconUrl} alt={g.name} className={styles.gameIcon} />
                        : <div className={styles.gameIconPlaceholder}>🎮</div>
                      }
                      <div className={styles.gameName}>{g.name}</div>
                      <div className={styles.gameMeta}>{formatPlaytime(g.playtime)}</div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* ── Shared games views ── */}
            {activeTab !== "library" && (
              <>
                {/* Filter bar */}
                <div className={styles.filterBar}>
                  <div className={styles.filterRow}>
                    <span className={styles.filterLabel}>Category</span>
                    <div className={styles.filterChips}>
                      {CATEGORY_FILTERS.map((f) => (
                        <button
                          key={f.label}
                          className={`${styles.filterChip} ${activeCategories.has(f.label) ? styles.filterChipActive : ""}`}
                          onClick={() => toggleCategory(f.label)}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className={styles.filterRow}>
                    <span className={styles.filterLabel}>Genre</span>
                    <div className={styles.filterChips}>
                      {GENRE_FILTERS.map((g) => (
                        <button
                          key={g}
                          className={`${styles.filterChip} ${activeGenres.has(g) ? styles.filterChipActive : ""}`}
                          onClick={() => toggleGenre(g)}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className={styles.filterRow}>
                    <span className={styles.filterLabel}>Sort</span>
                    <div className={styles.filterChips}>
                      {([
                        ["least-played", "Least played"],
                        ["most-played", "Most played"],
                        ["alpha", "A → Z"],
                      ] as const).map(([val, label]) => (
                        <button
                          key={val}
                          className={`${styles.filterChip} ${sortMode === val ? styles.filterChipActive : ""}`}
                          onClick={() => setSortMode(val)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {filtersActive > 0 && (
                    <button className={styles.clearFiltersBtn} onClick={clearFilters}>
                      Clear {filtersActive} filter{filtersActive !== 1 ? "s" : ""}
                    </button>
                  )}
                </div>

                {/* Action bar */}
                <div className={styles.actionBar}>
                  <span className={styles.actionCount}>
                    {displayedGames.length} game{displayedGames.length !== 1 ? "s" : ""}
                    {filtersActive > 0 ? " (filtered)" : ""}
                  </span>
                  <div className={styles.actionBtns}>
                    {crossedIds.size > 0 && (
                      <button className={styles.clearCrossedBtn} onClick={() => setCrossedIds(new Set())}>
                        ↩ Clear {crossedIds.size} crossed
                      </button>
                    )}
                    {eligibleCount > 0 && (
                      <button className={styles.randomBtn} onClick={pickRandom}>
                        🎲 Pick for us ({eligibleCount})
                      </button>
                    )}
                  </div>
                </div>

                {/* Picked spotlight */}
                {pickedGame && (
                  <div className={styles.pickedCard} id="random-pick">
                    <div className={styles.pickedLabel}>🎲 Tonight's pick</div>
                    <div className={styles.pickedContent}>
                      {pickedGame.iconUrl && (
                        <img src={pickedGame.iconUrl} alt={pickedGame.name} className={styles.pickedIcon} />
                      )}
                      <div className={styles.pickedInfo}>
                        <div className={styles.pickedName}>{pickedGame.name}</div>
                        <div className={styles.pickedMeta}>
                          {formatPlaytime(pickedGame.totalPlaytime)} group playtime ·{" "}
                          owned by {pickedGame.ownersCount} of {result.users?.length}
                        </div>
                      </div>
                      <div className={styles.pickedBtns}>
                        <button className={styles.detailBtn} onClick={() => setModalGame(pickedGame)}>Details</button>
                        <a href={pickedGame.storeUrl} target="_blank" rel="noopener noreferrer" className={styles.storeLink}>Steam ↗</a>
                        <button className={styles.rerollBtn} onClick={pickRandom}>Re-roll</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Game grid */}
                {displayedGames.length > 0 ? (
                  <>
                    {crossedIds.size > 0 && (
                      <p className={styles.crossedNote}>
                        {crossedIds.size} game{crossedIds.size !== 1 ? "s" : ""} crossed out — won't be picked. Hover a card and click ✕ to cross, ↩ to restore.
                      </p>
                    )}
                    <div className={styles.gameGrid}>
                      {displayedGames.map((game) => {
                        const crossed = crossedIds.has(game.appId);
                        const isPicked = pickedGame?.appId === game.appId;
                        return (
                          <div
                            key={game.appId}
                            className={[
                              styles.gameCard,
                              crossed ? styles.gameCardCrossed : "",
                              isPicked ? styles.gameCardPicked : "",
                            ].join(" ")}
                          >
                            {/* Cross button — stopPropagation so it doesn't open the modal */}
                            <button
                              className={styles.crossBtn}
                              onClick={(e) => toggleCrossed(e, game.appId)}
                              title={crossed ? "Restore this game" : "Cross out — skip in picker"}
                            >
                              {crossed ? "↩" : "✕"}
                            </button>

                            {/* Card body opens modal */}
                            <button
                              className={styles.gameCardBody}
                              onClick={() => !crossed && setModalGame(game)}
                              title="View details"
                            >
                              {game.iconUrl
                                ? <img src={game.iconUrl} alt={game.name} className={styles.gameIcon} />
                                : <div className={styles.gameIconPlaceholder}>🎮</div>
                              }
                              <div className={styles.gameName}>{game.name}</div>
                              <div className={styles.gameMeta}>
                                <span>{formatPlaytime(game.totalPlaytime)}</span>
                                {activeTab === "partial" && (
                                  <span className={styles.ownerBadge}>
                                    {game.ownersCount}/{result.users?.length}
                                  </span>
                                )}
                              </div>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>😬</div>
                    <p className={styles.emptyText}>No games match your filters.</p>
                    <p className={styles.emptyHint}>Try removing some filters.</p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
