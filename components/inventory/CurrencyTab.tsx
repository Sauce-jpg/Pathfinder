"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface CurrencyTabProps {
  characterId: string;
  currency: any;
  onUpdate: () => void;
}

export function CurrencyTab({ characterId, currency, onUpdate }: CurrencyTabProps) {
  const [editing, setEditing] = useState(false);
  const [platinum, setPlatinum] = useState(currency?.platinum || 0);
  const [gold, setGold] = useState(currency?.gold || 0);
  const [silver, setSilver] = useState(currency?.silver || 0);
  const [copper, setCopper] = useState(currency?.copper || 0);
  const [saving, setSaving] = useState(false);

  // Reset form when currency changes
  useState(() => {
    if (currency) {
      setPlatinum(currency.platinum || 0);
      setGold(currency.gold || 0);
      setSilver(currency.silver || 0);
      setCopper(currency.copper || 0);
    }
  });

  async function handleSave() {
    setSaving(true);

    const { error } = await supabase
      .from("character_currency")
      .update({
        platinum: platinum,
        gold: gold,
        silver: silver,
        copper: copper,
      })
      .eq("character_id", characterId);

    if (error) {
      alert("Error saving currency: " + error.message);
    } else {
      setEditing(false);
      onUpdate();
    }

    setSaving(false);
  }

  function handleCancel() {
    setPlatinum(currency?.platinum || 0);
    setGold(currency?.gold || 0);
    setSilver(currency?.silver || 0);
    setCopper(currency?.copper || 0);
    setEditing(false);
  }

  // Calculate total wealth in gold pieces
  const totalGp = (platinum * 10) + gold + (silver / 10) + (copper / 100);

  // Quick adjust functions
  async function quickAdjust(type: string, amount: number) {
    const currentValues = {
      platinum: currency?.platinum || 0,
      gold: currency?.gold || 0,
      silver: currency?.silver || 0,
      copper: currency?.copper || 0,
    };

    const newValue = Math.max(0, currentValues[type as keyof typeof currentValues] + amount);

    await supabase
      .from("character_currency")
      .update({ [type]: newValue })
      .eq("character_id", characterId);

    onUpdate();
  }

  return (
    <div>
      {/* Total Wealth Display */}
      <div
        style={{
          background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
          color: "white",
          borderRadius: "12px",
          padding: "2rem",
          marginBottom: "2rem",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "0.9rem", opacity: 0.9, marginBottom: "0.5rem" }}>Total Wealth</div>
        <div style={{ fontSize: "3rem", fontWeight: 700 }}>{totalGp.toFixed(2)} gp</div>
      </div>

      {/* Currency Management */}
      <div style={{ background: "white", border: "1px solid #ddd", borderRadius: "12px", padding: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <h3 style={{ margin: 0 }}>Currency</h3>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              style={{
                padding: "0.75rem 1.5rem",
                background: "#0070f3",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Edit Currency
            </button>
          )}
        </div>

        <div style={{ display: "grid", gap: "2rem" }}>
          {/* Platinum */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "1.5rem",
              background: "#f9fafb",
              borderRadius: "8px",
              border: "2px solid #e5e7eb",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.5rem",
                }}
              >
                💎
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: "1.1rem" }}>Platinum</div>
                <div style={{ fontSize: "0.85rem", color: "#666" }}>1 pp = 10 gp</div>
              </div>
            </div>

            {editing ? (
              <input
                type="number"
                value={platinum}
                onChange={(e) => setPlatinum(parseInt(e.target.value) || 0)}
                min="0"
                style={{
                  width: "150px",
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "1.5rem",
                  textAlign: "right",
                  fontWeight: 700,
                }}
              />
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <div style={{ fontSize: "2rem", fontWeight: 700 }}>{currency?.platinum || 0}</div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    onClick={() => quickAdjust("platinum", -1)}
                    disabled={!currency?.platinum || currency.platinum === 0}
                    style={{
                      padding: "0.5rem 0.75rem",
                      background: "#ef4444",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "1rem",
                    }}
                  >
                    −
                  </button>
                  <button
                    onClick={() => quickAdjust("platinum", 1)}
                    style={{
                      padding: "0.5rem 0.75rem",
                      background: "#10b981",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "1rem",
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Gold */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "1.5rem",
              background: "#fffbeb",
              borderRadius: "8px",
              border: "2px solid #fbbf24",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.5rem",
                }}
              >
                🪙
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: "1.1rem" }}>Gold</div>
                <div style={{ fontSize: "0.85rem", color: "#666" }}>Base currency</div>
              </div>
            </div>

            {editing ? (
              <input
                type="number"
                value={gold}
                onChange={(e) => setGold(parseInt(e.target.value) || 0)}
                min="0"
                style={{
                  width: "150px",
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "1.5rem",
                  textAlign: "right",
                  fontWeight: 700,
                }}
              />
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <div style={{ fontSize: "2rem", fontWeight: 700 }}>{currency?.gold || 0}</div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    onClick={() => quickAdjust("gold", -1)}
                    disabled={!currency?.gold || currency.gold === 0}
                    style={{
                      padding: "0.5rem 0.75rem",
                      background: "#ef4444",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "1rem",
                    }}
                  >
                    −
                  </button>
                  <button
                    onClick={() => quickAdjust("gold", 1)}
                    style={{
                      padding: "0.5rem 0.75rem",
                      background: "#10b981",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "1rem",
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Silver */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "1.5rem",
              background: "#f9fafb",
              borderRadius: "8px",
              border: "2px solid #d1d5db",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.5rem",
                }}
              >
                ⚪
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: "1.1rem" }}>Silver</div>
                <div style={{ fontSize: "0.85rem", color: "#666" }}>1 sp = 0.1 gp</div>
              </div>
            </div>

            {editing ? (
              <input
                type="number"
                value={silver}
                onChange={(e) => setSilver(parseInt(e.target.value) || 0)}
                min="0"
                style={{
                  width: "150px",
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "1.5rem",
                  textAlign: "right",
                  fontWeight: 700,
                }}
              />
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <div style={{ fontSize: "2rem", fontWeight: 700 }}>{currency?.silver || 0}</div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    onClick={() => quickAdjust("silver", -1)}
                    disabled={!currency?.silver || currency.silver === 0}
                    style={{
                      padding: "0.5rem 0.75rem",
                      background: "#ef4444",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "1rem",
                    }}
                  >
                    −
                  </button>
                  <button
                    onClick={() => quickAdjust("silver", 1)}
                    style={{
                      padding: "0.5rem 0.75rem",
                      background: "#10b981",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "1rem",
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Copper */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "1.5rem",
              background: "#fef2f2",
              borderRadius: "8px",
              border: "2px solid #fca5a5",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #fed7aa 0%, #fdba74 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.5rem",
                }}
              >
                🟤
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: "1.1rem" }}>Copper</div>
                <div style={{ fontSize: "0.85rem", color: "#666" }}>1 cp = 0.01 gp</div>
              </div>
            </div>

            {editing ? (
              <input
                type="number"
                value={copper}
                onChange={(e) => setCopper(parseInt(e.target.value) || 0)}
                min="0"
                style={{
                  width: "150px",
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "1.5rem",
                  textAlign: "right",
                  fontWeight: 700,
                }}
              />
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <div style={{ fontSize: "2rem", fontWeight: 700 }}>{currency?.copper || 0}</div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    onClick={() => quickAdjust("copper", -1)}
                    disabled={!currency?.copper || currency.copper === 0}
                    style={{
                      padding: "0.5rem 0.75rem",
                      background: "#ef4444",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "1rem",
                    }}
                  >
                    −
                  </button>
                  <button
                    onClick={() => quickAdjust("copper", 1)}
                    style={{
                      padding: "0.5rem 0.75rem",
                      background: "#10b981",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "1rem",
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Edit mode buttons */}
        {editing && (
          <div style={{ display: "flex", gap: "1rem", marginTop: "2rem" }}>
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
              onClick={handleCancel}
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
        )}
      </div>

      {/* Conversion Helper */}
      <div
        style={{
          marginTop: "2rem",
          padding: "1.5rem",
          background: "#f0f9ff",
          border: "1px solid #bfdbfe",
          borderRadius: "12px",
        }}
      >
        <h4 style={{ marginTop: 0, marginBottom: "1rem" }}>💡 Conversion Guide</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", fontSize: "0.9rem" }}>
          <div>1 platinum = 10 gold</div>
          <div>1 gold = 10 silver</div>
          <div>1 silver = 10 copper</div>
          <div>1 platinum = 100 silver</div>
          <div>1 platinum = 1,000 copper</div>
          <div>1 gold = 100 copper</div>
        </div>
      </div>
    </div>
  );
}
