"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import EquipmentBrowser from "../EquipmentBrowser";
import { ItemBonusesEditor } from "./ItemBonusesEditor";
import MagicItemBrowser, { type MagicItem } from "../MagicItemBrowser";
import { mapArmorToCharacter, mapShieldToCharacter } from "@/lib/equipmentMappers";

interface ArmorTabProps {
  characterId: string;
  armor: any[];
  onUpdate: () => void;
}

export function ArmorTab({ characterId, armor, onUpdate }: ArmorTabProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingArmor, setEditingArmor] = useState<any>(null);
  const [showArmorBrowser, setShowArmorBrowser] = useState(false);
  const [showShieldBrowser, setShowShieldBrowser] = useState(false);
  const [showMagicBrowser, setShowMagicBrowser] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
  const [grantsSlotType, setGrantsSlotType] = useState("");
  const [grantsSlotCount, setGrantsSlotCount] = useState(0);
  const [saving, setSaving] = useState(false);

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

  // NEW: Handle armor selection from Equipment Browser
  async function handleSelectArmor(armor: any) {
    const armorData = mapArmorToCharacter(armor, characterId);
    const { error } = await supabase.from("character_armor").insert(armorData);
    if (error) { alert("Error adding armor: " + error.message); }
    else { setShowArmorBrowser(false); onUpdate(); }
  }

  // NEW: Handle shield selection from Equipment Browser
  async function handleSelectShield(shield: any) {
    const shieldData = mapShieldToCharacter(shield, characterId);
    const { error } = await supabase.from("character_armor").insert(shieldData);
    if (error) { alert("Error adding shield: " + error.message); }
    else { setShowShieldBrowser(false); onUpdate(); }
  }

  async function handleSelectMagicArmorOrShield(item: MagicItem) {
    const parseNum = (v: any): number => {
      if (v === undefined || v === null || v === "—" || v === "") return 0;
      const n = parseInt(String(v).replace(/[^\d-]/g, ""));
      return isNaN(n) ? 0 : n;
    };
    const parseMaxDex = (v: any): number | null => {
      if (v === undefined || v === null || v === "—" || v === "") return null;
      const n = parseInt(String(v).replace(/\D/g, ""));
      return isNaN(n) ? null : n;
    };

    const enhBonus = item.EnhancementBonus ?? parseNum(item["Enhancement Bonus"]);

    const meta = {
      _magic: true,
      description: item.Description,
      aura: item.Aura,
      cl: item.CL,
      source: item.Source,
      reference: item.Reference,
      baseArmor: item.BaseArmor,
      armorCategory: item.ArmorCategory,
      specialAbilities: item.SpecialAbilities,
      construction: item.Construction,
      powerLevel: item.PowerLevel,
      rarity: item.Rarity,
      material: item.Material,
      isMasterwork: item.IsMasterwork,
      speed30: item.Speed30,
      speed20: item.Speed20,
      enhancementBonus: enhBonus,
    };

    const armorData = {
      character_id: characterId,
      armor_name: item.Name,
      armor_type: item.ItemType === "Magic Shield" ? "shield" : "light",
      ac_bonus: parseNum(item["AC Bonus"]),
      enhancement_bonus: enhBonus,
      max_dex_bonus: parseMaxDex(item["Max Dex"]),
      armor_check_penalty: parseNum(item["Armor Check Penalty"]),
      arcane_spell_failure: parseNum(item["Arcane Spell Failure"]),
      properties: item.SpecialAbilities ?? [],
      notes: JSON.stringify(meta),
      is_equipped: false,
    };

    const { error } = await supabase.from("character_armor").insert(armorData);
    if (error) { alert("Error adding magic armor/shield: " + error.message); }
    else { setShowMagicBrowser(false); onUpdate(); }
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
    setGrantsSlotType(armor.grants_slot_type || "");
    setGrantsSlotCount(armor.grants_slot_count || 0);
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
    setGrantsSlotType("");
    setGrantsSlotCount(0);
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
      grants_slot_type: grantsSlotType || null,
      grants_slot_count: grantsSlotCount || 0,
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
      {/* Add Item dropdown button */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <div ref={dropdownRef} style={{ position: "relative" }}>
          <button
            onClick={() => setShowDropdown(v => !v)}
            style={{ padding: "0.75rem 1.25rem", background: "#10b981", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            + Add Armor ▾
          </button>
          {showDropdown && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, background: "white", border: "1px solid #ddd", borderRadius: "8px", boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 100, minWidth: "220px", overflow: "hidden" }}>
              {[
                { label: "🛡️ Browse Armor", action: () => { setShowArmorBrowser(true); setShowDropdown(false); } },
                { label: "🔰 Browse Shields", action: () => { setShowShieldBrowser(true); setShowDropdown(false); } },
                { label: "✨ Browse Magic Armor & Shields", action: () => { setShowMagicBrowser(true); setShowDropdown(false); } },
                { label: "✏️ Add Custom Armor", action: () => { openAddModal(); setShowDropdown(false); } },
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
          {armor.map((item) => {
            const isExpanded = expandedId === item.id;
            return (
            <div
              key={item.id}
              style={{
                background: item.is_equipped ? "#fffbeb" : "white",
                border: `2px solid ${isExpanded ? "#818cf8" : item.is_equipped ? "#fbbf24" : "#ddd"}`,
                borderRadius: "12px",
                overflow: "hidden",
              }}
            >
              {/* Clickable header */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                style={{ padding: "1rem 1.5rem", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "#f59e0b" }}>{item.armor_name}</span>
                    {item.is_equipped && <span style={{ padding: "0.15rem 0.6rem", background: "#10b981", color: "white", borderRadius: "12px", fontSize: "0.72rem", fontWeight: 600 }}>EQUIPPED</span>}
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "#888", marginTop: "0.2rem" }}>
                    {item.armor_type}{item.armor_type !== "shield" ? " armor" : ""} · AC +{item.ac_bonus + item.enhancement_bonus}
                    {item.enhancement_bonus > 0 && ` (+${item.enhancement_bonus} enh)`}
                    {item.armor_check_penalty !== 0 && ` · ACP ${item.armor_check_penalty}`}
                    {item.arcane_spell_failure > 0 && ` · ASF ${item.arcane_spell_failure}%`}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", marginLeft: "1rem", flexShrink: 0 }}>
                  <button onClick={e => { e.stopPropagation(); toggleEquipped(item.id, item.is_equipped); }}
                    style={{ padding: "0.3rem 0.6rem", background: item.is_equipped ? "#10b981" : "#eee", color: item.is_equipped ? "white" : "#666", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem" }}>
                    {item.is_equipped ? "✓" : "Equip"}
                  </button>
                  <button onClick={e => { e.stopPropagation(); openEditModal(item); }}
                    style={{ padding: "0.3rem 0.6rem", background: "#6366f1", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem" }}>✏️</button>
                  <button onClick={e => { e.stopPropagation(); deleteArmor(item.id); }}
                    style={{ padding: "0.3rem 0.6rem", background: "#ef4444", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem" }}>🗑️</button>
                  <span style={{ fontSize: "0.7rem", color: "#9ca3af", marginLeft: "0.25rem" }}>{isExpanded ? "▲" : "▼"}</span>
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (() => {
                let meta: any = null;
                try { if (item.notes?.startsWith("{")) meta = JSON.parse(item.notes); } catch {}

                return (
                <div style={{ borderTop: "1px solid #e5e7eb", background: "#fafbff" }}>
                  {/* Stats bar */}
                  <div style={{ display: "flex", flexWrap: "wrap", borderBottom: "1px solid #e5e7eb" }}>
                    {[
                      { label: "AC Bonus", value: `+${item.ac_bonus + item.enhancement_bonus}` },
                      ...(item.enhancement_bonus > 0 ? [{ label: "Enhancement", value: `+${item.enhancement_bonus}` }] : []),
                      ...(item.max_dex_bonus !== null ? [{ label: "Max Dex", value: `+${item.max_dex_bonus}` }] : []),
                      ...(item.armor_check_penalty !== 0 ? [{ label: "ACP", value: String(item.armor_check_penalty) }] : []),
                      ...(item.arcane_spell_failure > 0 ? [{ label: "Spell Fail", value: `${item.arcane_spell_failure}%` }] : []),
                      { label: "Type", value: item.armor_type === "shield" ? "Shield" : `${item.armor_type.charAt(0).toUpperCase() + item.armor_type.slice(1)} Armor` },
                      ...(meta?.baseArmor ? [{ label: "Base Armor", value: meta.baseArmor }] : []),
                      ...(meta?.speed30 ? [{ label: "Speed (30)", value: meta.speed30 }] : []),
                      ...(meta?.speed20 ? [{ label: "Speed (20)", value: meta.speed20 }] : []),
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
                    {/* Aura / CL / Source */}
                    {(meta?.aura || meta?.cl || meta?.source) && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", fontSize: "0.82rem", color: "#6b7280" }}>
                        {meta.aura && <span>🌀 <strong>Aura:</strong> {meta.aura}</span>}
                        {meta.cl && <span>⚡ <strong>CL:</strong> {meta.cl}</span>}
                        {meta.source && <span>📖 <strong>Source:</strong> {meta.source}</span>}
                        {meta.reference && <a href={meta.reference} target="_blank" rel="noreferrer" style={{ color: "#6366f1", fontWeight: 600 }}>PFSRD ↗</a>}
                      </div>
                    )}

                    {/* Description */}
                    {(meta?.description || (!meta && item.notes)) && (
                      <div>
                        <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6b7280", marginBottom: "0.35rem" }}>Description</div>
                        <p style={{ margin: 0, fontSize: "0.875rem", color: "#374151", lineHeight: 1.65, whiteSpace: "pre-line" }}>
                          {meta?.description ?? item.notes}
                        </p>
                      </div>
                    )}

                    {/* Special abilities */}
                    {(item.properties?.length > 0 || meta?.specialAbilities?.length > 0) && (
                      <div>
                        <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6b7280", marginBottom: "0.35rem" }}>Special Abilities</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                          {(meta?.specialAbilities?.length > 0 ? meta.specialAbilities : item.properties).map((p: string) => (
                            <span key={p} style={{ padding: "0.2rem 0.65rem", background: "#ede9fe", color: "#5b21b6", borderRadius: "999px", fontSize: "0.8rem", fontWeight: 600 }}>{p}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Construction */}
                    {meta?.construction?.Requirements && (
                      <div style={{ padding: "0.6rem 0.85rem", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "6px", fontSize: "0.82rem", color: "#92400e" }}>
                        <strong>Construction:</strong> {meta.construction.Requirements}
                        {meta.construction.Cost > 0 && <span> · Cost: {meta.construction.Cost.toLocaleString()} gp</span>}
                      </div>
                    )}

                    {/* Material / masterwork */}
                    {(meta?.material || meta?.isMasterwork) && (
                      <div style={{ fontSize: "0.82rem", color: "#6b7280" }}>
                        {meta.material && <span>⚗️ <strong>Material:</strong> {meta.material} </span>}
                        {meta.isMasterwork && <span>✨ Masterwork</span>}
                      </div>
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
                      <option value="neck">Neck</option>
                      <option value="belt">Belt</option>
                      <option value="feet">Feet</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem", fontSize: "0.9rem" }}>Quantity</label>
                    <input type="number" value={grantsSlotCount} onChange={(e) => setGrantsSlotCount(parseInt(e.target.value) || 0)}
                      min="0" disabled={!grantsSlotType} placeholder="0"
                      style={{ width: "100%", padding: "0.5rem", border: "1px solid #ddd", borderRadius: "6px", fontSize: "0.9rem" }} />
                  </div>
                </div>
                {grantsSlotType && grantsSlotCount > 0 && (
                  <div style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#10b981" }}>
                    💡 When equipped, this item will grant +{grantsSlotCount} {grantsSlotType} slots
                  </div>
                )}
              </div>

              {/* Auto-Apply Stat Bonuses When Equipped */}
              <ItemBonusesEditor itemId={editingArmor?.id || null} onUpdate={onUpdate} sourceTable="armor" />

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

      {showArmorBrowser && (
        <EquipmentBrowser initialCategory="armor" onSelect={handleSelectArmor} onClose={() => setShowArmorBrowser(false)} />
      )}
      {showShieldBrowser && (
        <EquipmentBrowser initialCategory="shields" onSelect={handleSelectShield} onClose={() => setShowShieldBrowser(false)} />
      )}
      {showMagicBrowser && (
        <MagicItemBrowser
          initialTypes={["Magic Armor", "Magic Shield"]}
          onSelect={handleSelectMagicArmorOrShield}
          onClose={() => setShowMagicBrowser(false)}
        />
      )}
    </div>
  );
}
