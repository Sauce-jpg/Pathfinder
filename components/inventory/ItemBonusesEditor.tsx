"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

interface ItemBonusesEditorProps {
  itemId: string | null;
  onUpdate?: () => void;
  sourceTable?: "inventory" | "weapon" | "armor";
}

const STAT_CATEGORIES = [
  { value: "ability_str", label: "Strength" },
  { value: "ability_dex", label: "Dexterity" },
  { value: "ability_con", label: "Constitution" },
  { value: "ability_int", label: "Intelligence" },
  { value: "ability_wis", label: "Wisdom" },
  { value: "ability_cha", label: "Charisma" },
  { value: "save_fort", label: "Fortitude Save" },
  { value: "save_ref", label: "Reflex Save" },
  { value: "save_will", label: "Will Save" },
  { value: "ac", label: "Armor Class" },
  { value: "hp_max", label: "Max HP" },
  { value: "bab", label: "Base Attack Bonus" },
];

const BONUS_TYPES = [
  "enhancement",
  "resistance",
  "natural",
  "deflection",
  "dodge",
  "morale",
  "competence",
  "circumstance",
  "insight",
  "luck",
  "sacred",
  "profane",
  "alchemical",
  "armor",
  "shield",
  "size",
  "ability",
  "untyped",
];

export function ItemBonusesEditor({ itemId, onUpdate, sourceTable = "inventory" }: ItemBonusesEditorProps) {
  const [bonuses, setBonuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fkColumn = sourceTable === "weapon" ? "weapon_id" : sourceTable === "armor" ? "armor_id" : "inventory_item_id";

  useEffect(() => {
    if (itemId) {
      loadBonuses();
    } else {
      setBonuses([]);
    }
  }, [itemId]);

  async function loadBonuses() {
    if (!itemId) return;
    
    setLoading(true);
    const { data } = await supabase
      .from("item_stat_bonuses")
      .select("*")
      .eq(fkColumn, itemId);

    setBonuses(data || []);
    setLoading(false);
  }

  async function addBonus() {
    if (!itemId) return;

    const { error } = await supabase.from("item_stat_bonuses").insert({
      [fkColumn]: itemId,
      stat_category: "ability_str",
      bonus_value: 2,
      bonus_type: "enhancement",
    });

    if (error) {
      alert("Error adding bonus: " + error.message);
    } else {
      loadBonuses();
      // Don't call onUpdate here - it closes the modal
    }
  }

  async function updateBonus(bonusId: string, field: string, value: any) {
    await supabase
      .from("item_stat_bonuses")
      .update({ [field]: value })
      .eq("id", bonusId);

    loadBonuses();
    // Don't call onUpdate here - it closes the modal
  }

  async function deleteBonus(bonusId: string) {
    await supabase.from("item_stat_bonuses").delete().eq("id", bonusId);
    loadBonuses();
    // Don't call onUpdate here - it closes the modal
  }

  if (!itemId) {
    return (
      <div style={{ padding: "1rem", background: "#f9fafb", borderRadius: "8px", fontSize: "0.9rem", color: "#666" }}>
        💡 Save the item first to configure stat bonuses
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: "1rem", textAlign: "center" }}>Loading bonuses...</div>;
  }

  return (
    <div
      style={{
        padding: "1rem",
        background: "#f0fdf4",
        border: "1px solid #86efac",
        borderRadius: "8px",
      }}
    >
      <div style={{ marginBottom: "0.75rem", fontWeight: 600 }}>
        ⚡ Auto-Apply Stat Bonuses When Equipped
      </div>

      {bonuses.length === 0 ? (
        <div style={{ marginBottom: "0.75rem", fontSize: "0.9rem", color: "#666" }}>
          No bonuses configured. Add bonuses that will automatically apply when this item is equipped.
        </div>
      ) : (
        <div style={{ display: "grid", gap: "0.5rem", marginBottom: "0.75rem" }}>
          {bonuses.map((bonus) => (
            <div
              key={bonus.id}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1.5fr auto",
                gap: "0.5rem",
                alignItems: "center",
                padding: "0.5rem",
                background: "white",
                borderRadius: "6px",
              }}
            >
              <select
                value={bonus.stat_category}
                onChange={(e) => updateBonus(bonus.id, "stat_category", e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  padding: "0.5rem",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "0.85rem",
                }}
              >
                {STAT_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>

              <input
                type="number"
                value={bonus.bonus_value}
                onChange={(e) => updateBonus(bonus.id, "bonus_value", parseInt(e.target.value) || 0)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  padding: "0.5rem",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "0.85rem",
                }}
              />

              <select
                value={bonus.bonus_type}
                onChange={(e) => updateBonus(bonus.id, "bonus_type", e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  padding: "0.5rem",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "0.85rem",
                }}
              >
                {BONUS_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteBonus(bonus.id);
                }}
                type="button"
                style={{
                  padding: "0.5rem",
                  background: "#ef4444",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation();
          addBonus();
        }}
        type="button"
        style={{
          padding: "0.5rem 1rem",
          background: "#10b981",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          fontSize: "0.85rem",
          fontWeight: 600,
        }}
      >
        + Add Bonus
      </button>

      {bonuses.length > 0 && (
        <div style={{ marginTop: "0.75rem", fontSize: "0.85rem", color: "#666" }}>
          💡 When equipped, this item will automatically add these bonuses as stat sources.
          When unequipped, the bonuses will be removed.
        </div>
      )}
    </div>
  );
}
