// Helper function to parse cost string to gold
export function parseCostToGold(cost: string): number {
  if (cost === "—" || !cost) return 0;
  
  const match = cost.match(/(\d+(?:\.\d+)?)\s*(gp|sp|cp)/i);
  if (!match) return 0;
  
  const amount = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  
  switch (unit) {
    case "gp": return amount;
    case "sp": return amount / 10;
    case "cp": return amount / 100;
    default: return 0;
  }
}

// Helper function to parse weight string to pounds
export function parseWeightToPounds(weight: string): number {
  if (weight === "—" || !weight) return 0;
  
  const match = weight.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

// Map weapon from equipment library to character_weapons format
export function mapWeaponToCharacter(weapon: any, characterId: string) {
  // Parse critical (e.g., "19-20/x2" or "20/x2")
  const critParts = weapon.Critical.split('/');
  const critRange = critParts[0] || '20';
  const critMultiplier = critParts[1] || 'x2';

  return {
    character_id: characterId,
    weapon_name: weapon.Name,
    weapon_type: weapon.Type, // S, P, B, etc.
    weapon_category: weapon.Category, // Simple, Martial, Exotic
    damage_dice: weapon["Damage (M)"],
    critical_range: critRange,
    critical_multiplier: critMultiplier,
    range_increment: weapon.Range && weapon.Range !== "—" ? 
      parseInt(weapon.Range.replace(/\D/g, '')) || null : null,
    properties: weapon.Special && weapon.Special !== "—" ? 
      (Array.isArray(weapon.Special) ? weapon.Special : [weapon.Special]) : [],
    notes: weapon.Description,
    is_primary: false,
    is_equipped: false,
  };
}

// Map armor from equipment library to character_armor format
export function mapArmorToCharacter(armor: any, characterId: string) {
  return {
    character_id: characterId,
    armor_name: armor.Name,
    armor_type: armor.Type, // Light, Medium, Heavy
    ac_bonus: parseInt(armor["AC Bonus"].replace(/\D/g, '')) || 0,
    max_dex_bonus: armor["Max Dex"] === "—" ? null : parseInt(armor["Max Dex"]),
    armor_check_penalty: armor["Armor Check Penalty"] || 0,
    arcane_spell_failure: parseInt(armor["Arcane Spell Failure"].replace(/\D/g, '')) || 0,
    enhancement_bonus: 0,
    properties: [],
    notes: armor.Description,
    is_equipped: false,
  };
}

// Map shield from equipment library to character_armor format
export function mapShieldToCharacter(shield: any, characterId: string) {
  return {
    character_id: characterId,
    armor_name: shield.Name,
    armor_type: 'Shield',
    ac_bonus: parseInt(shield["AC Bonus"].replace(/\D/g, '')) || 0,
    max_dex_bonus: shield["Max Dex"] === "—" ? null : parseInt(shield["Max Dex"]),
    armor_check_penalty: shield["Armor Check Penalty"] || 0,
    arcane_spell_failure: parseInt(shield["Arcane Spell Failure"].replace(/\D/g, '')) || 0,
    enhancement_bonus: 0,
    properties: shield.Special && shield.Special !== "—" ? [shield.Special] : [],
    notes: shield.Description,
    is_equipped: false,
  };
}

// Map general item from equipment library to character_inventory format
export function mapItemToInventory(item: any, characterId: string) {
  return {
    character_id: characterId,
    item_name: item.Name,
    item_type: item.Category || 'General',
    description: item.Description,
    quantity: 1,
    weight_per_item: parseWeightToPounds(item.Weight),
    cost_gp: parseCostToGold(item.Cost),
    is_equipped: false,
    notes: null,
    properties: {},
  };
}
