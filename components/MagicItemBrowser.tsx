"use client";

import { useState, useEffect, useMemo } from "react";
import styles from "../styles/MagicItemBrowser.module.css";

// ============================================================================
// TYPES
// ============================================================================

export interface MagicItem {
  id: string;
  Name: string;
  Cost: number;
  Aura?: string;
  CL?: number;
  Slot: string;
  Weight?: string;
  Source?: string;
  Description: string;
  RollRange?: string;
  Reference?: string;
  PowerLevel: string;
  Rarity: string;
  ItemType: string;
  Construction?: {
    Requirements: string;
    Cost: number;
  };
  // Armor / shield fields
  "AC Bonus"?: string;
  "Max Dex"?: string;
  "Armor Check Penalty"?: string;
  "Arcane Spell Failure"?: string;
  // Weapon fields
  "Damage (M)"?: string;
  Critical?: string;
  Range?: string;
  Type?: string;
}

interface MagicItemBrowserProps {
  onSelect: (item: MagicItem) => void;
  onClose: () => void;
}

// ============================================================================
// FILTER CONSTANTS
// ============================================================================

const ALL_SLOTS = [
  "Belt", "Body", "Chest", "Eyes", "Feet", "Hands",
  "Head", "Headband", "Neck", "Ring", "Shoulders", "Slotless", "Wrists",
];

const POWER_LEVELS = ["Least", "Lesser", "Greater"];
const RARITIES = ["Minor", "Medium", "Major"];
const ITEM_TYPES = ["Wondrous Item", "Rod", "Staff", "Magic Armor", "Magic Shield", "Magic Weapon"];

const SLOT_ICONS: Record<string, string> = {
  Belt: "🔰", Body: "👘", Chest: "🎽", Eyes: "👁️", Feet: "👟",
  Hands: "🧤", Head: "⛑️", Headband: "🎀", Neck: "📿",
  Ring: "💍", Shoulders: "🧥", Slotless: "✨", Wrists: "⌚",
  Armor: "🛡️", Weapon: "⚔️",
};

const TYPE_ICONS: Record<string, string> = {
  "Wondrous Item": "✨", Rod: "🪄", Staff: "🔱",
  "Magic Armor": "🛡️", "Magic Shield": "🔰", "Magic Weapon": "⚔️",
};

// ============================================================================
// HELPERS
// ============================================================================

function formatCost(gp: number): string {
  if (!gp || gp === 0) return "—";
  return `${gp.toLocaleString()} gp`;
}

function getPowerColor(power: string): string {
  switch (power) {
    case "Least":   return "#6b7280";
    case "Lesser":  return "#2563eb";
    case "Greater": return "#7c3aed";
    default:        return "#374151";
  }
}

function getRarityColor(rarity: string): string {
  switch (rarity) {
    case "Minor":  return "#059669";
    case "Medium": return "#d97706";
    case "Major":  return "#dc2626";
    default:       return "#374151";
  }
}

function parseGp(raw: string | number | undefined): number {
  if (typeof raw === "number") return raw;
  if (!raw || raw === "—") return 0;
  const match = String(raw).replace(/,/g, "").match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
}

function derivePowerLevel(gp: number): string {
  if (gp <= 500)   return "Least";
  if (gp <= 10000) return "Lesser";
  return "Greater";
}

