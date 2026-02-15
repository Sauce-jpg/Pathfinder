"use client";

import { useEffect, useState } from "react";

interface SpellBrowserProps {
  onClose: () => void;
  onAddSpell: (spell: any) => void;
  className: string;
  filterLevel?: number | null;
}

export function SpellBrowser({ onClose, onAddSpell, className, filterLevel }: SpellBrowserProps) {
  const [spells, setSpells] = useState<any[]>([]);
  const [filteredSpells, setFilteredSpells] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>(filterLevel?.toString() || "");
  const [schoolFilter, setSchoolFilter] = useState("");
  const [selectedSpell, setSelectedSpell] = useState<any>(null);

  useEffect(() => {
    loadSpells();
  }, []);

  useEffect(() => {
    filterSpellList();
  }, [spells, search, levelFilter, schoolFilter, className]);

  async function loadSpells() {
    setLoading(true);
    try {
      const response = await fetch("/pathfinder/spells-all.json");
      const data = await response.json();
      setSpells(data);
    } catch (error) {
      console.error("Error loading spells:", error);
      alert("Failed to load spell database");
    }
    setLoading(false);
  }

  function filterSpellList() {
    let filtered = spells;

    // Filter by class
    filtered = filtered.filter((spell) => spell.level && spell.level[className] !== undefined);

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter((spell) =>
        spell.name.toLowerCase().includes(searchLower) ||
        (spell.description && spell.description.toLowerCase().includes(searchLower))
      );
    }

    // Filter by level
    if (levelFilter) {
      const level = parseInt(levelFilter);
      filtered = filtered.filter((spell) => spell.level[className] === level);
    }

    // Filter by school
    if (schoolFilter) {
      filtered = filtered.filter((spell) => spell.school === schoolFilter);
    }

    // Sort by level, then name
    filtered.sort((a, b) => {
      const levelDiff = a.level[className] - b.level[className];
      if (levelDiff !== 0) return levelDiff;
      return a.name.localeCompare(b.name);
    });

    setFilteredSpells(filtered);
  }

  const schools = [
    "Abjuration",
    "Conjuration",
    "Divination",
    "Enchantment",
    "Evocation",
    "Illusion",
    "Necromancy",
    "Transmutation",
  ];

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 4000,
        padding: "2rem",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          borderRadius: "12px",
          width: "100%",
          maxWidth: "1000px",
          height: "90vh",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "1.5rem", borderBottom: "1px solid #ddd" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 style={{ margin: 0 }}>
              Spell Database - {className}
            </h2>
            <button
              onClick={onClose}
              style={{
                padding: "0.5rem 1rem",
                background: "#eee",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "1rem",
              }}
            >
              ✕ Close
            </button>
          </div>

          {/* Filters */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "1rem" }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search spell name or description..."
              style={{
                padding: "0.75rem",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "1rem",
              }}
            />

            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              style={{
                padding: "0.75rem",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "1rem",
              }}
            >
              <option value="">All Levels</option>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => (
                <option key={level} value={level}>
                  {level === 0 ? "Cantrips" : `Level ${level}`}
                </option>
              ))}
            </select>

            <select
              value={schoolFilter}
              onChange={(e) => setSchoolFilter(e.target.value)}
              style={{
                padding: "0.75rem",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "1rem",
              }}
            >
              <option value="">All Schools</option>
              {schools.map((school) => (
                <option key={school} value={school}>
                  {school}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: "#666" }}>
            {loading ? "Loading..." : `${filteredSpells.length} spells found`}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Spell List */}
          <div
            style={{
              flex: selectedSpell ? 1 : 1,
              borderRight: selectedSpell ? "1px solid #ddd" : "none",
              overflow: "auto",
            }}
          >
            {loading ? (
              <div style={{ padding: "2rem", textAlign: "center" }}>Loading spells...</div>
            ) : filteredSpells.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#999" }}>
                No spells found matching your filters.
              </div>
            ) : (
              <div>
                {filteredSpells.map((spell) => (
                  <div
                    key={spell.name}
                    onClick={() => setSelectedSpell(spell)}
                    style={{
                      padding: "1rem 1.5rem",
                      borderBottom: "1px solid #eee",
                      cursor: "pointer",
                      background: selectedSpell?.name === spell.name ? "#f0fdf4" : "white",
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      if (selectedSpell?.name !== spell.name) {
                        e.currentTarget.style.background = "#f9fafb";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedSpell?.name !== spell.name) {
                        e.currentTarget.style.background = "white";
                      }
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 600, color: "#8b5cf6" }}>{spell.name}</div>
                        <div style={{ fontSize: "0.85rem", color: "#666", marginTop: "0.25rem" }}>
                          {spell.school} {spell.level[className]}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddSpell(spell);
                        }}
                        style={{
                          padding: "0.5rem 1rem",
                          background: "#10b981",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "0.85rem",
                        }}
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Spell Details */}
          {selectedSpell && (
            <div style={{ flex: 1, overflow: "auto", padding: "1.5rem" }}>
              <h3 style={{ marginTop: 0, color: "#8b5cf6" }}>{selectedSpell.name}</h3>

              <div style={{ display: "grid", gap: "1rem", fontSize: "0.95rem" }}>
                <div>
                  <strong>School:</strong> {selectedSpell.school}
                </div>
                <div>
                  <strong>Level:</strong> {className} {selectedSpell.level[className]}
                </div>
                {selectedSpell.casting_time && (
                  <div>
                    <strong>Casting Time:</strong> {selectedSpell.casting_time}
                  </div>
                )}
                {selectedSpell.components && (
                  <div>
                    <strong>Components:</strong>{" "}
                    {[
                      selectedSpell.components.verbal && "V",
                      selectedSpell.components.somatic && "S",
                      selectedSpell.components.material && "M",
                      selectedSpell.components.focus && "F",
                      selectedSpell.components.divine_focus && "DF",
                    ]
                      .filter(Boolean)
                      .join(", ")}
                    {selectedSpell.components.material_text && ` (${selectedSpell.components.material_text})`}
                  </div>
                )}
                {selectedSpell.range && (
                  <div>
                    <strong>Range:</strong> {selectedSpell.range}
                  </div>
                )}
                {selectedSpell.targets && (
                  <div>
                    <strong>Target:</strong> {selectedSpell.targets}
                  </div>
                )}
                {selectedSpell.duration && (
                  <div>
                    <strong>Duration:</strong> {selectedSpell.duration}
                  </div>
                )}
                {selectedSpell.saving_throw && (
                  <div>
                    <strong>Saving Throw:</strong> {selectedSpell.saving_throw}
                  </div>
                )}
                {selectedSpell.spell_resistance && (
                  <div>
                    <strong>Spell Resistance:</strong> {selectedSpell.spell_resistance}
                  </div>
                )}
                {selectedSpell.description && (
                  <div>
                    <strong>Description:</strong>
                    <div style={{ marginTop: "0.5rem", lineHeight: 1.6, color: "#333" }}>
                      {selectedSpell.description}
                    </div>
                  </div>
                )}
                {selectedSpell.url && (
                  <div>
                    <a
                      href={selectedSpell.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#8b5cf6", textDecoration: "none" }}
                    >
                      View on d20PFSRD →
                    </a>
                  </div>
                )}
              </div>

              <button
                onClick={() => onAddSpell(selectedSpell)}
                style={{
                  width: "100%",
                  padding: "1rem",
                  background: "#10b981",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: 600,
                  marginTop: "2rem",
                  fontSize: "1rem",
                }}
              >
                + Add {selectedSpell.name} to {className === "Oracle" || className === "Wizard" ? "Spells Known" : "Spellbook"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
