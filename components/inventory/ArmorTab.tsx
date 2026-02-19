"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import EquipmentBrowser from "../EquipmentBrowser";
import { mapArmorToCharacter, mapShieldToCharacter } from "@/lib/equipmentMappers";
import "../styles/EquipmentBrowser.css";

interface ArmorTabProps {
  characterId: string;
  armor: any[];
  onUpdate: () => void;
}

export function ArmorTab({ characterId, armor, onUpdate }: ArmorTabProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingArmor, setEditingArmor] = useState<any>(null);
  const [showArmorBrowser, setShowArmorBrowser] = useState(false); // NEW: Equipment Browser state for armor
  const [showShieldBrowser, setShowShieldBrowser] = useState(false); // NEW: Equipment Browser state for shields

  // Form state
  const [armorName, setArmorName] = useState("");
  const [armorType, setArmorType] = useState("light");
  const [acBonus, setAcBonus] = useState(0);
  const [maxDexBonus, setMaxDexBonus] = useState<number | null>(null);
  const [armorCheckPenalty, setArmorCheckPenalty] = useState(0);
  const [arcaneSpellFailure, setArcaneSpellFailure] = useState(0);
  const [enhancementBonus, setEnhancementBonus] = useState(0);
  const [properties, setProperties] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // NEW: Handle armor selection from Equipment Browser
  async function handleSelectArmor(armor: any) {
    const armorData = mapArmorToCharacter(armor, characterId);
    const { error } = await supabase.from("character_armor").insert(armorData);
    if (error) {
      alert("Error adding armor: " + error.message);
    } else {
      setShowArmorBrowser(false);
      onUpdate();
    }
  }

  // NEW: Handle shield selection from Equipment Browser
  async function handleSelectShield(shield: any) {
    const shieldData = mapShieldToCharacter(shield, characterId);
    const { error } = await supabase.from("character_armor").insert(shieldData);
    if (error) {
      alert("Error adding shield: " + error.message);
    } else {
      setShowShieldBrowser(false);
      onUpdate();
    }
  }

  function openAddModal() {
    setEditingArmor(null);
    resetForm();
    setShowAddModal(true);
  }

  function openEditModal(armor: any) {
    setEditingArmor(armor);
    setArmorName(armor.armor_name);
    setArmorType(armor.armor_type || "light");
    setAcBonus(armor.ac_bonus || 0);
    setMaxDexBonus(armor.max_dex_bonus);
    setArmorCheckPenalty(armor.armor_check_penalty || 0);
    setArcaneSpellFailure(armor.arcane_spell_failure || 0);
    setEnhancementBonus(armor.enhancement_bonus || 0);
    setProperties(armor.properties?.join(", ") || "");
    setNotes(armor.notes || "");
    setShowAddModal(true);
  }

  function resetForm() {
    setArmorName("");
    setArmorType("light");
    setAcBonus(0);
    setMaxDexBonus(null);
    setArmorCheckPenalty(0);
    setArcaneSpellFailure(0);
    setEnhancementBonus(0);
    setProperties("");
    setNotes("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const armorData = {
      character_id: characterId,
      armor_name: armorName,
      armor_type: armorType,
      ac_bonus: acBonus,
      max_dex_bonus: maxDexBonus,
      armor_check_penalty: armorCheckPenalty,
      arcane_spell_failure: arcaneSpellFailure,
      enhancement_bonus: enhancementBonus,
      properties: properties ? properties.split(",").map(p => p.trim()) : [],
      notes: notes || null,
      is_equipped: false,
    };

    let error;

    if (editingArmor) {
      const result = await supabase
        .from("character_armor")
        .update(armorData)
        .eq("id", editingArmor.id);
      error = result.error;
    } else {
      const result = await supabase.from("character_armor").insert(armorData);
      error = result.error;
    }

    if (error) {
      alert("Error saving armor: " + error.message);
    } else {
      setShowAddModal(false);
      resetForm();
      onUpdate();
    }

    setSaving(false);
  }

  async function deleteArmor(id: string) {
    if (!confirm("Delete this armor?")) return;
    await supabase.from("character_armor").delete().eq("id", id);
    onUpdate();
  }

  async function toggleEquipped(id: string, currentState: boolean) {
    await supabase.from("character_armor").update({ is_equipped: !currentState }).eq("id", id);
    onUpdate();
  }

  return (
    <div>
      {/* MODIFIED: Button group with Browse buttons */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <button
          onClick={() => setShowArmorBrowser(true)}
          style={{
            padding: "0.75rem 1.5rem",
            background: "#10b981",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          📖 Browse Armor Library
        </button>

        <button
          onClick={() => setShowShieldBrowser(true)}
          style={{
            padding: "0.75rem 1.5rem",
            background: "#10b981",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          📖 Browse Shields
        </button>

        <button
          onClick={openAddModal}
          style={{
            padding: "0.75rem 1.5rem",
            background: "#f59e0b",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          + Add Custom Armor
        </button>
      </div>

      {armor.length === 0 ? (
        <div
          style={{
            padding: "3rem",
            textAlign: "center",
            background: "#f9fafb",
            border: "2px dashed #ddd",
            borderRadius: "12px",
          }}
        >
          <h3 style={{ margin: 0, color: "#666" }}>No armor or shields yet</h3>
          <p style={{ color: "#999" }}>Browse the library or add custom armor!</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          {armor.map((item) => (
            <div
              key={item.id}
              style={{
                background: item.is_equipped ? "#fffbeb" : "white",
                border: `2px solid ${item.is_equipped ? "#fbbf24" : "#ddd"}`,
                borderRadius: "12px",
                padding: "1.5rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
                    <h3 style={{ margin: 0, color: "#f59e0b" }}>{item.armor_name}</h3>
                    {item.is_equipped && (
                      <span
                        style={{
                          padding: "0.25rem 0.75rem",
                          background: "#10b981",
                          color: "white",
                          borderRadius: "12px",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                        }}
                      >
                        EQUIPPED
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: "0.9rem", color: "#666", marginBottom: "1rem" }}>
                    {item.armor_type} {item.armor_type === "shield" ? "" : "armor"}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                      gap: "1rem",
                      fontSize: "0.95rem",
                    }}
                  >
                    <div>
                      <strong>AC Bonus:</strong> +{item.ac_bonus + item.enhancement_bonus}
                      {item.enhancement_bonus > 0 && ` (+${item.enhancement_bonus} enhancement)`}
                    </div>
                    {item.max_dex_bonus !== null && (
                      <div>
                        <strong>Max DEX:</strong> +{item.max_dex_bonus}
                      </div>
                    )}
                    {item.armor_check_penalty !== 0 && (
                      <div>
                        <strong>Check Penalty:</strong> {item.armor_check_penalty}
                      </div>
                    )}
                    {item.arcane_spell_failure > 0 && (
                      <div>
                        <strong>Spell Failure:</strong> {item.arcane_spell_failure}%
                      </div>
                    )}
                  </div>

                  {item.properties && item.properties.length > 0 && (
                    <div style={{ marginTop: "0.75rem", fontSize: "0.9rem" }}>
                      <strong>Properties:</strong> {item.properties.join(", ")}
                    </div>
                  )}

                  {item.notes && (
                    <div style={{ marginTop: "0.75rem", fontSize: "0.9rem", color: "#999", fontStyle: "italic" }}>
                      {item.notes}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginLeft: "1rem" }}>
                  <button
                    onClick={() => toggleEquipped(item.id, item.is_equipped)}
                    style={{
                      padding: "0.5rem 1rem",
                      background: item.is_equipped ? "#10b981" : "#eee",
                      color: item.is_equipped ? "white" : "#666",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                    }}
                  >
                    {item.is_equipped ? "Equipped" : "Equip"}
                  </button>
                  <button
                    onClick={() => openEditModal(item)}
                    style={{
                      padding: "0.5rem 1rem",
                      background: "#0070f3",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteArmor(item.id)}
                    style={{
                      padding: "0.5rem 1rem",
                      background: "#ef4444",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                    }}
                  >
                    Delete
                  </button>
                </div>
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
            <h2 style={{ marginTop: 0 }}>{editingArmor ? "Edit Armor" : "Add Custom Armor/Shield"}</h2>

            <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Name *
                </label>
                <input
                  type="text"
                  value={armorName}
                  onChange={(e) => setArmorName(e.target.value)}
                  required
                  placeholder="e.g., +2 Mithral Chain Shirt, Heavy Steel Shield"
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
                  value={armorType}
                  onChange={(e) => setArmorType(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "1rem",
                  }}
                >
                  <option value="light">Light Armor</option>
                  <option value="medium">Medium Armor</option>
                  <option value="heavy">Heavy Armor</option>
                  <option value="shield">Shield</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                    AC Bonus *
                  </label>
                  <input
                    type="number"
                    value={acBonus}
                    onChange={(e) => setAcBonus(parseInt(e.target.value) || 0)}
                    required
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
                    Enhancement Bonus
                  </label>
                  <input
                    type="number"
                    value={enhancementBonus}
                    onChange={(e) => setEnhancementBonus(parseInt(e.target.value) || 0)}
                    placeholder="+1, +2, etc."
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
                    Max DEX Bonus
                  </label>
                  <input
                    type="number"
                    value={maxDexBonus || ""}
                    onChange={(e) => setMaxDexBonus(e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="Leave empty for unlimited"
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
                    Check Penalty
                  </label>
                  <input
                    type="number"
                    value={armorCheckPenalty}
                    onChange={(e) => setArmorCheckPenalty(parseInt(e.target.value) || 0)}
                    placeholder="-1, -2, etc."
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
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Arcane Spell Failure %
                </label>
                <input
                  type="number"
                  value={arcaneSpellFailure}
                  onChange={(e) => setArcaneSpellFailure(parseInt(e.target.value) || 0)}
                  placeholder="0, 5, 10, 15, etc."
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
                  Properties (comma-separated)
                </label>
                <input
                  type="text"
                  value={properties}
                  onChange={(e) => setProperties(e.target.value)}
                  placeholder="mithral, glamered, shadow, etc."
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
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Special abilities, enchantments, etc."
                  rows={3}
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
                  {saving ? "Saving..." : editingArmor ? "Save Changes" : "Add Armor"}
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

      {/* NEW: Equipment Browser Modals */}
      {showArmorBrowser && (
        <EquipmentBrowser
          category="armor"
          onSelect={handleSelectArmor}
          onClose={() => setShowArmorBrowser(false)}
        />
      )}

      {showShieldBrowser && (
        <EquipmentBrowser
          category="shields"
          onSelect={handleSelectShield}
          onClose={() => setShowShieldBrowser(false)}
        />
      )}
    </div>
  );
}
