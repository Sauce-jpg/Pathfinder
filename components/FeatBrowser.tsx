"use client";

import { useState, useEffect } from "react";

export interface CharacterContext {
  feats: string[];          // names of feats already owned
  classFeatures: string[];  // names of class features owned (e.g. "Weapon Focus", "Sneak Attack")
  bab: number;
  level: number;
  abilities: { str: number; dex: number; con: number; int: number; wis: number; cha: number };
}

interface FeatBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFeat: (feat: any) => void;
  // If set, only show feats matching this type (e.g. "combat", "metamagic")
  filterType?: string;
  // If provided, enables prerequisite checking with ⚠️ warnings
  characterContext?: CharacterContext;
}

// ── PREREQUISITE CHECKER ─────────────────────────────────────────────────────
// Returns null if all prerequisites are met, or a human-readable string of what's missing.
export function checkPrerequisites(prerequisites: string | undefined, ctx: CharacterContext): string | null {
  if (!prerequisites) return null;
  const p = prerequisites.trim();
  if (!p || p.toLowerCase() === "none" || p === "—" || p === "-") return null;

  const missing: string[] = [];

  // BAB check — "base attack bonus +6", "BAB +4"
  const babMatch = p.match(/(?:base attack bonus|BAB)\s*\+(\d+)/i);
  if (babMatch && ctx.bab < parseInt(babMatch[1])) {
    missing.push(`BAB +${babMatch[1]} (have +${ctx.bab})`);
  }

  // Character level — "character level 6th", "character level 6"
  const lvlMatch = p.match(/character level (\d+)/i);
  if (lvlMatch && ctx.level < parseInt(lvlMatch[1])) {
    missing.push(`character level ${lvlMatch[1]} (have ${ctx.level})`);
  }

  // Caster level — "caster level 5th" etc.
  // Skip for now — would need spell data

  // Ability score checks — "Str 13", "Strength 13", "Dex 15"
  const abilityMap: [RegExp, keyof CharacterContext["abilities"], string][] = [
    [/\bStr(?:ength)?\s+(\d+)/i, "str", "STR"],
    [/\bDex(?:terity)?\s+(\d+)/i, "dex", "DEX"],
    [/\bCon(?:stitution)?\s+(\d+)/i, "con", "CON"],
    [/\bInt(?:elligence)?\s+(\d+)/i, "int", "INT"],
    [/\bWis(?:dom)?\s+(\d+)/i, "wis", "WIS"],
    [/\bCha(?:risma)?\s+(\d+)/i, "cha", "CHA"],
  ];
  for (const [regex, stat, label] of abilityMap) {
    const m = p.match(regex);
    if (m && ctx.abilities[stat] < parseInt(m[1])) {
      missing.push(`${label} ${m[1]} (have ${ctx.abilities[stat]})`);
    }
  }

  // Proficiency — skip, too complex to auto-derive
  // Spellcasting — skip

  // Feat prerequisites: split on commas, check each chunk against owned feats/features
  const parts = p.split(",").map(s => s.trim());
  for (const part of parts) {
    if (!part) continue;
    // Skip chunks that are already handled above
    if (/base attack bonus|BAB/i.test(part)) continue;
    if (/character level/i.test(part)) continue;
    if (/\b(str|dex|con|int|wis|cha)(?:ength|terity|stitution|elligence|dom|risma)?\s+\d+/i.test(part)) continue;
    if (/proficiency|proficient/i.test(part)) continue;
    if (/caster level/i.test(part)) continue;
    if (/ability to cast/i.test(part)) continue;
    if (/spellcraft rank/i.test(part)) continue;

    // If the remaining part looks like a feat name (contains capital letter, reasonable length)
    if (part.length >= 3 && /[A-Z]/.test(part)) {
      const partLower = part.toLowerCase().replace(/\s*\(.*?\)/g, "").trim(); // strip parentheticals
      const owned = [
        ...ctx.feats.map(f => f.toLowerCase()),
        ...ctx.classFeatures.map(f => f.toLowerCase()),
      ];
      const hasIt = owned.some(o => o === partLower || o.startsWith(partLower) || partLower.startsWith(o));
      if (!hasIt) {
        missing.push(part);
      }
    }
  }

  return missing.length > 0 ? missing.join(", ") : null;
}

// ── TYPE COLORS ───────────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  "combat":           { bg: "#ef4444", text: "white" },
  "metamagic":        { bg: "#8b5cf6", text: "white" },
  "teamwork":         { bg: "#0070f3", text: "white" },
  "item creation":    { bg: "#f59e0b", text: "white" },
  "general":          { bg: "#6b7280", text: "white" },
  "style":            { bg: "#10b981", text: "white" },
  "critical":         { bg: "#dc2626", text: "white" },
  "racial":           { bg: "#7c3aed", text: "white" },
  "monster":          { bg: "#374151", text: "white" },
  "animal companion": { bg: "#065f46", text: "white" },
};

// ─────────────────────────────────────────────────────────────────────────────

