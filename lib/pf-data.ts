// ============================================================================
// PATHFINDER 1E RACE & CLASS DATA
// For character creation wizard
// ============================================================================

export interface RacialModifier {
  stat: string; // ability_str, ability_dex, etc.
  value: number;
  label: string;
}

export interface RacialTrait {
  name: string;
  description: string;
}

export interface Race {
  id: string;
  name: string;
  description: string;
  size: string;
  speed: number;
  abilityMods: RacialModifier[];
  traits: RacialTrait[];
  favoredClass?: string;
  tags: string[]; // "core", "featured", "uncommon", "custom"
}

export interface ClassSave {
  fort: "good" | "poor";
  ref: "good" | "poor";
  will: "good" | "poor";
}

export interface ClassSkill {
  name: string;
  ability: string;
}

export interface PFClass {
  id: string;
  name: string;
  description: string;
  hitDie: number;
  babProgression: "full" | "three-quarter" | "half";
  saves: ClassSave;
  skillsPerLevel: number; // base, before INT mod
  classSkills: string[];
  proficiencies: string[];
  level1Features: RacialTrait[]; // reuse same shape
  tags: string[]; // "core", "base", "hybrid", "occult", "prestige", "npc"
  // Levels at which this class grants bonus feats (in addition to standard odd-level feats)
  bonusFeatLevels?: number[];
  // Label for the bonus feat type (e.g. "Combat Feat", "Metamagic or Item Creation Feat")
  bonusFeatLabel?: string;
}

// ============================================================================
// BAB / SAVE TABLES
// ============================================================================

export function getBabAtLevel(progression: PFClass["babProgression"], level: number): number {
  switch (progression) {
    case "full":         return level;
    case "three-quarter": return Math.floor(level * 0.75);
    case "half":         return Math.floor(level * 0.5);
  }
}

export function getGoodSaveAtLevel(level: number): number {
  return 2 + Math.floor(level / 2);
}

export function getPoorSaveAtLevel(level: number): number {
  return Math.floor(level / 3);
}

// ============================================================================
// RACES
// ============================================================================

