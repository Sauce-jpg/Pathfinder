"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ItemBonusesEditor } from "./ItemBonusesEditor";
import EquipmentBrowser from "../EquipmentBrowser";
import MagicItemBrowser, { type MagicItem } from "../MagicItemBrowser";
import { mapItemToInventory } from "@/lib/equipmentMappers";
import { mapMagicItemToInventory } from "@/lib/magicItemMapper";
import "../../styles/EquipmentBrowser.css";


interface ItemsTabProps {
  characterId: string;
  items: any[];
  onUpdate: () => void;
}

export function ItemsTab({ characterId, items, onUpdate }: ItemsTabProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [showBrowser, setShowBrowser] = useState(false);
  const [showMagicBrowser, setShowMagicBrowser] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Form state
  const [itemName, setItemName] = useState("");
  const [itemType, setItemType] = useState("gear");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [weightPerItem, setWeightPerItem] = useState(0);
  const [costGp, setCostGp] = useState(0);
  const [container, setContainer] = useState("");
  const [notes, setNotes] = useState("");
  const [slotName, setSlotName] = useState("");
  const [grantsSlotType, setGrantsSlotType] = useState("");
  const [grantsSlotCount, setGrantsSlotCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [equippedItemIds, setEquippedItemIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadEquippedIds();
  }, [characterId, items]);

  async function loadEquippedIds() {
    const { data } = await supabase
      .from("character_equipped_items")
      .select("inventory_item_id")
      .eq("character_id", characterId);
    setEquippedItemIds(new Set((data || []).map((r: any) => r.inventory_item_id)));
  }

  async function unequipForRemoval(itemId: string) {
    // Deleting from character_equipped_items triggers DB cleanup of character_stat_sources
    await supabase
      .from("character_equipped_items")
      .delete()
      .eq("inventory_item_id", itemId);
  }
  const [removingItem, setRemovingItem] = useState<any>(null);
  const [sellAmount, setSellAmount] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Handle item selection from Equipment Browser
  async function handleSelectFromLibrary(item: any) {
    const itemData = mapItemToInventory(item, characterId);
    const { error } = await supabase.from("character_inventory").insert(itemData);
    if (error) {
      alert("Error adding item: " + error.message);
    } else {
      setShowBrowser(false);
      onUpdate();
    }
  }

  function openAddModal() {
    setEditingItem(null);
    resetForm();
    setShowAdvanced(false);
    setShowAddModal(true);
  }

  function openEditModal(item: any) {
    setEditingItem(item);
    setItemName(item.item_name);
    setItemType(item.item_type || "gear");
    setDescription(item.description || "");
    setQuantity(item.quantity || 1);
    setWeightPerItem(item.weight_per_item || 0);
    setCostGp(item.cost_gp || 0);
    setContainer(item.container || "");
    setNotes(item.notes || "");
    setSlotName(item.slot_name || "");
    setGrantsSlotType(item.grants_slot_type || "");
    setGrantsSlotCount(item.grants_slot_count || 0);
    setShowAdvanced(false);
    setShowAddModal(true);
  }

  function resetForm() {
    setItemName("");
    setItemType("gear");
    setDescription("");
    setQuantity(1);
    setWeightPerItem(0);
    setCostGp(0);
    setContainer("");
    setNotes("");
    setSlotName("");
    setGrantsSlotType("");
    setGrantsSlotCount(0);
  }

  async function handleSelectFromMagicLibrary(item: MagicItem) {
    const itemData = mapMagicItemToInventory(item, characterId);
    const { error } = await supabase.from("character_inventory").insert(itemData);
    if (error) {
      alert("Error adding magic item: " + error.message);
    } else {
      setShowMagicBrowser(false);
      onUpdate();
    }
  }
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const itemData = {
      character_id: characterId,
      item_name: itemName,
      item_type: itemType,
      description: description || null,
      quantity: quantity,
      weight_per_item: weightPerItem,
      cost_gp: costGp,
      container: container || null,
      notes: notes || null,
      is_equipped: false,
      slot_name: slotName || null,
      grants_slot_type: grantsSlotType || null,
      grants_slot_count: grantsSlotCount || 0,
    };

    let error;

    if (editingItem) {
      const result = await supabase
        .from("character_inventory")
        .update(itemData)
        .eq("id", editingItem.id);
      error = result.error;
    } else {
      const result = await supabase.from("character_inventory").insert(itemData);
      error = result.error;
    }

    if (error) {
      alert("Error saving item: " + error.message);
    } else {
      setShowAddModal(false);
      resetForm();
      onUpdate();
    }

    setSaving(false);
  }

  function openRemoveModal(item: any) {
    setRemovingItem(item);
    setSellAmount(item.cost_gp || 0);
    setShowRemoveModal(true);
  }

  async function handleSell() {
    if (!removingItem) return;
    const itemName = removingItem.item_name || "Unknown item";
    // Unequip first — DB trigger cleans up character_stat_sources
    await unequipForRemoval(removingItem.id);
    // Add gold to currency and record transaction
    const { data: currencyData } = await supabase
      .from("character_currency")
      .select("gold")
      .eq("character_id", characterId)
      .single();
    if (currencyData) {
      await supabase
        .from("character_currency")
        .update({ gold: (currencyData.gold || 0) + sellAmount })
        .eq("character_id", characterId);
      await supabase.from("character_currency_transactions").insert({
        character_id: characterId,
        platinum: 0,
        gold: sellAmount,
        silver: 0,
        copper: 0,
        note: `Sold ${itemName}`,
        transaction_type: "sale",
      });
    }
    await supabase.from("character_inventory").delete().eq("id", removingItem.id);
    setShowRemoveModal(false);
    setRemovingItem(null);
    onUpdate();
  }

  async function handleDelete() {
    if (!removingItem) return;
    // Unequip first — DB trigger cleans up character_stat_sources
    await unequipForRemoval(removingItem.id);
    await supabase.from("character_inventory").delete().eq("id", removingItem.id);
    setShowRemoveModal(false);
    setRemovingItem(null);
    onUpdate();
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this item?")) return;
    await supabase.from("character_inventory").delete().eq("id", id);
    onUpdate();
  }


  // Group items by type
  const itemsByType = items.reduce((acc: any, item: any) => {
    const type = item.item_type || "gear";
    if (!acc[type]) acc[type] = [];
    acc[type].push(item);
    return acc;
  }, {});

  const typeLabels: any = {
    magic_item: "Magic Items",
    potion: "Potions",
    scroll: "Scrolls",
    gear: "Adventuring Gear",
    treasure: "Treasure",
  };

  return (
    <div>
      {/* Add Item dropdown button */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <div ref={dropdownRef} style={{ position: "relative" }}>
          <button
            onClick={() => setShowDropdown(v => !v)}
            style={{ padding: "0.75rem 1.25rem", background: "#10b981", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            + Add Item ▾
          </button>
          {showDropdown && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, background: "white", border: "1px solid #ddd", borderRadius: "8px", boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 100, minWidth: "240px", overflow: "hidden" }}>
              {[
                { label: "🪄 Browse Magic Items", action: () => { setShowMagicBrowser(true); setShowDropdown(false); } },
                { label: "📖 Browse Equipment Library", action: () => { setShowBrowser(true); setShowDropdown(false); } },
                { label: "✏️ Add Custom Item", action: () => { openAddModal(); setShowDropdown(false); } },
              ].map(({ label, action }) => (
                <button key={label} onClick={action}
                  style={{ display: "block", width: "100%", padding: "0.75rem 1rem", background: "none", border: "none", textAlign: "left", cursor: "pointer", fontSize: "0.95rem", borderBottom: "1px solid #f0f0f0" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div
          style={{
            padding: "3rem",
            textAlign: "center",
            background: "#f9fafb",
            border: "2px dashed #ddd",
            borderRadius: "12px",
          }}
        >
          <h3 style={{ margin: 0, color: "#666" }}>No items yet</h3>
          <p style={{ color: "#999" }}>Browse the library or add custom items!</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "2rem" }}>
          {Object.entries(itemsByType).map(([type, typeItems]: [string, any]) => (
            <div key={type}>
              <h3 style={{ marginTop: 0, marginBottom: "1rem", color: "#f59e0b" }}>
                {typeLabels[type] || type} ({typeItems.length})
              </h3>
              <div style={{ display: "grid", gap: "0.75rem" }}>
                {typeItems.map((item: any) => (
                  <div
                    key={item.id}
                    style={{
                      background: equippedItemIds.has(item.id) ? "#f0fdf4" : "white",
                      border: equippedItemIds.has(item.id) ? "2px solid #10b981" : "1px solid #ddd",
                      borderRadius: "8px",
                      padding: "1rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.1rem" }}>
                          <div style={{ fontWeight: 600, fontSize: "1.05rem" }}>{item.item_name}</div>
                          {equippedItemIds.has(item.id) && (
                            <span style={{ padding: "0.1rem 0.5rem", background: "#10b981", color: "white", borderRadius: "12px", fontSize: "0.72rem", fontWeight: 600, flexShrink: 0 }}>EQUIPPED</span>
                          )}
                        </div>
                        
                        {item.description && (
                          <div style={{ fontSize: "0.9rem", color: "#666", marginTop: "0.25rem" }}>
                            {item.description}
                          </div>
                        )}

                        <div
                          style={{
                            display: "flex",
                            gap: "1.5rem",
                            marginTop: "0.75rem",
                            fontSize: "0.9rem",
                            color: "#666",
                          }}
                        >
                          <div>
                            <strong>Qty:</strong> {item.quantity}
                          </div>
                          {item.weight_per_item > 0 && (
                            <div>
                              <strong>Weight:</strong> {(item.weight_per_item * item.quantity).toFixed(1)} lbs
                            </div>
                          )}
                          {item.cost_gp > 0 && (
                            <div>
                              <strong>Value:</strong> {item.cost_gp * item.quantity} gp
                            </div>
                          )}
                          {item.container && (
                            <div>
                              <strong>In:</strong> {item.container}
                            </div>
                          )}
                        </div>

                        {item.notes && (
                          <div style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#999", fontStyle: "italic" }}>
                            {item.notes}
                          </div>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: "0.5rem", marginLeft: "1rem" }}>
                        <button
                          onClick={() => openEditModal(item)}
                          style={{ padding: "0.25rem 0.75rem", background: "#0070f3", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem" }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openRemoveModal(item)}
                          style={{ padding: "0.25rem 0.75rem", background: "#ef4444", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem" }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 3000,
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "2rem",
              maxWidth: "600px",
              width: "90%",
              maxHeight: "90vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0 }}>{editingItem ? "Edit Item" : "Add Custom Item"}</h2>

            <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Item Name *
                </label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  required
                  placeholder="e.g., Rope (50 ft), Potion of Cure Light Wounds"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "1rem",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>Type</label>
                <select
                  value={itemType}
                  onChange={(e) => setItemType(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "1rem",
                  }}
                >
                  <option value="gear">Adventuring Gear</option>
                  <option value="magic_item">Magic Item</option>
                  <option value="potion">Potion</option>
                  <option value="scroll">Scroll</option>
                  <option value="treasure">Treasure</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Equipment Slot (optional)
                </label>
                <select
                  value={slotName}
                  onChange={(e) => setSlotName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "1rem",
                  }}
                >
                  <option value="">None (Not equippable)</option>
                  <option value="head">Head</option>
                  <option value="headband">Headband</option>
                  <option value="eyes">Eyes</option>
                  <option value="neck">Neck</option>
                  <option value="shoulders">Shoulders</option>
                  <option value="body">Body</option>
                  <option value="chest">Chest/Armor</option>
                  <option value="belt">Belt</option>
                  <option value="wrists">Wrists</option>
                  <option value="hands">Hands</option>
                  <option value="ring">Ring</option>
                  <option value="feet">Feet</option>
                  <option value="slotless">Slotless</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this item do?"
                  rows={2}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "1rem",
                    resize: "vertical",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                    Quantity *
                  </label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    required
                    min="1"
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                      fontSize: "1rem",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                    Weight (each) lbs
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={weightPerItem}
                    onChange={(e) => setWeightPerItem(parseFloat(e.target.value) || 0)}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                      fontSize: "1rem",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                    Cost (each) gp
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={costGp}
                    onChange={(e) => setCostGp(parseFloat(e.target.value) || 0)}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                      fontSize: "1rem",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                    Container
                  </label>
                  <input
                    type="text"
                    value={container}
                    onChange={(e) => setContainer(e.target.value)}
                    placeholder="backpack, belt pouch, etc."
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                      fontSize: "1rem",
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional info"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "1rem",
                  }}
                />
              </div>

              {/* Advanced Options (collapsible) */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(v => !v)}
                  style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem", background: "#f3f4f6", border: "1px solid #ddd", borderRadius: "8px", cursor: "pointer", fontSize: "0.9rem", fontWeight: 600, width: "100%" }}
                >
                  <span>{showAdvanced ? "▲" : "▼"}</span>
                  <span>⚙️ Advanced Options</span>
                  {(grantsSlotType || editingItem?.id) && (
                    <span style={{ marginLeft: "auto", fontSize: "0.8rem", color: "#10b981", fontWeight: 400 }}>configured</span>
                  )}
                </button>

                {showAdvanced && (
                  <div style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
                    {/* Bonus Slot Granting */}
                    <div style={{ padding: "1rem", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "8px" }}>
                      <div style={{ marginBottom: "0.75rem", fontWeight: 600 }}>
                        ✨ Does this item grant additional equipment slots?
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                        <div>
                          <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem", fontSize: "0.9rem" }}>Slot Type</label>
                          <select value={grantsSlotType} onChange={(e) => setGrantsSlotType(e.target.value)}
                            style={{ width: "100%", padding: "0.5rem", border: "1px solid #ddd", borderRadius: "6px", fontSize: "0.9rem" }}>
                            <option value="">None</option>
                            <option value="ring">Ring</option>
                            <option value="head">Head</option>
                            <option value="headband">Headband</option>
                            <option value="eyes">Eyes</option>
                            <option value="neck">Neck</option>
                            <option value="shoulders">Shoulders</option>
                            <option value="body">Body</option>
                            <option value="chest">Chest</option>
                            <option value="belt">Belt</option>
                            <option value="wrists">Wrists</option>
                            <option value="hands">Hands</option>
                            <option value="feet">Feet</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem", fontSize: "0.9rem" }}>Quantity</label>
                          <input type="number" value={grantsSlotCount}
                            onChange={(e) => setGrantsSlotCount(parseInt(e.target.value) || 0)}
                            min="0" disabled={!grantsSlotType} placeholder="0"
                            style={{ width: "100%", padding: "0.5rem", border: "1px solid #ddd", borderRadius: "6px", fontSize: "0.9rem" }} />
                        </div>
                      </div>
                      {grantsSlotType && grantsSlotCount > 0 && (
                        <div style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#10b981" }}>
                          💡 When equipped, this item will grant +{grantsSlotCount} {grantsSlotType} slot{grantsSlotCount > 1 ? "s" : ""}
                        </div>
                      )}
                    </div>

                    {/* Item Stat Bonuses Editor */}
                    <ItemBonusesEditor itemId={editingItem?.id || null} onUpdate={onUpdate} />
                  </div>
                )}
              </div>

              {editingItem && (
                <button type="button" onClick={() => { setShowAddModal(false); openRemoveModal(editingItem); }}
                  style={{ width: "100%", padding: "0.6rem", background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: "8px", cursor: "pointer", fontWeight: 600, marginBottom: "0.25rem" }}>
                  🗑️ Remove this item...
                </button>
              )}
              <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    flex: 1,
                    padding: "0.75rem",
                    background: "#f59e0b",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  {saving ? "Saving..." : editingItem ? "Save Changes" : "Add Item"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    padding: "0.75rem 1.5rem",
                    background: "#eee",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* Remove Modal */}
      {showRemoveModal && removingItem && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 4000 }}
          onClick={() => setShowRemoveModal(false)}>
          <div style={{ background: "white", borderRadius: "12px", padding: "2rem", maxWidth: "420px", width: "90%" }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Remove Item</h3>
            <p style={{ color: "#666" }}>What would you like to do with <strong>{removingItem.item_name}</strong>?</p>
            <div style={{ display: "grid", gap: "1rem" }}>
              <div style={{ padding: "1rem", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "8px" }}>
                <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>💰 Sell</div>
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                  <input type="number" step="0.01" min="0" value={sellAmount}
                    onChange={e => setSellAmount(parseFloat(e.target.value) || 0)}
                    placeholder="Amount (gp)"
                    style={{ flex: 1, padding: "0.5rem", border: "1px solid #ddd", borderRadius: "6px" }} />
                  <span style={{ color: "#666", fontSize: "0.9rem" }}>gp</span>
                  <button onClick={handleSell} style={{ padding: "0.5rem 1rem", background: "#10b981", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600 }}>
                    Sell
                  </button>
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button onClick={handleDelete}
                  style={{ flex: 1, padding: "0.75rem", background: "#ef4444", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}>
                  🗑️ Delete
                </button>
                <button onClick={() => setShowRemoveModal(false)}
                  style={{ flex: 1, padding: "0.75rem", background: "#eee", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unified Equipment Browser Modal */}
      {showBrowser && (
        <EquipmentBrowser
          onSelect={handleSelectFromLibrary}
          onClose={() => setShowBrowser(false)}
          initialCategory="adventuring-gear"
        />
      )}

      {showMagicBrowser && (
        <MagicItemBrowser
          onSelect={handleSelectFromMagicLibrary}
          onClose={() => setShowMagicBrowser(false)}
        />
      )}

    </div>
  );
}