export function FeatBrowser({ isOpen, onClose, onSelectFeat, filterType, characterContext }: FeatBrowserProps) {
  const [feats, setFeats] = useState<any[]>([]);
  const [filteredFeats, setFilteredFeats] = useState<any[]>([]);
  const [searchText, setSearchText] = useState("");
  const [selectedType, setSelectedType] = useState(filterType || "");
  const [selectedFeat, setSelectedFeat] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hideUnmetPrereqs, setHideUnmetPrereqs] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadFeats();
      setSelectedType(filterType || "");
      setSelectedFeat(null);
      setSearchText("");
    }
  }, [isOpen, filterType]);

  useEffect(() => {
    filterFeats();
  }, [searchText, selectedType, feats, hideUnmetPrereqs]);

  async function loadFeats() {
    setLoading(true);
    try {
      const response = await fetch("/pathfinder/feats-COMPLETE.json");
      const data = await response.json();
      setFeats(data);
    } catch (error) {
      console.error("Error loading feats:", error);
    }
    setLoading(false);
  }

  function filterFeats() {
    let filtered = [...feats];

    if (searchText) {
      const s = searchText.toLowerCase();
      filtered = filtered.filter(f =>
        f.name.toLowerCase().includes(s) ||
        f.benefit?.toLowerCase().includes(s) ||
        f.prerequisites?.toLowerCase().includes(s)
      );
    }

    // filterType locks the type — selectedType can refine further when no filterType
    const activeType = filterType || selectedType;
    if (activeType) {
      filtered = filtered.filter(f => f.types?.includes(activeType));
    }

    if (hideUnmetPrereqs && characterContext) {
      filtered = filtered.filter(f => checkPrerequisites(f.prerequisites, characterContext) === null);
    }

    setFilteredFeats(filtered);
  }

  if (!isOpen) return null;

  const featTypes = ["combat","metamagic","teamwork","item creation","general","style","critical","racial","monster","animal companion"];

  const prereqStatus = selectedFeat && characterContext
    ? checkPrerequisites(selectedFeat.prerequisites, characterContext)
    : null;

  // Label for the locked filter type banner
  const filterLabel = filterType
    ? filterType.charAt(0).toUpperCase() + filterType.slice(1)
    : null;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000 }}
      onClick={onClose}
    >
      <div
        style={{ background: "white", borderRadius: 12, width: "90%", maxWidth: 1200, height: "82vh", display: "flex", flexDirection: "column" }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #ddd" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
            <div>
              <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.6rem" }}>
                Feat Browser
                {filterLabel && (
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, padding: "0.2rem 0.65rem", background: TYPE_COLORS[filterType!]?.bg ?? "#6b7280", color: "white", borderRadius: 6 }}>
                    {filterLabel} only
                  </span>
                )}
              </h2>
              {filterLabel && (
                <div style={{ fontSize: "0.83rem", color: "#666", marginTop: "0.2rem" }}>
                  This slot requires a <strong>{filterLabel}</strong> feat
                </div>
              )}
            </div>
            <button onClick={onClose} style={{ padding: "0.45rem 1rem", background: "#f3f4f6", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
              ✕ Close
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "0.75rem", alignItems: "center" }}>
            <input
              type="text"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="Search by name, benefit, or prerequisites..."
              autoFocus
              style={{ padding: "0.65rem 0.9rem", border: "1px solid #ddd", borderRadius: 6, fontSize: "1rem" }}
            />
            <select
              value={filterType ? filterType : selectedType}
              onChange={e => !filterType && setSelectedType(e.target.value)}
              disabled={!!filterType}
              style={{ padding: "0.65rem 0.9rem", border: "1px solid #ddd", borderRadius: 6, fontSize: "1rem", minWidth: 190, opacity: filterType ? 0.6 : 1, cursor: filterType ? "not-allowed" : "auto" }}
            >
              <option value="">All Types</option>
              {featTypes.map(t => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
            {characterContext && (
              <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.88rem", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
                <input
                  type="checkbox"
                  checked={hideUnmetPrereqs}
                  onChange={e => setHideUnmetPrereqs(e.target.checked)}
                  style={{ cursor: "pointer" }}
                />
                Hide unmet prereqs
              </label>
            )}
          </div>

          <div style={{ marginTop: "0.4rem", fontSize: "0.85rem", color: "#666", display: "flex", gap: "1rem", alignItems: "center" }}>
            <span>{filteredFeats.length} of {feats.length} feats</span>
            {characterContext && !hideUnmetPrereqs && (
              <span style={{ color: "#d97706" }}>⚠️ Yellow = prerequisites not met (can still add with GM approval)</span>
            )}
          </div>
        </div>

        {/* ── Content ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", flex: 1, overflow: "hidden" }}>

          {/* Feat List */}
          <div style={{ borderRight: "1px solid #ddd", overflowY: "auto", padding: "0.75rem" }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: "3rem", color: "#999" }}>Loading feats…</div>
            ) : filteredFeats.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem", color: "#999" }}>No feats match your filters</div>
            ) : (
              <div style={{ display: "grid", gap: "0.35rem" }}>
                {filteredFeats.map(feat => {
                  const missing = characterContext ? checkPrerequisites(feat.prerequisites, characterContext) : null;
                  const isSelected = selectedFeat?.name === feat.name;
                  return (
                    <div
                      key={feat.name}
                      onClick={() => setSelectedFeat(feat)}
                      style={{
                        padding: "0.6rem 0.75rem",
                        background: isSelected ? "#eff6ff" : missing ? "#fffbeb" : "white",
                        border: `1px solid ${isSelected ? "#3b82f6" : missing ? "#fde68a" : "#e5e7eb"}`,
                        borderRadius: 6,
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.4rem" }}>
                        <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{feat.name}</span>
                        {missing && <span style={{ fontSize: "0.72rem", color: "#d97706", flexShrink: 0, whiteSpace: "nowrap" }}>⚠️ prereqs</span>}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.2rem", marginTop: "0.25rem" }}>
                        {(feat.types || []).map((type: string) => {
                          const tc = TYPE_COLORS[type];
                          return (
                            <span key={type} style={{ padding: "0.1rem 0.4rem", background: tc?.bg ?? "#e5e7eb", color: tc?.text ?? "#333", borderRadius: 3, fontSize: "0.7rem", fontWeight: 600 }}>
                              {type}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Feat Details */}
          <div style={{ overflowY: "auto", padding: "1.5rem" }}>
            {selectedFeat ? (
              <div>
                <h3 style={{ marginTop: 0, color: "#1e40af", marginBottom: "0.75rem" }}>{selectedFeat.name}</h3>

                {/* Type badges */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1rem" }}>
                  {(selectedFeat.types || []).map((type: string) => {
                    const tc = TYPE_COLORS[type];
                    return (
                      <span key={type} style={{ padding: "0.25rem 0.7rem", background: tc?.bg ?? "#6b7280", color: tc?.text ?? "white", borderRadius: 6, fontSize: "0.85rem", fontWeight: 700 }}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </span>
                    );
                  })}
                </div>

                {/* Prerequisites with live check */}
                <div style={{ marginBottom: "1rem", padding: "0.75rem 1rem", background: prereqStatus ? "#fffbeb" : characterContext ? "#f0fdf4" : "#f9fafb", border: `1px solid ${prereqStatus ? "#fcd34d" : characterContext ? "#86efac" : "#e5e7eb"}`, borderRadius: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.85rem", color: prereqStatus ? "#92400e" : characterContext ? "#166534" : "#374151", marginBottom: "0.3rem" }}>
                    {prereqStatus
                      ? "⚠️ Prerequisites not fully met"
                      : characterContext
                        ? "✅ Prerequisites met"
                        : "📋 Prerequisites"}
                  </div>
                  <div style={{ fontSize: "0.88rem", color: "#555" }}>
                    {selectedFeat.prerequisites || "None"}
                  </div>
                  {prereqStatus && (
                    <div style={{ marginTop: "0.4rem", fontSize: "0.82rem", color: "#b45309" }}>
                      <strong>Missing:</strong> {prereqStatus}
                    </div>
                  )}
                </div>

                {/* Benefit */}
                {selectedFeat.benefit && (
                  <div style={{ marginBottom: "1rem" }}>
                    <div style={{ fontWeight: 700, marginBottom: "0.3rem" }}>Benefit</div>
                    <p style={{ margin: 0, lineHeight: 1.65, color: "#374151", fontSize: "0.93rem" }}>{selectedFeat.benefit}</p>
                  </div>
                )}

                {/* Normal */}
                {selectedFeat.normal && (
                  <div style={{ marginBottom: "1rem", fontSize: "0.9rem", color: "#555" }}>
                    <strong>Normal:</strong> {selectedFeat.normal}
                  </div>
                )}

                {/* Source */}
                {selectedFeat.source && (
                  <div style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
                    Source: {selectedFeat.source}
                  </div>
                )}

                {/* Add button */}
                <div style={{ marginTop: "1.5rem" }}>
                  {prereqStatus && (
                    <div style={{ padding: "0.6rem 0.8rem", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, fontSize: "0.82rem", color: "#92400e", marginBottom: "0.75rem" }}>
                      ⚠️ You don't meet all prerequisites. You may still add this feat — check with your GM.
                    </div>
                  )}
                  <button
                    onClick={() => { onSelectFeat(selectedFeat); onClose(); }}
                    style={{
                      width: "100%",
                      padding: "0.8rem",
                      background: prereqStatus ? "#f59e0b" : "#10b981",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontWeight: 700,
                      fontSize: "1rem",
                    }}
                  >
                    {prereqStatus ? "Add Anyway (warn GM)" : "Add This Feat"}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "#9ca3af" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⚔️</div>
                <div>Select a feat from the list to view details</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