export const RACES: Race[] = [
  // ── CORE ──
  {
    id: "human",
    name: "Human",
    description: "Versatile and ambitious, humans are the most widespread race in the Inner Sea region.",
    size: "Medium",
    speed: 30,
    abilityMods: [
      // +2 to any one stat — handled specially in UI
    ],
    traits: [
      { name: "Bonus Feat", description: "Humans select one extra feat at 1st level." },
      { name: "Skilled", description: "Humans gain an additional skill rank at 1st level and one additional rank whenever they gain a level." },
    ],
    favoredClass: "Any",
    tags: ["core"],
  },
  {
    id: "elf",
    name: "Elf",
    description: "Elves are a long-lived and perceptive people with a rich magical tradition.",
    size: "Medium",
    speed: 30,
    abilityMods: [
      { stat: "ability_dex", value: 2, label: "DEX (Elf)" },
      { stat: "ability_int", value: 2, label: "INT (Elf)" },
      { stat: "ability_con", value: -2, label: "CON (Elf)" },
    ],
    traits: [
      { name: "Low-Light Vision", description: "Elves can see twice as far as humans in conditions of dim light." },
      { name: "Elven Immunities", description: "+2 racial saving throw bonus against enchantment spells and effects; immune to magic sleep effects." },
      { name: "Elven Magic", description: "+2 racial bonus on caster level checks to overcome spell resistance. +2 racial bonus on Spellcraft to identify magic item properties." },
      { name: "Keen Senses", description: "+2 racial bonus on Perception checks." },
      { name: "Weapon Familiarity", description: "Proficient with longbows, longswords, rapiers, and shortbows." },
    ],
    favoredClass: "Wizard",
    tags: ["core"],
  },
  {
    id: "dwarf",
    name: "Dwarf",
    description: "Dwarves are a stoic but stern race, ensconced in cities carved from the hearts of mountains.",
    size: "Medium",
    speed: 20,
    abilityMods: [
      { stat: "ability_con", value: 2, label: "CON (Dwarf)" },
      { stat: "ability_wis", value: 2, label: "WIS (Dwarf)" },
      { stat: "ability_cha", value: -2, label: "CHA (Dwarf)" },
    ],
    traits: [
      { name: "Darkvision 60 ft.", description: "Dwarves can see in the dark up to 60 feet." },
      { name: "Defensive Training", description: "+4 dodge bonus to AC against monsters of the giant subtype." },
      { name: "Greed", description: "+2 racial bonus on Appraise checks for nonmagical goods containing precious metals or gemstones." },
      { name: "Hardy", description: "+2 racial bonus on saving throws against poison, spells, and spell-like abilities." },
      { name: "Stability", description: "+4 racial bonus to CMD against bull rush and trip while standing on the ground." },
      { name: "Stonecunning", description: "+2 bonus on Perception checks to notice unusual stonework. Automatic check within 10 ft." },
      { name: "Weapon Familiarity", description: "Proficient with battleaxes, heavy picks, and warhammers." },
    ],
    favoredClass: "Fighter",
    tags: ["core"],
  },
  {
    id: "gnome",
    name: "Gnome",
    description: "Gnomes are the smallest of the common races, and also one of the most emotionally volatile.",
    size: "Small",
    speed: 20,
    abilityMods: [
      { stat: "ability_con", value: 2, label: "CON (Gnome)" },
      { stat: "ability_cha", value: 2, label: "CHA (Gnome)" },
      { stat: "ability_str", value: -2, label: "STR (Gnome)" },
    ],
    traits: [
      { name: "Small Size", description: "+1 size bonus to AC and attack rolls, +4 size bonus on Stealth checks, –1 penalty to CMB and CMD." },
      { name: "Low-Light Vision", description: "Gnomes can see twice as far as humans in conditions of dim light." },
      { name: "Defensive Training", description: "+4 dodge bonus to AC against monsters of the giant subtype." },
      { name: "Gnome Magic", description: "+1 DC to illusion spells. 1/day: dancing lights, ghost sound, prestidigitation, speak with animals (CHA ≥11)." },
      { name: "Hatred", description: "+1 racial bonus on attack rolls against humanoids of the reptilian and goblinoid subtypes." },
      { name: "Illusion Resistance", description: "+2 racial saving throw bonus against illusion spells and effects." },
      { name: "Keen Senses", description: "+2 racial bonus on Perception checks." },
      { name: "Weapon Familiarity", description: "Proficient with gnome hooked hammers." },
    ],
    favoredClass: "Bard",
    tags: ["core"],
  },
  {
    id: "halfling",
    name: "Halfling",
    description: "Halflings are a cunning, resourceful folk who tend to get along with just about everyone.",
    size: "Small",
    speed: 20,
    abilityMods: [
      { stat: "ability_dex", value: 2, label: "DEX (Halfling)" },
      { stat: "ability_cha", value: 2, label: "CHA (Halfling)" },
      { stat: "ability_str", value: -2, label: "STR (Halfling)" },
    ],
    traits: [
      { name: "Small Size", description: "+1 size bonus to AC and attack rolls, +4 size bonus on Stealth checks, –1 penalty to CMB and CMD." },
      { name: "Fearless", description: "+2 racial bonus on all saving throws against fear effects." },
      { name: "Halfling Luck", description: "+1 racial bonus on all saving throws." },
      { name: "Keen Senses", description: "+2 racial bonus on Perception checks." },
      { name: "Sure-Footed", description: "+2 racial bonus on Acrobatics and Climb checks." },
      { name: "Weapon Familiarity", description: "Proficient with slings and treat any weapon with 'halfling' in its name as a martial weapon." },
    ],
    favoredClass: "Rogue",
    tags: ["core"],
  },
  {
    id: "half-elf",
    name: "Half-Elf",
    description: "Half-elves stand between the worlds of their elven and human parents.",
    size: "Medium",
    speed: 30,
    abilityMods: [
      // +2 to any one stat — handled specially in UI
    ],
    traits: [
      { name: "Adaptability", description: "Skill Focus as a bonus feat at 1st level." },
      { name: "Elven Immunities", description: "+2 racial saving throw bonus against enchantment spells and effects; immune to magic sleep effects." },
      { name: "Keen Senses", description: "+2 racial bonus on Perception checks." },
      { name: "Low-Light Vision", description: "Can see twice as far as humans in dim light." },
      { name: "Multitalented", description: "Choose two favored classes at 1st level." },
    ],
    favoredClass: "Any two",
    tags: ["core"],
  },
  {
    id: "half-orc",
    name: "Half-Orc",
    description: "Half-orcs are monstrous humanoids that stand between two worlds.",
    size: "Medium",
    speed: 30,
    abilityMods: [
      // +2 to any one stat — handled specially in UI
    ],
    traits: [
      { name: "Darkvision 60 ft.", description: "Half-orcs can see in the dark up to 60 feet." },
      { name: "Intimidating", description: "+2 racial bonus on Intimidate checks." },
      { name: "Orc Blood", description: "Counts as both human and orc for effects relating to race." },
      { name: "Orc Ferocity", description: "1/day: remain conscious and continue fighting when below 0 HP, but is staggered. Falls unconscious on next turn if not healed above 0." },
      { name: "Weapon Familiarity", description: "Proficient with greataxes and falchions; treat weapons with 'orc' in name as martial weapons." },
    ],
    favoredClass: "Barbarian",
    tags: ["core"],
  },
  // ── FEATURED ──
  {
    id: "aasimar",
    name: "Aasimar",
    description: "Aasimars are humans touched by the power of Mount Celestia.",
    size: "Medium",
    speed: 30,
    abilityMods: [
      { stat: "ability_wis", value: 2, label: "WIS (Aasimar)" },
      { stat: "ability_cha", value: 2, label: "CHA (Aasimar)" },
    ],
    traits: [
      { name: "Darkvision 60 ft.", description: "Aasimars can see in the dark up to 60 feet." },
      { name: "Celestial Resistance", description: "Acid resistance 5, cold resistance 5, electricity resistance 5." },
      { name: "Skilled", description: "+2 racial bonus on Diplomacy and Perception checks." },
      { name: "Spell-Like Ability", description: "1/day: daylight (CL = character level)." },
    ],
    favoredClass: "Paladin",
    tags: ["featured"],
  },
  {
    id: "tiefling",
    name: "Tiefling",
    description: "Tieflings are humans with demonic or diabolic blood in their veins.",
    size: "Medium",
    speed: 30,
    abilityMods: [
      { stat: "ability_dex", value: 2, label: "DEX (Tiefling)" },
      { stat: "ability_int", value: 2, label: "INT (Tiefling)" },
      { stat: "ability_cha", value: -2, label: "CHA (Tiefling)" },
    ],
    traits: [
      { name: "Darkvision 60 ft.", description: "Tieflings can see in the dark up to 60 feet." },
      { name: "Fiendish Resistance", description: "Cold resistance 5, electricity resistance 5, fire resistance 5." },
      { name: "Skilled", description: "+2 racial bonus on Bluff and Stealth checks." },
      { name: "Spell-Like Ability", description: "1/day: darkness (CL = character level)." },
    ],
    favoredClass: "Rogue",
    tags: ["featured"],
  },
  {
    id: "dhampir",
    name: "Dhampir",
    description: "Dhampirs are the offspring of vampires and mortals.",
    size: "Medium",
    speed: 30,
    abilityMods: [
      { stat: "ability_dex", value: 2, label: "DEX (Dhampir)" },
      { stat: "ability_cha", value: 2, label: "CHA (Dhampir)" },
      { stat: "ability_con", value: -2, label: "CON (Dhampir)" },
    ],
    traits: [
      { name: "Low-Light Vision", description: "Can see twice as far in dim light." },
      { name: "Darkvision 60 ft.", description: "Can see in the dark up to 60 feet." },
      { name: "Undead Resistance", description: "+2 racial bonus on saving throws against disease and mind-affecting effects." },
      { name: "Light Sensitivity", description: "Dazzled in areas of bright sunlight or within the radius of a daylight spell." },
      { name: "Negative Energy Affinity", description: "Reacts to positive/negative energy as an undead creature." },
      { name: "Spell-Like Ability", description: "1/day: detect undead (CL = character level)." },
    ],
    favoredClass: "Rogue",
    tags: ["featured"],
  },
  {
    id: "drow",
    name: "Drow",
    description: "Dark elves of the Underdark, drow are powerful but shunned by surface society.",
    size: "Medium",
    speed: 30,
    abilityMods: [
      { stat: "ability_dex", value: 2, label: "DEX (Drow)" },
      { stat: "ability_int", value: 2, label: "INT (Drow)" },
      { stat: "ability_cha", value: 2, label: "CHA (Drow)" },
      { stat: "ability_con", value: -2, label: "CON (Drow)" },
    ],
    traits: [
      { name: "Darkvision 120 ft.", description: "Drow can see in the dark up to 120 feet." },
      { name: "Drow Immunities", description: "Immune to magical sleep effects. +2 racial bonus on saves against enchantment spells and effects." },
      { name: "Keen Senses", description: "+2 racial bonus on Perception checks." },
      { name: "Light Blindness", description: "Abruptly exposed to bright light, drow are blinded for 1 round; on subsequent rounds, dazzled." },
      { name: "Poison Use", description: "Drow are skilled in the use of poison and never risk accidentally poisoning themselves." },
      { name: "Spell Resistance", description: "11 + class level spell resistance." },
      { name: "Spell-Like Abilities", description: "1/day: dancing lights, darkness, faerie fire (CL = character level)." },
      { name: "Weapon Familiarity", description: "Proficient with hand crossbows, rapiers, and short swords." },
    ],
    favoredClass: "Wizard",
    tags: ["featured"],
  },
  {
    id: "fetchling",
    name: "Fetchling",
    description: "Fetchlings are humans whose ancestors were stranded in the Shadow Plane.",
    size: "Medium",
    speed: 30,
    abilityMods: [
      { stat: "ability_dex", value: 2, label: "DEX (Fetchling)" },
      { stat: "ability_cha", value: 2, label: "CHA (Fetchling)" },
      { stat: "ability_wis", value: -2, label: "WIS (Fetchling)" },
    ],
    traits: [
      { name: "Darkvision 60 ft.", description: "Can see in the dark up to 60 feet." },
      { name: "Low-Light Vision", description: "Can see twice as far in dim light." },
      { name: "Shadow Blending", description: "Attacks in dim light have a 50% miss chance instead of 20%." },
      { name: "Shadowy Resistance", description: "Cold resistance 5 and electricity resistance 5." },
      { name: "Skilled", description: "+2 racial bonus on Knowledge (planes) and Stealth checks." },
      { name: "Spell-Like Ability", description: "1/day: disguise self (CL = character level)." },
    ],
    favoredClass: "Rogue",
    tags: ["featured"],
  },
  {
    id: "ifrit",
    name: "Ifrit",
    description: "Ifrits are humans with ties to the elemental plane of fire.",
    size: "Medium",
    speed: 30,
    abilityMods: [
      { stat: "ability_dex", value: 2, label: "DEX (Ifrit)" },
      { stat: "ability_cha", value: 2, label: "CHA (Ifrit)" },
      { stat: "ability_wis", value: -2, label: "WIS (Ifrit)" },
    ],
    traits: [
      { name: "Darkvision 60 ft.", description: "Can see in the dark up to 60 feet." },
      { name: "Energy Resistance", description: "Fire resistance 5." },
      { name: "Fire Affinity", description: "+1 CL for fire spells; +1 DC for fire spells." },
      { name: "Spell-Like Ability", description: "1/day: burning hands (CL = character level)." },
    ],
    favoredClass: "Sorcerer",
    tags: ["featured"],
  },
  // ── CUSTOM ──
  {
    id: "custom",
    name: "Custom / Homebrew",
    description: "Enter a custom race name and manually configure any racial modifiers.",
    size: "Medium",
    speed: 30,
    abilityMods: [],
    traits: [],
    tags: ["custom"],
  },
];

