"use client";

import { useState, useEffect } from "react";

interface TraitBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTrait: (trait: any) => void;
}

export function TraitBrowser({ isOpen, onClose, onSelectTrait }: TraitBrowserProps) {
  const [traits, setTraits] = useState<any[]>([]);
  const [filteredTraits, setFilteredTraits] = useState<any[]>([]);
  const [searchText, setSearchText] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedTrait, setSelectedTrait] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadTraits();
    }
  }, [isOpen]);

  useEffect(() => {
    filterTraits();
  }, [searchText, selectedType, traits]);

  async function loadTraits() {
    setLoading(true);
    try {
      const response = await fetch("/pathfinder/traits-COMPLETE.json");
      const data = await response.json();
      setTraits(data);
      setFilteredTraits(data);
    } catch (error) {
      console.error("Error loading traits:", error);
    }
    setLoading(false);
  }

  function filterTraits() {
    let filtered = [...traits];

    // Filter by search text
    if (searchText) {
      filtered = filtered.filter(
        (trait) =>
          trait.name.toLowerCase().includes(searchText.toLowerCase()) ||
          trait.benefit?.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    // Filter by type
    if (selectedType) {
      filtered = filtered.filter((trait) => trait.type === selectedType);
    }

    setFilteredTraits(filtered);
  }

  if (!isOpen) return null;

  const traitTypes = ["combat", "faith", "magic", "social", "race", "regional", "campaign", "drawback"];

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
          width: "90%",
          maxWidth: "1200px",
          height: "80vh",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "1.5rem", borderBottom: "1px solid #ddd" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0 }}>Trait Browser</h2>
            <button
              onClick={onClose}
              style={{
                padding: "0.5rem 1rem",
                background: "#eee",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>

          {/* Info */}
          <div
            style={{
              marginTop: "1rem",
              padding: "0.75rem",
              background: "#f0f9ff",
              border: "1px solid #bfdbfe",
              borderRadius: "6px",
              fontSize: "0.9rem",
            }}
          >
            💡 <strong>Reminder:</strong> Characters typically get 2 traits. You can take 1 drawback to gain a 3rd
            trait.
          </div>

          {/* Filters */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem", marginTop: "1rem" }}>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search traits..."
              style={{
                padding: "0.75rem",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "1rem",
              }}
            />
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              style={{
                padding: "0.75rem",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "1rem",
                minWidth: "200px",
              }}
            >
              <option value="">All Types</option>
              {traitTypes.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: "#666" }}>
            Showing {filteredTraits.length} of {traits.length} traits
          </div>
        </div>

        {/* Content */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", flex: 1, overflow: "hidden" }}>
          {/* Trait List */}
          <div style={{ borderRight: "1px solid #ddd", overflow: "auto", padding: "1rem" }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: "2rem" }}>Loading traits...</div>
            ) : filteredTraits.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem", color: "#999" }}>No traits found</div>
            ) : (
              <div style={{ display: "grid", gap: "0.5rem" }}>
                {filteredTraits.map((trait) => (
                  <div
                    key={trait.name}
                    onClick={() => setSelectedTrait(trait)}
                    style={{
                      padding: "0.75rem",
                      background: selectedTrait?.name === trait.name ? "#f0fdf4" : "white",
                      border: `1px solid ${selectedTrait?.name === trait.name ? "#10b981" : "#ddd"}`,
                      borderRadius: "6px",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      if (selectedTrait?.name !== trait.name) {
                        e.currentTarget.style.background = "#f9fafb";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedTrait?.name !== trait.name) {
                        e.currentTarget.style.background = "white";
                      }
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>{trait.name}</div>
                    <div style={{ fontSize: "0.85rem" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.125rem 0.5rem",
                          background:
                            trait.type === "drawback"
                              ? "#fee2e2"
                              : trait.type === "combat"
                              ? "#dbeafe"
                              : trait.type === "magic"
                              ? "#f3e8ff"
                              : "#e5e7eb",
                          color:
                            trait.type === "drawback"
                              ? "#991b1b"
                              : trait.type === "combat"
                              ? "#1e40af"
                              : trait.type === "magic"
                              ? "#6b21a8"
                              : "#374151",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                        }}
                      >
                        {trait.type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Trait Details */}
          <div style={{ overflow: "auto", padding: "1.5rem" }}>
            {selectedTrait ? (
              <div>
                <h3 style={{ marginTop: 0, color: "#10b981" }}>{selectedTrait.name}</h3>

                <div style={{ marginBottom: "1rem" }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "0.25rem 0.75rem",
                      background:
                        selectedTrait.type === "drawback"
                          ? "#ef4444"
                          : selectedTrait.type === "combat"
                          ? "#3b82f6"
                          : selectedTrait.type === "magic"
                          ? "#8b5cf6"
                          : "#10b981",
                      color: "white",
                      borderRadius: "6px",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                    }}
                  >
                    {selectedTrait.type.charAt(0).toUpperCase() + selectedTrait.type.slice(1)} Trait
                  </span>
                </div>

                {selectedTrait.benefit && (
                  <div style={{ marginBottom: "1rem" }}>
                    <strong>Benefit:</strong>
                    <p style={{ marginTop: "0.5rem", lineHeight: 1.6 }}>{selectedTrait.benefit}</p>
                  </div>
                )}

                {selectedTrait.restrictions && (
                  <div
                    style={{
                      marginBottom: "1rem",
                      padding: "0.75rem",
                      background: "#fef3c7",
                      border: "1px solid #fbbf24",
                      borderRadius: "6px",
                    }}
                  >
                    <strong>⚠️ Restrictions:</strong> {selectedTrait.restrictions}
                  </div>
                )}

                {selectedTrait.type === "drawback" && (
                  <div
                    style={{
                      marginBottom: "1rem",
                      padding: "0.75rem",
                      background: "#fee2e2",
                      border: "1px solid #ef4444",
                      borderRadius: "6px",
                      fontSize: "0.9rem",
                    }}
                  >
                    <strong>⚠️ Drawback:</strong> This is a drawback. Taking one drawback allows you to gain a 3rd
                    trait.
                  </div>
                )}

                {selectedTrait.source && (
                  <div style={{ fontSize: "0.85rem", color: "#999", marginTop: "1rem" }}>
                    <strong>Source:</strong> {selectedTrait.source}
                  </div>
                )}

                <button
                  onClick={() => {
                    onSelectTrait(selectedTrait);
                    onClose();
                  }}
                  style={{
                    marginTop: "2rem",
                    padding: "0.75rem 1.5rem",
                    background: selectedTrait.type === "drawback" ? "#ef4444" : "#10b981",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "1rem",
                  }}
                >
                  {selectedTrait.type === "drawback" ? "Take This Drawback" : "Add This Trait"}
                </button>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "3rem", color: "#999" }}>
                Select a trait to view details
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
