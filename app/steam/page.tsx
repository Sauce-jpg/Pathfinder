"use client";

import { useState, useCallback } from "react";
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
  totalCommon?: number;
  failed?: string[];
  filterMultiplayer?: boolean;
  error?: string;
}

export default function SteamPickerPage() {
  const [inputs, setInputs] = useState<string[]>(["", ""]);
  const [filterMultiplayer, setFilterMultiplayer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [pickedGame, setPickedGame] = useState<Game | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      }
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [inputs, filterMultiplayer]);

  const pickRandom = () => {
    if (!result?.commonGames?.length) return;
    const pool = result.commonGames;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    setPickedGame(pick);
    document
      .getElementById("random-pick")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const formatPlaytime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.round(minutes / 60);
    return `${h.toLocaleString()}h`;
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroContent}>
          <div className={styles.badge}>🎮 Game Night</div>
          <h1 className={styles.title}>
            What do we<br />
            <span className={styles.titleAccent}>play tonight?</span>
          </h1>
          <p className={styles.subtitle}>
            Add your crew's Steam profiles and find games everyone owns — then let fate decide.
          </p>
        </div>
      </div>

      <div className={styles.main}>
        {/* Input panel */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>
            <span className={styles.cardTitleIcon}>👥</span> Your crew
          </h2>

          <div className={styles.inputList}>
            {inputs.map((val, i) => (
              <div key={i} className={styles.inputRow}>
                <div className={styles.inputIndex}>{i + 1}</div>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="Steam URL, username, or SteamID64"
                  value={val}
                  onChange={(e) => updateUser(i, e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchGames()}
                />
                {inputs.length > 2 && (
                  <button
                    className={styles.removeBtn}
                    onClick={() => removeUser(i)}
                    title="Remove"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className={styles.inputFooter}>
            {inputs.length < 8 && (
              <button className={styles.addBtn} onClick={addUser}>
                + Add person
              </button>
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

          <button
            className={styles.searchBtn}
            onClick={fetchGames}
            disabled={loading}
          >
            {loading ? (
              <span className={styles.spinner} />
            ) : (
              "🔍 Find common games"
            )}
          </button>

          <p className={styles.hint}>
            Supports profile links like{" "}
            <code>steamcommunity.com/id/username</code> or plain usernames.
            Profiles must be <strong>public</strong>.
          </p>
        </div>

        {/* Results */}
        {result && (
          <>
            {/* User chips */}
            {result.users && result.users.length > 0 && (
              <div className={styles.userChips}>
                {result.users.map((u) => (
                  <div key={u.steamId} className={styles.userChip}>
                    {u.avatar && (
                      <img
                        src={u.avatar}
                        alt={u.displayName}
                        className={styles.userAvatar}
                      />
                    )}
                    <div className={styles.userInfo}>
                      <span className={styles.userName}>{u.displayName}</span>
                      <span className={styles.userGames}>
                        {u.gameCount.toLocaleString()} games
                      </span>
                    </div>
                  </div>
                ))}
                {result.failed && result.failed.length > 0 && (
                  <div className={styles.failedChip}>
                    ⚠️ Couldn't load: {result.failed.join(", ")}
                  </div>
                )}
              </div>
            )}

            {/* Stats banner */}
            <div className={styles.statsBanner}>
              <div className={styles.stat}>
                <span className={styles.statNum}>{result.totalCommon ?? 0}</span>
                <span className={styles.statLabel}>
                  {result.filterMultiplayer ? "Multiplayer games" : "Common games"}
                </span>
              </div>
              <div className={styles.statDivider} />
              <div className={styles.stat}>
                <span className={styles.statNum}>{result.users?.length ?? 0}</span>
                <span className={styles.statLabel}>Players loaded</span>
              </div>
              {result.commonGames && result.commonGames.length > 0 && (
                <>
                  <div className={styles.statDivider} />
                  <button className={styles.randomBtn} onClick={pickRandom}>
                    🎲 Pick for us
                  </button>
                </>
              )}
            </div>

            {/* Random pick spotlight */}
            {pickedGame && (
              <div className={styles.pickedCard} id="random-pick">
                <div className={styles.pickedLabel}>🎲 Tonight's pick</div>
                <div className={styles.pickedContent}>
                  {pickedGame.iconUrl && (
                    <img
                      src={pickedGame.iconUrl}
                      alt={pickedGame.name}
                      className={styles.pickedIcon}
                    />
                  )}
                  <div>
                    <div className={styles.pickedName}>{pickedGame.name}</div>
                    <div className={styles.pickedMeta}>
                      {formatPlaytime(pickedGame.totalPlaytime)} total playtime across group
                    </div>
                  </div>
                  <a
                    href={pickedGame.storeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.storeLink}
                  >
                    View on Steam ↗
                  </a>
                </div>
                <button className={styles.rerollBtn} onClick={pickRandom}>
                  Re-roll
                </button>
              </div>
            )}

            {/* Game list */}
            {result.commonGames && result.commonGames.length > 0 ? (
              <div className={styles.gameGrid}>
                {result.commonGames.map((game) => (
                  <a
                    key={game.appId}
                    href={game.storeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${styles.gameCard} ${pickedGame?.appId === game.appId ? styles.gameCardPicked : ""}`}
                  >
                    {game.iconUrl ? (
                      <img
                        src={game.iconUrl}
                        alt={game.name}
                        className={styles.gameIcon}
                      />
                    ) : (
                      <div className={styles.gameIconPlaceholder}>🎮</div>
                    )}
                    <div className={styles.gameName}>{game.name}</div>
                    <div className={styles.gamePlaytime}>
                      {formatPlaytime(game.totalPlaytime)} played
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>😬</div>
                <div className={styles.emptyText}>
                  No common{result.filterMultiplayer ? " multiplayer" : ""} games found.
                </div>
                <div className={styles.emptyHint}>
                  {result.filterMultiplayer
                    ? "Try turning off the multiplayer filter."
                    : "Make sure everyone's profile is set to public."}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
