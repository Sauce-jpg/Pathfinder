/**
 * mapMagicItemToInventory
 * 
 * Converts a MagicItem from magic-items.json into a character_inventory row.
 * Add this function to /lib/equipmentMappers.ts
 */

import type { MagicItem } from "@/components/MagicItemBrowser";

export function mapMagicItemToInventory(item: MagicItem, characterId: string) {
  // Map Pathfinder slot names → inventory slot_name values used in character_equipment_slots
  const slotMap: Record<string, string> = {
    Belt:      "belt",
    Body:      "body",
    Chest:     "chest",
    Eyes:      "eyes",
    Feet:      "feet",
    Hands:     "hands",
    Head:      "head",
    Headband:  "headband",
    Neck:      "neck",
    Ring:      "ring",
    Shoulders: "shoulders",
    Slotless:  "slotless",
    Wrists:    "wrists",
  };

  const slotName = slotMap[item.Slot] ?? null;

  // Parse weight string to a number (e.g. "1 lb." → 1)
  const weightMatch = item.Weight?.match(/[\d.]+/);
  const weightPerItem = weightMatch ? parseFloat(weightMatch[0]) : 0;

  return {
    character_id:    characterId,
    item_name:       item.Name,
    item_type:       "magic_item",
    description:     item.Description ?? null,
    quantity:        1,
    weight_per_item: weightPerItem,
    cost_gp:         item.Cost ?? 0,
    is_equipped:     false,
    slot_name:       slotName,
    notes:           [
      item.Aura ? `Aura: ${item.Aura}` : null,
      item.CL    ? `CL: ${item.CL}`   : null,
      item.Source ? `Source: ${item.Source}` : null,
      item.Reference ? `Ref: ${item.Reference}` : null,
    ].filter(Boolean).join(" · ") || null,
    grants_slot_type:  null,
    grants_slot_count: 0,
    // Store structured metadata in properties jsonb column
    properties: {
      magic_item:   true,
      slot:         item.Slot,
      power_level:  item.PowerLevel,
      rarity:       item.Rarity,
      item_type:    item.ItemType,
      aura:         item.Aura,
      caster_level: item.CL,
      construction: item.Construction ?? null,
      reference:    item.Reference ?? null,
    },
  };
}
