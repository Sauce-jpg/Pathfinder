"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ManageSlotsModal } from "./equipment/ManageSlotsModal";
import { EquipItemModal } from "./equipment/EquipItemModal";

interface EquipmentProps {
  characterId: string;
}

export function Equipment({ characterId }: EquipmentProps) {
  const [slots, setSlots] = useState<any[]>([]);
  const [equippedItems, setEquippedItems] = useState<any[]>([]);
  const [availableItems, setAvailableItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showManageSlotsModal, setShowManageSlotsModal] = useState(false);
  const [showEquipModal, setShowEquipModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [expandedSlots, setExpandedSlots] = useState<Set<string>>(new Set(['ring', 'slotless']));

  useEffect(() => {
    loadEquipment();
  }, [characterId]);

  async function loadEquipment() {
    setLoading(true);

    // Check if slots are initialized, if not, initialize them
    const { data: existingSlots } = await supabase
      .from("character_equipment_slots")
      .select("*")
      .eq("character_id", characterId);

    if (!existingSlots || existingSlots.length === 0) {
      // Initialize default slots
      await supabase.rpc("initialize_equipment_slots", { char_id: characterId });
    }

    // Load slots with calculated totals
    const { data: slotsData } = await supabase
      .from("character_total_slots")
      .select("*")
      .eq("character_id", characterId)
      .order("slot_order");

    setSlots(slotsData || []);

    // Load equipped items
    const { data: equippedData } = await supabase
      .from("character_equipment_details")
      .select("*")
      .eq("character_id", characterId);

    setEquippedItems(equippedData || []);

    // Load available items (from inventory that have a slot)
    const { data: itemsData } = await supabase
      .from("character_inventory")
      .select("*")
      .eq("character_id", characterId)
      .not("slot_name", "is", null);

    setAvailableItems(itemsData || []);

    setLoading(false);
  }

  async function equipItem(itemId: string, slotName: string, slotIndex: number) {
    const { error } = await supabase.from("character_equipped_items").insert({
      character_id: characterId,
      inventory_item_id: itemId,
      slot_name: slotName,
      slot_index: slotIndex,
    });

    if (error) {
      alert("Error equipping item: " + error.message);
    } else {
      loadEquipment();
    }
  }

  async function unequipItem(equippedItemId: string) {
    // Find the item to check if it grants slots
    const item = equippedItems.find(ei => ei.item_id === equippedItemId);
    
    if (item?.grants_slot_count > 0) {
      // Check if any of the granted slots are in use
      const grantedSlotStart = slots.find(s => s.slot_name === item.grants_slot_type)?.base_slot_count + 1;
      const grantedSlotEnd = grantedSlotStart + item.grants_slot_count - 1;
      
      const slotsInUse = equippedItems.filter(ei => 
        ei.slot_name === item.grants_slot_type && 
        ei.slot_index >= grantedSlotStart && 
        ei.slot_index <= grantedSlotEnd
      );
      
      if (slotsInUse.length > 0) {
        alert(`Cannot unequip: This item grants ${item.grants_slot_count} ${item.grants_slot_type} slots that are currently in use. Unequip those items first.`);
        return;
      }
    }

    const { error } = await supabase
      .from("character_equipped_items")
      .delete()
      .eq("inventory_item_id", equippedItemId);

    if (error) {
      alert("Error unequipping item: " + error.message);
    } else {
      loadEquipment();
    }
  }

  function openEquipModal(slotName: string, slotIndex: number) {
    setSelectedSlot({ slotName, slotIndex });
    setShowEquipModal(true);
  }

  function toggleSlotExpansion(slotName: string) {
    const newExpanded = new Set(expandedSlots);
    if (newExpanded.has(slotName)) {
      newExpanded.delete(slotName);
    } else {
      newExpanded.add(slotName);
    }
    setExpandedSlots(newExpanded);
  }

  function getEquippedItem(slotName: string, slotIndex: number) {
    return equippedItems.find(ei => ei.slot_name === slotName && ei.slot_index === slotIndex);
  }

  if (loading) {
    return <div style={{ padding: "2rem", textAlign: "center" }}>Loading equipment...</div>;
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h3 style={{ margin: 0 }}>👤 Equipped Gear</h3>
        <button
          onClick={() => setShowManageSlotsModal(true)}
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
          ⚙️ Manage Slots
        </button>
      </div>

      {/* Equipment Slots */}
      <div style={{ display: "grid", gap: "1rem" }}>
        {slots.map((slot) => {
          const isMultiSlot = slot.total_slot_count > 1;
          const isExpanded = expandedSlots.has(slot.slot_name);
          const equippedInSlot = equippedItems.filter(ei => ei.slot_name === slot.slot_name);
          
          return (
            <div
              key={slot.slot_name}
              style={{
                background: "white",
                border: "1px solid #ddd",
                borderRadius: "12px",
                padding: "1rem",
              }}
            >
              {/* Slot Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isMultiSlot && isExpanded ? "1rem" : 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <strong style={{ fontSize: "1.05rem" }}>{slot.slot_display_name}:</strong>
                  {slot.is_houserule && (
                    <span
                      style={{
                        padding: "0.25rem 0.5rem",
                        background: "#fbbf24",
                        color: "white",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                      }}
                    >
                      🏠 HOUSERULE
                    </span>
                  )}
                  {isMultiSlot && (
                    <span style={{ fontSize: "0.9rem", color: "#666" }}>
                      ({equippedInSlot.length}/{slot.total_slot_count} slots)
                      {slot.bonus_slot_count > 0 && (
                        <span style={{ color: "#10b981" }}> (+{slot.bonus_slot_count} bonus)</span>
                      )}
                    </span>
                  )}
                </div>

                {isMultiSlot && (
                  <button
                    onClick={() => toggleSlotExpansion(slot.slot_name)}
                    style={{
                      padding: "0.25rem 0.75rem",
                      background: "#f3f4f6",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                    }}
                  >
                    {isExpanded ? "Collapse ▲" : "Expand ▼"}
                  </button>
                )}
              </div>

              {/* Single Slot Display */}
              {!isMultiSlot && (
                <div style={{ marginTop: "0.5rem" }}>
                  {(() => {
                    const item = getEquippedItem(slot.slot_name, 1);
                    return item ? (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "0.75rem",
                          background: "#f0fdf4",
                          border: "1px solid #86efac",
                          borderRadius: "8px",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600 }}>{item.item_name}</div>
                          {item.description && (
                            <div style={{ fontSize: "0.85rem", color: "#666", marginTop: "0.25rem" }}>
                              {item.description}
                            </div>
                          )}
                          {item.grants_slot_count > 0 && (
                            <div style={{ fontSize: "0.85rem", color: "#10b981", marginTop: "0.25rem" }}>
                              ✨ Grants +{item.grants_slot_count} {item.grants_slot_type} slots
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => unequipItem(item.item_id)}
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
                          Unequip
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => openEquipModal(slot.slot_name, 1)}
                        style={{
                          width: "100%",
                          padding: "0.75rem",
                          background: "#f9fafb",
                          border: "2px dashed #ddd",
                          borderRadius: "8px",
                          cursor: "pointer",
                          color: "#999",
                        }}
                      >
                        [Empty - Click to equip]
                      </button>
                    );
                  })()}
                </div>
              )}

              {/* Multi-Slot Display */}
              {isMultiSlot && isExpanded && (
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  {Array.from({ length: slot.total_slot_count }).map((_, index) => {
                    const slotIndex = index + 1;
                    const item = getEquippedItem(slot.slot_name, slotIndex);
                    const isBonusSlot = slotIndex > slot.base_slot_count;

                    return (
                      <div
                        key={slotIndex}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.75rem",
                          padding: "0.5rem",
                          background: isBonusSlot ? "#f0fdf4" : "#f9fafb",
                          borderRadius: "6px",
                        }}
                      >
                        <div style={{ minWidth: "80px", fontSize: "0.9rem", color: "#666" }}>
                          {slot.slot_display_name} {slotIndex}
                          {isBonusSlot && <span style={{ color: "#10b981" }}> (bonus)</span>}:
                        </div>
                        {item ? (
                          <div style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div style={{ fontWeight: 600 }}>{item.item_name}</div>
                              {item.description && (
                                <div style={{ fontSize: "0.8rem", color: "#666" }}>{item.description}</div>
                              )}
                            </div>
                            <button
                              onClick={() => unequipItem(item.item_id)}
                              style={{
                                padding: "0.25rem 0.75rem",
                                background: "#ef4444",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "0.8rem",
                              }}
                            >
                              Unequip
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => openEquipModal(slot.slot_name, slotIndex)}
                            style={{
                              flex: 1,
                              padding: "0.5rem",
                              background: "white",
                              border: "1px dashed #ddd",
                              borderRadius: "4px",
                              cursor: "pointer",
                              color: "#999",
                              fontSize: "0.85rem",
                            }}
                          >
                            [Empty]
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Multi-Slot Collapsed View */}
              {isMultiSlot && !isExpanded && (
                <div style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>
                  {equippedInSlot.length > 0 ? (
                    <div style={{ color: "#666" }}>
                      {equippedInSlot.slice(0, 3).map(item => item.item_name).join(", ")}
                      {equippedInSlot.length > 3 && ` and ${equippedInSlot.length - 3} more...`}
                    </div>
                  ) : (
                    <div style={{ color: "#999" }}>All slots empty</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modals */}
      {showManageSlotsModal && (
        <ManageSlotsModal
          characterId={characterId}
          slots={slots}
          onClose={() => setShowManageSlotsModal(false)}
          onUpdate={loadEquipment}
        />
      )}

      {showEquipModal && selectedSlot && (
        <EquipItemModal
          characterId={characterId}
          slotName={selectedSlot.slotName}
          slotIndex={selectedSlot.slotIndex}
          availableItems={availableItems.filter(item => 
            item.slot_name === selectedSlot.slotName &&
            !equippedItems.some(ei => ei.item_id === item.id)
          )}
          onClose={() => setShowEquipModal(false)}
          onEquip={(itemId) => {
            equipItem(itemId, selectedSlot.slotName, selectedSlot.slotIndex);
            setShowEquipModal(false);
          }}
        />
      )}
    </div>
  );
}