// ============================================================================
// CLASSES
// ============================================================================

export const CLASSES: PFClass[] = [
  // ── CORE ──
  {
    id: "barbarian",
    name: "Barbarian",
    description: "A fierce warrior who can enter a battle rage.",
    hitDie: 12,
    babProgression: "full",
    saves: { fort: "good", ref: "poor", will: "poor" },
    skillsPerLevel: 4,
    classSkills: ["Acrobatics", "Climb", "Craft", "Handle Animal", "Intimidate", "Knowledge (Nature)", "Perception", "Ride", "Survival", "Swim"],
    proficiencies: ["All simple weapons", "All martial weapons", "Light armor", "Medium armor", "Shields (except tower shields)"],
    level1Features: [
      { name: "Fast Movement", description: "+10 ft. land speed (in light or no armor)." },
      { name: "Rage", description: "Rage for a number of rounds per day equal to 4 + CON modifier. +4 morale bonus to STR and CON, +2 morale bonus on Will saves, –2 penalty to AC." },
    ],
    tags: ["core"],
  },
  {
    id: "bard",
    name: "Bard",
    description: "A performer whose music works magic.",
    hitDie: 8,
    babProgression: "three-quarter",
    saves: { fort: "poor", ref: "good", will: "good" },
    skillsPerLevel: 6,
    classSkills: ["Acrobatics", "Appraise", "Bluff", "Climb", "Craft", "Diplomacy", "Disguise", "Escape Artist", "Intimidate", "Knowledge (All)", "Linguistics", "Perception", "Perform (All)", "Profession", "Sense Motive", "Sleight of Hand", "Spellcraft", "Stealth", "Use Magic Device"],
    proficiencies: ["All simple weapons", "Longsword", "Rapier", "Sap", "Short sword", "Shortbow", "Whip", "Light armor", "Shields (except tower shields)"],
    level1Features: [
      { name: "Bardic Knowledge", description: "+1/2 bard level (min 1) on all Knowledge skill checks; all Knowledge skills as class skills." },
      { name: "Bardic Performance", description: "Use performance to create magical effects. Rounds/day: 4 + CHA modifier." },
      { name: "Cantrips", description: "Cast 0-level spells an unlimited number of times." },
      { name: "Countersong", description: "Use Perform to counter magical effects that depend on sound." },
      { name: "Distraction", description: "Use Perform to counter magical effects that depend on sight." },
      { name: "Fascinate", description: "Use Perform to cause up to 1 creature per 3 bard levels to become fascinated." },
      { name: "Inspire Courage +1", description: "+1 morale bonus on saving throws against charm and fear, and attack and weapon damage rolls." },
    ],
    tags: ["core"],
  },
  {
    id: "cleric",
    name: "Cleric",
    description: "A divine spellcaster who serves a deity.",
    hitDie: 8,
    babProgression: "three-quarter",
    saves: { fort: "good", ref: "poor", will: "good" },
    skillsPerLevel: 2,
    classSkills: ["Appraise", "Craft", "Diplomacy", "Heal", "Knowledge (Arcana)", "Knowledge (History)", "Knowledge (Nobility)", "Knowledge (Planes)", "Knowledge (Religion)", "Linguistics", "Profession", "Sense Motive", "Spellcraft"],
    proficiencies: ["All simple weapons", "Deity's favored weapon", "Light armor", "Medium armor", "Heavy armor", "All shields (including tower shields)"],
    level1Features: [
      { name: "Aura", description: "A cleric of a chaotic, evil, good, or lawful deity has a particularly powerful aura (see detect evil)." },
      { name: "Channel Energy", description: "Channel positive or negative energy. 1d6 damage/healing. 3 + CHA modifier times per day." },
      { name: "Domains", description: "Choose two domains from your deity's list. Gain domain powers and bonus spells." },
      { name: "Orisons", description: "Prepare 0-level spells as orisons. Cast an unlimited number per day." },
      { name: "Spontaneous Casting", description: "Exchange prepared spells for cure (good/neutral) or inflict (evil) spells." },
    ],
    tags: ["core"],
  },
  {
    id: "druid",
    name: "Druid",
    description: "A nature priest who can shapeshift into animals.",
    hitDie: 8,
    babProgression: "three-quarter",
    saves: { fort: "good", ref: "poor", will: "good" },
    skillsPerLevel: 4,
    classSkills: ["Climb", "Craft", "Fly", "Handle Animal", "Heal", "Knowledge (Geography)", "Knowledge (Nature)", "Perception", "Profession", "Ride", "Spellcraft", "Survival", "Swim"],
    proficiencies: ["Club", "Dagger", "Dart", "Quarterstaff", "Scimitar", "Scythe", "Sickle", "Shortspear", "Sling", "Spear", "Light armor (non-metal)", "Medium armor (non-metal)", "Shields (non-metal, except tower shields)"],
    level1Features: [
      { name: "Nature Bond", description: "Bond with an animal companion or choose a cleric domain." },
      { name: "Nature Sense", description: "+2 bonus on Knowledge (Nature) and Survival checks." },
      { name: "Orisons", description: "Prepare 0-level spells as orisons. Cast an unlimited number per day." },
      { name: "Wild Empathy", description: "Improve attitude of animals. 1d20 + druid level + CHA modifier." },
    ],
    tags: ["core"],
  },
  {
    id: "fighter",
    name: "Fighter",
    description: "A master of martial combat, skilled with a wide variety of weapons and armor.",
    hitDie: 10,
    babProgression: "full",
    saves: { fort: "good", ref: "poor", will: "poor" },
    skillsPerLevel: 2,
    classSkills: ["Climb", "Craft", "Handle Animal", "Intimidate", "Knowledge (Dungeoneering)", "Knowledge (Engineering)", "Profession", "Ride", "Survival", "Swim"],
    proficiencies: ["All simple weapons", "All martial weapons", "All armor (light, medium, heavy)", "All shields (including tower shields)"],
    level1Features: [
      { name: "Bonus Feat", description: "Gain a bonus combat feat at 1st level and every even fighter level thereafter." },
    ],
    bonusFeatLevels: [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
    bonusFeatLabel: "Combat Feat",
    tags: ["core"],
    name: "Monk",
    description: "A master of martial arts who uses ki to achieve extraordinary feats.",
    hitDie: 8,
    babProgression: "three-quarter",
    saves: { fort: "good", ref: "good", will: "good" },
    skillsPerLevel: 4,
    classSkills: ["Acrobatics", "Climb", "Craft", "Escape Artist", "Intimidate", "Knowledge (History)", "Knowledge (Religion)", "Perception", "Perform (All)", "Profession", "Ride", "Sense Motive", "Stealth", "Swim"],
    proficiencies: ["Club", "Crossbow (light or heavy)", "Dagger", "Handaxe", "Javelin", "Kama", "Nunchaku", "Quarterstaff", "Sai", "Shortspear", "Short sword", "Shuriken", "Siangham", "Sling", "Spear"],
    level1Features: [
      { name: "Bonus Feat", description: "Improved Grapple or Stunning Fist as a bonus feat." },
      { name: "Flurry of Blows", description: "Make one extra attack per round at highest BAB, with all attacks at –2." },
      { name: "Stunning Fist", description: "1/round: attempt to stun foe (Fort DC 10 + 1/2 monk level + WIS mod negates)." },
      { name: "Unarmed Strike", description: "1d6 unarmed strike damage. Treated as both natural and manufactured weapons." },
    ],
    bonusFeatLevels: [1, 2, 6, 10, 14, 18],
    bonusFeatLabel: "Combat or Style Feat",
    tags: ["core"],
    name: "Paladin",
    description: "A holy warrior bound to a sacred oath.",
    hitDie: 10,
    babProgression: "full",
    saves: { fort: "good", ref: "poor", will: "good" },
    skillsPerLevel: 2,
    classSkills: ["Craft", "Diplomacy", "Handle Animal", "Heal", "Knowledge (Nobility)", "Knowledge (Religion)", "Profession", "Ride", "Sense Motive", "Spellcraft"],
    proficiencies: ["All simple weapons", "All martial weapons", "All armor (light, medium, heavy)", "All shields (including tower shields)"],
    level1Features: [
      { name: "Aura of Good", description: "Paladin exudes an overwhelming aura of good." },
      { name: "Detect Evil", description: "At will: detect evil as a spell-like ability." },
      { name: "Smite Evil", description: "1/day: +CHA mod to attack, +paladin level to damage vs evil creatures. +2 AC against smited creature." },
    ],
    tags: ["core"],
  },
  {
    id: "ranger",
    name: "Ranger",
    description: "A hunter and tracker who excels in wilderness settings.",
    hitDie: 10,
    babProgression: "full",
    saves: { fort: "good", ref: "good", will: "poor" },
    skillsPerLevel: 6,
    classSkills: ["Climb", "Craft", "Handle Animal", "Heal", "Intimidate", "Knowledge (Dungeoneering)", "Knowledge (Geography)", "Knowledge (Nature)", "Perception", "Profession", "Ride", "Spellcraft", "Stealth", "Survival", "Swim"],
    proficiencies: ["All simple weapons", "All martial weapons", "Light armor", "Medium armor", "Shields (except tower shields)"],
    level1Features: [
      { name: "Favored Enemy", description: "+2 bonus on Bluff, Knowledge, Perception, Sense Motive, and Survival checks against chosen enemy type. +2 attack and damage." },
      { name: "Track", description: "+1/2 ranger level on Survival checks to follow or identify tracks." },
      { name: "Wild Empathy", description: "Improve attitude of animals. 1d20 + ranger level + CHA modifier." },
    ],
    tags: ["core"],
  },
  {
    id: "rogue",
    name: "Rogue",
    description: "A skilled trickster who excels at stealth and trickery.",
    hitDie: 8,
    babProgression: "three-quarter",
    saves: { fort: "poor", ref: "good", will: "poor" },
    skillsPerLevel: 8,
    classSkills: ["Acrobatics", "Appraise", "Bluff", "Climb", "Craft", "Diplomacy", "Disable Device", "Disguise", "Escape Artist", "Intimidate", "Knowledge (Dungeoneering)", "Knowledge (Local)", "Linguistics", "Perception", "Perform (All)", "Profession", "Sense Motive", "Sleight of Hand", "Stealth", "Swim", "Use Magic Device"],
    proficiencies: ["All simple weapons", "Hand crossbow", "Rapier", "Sap", "Short sword", "Shortbow", "Light armor"],
    level1Features: [
      { name: "Sneak Attack +1d6", description: "+1d6 precision damage when flanking or target is flat-footed." },
      { name: "Trapfinding", description: "+1/2 rogue level on Perception to find traps and Disable Device. Can disarm magic traps." },
    ],
    tags: ["core"],
  },
  {
    id: "sorcerer",
    name: "Sorcerer",
    description: "A spellcaster who draws power from within via a magical bloodline.",
    hitDie: 6,
    babProgression: "half",
    saves: { fort: "poor", ref: "poor", will: "good" },
    skillsPerLevel: 2,
    classSkills: ["Appraise", "Bluff", "Craft", "Fly", "Intimidate", "Knowledge (Arcana)", "Profession", "Spellcraft", "Use Magic Device"],
    proficiencies: ["All simple weapons", "No armor", "No shields"],
    level1Features: [
      { name: "Bloodline", description: "Choose a sorcerer bloodline. Gain a class skill, bloodline arcana, bloodline powers, bonus spells, and bonus feats." },
      { name: "Cantrips", description: "Cast 0-level spells an unlimited number of times." },
      { name: "Eschew Materials", description: "Bonus feat: Eschew Materials." },
    ],
    tags: ["core"],
  },
  {
    id: "wizard",
    name: "Wizard",
    description: "A scholarly magic-user capable of mighty spells.",
    hitDie: 6,
    babProgression: "half",
    saves: { fort: "poor", ref: "poor", will: "good" },
    skillsPerLevel: 2,
    classSkills: ["Appraise", "Craft", "Fly", "Knowledge (All)", "Linguistics", "Profession", "Spellcraft"],
    proficiencies: ["Club", "Dagger", "Heavy crossbow", "Light crossbow", "Quarterstaff", "No armor", "No shields"],
    level1Features: [
      { name: "Arcane Bond", description: "Bond with a familiar or an object (staff, wand, or weapon)." },
      { name: "Arcane School", description: "Specialize in a school of magic, gaining bonus spells and powers. Forbidden schools lose 2 spell slots per level." },
      { name: "Cantrips", description: "Prepare 0-level spells as cantrips. Cast an unlimited number per day." },
      { name: "Scribe Scroll", description: "Bonus feat: Scribe Scroll at 1st level." },
      { name: "Spellbook", description: "Record spells in a spellbook. 3+INT modifier 1st-level spells at start. Copy additional spells from scrolls and other spellbooks." },
    ],
    bonusFeatLevels: [1, 5, 10, 15, 20],
    bonusFeatLabel: "Metamagic, Item Creation, or Spell Mastery Feat",
    tags: ["core"],
  {
    id: "alchemist",
    name: "Alchemist",
    description: "A master of extracts, bombs, and mutagens.",
    hitDie: 8,
    babProgression: "three-quarter",
    saves: { fort: "good", ref: "good", will: "poor" },
    skillsPerLevel: 4,
    classSkills: ["Appraise", "Craft", "Disable Device", "Fly", "Heal", "Knowledge (Arcana)", "Knowledge (Nature)", "Perception", "Profession", "Sleight of Hand", "Spellcraft", "Survival", "Use Magic Device"],
    proficiencies: ["All simple weapons", "Bombs", "Light armor", "Medium armor"],
    level1Features: [
      { name: "Alchemy", description: "Create alchemical items with Craft (Alchemy) at +level on checks." },
      { name: "Bomb", description: "1d6 + INT modifier fire damage. 3 + INT modifier bombs per day. Splash damage. Range increment 20 ft." },
      { name: "Brew Potion", description: "Bonus feat: Brew Potion." },
      { name: "Mutagen", description: "+4 alchemical bonus to one physical ability score, +2 natural armor bonus, –2 penalty to associated mental ability score. Lasts 10 min./level." },
      { name: "Throw Anything", description: "Bonus feat: Throw Anything." },
    ],
    tags: ["base"],
  },
  {
    id: "cavalier",
    name: "Cavalier",
    description: "A mounted warrior who leads by example.",
    hitDie: 10,
    babProgression: "full",
    saves: { fort: "good", ref: "poor", will: "poor" },
    skillsPerLevel: 4,
    classSkills: ["Bluff", "Climb", "Craft", "Diplomacy", "Handle Animal", "Intimidate", "Profession", "Ride", "Sense Motive", "Swim"],
    proficiencies: ["All simple weapons", "All martial weapons", "All armor", "All shields (including tower shields)"],
    level1Features: [
      { name: "Challenge", description: "1/day: +1/cavalier level damage against challenged foe. Allies gain +1 to attack the challenged foe. –2 AC against others while challenge active." },
      { name: "Mount", description: "Gain the service of a loyal mount." },
      { name: "Order", description: "Join a cavalier order granting edicts, skills, and abilities." },
      { name: "Tactician", description: "Grant a teamwork feat to allies within 30 ft. who can see and hear you. Duration: 3 rounds. Use 1/day + 1 per 5 levels." },
    ],
    tags: ["base"],
  },
  {
    id: "gunslinger",
    name: "Gunslinger",
    description: "A martial combatant who uses grit and firearms.",
    hitDie: 10,
    babProgression: "full",
    saves: { fort: "good", ref: "good", will: "poor" },
    skillsPerLevel: 4,
    classSkills: ["Acrobatics", "Bluff", "Climb", "Craft", "Handle Animal", "Heal", "Intimidate", "Knowledge (Engineering)", "Knowledge (Local)", "Perception", "Profession", "Ride", "Sleight of Hand", "Survival", "Swim"],
    proficiencies: ["All simple weapons", "All martial weapons", "All firearms", "Light armor", "Medium armor", "Shields (except tower shields)"],
    level1Features: [
      { name: "Deeds", description: "Spend grit to perform dramatic deeds. At level 1: Deadeye, Gunslinger's Dodge, Quick Clear." },
      { name: "Grit", description: "WIS modifier grit points. Regain 1 by killing foe with firearm critical or confirming critical hit with firearm." },
      { name: "Gunsmith", description: "Free masterwork firearm at 1st level. Craft Firearms as class skill." },
    ],
    tags: ["base"],
  },
  {
    id: "inquisitor",
    name: "Inquisitor",
    description: "A divine hunter who tracks down enemies of the faith.",
    hitDie: 8,
    babProgression: "three-quarter",
    saves: { fort: "good", ref: "poor", will: "good" },
    skillsPerLevel: 6,
    classSkills: ["Bluff", "Climb", "Craft", "Diplomacy", "Disguise", "Heal", "Intimidate", "Knowledge (Arcana)", "Knowledge (Dungeoneering)", "Knowledge (Nature)", "Knowledge (Planes)", "Knowledge (Religion)", "Perception", "Profession", "Ride", "Sense Motive", "Spellcraft", "Stealth", "Survival", "Swim"],
    proficiencies: ["All simple weapons", "Deity's favored weapon", "Light armor", "Medium armor", "Shields (except tower shields)"],
    level1Features: [
      { name: "Domain", description: "Choose one domain from deity's list. Gain domain powers but no domain spells." },
      { name: "Judgment", description: "1/day: swift action to choose one of several judgments granting bonuses. Lasts until combat ends." },
      { name: "Monster Lore", description: "+WIS modifier on Knowledge checks to identify monster abilities and weaknesses." },
      { name: "Orisons", description: "Prepare 0-level spells as orisons. Cast unlimited per day." },
      { name: "Stern Gaze", description: "+1/2 inquisitor level on Intimidate and Sense Motive checks." },
    ],
    tags: ["base"],
  },
  {
    id: "magus",
    name: "Magus",
    description: "A spellblade who combines arcane magic with martial prowess.",
    hitDie: 8,
    babProgression: "three-quarter",
    saves: { fort: "good", ref: "poor", will: "good" },
    skillsPerLevel: 2,
    classSkills: ["Climb", "Craft", "Fly", "Intimidate", "Knowledge (Arcana)", "Knowledge (Dungeoneering)", "Profession", "Ride", "Spellcraft", "Swim", "Use Magic Device"],
    proficiencies: ["All simple weapons", "All martial weapons", "Light armor", "Medium armor"],
    level1Features: [
      { name: "Arcane Pool", description: "INT modifier arcane pool points. Enhance weapon as swift action: +1 per 3 levels, enhances to +1 magic for 1 minute." },
      { name: "Cantrips", description: "Cast 0-level spells unlimited times per day." },
      { name: "Spell Combat", description: "Make full attack and cast a spell in the same round. –2 on all attacks." },
    ],
    tags: ["base"],
  },
  {
    id: "oracle",
    name: "Oracle",
    description: "A divine spellcaster touched by divine mystery.",
    hitDie: 8,
    babProgression: "three-quarter",
    saves: { fort: "poor", ref: "poor", will: "good" },
    skillsPerLevel: 4,
    classSkills: ["Craft", "Diplomacy", "Heal", "Knowledge (History)", "Knowledge (Planes)", "Knowledge (Religion)", "Profession", "Sense Motive", "Spellcraft"],
    proficiencies: ["All simple weapons", "Light armor", "Medium armor", "Shields (except tower shields)"],
    level1Features: [
      { name: "Curse", description: "Choose a curse. Imposes penalties that grow over time but also grants compensatory powers." },
      { name: "Mystery", description: "Choose a mystery granting class skills, bonus spells, revelations, and a final revelation." },
      { name: "Orisons", description: "Cast 0-level spells unlimited times per day." },
      { name: "Revelation", description: "Gain one revelation from your mystery." },
    ],
    tags: ["base"],
  },
  {
    id: "summoner",
    name: "Summoner",
    description: "A spellcaster bonded to a powerful outsider called an eidolon.",
    hitDie: 8,
    babProgression: "three-quarter",
    saves: { fort: "poor", ref: "poor", will: "good" },
    skillsPerLevel: 2,
    classSkills: ["Craft", "Fly", "Handle Animal", "Knowledge (Arcana)", "Knowledge (Planes)", "Linguistics", "Profession", "Ride", "Spellcraft", "Use Magic Device"],
    proficiencies: ["All simple weapons", "Light armor", "No shields"],
    level1Features: [
      { name: "Cantrips", description: "Cast 0-level spells unlimited times per day." },
      { name: "Eidolon", description: "Summon a bonded eidolon as a standard action. Eidolon has base form and evolution pool. Shares HP pool with summoner." },
      { name: "Life Link", description: "Sacrifice HP to prevent eidolon from being returned to home plane." },
      { name: "Summon Monster I", description: "1/day: summon monster I as a spell-like ability (CL = summoner level)." },
    ],
    tags: ["base"],
  },
  {
    id: "witch",
    name: "Witch",
    description: "A spellcaster who draws power from a mysterious patron.",
    hitDie: 6,
    babProgression: "half",
    saves: { fort: "poor", ref: "poor", will: "good" },
    skillsPerLevel: 2,
    classSkills: ["Craft", "Fly", "Heal", "Intimidate", "Knowledge (Arcana)", "Knowledge (History)", "Knowledge (Nature)", "Knowledge (Planes)", "Profession", "Spellcraft", "Use Magic Device"],
    proficiencies: ["All simple weapons", "No armor", "No shields"],
    level1Features: [
      { name: "Cantrips", description: "Cast 0-level spells unlimited times per day." },
      { name: "Familiar", description: "Gain a familiar that stores spells. Familiar must be consulted to prepare spells. Lost if familiar killed." },
      { name: "Hex", description: "Gain one hex. Hexes are supernatural abilities usable 1/day per target (unless noted)." },
      { name: "Patron", description: "Choose a patron theme that grants bonus spells at odd levels." },
    ],
    tags: ["base"],
  },
  // ── HYBRID ──
  {
    id: "arcanist",
    name: "Arcanist",
    description: "A hybrid of wizard and sorcerer, preparing spells but casting spontaneously.",
    hitDie: 6,
    babProgression: "half",
    saves: { fort: "poor", ref: "poor", will: "good" },
    skillsPerLevel: 2,
    classSkills: ["Appraise", "Craft", "Fly", "Knowledge (All)", "Linguistics", "Profession", "Spellcraft", "Use Magic Device"],
    proficiencies: ["All simple weapons", "No armor", "No shields"],
    level1Features: [
      { name: "Arcane Reservoir", description: "3 + INT modifier arcane reservoir points. Spend 1 to increase CL or spell DC by 1." },
      { name: "Arcanist Exploits", description: "Gain one arcanist exploit. Additional exploits at 3rd and every 2 levels thereafter." },
      { name: "Cantrips", description: "Cast 0-level spells unlimited times per day." },
    ],
    tags: ["hybrid"],
  },
  {
    id: "bloodrager",
    name: "Bloodrager",
    description: "A barbarian-sorcerer hybrid who rages and channels bloodline power.",
    hitDie: 10,
    babProgression: "full",
    saves: { fort: "good", ref: "poor", will: "poor" },
    skillsPerLevel: 4,
    classSkills: ["Acrobatics", "Climb", "Craft", "Handle Animal", "Intimidate", "Knowledge (Arcana)", "Perception", "Ride", "Spellcraft", "Survival", "Swim"],
    proficiencies: ["All simple weapons", "All martial weapons", "Light armor", "Medium armor", "Shields (except tower shields)"],
    level1Features: [
      { name: "Bloodline", description: "Choose a bloodrager bloodline that modifies your bloodrage and grants powers at higher levels." },
      { name: "Bloodrage", description: "+4 morale bonus to STR and CON, +2 to Will saves, –2 AC. 4 + CON modifier rounds/day." },
      { name: "Fast Movement", description: "+10 ft. land speed (light/no armor)." },
    ],
    tags: ["hybrid"],
  },
  {
    id: "brawler",
    name: "Brawler",
    description: "A hybrid of fighter and monk who excels at unarmed combat.",
    hitDie: 10,
    babProgression: "full",
    saves: { fort: "good", ref: "good", will: "poor" },
    skillsPerLevel: 4,
    classSkills: ["Acrobatics", "Climb", "Craft", "Escape Artist", "Handle Animal", "Intimidate", "Knowledge (Local)", "Perception", "Profession", "Ride", "Sense Motive", "Swim"],
    proficiencies: ["All simple weapons", "All martial weapons", "Light armor", "Medium armor", "Shields (except tower shields)"],
    level1Features: [
      { name: "Brawler's Cunning", description: "Counts as INT 13 for combat feat prerequisites." },
      { name: "Improved Unarmed Strike", description: "Bonus feat: Improved Unarmed Strike." },
      { name: "Martial Flexibility", description: "4/day: swift action to gain a combat feat for 1 minute." },
      { name: "Martial Training", description: "Counts as fighter and monk for feat prerequisites." },
      { name: "Unarmed Strike", description: "1d6 unarmed strike damage." },
    ],
    bonusFeatLevels: [1, 2, 5, 8, 11, 14, 17, 20],
    bonusFeatLabel: "Combat Feat",
    tags: ["hybrid"],
  },
  {
    id: "hunter",
    name: "Hunter",
    description: "A druid-ranger hybrid who forms a powerful bond with an animal companion.",
    hitDie: 8,
    babProgression: "three-quarter",
    saves: { fort: "good", ref: "good", will: "poor" },
    skillsPerLevel: 6,
    classSkills: ["Climb", "Craft", "Handle Animal", "Heal", "Intimidate", "Knowledge (Dungeoneering)", "Knowledge (Geography)", "Knowledge (Nature)", "Perception", "Profession", "Ride", "Spellcraft", "Stealth", "Survival", "Swim"],
    proficiencies: ["All simple weapons", "All martial weapons", "Light armor", "Medium armor", "Shields (except tower shields)"],
    level1Features: [
      { name: "Animal Companion", description: "Gain an animal companion using druid level – 3." },
      { name: "Animal Focus", description: "Swift action: gain animal focus for 1 minute/day per hunter level." },
      { name: "Orisons", description: "Cast 0-level spells unlimited times per day." },
      { name: "Wild Empathy", description: "Improve animal attitude. 1d20 + hunter level + CHA modifier." },
    ],
    tags: ["hybrid"],
  },
  {
    id: "investigator",
    name: "Investigator",
    description: "A rogue-alchemist hybrid who uses logic and alchemy to solve problems.",
    hitDie: 8,
    babProgression: "three-quarter",
    saves: { fort: "poor", ref: "good", will: "good" },
    skillsPerLevel: 6,
    classSkills: ["Appraise", "Artistry", "Bluff", "Craft", "Diplomacy", "Disable Device", "Disguise", "Escape Artist", "Heal", "Intimidate", "Knowledge (All)", "Linguistics", "Perception", "Perform (All)", "Profession", "Sense Motive", "Sleight of Hand", "Spellcraft", "Stealth", "Use Magic Device"],
    proficiencies: ["All simple weapons", "Rapier", "Sap", "Shortbow", "Short sword", "Light armor"],
    level1Features: [
      { name: "Alchemy", description: "Create alchemical items. +investigator level on Craft (Alchemy) checks." },
      { name: "Inspiration", description: "INT modifier + 3 inspiration pool. Roll 1d6 and add to skill checks or ability checks (no action)." },
      { name: "Trapfinding", description: "+1/2 investigator level on Perception to find traps and Disable Device." },
    ],
    tags: ["hybrid"],
  },
  {
    id: "shaman",
    name: "Shaman",
    description: "A witch-oracle hybrid who communes with spirits.",
    hitDie: 8,
    babProgression: "three-quarter",
    saves: { fort: "poor", ref: "poor", will: "good" },
    skillsPerLevel: 4,
    classSkills: ["Craft", "Diplomacy", "Fly", "Handle Animal", "Heal", "Knowledge (Arcana)", "Knowledge (Nature)", "Knowledge (Planes)", "Knowledge (Religion)", "Profession", "Ride", "Sense Motive", "Spellcraft", "Survival"],
    proficiencies: ["All simple weapons", "Light armor", "Medium armor", "Shields (except tower shields)"],
    level1Features: [
      { name: "Hex", description: "Gain one hex from the shaman or spirit hex list." },
      { name: "Orisons", description: "Cast 0-level spells unlimited times per day." },
      { name: "Spirit", description: "Choose a wandering spirit and a spirit animal. Gain spirit abilities, bonus spells, and hexes." },
    ],
    tags: ["hybrid"],
  },
  {
    id: "skald",
    name: "Skald",
    description: "A bard-barbarian hybrid who inspires allies to rage.",
    hitDie: 8,
    babProgression: "three-quarter",
    saves: { fort: "good", ref: "poor", will: "good" },
    skillsPerLevel: 4,
    classSkills: ["Acrobatics", "Bluff", "Climb", "Craft", "Diplomacy", "Escape Artist", "Intimidate", "Knowledge (All)", "Linguistics", "Perception", "Perform (All)", "Profession", "Sense Motive", "Sleight of Hand", "Swim"],
    proficiencies: ["All simple weapons", "All martial weapons", "Light armor", "Medium armor", "Shields (except tower shields)"],
    level1Features: [
      { name: "Cantrips", description: "Cast 0-level spells unlimited times per day." },
      { name: "Raging Song", description: "Inspire allies to rage. Affected allies gain +2 morale to STR and CON, +1 Will saves, –1 AC. 6 + CHA modifier rounds/day." },
      { name: "Scribe Scroll", description: "Bonus feat: Scribe Scroll." },
    ],
    tags: ["hybrid"],
  },
  {
    id: "slayer",
    name: "Slayer",
    description: "A ranger-rogue hybrid who hunts and kills targets efficiently.",
    hitDie: 10,
    babProgression: "full",
    saves: { fort: "good", ref: "good", will: "poor" },
    skillsPerLevel: 6,
    classSkills: ["Acrobatics", "Bluff", "Climb", "Craft", "Disguise", "Handle Animal", "Heal", "Intimidate", "Knowledge (Dungeoneering)", "Knowledge (Geography)", "Knowledge (Local)", "Perception", "Profession", "Ride", "Sense Motive", "Stealth", "Survival", "Swim"],
    proficiencies: ["All simple weapons", "All martial weapons", "Light armor", "Medium armor", "Shields (except tower shields)"],
    level1Features: [
      { name: "Studied Target", description: "+1 on Bluff, Knowledge, Perception, Sense Motive, Survival against studied target. +1 attack/damage. Swift action to study a target." },
      { name: "Track", description: "+1/2 slayer level on Survival checks to follow or identify tracks." },
    ],
    tags: ["hybrid"],
  },
  {
    id: "swashbuckler",
    name: "Swashbuckler",
    description: "A fighter-gunslinger hybrid who relies on finesse and panache.",
    hitDie: 10,
    babProgression: "full",
    saves: { fort: "poor", ref: "good", will: "poor" },
    skillsPerLevel: 4,
    classSkills: ["Acrobatics", "Bluff", "Climb", "Craft", "Diplomacy", "Escape Artist", "Intimidate", "Knowledge (Local)", "Knowledge (Nobility)", "Perception", "Perform (All)", "Profession", "Ride", "Sense Motive", "Sleight of Hand", "Swim"],
    proficiencies: ["All simple weapons", "All martial weapons", "Light armor"],
    level1Features: [
      { name: "Deeds", description: "Spend panache to perform deeds. Level 1: Derring-Do, Dodging Panache, Opportune Parry and Riposte." },
      { name: "Finesse Training", description: "Weapon Finesse as bonus feat. At 3rd: add DEX instead of STR to damage with one finesse weapon." },
      { name: "Panache", description: "CHA modifier panache points. Regain 1 on killing blow with light/one-handed piercing weapon or confirming critical." },
    ],
    tags: ["hybrid"],
  },
  {
    id: "warpriest",
    name: "Warpriest",
    description: "A cleric-fighter hybrid who is a divine champion of their deity.",
    hitDie: 8,
    babProgression: "three-quarter",
    saves: { fort: "good", ref: "poor", will: "good" },
    skillsPerLevel: 2,
    classSkills: ["Climb", "Craft", "Diplomacy", "Handle Animal", "Heal", "Intimidate", "Knowledge (Dungeoneering)", "Knowledge (Engineering)", "Knowledge (Planes)", "Knowledge (Religion)", "Profession", "Ride", "Sense Motive", "Spellcraft", "Survival", "Swim"],
    proficiencies: ["All simple weapons", "All martial weapons", "Deity's favored weapon", "All armor", "All shields (including tower shields)"],
    level1Features: [
      { name: "Aura", description: "Chaotic, evil, good, or lawful aura depending on deity." },
      { name: "Blessings", description: "Choose two blessings from deity's domains. Each has minor and major powers. 3 + WIS modifier blessings/day." },
      { name: "Focus Weapon", description: "Free Weapon Focus feat for deity's favored weapon." },
      { name: "Orisons", description: "Cast 0-level spells unlimited times per day." },
      { name: "Sacred Weapon", description: "Deity's favored weapon treated as magic. Damage scales with warpriest level (like monk unarmed strike)." },
    ],
    tags: ["hybrid"],
  },
  // ── OCCULT ──
  {
    id: "kineticist",
    name: "Kineticist",
    description: "A psion who manipulates raw elemental energy.",
    hitDie: 8,
    babProgression: "three-quarter",
    saves: { fort: "good", ref: "good", will: "poor" },
    skillsPerLevel: 4,
    classSkills: ["Acrobatics", "Craft", "Heal", "Intimidate", "Perception", "Profession", "Stealth", "Use Magic Device"],
    proficiencies: ["All simple weapons", "Light armor"],
    level1Features: [
      { name: "Burn", description: "Accept 1 point of burn per extra use of kinetic blast. Each burn = 1 nonlethal damage per kineticist level (not removed by healing)." },
      { name: "Elemental Focus", description: "Choose an element. Determines kinetic blast and available wild talents." },
      { name: "Kinetic Blast", description: "Ranged touch attack or area of effect blast. 1d6 + 1d6 per 2 levels beyond 1st." },
      { name: "Wild Talents", description: "Gain one wild talent from your element at 1st level." },
    ],
    tags: ["occult"],
  },
  {
    id: "medium",
    name: "Medium",
    description: "A channeler who invites spirits to inhabit their body.",
    hitDie: 8,
    babProgression: "three-quarter",
    saves: { fort: "poor", ref: "poor", will: "good" },
    skillsPerLevel: 4,
    classSkills: ["Bluff", "Craft", "Diplomacy", "Fly", "Heal", "Intimidate", "Knowledge (Arcana)", "Knowledge (Planes)", "Knowledge (Religion)", "Linguistics", "Perception", "Perform (All)", "Profession", "Sense Motive", "Spellcraft"],
    proficiencies: ["All simple weapons", "Light armor", "Medium armor", "Shields (except tower shields)"],
    level1Features: [
      { name: "Haunt Channeler", description: "Spend séance boon points to channel haunts." },
      { name: "Séance", description: "Perform a séance to contact a spirit. Gain that spirit's influence bonuses but also its influence penalties." },
      { name: "Spirit", description: "Channel one of six spirits (Archmage, Champion, Guardian, Hierophant, Marshal, Trickster). Each grants different abilities." },
      { name: "Spirit Bonus", description: "+1/3 level (min 1) bonus to certain rolls determined by the channeled spirit." },
    ],
    tags: ["occult"],
  },
  {
    id: "mesmerist",
    name: "Mesmerist",
    description: "A hypnotist who implants mental triggers in allies and enemies.",
    hitDie: 8,
    babProgression: "three-quarter",
    saves: { fort: "poor", ref: "poor", will: "good" },
    skillsPerLevel: 6,
    classSkills: ["Bluff", "Craft", "Diplomacy", "Disguise", "Intimidate", "Knowledge (Arcana)", "Knowledge (Dungeoneering)", "Knowledge (Local)", "Knowledge (Planes)", "Perception", "Profession", "Sense Motive", "Spellcraft", "Use Magic Device"],
    proficiencies: ["All simple weapons", "Light armor"],
    level1Features: [
      { name: "Consummate Liar", description: "+1/2 mesmerist level on Bluff checks." },
      { name: "Hypnotic Stare", description: "Swift action: –2 penalty on one creature's Will saves. Range 30 ft. Lasts until end of turn if stare ends." },
      { name: "Knacks", description: "Cast 0-level spells unlimited times per day." },
      { name: "Painful Stare", description: "When hypnotic stare target is hit, add 1d6 psychic damage (1/round)." },
    ],
    tags: ["occult"],
  },
  {
    id: "occultist",
    name: "Occultist",
    description: "A psychometrist who draws power from objects.",
    hitDie: 8,
    babProgression: "three-quarter",
    saves: { fort: "good", ref: "poor", will: "good" },
    skillsPerLevel: 4,
    classSkills: ["Appraise", "Craft", "Diplomacy", "Fly", "Heal", "Knowledge (Arcana)", "Knowledge (History)", "Knowledge (Planes)", "Knowledge (Religion)", "Linguistics", "Perception", "Profession", "Sense Motive", "Spellcraft", "Use Magic Device"],
    proficiencies: ["All simple weapons", "All martial weapons", "Light armor", "Medium armor", "Shields (except tower shields)"],
    level1Features: [
      { name: "Focus Powers", description: "Spend mental focus to use implement powers." },
      { name: "Implement Schools", description: "Choose two implement schools. Gain resonant and focus powers for each. Each has a type of implement." },
      { name: "Implements", description: "Must invest mental focus in implements each day. Total focus = occultist level + INT modifier." },
      { name: "Mental Focus", description: "Occultist level + INT modifier mental focus points per day." },
    ],
    tags: ["occult"],
  },
  {
    id: "psychic",
    name: "Psychic",
    description: "A spontaneous arcane caster who draws power from the mind.",
    hitDie: 6,
    babProgression: "half",
    saves: { fort: "poor", ref: "poor", will: "good" },
    skillsPerLevel: 2,
    classSkills: ["Bluff", "Craft", "Diplomacy", "Fly", "Intimidate", "Knowledge (All)", "Linguistics", "Perception", "Profession", "Sense Motive", "Spellcraft"],
    proficiencies: ["All simple weapons", "No armor", "No shields"],
    level1Features: [
      { name: "Discipline", description: "Choose a psychic discipline granting bonus spells and phrenic amplifications." },
      { name: "Knacks", description: "Cast 0-level psychic spells unlimited times per day." },
      { name: "Phrenic Pool", description: "1/2 psychic level + WIS or CHA modifier phrenic pool points." },
      { name: "Phrenic Amplifications", description: "Spend phrenic pool points to modify spells as they are cast." },
    ],
    tags: ["occult"],
  },
  {
    id: "spiritualist",
    name: "Spiritualist",
    description: "A medium bonded to a single powerful phantom companion.",
    hitDie: 8,
    babProgression: "three-quarter",
    saves: { fort: "poor", ref: "poor", will: "good" },
    skillsPerLevel: 4,
    classSkills: ["Craft", "Fly", "Heal", "Intimidate", "Knowledge (Arcana)", "Knowledge (Planes)", "Knowledge (Religion)", "Linguistics", "Perception", "Profession", "Sense Motive", "Spellcraft"],
    proficiencies: ["All simple weapons", "Light armor", "Medium armor"],
    level1Features: [
      { name: "Bonded Manifestation", description: "Spend 1 round to manifest phantom as ectoplasmic or incorporeal form. Can be dismissed as free action." },
      { name: "Etheric Tether", description: "While phantom is manifested, can see up to 60 ft. in normal and magical darkness." },
      { name: "Orisons", description: "Cast 0-level spells unlimited times per day." },
      { name: "Phantom", description: "Bonded phantom with emotional focus. Functions as an animal companion using spiritualist level." },
    ],
    tags: ["occult"],
  },
];
