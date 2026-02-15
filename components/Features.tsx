"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { FeatBrowser } from "./FeatBrowser";
import { TraitBrowser } from "./TraitBrowser";

interface Feature {
  id: string;
  feature_type: string;
  name: string;
  description: string;
  source: string;
  category: string;
  subcategory: string;
  obtained_level: number;
  obtained_date: string;
  obtained_notes: string;
  prerequisites: string;
  uses_per_day: number;
  uses_remaining: number;
  is_active: boolean;
}

interface FeaturesProps {
  characterId: string;
  characterLevel: number;
}

const FEATURE_TYPE_INFO = {
  feat: { label: "Feats", color: "#0070f3", emoji: "⚔️" },
  trait: { label: "Traits", color: "#10b981", emoji: "✨" },
  racial: { label: "Racial Abilities", color: "#8b5cf6", emoji: "🧬" },
  class: { label: "Class Features", color: "#f59e0b", emoji: "📜" },
  special: { label: "Special Abilities", color: "#ef4444", emoji: "⭐" },
};

export function Features({ characterId, characterLevel }: FeaturesProps) {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("feat");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingFeature, setEditingFeature] = useState<Feature | null>(null);
  const [showFeatBrowser, setShowFeatBrowser] = useState(false);
  const [showTraitBrowser, setShowTraitBrowser] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formSource, setFormSource] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formPrerequisites, setFormPrerequisites] = useState("");
  const [formObtainedLevel, setFormObtainedLevel] = useState("");
  const [formObtainedNotes, setFormObtainedNotes] = useState("");
  const [formUsesPerDay, setFormUsesPerDay] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadFeatures();
  }, [characterId]);

  async function loadFeatures() {
    setLoading(true);
    const { data } = await supabase
      .from("character_features")
      .select("*")
      .eq("character_id", characterId)
      .order("obtained_level", { ascending: true });

    setFeatures((data || []) as Feature[]);
    setLoading(false);
  }

  function openAddModal(featureType: string) {
    setEditingFeature(null);
    setActiveTab(featureType);
    resetForm();
    setShowAddModal(true);
  }

  function openEditModal(feature: Feature) {
    setEditingFeature(feature);
    setFormName(feature.name);
    setFormDescription(feature.description || "");
    setFormSource(feature.source || "");
    setFormCategory(feature.category || "");
    setFormPrerequisites(feature.prerequisites || "");
    setFormObtainedLevel(feature.obtained_level?.toString() || "");
    setFormObtainedNotes(feature.obtained_notes || "");
    setFormUsesPerDay(feature.uses_per_day?.toString() || "");
    setShowAddModal(true);
  }

  function resetForm() {
    setFormName("");
    setFormDescription("");
    setFormSource("");
    setFormCategory("");
    setFormPrerequisites("");
    setFormObtainedLevel("");
    setFormObtainedNotes("");
    setFormUsesPerDay("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const featureData = {
      feature_type: activeTab,
      name: formName,
      description: formDescription || null,
      source: formSource || null,
      category: formCategory || null,
      prerequisites: formPrerequisites || null,
      obtained_level: formObtainedLevel ? parseInt(formObtainedLevel) : null,
      obtained_notes: formObtainedNotes || null,
      uses_per_day: formUsesPerDay ? parseInt(formUsesPerDay) : null,
      uses_remaining: formUsesPerDay ? parseInt(formUsesPerDay) : null,
      is_active: true,
    };

    let error;

    if (editingFeature) {
      const result = await supabase
        .from("character_features")
        .update(featureData)
        .eq("id", editingFeature.id);
      error = result.error;
    } else {
      const result = await supabase.from("character_features").insert({
        character_id: characterId,
        ...featureData,
      });
      error = result.error;
    }

    if (error) {
      alert("Error saving feature: " + error.message);
    } else {
      setShowAddModal(false);
      resetForm();
      loadFeatures();
    }

    setSaving(false);
  }

  async function toggleFeature(featureId: string, currentState: boolean) {
    await supabase
      .from("character_features")
      .update({ is_active: !currentState })
      .eq("id", featureId);
    loadFeatures();
  }

  async function deleteFeature(featureId: string) {
    if (!confirm("Delete this feature?")) return;
    await supabase.from("character_features").delete().eq("id", featureId);
    loadFeatures();
  }

  async function resetUses(featureId: string, maxUses: number) {
    await supabase
      .from("character_features")
      .update({ uses_remaining: maxUses })
      .eq("id", featureId);
    loadFeatures();
  }

  async function adjustUses(featureId: string, currentUses: number, delta: number) {
    const newUses = Math.max(0, currentUses + delta);
    await supabase
      .from("character_features")
      .update({ uses_remaining: newUses })
      .eq("id", featureId);
    loadFeatures();
  }

  const featuresByType = features.filter((f) => f.feature_type === activeTab);
  const activeFeatures = featuresByType.filter((f) => f.is_active);
  const inactiveFeatures = featuresByType.filter((f) => !f.is_active);

  if (loading) {
    return <div style={{ padding: "2rem", textAlign: "center" }}>Loading features...</div>;
  }

  return (
    <div>
      {/* Type Tabs */}
      <div style={{ borderBottom: "2px solid #ddd", marginBottom: "2rem" }}>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          {Object.entries(FEATURE_TYPE_INFO).map(([type, info]) => {
            const count = features.filter((f) => f.feature_type === type && f.is_active).length;
            return (
              <button
                key={type}
                onClick={() => setActiveTab(type)}
                style={{
                  padding: "0.75rem 1.5rem",
                  background: activeTab === type ? info.color : "transparent",
                  color: activeTab === type ? "white" : info.color,
                  border: `2px solid ${info.color}`,
                  borderBottom: activeTab === type ? "none" : `2px solid ${info.color}`,
                  borderRadius: "8px 8px 0 0",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "0.95rem",
                }}
              >
                {info.emoji} {info.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Add Button */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <button
          onClick={() => openAddModal(activeTab)}
          style={{
            padding: "0.75rem 1.5rem",
            background: FEATURE_TYPE_INFO[activeTab as keyof typeof FEATURE_TYPE_INFO].color,
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          + Add {FEATURE_TYPE_INFO[activeTab as keyof typeof FEATURE_TYPE_INFO].label.slice(0, -1)}
        </button>

        {activeTab === "feat" && (
          <button
            onClick={() => setShowFeatBrowser(true)}
            style={{
              padding: "0.75rem 1.5rem",
              background: "white",
              color: FEATURE_TYPE_INFO.feat.color,
              border: `2px solid ${FEATURE_TYPE_INFO.feat.color}`,
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            📚 Browse Feats Database
          </button>
        )}

        {activeTab === "trait" && (
          <button
            onClick={() => setShowTraitBrowser(true)}
            style={{
              padding: "0.75rem 1.5rem",
              background: "white",
              color: FEATURE_TYPE_INFO.trait.color,
              border: `2px solid ${FEATURE_TYPE_INFO.trait.color}`,
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            📚 Browse Traits Database
          </button>
        )}
      </div>

      {/* Features List */}
      {activeFeatures.length === 0 ? (
        <div
          style={{
            padding: "3rem",
            textAlign: "center",
            background: "#f9fafb",
            border: "2px dashed #ddd",
            borderRadius: "12px",
          }}
        >
          <h3 style={{ margin: 0, color: "#666" }}>
            No {FEATURE_TYPE_INFO[activeTab as keyof typeof FEATURE_TYPE_INFO].label.toLowerCase()} yet
          </h3>
          <p style={{ color: "#999" }}>Click the button above to add one!</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          {activeFeatures.map((feature) => (
            <div
              key={feature.id}
              style={{
                background: "white",
                border: "1px solid #ddd",
                borderRadius: "12px",
                padding: "1.5rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, color: FEATURE_TYPE_INFO[activeTab as keyof typeof FEATURE_TYPE_INFO].color }}>
                    {feature.name}
                  </h3>

                  {feature.description && (
                    <p style={{ margin: "0.75rem 0", color: "#333", lineHeight: 1.6 }}>
                      {feature.description}
                    </p>
                  )}

                  <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", marginTop: "0.75rem", fontSize: "0.9rem", color: "#666" }}>
                    {feature.category && (
                      <div>
                        <strong>Category:</strong> {feature.category}
                      </div>
                    )}
                    {feature.obtained_level && (
                      <div>
                        <strong>Level:</strong> {feature.obtained_level}
                      </div>
                    )}
                    {feature.source && (
                      <div>
                        <strong>Source:</strong> {feature.source}
                      </div>
                    )}
                  </div>

                  {feature.prerequisites && (
                    <div style={{ marginTop: "0.75rem", fontSize: "0.9rem", color: "#666" }}>
                      <strong>Prerequisites:</strong> {feature.prerequisites}
                    </div>
                  )}

                  {feature.obtained_notes && (
                    <div style={{ marginTop: "0.75rem", fontSize: "0.9rem", color: "#999", fontStyle: "italic" }}>
                      {feature.obtained_notes}
                    </div>
                  )}

                  {/* Uses per day tracker */}
                  {feature.uses_per_day && (
                    <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", alignItems: "center" }}>
                      <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>Uses:</span>
                      <button
                        onClick={() => adjustUses(feature.id, feature.uses_remaining, -1)}
                        disabled={feature.uses_remaining === 0}
                        style={{
                          padding: "0.25rem 0.75rem",
                          background: "#ef4444",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        −
                      </button>
                      <span style={{ fontSize: "1.2rem", fontWeight: 700 }}>
                        {feature.uses_remaining} / {feature.uses_per_day}
                      </span>
                      <button
                        onClick={() => adjustUses(feature.id, feature.uses_remaining, 1)}
                        disabled={feature.uses_remaining >= feature.uses_per_day}
                        style={{
                          padding: "0.25rem 0.75rem",
                          background: "#10b981",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        +
                      </button>
                      <button
                        onClick={() => resetUses(feature.id, feature.uses_per_day)}
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
                        Reset
                      </button>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: "0.5rem", marginLeft: "1rem" }}>
                  <button
                    onClick={() => openEditModal(feature)}
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
                    onClick={() => toggleFeature(feature.id, feature.is_active)}
                    style={{
                      padding: "0.5rem 1rem",
                      background: "#fbbf24",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                    }}
                  >
                    Disable
                  </button>
                  <button
                    onClick={() => deleteFeature(feature.id)}
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

      {/* Inactive Features */}
      {inactiveFeatures.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <h3>Inactive {FEATURE_TYPE_INFO[activeTab as keyof typeof FEATURE_TYPE_INFO].label}</h3>
          <div style={{ display: "grid", gap: "1rem" }}>
            {inactiveFeatures.map((feature) => (
              <div
                key={feature.id}
                style={{
                  background: "#f3f4f6",
                  border: "1px solid #d1d5db",
                  borderRadius: "12px",
                  padding: "1rem",
                  opacity: 0.6,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong>{feature.name}</strong>
                    {feature.description && (
                      <div style={{ fontSize: "0.9rem", color: "#666", marginTop: "0.25rem" }}>
                        {feature.description}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => toggleFeature(feature.id, feature.is_active)}
                    style={{
                      padding: "0.5rem 1rem",
                      background: "#10b981",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "0.85rem",
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
            <h2 style={{ marginTop: 0 }}>
              {editingFeature ? "Edit" : "Add"} {FEATURE_TYPE_INFO[activeTab as keyof typeof FEATURE_TYPE_INFO].label.slice(0, -1)}
            </h2>

            <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  placeholder="e.g., Power Attack, Magical Lineage, Darkvision"
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
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>Description</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="What does this feature do?"
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

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>Category</label>
                  <input
                    type="text"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    placeholder="e.g., combat, magic, revelation"
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
                  <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>Source</label>
                  <input
                    type="text"
                    value={formSource}
                    onChange={(e) => setFormSource(e.target.value)}
                    placeholder="e.g., Core Rulebook, Human Bonus"
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
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>Prerequisites</label>
                <input
                  type="text"
                  value={formPrerequisites}
                  onChange={(e) => setFormPrerequisites(e.target.value)}
                  placeholder="e.g., BAB +6, Str 13, Spell Focus (Necromancy)"
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
                  <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>Obtained Level</label>
                  <input
                    type="number"
                    value={formObtainedLevel}
                    onChange={(e) => setFormObtainedLevel(e.target.value)}
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

                <div>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>Uses/Day</label>
                  <input
                    type="number"
                    value={formUsesPerDay}
                    onChange={(e) => setFormUsesPerDay(e.target.value)}
                    min="0"
                    placeholder="Leave empty if unlimited"
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
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>Notes</label>
                <input
                  type="text"
                  value={formObtainedNotes}
                  onChange={(e) => setFormObtainedNotes(e.target.value)}
                  placeholder="e.g., Rewarded by GM, Bonus feat from Human"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "1rem",
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
                    background: FEATURE_TYPE_INFO[activeTab as keyof typeof FEATURE_TYPE_INFO].color,
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  {saving ? "Saving..." : editingFeature ? "Save Changes" : `Add ${FEATURE_TYPE_INFO[activeTab as keyof typeof FEATURE_TYPE_INFO].label.slice(0, -1)}`}
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

      {/* Feat Browser */}
      <FeatBrowser
        isOpen={showFeatBrowser}
        onClose={() => setShowFeatBrowser(false)}
        onSelectFeat={(feat) => {
          openAddModal("feat");
          setFormName(feat.name);
          setFormDescription(feat.benefit || "");
          setFormPrerequisites(feat.prerequisites || "");
          setFormCategory(feat.types.join(", ") || "");
        }}
      />

      {/* Trait Browser */}
      <TraitBrowser
        isOpen={showTraitBrowser}
        onClose={() => setShowTraitBrowser(false)}
        onSelectTrait={(trait) => {
          openAddModal("trait");
          setFormName(trait.name);
          setFormDescription(trait.benefit || "");
          setFormCategory(trait.type || "");
          if (trait.restrictions) {
            setFormPrerequisites(trait.restrictions);
          }
        }}
      />
    </div>
  );
}
