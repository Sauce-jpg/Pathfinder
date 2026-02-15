"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { WeaponsTab } from "./inventory/WeaponsTab";
import { ArmorTab } from "./inventory/ArmorTab";
import { ItemsTab } from "./inventory/ItemsTab";
import { CurrencyTab } from "./inventory/CurrencyTab";

interface InventoryProps {
  characterId: string;
  characterLevel: number;
  strengthScore: number;
}

export function Inventory({ characterId, characterLevel, strengthScore }: InventoryProps) {
  const [activeTab, setActiveTab] = useState<"weapons" | "armor" | "items" | "currency">("weapons");
  const [weapons, setWeapons] = useState<any[]>([]);
  const [armor, setArmor] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [currency, setCurrency] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [totalWeight, setTotalWeight] = useState(0);

  useEffect(() => {
    loadInventory();
  }, [characterId]);

  async function loadInventory() {
    setLoading(true);

    // Load weapons
    const { data: weaponsData } = await supabase
      .from("character_weapons")
      .select("*")
      .eq("character_id", characterId)
      .order("is_primary", { ascending: false })
      .order("weapon_name");

    setWeapons(weaponsData || []);

    // Load armor
    const { data: armorData } = await supabase
      .from("character_armor")
      .select("*")
      .eq("character_id", characterId)
      .order("is_equipped", { ascending: false })
      .order("armor_name");

    setArmor(armorData || []);

    // Load general items
    const { data: itemsData } = await supabase
      .from("character_inventory")
      .select("*")
      .eq("character_id", characterId)
      .order("item_type")
      .order("item_name");

    setItems(itemsData || []);

    // Calculate total weight
    const weight = (itemsData || []).reduce(
      (sum: number, item: any) => sum + (item.weight_per_item * item.quantity),
      0
    );
    setTotalWeight(weight);

    // Load currency
    let { data: currencyData } = await supabase
      .from("character_currency")
      .select("*")
      .eq("character_id", characterId)
      .single();

    // If no currency record exists, create one
    if (!currencyData) {
      const { data: newCurrency } = await supabase
        .from("character_currency")
        .insert({
          character_id: characterId,
          platinum: 0,
          gold: 0,
          silver: 0,
          copper: 0,
        })
        .select()
        .single();
      currencyData = newCurrency;
    }

    setCurrency(currencyData);
    setLoading(false);
  }

  // Calculate carrying capacity based on STR
  function getCarryingCapacity() {
    // Pathfinder carrying capacity table
    const capacityTable: any = {
      1: 3, 2: 6, 3: 10, 4: 13, 5: 16, 6: 20, 7: 23, 8: 26, 9: 30, 10: 33,
      11: 38, 12: 43, 13: 50, 14: 58, 15: 66, 16: 76, 17: 86, 18: 100, 19: 116,
      20: 133, 21: 153, 22: 173, 23: 200, 24: 233, 25: 266, 26: 306, 27: 346,
      28: 400, 29: 466,
    };

    const lightLoad = capacityTable[Math.min(strengthScore, 29)] || 33;
    const mediumLoad = lightLoad * 2;
    const heavyLoad = lightLoad * 3;

    return { lightLoad, mediumLoad, heavyLoad };
  }

  const { lightLoad, mediumLoad, heavyLoad } = getCarryingCapacity();
  const encumbrance =
    totalWeight <= lightLoad ? "Light" :
    totalWeight <= mediumLoad ? "Medium" :
    totalWeight <= heavyLoad ? "Heavy" : "Overloaded";

  if (loading) {
    return <div style={{ padding: "2rem", textAlign: "center" }}>Loading inventory...</div>;
  }

  return (
    <div>
      {/* Encumbrance Display */}
      <div
        style={{
          background: encumbrance === "Overloaded" ? "#fee2e2" : encumbrance === "Heavy" ? "#fef3c7" : encumbrance === "Medium" ? "#dbeafe" : "#f0fdf4",
          border: `1px solid ${encumbrance === "Overloaded" ? "#ef4444" : encumbrance === "Heavy" ? "#f59e0b" : encumbrance === "Medium" ? "#3b82f6" : "#10b981"}`,
          borderRadius: "8px",
          padding: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <strong>Carrying Capacity:</strong>{" "}
            <span style={{ fontSize: "1.1rem", fontWeight: 600 }}>
              {totalWeight.toFixed(1)} lbs
            </span>{" "}
            <span style={{ color: "#666" }}>
              (Light: {lightLoad}, Medium: {mediumLoad}, Heavy: {heavyLoad})
            </span>
          </div>
          <div
            style={{
              padding: "0.5rem 1rem",
              background: encumbrance === "Overloaded" ? "#ef4444" : encumbrance === "Heavy" ? "#f59e0b" : encumbrance === "Medium" ? "#3b82f6" : "#10b981",
              color: "white",
              borderRadius: "6px",
              fontWeight: 600,
            }}
          >
            {encumbrance}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: "2px solid #ddd", marginBottom: "2rem" }}>
        <div style={{ display: "flex", gap: "1rem" }}>
          {[
            { id: "weapons", label: "Weapons", count: weapons.length, emoji: "⚔️" },
            { id: "armor", label: "Armor & Shields", count: armor.length, emoji: "🛡️" },
            { id: "items", label: "Items & Gear", count: items.length, emoji: "🎒" },
            { id: "currency", label: "Currency", emoji: "💰" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: "0.75rem 1.5rem",
                background: activeTab === tab.id ? "#f59e0b" : "transparent",
                color: activeTab === tab.id ? "white" : "#f59e0b",
                border: `2px solid #f59e0b`,
                borderBottom: activeTab === tab.id ? "none" : `2px solid #f59e0b`,
                borderRadius: "8px 8px 0 0",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {tab.emoji} {tab.label}
              {tab.count !== undefined && (
                <span style={{ marginLeft: "0.5rem", opacity: 0.8 }}>({tab.count})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "weapons" && (
        <WeaponsTab
          characterId={characterId}
          weapons={weapons}
          onUpdate={loadInventory}
        />
      )}

      {activeTab === "armor" && (
        <ArmorTab
          characterId={characterId}
          armor={armor}
          onUpdate={loadInventory}
        />
      )}

      {activeTab === "items" && (
        <ItemsTab
          characterId={characterId}
          items={items}
          onUpdate={loadInventory}
        />
      )}

      {activeTab === "currency" && (
        <CurrencyTab
          characterId={characterId}
          currency={currency}
          onUpdate={loadInventory}
        />
      )}
    </div>
  );
}
