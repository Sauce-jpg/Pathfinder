"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

interface AddSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  characterId: string;
  statCategory: string;
  statLabel: string;
  editingSource?: {
    id: string;
    source_name: string;
    source_type: string;
    bonus_value: number;
    bonus_type: string;
    obtained_level?: number;
    obtained_notes?: string;
  } | null;
  onSourceAdded: () => void;
}

export function AddSourceModal({
  isOpen,
  onClose,
  characterId,
  statCategory,
  statLabel,
  editingSource,
  onSourceAdded,
}: AddSourceModalProps) {
  const [sourceName, setSourceName] = useState("");
  const [sourceType, setSourceType] = useState<string>("item");
  const [bonusValue, setBonusValue] = useState<number>(1);
  const [bonusType, setBonusType] = useState<string>("enhancement");
  const [obtainedLevel, setObtainedLevel] = useState<number | null>(null);
  const [obtainedNotes, setObtainedNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Load editing source data when modal opens
  useEffect(() => {
    if (editingSource) {
      setSourceName(editingSource.source_name);
      setSourceType(editingSource.source_type);
      setBonusValue(editingSource.bonus_value);
      setBonusType(editingSource.bonus_type);
      setObtainedLevel(editingSource.obtained_level || null);
      setObtainedNotes(editingSource.obtained_notes || "");
    } else {
      // Reset form for new source
      setSourceName("");
      setSourceType("item");
      setBonusValue(1);
      setBonusType("enhancement");
      setObtainedLevel(null);
      setObtainedNotes("");
    }
  }, [editingSource, isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const sourceData = {
      source_name: sourceName,
      source_type: sourceType,
      bonus_value: bonusValue,
      bonus_type: bonusType,
      obtained_level: obtainedLevel,
      obtained_notes: obtainedNotes || null,
    };

    let error;

    if (editingSource) {
      // Update existing source
      const result = await supabase
        .from("character_stat_sources")
        .update(sourceData)
        .eq("id", editingSource.id);
      error = result.error;
    } else {
      // Insert new source
      const result = await supabase.from("character_stat_sources").insert({
        character_id: characterId,
        stat_category: statCategory,
        is_active: true,
        ...sourceData,
      });
      error = result.error;
    }

    if (error) {
      alert("Error adding source: " + error.message);
    } else {
      // Reset form
      setSourceName("");
      setSourceType("item");
      setBonusValue(1);
      setBonusType("enhancement");
      setObtainedLevel(null);
      setObtainedNotes("");
      
      onSourceAdded();
      onClose();
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
          maxWidth: "500px",
          width: "90%",
          maxHeight: "90vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0 }}>
          {editingSource ? `Edit ${statLabel} Source` : `Add Source to ${statLabel}`}
        </h2>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
          {/* Source Name */}
          <div>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
              Source Name *
            </label>
            <input
              type="text"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="e.g., Cloak of Resistance +2"
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

          {/* Source Type */}
          <div>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
              Source Type
            </label>
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "1rem",
              }}
            >
              <option value="class">Class Feature</option>
              <option value="item">Magic Item</option>
              <option value="feat">Feat</option>
              <option value="spell">Spell/Buff</option>
              <option value="racial">Racial Trait</option>
              <option value="ability">Ability Score</option>
              <option value="misc">Miscellaneous</option>
            </select>
          </div>

          {/* Bonus Value and Type */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                Bonus Value *
              </label>
              <input
                type="number"
                value={bonusValue}
                onChange={(e) => setBonusValue(parseInt(e.target.value) || 0)}
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
                Bonus Type
              </label>
              <select
                value={bonusType}
                onChange={(e) => setBonusType(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "1rem",
                }}
              >
                <option value="base">Base</option>
                <option value="ability">Ability</option>
                <option value="enhancement">Enhancement</option>
                <option value="dodge">Dodge</option>
                <option value="deflection">Deflection</option>
                <option value="armor">Armor</option>
                <option value="shield">Shield</option>
                <option value="natural">Natural Armor</option>
                <option value="morale">Morale</option>
                <option value="competence">Competence</option>
                <option value="luck">Luck</option>
                <option value="circumstance">Circumstance</option>
                <option value="resistance">Resistance</option>
                <option value="sacred">Sacred</option>
                <option value="profane">Profane</option>
                <option value="untyped">Untyped</option>
              </select>
            </div>
          </div>

          {/* Obtained Level */}
          <div>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
              Obtained at Level (optional)
            </label>
            <input
              type="number"
              value={obtainedLevel || ""}
              onChange={(e) => setObtainedLevel(e.target.value ? parseInt(e.target.value) : null)}
              placeholder="e.g., 5"
              min="1"
              max="20"
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "1rem",
              }}
            />
          </div>

          {/* Notes */}
          <div>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
              Notes (optional)
            </label>
            <textarea
              value={obtainedNotes}
              onChange={(e) => setObtainedNotes(e.target.value)}
              placeholder="e.g., Found in the dragon's hoard"
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

          {/* Buttons */}
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                flex: 1,
                padding: "0.75rem",
                background: "#10b981",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {saving ? (editingSource ? "Saving..." : "Adding...") : (editingSource ? "Save Changes" : "Add Source")}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: "0.75rem",
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
