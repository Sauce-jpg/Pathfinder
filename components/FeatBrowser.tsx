"use client";

import { useState, useEffect } from "react";

interface FeatBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFeat: (feat: any) => void;
}

export function FeatBrowser({ isOpen, onClose, onSelectFeat }: FeatBrowserProps) {
  const [feats, setFeats] = useState<any[]>([]);
  const [filteredFeats, setFilteredFeats] = useState<any[]>([]);
  const [searchText, setSearchText] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedFeat, setSelectedFeat] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadFeats();
    }
  }, [isOpen]);

  useEffect(() => {
    filterFeats();
  }, [searchText, selectedType, feats]);

  async function loadFeats() {
    setLoading(true);
    try {
      const response = await fetch("/pathfinder/feats-COMPLETE.json");
      const data = await response.json();
      setFeats(data);
      setFilteredFeats(data);
    } catch (error) {
      console.error("Error loading feats:", error);
    }
    setLoading(false);
  }

  function filterFeats() {
    let filtered = [...feats];

    // Filter by search text
    if (searchText) {
      filtered = filtered.filter(
        (feat) =>
          feat.name.toLowerCase().includes(searchText.toLowerCase()) ||
          feat.benefit?.toLowerCase().includes(searchText.toLowerCase()) ||
          feat.prerequisites?.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    // Filter by type
    if (selectedType) {
      filtered = filtered.filter((feat) => feat.types.includes(selectedType));
    }

    setFilteredFeats(filtered);
  }

  if (!isOpen) return null;

  const featTypes = [
    "combat",
    "metamagic",
    "teamwork",
    "item creation",
    "general",
    "style",
    "critical",
    "racial",
    "monster",
    "animal companion",
  ];

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
            <h2 style={{ margin: 0 }}>Feat Browser</h2>
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

          {/* Filters */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem", marginTop: "1rem" }}>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search feats..."
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
              {featTypes.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: "#666" }}>
            Showing {filteredFeats.length} of {feats.length} feats
          </div>
        </div>

        {/* Content */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", flex: 1, overflow: "hidden" }}>
          {/* Feat List */}
          <div style={{ borderRight: "1px solid #ddd", overflow: "auto", padding: "1rem" }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: "2rem" }}>Loading feats...</div>
            ) : filteredFeats.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem", color: "#999" }}>No feats found</div>
            ) : (
              <div style={{ display: "grid", gap: "0.5rem" }}>
                {filteredFeats.map((feat) => (
                  <div
                    key={feat.name}
                    onClick={() => setSelectedFeat(feat)}
                    style={{
                      padding: "0.75rem",
                      background: selectedFeat?.name === feat.name ? "#f0f9ff" : "white",
                      border: `1px solid ${selectedFeat?.name === feat.name ? "#0070f3" : "#ddd"}`,
                      borderRadius: "6px",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      if (selectedFeat?.name !== feat.name) {
                        e.currentTarget.style.background = "#f9fafb";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedFeat?.name !== feat.name) {
                        e.currentTarget.style.background = "white";
                      }
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>{feat.name}</div>
                    <div style={{ fontSize: "0.85rem", color: "#666" }}>
                      {feat.types.map((type: string) => (
                        <span
                          key={type}
                          style={{
                            display: "inline-block",
                            padding: "0.125rem 0.5rem",
                            background: "#e5e7eb",
                            borderRadius: "4px",
                            marginRight: "0.25rem",
                            fontSize: "0.75rem",
                          }}
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Feat Details */}
          <div style={{ overflow: "auto", padding: "1.5rem" }}>
            {selectedFeat ? (
              <div>
                <h3 style={{ marginTop: 0, color: "#0070f3" }}>{selectedFeat.name}</h3>

                <div style={{ marginBottom: "1rem" }}>
                  {selectedFeat.types.map((type: string) => (
                    <span
                      key={type}
                      style={{
                        display: "inline-block",
                        padding: "0.25rem 0.75rem",
                        background: "#0070f3",
                        color: "white",
                        borderRadius: "6px",
                        marginRight: "0.5rem",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                      }}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </span>
                  ))}
                </div>

                {selectedFeat.prerequisites && (
                  <div style={{ marginBottom: "1rem" }}>
                    <strong>Prerequisites:</strong>{" "}
                    <span style={{ color: "#666" }}>{selectedFeat.prerequisites || "None"}</span>
                  </div>
                )}

                {selectedFeat.benefit && (
                  <div style={{ marginBottom: "1rem" }}>
                    <strong>Benefit:</strong>
                    <p style={{ marginTop: "0.5rem", lineHeight: 1.6 }}>{selectedFeat.benefit}</p>
                  </div>
                )}

                {selectedFeat.source && (
                  <div style={{ fontSize: "0.85rem", color: "#999", marginTop: "1rem" }}>
                    <strong>Source:</strong> {selectedFeat.source}
                  </div>
                )}

                <button
                  onClick={() => {
                    onSelectFeat(selectedFeat);
                    onClose();
                  }}
                  style={{
                    marginTop: "2rem",
                    padding: "0.75rem 1.5rem",
                    background: "#10b981",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "1rem",
                  }}
                >
                  Add This Feat
                </button>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "3rem", color: "#999" }}>
                Select a feat to view details
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
