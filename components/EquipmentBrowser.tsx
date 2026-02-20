"use client";

import { useState, useEffect, useMemo } from "react";
import type { EquipmentItem, EquipmentCategory } from "@/types/equipment-types";
import { parseCostToGold, parseWeightToPounds } from "@/types/equipment-types";

interface EquipmentBrowserProps {
  onSelect: (item: EquipmentItem) => void;
  onClose: () => void;
  initialCategory?: EquipmentCategory;
}

type SortOption = "name-asc" | "name-desc" | "cost-asc" | "cost-desc" | "weight-asc" | "weight-desc";

// Category definitions with item counts
const CATEGORIES = [
  { id: "adventuring-gear", name: "Adventuring Gear", count: 433, icon: "🎒" },
  { id: "weapons", name: "Weapons", count: 302, icon: "⚔️" },
  { id: "alchemical-tools", name: "Alchemical Tools", count: 217, icon: "⚗️" },
  { id: "tools", name: "Tools", count: 168, icon: "🔧" },
  { id: "kits", name: "Kits", count: 122, icon: "📦" },
  { id: "alchemical-weapons", name: "Alchemical Weapons", count: 111, icon: "🧪" },
  { id: "clothing", name: "Clothing", count: 100, icon: "👔" },
  { id: "food-drink", name: "Food & Drink", count: 85, icon: "🍖" },
  { id: "alchemical-remedies", name: "Alchemical Remedies", count: 79, icon: "💊" },
  { id: "armor", name: "Armor", count: 50, icon: "🛡️" },
  { id: "spellbooks", name: "Spellbooks", count: 42, icon: "📚" },
  { id: "alchemical-reagents", name: "Alchemical Reagents", count: 37, icon: "🧬" },
  { id: "black-market", name: "Black Market", count: 37, icon: "🎭" },
  { id: "firearms", name: "Firearms", count: 35, icon: "🔫" },
  { id: "siege-engines", name: "Siege Engines", count: 34, icon: "⚙️" },
  { id: "firearm-ammunition", name: "Firearm Ammo", count: 33, icon: "💣" },
  { id: "lodging-services", name: "Lodging & Services", count: 32, icon: "🏠" },
  { id: "ammunition", name: "Ammunition", count: 31, icon: "🏹" },
  { id: "entertainment", name: "Entertainment", count: 30, icon: "🎭" },
  { id: "transport", name: "Transport", count: 25, icon: "🚢" },
  { id: "herbs", name: "Herbs", count: 20, icon: "🌿" },
  { id: "channel-foci", name: "Channel Foci", count: 18, icon: "✨" },
  { id: "tinctures", name: "Tinctures", count: 16, icon: "🍷" },
  { id: "shields", name: "Shields", count: 15, icon: "🛡️" },
  { id: "torture-implements", name: "Torture Implements", count: 9, icon: "⛓️" },
  { id: "concoctions", name: "Concoctions", count: 8, icon: "🧉" },
  { id: "chronicles", name: "Chronicles", count: 6, icon: "📖" },
  { id: "dragoncraft", name: "Dragoncraft", count: 6, icon: "🐉" },
  { id: "dungeon-guides", name: "Dungeon Guides", count: 4, icon: "🗺️" },
  { id: "fungal-grafts", name: "Fungal Grafts", count: 2, icon: "🍄" },
  { id: "mounts-pets", name: "Mounts & Pets", count: 216, icon: "🐴" },
  { id: "animal-gear", name: "Animal Gear", count: 57, icon: "🦌" },
] as const;

