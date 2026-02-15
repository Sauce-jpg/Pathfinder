"use client";

interface EquipItemModalProps {
  characterId: string;
  slotName: string;
  slotIndex: number;
  availableItems: any[];
  onClose: () => void;
  onEquip: (itemId: string) => void;
}

export function EquipItemModal({
  characterId,
  slotName,
  slotIndex,
  availableItems,
  onClose,
  onEquip,
}: EquipItemModalProps) {
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
        <h2 style={{ marginTop: 0 }}>
          Equip Item to {slotName.charAt(0).toUpperCase() + slotName.slice(1)} Slot {slotIndex}
        </h2>

        {availableItems.length === 0 ? (
          <div
            style={{
              padding: "3rem",
              textAlign: "center",
              background: "#f9fafb",
              border: "2px dashed #ddd",
              borderRadius: "12px",
            }}
          >
            <h3 style={{ margin: 0, color: "#666" }}>No items available for this slot</h3>
            <p style={{ color: "#999", marginTop: "0.5rem" }}>
              Add items to your inventory and assign them to the "{slotName}" slot first.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem", marginBottom: "1.5rem" }}>
            {availableItems.map((item) => (
              <div
                key={item.id}
                style={{
                  background: "#f9fafb",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  padding: "1rem",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onClick={() => onEquip(item.id)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f0f9ff";
                  e.currentTarget.style.borderColor = "#0070f3";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#f9fafb";
                  e.currentTarget.style.borderColor = "#ddd";
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "1.05rem" }}>{item.item_name}</div>
                    
                    {item.description && (
                      <div style={{ fontSize: "0.9rem", color: "#666", marginTop: "0.25rem" }}>
                        {item.description}
                      </div>
                    )}

                    {item.item_type && (
                      <div style={{ fontSize: "0.85rem", color: "#999", marginTop: "0.5rem" }}>
                        Type: {item.item_type}
                      </div>
                    )}

                    {item.grants_slot_count > 0 && (
                      <div
                        style={{
                          marginTop: "0.5rem",
                          padding: "0.5rem",
                          background: "#f0fdf4",
                          border: "1px solid #86efac",
                          borderRadius: "6px",
                          fontSize: "0.85rem",
                          color: "#10b981",
                        }}
                      >
                        ✨ Grants +{item.grants_slot_count} {item.grants_slot_type} slots when equipped
                      </div>
                    )}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEquip(item.id);
                    }}
                    style={{
                      padding: "0.5rem 1rem",
                      background: "#10b981",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontWeight: 600,
                      marginLeft: "1rem",
                    }}
                  >
                    Equip
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
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
