// components/StatWithSources.tsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

interface StatSource {
  id: string;
  source_name: string;
  source_type: string;
  bonus_value: number;
  bonus_type: string;
  obtained_level?: number;
  obtained_notes?: string;
  is_active: boolean;
}

interface StatWithSourcesProps {
  characterId: string;
  statCategory: string; // e.g., 'save_fort', 'ac', 'skill_perception'
  displayValue: number;
  label: string; // e.g., 'Fortitude Save', 'AC'
  editable?: boolean;
}

export function StatWithSources({
  characterId,
  statCategory,
  displayValue,
  label,
  editable = false,
}: StatWithSourcesProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [sources, setSources] = useState<StatSource[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (showTooltip || showEditor) {
      loadSources();
    }
  }, [showTooltip, showEditor]);

  async function loadSources() {
    setLoading(true);
    const { data } = await supabase
      .from("character_stat_sources")
      .select("*")
      .eq("character_id", characterId)
      .eq("stat_category", statCategory)
      .order("bonus_value", { ascending: false });

    setSources(data || []);
    setLoading(false);
  }

  async function toggleSource(sourceId: string, isActive: boolean) {
    await supabase
      .from("character_stat_sources")
      .update({ is_active: !isActive })
      .eq("id", sourceId);

    loadSources();
  }

  async function deleteSource(sourceId: string) {
    if (!confirm("Delete this bonus source?")) return;

    await supabase
      .from("character_stat_sources")
      .delete()
      .eq("id", sourceId);

    loadSources();
  }

  const activeSources = sources.filter((s) => s.is_active);
  const inactiveSources = sources.filter((s) => !s.is_active);
  const calculatedTotal = activeSources.reduce((sum, s) => sum + s.bonus_value, 0);

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {/* The stat display */}
      <div
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => editable && setShowEditor(true)}
        style={{
          cursor: editable ? "pointer" : "default",
          borderBottom: sources.length > 0 ? "2px dotted #0070f3" : "none",
          paddingBottom: "2px",
        }}
        title={sources.length > 0 ? "Click to manage sources" : undefined}
      >
        {displayValue}
      </div>

      {/* Hover Tooltip */}
      {showTooltip && !showEditor && sources.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginTop: "0.5rem",
            background: "white",
            border: "2px solid #0070f3",
            borderRadius: "8px",
            padding: "1rem",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 1000,
            minWidth: "250px",
            maxWidth: "400px",
          }}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <div style={{ fontWeight: 600, marginBottom: "0.75rem", color: "#0070f3" }}>
            {label} Breakdown
          </div>

          {loading ? (
            <div style={{ fontSize: "0.9rem", color: "#999" }}>Loading...</div>
          ) : (
            <>
              {activeSources.map((source) => (
                <div
                  key={source.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "0.5rem 0",
                    borderBottom: "1px solid #f0f0f0",
                    fontSize: "0.9rem",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500 }}>{source.source_name}</div>
                    {source.obtained_level && (
                      <div style={{ fontSize: "0.8rem", color: "#999" }}>
                        Level {source.obtained_level}
                      </div>
                    )}
                  </div>
                  <div style={{ fontWeight: 600, color: source.bonus_value >= 0 ? "#10b981" : "#ef4444" }}>
                    {source.bonus_value >= 0 ? "+" : ""}{source.bonus_value}
                  </div>
                </div>
              ))}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: "0.75rem",
                  paddingTop: "0.75rem",
                  borderTop: "2px solid #0070f3",
                  fontWeight: 700,
                }}
              >
                <div>Total</div>
                <div style={{ color: "#0070f3" }}>{calculatedTotal}</div>
              </div>

              {editable && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowEditor(true);
                    setShowTooltip(false);
                  }}
                  style={{
                    marginTop: "0.75rem",
                    width: "100%",
                    padding: "0.5rem",
                    background: "#0070f3",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                  }}
                >
                  Manage Sources
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
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
            zIndex: 2000,
          }}
          onClick={() => setShowEditor(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "2rem",
              maxWidth: "600px",
              width: "90%",
              maxHeight: "80vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0 }}>Manage {label} Sources</h2>

            {loading ? (
              <p>Loading...</p>
            ) : (
              <>
                {/* Active Sources */}
                <div style={{ marginBottom: "2rem" }}>
                  <h3>Active Bonuses</h3>
                  {activeSources.length === 0 ? (
                    <p style={{ color: "#999" }}>No sources yet</p>
                  ) : (
                    <div style={{ display: "grid", gap: "0.75rem" }}>
                      {activeSources.map((source) => (
                        <div
                          key={source.id}
                          style={{
                            padding: "1rem",
                            background: "#f9fafb",
                            borderRadius: "8px",
                            border: "1px solid #e5e7eb",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600 }}>{source.source_name}</div>
                              <div style={{ fontSize: "0.85rem", color: "#666", marginTop: "0.25rem" }}>
                                {source.source_type} • {source.bonus_type} bonus
                                {source.obtained_level && ` • Level ${source.obtained_level}`}
                              </div>
                              {source.obtained_notes && (
                                <div style={{ fontSize: "0.85rem", color: "#999", marginTop: "0.25rem" }}>
                                  {source.obtained_notes}
                                </div>
                              )}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginLeft: "1rem" }}>
                              <div style={{ fontSize: "1.2rem", fontWeight: 700, color: source.bonus_value >= 0 ? "#10b981" : "#ef4444" }}>
                                {source.bonus_value >= 0 ? "+" : ""}{source.bonus_value}
                              </div>
                              <button
                                onClick={() => toggleSource(source.id, source.is_active)}
                                style={{
                                  padding: "0.25rem 0.5rem",
                                  background: "#fbbf24",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                  fontSize: "0.8rem",
                                }}
                              >
                                Disable
                              </button>
                              <button
                                onClick={() => deleteSource(source.id)}
                                style={{
                                  padding: "0.25rem 0.5rem",
                                  background: "#ef4444",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                  fontSize: "0.8rem",
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
                </div>

                {/* Inactive Sources */}
                {inactiveSources.length > 0 && (
                  <div style={{ marginBottom: "2rem" }}>
                    <h3>Disabled Bonuses</h3>
                    <div style={{ display: "grid", gap: "0.75rem" }}>
                      {inactiveSources.map((source) => (
                        <div
                          key={source.id}
                          style={{
                            padding: "1rem",
                            background: "#f3f4f6",
                            borderRadius: "8px",
                            border: "1px solid #d1d5db",
                            opacity: 0.6,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div style={{ fontWeight: 600 }}>{source.source_name}</div>
                              <div style={{ fontSize: "0.85rem", color: "#666" }}>
                                {source.bonus_value >= 0 ? "+" : ""}{source.bonus_value}
                              </div>
                            </div>
                            <button
                              onClick={() => toggleSource(source.id, source.is_active)}
                              style={{
                                padding: "0.25rem 0.5rem",
                                background: "#10b981",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "0.8rem",
                              }}
                            >
                              Enable
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Total */}
                <div
                  style={{
                    padding: "1rem",
                    background: "#dbeafe",
                    borderRadius: "8px",
                    display: "flex",
                    justifyContent: "space-between",
                    fontWeight: 700,
                    fontSize: "1.1rem",
                  }}
                >
                  <div>Total {label}</div>
                  <div style={{ color: "#0070f3" }}>{calculatedTotal}</div>
                </div>

                <button
                  onClick={() => setShowEditor(false)}
                  style={{
                    marginTop: "1.5rem",
                    width: "100%",
                    padding: "0.75rem",
                    background: "#eee",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
