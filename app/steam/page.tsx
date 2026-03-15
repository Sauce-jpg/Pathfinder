"use client";

import { useState, useCallback, useEffect } from "react";
import styles from "./steam.module.css";

interface UserResult {
  input: string;
  steamId: string;
  displayName: string;
  avatar: string | null;
  gameCount: number;
}

interface Game {
  appId: number;
  name: string;
  iconUrl: string | null;
  totalPlaytime: number;
  ownersCount: number;
  storeUrl: string;
}

interface ApiResponse {
  users?: UserResult[];
  commonGames?: Game[];
  partialGames?: Game[];
  totalCommon?: number;
  failed?: string[];
  filterMultiplayer?: boolean;
  error?: string;
}

const STORAGE_KEY = "steam-picker-profiles";
const CROSSED_KEY = "steam-picker-crossed";

export default function SteamPickerPage() {
  const [inputs, setInputs] = useState<string[]>(["", ""]);
  const [filterMultiplayer, setFilterMultiplayer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [pickedGame, setPickedGame] = useState<Game | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [crossedIds, setCrossedIds] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<"all" | "partial">("all");
  const [profilesLoaded, setProfilesLoaded] = useState(false);

  // Load saved profiles + crossed games from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const profiles: string[] = JSON.parse(saved);
        if (profiles.length >= 2) setInputs(profiles);
      }
      const crossed = localStorage.getItem(CROSSED_KEY);
      if (crossed) setCrossedIds(new Set(JSON.parse(crossed)));
      setProfilesLoaded(true);
    } catch {
      setProfilesLoaded(true);
    }
  }, []);

  // Persist inputs whenever they change
  useEffect(() => {
    if (!profilesLoaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
    } catch {}
  }, [inputs, profilesLoaded]);

  // Persist crossed games
  useEffect(() => {
    try {
      localStorage.setItem(CROSSED_KEY, JSON.stringify([...crossedIds]));
    } catch {}
  }, [crossedIds]);

  const addUser = () => {
    if (inputs.length < 8) setInputs((prev) => [...prev, ""]);
  };

  const removeUser = (i: number) => {
    if (inputs.length <= 2) return;
    setInputs((prev) => prev.filter((_, idx) => idx !== i));
  };

  const updateUser = (i: number, val: string) => {
    setInputs((prev) => prev.map((v, idx) => (idx === i ? val : v)));
  };

  const toggleCrossed = (appId: number) => {
    setCrossedIds((prev) => {
      const next = new Set(prev);
      if (next.has(appId)) next.delete(appId);
      else next.add(appId);
      return next;
    });
    if (pickedGame?.appId === appId) setPickedGame(null);
  };

  const clearCrossed = () => setCrossedIds(new Set());

  const fetchGames = useCallback(async () => {
    const filled = inputs.filter((s) => s.trim());
    if (filled.length < 2) {
      setError("Enter at least 2 Steam usernames or profile URLs.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setPickedGame(null);

    try {
      const res = await fetch("/api/steam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users: filled, filterMultiplayer }),
      });
      const data: ApiResponse = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
        setActiveTab("all");
      }
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [inputs, filterMultiplayer]);

  const pickRandom = () => {
    const games = activeTab === "all" ? result?.commonGames : result?.partialGames;
    if (!games?.length) return;
    const eligible = games.filter((g) => !crossedIds.has(g.appId));
    if (!eligible.length) return;
    const pick = eligible[Math.floor(Math.random() * eligible.length)];
    setPickedGame(pick);
    setTimeout(() => {
      document.getElementById("random-pick")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  };

  const formatPlaytime = (minutes: number) => {
    if (minutes === 0) return "unplayed";
    if (minutes < 60) return `${minutes}m`;
    return `${Math.round(minutes / 60).toLocaleString()}h`;
  };

  const currentGames = activeTab === "all" ? result?.commonGames ?? [] : result?.partialGames ?? [];
  const eligibleCount = currentGames.filter((g) => !crossedIds.has(g.appId)).length;

  return (
    <div className={styles.page}>
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
                  <button className={styles.removeBtn} onClick={() => removeUser(i)} title="Remove">
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className={styles.inputActions}>
            {inputs.length < 8 && (
              <button className={styles.addBtn} onClick={addUser}>+ Add person</button>
            )}
            <label className={styles.toggle}>
              <div
                className={`${styles.toggleTrack} ${filterMultiplayer ? styles.toggleOn : ""}`}
                onClick={() => setFilterMultiplayer((v) => !v)}
              >
                <div className={styles.toggleThumb} />
              </div>
              <span>Multiplayer / co-op only</span>
            </label>
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
                    {u.avatar && (
                      <img src={u.avatar} alt={u.displayName} className={styles.userAvatar} />
                    )}
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

            {/* Tabs + actions */}
            <div className={styles.resultsBar}>
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
              </div>
              <div className={styles.resultsActions}>
                {crossedIds.size > 0 && (
                  <button className={styles.clearCrossedBtn} onClick={clearCrossed}>
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
                    <a href={pickedGame.storeUrl} target="_blank" rel="noopener noreferrer" className={styles.storeLink}>
                      Steam ↗
                    </a>
                    <button className={styles.rerollBtn} onClick={pickRandom}>Re-roll</button>
                  </div>
                </div>
              </div>
            )}

            {/* Game grid */}
            {currentGames.length > 0 ? (
              <>
                {crossedIds.size > 0 && (
                  <p className={styles.crossedNote}>
                    {crossedIds.size} game{crossedIds.size !== 1 ? "s" : ""} crossed out — won't be picked. Click ✕ on a card to cross it, ↩ to restore.
                  </p>
                )}
                <div className={styles.gameGrid}>
                  {currentGames.map((game) => {
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
                        <button
                          className={styles.crossBtn}
                          onClick={() => toggleCrossed(game.appId)}
                          title={crossed ? "Restore this game" : "Cross out — skip in picker"}
                        >
                          {crossed ? "↩" : "✕"}
                        </button>
                        <a
                          href={game.storeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.gameLink}
                          tabIndex={crossed ? -1 : 0}
                        >
                          {game.iconUrl ? (
                            <img src={game.iconUrl} alt={game.name} className={styles.gameIcon} />
                          ) : (
                            <div className={styles.gameIconPlaceholder}>🎮</div>
                          )}
                          <div className={styles.gameName}>{game.name}</div>
                          <div className={styles.gameMeta}>
                            <span>{formatPlaytime(game.totalPlaytime)}</span>
                            {activeTab === "partial" && (
                              <span className={styles.ownerBadge}>
                                {game.ownersCount}/{result.users?.length}
                              </span>
                            )}
                          </div>
                        </a>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>😬</div>
                <p className={styles.emptyText}>
                  No common{result.filterMultiplayer ? " multiplayer" : ""} games found.
                </p>
                <p className={styles.emptyHint}>
                  {result.filterMultiplayer
                    ? "Try turning off the multiplayer filter."
                    : "Make sure everyone's Steam profile and game details are set to public."}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
