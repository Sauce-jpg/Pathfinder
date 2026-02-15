"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface ManageSlotsModalProps {
  characterId: string;
  slots: any[];
  onClose: () => void;
  onUpdate: () => void;
}

export function ManageSlotsModal({ characterId, slots, onClose, onUpdate }: ManageSlotsModalProps) {
  const [editingSlots, setEditingSlots] = useState<any>(
    slots.reduce((acc, slot) => {
      acc[slot.slot_name] = {
        count: slot.base_slot_count,
        displayName: slot.slot_display_name,
        isHouserule: slot.is_houserule,
      };
      return acc;
    }, {})
  );
  const [saving, setSaving] = useState(false);

  function updateSlotCount(slotName: string, newCount: number) {
    setEditingSlots({
      ...editingSlots,
      [slotName]: {
        ...editingSlots[slotName],
        count: Math.max(1, newCount),
      },
    });
  }

  function toggleHouserule(slotName: string) {
    setEditingSlots({
      ...editingSlots,
      [slotName]: {
        ...editingSlots[slotName],
        isHouserule: !editingSlots[slotName].isHouserule,
      },
    });
  }

  async function handleSave() {
    setSaving(true);

    for (const [slotName, data] of Object.entries(editingSlots) as any) {
      await supabase
        .from("character_equipment_slots")
        .update({
          slot_count: data.count,
          is_houserule: data.isHouserule,
        })
        .eq("character_id", characterId)
        .eq("slot_name", slotName);
    }

    setSaving(false);
    onUpdate();
    onClose();
  }

  async function resetToDefaults() {
    if (!confirm("Reset all slots to Pathfinder defaults? This will clear houserule flags.")) return;

    const defaults: any = {
      head: 1,
      headband: 1,
      eyes: 1,
      neck: 1,
      shoulders: 1,
      body: 1,
      chest: 1,
      belt: 1,
      wrists: 1,
      hands: 1,
      ring: 2,
      feet: 1,
      slotless: 999,
    };

    for (const [slotName, count] of Object.entries(defaults)) {
      await supabase
        .from("character_equipment_slots")
        .update({
          slot_count: count,
          is_houserule: false,
        })
        .eq("character_id", characterId)
        .eq("slot_name", slotName);
    }

    onUpdate();
    onClose();
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
        <h2 style={{ marginTop: 0 }}>⚙️ Manage Equipment Slots</h2>

        <div style={{ marginBottom: "1.5rem", padding: "1rem", background: "#f0f9ff", borderRadius: "8px", fontSize: "0.9rem" }}>
          <strong>💡 Tip:</strong> Customize your equipment slots here. Mark slots as "Houserule" if they differ from standard Pathfinder rules.
        </div>

        {/* Slots Table */}
        <div style={{ marginBottom: "2rem" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #ddd" }}>
                <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 600 }}>Slot Name</th>
                <th style={{ padding: "0.75rem", textAlign: "center", fontWeight: 600 }}>Count</th>
                <th style={{ padding: "0.75rem", textAlign: "center", fontWeight: 600 }}>Houserule?</th>
              </tr>
            </thead>
            <tbody>
              {slots
                .filter(slot => slot.slot_name !== 'slotless') // Don't show slotless in this list
                .map((slot) => (
                  <tr key={slot.slot_name} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "0.75rem" }}>
                      <strong>{editingSlots[slot.slot_name]?.displayName}</strong>
                    </td>
                    <td style={{ padding: "0.75rem", textAlign: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                        <button
                          onClick={() => updateSlotCount(slot.slot_name, editingSlots[slot.slot_name].count - 1)}
                          disabled={editingSlots[slot.slot_name].count <= 1}
                          style={{
                            padding: "0.25rem 0.5rem",
                            background: "#ef4444",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "0.9rem",
                          }}
                        >
                          −
                        </button>
                        <span style={{ minWidth: "40px", textAlign: "center", fontWeight: 600 }}>
                          {editingSlots[slot.slot_name]?.count}
                        </span>
                        <button
                          onClick={() => updateSlotCount(slot.slot_name, editingSlots[slot.slot_name].count + 1)}
                          style={{
                            padding: "0.25rem 0.5rem",
                            background: "#10b981",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "0.9rem",
                          }}
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: "0.75rem", textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={editingSlots[slot.slot_name]?.isHouserule}
                        onChange={() => toggleHouserule(slot.slot_name)}
                        style={{ width: "20px", height: "20px", cursor: "pointer" }}
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Bonus Slots Warning */}
        {slots.some(s => s.bonus_slot_count > 0) && (
          <div style={{ marginBottom: "1.5rem", padding: "1rem", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "8px", fontSize: "0.9rem" }}>
            <strong>✨ Bonus Slots Active:</strong>
            {slots
              .filter(s => s.bonus_slot_count > 0)
              .map(s => (
                <div key={s.slot_name} style={{ marginTop: "0.25rem" }}>
                  • {s.slot_display_name}: +{s.bonus_slot_count} from equipped items
                </div>
              ))}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            onClick={handleSave}
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
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button
            onClick={resetToDefaults}
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
            Reset to Defaults
          </button>
          <button
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
      </div>
    </div>
  );
}
