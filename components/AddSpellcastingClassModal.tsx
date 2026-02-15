"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface AddSpellcastingClassModalProps {
  characterId: string;
  characterLevel: number;
  abilityMods: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
  isOpen: boolean;
  onClose: () => void;
  onClassAdded: () => void;
}

// Spell slots per day by class and level (simplified - you can expand this)
const SPELL_SLOTS_BY_CLASS: any = {
  // Full casters (9th level spells)
  Oracle: {
    1: [999, 4],
    2: [999, 5],
    3: [999, 6],
    4: [999, 6, 3],
    5: [999, 6, 4],
    6: [999, 6, 5, 3],
    7: [999, 6, 6, 4],
    8: [999, 6, 6, 5, 3],
    9: [999, 6, 6, 6, 4],
    10: [999, 6, 6, 6, 5, 3],
    11: [999, 6, 6, 6, 6, 4],
    12: [999, 6, 6, 6, 6, 5, 3],
    13: [999, 6, 6, 6, 6, 6, 4],
    14: [999, 6, 6, 6, 6, 6, 5, 3],
    15: [999, 6, 6, 6, 6, 6, 6, 4],
    16: [999, 6, 6, 6, 6, 6, 6, 5, 3],
    17: [999, 6, 6, 6, 6, 6, 6, 6, 4],
    18: [999, 6, 6, 6, 6, 6, 6, 6, 5, 3],
    19: [999, 6, 6, 6, 6, 6, 6, 6, 6, 4],
    20: [999, 6, 6, 6, 6, 6, 6, 6, 6, 6],
  },
  Wizard: {
    1: [999, 3],
    2: [999, 4],
    3: [999, 4, 2],
    4: [999, 4, 3],
    5: [999, 4, 3, 2],
    6: [999, 4, 4, 3],
    7: [999, 4, 4, 3, 2],
    8: [999, 4, 4, 4, 3],
    9: [999, 4, 4, 4, 3, 2],
    10: [999, 4, 4, 4, 4, 3],
    11: [999, 4, 4, 4, 4, 3, 2],
    12: [999, 4, 4, 4, 4, 4, 3],
    13: [999, 4, 4, 4, 4, 4, 3, 2],
    14: [999, 4, 4, 4, 4, 4, 4, 3],
    15: [999, 4, 4, 4, 4, 4, 4, 3, 2],
    16: [999, 4, 4, 4, 4, 4, 4, 4, 3],
    17: [999, 4, 4, 4, 4, 4, 4, 4, 3, 2],
    18: [999, 4, 4, 4, 4, 4, 4, 4, 4, 3],
    19: [999, 4, 4, 4, 4, 4, 4, 4, 4, 4],
    20: [999, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  },
  Cleric: {
    1: [999, 3],
    2: [999, 4],
    3: [999, 4, 2],
    4: [999, 4, 3],
    5: [999, 4, 3, 2],
    6: [999, 4, 4, 3],
    7: [999, 4, 4, 3, 2],
    8: [999, 4, 4, 4, 3],
    9: [999, 4, 4, 4, 3, 2],
    10: [999, 4, 4, 4, 4, 3],
    11: [999, 4, 4, 4, 4, 3, 2],
    12: [999, 4, 4, 4, 4, 4, 3],
    13: [999, 4, 4, 4, 4, 4, 3, 2],
    14: [999, 4, 4, 4, 4, 4, 4, 3],
    15: [999, 4, 4, 4, 4, 4, 4, 3, 2],
    16: [999, 4, 4, 4, 4, 4, 4, 4, 3],
    17: [999, 4, 4, 4, 4, 4, 4, 4, 3, 2],
    18: [999, 4, 4, 4, 4, 4, 4, 4, 4, 3],
    19: [999, 4, 4, 4, 4, 4, 4, 4, 4, 4],
    20: [999, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  },
};

export function AddSpellcastingClassModal({
  characterId,
  characterLevel,
  abilityMods,
  isOpen,
  onClose,
  onClassAdded,
}: AddSpellcastingClassModalProps) {
  const [className, setClassName] = useState("Oracle");
  const [castingType, setCastingType] = useState<"spontaneous" | "prepared">("spontaneous");
  const [spellcastingAbility, setSpellcastingAbility] = useState("CHA");
  const [casterLevel, setCasterLevel] = useState(1);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const abilityMod = abilityMods[spellcastingAbility.toLowerCase() as keyof typeof abilityMods];

    // 1. Create the spellcasting class
    const { data: classData, error: classError } = await supabase
      .from("character_spellcasting_classes")
      .insert({
        character_id: characterId,
        class_name: className,
        casting_type: castingType,
        spellcasting_ability: spellcastingAbility,
        caster_level: casterLevel,
        concentration_bonus: casterLevel + abilityMod,
        base_spell_dc: 10,
        notes: notes || null,
      })
      .select()
      .single();

    if (classError) {
      alert("Error creating class: " + classError.message);
      setSaving(false);
      return;
    }

    // 2. Create spell slots based on class and caster level
    const baseSlots = SPELL_SLOTS_BY_CLASS[className]?.[casterLevel] || [999, 3];
    const slotsToCreate = baseSlots.map((slots: number, level: number) => ({
      character_id: characterId,
      spellcasting_class_id: classData.id,
      spell_level: level,
      slots_total: slots,
      slots_used: 0,
    }));

    const { error: slotsError } = await supabase
      .from("character_spell_slots")
      .insert(slotsToCreate);

    if (slotsError) {
      alert("Error creating spell slots: " + slotsError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    onClassAdded();
  }

  // Update casting type and ability when class changes
  function handleClassChange(newClass: string) {
    setClassName(newClass);

    // Set defaults based on class
    switch (newClass) {
      case "Oracle":
        setCastingType("spontaneous");
        setSpellcastingAbility("CHA");
        break;
      case "Wizard":
        setCastingType("prepared");
        setSpellcastingAbility("INT");
        break;
      case "Cleric":
        setCastingType("prepared");
        setSpellcastingAbility("WIS");
        break;
      case "Sorcerer":
        setCastingType("spontaneous");
        setSpellcastingAbility("CHA");
        break;
      case "Druid":
        setCastingType("prepared");
        setSpellcastingAbility("WIS");
        break;
      case "Bard":
        setCastingType("spontaneous");
        setSpellcastingAbility("CHA");
        break;
    }
  }

  return (
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
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          borderRadius: "12px",
          padding: "2rem",
          maxWidth: "500px",
          width: "90%",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0 }}>Add Spellcasting Class</h2>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
          {/* Class Name */}
          <div>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
              Class *
            </label>
            <select
              value={className}
              onChange={(e) => handleClassChange(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "1rem",
              }}
            >
              <option value="Oracle">Oracle</option>
              <option value="Wizard">Wizard</option>
              <option value="Cleric">Cleric</option>
              <option value="Sorcerer">Sorcerer</option>
              <option value="Druid">Druid</option>
              <option value="Bard">Bard</option>
              <option value="Other">Other (Custom)</option>
            </select>
          </div>

          {/* Casting Type */}
          <div>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
              Casting Type *
            </label>
            <select
              value={castingType}
              onChange={(e) => setCastingType(e.target.value as any)}
              required
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "1rem",
              }}
            >
              <option value="spontaneous">Spontaneous (Oracle, Sorcerer)</option>
              <option value="prepared">Prepared (Wizard, Cleric)</option>
            </select>
          </div>

          {/* Spellcasting Ability */}
          <div>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
              Spellcasting Ability *
            </label>
            <select
              value={spellcastingAbility}
              onChange={(e) => setSpellcastingAbility(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "1rem",
              }}
            >
              <option value="CHA">CHA (Charisma)</option>
              <option value="INT">INT (Intelligence)</option>
              <option value="WIS">WIS (Wisdom)</option>
            </select>
          </div>

          {/* Caster Level */}
          <div>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
              Caster Level *
            </label>
            <input
              type="number"
              value={casterLevel}
              onChange={(e) => setCasterLevel(parseInt(e.target.value) || 1)}
              min="1"
              max="20"
              required
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "1rem",
              }}
            />
            <div style={{ fontSize: "0.85rem", color: "#666", marginTop: "0.25rem" }}>
              Usually equals class level (e.g., Oracle 11 = CL 11)
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
              Notes (optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Bones Mystery, Necromancy School"
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "1rem",
              }}
            />
          </div>

          {/* Info Box */}
          <div
            style={{
              background: "#f0fdf4",
              border: "1px solid #86efac",
              borderRadius: "8px",
              padding: "1rem",
              fontSize: "0.9rem",
            }}
          >
            <strong>📋 What will be created:</strong>
            <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.5rem" }}>
              <li>
                {className} class (CL {casterLevel})
              </li>
              <li>
                Spell DC: 10 + spell level + {abilityMods[spellcastingAbility.toLowerCase() as keyof typeof abilityMods]}
              </li>
              <li>
                Spell slots for levels 0-{SPELL_SLOTS_BY_CLASS[className]?.[casterLevel]?.length - 1 || 1}
              </li>
            </ul>
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                flex: 1,
                padding: "0.75rem",
                background: "#8b5cf6",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {saving ? "Creating..." : "Create Class"}
            </button>
            <button
              type="button"
              onClick={onClose}
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
  );
}
