"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import EquipmentBrowser from "../EquipmentBrowser";
import { ItemBonusesEditor } from "./ItemBonusesEditor";
import MagicItemBrowser, { type MagicItem } from "../MagicItemBrowser";
import { mapWeaponToCharacter } from "@/lib/equipmentMappers";

interface WeaponsTabProps {
  characterId: string;
  weapons: any[];
  onUpdate: () => void;
}

export function WeaponsTab({ characterId, weapons, onUpdate }: WeaponsTabProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingWeapon, setEditingWeapon] = useState<any>(null);
  const [showBrowser, setShowBrowser] = useState(false);
  const [showMagicBrowser, setShowMagicBrowser] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
  const [grantsSlotType, setGrantsSlotType] = useState("");
  const [grantsSlotCount, setGrantsSlotCount] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removingItem, setRemovingItem] = useState<any>(null);
  const [sellAmount, setSellAmount] = useState(0);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // NEW: Handle weapon selection from Equipment Browser
  async function handleSelectFromLibrary(weapon: any) {
    const weaponData = mapWeaponToCharacter(weapon, characterId);
    const { error } = await supabase.from("character_weapons").insert(weaponData);
    if (error) { alert("Error adding weapon: " + error.message); }
    else { setShowBrowser(false); onUpdate(); }
  }

  async function handleSelectMagicWeapon(item: MagicItem) {
    const enhBonus = item.EnhancementBonus ?? 0;
    const isMasterwork = item.IsMasterwork ?? false;
    // Enhancement bonus supersedes masterwork (+1 atk only, never to dmg)
    const attackBonus = enhBonus > 0 ? enhBonus : (isMasterwork ? 1 : 0);
    const damageBonus = enhBonus;

    const meta = {
      _magic: true,
      description: item.Description,
      aura: item.Aura,
      cl: item.CL,
      source: item.Source,
      reference: item.Reference,
      baseWeapon: item.BaseWeapon,
      proficiency: item.Proficiency,
      weaponGroups: item.WeaponGroups,
      specialAbilities: item.SpecialAbilities,
      construction: item.Construction,
      powerLevel: item.PowerLevel,
      rarity: item.Rarity,
      damageSml: item["Damage (S)"],
      damageMed: item["Damage (M)"],
      damageType: item.DamageType ?? item.Type,
      enhancementBonus: enhBonus,
      isMasterwork,
      material: item.Material,
    };

    const weaponData = {
      character_id: characterId,
      weapon_name: item.Name,
      weapon_type: "melee",
      weapon_category: item.Proficiency ?? "martial",
      damage_dice: item["Damage (M)"] ?? "1d6",
      damage_type: item.DamageType ?? item.Type ?? "slashing",
      attack_bonus: attackBonus,
      damage_bonus: damageBonus,
      critical_range: item.Critical?.split("/")[0] ?? "20",
      critical_multiplier: item.Critical?.includes("x") ? item.Critical.split("/")[1] : "x2",
      range_increment: item.Range && item.Range !== "—" ? parseInt(item.Range) || null : null,
      properties: item.SpecialAbilities ?? [],
      notes: JSON.stringify(meta),
      is_primary: false,
      is_equipped: false,
    };
    const { error } = await supabase.from("character_weapons").insert(weaponData);
    if (error) { alert("Error adding magic weapon: " + error.message); }
    else { setShowMagicBrowser(false); onUpdate(); }
  }

  function openAddModal() {
    setEditingWeapon(null);
    resetForm();
    setShowAdvanced(false);
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
    setGrantsSlotType(weapon.grants_slot_type || "");
    setGrantsSlotCount(weapon.grants_slot_count || 0);
    setShowAdvanced(false);
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
    setGrantsSlotType("");
    setGrantsSlotCount(0);
    setShowAdvanced(false);
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
      grants_slot_type: grantsSlotType || null,
      grants_slot_count: grantsSlotCount || 0,
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

  function openRemoveModal(item: any) {
    setRemovingItem(item);
    setSellAmount(item.cost_gp || 0);
    setShowRemoveModal(true);
  }

  async function handleSell() {
    if (!removingItem) return;
    const itemName = removingItem.weapon_name || "Unknown item";
    // Add gold to currency
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
      // Record transaction
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
    await supabase.from("character_weapons").delete().eq("id", removingItem.id);
    setShowRemoveModal(false);
    setRemovingItem(null);
    onUpdate();
  }

  async function handleDelete() {
    if (!removingItem) return;
    await supabase.from("character_weapons").delete().eq("id", removingItem.id);
    setShowRemoveModal(false);
    setRemovingItem(null);
    onUpdate();
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
      {/* Add Item dropdown button */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <div ref={dropdownRef} style={{ position: "relative" }}>
          <button
            onClick={() => setShowDropdown(v => !v)}
            style={{ padding: "0.75rem 1.25rem", background: "#10b981", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            + Add Weapon ▾
          </button>
          {showDropdown && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, background: "white", border: "1px solid #ddd", borderRadius: "8px", boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 100, minWidth: "200px", overflow: "hidden" }}>
              {[
                { label: "📖 Browse Weapons", action: () => { setShowBrowser(true); setShowDropdown(false); } },
                { label: "⚔️ Browse Magic Weapons", action: () => { setShowMagicBrowser(true); setShowDropdown(false); } },
                { label: "✏️ Add Custom Weapon", action: () => { openAddModal(); setShowDropdown(false); } },
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
          {weapons.map((weapon) => {
            const isExpanded = expandedId === weapon.id;
            return (
            <div
              key={weapon.id}
              style={{
                background: weapon.is_equipped ? "#fffbeb" : "white",
                border: `2px solid ${weapon.is_primary ? "#f59e0b" : isExpanded ? "#818cf8" : weapon.is_equipped ? "#fbbf24" : "#ddd"}`,
                borderRadius: "12px",
                overflow: "hidden",
              }}
            >
              {/* Clickable header */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : weapon.id)}
                style={{ padding: "1rem 1.5rem", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "#f59e0b" }}>{weapon.weapon_name}</span>
                    {weapon.is_primary && <span style={{ padding: "0.15rem 0.6rem", background: "#f59e0b", color: "white", borderRadius: "12px", fontSize: "0.72rem", fontWeight: 600 }}>PRIMARY</span>}
                    {weapon.is_equipped && !weapon.is_primary && <span style={{ padding: "0.15rem 0.6rem", background: "#10b981", color: "white", borderRadius: "12px", fontSize: "0.72rem", fontWeight: 600 }}>EQUIPPED</span>}
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "#888", marginTop: "0.2rem" }}>
                    {weapon.weapon_category} {weapon.weapon_type} · Atk {weapon.attack_bonus >= 0 ? "+" : ""}{weapon.attack_bonus} · {weapon.damage_dice}{weapon.damage_bonus > 0 ? `+${weapon.damage_bonus}` : ""} {weapon.damage_type} · Crit {weapon.critical_range}/{weapon.critical_multiplier}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", marginLeft: "1rem", flexShrink: 0 }}>
                  <button onClick={e => { e.stopPropagation(); togglePrimary(weapon.id, weapon.is_primary); }}
                    style={{ padding: "0.3rem 0.6rem", background: weapon.is_primary ? "#fbbf24" : "#eee", color: weapon.is_primary ? "white" : "#666", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem" }}>
                    {weapon.is_primary ? "★" : "☆"}
                  </button>
                  <button onClick={e => { e.stopPropagation(); toggleEquipped(weapon.id, weapon.is_equipped); }}
                    style={{ padding: "0.3rem 0.6rem", background: weapon.is_equipped ? "#10b981" : "#eee", color: weapon.is_equipped ? "white" : "#666", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem" }}>
                    {weapon.is_equipped ? "✓" : "Equip"}
                  </button>
                  <button onClick={e => { e.stopPropagation(); openEditModal(weapon); }}
                    style={{ padding: "0.3rem 0.6rem", background: "#6366f1", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem" }}>✏️</button>
                  <span style={{ fontSize: "0.7rem", color: "#9ca3af", marginLeft: "0.25rem" }}>{isExpanded ? "▲" : "▼"}</span>
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (() => {
                // Try to parse magic item metadata from notes JSON blob
                let meta: any = null;
                try { if (weapon.notes?.startsWith("{")) meta = JSON.parse(weapon.notes); } catch {}

                return (
                <div style={{ borderTop: "1px solid #e5e7eb", background: "#fafbff" }}>
                  {/* Stats bar */}
                  <div style={{ display: "flex", flexWrap: "wrap", borderBottom: "1px solid #e5e7eb" }}>
                    {[
                      { label: "Attack", value: `${weapon.attack_bonus >= 0 ? "+" : ""}${weapon.attack_bonus}` },
                      { label: "Damage (M)", value: `${weapon.damage_dice}${weapon.damage_bonus > 0 ? `+${weapon.damage_bonus}` : ""}` },
                      ...(meta?.damageSml ? [{ label: "Damage (S)", value: meta.damageSml }] : []),
                      { label: "Dmg Type", value: weapon.damage_type },
                      { label: "Critical", value: `${weapon.critical_range}/${weapon.critical_multiplier}` },
                      ...(weapon.range_increment ? [{ label: "Range", value: `${weapon.range_increment} ft` }] : []),
                      ...(meta?.enhancementBonus > 0 ? [{ label: "Enhancement", value: `+${meta.enhancementBonus}` }] : []),
                      { label: "Category", value: weapon.weapon_category },
                      ...(meta?.baseWeapon ? [{ label: "Base Weapon", value: meta.baseWeapon }] : []),
                      ...(meta?.powerLevel ? [{ label: "Power", value: meta.powerLevel }] : []),
                      ...(meta?.rarity ? [{ label: "Rarity", value: meta.rarity }] : []),
                    ].map(({ label, value }) => (
                      <div key={label} style={{ padding: "0.6rem 1.25rem", borderRight: "1px solid #e5e7eb", textAlign: "center" }}>
                        <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9ca3af" }}>{label}</div>
                        <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#111827", marginTop: "0.1rem" }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ padding: "1rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                    {/* Aura / CL / Source row */}
                    {(meta?.aura || meta?.cl || meta?.source) && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", fontSize: "0.82rem", color: "#6b7280" }}>
                        {meta.aura && <span>🌀 <strong>Aura:</strong> {meta.aura}</span>}
                        {meta.cl && <span>⚡ <strong>CL:</strong> {meta.cl}</span>}
                        {meta.source && <span>📖 <strong>Source:</strong> {meta.source}</span>}
                        {meta.reference && <a href={meta.reference} target="_blank" rel="noreferrer" style={{ color: "#6366f1", fontWeight: 600 }}>PFSRD ↗</a>}
                      </div>
                    )}

                    {/* Description */}
                    {(meta?.description || (!meta && weapon.notes)) && (
                      <div>
                        <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6b7280", marginBottom: "0.35rem" }}>Description</div>
                        <p style={{ margin: 0, fontSize: "0.875rem", color: "#374151", lineHeight: 1.65, whiteSpace: "pre-line" }}>
                          {meta?.description ?? weapon.notes}
                        </p>
                      </div>
                    )}

                    {/* Special abilities */}
                    {(weapon.properties?.length > 0 || meta?.specialAbilities?.length > 0) && (
                      <div>
                        <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6b7280", marginBottom: "0.35rem" }}>Special Abilities</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                          {(meta?.specialAbilities?.length > 0 ? meta.specialAbilities : weapon.properties).map((p: string) => (
                            <span key={p} style={{ padding: "0.2rem 0.65rem", background: "#ede9fe", color: "#5b21b6", borderRadius: "999px", fontSize: "0.8rem", fontWeight: 600 }}>{p}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Weapon groups */}
                    {meta?.weaponGroups && (
                      <div style={{ fontSize: "0.82rem", color: "#6b7280" }}>
                        <strong>Weapon Groups:</strong> {meta.weaponGroups}
                      </div>
                    )}

                    {/* Construction */}
                    {meta?.construction?.Requirements && (
                      <div style={{ padding: "0.6rem 0.85rem", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "6px", fontSize: "0.82rem", color: "#92400e" }}>
                        <strong>Construction:</strong> {meta.construction.Requirements}
                        {meta.construction.Cost > 0 && <span> · Cost: {meta.construction.Cost.toLocaleString()} gp</span>}
                      </div>
                    )}

                    {/* Material */}
                    {meta?.material && (
                      <div style={{ fontSize: "0.82rem", color: "#6b7280" }}>⚗️ <strong>Material:</strong> {meta.material}</div>
                    )}
                  </div>
                </div>
                );
              })()}
            </div>
            );
          })}
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

              {/* Advanced Options (collapsible) */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(v => !v)}
                  style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem", background: "#f3f4f6", border: "1px solid #ddd", borderRadius: "8px", cursor: "pointer", fontSize: "0.9rem", fontWeight: 600, width: "100%" }}
                >
                  <span>{showAdvanced ? "▲" : "▼"}</span>
                  <span>⚙️ Advanced Options</span>
                  {grantsSlotType && (
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

                    {/* Auto-Apply Stat Bonuses When Equipped */}
                                        <ItemBonusesEditor itemId={editingWeapon?.id || null} onUpdate={onUpdate} sourceTable="weapon" />
                  </div>
                )}
              </div>

              {editingWeapon && (
                <button type="button" onClick={() => { setShowAddModal(false); openRemoveModal(editingWeapon); }}
                  style={{ width: "100%", padding: "0.6rem", background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: "8px", cursor: "pointer", fontWeight: 600, marginBottom: "0.25rem" }}>
                  🗑️ Remove this weapon...
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


      {/* Remove Modal */}
      {showRemoveModal && removingItem && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 4000 }}
          onClick={() => setShowRemoveModal(false)}>
          <div style={{ background: "white", borderRadius: "12px", padding: "2rem", maxWidth: "420px", width: "90%" }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Remove Item</h3>
            <p style={{ color: "#666" }}>What would you like to do with <strong>{removingItem.weapon_name}</strong>?</p>
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

      {showBrowser && (
        <EquipmentBrowser
          initialCategory="weapons"
          onSelect={handleSelectFromLibrary}
          onClose={() => setShowBrowser(false)}
        />
      )}
      {showMagicBrowser && (
        <MagicItemBrowser
          initialTypes={["Magic Weapon"]}
          onSelect={handleSelectMagicWeapon}
          onClose={() => setShowMagicBrowser(false)}
        />
      )}
    </div>
  );
}
