"use client";

import { useState } from "react";

interface SpellCardProps {
  spell: {
    id: string;
    spell_name: string;
    spell_level: number;
    school: string;
    spell_data: any;
    source: string;
  };
  onRemove: () => void;
  onPrepare?: () => void;
  spellDC: number;
}

export function SpellCard({ spell, onRemove, onPrepare, spellDC }: SpellCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const spellData = spell.spell_data || {};

  return (
    <div
      style={{
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        padding: "0.75rem",
      }}
    >
      {/* Collapsed View */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ flex: 1, cursor: "pointer" }} onClick={() => setShowDetails(!showDetails)}>
          <div style={{ fontWeight: 600, color: "#8b5cf6" }}>{spell.spell_name}</div>
          <div style={{ fontSize: "0.85rem", color: "#666", marginTop: "0.25rem" }}>
            {spell.school} • DC {spellDC}
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          {onPrepare && (
            <button
              onClick={onPrepare}
              style={{
                padding: "0.25rem 0.75rem",
                background: "#10b981",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "0.85rem",
              }}
            >
              Prepare
            </button>
          )}
          <button
            onClick={() => setShowDetails(!showDetails)}
            style={{
              padding: "0.25rem 0.75rem",
              background: "#0070f3",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            {showDetails ? "Hide" : "Details"}
          </button>
          <button
            onClick={onRemove}
            style={{
              padding: "0.25rem 0.75rem",
              background: "#ef4444",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            Remove
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {showDetails && (
        <div
          style={{
            marginTop: "1rem",
            paddingTop: "1rem",
            borderTop: "1px solid #ddd",
            fontSize: "0.9rem",
          }}
        >
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {spellData.casting_time && (
              <div>
                <strong>Casting Time:</strong> {spellData.casting_time}
              </div>
            )}

            {spellData.components && (
              <div>
                <strong>Components:</strong>{" "}
                {[
                  spellData.components.verbal && "V",
                  spellData.components.somatic && "S",
                  spellData.components.material && "M",
                  spellData.components.focus && "F",
                  spellData.components.divine_focus && "DF",
                ]
                  .filter(Boolean)
                  .join(", ")}
                {spellData.components.material_text && ` (${spellData.components.material_text})`}
              </div>
            )}

            {spellData.range && (
              <div>
                <strong>Range:</strong> {spellData.range}
              </div>
            )}

            {spellData.targets && (
              <div>
                <strong>Target:</strong> {spellData.targets}
              </div>
            )}

            {spellData.area && (
              <div>
                <strong>Area:</strong> {spellData.area}
              </div>
            )}

            {spellData.duration && (
              <div>
                <strong>Duration:</strong> {spellData.duration}
              </div>
            )}

            {spellData.saving_throw && (
              <div>
                <strong>Saving Throw:</strong> {spellData.saving_throw}
              </div>
            )}

            {spellData.spell_resistance && (
              <div>
                <strong>Spell Resistance:</strong> {spellData.spell_resistance}
              </div>
            )}

            {spellData.description && (
              <div>
                <strong>Description:</strong>
                <div style={{ marginTop: "0.5rem", lineHeight: 1.6, color: "#333" }}>
                  {spellData.description}
                </div>
              </div>
            )}

            {spellData.url && (
              <div>
                <a
                  href={spellData.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#8b5cf6", textDecoration: "none" }}
                >
                  View on d20PFSRD →
                </a>
              </div>
            )}

            <div style={{ fontSize: "0.85rem", color: "#999", marginTop: "0.5rem" }}>
              <strong>Source:</strong> {spell.source}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
