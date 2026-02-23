/**
 * TypeScript Type Definitions for Pathfinder Equipment
 * 
 * Use these types for type-safe equipment handling in your React components
 */

// ============================================================================
// BASE TYPES
// ============================================================================

export interface BaseEquipmentItem {
  Name: string;
  Cost: string;
  Weight: string;
  Description: string;
  "PFS Legal"?: boolean;
  Category?: string;
}

// ============================================================================
// WEAPONS
// ============================================================================

export interface Weapon extends BaseEquipmentItem {
  "Damage (S)": string;
  "Damage (M)": string;
  Critical: string;
  Range: string;
  Type: string; // S (slashing), P (piercing), B (bludgeoning)
  Special: string | string[];
  Category: "Simple" | "Martial" | "Exotic";
}

export interface Firearm extends BaseEquipmentItem {
  "Damage (S)": string;
  "Damage (M)": string;
  Critical: string;
  Range: string;
  Misfire: string;
  Capacity: string;
  Type: string;
}

// ============================================================================
// ARMOR & SHIELDS
// ============================================================================

export interface Armor extends BaseEquipmentItem {
  "AC Bonus": string;
  "Max Dex": string | number;
  "Armor Check Penalty": number;
  "Arcane Spell Failure": string;
  "Speed (30 ft)": string;
  "Speed (20 ft)": string;
  Type: "Light" | "Medium" | "Heavy";
}

export interface Shield extends BaseEquipmentItem {
  "AC Bonus": string;
  "Max Dex": string | number;
  "Armor Check Penalty": number;
  "Arcane Spell Failure": string;
  Special?: string;
}

// ============================================================================
// ALCHEMICAL ITEMS
// ============================================================================

export interface AlchemicalReagent extends BaseEquipmentItem {
  Type: string;
  School: string;
}

export interface AlchemicalRemedy extends BaseEquipmentItem {
  "Craft DC": string;
}

export interface AlchemicalTool extends BaseEquipmentItem {
  "Craft DC": string;
}

export interface AlchemicalWeapon extends BaseEquipmentItem {
  Damage: string;
  "Splash Damage": string;
  Range: string;
  "Craft DC": string;
}

// ============================================================================
// GEAR TYPES
// ============================================================================

export interface AdventuringGear extends BaseEquipmentItem {
  Category: string;
}

export interface Ammunition extends BaseEquipmentItem {
  Type: string;
}

export interface AnimalGear extends BaseEquipmentItem {}

export interface ChannelFocus extends BaseEquipmentItem {
  Slot: string;
  Deity: string;
}

export interface Clothing extends BaseEquipmentItem {}

export interface Concoction extends BaseEquipmentItem {}

export interface Dragoncraft extends BaseEquipmentItem {}

export interface DungeonGuide extends BaseEquipmentItem {}

export interface Entertainment extends BaseEquipmentItem {}

export interface FoodDrink extends BaseEquipmentItem {}

export interface FungalGraft extends BaseEquipmentItem {}

export interface Herb extends BaseEquipmentItem {}

export interface Kit extends BaseEquipmentItem {}

export interface LodgingService extends BaseEquipmentItem {}

export interface SiegeEngine extends BaseEquipmentItem {
  Damage: string;
  Critical: string;
  Range: string;
  Crew: string;
  Type: string;
}

// ============================================================================
// UNION TYPE FOR ALL EQUIPMENT
// ============================================================================

export type EquipmentItem = Weapon | Firearm | Armor | Shield | AlchemicalReagent | AlchemicalRemedy | AlchemicalTool | AlchemicalWeapon | AdventuringGear | Ammunition | AnimalGear | ChannelFocus | Clothing | Concoction | Dragoncraft | DungeonGuide | Entertainment | FoodDrink | FungalGraft | Herb | Kit | LodgingService | SiegeEngine | BaseEquipmentItem;

// ============================================================================
// EQUIPMENT CATEGORIES
// ============================================================================

export type EquipmentCategory = 
  | "weapons"
  | "magic-weapons"
  | "firearms"
  | "armor"
  | "magic-armor"
  | "shields"
  | "magic-shields"
  | "alchemical-reagents"
  | "alchemical-remedies"
  | "alchemical-tools"
  | "alchemical-weapons"
  | "adventuring-gear"
  | "ammunition"
  | "firearm-ammunition"
  | "animal-gear"
  | "black-market"
  | "channel-foci"
  | "clothing"
  | "concoctions"
  | "dragoncraft"
  | "dungeon-guides"
  | "entertainment"
  | "food-drink"
  | "fungal-grafts"
  | "herbs"
  | "kits"
  | "lodging-services"
  | "siege-engines"
  | "chronicles"
  | "tinctures"
  | "torture-implements"
  | "tools"
  | "transport"
  | "spellbooks"
  | "mounts-pets";

// ============================================================================
// CATEGORY METADATA
// ============================================================================

export interface CategoryInfo {
  id: EquipmentCategory;
  name: string;
  filename: string;
  description: string;
  icon?: string;
}

export const EQUIPMENT_CATEGORIES: CategoryInfo[] = [
  {
    id: "weapons",
    name: "Weapons",
    filename: "weapons.json",
    description: "Simple, martial, and exotic weapons",
    icon: "⚔️"
  },
  {
    id: "armor",
    name: "Armor",
    filename: "armor.json",
    description: "Light, medium, and heavy armor",
    icon: "🛡️"
  },
  {
    id: "shields",
    name: "Shields",
    filename: "shields.json",
    description: "Bucklers, light, heavy, and tower shields",
    icon: "🛡️"
  },
  {
    id: "adventuring-gear",
    name: "Adventuring Gear",
    filename: "adventuring-gear.json",
    description: "General equipment and supplies",
    icon: "🎒"
  },
  {
    id: "kits",
    name: "Kits",
    filename: "kits.json",
    description: "Pre-packaged equipment bundles",
    icon: "📦"
  },
  {
    id: "alchemical-tools",
    name: "Alchemical Tools",
    filename: "alchemical-tools.json",
    description: "Alchemical utility items",
    icon: "⚗️"
  },
  {
    id: "alchemical-weapons",
    name: "Alchemical Weapons",
    filename: "alchemical-weapons.json",
    description: "Acid, alchemist's fire, and splash weapons",
    icon: "🧪"
  },
  {
    id: "food-drink",
    name: "Food & Drink",
    filename: "food-drink.json",
    description: "Meals, rations, and beverages",
    icon: "🍖"
  },
  {
    id: "clothing",
    name: "Clothing",
    filename: "clothing.json",
    description: "Outfits and accessories",
    icon: "👔"
  },
  {
    id: "ammunition",
    name: "Ammunition",
    filename: "ammunition.json",
    description: "Arrows, bolts, and bullets",
    icon: "🏹"
  },
  {
    id: "firearms",
    name: "Firearms",
    filename: "firearms.json",
    description: "Early and advanced firearms",
    icon: "🔫"
  },
  {
    id: "animal-gear",
    name: "Animal Gear",
    filename: "animal-gear.json",
    description: "Saddles, barding, and animal equipment",
    icon: "🐴"
  }
  // Add more as needed
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse cost string to gold pieces
 */
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

/**
 * Parse weight string to pounds
 */
export function parseWeightToPounds(weight: string): number {
  if (weight === "—" || !weight) return 0;
  
  const match = weight.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * Format gold pieces to string
 */
export function formatCost(gp: number): string {
  if (gp === 0) return "—";
  if (gp >= 1) return `${gp} gp`;
  if (gp >= 0.1) return `${gp * 10} sp`;
  return `${gp * 100} cp`;
}
