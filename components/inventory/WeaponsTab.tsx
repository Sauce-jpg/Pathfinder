"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import EquipmentBrowser from "../EquipmentBrowser";
import { mapWeaponToCharacter } from "@/lib/equipmentMappers";
import "../../styles/EquipmentBrowser.css";

interface WeaponsTabProps {
  characterId: string;
  weapons: any[];
  onUpdate: () => void;
}

export function WeaponsTab({ characterId, weapons, onUpdate }: WeaponsTabProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingWeapon, setEditingWeapon] = useState<any>(null);
  const [showBrowser, setShowBrowser] = useState(false); // NEW: Equipment Browser state

  // Form state
  const [weaponName, setWeaponName] = useState("");
  const [weaponType, setWeaponType] = useState("melee");
  const [weaponCategory, setWeaponCategory] = useState("martial");
  const [damageDice, setDamageDice] = useState("1d8");
  const [damageType, setDamageType] = useState("slashing");
  const [attackBonus, setAttackBonus] = useState(0);
  const [damageBonus, setDamageBonus] = useState(0);
  const [criticalRange, setCriticalRange] = useState("20");
  const [criticalMultiplier, setCriticalMultiplier] = useState("x2");
  const [rangeIncrement, setRangeIncrement] = useState<number | null>(null);
  const [properties, setProperties] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // NEW: Handle weapon selection from Equipment Browser
  async function handleSelectFromLibrary(weapon: any) {
    const weaponData = mapWeaponToCharacter(weapon, characterId);

    const { error } = await supabase
      .from("character_weapons")
      .insert(weaponData);

    if (error) {
      alert("Error adding weapon: " + error.message);
    } else {
      setShowBrowser(false);
      onUpdate();
    }
  }

  function openAddModal() {
    setEditingWeapon(null);
    resetForm();
    setShowAddModal(true);
  }

  function openEditModal(weapon: any) {
    setEditingWeapon(weapon);
    setWeaponName(weapon.weapon_name);
    setWeaponType(weapon.weapon_type || "melee");
    setWeaponCategory(weapon.weapon_category || "martial");
    setDamageDice(weapon.damage_dice || "1d8");
    setDamageType(weapon.damage_type || "slashing");
    setAttackBonus(weapon.attack_bonus || 0);
    setDamageBonus(weapon.damage_bonus || 0);
    setCriticalRange(weapon.critical_range || "20");
    setCriticalMultiplier(weapon.critical_multiplier || "x2");
    setRangeIncrement(weapon.range_increment);
    setProperties(weapon.properties?.join(", ") || "");
    setNotes(weapon.notes || "");
    setShowAddModal(true);
  }

  function resetForm() {
    setWeaponName("");
    setWeaponType("melee");
    setWeaponCategory("martial");
    setDamageDice("1d8");
    setDamageType("slashing");
    setAttackBonus(0);
    setDamageBonus(0);
    setCriticalRange("20");
    setCriticalMultiplier("x2");
    setRangeIncrement(null);
    setProperties("");
    setNotes("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const weaponData = {
      character_id: characterId,
      weapon_name: weaponName,
      weapon_type: weaponType,
      weapon_category: weaponCategory,
      damage_dice: damageDice,
      damage_type: damageType,
      attack_bonus: attackBonus,
      damage_bonus: damageBonus,
      critical_range: criticalRange,
      critical_multiplier: criticalMultiplier,
      range_increment: rangeIncrement,
      properties: properties ? properties.split(",").map(p => p.trim()) : [],
      notes: notes || null,
      is_primary: false,
      is_equipped: false,
    };

    let error;

    if (editingWeapon) {
      const result = await supabase
        .from("character_weapons")
        .update(weaponData)
        .eq("id", editingWeapon.id);
      error = result.error;
    } else {
      const result = await supabase.from("character_weapons").insert(weaponData);
      error = result.error;
    }

    if (error) {
      alert("Error saving weapon: " + error.message);
    } else {
      setShowAddModal(false);
      resetForm();
      onUpdate();
    }

    setSaving(false);
  }

  async function deleteWeapon(id: string) {
    if (!confirm("Delete this weapon?")) return;
    await supabase.from("character_weapons").delete().eq("id", id);
    onUpdate();
  }

  async function toggleEquipped(id: string, currentState: boolean) {
    await supabase.from("character_weapons").update({ is_equipped: !currentState }).eq("id", id);
    onUpdate();
  }

  async function togglePrimary(id: string, currentState: boolean) {
    // If setting as primary, unset all others first
    if (!currentState) {
      await supabase
        .from("character_weapons")
        .update({ is_primary: false })
        .eq("character_id", characterId);
    }
    await supabase.from("character_weapons").update({ is_primary: !currentState }).eq("id", id);
    onUpdate();
  }

  return (
    <div>
      {/* MODIFIED: Add button group with Browse Library button */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <button
          onClick={() => setShowBrowser(true)}
          style={{
            padding: "0.75rem 1.5rem",
            background: "#10b981",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          📖 Browse Weapons Library
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
          + Add Custom Weapon
        </button>
      </div>

      {weapons.length === 0 ? (
        <div
          style={{
            padding: "3rem",
            textAlign: "center",
            background: "#f9fafb",
            border: "2px dashed #ddd",
            borderRadius: "12px",
          }}
        >
          <h3 style={{ margin: 0, color: "#666" }}>No weapons yet</h3>
          <p style={{ color: "#999" }}>Browse the library or add a custom weapon!</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          {weapons.map((weapon) => (
            <div
              key={weapon.id}
              style={{
                background: weapon.is_equipped ? "#fffbeb" : "white",
                border: `2px solid ${weapon.is_primary ? "#f59e0b" : weapon.is_equipped ? "#fbbf24" : "#ddd"}`,
                borderRadius: "12px",
                padding: "1.5rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
                    <h3 style={{ margin: 0, color: "#f59e0b" }}>{weapon.weapon_name}</h3>
                    {weapon.is_primary && (
                      <span
                        style={{
                          padding: "0.25rem 0.75rem",
                          background: "#f59e0b",
                          color: "white",
                          borderRadius: "12px",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                        }}
                      >
                        PRIMARY
                      </span>
                    )}
                    {weapon.is_equipped && !weapon.is_primary && (
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
                    {weapon.weapon_category} {weapon.weapon_type} weapon
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
                      <strong>Attack:</strong> {weapon.attack_bonus >= 0 ? "+" : ""}
                      {weapon.attack_bonus}
                    </div>
                    <div>
                      <strong>Damage:</strong> {weapon.damage_dice}
                      {weapon.damage_bonus > 0 && `+${weapon.damage_bonus}`}{" "}
                      ({weapon.damage_type})
                    </div>
                    <div>
                      <strong>Critical:</strong> {weapon.critical_range}/{weapon.critical_multiplier}
                    </div>
                    {weapon.range_increment && (
                      <div>
                        <strong>Range:</strong> {weapon.range_increment} ft
                      </div>
                    )}
                  </div>

                  {weapon.properties && weapon.properties.length > 0 && (
                    <div style={{ marginTop: "0.75rem", fontSize: "0.9rem" }}>
                      <strong>Properties:</strong> {weapon.properties.join(", ")}
                    </div>
                  )}

                  {weapon.notes && (
                    <div style={{ marginTop: "0.75rem", fontSize: "0.9rem", color: "#999", fontStyle: "italic" }}>
                      {weapon.notes}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginLeft: "1rem" }}>
                  <button
                    onClick={() => togglePrimary(weapon.id, weapon.is_primary)}
                    style={{
                      padding: "0.5rem 1rem",
                      background: weapon.is_primary ? "#fbbf24" : "#eee",
                      color: weapon.is_primary ? "white" : "#666",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                    }}
                  >
                    {weapon.is_primary ? "★ Primary" : "☆ Set Primary"}
                  </button>
                  <button
                    onClick={() => toggleEquipped(weapon.id, weapon.is_equipped)}
                    style={{
                      padding: "0.5rem 1rem",
                      background: weapon.is_equipped ? "#10b981" : "#eee",
                      color: weapon.is_equipped ? "white" : "#666",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                    }}
                  >
                    {weapon.is_equipped ? "Equipped" : "Equip"}
                  </button>
                  <button
                    onClick={() => openEditModal(weapon)}
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
                    onClick={() => deleteWeapon(weapon.id)}
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
            <h2 style={{ marginTop: 0 }}>{editingWeapon ? "Edit Weapon" : "Add Custom Weapon"}</h2>

            <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Weapon Name *
                </label>
                <input
                  type="text"
                  value={weaponName}
                  onChange={(e) => setWeaponName(e.target.value)}
                  required
                  placeholder="e.g., +1 Scythe, Longbow"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "1rem",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>Type</label>
                  <select
                    value={weaponType}
                    onChange={(e) => setWeaponType(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                      fontSize: "1rem",
                    }}
                  >
                    <option value="melee">Melee</option>
                    <option value="ranged">Ranged</option>
                    <option value="thrown">Thrown</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>Category</label>
                  <select
                    value={weaponCategory}
                    onChange={(e) => setWeaponCategory(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                      fontSize: "1rem",
                    }}
                  >
                    <option value="simple">Simple</option>
                    <option value="martial">Martial</option>
                    <option value="exotic">Exotic</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                    Damage Dice *
                  </label>
                  <input
                    type="text"
                    value={damageDice}
                    onChange={(e) => setDamageDice(e.target.value)}
                    required
                    placeholder="e.g., 1d8, 2d6"
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
                    Damage Type
                  </label>
                  <select
                    value={damageType}
                    onChange={(e) => setDamageType(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                      fontSize: "1rem",
                    }}
                  >
                    <option value="slashing">Slashing</option>
                    <option value="piercing">Piercing</option>
                    <option value="bludgeoning">Bludgeoning</option>
                    <option value="slashing and piercing">Slashing & Piercing</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                    Attack Bonus
                  </label>
                  <input
                    type="number"
                    value={attackBonus}
                    onChange={(e) => setAttackBonus(parseInt(e.target.value) || 0)}
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

                <div>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                    Damage Bonus
                  </label>
                  <input
                    type="number"
                    value={damageBonus}
                    onChange={(e) => setDamageBonus(parseInt(e.target.value) || 0)}
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
                    Critical Range
                  </label>
                  <input
                    type="text"
                    value={criticalRange}
                    onChange={(e) => setCriticalRange(e.target.value)}
                    placeholder="20, 19-20, 18-20"
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
                    Critical Multiplier
                  </label>
                  <select
                    value={criticalMultiplier}
                    onChange={(e) => setCriticalMultiplier(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                      fontSize: "1rem",
                    }}
                  >
                    <option value="x2">x2</option>
                    <option value="x3">x3</option>
                    <option value="x4">x4</option>
                  </select>
                </div>
              </div>

              {(weaponType === "ranged" || weaponType === "thrown") && (
                <div>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                    Range Increment (ft)
                  </label>
                  <input
                    type="number"
                    value={rangeIncrement || ""}
                    onChange={(e) => setRangeIncrement(parseInt(e.target.value) || null)}
                    placeholder="30, 100, etc."
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                      fontSize: "1rem",
                    }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Properties (comma-separated)
                </label>
                <input
                  type="text"
                  value={properties}
                  onChange={(e) => setProperties(e.target.value)}
                  placeholder="reach, trip, finesse, etc."
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
                  {saving ? "Saving..." : editingWeapon ? "Save Changes" : "Add Weapon"}
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

      {/* NEW: Equipment Browser Modal */}
      {showBrowser && (
        <EquipmentBrowser
          category="weapons"
          onSelect={handleSelectFromLibrary}
          onClose={() => setShowBrowser(false)}
        />
      )}
    </div>
  );
}