export default function EquipmentBrowser({ 
  onSelect, 
  onClose,
  initialCategory = "adventuring-gear"
}: EquipmentBrowserProps) {
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set([initialCategory]));
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("name-asc");
  const [loading, setLoading] = useState(true);
  const [showCategoryPanel, setShowCategoryPanel] = useState(false);

  // Load equipment data for selected categories
  useEffect(() => {
    const loadEquipment = async () => {
      setLoading(true);
      
      try {
        const allItems: EquipmentItem[] = [];
        
        for (const categoryId of selectedCategories) {
          const response = await fetch(`/pathfinder/equipment/${categoryId}.json`);
          if (response.ok) {
            const data = await response.json();
            allItems.push(...data);
          }
        }
        
        setItems(allItems);
      } catch (err) {
        console.error('Error loading equipment:', err);
      } finally {
        setLoading(false);
      }
    };

    if (selectedCategories.size > 0) {
      loadEquipment();
    } else {
      setItems([]);
      setLoading(false);
    }
  }, [selectedCategories]);

  // Toggle category selection
  function toggleCategory(categoryId: string) {
    const newSelected = new Set(selectedCategories);
    if (newSelected.has(categoryId)) {
      newSelected.delete(categoryId);
    } else {
      newSelected.add(categoryId);
    }
    setSelectedCategories(newSelected);
  }

  // Select all categories
  function selectAll() {
    setSelectedCategories(new Set(CATEGORIES.map(c => c.id)));
  }

  // Clear all categories
  function clearAll() {
    setSelectedCategories(new Set());
  }

  // Filter and sort items
  const filteredAndSortedItems = useMemo(() => {
    let result = [...items];

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(item =>
        item.Name.toLowerCase().includes(term) ||
        item.Description?.toLowerCase().includes(term) ||
        item.Category?.toLowerCase().includes(term)
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return a.Name.localeCompare(b.Name);
        case "name-desc":
          return b.Name.localeCompare(a.Name);
        case "cost-asc":
          return parseCostToGold(a.Cost) - parseCostToGold(b.Cost);
        case "cost-desc":
          return parseCostToGold(b.Cost) - parseCostToGold(a.Cost);
        case "weight-asc":
          return parseWeightToPounds(a.Weight) - parseWeightToPounds(b.Weight);
        case "weight-desc":
          return parseWeightToPounds(b.Weight) - parseWeightToPounds(a.Weight);
        default:
          return 0;
      }
    });

    return result;
  }, [items, searchTerm, sortBy]);

  const totalItemCount = CATEGORIES.reduce((sum, cat) => 
    selectedCategories.has(cat.id) ? sum + cat.count : sum, 0
  );

  return (
    <div className="equipment-browser-overlay" onClick={onClose}>
      <div className="equipment-browser-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="equipment-browser-header">
          <h2>Browse Equipment Library</h2>
          <button className="equipment-browser-close" onClick={onClose}>×</button>
        </div>

        {/* Category Panel Toggle */}
        <div style={{ padding: "12px 20px", borderBottom: "1px solid #ddd", background: "#f8f9fa" }}>
          <button
            onClick={() => setShowCategoryPanel(!showCategoryPanel)}
            style={{
              padding: "0.5rem 1rem",
              background: "#0070f3",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span>📂</span>
            <span>Categories ({selectedCategories.size} selected, {totalItemCount} items)</span>
            <span>{showCategoryPanel ? "▲" : "▼"}</span>
          </button>
        </div>

        {/* Category Selection Panel */}
        {showCategoryPanel && (
          <div style={{
            padding: "16px 20px",
            borderBottom: "1px solid #ddd",
            background: "#f8f9fa",
            maxHeight: "300px",
            overflowY: "auto",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
              <button
                onClick={selectAll}
                style={{
                  padding: "0.5rem 1rem",
                  background: "#10b981",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                Select All
              </button>
              <button
                onClick={clearAll}
                style={{
                  padding: "0.5rem 1rem",
                  background: "#ef4444",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                Clear All
              </button>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "8px",
            }}>
              {CATEGORIES.map((category) => (
                <label
                  key={category.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 12px",
                    background: selectedCategories.has(category.id) ? "#e6f2ff" : "white",
                    border: `2px solid ${selectedCategories.has(category.id) ? "#0070f3" : "#ddd"}`,
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    transition: "all 0.2s",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedCategories.has(category.id)}
                    onChange={() => toggleCategory(category.id)}
                    style={{ cursor: "pointer" }}
                  />
                  <span>{category.icon}</span>
                  <span style={{ flex: 1 }}>{category.name}</span>
                  <span style={{ color: "#666", fontSize: "0.75rem" }}>({category.count})</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Search and Sort */}
        <div className="equipment-browser-controls">
          <input
            type="text"
            className="equipment-browser-search"
            placeholder={`Search ${filteredAndSortedItems.length} items...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          
          <select 
            className="equipment-browser-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
          >
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
            <option value="cost-asc">Cost (Low to High)</option>
            <option value="cost-desc">Cost (High to Low)</option>
            <option value="weight-asc">Weight (Light to Heavy)</option>
            <option value="weight-desc">Weight (Heavy to Light)</option>
          </select>
        </div>

        {/* Items List */}
        <div className="equipment-browser-items">
          {loading ? (
            <div className="equipment-browser-loading">
              <p>Loading equipment...</p>
            </div>
          ) : selectedCategories.size === 0 ? (
            <div className="equipment-browser-empty">
              <p>Select categories above to browse equipment</p>
            </div>
          ) : filteredAndSortedItems.length === 0 ? (
            <div className="equipment-browser-empty">
              <p>No items found matching "{searchTerm}"</p>
            </div>
          ) : (
            filteredAndSortedItems.map((item, index) => (
              <div 
                key={index} 
                className="equipment-item"
                onClick={() => onSelect(item)}
              >
                <div className="equipment-item-header">
                  <strong className="equipment-item-name">{item.Name}</strong>
                  <span className="equipment-item-cost">{item.Cost}</span>
                </div>
                
                {/* Weapon Stats */}
                {("Damage (M)" in item) && (
                  <div className="equipment-item-stats">
                    <span>Dmg: {item["Damage (M)"]}</span>
                    <span>Crit: {item.Critical}</span>
                    {item.Range && item.Range !== "—" && <span>Range: {item.Range}</span>}
                    <span>Type: {item.Type}</span>
                  </div>
                )}
                
                {/* Armor Stats */}
                {("AC Bonus" in item && "Armor Check Penalty" in item) && (
                  <div className="equipment-item-stats">
                    <span>AC: {item["AC Bonus"]}</span>
                    <span>Max Dex: {item["Max Dex"]}</span>
                    <span>ACP: {item["Armor Check Penalty"]}</span>
                    <span>ASF: {item["Arcane Spell Failure"]}</span>
                  </div>
                )}

                {/* General Info */}
                <div className="equipment-item-meta">
                  {item.Weight && item.Weight !== "—" && (
                    <span className="equipment-item-weight">{item.Weight}</span>
                  )}
                  {item.Category && (
                    <span className="equipment-item-category">{item.Category}</span>
                  )}
                </div>
                
                <p className="equipment-item-description">{item.Description}</p>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="equipment-browser-footer">
          <span>Showing {filteredAndSortedItems.length} of {items.length} items ({selectedCategories.size} categories)</span>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
