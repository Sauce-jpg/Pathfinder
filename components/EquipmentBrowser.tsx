"use client";

import { useState, useEffect, useMemo } from "react";
import type { EquipmentItem, EquipmentCategory } from "@/types/equipment-types";
import { parseCostToGold, parseWeightToPounds } from "@/types/equipment-types";

interface EquipmentBrowserProps {
  category: EquipmentCategory;
  onSelect: (item: EquipmentItem) => void;
  onClose: () => void;
}

type SortOption = "name-asc" | "name-desc" | "cost-asc" | "cost-desc" | "weight-asc" | "weight-desc";

export default function EquipmentBrowser({ 
  category, 
  onSelect, 
  onClose 
}: EquipmentBrowserProps) {
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("name-asc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load equipment data
  useEffect(() => {
    const loadEquipment = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/pathfinder/equipment/${category}.json`);
        if (!response.ok) {
          throw new Error(`Failed to load ${category}`);
        }
        const data = await response.json();
        setItems(data);
      } catch (err) {
        console.error(`Error loading ${category}:`, err);
        setError(`Failed to load ${category}. Please try again.`);
      } finally {
        setLoading(false);
      }
    };

    loadEquipment();
  }, [category]);

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

  if (loading) {
    return (
      <div className="equipment-browser-overlay" onClick={onClose}>
        <div className="equipment-browser-modal" onClick={(e) => e.stopPropagation()}>
          <div className="equipment-browser-loading">
            <p>Loading {category}...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="equipment-browser-overlay" onClick={onClose}>
        <div className="equipment-browser-modal" onClick={(e) => e.stopPropagation()}>
          <div className="equipment-browser-error">
            <p>{error}</p>
            <button onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="equipment-browser-overlay" onClick={onClose}>
      <div className="equipment-browser-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="equipment-browser-header">
          <h2>Browse {category.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</h2>
          <button className="equipment-browser-close" onClick={onClose}>×</button>
        </div>

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
          {filteredAndSortedItems.length === 0 ? (
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
          <span>Showing {filteredAndSortedItems.length} of {items.length} items</span>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