function deriveRarity(gp: number): string {
  if (gp <= 1000)  return "Minor";
  if (gp <= 30000) return "Medium";
  return "Major";
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function MagicItemBrowser({ onSelect, onClose }: MagicItemBrowserProps) {
  const [allItems, setAllItems] = useState<MagicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  // Filters
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [selectedPowers, setSelectedPowers] = useState<Set<string>>(new Set());
  const [selectedRarities, setSelectedRarities] = useState<Set<string>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"name-asc" | "cost-asc" | "cost-desc" | "cl-asc" | "cl-desc">("name-asc");
  const [showFilters, setShowFilters] = useState(true);

  // Load all magic item sources
  useEffect(() => {
    async function load() {
      try {
        const sources = [
          { file: "magic-items.json",   itemType: "",              defaultSlot: "Slotless" },
          { file: "magic-armor.json",   itemType: "Magic Armor",   defaultSlot: "Armor"   },
          { file: "magic-weapons.json", itemType: "Magic Weapon",  defaultSlot: "Weapon"  },
          { file: "magic-shields.json", itemType: "Magic Shield",  defaultSlot: "Armor"   },
        ];

        const allLoaded: MagicItem[] = [];

        for (const src of sources) {
          const res = await fetch(`/pathfinder/equipment/${src.file}`);
          if (!res.ok) continue;
          const raw: any[] = await res.json();

          raw.forEach((item, idx) => {
            const gp = parseGp(item.Cost ?? item.cost);
            allLoaded.push({
              id:          `${src.file}-${idx}`,
              Name:        item.Name ?? "",
              Cost:        gp,
              Aura:        item.Aura ?? item.aura ?? "",
              CL:          item.CL ?? item.cl ?? 0,
              Slot:        item.Slot ?? item.slot ?? src.defaultSlot,
              Weight:      item.Weight ?? item.weight ?? "—",
              Source:      item.Source ?? item.source ?? "",
              Description: item.Description ?? item.description ?? "",
              RollRange:   item.RollRange,
              Reference:   item.Reference ?? item.reference,
              PowerLevel:  item.PowerLevel ?? derivePowerLevel(gp),
              Rarity:      item.Rarity    ?? deriveRarity(gp),
              ItemType:    src.itemType || item.ItemType || "Wondrous Item",
              Construction: item.Construction,
              "AC Bonus":             item["AC Bonus"],
              "Max Dex":              item["Max Dex"],
              "Armor Check Penalty":  item["Armor Check Penalty"],
              "Arcane Spell Failure": item["Arcane Spell Failure"],
              "Damage (M)":           item["Damage (M)"],
              Critical:               item.Critical,
              Range:                  item.Range,
              Type:                   item.Type,
            });
          });
        }

        setAllItems(allLoaded);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Toggle helpers
  function toggle(set: Set<string>, value: string): Set<string> {
    const next = new Set(set);
    next.has(value) ? next.delete(value) : next.add(value);
    return next;
  }

  // Filter + sort
  const filtered = useMemo(() => {
    // Show nothing until the user applies at least one filter or types a search
    const hasActiveFilter =
      selectedSlots.size > 0 ||
      selectedPowers.size > 0 ||
      selectedRarities.size > 0 ||
      selectedTypes.size > 0 ||
      searchTerm.trim().length > 0;

    if (!hasActiveFilter) return [];

    let result = allItems;

    if (selectedSlots.size > 0)
      result = result.filter(i => selectedSlots.has(i.Slot));
    if (selectedPowers.size > 0)
      result = result.filter(i => selectedPowers.has(i.PowerLevel));
    if (selectedRarities.size > 0)
      result = result.filter(i => selectedRarities.has(i.Rarity));
    if (selectedTypes.size > 0)
      result = result.filter(i => selectedTypes.has(i.ItemType));
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(i =>
        i.Name.toLowerCase().includes(q) ||
        i.Description?.toLowerCase().includes(q) ||
        i.Aura?.toLowerCase().includes(q)
      );
    }

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "name-asc":   return a.Name.localeCompare(b.Name);
        case "cost-asc":   return (a.Cost || 0) - (b.Cost || 0);
        case "cost-desc":  return (b.Cost || 0) - (a.Cost || 0);
        case "cl-asc":     return (a.CL || 0) - (b.CL || 0);
        case "cl-desc":    return (b.CL || 0) - (a.CL || 0);
        default:           return 0;
      }
    });

    return result;
  }, [allItems, selectedSlots, selectedPowers, selectedRarities, selectedTypes, searchTerm, sortBy]);

  const activeFilterCount =
    selectedSlots.size + selectedPowers.size + selectedRarities.size + selectedTypes.size;

  function clearFilters() {
    setSelectedSlots(new Set());
    setSelectedPowers(new Set());
    setSelectedRarities(new Set());
    setSelectedTypes(new Set());
    setSearchTerm("");
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} style={{ height: "92vh" }} onClick={e => e.stopPropagation()}>

        {/* ── HEADER ── */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.headerIcon}>🪄</span>
            <div>
              <h2 className={styles.headerTitle}>Magic Item Browser</h2>
              <p className={styles.headerSub}>
                {loading ? "Loading…" : `${allItems.length.toLocaleString()} items`}
                {activeFilterCount > 0 && ` · ${filtered.length} matching`}
              </p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* ── FILTER TOOLBAR ── */}
        <div className={styles.toolbar}>
          <input
            className={styles.search}
            type="text"
            placeholder="Search by name, description, aura…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />

          <select
            className={styles.sortSelect}
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
          >
            <option value="name-asc">Name (A–Z)</option>
            <option value="cost-asc">Cost ↑</option>
            <option value="cost-desc">Cost ↓</option>
            <option value="cl-asc">CL ↑</option>
            <option value="cl-desc">CL ↓</option>
          </select>

          <button
            className={`${styles.filterToggle} ${showFilters ? styles.filterToggleActive : ""}`}
            onClick={() => setShowFilters(v => !v)}
          >
            🎛 Filters {activeFilterCount > 0 && <span className={styles.badge}>{activeFilterCount}</span>}
          </button>

          {activeFilterCount > 0 && (
            <button className={styles.clearBtn} onClick={clearFilters}>
              ✕ Clear
            </button>
          )}
        </div>

        {/* ── FILTER PANEL ── */}
        {showFilters && (
          <div className={styles.filterPanel}>

            {/* Slot */}
            <div className={styles.filterGroup}>
              <div className={styles.filterLabel}>Slot</div>
              <div className={styles.filterChips}>
                {ALL_SLOTS.map(slot => (
                  <button
                    key={slot}
                    className={`${styles.chip} ${selectedSlots.has(slot) ? styles.chipActive : ""}`}
                    onClick={() => setSelectedSlots(toggle(selectedSlots, slot))}
                  >
                    {SLOT_ICONS[slot]} {slot}
                  </button>
                ))}
              </div>
            </div>

            {/* Power Level */}
            <div className={styles.filterGroup}>
              <div className={styles.filterLabel}>Power Level</div>
              <div className={styles.filterChips}>
                {POWER_LEVELS.map(p => (
                  <button
                    key={p}
                    className={`${styles.chip} ${selectedPowers.has(p) ? styles.chipActive : ""}`}
                    style={selectedPowers.has(p) ? { background: getPowerColor(p), borderColor: getPowerColor(p), color: "white" } : {}}
                    onClick={() => setSelectedPowers(toggle(selectedPowers, p))}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Rarity */}
            <div className={styles.filterGroup}>
              <div className={styles.filterLabel}>Rarity</div>
              <div className={styles.filterChips}>
                {RARITIES.map(r => (
                  <button
                    key={r}
                    className={`${styles.chip} ${selectedRarities.has(r) ? styles.chipActive : ""}`}
                    style={selectedRarities.has(r) ? { background: getRarityColor(r), borderColor: getRarityColor(r), color: "white" } : {}}
                    onClick={() => setSelectedRarities(toggle(selectedRarities, r))}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Item Type */}
            <div className={styles.filterGroup}>
              <div className={styles.filterLabel}>Type</div>
              <div className={styles.filterChips}>
                {ITEM_TYPES.map(t => (
                  <button
                    key={t}
                    className={`${styles.chip} ${selectedTypes.has(t) ? styles.chipActive : ""}`}
                    onClick={() => setSelectedTypes(toggle(selectedTypes, t))}
                  >
                    {TYPE_ICONS[t]} {t}
                  </button>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* ── ITEM LIST ── */}
        <div className={styles.itemList} style={{ display: "block", overflowY: "auto", flex: 1, minHeight: 0 }}>
          {loading && (
            <div className={styles.center}>
              <div className={styles.spinner} />
              <p>Loading magic items…</p>
            </div>
          )}

          {error && (
            <div className={styles.center}>
              <p style={{ color: "#dc2626" }}>⚠️ Failed to load: {error}</p>
              <p style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                Make sure <code>magic-items.json</code> is in <code>/public/pathfinder/equipment/</code>
              </p>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className={styles.center}>
              {activeFilterCount === 0 && !searchTerm.trim() ? (
                <>
                  <p style={{ fontSize: "1.5rem" }}>🪄</p>
                  <p>Use the filters or search above to find magic items.</p>
                </>
              ) : (
                <>
                  <p style={{ fontSize: "1.5rem" }}>🔍</p>
                  <p>No items match your filters.</p>
                  <button className={styles.clearBtn} onClick={clearFilters}>Clear filters</button>
                </>
              )}
            </div>
          )}

          {!loading && !error && filtered.map(item => {
            const isExpanded = expandedItem === item.id;
            return (
              <div
                key={item.id}
                className={`${styles.item} ${isExpanded ? styles.itemExpanded : ""}`}
                style={{ marginBottom: "6px" }}
              >
                {/* Item header row */}
                <div
                  className={styles.itemHeader}
                  onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                >
                  <div className={styles.itemLeft}>
                    <span className={styles.slotIcon}>{SLOT_ICONS[item.Slot] ?? "✦"}</span>
                    <div>
                      <div className={styles.itemName}>{item.Name}</div>
                      <div className={styles.itemTags}>
                        <span className={styles.tag} style={{ color: getPowerColor(item.PowerLevel), borderColor: getPowerColor(item.PowerLevel) }}>
                          {item.PowerLevel}
                        </span>
                        <span className={styles.tag} style={{ color: getRarityColor(item.Rarity), borderColor: getRarityColor(item.Rarity) }}>
                          {item.Rarity}
                        </span>
                        <span className={styles.tagGray}>{item.Slot}</span>
                        <span className={styles.tagGray}>{TYPE_ICONS[item.ItemType]} {item.ItemType}</span>
                        {item.Aura && <span className={styles.tagGray}>{item.Aura}</span>}
                        {item.CL > 0 && <span className={styles.tagGray}>CL {item.CL}</span>}
                      </div>
                    </div>
                  </div>

                  <div className={styles.itemRight}>
                    <span className={styles.cost}>{formatCost(item.Cost)}</span>
                    <button
                      className={styles.addBtn}
                      onClick={e => { e.stopPropagation(); onSelect(item); }}
                    >
                      + Add
                    </button>
                    <span className={styles.chevron}>{isExpanded ? "▲" : "▼"}</span>
                  </div>
                </div>

                {/* Expanded description */}
                {isExpanded && (
                  <div className={styles.itemBody}>

                    {/* Magic armor / shield stats */}
                    {item["AC Bonus"] && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", padding: "0.5rem 0.75rem", marginBottom: "0.75rem", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "6px", fontSize: "0.85rem" }}>
                        <span>AC Bonus: <strong>{item["AC Bonus"]}</strong></span>
                        {item["Max Dex"] && <span>Max Dex: <strong>{item["Max Dex"]}</strong></span>}
                        {item["Armor Check Penalty"] && <span>ACP: <strong>{item["Armor Check Penalty"]}</strong></span>}
                        {item["Arcane Spell Failure"] && <span>ASF: <strong>{item["Arcane Spell Failure"]}</strong></span>}
                      </div>
                    )}

                    {/* Magic weapon stats */}
                    {item["Damage (M)"] && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", padding: "0.5rem 0.75rem", marginBottom: "0.75rem", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "6px", fontSize: "0.85rem" }}>
                        <span>Damage: <strong>{item["Damage (M)"]}</strong></span>
                        {item.Critical && <span>Crit: <strong>{item.Critical}</strong></span>}
                        {item.Range && item.Range !== "—" && <span>Range: <strong>{item.Range}</strong></span>}
                        {item.Type && <span>Type: <strong>{item.Type}</strong></span>}
                      </div>
                    )}

                    <p className={styles.description}>{item.Description}</p>

                    {item.Construction && (
                      <div className={styles.construction}>
                        <strong>Construction:</strong> {item.Construction.Requirements}
                        {item.Construction.Cost > 0 && (
                          <span> · Cost: {formatCost(item.Construction.Cost)}</span>
                        )}
                      </div>
                    )}

                    <div className={styles.itemMeta}>
                      {item.Source && <span>📖 {item.Source}</span>}
                      {item.Weight && item.Weight !== "—" && <span>⚖️ {item.Weight}</span>}
                      {item.Reference && (
                        <a href={item.Reference} target="_blank" rel="noreferrer" className={styles.refLink}>
                          PFSRD ↗
                        </a>
                      )}
                    </div>

                    <button
                      className={styles.addBtnFull}
                      onClick={() => onSelect(item)}
                    >
                      ✦ Add to Inventory
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── FOOTER ── */}
        <div className={styles.footer}>
          <span className={styles.footerCount}>
            {filtered.length.toLocaleString()} of {allItems.length.toLocaleString()} magic items
            {activeFilterCount > 0 && ` · ${activeFilterCount} filter${activeFilterCount !== 1 ? "s" : ""} active`}
          </span>
          <button className={styles.footerClose} onClick={onClose}>Close</button>
        </div>

      </div>
    </div>
  );
}
