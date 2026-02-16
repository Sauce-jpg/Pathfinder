"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface AddCustomSkillModalProps {
  characterId: string;
  isOpen: boolean;
  onClose: () => void;
  onSkillAdded: () => void;
}

const SKILL_TEMPLATES = {
  craft: {
    name: "Craft",
    ability: "INT",
    trained_only: false,
    armor_check_penalty: false,
    common_specialties: [
      "Alchemy",
      "Armor",
      "Baskets",
      "Books",
      "Bows",
      "Calligraphy",
      "Carpentry",
      "Cloth",
      "Clothing",
      "Glass",
      "Jewelry",
      "Leather",
      "Locks",
      "Paintings",
      "Pottery",
      "Sculptures",
      "Ships",
      "Shoes",
      "Stonemasonry",
      "Traps",
      "Weapons",
    ],
  },
  perform: {
    name: "Perform",
    ability: "CHA",
    trained_only: false,
    armor_check_penalty: false,
    common_specialties: [
      "Act",
      "Comedy",
      "Dance",
      "Keyboard instruments",
      "Oratory",
      "Percussion instruments",
      "Sing",
      "String instruments",
      "Wind instruments",
    ],
  },
  profession: {
    name: "Profession",
    ability: "WIS",
    trained_only: true,
    armor_check_penalty: false,
    common_specialties: [
      "Accountant",
      "Alchemist",
      "Architect",
      "Baker",
      "Barrister",
      "Brewer",
      "Butcher",
      "Clerk",
      "Cook",
      "Courtesan",
      "Driver",
      "Engineer",
      "Farmer",
      "Fisherman",
      "Gambler",
      "Gardener",
      "Herbalist",
      "Innkeeper",
      "Librarian",
      "Merchant",
      "Midwife",
      "Miller",
      "Miner",
      "Porter",
      "Sailor",
      "Scribe",
      "Shepherd",
      "Soldier",
      "Stable master",
      "Tanner",
      "Trapper",
      "Woodcutter",
    ],
  },
};

export function AddCustomSkillModal({
  characterId,
  isOpen,
  onClose,
  onSkillAdded,
}: AddCustomSkillModalProps) {
  const [skillType, setSkillType] = useState<"craft" | "perform" | "profession">("craft");
  const [specialty, setSpecialty] = useState("");
  const [customSpecialty, setCustomSpecialty] = useState("");
  const [isClassSkill, setIsClassSkill] = useState(false);
  const [ranks, setRanks] = useState(0);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const template = SKILL_TEMPLATES[skillType];
  const finalSpecialty = specialty === "custom" ? customSpecialty : specialty;
  const fullSkillName = `${template.name} (${finalSpecialty})`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!finalSpecialty) {
      alert("Please select or enter a specialty");
      return;
    }

    setSaving(true);

    // Create the custom skill
    const { error } = await supabase.from("character_skills").insert({
      character_id: characterId,
      skill_name: fullSkillName,
      ability: template.ability,
      ranks: ranks,
      is_class_skill: isClassSkill,
      trained_only: template.trained_only,
      armor_check_penalty: template.armor_check_penalty,
    });

    if (error) {
      alert("Error adding skill: " + error.message);
    } else {
      onSkillAdded();
      onClose();
      // Reset form
      setSpecialty("");
      setCustomSpecialty("");
      setIsClassSkill(false);
      setRanks(0);
    }

    setSaving(false);
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
          maxWidth: "600px",
          width: "90%",
          maxHeight: "90vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0 }}>Add Custom Skill</h2>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
          {/* Skill Type */}
          <div>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
              Skill Type *
            </label>
            <select
              value={skillType}
              onChange={(e) => {
                setSkillType(e.target.value as any);
                setSpecialty("");
                setCustomSpecialty("");
              }}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "1rem",
              }}
            >
              <option value="craft">Craft (INT)</option>
              <option value="perform">Perform (CHA)</option>
              <option value="profession">Profession (WIS, Trained Only)</option>
            </select>
          </div>

          {/* Specialty */}
          <div>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
              Specialty *
            </label>
            <select
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "1rem",
              }}
            >
              <option value="">Select a specialty...</option>
              {template.common_specialties.map((spec) => (
                <option key={spec} value={spec}>
                  {spec}
                </option>
              ))}
              <option value="custom">-- Custom --</option>
            </select>
          </div>

          {/* Custom Specialty */}
          {specialty === "custom" && (
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                Custom Specialty *
              </label>
              <input
                type="text"
                value={customSpecialty}
                onChange={(e) => setCustomSpecialty(e.target.value)}
                placeholder="e.g., Clockwork Mechanisms"
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

          {/* Preview */}
          {finalSpecialty && (
            <div
              style={{
                padding: "1rem",
                background: "#f0f9ff",
                border: "1px solid #bfdbfe",
                borderRadius: "8px",
              }}
            >
              <strong>Full Skill Name:</strong> {fullSkillName}
              <br />
              <strong>Ability:</strong> {template.ability}
              {template.trained_only && (
                <>
                  <br />
                  <strong>⚠️ Trained Only</strong>
                </>
              )}
            </div>
          )}

          {/* Ranks */}
          <div>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
              Starting Ranks
            </label>
            <input
              type="number"
              value={ranks}
              onChange={(e) => setRanks(parseInt(e.target.value) || 0)}
              min="0"
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "1rem",
              }}
            />
          </div>

          {/* Class Skill */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <input
              type="checkbox"
              checked={isClassSkill}
              onChange={(e) => setIsClassSkill(e.target.checked)}
              style={{ width: "20px", height: "20px", cursor: "pointer" }}
            />
            <label style={{ fontWeight: 600, cursor: "pointer" }} onClick={() => setIsClassSkill(!isClassSkill)}>
              This is a class skill for me
            </label>
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
            <button
              type="submit"
              disabled={saving || !finalSpecialty}
              style={{
                flex: 1,
                padding: "0.75rem",
                background: "#10b981",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: 600,
                opacity: !finalSpecialty ? 0.5 : 1,
              }}
            >
              {saving ? "Adding..." : "Add Skill"}
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
