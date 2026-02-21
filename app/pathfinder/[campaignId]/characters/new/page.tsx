"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../../lib/supabaseClient";
import Link from "next/link";
import { FeatBrowser } from "../../../../../components/FeatBrowser";
import { TraitBrowser } from "../../../../../components/TraitBrowser";
import {
  RACES, CLASSES,
  getBabAtLevel, getGoodSaveAtLevel, getPoorSaveAtLevel,
  type Race, type PFClass,
} from "../../../../../lib/pf-data";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

type Step = "basics" | "scores" | "race" | "class" | "details" | "feats" | "traits" | "review";

interface AbilityScores {
  str: number; dex: number; con: number;
  int: number; wis: number; cha: number;
}

interface SelectedClass {
  cls: PFClass;
  isPrimary: boolean;
}

interface SelectedFeat {
  name: string;
  description: string;
  prerequisites: string;
  category: string;
  source: string;
}

interface SelectedTrait {
  name: string;
  description: string;
  type: string;
  source: string;
}

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

const STEPS: { id: Step; label: string; icon: string }[] = [
  { id: "basics",  label: "Basics",        icon: "📋" },
  { id: "scores",  label: "Ability Scores", icon: "💪" },
  { id: "race",    label: "Race",           icon: "🧝" },
  { id: "class",   label: "Class",          icon: "⚔️" },
  { id: "details", label: "Level Details",  icon: "🎯" },
  { id: "feats",   label: "Feats",          icon: "⚔️" },
  { id: "traits",  label: "Traits",         icon: "✨" },
  { id: "review",  label: "Review",         icon: "✅" },
];

const STAT_KEYS: (keyof AbilityScores)[] = ["str","dex","con","int","wis","cha"];
const STAT_LABELS: Record<keyof AbilityScores, string> = {
  str:"STR", dex:"DEX", con:"CON", int:"INT", wis:"WIS", cha:"CHA",
};
const STAT_FULL: Record<keyof AbilityScores, string> = {
  str:"Strength", dex:"Dexterity", con:"Constitution",
  int:"Intelligence", wis:"Wisdom", cha:"Charisma",
};
const STAT_CATEGORY: Record<keyof AbilityScores, string> = {
  str:"ability_str", dex:"ability_dex", con:"ability_con",
  int:"ability_int", wis:"ability_wis", cha:"ability_cha",
};

const POINT_BUY_COSTS: Record<number, number> = {
  7:-4, 8:-2, 9:-1, 10:0, 11:1, 12:2, 13:3, 14:5, 15:7, 16:10, 17:13, 18:17,
};

function calcMod(score: number): number { return Math.floor((score - 10) / 2); }
function fmtMod(mod: number): string { return mod >= 0 ? `+${mod}` : `${mod}`; }
function pointBuyCost(scores: AbilityScores): number {
  return STAT_KEYS.reduce((sum, k) => sum + (POINT_BUY_COSTS[scores[k]] ?? 0), 0);
}

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

export default function NewCharacterPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.campaignId as string;

  const [session, setSession] = useState<any>(null);
  const [campaign, setCampaign] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("basics");

  // ── STEP 1: Basics ──
  const [name, setName] = useState("");
  const [characterType, setCharacterType] = useState<string>("pc");
  const [alignment, setAlignment] = useState("");
  const [deity, setDeity] = useState("");
  const [homeland, setHomeland] = useState("");
  const [level, setLevel] = useState(1);
  const [isGestalt, setIsGestalt] = useState(false);

  // ── STEP 2: Ability Scores ──
  const [scores, setScores] = useState<AbilityScores>({
    str:10, dex:10, con:10, int:10, wis:10, cha:10,
  });
  const [scoreMethod, setScoreMethod] = useState<"manual"|"pointbuy"|"standard">("manual");
  // Standard array: 15,14,13,12,10,8 unassigned
  const [standardArray] = useState([15,14,13,12,10,8]);
  const [standardAssigned, setStandardAssigned] = useState<Record<keyof AbilityScores, number|null>>({
    str:null,dex:null,con:null,int:null,wis:null,cha:null,
  });

  // ── STEP 3: Race ──
  const [selectedRace, setSelectedRace] = useState<Race | null>(null);
  const [raceSearch, setRaceSearch] = useState("");
  const [raceTag, setRaceTag] = useState<string>("all");
  const [humanFlexStat, setHumanFlexStat] = useState<keyof AbilityScores>("str");
  const [customRaceName, setCustomRaceName] = useState("");
  const [customRaceMods, setCustomRaceMods] = useState<Record<keyof AbilityScores, number>>({
    str:0,dex:0,con:0,int:0,wis:0,cha:0,
  });

  // ── STEP 4: Class ──
  const [selectedClasses, setSelectedClasses] = useState<SelectedClass[]>([]);
  const [classSearch, setClassSearch] = useState("");
  const [classTag, setClassTag] = useState<string>("all");

  // ── STEP 5: Details ──
  const [hpMethod, setHpMethod] = useState<"max"|"average"|"manual">("max");
  // Per-level manual HP rolls: index 0 = level 1, index 1 = level 2, etc.
  const [manualHpRolls, setManualHpRolls] = useState<number[]>([]);
  // skill ranks: skillName -> ranks
  const [skillRanks, setSkillRanks] = useState<Record<string, number>>({});
  const [classSkillsChecked, setClassSkillsChecked] = useState<Record<string, boolean>>({});
  // ── STEP 6: Feats ──
  const [selectedFeats, setSelectedFeats] = useState<SelectedFeat[]>([]);
  const [showFeatBrowser, setShowFeatBrowser] = useState(false);

  // ── STEP 7: Traits ──
  const [selectedTraits, setSelectedTraits] = useState<SelectedTrait[]>([]);
  const [showTraitBrowser, setShowTraitBrowser] = useState(false);

  // Backstory (in Level Details step)
  const [backstory, setBackstory] = useState("");

  // ─────────────────────────────────────────────
  // AUTH + CAMPAIGN
  // ─────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    supabase.from("campaigns").select("*").eq("id", campaignId).single()
      .then(({ data }) => setCampaign(data));
  }, [session?.user?.id, campaignId]);

  // ─────────────────────────────────────────────
  // DERIVED VALUES
  // ─────────────────────────────────────────────

  // Scores including race mods (for preview)
  const effectiveScores: AbilityScores = (() => {
    const base = scoreMethod === "standard"
      ? (() => {
          const s = { ...scores };
          STAT_KEYS.forEach(k => { if (standardAssigned[k] !== null) s[k] = standardAssigned[k]!; });
          return s;
        })()
      : scores;

    const result = { ...base };

    if (selectedRace) {
      if (selectedRace.id === "custom") {
        STAT_KEYS.forEach(k => { result[k] += customRaceMods[k]; });
      } else if (["human","half-elf","half-orc"].includes(selectedRace.id)) {
        result[humanFlexStat] += 2;
      } else {
        selectedRace.abilityMods.forEach(mod => {
          const key = mod.stat.replace("ability_","") as keyof AbilityScores;
          result[key] += mod.value;
        });
      }
    }
    return result;
  })();

  const conMod = calcMod(effectiveScores.con);
  const intMod = calcMod(effectiveScores.int);

  // Class / HP derived values
  const primaryClass = selectedClasses.find(c => c.isPrimary)?.cls ?? selectedClasses[0]?.cls;
  const hitDie = primaryClass?.hitDie ?? 8;
  const averageHpRoll = Math.ceil(hitDie / 2) + 1;

  // HP per level: level 1 always max, subsequent levels use chosen method
  function hpRollForLevel(lvl: number): number {
    if (lvl === 1) return hitDie; // always max at level 1
    if (hpMethod === "max") return hitDie;
    if (hpMethod === "average") return averageHpRoll;
    return Math.max(1, manualHpRolls[lvl - 1] ?? Math.ceil(hitDie / 2));
  }
  const calculatedHp = (() => {
    let total = 0;
    for (let lvl = 1; lvl <= level; lvl++) {
      total += hpRollForLevel(lvl) + conMod;
    }
    return Math.max(level, total); // minimum 1 HP per level
  })();

  // Skill ranks available
  const skillRanksPerLevel = primaryClass ? primaryClass.skillsPerLevel + intMod : 2 + intMod;
  const totalSkillRanks = Math.max(1, skillRanksPerLevel) * level;
  const usedSkillRanks = Object.values(skillRanks).reduce((a, b) => a + b, 0);

  // BAB / saves for all selected classes (gestalt = best of each)
  const babValue = (() => {
    if (selectedClasses.length === 0) return 0;
    if (isGestalt) {
      return Math.max(...selectedClasses.map(c => getBabAtLevel(c.cls.babProgression, level)));
    }
    return getBabAtLevel(selectedClasses[0].cls.babProgression, level);
  })();

  function getSave(type: "fort"|"ref"|"will"): number {
    if (selectedClasses.length === 0) return 0;
    const abilityKey: Record<string,"str"|"dex"|"con"|"int"|"wis"|"cha"> = {
      fort:"con", ref:"dex", will:"wis",
    };
    const abilityMod = calcMod(effectiveScores[abilityKey[type]]);
    if (isGestalt) {
      const best = Math.max(...selectedClasses.map(c =>
        c.cls.saves[type] === "good"
          ? getGoodSaveAtLevel(level)
          : getPoorSaveAtLevel(level)
      ));
      return best + abilityMod;
    }
    const cls = selectedClasses[0].cls;
    const base = cls.saves[type] === "good" ? getGoodSaveAtLevel(level) : getPoorSaveAtLevel(level);
    return base + abilityMod;
  }

  // All class skills combined
  const allClassSkills = new Set(selectedClasses.flatMap(c => c.cls.classSkills));

  // ─────────────────────────────────────────────
  // NAVIGATION HELPERS
  // ─────────────────────────────────────────────

  const stepOrder: Step[] = ["basics","scores","race","class","details","feats","traits","review"];
  const currentIndex = stepOrder.indexOf(step);

  function canAdvance(): { ok: boolean; reason?: string } {
    if (step === "basics" && !name.trim()) return { ok:false, reason:"Character name is required." };
    if (step === "scores" && scoreMethod === "standard") {
      const unassigned = STAT_KEYS.filter(k => standardAssigned[k] === null);
      if (unassigned.length > 0) return { ok:false, reason:`Assign all scores first (${unassigned.length} remaining).` };
    }
    if (step === "class" && selectedClasses.length === 0) return { ok:false, reason:"Select at least one class." };
    return { ok: true };
  }

  function goNext() {
    const check = canAdvance();
    if (!check.ok) { setError(check.reason!); return; }
    setError(null);
    setStep(stepOrder[currentIndex + 1]);
    window.scrollTo(0,0);
  }

  function goBack() {
    setError(null);
    setStep(stepOrder[currentIndex - 1]);
    window.scrollTo(0,0);
  }

  // ─────────────────────────────────────────────
  // SUBMIT
  // ─────────────────────────────────────────────

  async function handleCreate() {
    if (!session?.user?.id) return;
    setSaving(true);
    setError(null);

    try {
      const raceName = selectedRace?.id === "custom"
        ? (customRaceName || "Custom")
        : (selectedRace?.name ?? "");
      const classNames = selectedClasses.map(c => c.cls.name).join(" / ");

      // 1. Insert character row
      const { data: char, error: charErr } = await supabase
        .from("characters")
        .insert({
          campaign_id: campaignId,
          owner_id: session.user.id,
          name,
          race: raceName,
          classes: classNames,
          level,
          alignment,
          deity,
          homeland,
          character_type: characterType,
          hp_current: calculatedHp,
          backstory: backstory || null,
          skills: {}, feats: {}, traits: {}, special_abilities: {},
          spells: {}, spells_per_day: {}, carrying_capacity: {}, currency: {},
        })
        .select().single();

      if (charErr) throw charErr;
      const charId = char.id;

      // 2. Build stat sources
      const sources: any[] = [];

      const addSource = (
        stat_category: string,
        source_name: string,
        source_type: string,
        bonus_value: number,
        bonus_type: string = "untyped",
        notes?: string
      ) => {
        if (bonus_value === 0) return;
        sources.push({
          character_id: charId,
          stat_category,
          source_name,
          source_type,
          bonus_value,
          bonus_type,
          is_active: true,
          obtained_level: 1,
          obtained_notes: notes ?? null,
        });
      };

      // Ability scores — base scores
      const baseScores = scoreMethod === "standard"
        ? (() => {
            const s = { ...scores };
            STAT_KEYS.forEach(k => { if (standardAssigned[k] !== null) s[k] = standardAssigned[k]!; });
            return s;
          })()
        : scores;

      STAT_KEYS.forEach(k => {
        addSource(STAT_CATEGORY[k], "Base Score", "base", baseScores[k], "base");
      });

      // Racial ability mods
      if (selectedRace) {
        if (selectedRace.id === "custom") {
          STAT_KEYS.forEach(k => {
            if (customRaceMods[k] !== 0) {
              addSource(STAT_CATEGORY[k], `${customRaceName || "Race"} racial`, "racial", customRaceMods[k], "racial");
            }
          });
        } else if (["human","half-elf","half-orc"].includes(selectedRace.id)) {
          addSource(STAT_CATEGORY[humanFlexStat], `${selectedRace.name} racial`, "racial", 2, "racial");
        } else {
          selectedRace.abilityMods.forEach(mod => {
            addSource(mod.stat, `${selectedRace.name} racial`, "racial", mod.value, "racial");
          });
        }
      }

      // HP — one source per level
      for (let lvl = 1; lvl <= level; lvl++) {
        const roll = hpRollForLevel(lvl);
        addSource("hp_max", `${primaryClass?.name ?? "Class"} HD (level ${lvl})`, "class", roll, "untyped", `d${hitDie}`);
      }
      if (conMod !== 0) {
        // CON mod applies once per level
        addSource("hp_max", `CON modifier (×${level})`, "ability", conMod * level, "untyped");
      }

      // BAB
      if (isGestalt && selectedClasses.length > 1) {
        selectedClasses.forEach(c => {
          const bab = getBabAtLevel(c.cls.babProgression, level);
          addSource("bab", `${c.cls.name} BAB`, "class", bab, "untyped");
        });
        // Remove duplicates — keep only best (done via max logic in page.tsx but store all for transparency)
      } else {
        addSource("bab", `${primaryClass?.name ?? "Class"} BAB`, "class", babValue, "untyped");
      }

      // Saves
      const saveMap: {cat:string; type:"fort"|"ref"|"will"; label:string; abMod:number}[] = [
        { cat:"save_fort", type:"fort", label:"Fortitude", abMod: calcMod(effectiveScores.con) },
        { cat:"save_ref",  type:"ref",  label:"Reflex",    abMod: calcMod(effectiveScores.dex) },
        { cat:"save_will", type:"will", label:"Will",      abMod: calcMod(effectiveScores.wis) },
      ];

      saveMap.forEach(({ cat, type, label, abMod }) => {
        if (isGestalt && selectedClasses.length > 1) {
          selectedClasses.forEach(c => {
            const base = c.cls.saves[type] === "good" ? getGoodSaveAtLevel(level) : getPoorSaveAtLevel(level);
            addSource(cat, `${c.cls.name} base ${label}`, "class", base, "untyped");
          });
        } else {
          const cls = selectedClasses[0]?.cls;
          if (cls) {
            const base = cls.saves[type] === "good" ? getGoodSaveAtLevel(level) : getPoorSaveAtLevel(level);
            addSource(cat, `${cls.name} base ${label}`, "class", base, "untyped");
          }
        }
        if (abMod !== 0) addSource(cat, `${type === "fort" ? "CON" : type === "ref" ? "DEX" : "WIS"} modifier`, "ability", abMod, "untyped");
      });

      // Insert all sources
      if (sources.length > 0) {
        const { error: srcErr } = await supabase.from("character_stat_sources").insert(sources);
        if (srcErr) throw srcErr;
      }

      // 3. Skill ranks
      const skillInserts: any[] = [];
      Object.entries(skillRanks).forEach(([skillName, ranks]) => {
        if (ranks > 0) {
          skillInserts.push({
            character_id: charId,
            skill_name: skillName,
            ranks,
            is_class_skill: classSkillsChecked[skillName] ?? allClassSkills.has(skillName),
          });
        }
      });
      // Also mark class skills with 0 ranks if user flagged them
      Object.entries(classSkillsChecked).forEach(([skillName, isClass]) => {
        if (isClass && !skillRanks[skillName]) {
          skillInserts.push({ character_id: charId, skill_name: skillName, ranks: 0, is_class_skill: true });
        }
      });
      if (skillInserts.length > 0) {
        await supabase.from("character_skills").insert(skillInserts);
      }

      // 4. Features — feats, traits, racial traits, class features
      const featureInserts: any[] = [];

      // Starting feats from FeatBrowser
      selectedFeats.forEach(f => {
        featureInserts.push({
          character_id: charId,
          feature_type: "feat",
          name: f.name,
          description: f.description || null,
          prerequisites: f.prerequisites || null,
          category: f.category || null,
          source: f.source || null,
          obtained_level: 1,
          is_active: true,
        });
      });

      // Traits from TraitBrowser
      selectedTraits.forEach(t => {
        featureInserts.push({
          character_id: charId,
          feature_type: "trait",
          name: t.name,
          description: t.description || null,
          category: t.type || null,
          source: t.source || null,
          obtained_level: 1,
          is_active: true,
        });
      });

      // Racial traits
      if (selectedRace && selectedRace.id !== "custom") {
        selectedRace.traits.forEach(t => {
          featureInserts.push({
            character_id: charId,
            feature_type: "racial",
            name: t.name,
            description: t.description || null,
            source: selectedRace.name,
            obtained_level: 1,
            is_active: true,
          });
        });
      }

      // Class features (level 1)
      selectedClasses.forEach(({ cls }) => {
        cls.level1Features.forEach(f => {
          featureInserts.push({
            character_id: charId,
            feature_type: "class",
            name: f.name,
            description: f.description || null,
            source: cls.name,
            obtained_level: 1,
            is_active: true,
          });
        });
      });

      if (featureInserts.length > 0) {
        await supabase.from("character_features").insert(featureInserts);
      }

      router.push(`/pathfinder/${campaignId}/characters/${charId}`);
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  }

  // ─────────────────────────────────────────────
  // RENDER HELPERS
  // ─────────────────────────────────────────────

  if (!session) return (
    <main style={{ maxWidth: 900, margin: "4rem auto", padding: "2rem", textAlign: "center" }}>
      <p>Please sign in to create a character.</p>
      <a href="/auth/login" style={{ color: "#0070f3" }}>Sign In</a>
    </main>
  );

  const progressPct = ((currentIndex) / (stepOrder.length - 1)) * 100;

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "2rem" }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: "1.5rem", fontSize: "0.9rem" }}>
        <Link href="/pathfinder" style={{ color: "#0070f3", textDecoration: "none" }}>← Campaigns</Link>
        <span style={{ margin: "0 0.5rem", color: "#999" }}>/</span>
        <Link href={`/pathfinder/${campaignId}`} style={{ color: "#0070f3", textDecoration: "none" }}>{campaign?.name || "Campaign"}</Link>
        <span style={{ margin: "0 0.5rem", color: "#999" }}>/</span>
        <Link href={`/pathfinder/${campaignId}/characters`} style={{ color: "#0070f3", textDecoration: "none" }}>Characters</Link>
        <span style={{ margin: "0 0.5rem", color: "#999" }}>/</span>
        <span>New Character</span>
      </div>

      <h1 style={{ marginBottom: "0.5rem" }}>Create New Character</h1>
      <p style={{ color: "#666", marginBottom: "2rem" }}>Follow the steps below. You can always edit everything on the character sheet afterwards.</p>

      {/* Step indicator */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
          {STEPS.map((s, i) => {
            const done = i < currentIndex;
            const active = s.id === step;
            return (
              <div
                key={s.id}
                onClick={() => {
                  if (done) { setError(null); setStep(s.id); }
                }}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  gap: "0.25rem", flex: 1,
                  cursor: done ? "pointer" : "default",
                  opacity: !done && !active ? 0.4 : 1,
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: active ? "#0070f3" : done ? "#10b981" : "#e5e7eb",
                  color: active || done ? "white" : "#999",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1rem", fontWeight: 700,
                  border: active ? "3px solid #0070f3" : "3px solid transparent",
                  transition: "all 0.2s",
                }}>
                  {done ? "✓" : s.icon}
                </div>
                <span style={{ fontSize: "0.72rem", fontWeight: active ? 700 : 400, color: active ? "#0070f3" : "#666", textAlign: "center" }}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
        <div style={{ height: 4, background: "#e5e7eb", borderRadius: 2 }}>
          <div style={{ height: "100%", width: `${progressPct}%`, background: "#0070f3", borderRadius: 2, transition: "width 0.3s" }} />
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "1rem", marginBottom: "1.5rem", color: "#991b1b" }}>
          {error}
        </div>
      )}

      {/* ═══════════════════════════════════════════
          STEP 1: BASICS
      ═══════════════════════════════════════════ */}
      {step === "basics" && (
        <div style={{ display: "grid", gap: "1.5rem" }}>
          <section style={card}>
            <h2 style={cardTitle}>Basic Information</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={label}>Character Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Vaelin Duskryn" style={input} />
              </div>
              <div>
                <label style={label}>Character Type</label>
                <select value={characterType} onChange={e => setCharacterType(e.target.value)} style={input}>
                  <option value="pc">Player Character</option>
                  <option value="npc">NPC</option>
                  <option value="party_member">Party Member</option>
                  <option value="enemy">Enemy</option>
                  <option value="villain">Villain</option>
                </select>
              </div>
              <div>
                <label style={label}>Level</label>
                <input type="number" value={level} min={1} max={20} onChange={e => setLevel(parseInt(e.target.value)||1)} style={input} />
              </div>
              <div>
                <label style={label}>Alignment</label>
                <select value={alignment} onChange={e => setAlignment(e.target.value)} style={input}>
                  <option value="">— Select —</option>
                  {["Lawful Good","Neutral Good","Chaotic Good","Lawful Neutral","True Neutral","Chaotic Neutral","Lawful Evil","Neutral Evil","Chaotic Evil"].map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={label}>Deity</label>
                <input value={deity} onChange={e => setDeity(e.target.value)} placeholder="e.g., Pharasma" style={input} />
              </div>
              <div>
                <label style={label}>Homeland</label>
                <input value={homeland} onChange={e => setHomeland(e.target.value)} placeholder="e.g., Riddleport" style={input} />
              </div>
            </div>
          </section>

          <section style={card}>
            <h2 style={cardTitle}>Campaign Rules</h2>
            <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
              <input type="checkbox" checked={isGestalt} onChange={e => setIsGestalt(e.target.checked)}
                style={{ width: 20, height: 20 }} />
              <div>
                <div style={{ fontWeight: 600 }}>Gestalt Characters</div>
                <div style={{ fontSize: "0.85rem", color: "#666" }}>Select two classes and combine the best saves, BAB, and features from both.</div>
              </div>
            </label>
          </section>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          STEP 2: ABILITY SCORES
      ═══════════════════════════════════════════ */}
      {step === "scores" && (
        <div style={{ display: "grid", gap: "1.5rem" }}>
          <section style={card}>
            <h2 style={cardTitle}>Score Entry Method</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem" }}>
              {([
                { id:"manual",    icon:"✏️", label:"Manual Entry",    desc:"Type in any scores directly." },
                { id:"pointbuy",  icon:"🧮", label:"Point Buy",       desc:"25-point buy (standard PFS)." },
                { id:"standard",  icon:"🎲", label:"Standard Array",  desc:"15, 14, 13, 12, 10, 8 — assign each." },
              ] as const).map(m => (
                <div key={m.id} onClick={() => setScoreMethod(m.id)}
                  style={{ ...card, cursor:"pointer", border: scoreMethod === m.id ? "2px solid #0070f3" : "1px solid #ddd",
                    background: scoreMethod === m.id ? "#eff6ff" : "white", padding: "1rem" }}>
                  <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{m.icon}</div>
                  <div style={{ fontWeight: 700 }}>{m.label}</div>
                  <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.25rem" }}>{m.desc}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Standard array assignment */}
          {scoreMethod === "standard" && (
            <section style={card}>
              <h2 style={cardTitle}>Assign Standard Array</h2>
              <p style={{ color: "#666", marginBottom: "1rem", fontSize: "0.9rem" }}>
                Drag each value to an ability score. Each value can only be used once.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: "1rem" }}>
                {STAT_KEYS.map(k => {
                  const used = standardAssigned[k];
                  const usedValues = Object.values(standardAssigned).filter(v => v !== null) as number[];
                  const available = standardArray.filter(v => !usedValues.includes(v) || v === used);
                  return (
                    <div key={k} style={{ textAlign: "center" }}>
                      <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>{STAT_LABELS[k]}</div>
                      <select
                        value={used ?? ""}
                        onChange={e => {
                          const val = e.target.value ? parseInt(e.target.value) : null;
                          setStandardAssigned(prev => ({ ...prev, [k]: val }));
                        }}
                        style={{ ...input, textAlign: "center", fontWeight: 700, fontSize: "1.1rem" }}
                      >
                        <option value="">—</option>
                        {available.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                      {used !== null && (
                        <div style={{ marginTop: "0.25rem", fontSize: "0.9rem", color: "#666" }}>
                          {fmtMod(calcMod(used))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Manual / point buy grid */}
          {(scoreMethod === "manual" || scoreMethod === "pointbuy") && (
            <section style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h2 style={{ ...cardTitle, marginBottom: 0 }}>Ability Scores</h2>
                {scoreMethod === "pointbuy" && (
                  <div style={{
                    padding: "0.5rem 1rem", borderRadius: 8,
                    background: pointBuyCost(scores) > 25 ? "#fee2e2" : pointBuyCost(scores) === 25 ? "#dcfce7" : "#eff6ff",
                    fontWeight: 700, fontSize: "0.95rem",
                  }}>
                    Points: {pointBuyCost(scores)} / 25
                    {pointBuyCost(scores) > 25 && " ⚠️"}
                    {pointBuyCost(scores) === 25 && " ✓"}
                  </div>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: "1rem" }}>
                {STAT_KEYS.map(k => {
                  const score = scores[k];
                  const mod = calcMod(score);
                  const cost = POINT_BUY_COSTS[score] ?? "—";
                  return (
                    <div key={k} style={{ textAlign: "center" }}>
                      <div style={{ fontWeight: 700, marginBottom: "0.5rem", color: "#333" }}>{STAT_LABELS[k]}</div>
                      <div style={{ fontWeight: 600, fontSize: "0.75rem", color: "#999", marginBottom: "0.25rem" }}>{STAT_FULL[k]}</div>
                      {scoreMethod === "pointbuy" ? (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem" }}>
                          <button onClick={() => setScores(p => ({ ...p, [k]: Math.max(7, p[k]-1) }))}
                            style={pbBtn}>−</button>
                          <span style={{ width: 32, textAlign: "center", fontWeight: 700, fontSize: "1.3rem" }}>{score}</span>
                          <button onClick={() => setScores(p => ({ ...p, [k]: Math.min(18, p[k]+1) }))}
                            style={pbBtn}>+</button>
                        </div>
                      ) : (
                        <input type="number" value={score} min={1} max={99}
                          onChange={e => setScores(p => ({ ...p, [k]: parseInt(e.target.value)||10 }))}
                          style={{ ...input, textAlign:"center", fontWeight:700, fontSize:"1.3rem", padding:"0.5rem" }} />
                      )}
                      <div style={{ marginTop: "0.4rem", fontSize: "1rem", fontWeight: 600, color: mod >= 0 ? "#10b981" : "#ef4444" }}>
                        {fmtMod(mod)}
                      </div>
                      {scoreMethod === "pointbuy" && (
                        <div style={{ fontSize: "0.75rem", color: "#999" }}>cost: {cost}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Preview with racial mods hint */}
          {selectedRace && (
            <div style={{ padding: "0.75rem 1rem", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, fontSize: "0.9rem", color: "#166534" }}>
              ✨ Racial modifiers from <strong>{selectedRace.name}</strong> will be shown in the Race step and applied as sources automatically.
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════
          STEP 3: RACE
      ═══════════════════════════════════════════ */}
      {step === "race" && (
        <div style={{ display: "grid", gap: "1.5rem" }}>
          {/* Search / filter */}
          <section style={card}>
            <h2 style={cardTitle}>Choose a Race</h2>
            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
              <input value={raceSearch} onChange={e => setRaceSearch(e.target.value)} placeholder="Search races..." style={{ ...input, flex: 1 }} />
              <select value={raceTag} onChange={e => setRaceTag(e.target.value)} style={{ ...input, width: "auto" }}>
                <option value="all">All</option>
                <option value="core">Core</option>
                <option value="featured">Featured</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: "0.75rem" }}>
              {RACES
                .filter(r => (raceTag === "all" || r.tags.includes(raceTag)) &&
                  r.name.toLowerCase().includes(raceSearch.toLowerCase()))
                .map(r => (
                  <div key={r.id} onClick={() => setSelectedRace(r)}
                    style={{
                      padding: "1rem", borderRadius: 10, cursor: "pointer",
                      border: selectedRace?.id === r.id ? "2px solid #0070f3" : "1px solid #ddd",
                      background: selectedRace?.id === r.id ? "#eff6ff" : "white",
                      transition: "all 0.15s",
                    }}>
                    <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>{r.name}</div>
                    <div style={{ fontSize: "0.78rem", color: "#666", marginBottom: "0.5rem" }}>{r.size} • {r.speed} ft.</div>
                    {r.abilityMods.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                        {r.abilityMods.map(m => (
                          <span key={m.stat} style={{
                            padding: "0.1rem 0.4rem", borderRadius: 4, fontSize: "0.75rem", fontWeight: 600,
                            background: m.value > 0 ? "#dcfce7" : "#fee2e2",
                            color: m.value > 0 ? "#166534" : "#991b1b",
                          }}>
                            {m.value > 0 ? "+" : ""}{m.value} {STAT_LABELS[m.stat.replace("ability_","") as keyof AbilityScores]}
                          </span>
                        ))}
                      </div>
                    )}
                    {["human","half-elf","half-orc"].includes(r.id) && (
                      <span style={{ padding: "0.1rem 0.4rem", borderRadius: 4, fontSize: "0.75rem", fontWeight: 600, background: "#dbeafe", color: "#1e40af" }}>
                        +2 any
                      </span>
                    )}
                    {r.tags.map(t => (
                      <span key={t} style={{ marginLeft: "0.25rem", padding: "0.1rem 0.4rem", borderRadius: 4, fontSize: "0.7rem", background: "#f3f4f6", color: "#6b7280" }}>
                        {t}
                      </span>
                    ))}
                  </div>
                ))}
            </div>
          </section>

          {/* Selected race details */}
          {selectedRace && (
            <section style={{ ...card, borderColor: "#0070f3", borderWidth: 2 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <h2 style={{ ...cardTitle, color: "#0070f3" }}>{selectedRace.name}</h2>
                <button onClick={() => setSelectedRace(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: "1.2rem" }}>✕</button>
              </div>
              <p style={{ color: "#555", marginBottom: "1rem" }}>{selectedRace.description}</p>

              <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
                <Tag label={`Size: ${selectedRace.size}`} color="blue" />
                <Tag label={`Speed: ${selectedRace.speed} ft.`} color="blue" />
                {selectedRace.favoredClass && <Tag label={`Favored: ${selectedRace.favoredClass}`} color="purple" />}
              </div>

              {/* Flex stat picker for human/half-elf/half-orc */}
              {["human","half-elf","half-orc"].includes(selectedRace.id) && (
                <div style={{ marginBottom: "1.5rem", padding: "1rem", background: "#eff6ff", borderRadius: 8 }}>
                  <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>+2 to Any Ability Score</div>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {STAT_KEYS.map(k => (
                      <button key={k} onClick={() => setHumanFlexStat(k)}
                        style={{
                          padding: "0.4rem 0.9rem", borderRadius: 6, cursor: "pointer", fontWeight: 700,
                          border: humanFlexStat === k ? "2px solid #0070f3" : "2px solid #ddd",
                          background: humanFlexStat === k ? "#0070f3" : "white",
                          color: humanFlexStat === k ? "white" : "#333",
                        }}>
                        {STAT_LABELS[k]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom race config */}
              {selectedRace.id === "custom" && (
                <div style={{ marginBottom: "1.5rem" }}>
                  <label style={label}>Race Name</label>
                  <input value={customRaceName} onChange={e => setCustomRaceName(e.target.value)} placeholder="e.g., Drow Noble" style={{ ...input, marginBottom: "1rem" }} />
                  <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>Ability Score Modifiers</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: "0.75rem" }}>
                    {STAT_KEYS.map(k => (
                      <div key={k} style={{ textAlign: "center" }}>
                        <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>{STAT_LABELS[k]}</div>
                        <input type="number" value={customRaceMods[k]}
                          onChange={e => setCustomRaceMods(p => ({ ...p, [k]: parseInt(e.target.value)||0 }))}
                          style={{ ...input, textAlign: "center", fontWeight: 700 }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Racial ability mods summary */}
              {selectedRace.abilityMods.length > 0 && (
                <div style={{ marginBottom: "1.5rem" }}>
                  <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>Ability Score Modifiers</div>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {selectedRace.abilityMods.map(m => (
                      <div key={m.stat} style={{
                        padding: "0.5rem 1rem", borderRadius: 8, fontWeight: 700,
                        background: m.value > 0 ? "#dcfce7" : "#fee2e2",
                        color: m.value > 0 ? "#166534" : "#991b1b",
                      }}>
                        {m.value > 0 ? "+" : ""}{m.value} {STAT_FULL[m.stat.replace("ability_","") as keyof AbilityScores]}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Racial traits */}
              {selectedRace.traits.length > 0 && (
                <div>
                  <div style={{ fontWeight: 700, marginBottom: "0.75rem" }}>Racial Traits</div>
                  <div style={{ display: "grid", gap: "0.5rem" }}>
                    {selectedRace.traits.map(t => (
                      <div key={t.name} style={{ padding: "0.75rem", background: "#f9fafb", borderRadius: 8, borderLeft: "3px solid #0070f3" }}>
                        <span style={{ fontWeight: 600 }}>{t.name}:</span>{" "}
                        <span style={{ color: "#555", fontSize: "0.9rem" }}>{t.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Effective scores preview */}
              <div style={{ marginTop: "1.5rem", padding: "1rem", background: "#f9fafb", borderRadius: 8 }}>
                <div style={{ fontWeight: 700, marginBottom: "0.75rem", color: "#666" }}>Scores after racial modifiers</div>
                <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
                  {STAT_KEYS.map(k => (
                    <div key={k} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#999" }}>{STAT_LABELS[k]}</div>
                      <div style={{ fontWeight: 700, fontSize: "1.4rem" }}>{effectiveScores[k]}</div>
                      <div style={{ fontSize: "0.85rem", color: "#666" }}>{fmtMod(calcMod(effectiveScores[k]))}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          <div style={{ padding: "0.75rem 1rem", background: "#fefce8", border: "1px solid #fef08a", borderRadius: 8, fontSize: "0.9rem", color: "#713f12" }}>
            💡 Race selection is optional — you can skip this step and choose or change your race on the character sheet later.
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          STEP 4: CLASS
      ═══════════════════════════════════════════ */}
      {step === "class" && (
        <div style={{ display: "grid", gap: "1.5rem" }}>
          {isGestalt && (
            <div style={{ padding: "0.75rem 1rem", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, fontSize: "0.9rem", color: "#166534" }}>
              🎭 <strong>Gestalt mode:</strong> Select two classes. You gain the best BAB, saves, and hit die, plus all class features from both.
            </div>
          )}

          <section style={card}>
            <h2 style={cardTitle}>Choose {isGestalt ? "Classes (pick 2)" : "a Class"}</h2>
            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
              <input value={classSearch} onChange={e => setClassSearch(e.target.value)} placeholder="Search classes..." style={{ ...input, flex: 1 }} />
              <select value={classTag} onChange={e => setClassTag(e.target.value)} style={{ ...input, width: "auto" }}>
                <option value="all">All</option>
                <option value="core">Core</option>
                <option value="base">Base</option>
                <option value="hybrid">Hybrid</option>
                <option value="occult">Occult</option>
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: "0.75rem" }}>
              {CLASSES
                .filter(c => (classTag === "all" || c.tags.includes(classTag)) &&
                  c.name.toLowerCase().includes(classSearch.toLowerCase()))
                .map(c => {
                  const isSelected = selectedClasses.some(sc => sc.cls.id === c.id);
                  return (
                    <div key={c.id}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedClasses(prev => prev.filter(sc => sc.cls.id !== c.id));
                        } else {
                          if (!isGestalt && selectedClasses.length >= 1) {
                            setSelectedClasses([{ cls: c, isPrimary: true }]);
                          } else if (isGestalt && selectedClasses.length >= 2) {
                            // replace last
                            setSelectedClasses(prev => [prev[0], { cls: c, isPrimary: false }]);
                          } else {
                            setSelectedClasses(prev => [...prev, { cls: c, isPrimary: prev.length === 0 }]);
                          }
                        }
                      }}
                      style={{
                        padding: "1rem", borderRadius: 10, cursor: "pointer",
                        border: isSelected ? "2px solid #0070f3" : "1px solid #ddd",
                        background: isSelected ? "#eff6ff" : "white",
                        transition: "all 0.15s",
                      }}>
                      <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>{c.name}</div>
                      <div style={{ fontSize: "0.78rem", color: "#666", marginBottom: "0.5rem" }}>d{c.hitDie} • {c.babProgression === "full" ? "Full BAB" : c.babProgression === "three-quarter" ? "¾ BAB" : "½ BAB"}</div>
                      <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                        {(["fort","ref","will"] as const).map(s => (
                          <span key={s} style={{
                            padding: "0.1rem 0.4rem", borderRadius: 4, fontSize: "0.72rem", fontWeight: 600,
                            background: c.saves[s] === "good" ? "#dcfce7" : "#f3f4f6",
                            color: c.saves[s] === "good" ? "#166534" : "#6b7280",
                          }}>
                            {s.charAt(0).toUpperCase()}{c.saves[s] === "good" ? "✓" : ""}
                          </span>
                        ))}
                        <span style={{ padding: "0.1rem 0.4rem", borderRadius: 4, fontSize: "0.72rem", background: "#f3f4f6", color: "#6b7280" }}>
                          {c.tags[0]}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>

          {/* Selected class details */}
          {selectedClasses.map(({ cls }) => (
            <section key={cls.id} style={{ ...card, borderColor: "#0070f3", borderWidth: 2 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <h2 style={{ ...cardTitle, color: "#0070f3" }}>{cls.name}</h2>
                <button onClick={() => setSelectedClasses(prev => prev.filter(sc => sc.cls.id !== cls.id))}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: "1.2rem" }}>✕</button>
              </div>
              <p style={{ color: "#555", marginBottom: "1rem" }}>{cls.description}</p>

              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
                <Tag label={`d${cls.hitDie} Hit Die`} color="blue" />
                <Tag label={`${cls.babProgression === "full" ? "Full" : cls.babProgression === "three-quarter" ? "¾" : "½"} BAB`} color="purple" />
                <Tag label={`${cls.skillsPerLevel} skills/level`} color="green" />
                {(["fort","ref","will"] as const).map(s => (
                  cls.saves[s] === "good" && <Tag key={s} label={`Good ${s.charAt(0).toUpperCase()+s.slice(1)}`} color="green" />
                ))}
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>Level 1 Stats (at level {level})</div>
                <div style={{ display: "flex", gap: "1.5rem", padding: "0.75rem", background: "#f9fafb", borderRadius: 8, flexWrap: "wrap" }}>
                  <StatPreview label="BAB" value={`+${getBabAtLevel(cls.babProgression, level)}`} />
                  <StatPreview label="Fort" value={fmtMod(cls.saves.fort === "good" ? getGoodSaveAtLevel(level) : getPoorSaveAtLevel(level))} />
                  <StatPreview label="Ref" value={fmtMod(cls.saves.ref === "good" ? getGoodSaveAtLevel(level) : getPoorSaveAtLevel(level))} />
                  <StatPreview label="Will" value={fmtMod(cls.saves.will === "good" ? getGoodSaveAtLevel(level) : getPoorSaveAtLevel(level))} />
                  <StatPreview label="HP die" value={`d${cls.hitDie}`} />
                </div>
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>Proficiencies</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                  {cls.proficiencies.map(p => (
                    <span key={p} style={{ padding: "0.2rem 0.5rem", borderRadius: 6, background: "#f3f4f6", fontSize: "0.8rem", color: "#374151" }}>{p}</span>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>Class Skills ({cls.classSkills.length})</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                  {cls.classSkills.map(s => (
                    <span key={s} style={{ padding: "0.2rem 0.5rem", borderRadius: 6, background: "#eff6ff", fontSize: "0.8rem", color: "#1e40af" }}>{s}</span>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 700, marginBottom: "0.75rem" }}>Level 1 Class Features</div>
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  {cls.level1Features.map(f => (
                    <div key={f.name} style={{ padding: "0.75rem", background: "#f9fafb", borderRadius: 8, borderLeft: "3px solid #10b981" }}>
                      <span style={{ fontWeight: 600 }}>{f.name}:</span>{" "}
                      <span style={{ color: "#555", fontSize: "0.9rem" }}>{f.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════
          STEP 5: LEVEL 1 DETAILS
      ═══════════════════════════════════════════ */}
      {step === "details" && (
        <div style={{ display: "grid", gap: "1.5rem" }}>
          {/* HP */}
          <section style={card}>
            <h2 style={cardTitle}>Hit Points</h2>
            {primaryClass && (
              <p style={{ color: "#666", marginBottom: "1rem" }}>
                {primaryClass.name} uses a <strong>d{hitDie}</strong> hit die.
                Level 1 always grants maximum HP. {level > 1 && `Levels 2–${level} use your chosen method below.`}
              </p>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem", marginBottom: "1rem" }}>
              {([
                { id:"max",     label:"Maximum",  desc:`Always ${hitDie} per level` },
                { id:"average", label:"Average",  desc:`${averageHpRoll} per level (rounded up)` },
                { id:"manual",  label:"Manual",   desc:"Roll each level individually" },
              ] as const).map(m => (
                <div key={m.id} onClick={() => setHpMethod(m.id)}
                  style={{ ...card, cursor:"pointer", padding:"1rem",
                    border: hpMethod === m.id ? "2px solid #0070f3" : "1px solid #ddd",
                    background: hpMethod === m.id ? "#eff6ff" : "white" }}>
                  <div style={{ fontWeight: 700 }}>{m.label}</div>
                  <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.25rem" }}>{m.desc}</div>
                </div>
              ))}
            </div>

            {/* Manual: one input per level */}
            {hpMethod === "manual" && level > 1 && (
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ fontWeight: 600, marginBottom: "0.5rem", fontSize: "0.9rem" }}>HP rolls per level (1–{hitDie}):</div>
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  {Array.from({ length: level }, (_, i) => i + 1).map(lvl => (
                    <div key={lvl} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "0.75rem", color: "#666", marginBottom: "0.25rem" }}>
                        Lv {lvl}{lvl === 1 ? " (max)" : ""}
                      </div>
                      <input type="number"
                        value={lvl === 1 ? hitDie : (manualHpRolls[lvl - 1] ?? Math.ceil(hitDie / 2))}
                        disabled={lvl === 1}
                        min={1} max={hitDie}
                        onChange={e => {
                          const val = Math.min(hitDie, Math.max(1, parseInt(e.target.value) || 1));
                          setManualHpRolls(prev => {
                            const next = [...prev];
                            next[lvl - 1] = val;
                            return next;
                          });
                        }}
                        style={{ ...input, width: 52, textAlign: "center", fontWeight: 700,
                          background: lvl === 1 ? "#f3f4f6" : "white" }} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ padding: "1rem", background: "#f0fdf4", borderRadius: 8, display: "flex", gap: "2rem", flexWrap: "wrap" }}>
              {level > 1 && (
                <div style={{ fontSize: "0.85rem", color: "#555" }}>
                  {Array.from({ length: level }, (_, i) => i + 1).map(lvl => (
                    <span key={lvl} style={{ marginRight: "0.75rem" }}>
                      Lv{lvl}: <strong>{hpRollForLevel(lvl)}{conMod !== 0 ? `${fmtMod(conMod)}` : ""}</strong>
                    </span>
                  ))}
                </div>
              )}
              <div style={{ marginLeft: "auto", display: "flex", gap: "2rem" }}>
                <div><span style={{ color: "#666" }}>CON modifier: </span><strong style={{ color: conMod >= 0 ? "#10b981" : "#ef4444" }}>{fmtMod(conMod)}</strong></div>
                <div><span style={{ color: "#666" }}>Total HP: </span><strong style={{ fontSize: "1.2rem", color: "#0070f3" }}>{calculatedHp}</strong></div>
              </div>
            </div>
          </section>

          {/* Skills */}
          <section style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <h2 style={{ ...cardTitle, marginBottom: 0 }}>Skill Ranks</h2>
              <div style={{
                padding: "0.4rem 0.9rem", borderRadius: 8, fontWeight: 700, fontSize: "0.9rem",
                background: usedSkillRanks > totalSkillRanks ? "#fee2e2" : usedSkillRanks === totalSkillRanks ? "#dcfce7" : "#eff6ff",
                color: usedSkillRanks > totalSkillRanks ? "#991b1b" : usedSkillRanks === totalSkillRanks ? "#166534" : "#1e40af",
              }}>
                {usedSkillRanks} / {totalSkillRanks} ranks used
              </div>
            </div>
            {primaryClass && (
              <p style={{ color: "#666", marginBottom: "1rem", fontSize: "0.9rem" }}>
                {primaryClass.skillsPerLevel} base + {intMod >= 0 ? "+" : ""}{intMod} INT modifier = {Math.max(1,skillRanksPerLevel)} ranks/level × {level} level{level > 1 ? "s" : ""} = <strong>{totalSkillRanks} total</strong>
              </p>
            )}
            <div style={{ display: "grid", gap: "0.4rem", maxHeight: 400, overflowY: "auto" }}>
              {/* Show all class skills first, then others */}
              {[...allClassSkills].sort().concat(
                ["Acrobatics","Appraise","Bluff","Climb","Diplomacy","Disable Device","Disguise","Escape Artist","Fly","Handle Animal","Heal","Intimidate","Knowledge (Arcana)","Knowledge (Dungeoneering)","Knowledge (Engineering)","Knowledge (Geography)","Knowledge (History)","Knowledge (Local)","Knowledge (Nature)","Knowledge (Nobility)","Knowledge (Planes)","Knowledge (Religion)","Linguistics","Perception","Ride","Sense Motive","Sleight of Hand","Spellcraft","Stealth","Survival","Swim","Use Magic Device"]
                  .filter(s => !allClassSkills.has(s))
              ).map(skillName => {
                const isClass = allClassSkills.has(skillName);
                const ranks = skillRanks[skillName] ?? 0;
                return (
                  <div key={skillName} style={{
                    display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0.75rem",
                    background: isClass ? "#eff6ff" : "#f9fafb", borderRadius: 6,
                  }}>
                    <div style={{ flex: 1, fontWeight: isClass ? 600 : 400, fontSize: "0.9rem" }}>
                      {skillName}
                      {isClass && <span style={{ marginLeft: "0.4rem", fontSize: "0.7rem", color: "#0070f3", fontWeight: 700 }}>CS</span>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <button onClick={() => setSkillRanks(p => ({ ...p, [skillName]: Math.max(0,(p[skillName]??0)-1) }))}
                        style={pbBtn}>−</button>
                      <span style={{ width: 24, textAlign: "center", fontWeight: 700 }}>{ranks}</span>
                      <button onClick={() => {
                        if (usedSkillRanks < totalSkillRanks || ranks > 0) {
                          setSkillRanks(p => ({ ...p, [skillName]: Math.min(level,(p[skillName]??0)+1) }));
                        }
                      }} style={pbBtn} disabled={usedSkillRanks >= totalSkillRanks && ranks === 0}>+</button>
                    </div>
                    {isClass && ranks > 0 && (
                      <span style={{ fontSize: "0.75rem", color: "#10b981", fontWeight: 600, width: 40 }}>+3 CS</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Backstory */}
          <section style={card}>
            <h2 style={cardTitle}>Backstory & Notes <span style={{ fontWeight: 400, color: "#999", fontSize: "0.85rem" }}>(optional)</span></h2>
            <textarea value={backstory} onChange={e => setBackstory(e.target.value)}
              placeholder="Write your character's backstory, personality, appearance, or notes..."
              rows={5} style={{ ...input, resize: "vertical", fontFamily: "inherit" }} />
          </section>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          STEP 6: FEATS
      ═══════════════════════════════════════════ */}
      {step === "feats" && (
        <div style={{ display: "grid", gap: "1.5rem" }}>
          <section style={card}>
            <h2 style={cardTitle}>Starting Feat{level >= 3 ? "s" : ""}</h2>
            <p style={{ color: "#666", marginBottom: "1rem", fontSize: "0.9rem" }}>
              All characters receive one feat at 1st level, then every odd level (3, 5, 7...).
              At level {level} you get <strong>{1 + Math.floor((level - 1) / 2)} feat{1 + Math.floor((level - 1) / 2) > 1 ? "s" : ""}</strong> from leveling.
              {selectedClasses.some(c => ["fighter"].includes(c.cls.id)) && " Fighters also get bonus combat feats — add those here too."}
              {selectedClasses.some(c => ["wizard"].includes(c.cls.id)) && " Wizards get Scribe Scroll for free — it'll be added with your class features."}
            </p>

            <button onClick={() => setShowFeatBrowser(true)}
              style={{ padding: "0.75rem 1.5rem", background: "#0070f3", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, marginBottom: "1.5rem" }}>
              ⚔️ Open Feat Browser
            </button>

            {selectedFeats.length > 0 ? (
              <div style={{ display: "grid", gap: "0.5rem" }}>
                {selectedFeats.map((f, i) => (
                  <div key={i} style={{ padding: "0.75rem 1rem", background: "#eff6ff", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "start", borderLeft: "3px solid #0070f3" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{f.name}</div>
                      {f.prerequisites && <div style={{ fontSize: "0.8rem", color: "#888", marginTop: "0.2rem" }}>Req: {f.prerequisites}</div>}
                      {f.description && <div style={{ fontSize: "0.85rem", color: "#555", marginTop: "0.25rem" }}>{f.description.slice(0, 120)}{f.description.length > 120 ? "…" : ""}</div>}
                    </div>
                    <button onClick={() => setSelectedFeats(prev => prev.filter((_, j) => j !== i))}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#999", marginLeft: "0.5rem", flexShrink: 0 }}>✕</button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "2rem", textAlign: "center", color: "#999", border: "2px dashed #ddd", borderRadius: 8 }}>
                No feats selected yet. Open the Feat Browser above to choose.
              </div>
            )}

            <div style={{ marginTop: "1rem", padding: "0.75rem 1rem", background: "#fefce8", border: "1px solid #fef08a", borderRadius: 8, fontSize: "0.85rem", color: "#713f12" }}>
              💡 You can always add more feats from the Feats &amp; Abilities tab on the character sheet after creation.
            </div>
          </section>

          <FeatBrowser
            isOpen={showFeatBrowser}
            onClose={() => setShowFeatBrowser(false)}
            onSelectFeat={(feat: any) => {
              setSelectedFeats(prev => [...prev, {
                name: feat.name,
                description: feat.benefit || "",
                prerequisites: feat.prerequisites || "",
                category: (feat.types || []).join(", "),
                source: feat.source || "",
              }]);
            }}
          />
        </div>
      )}

      {/* ═══════════════════════════════════════════
          STEP 7: TRAITS
      ═══════════════════════════════════════════ */}
      {step === "traits" && (
        <div style={{ display: "grid", gap: "1.5rem" }}>
          <section style={card}>
            <h2 style={cardTitle}>Character Traits</h2>
            <p style={{ color: "#666", marginBottom: "1rem", fontSize: "0.9rem" }}>
              Characters typically choose <strong>2 traits</strong> at character creation. You may take 1 drawback to gain a 3rd trait.
            </p>

            <button onClick={() => setShowTraitBrowser(true)}
              style={{ padding: "0.75rem 1.5rem", background: "#10b981", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, marginBottom: "1.5rem" }}>
              ✨ Open Trait Browser
            </button>

            {selectedTraits.length > 0 ? (
              <div style={{ display: "grid", gap: "0.5rem" }}>
                {selectedTraits.map((t, i) => {
                  const isDrawback = t.type === "drawback";
                  return (
                    <div key={i} style={{ padding: "0.75rem 1rem", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "start",
                      background: isDrawback ? "#fef2f2" : "#f0fdf4",
                      borderLeft: `3px solid ${isDrawback ? "#ef4444" : "#10b981"}` }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ fontWeight: 700 }}>{t.name}</span>
                          <span style={{ fontSize: "0.72rem", padding: "0.1rem 0.4rem", borderRadius: 4,
                            background: isDrawback ? "#fee2e2" : "#dcfce7",
                            color: isDrawback ? "#991b1b" : "#166534", fontWeight: 600 }}>
                            {t.type}
                          </span>
                        </div>
                        {t.description && <div style={{ fontSize: "0.85rem", color: "#555", marginTop: "0.25rem" }}>{t.description.slice(0, 120)}{t.description.length > 120 ? "…" : ""}</div>}
                      </div>
                      <button onClick={() => setSelectedTraits(prev => prev.filter((_, j) => j !== i))}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#999", marginLeft: "0.5rem", flexShrink: 0 }}>✕</button>
                    </div>
                  );
                })}
                {selectedTraits.filter(t => t.type !== "drawback").length > 2 && (
                  <div style={{ padding: "0.75rem 1rem", background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 8, fontSize: "0.9rem", color: "#713f12" }}>
                    ⚠️ You have {selectedTraits.filter(t => t.type !== "drawback").length} non-drawback traits. Standard characters get 2 (or 3 with a drawback).
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: "2rem", textAlign: "center", color: "#999", border: "2px dashed #ddd", borderRadius: 8 }}>
                No traits selected. Open the Trait Browser to choose.
              </div>
            )}

            <div style={{ marginTop: "1rem", padding: "0.75rem 1rem", background: "#fefce8", border: "1px solid #fef08a", borderRadius: 8, fontSize: "0.85rem", color: "#713f12" }}>
              💡 Traits are optional — you can skip this step and add traits later on the character sheet.
            </div>
          </section>

          <TraitBrowser
            isOpen={showTraitBrowser}
            onClose={() => setShowTraitBrowser(false)}
            onSelectTrait={(trait: any) => {
              setSelectedTraits(prev => [...prev, {
                name: trait.name,
                description: trait.benefit || "",
                type: trait.type || "general",
                source: trait.source || "",
              }]);
            }}
          />
        </div>
      )}

      {/* ═══════════════════════════════════════════
          STEP 8: REVIEW
      ═══════════════════════════════════════════ */}
      {step === "review" && (
        <div style={{ display: "grid", gap: "1.5rem" }}>
          <section style={card}>
            <h2 style={cardTitle}>Character Summary</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem 2rem", marginBottom: "1.5rem" }}>
              <ReviewRow label="Name" value={name} />
              <ReviewRow label="Type" value={characterType.replace("_"," ")} />
              <ReviewRow label="Race" value={selectedRace?.id === "custom" ? (customRaceName || "Custom") : (selectedRace?.name ?? "—")} />
              <ReviewRow label="Class(es)" value={selectedClasses.map(c=>c.cls.name).join(" / ") || "—"} />
              <ReviewRow label="Level" value={String(level)} />
              <ReviewRow label="Alignment" value={alignment || "—"} />
              <ReviewRow label="Deity" value={deity || "—"} />
              <ReviewRow label="Homeland" value={homeland || "—"} />
              {isGestalt && <ReviewRow label="Gestalt" value="Yes" />}
            </div>
          </section>

          {/* Ability scores */}
          <section style={card}>
            <h2 style={cardTitle}>Final Ability Scores</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: "1rem" }}>
              {STAT_KEYS.map(k => {
                const baseScore = scoreMethod === "standard" ? (standardAssigned[k] ?? 10) : scores[k];
                const finalScore = effectiveScores[k];
                const diff = finalScore - baseScore;
                return (
                  <div key={k} style={{ textAlign: "center", padding: "0.75rem", background: "#f9fafb", borderRadius: 8 }}>
                    <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>{STAT_LABELS[k]}</div>
                    <div style={{ fontWeight: 700, fontSize: "2rem" }}>{finalScore}</div>
                    <div style={{ fontSize: "0.9rem", color: "#666" }}>{fmtMod(calcMod(finalScore))}</div>
                    {diff !== 0 && (
                      <div style={{ fontSize: "0.75rem", color: diff > 0 ? "#10b981" : "#ef4444", marginTop: "0.2rem" }}>
                        {diff > 0 ? "+" : ""}{diff} racial
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Combat stats */}
          <section style={card}>
            <h2 style={cardTitle}>Combat Stats at Level {level}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "1rem" }}>
              <StatCard label="Max HP" value={String(calculatedHp)} color="#10b981" />
              <StatCard label="BAB" value={`+${babValue}`} color="#0070f3" />
              <StatCard label="Fort" value={fmtMod(getSave("fort"))} color="#f59e0b" />
              <StatCard label="Ref" value={fmtMod(getSave("ref"))} color="#f59e0b" />
              <StatCard label="Will" value={fmtMod(getSave("will"))} color="#f59e0b" />
            </div>
          </section>

          {/* Sources to be created */}
          <section style={card}>
            <h2 style={cardTitle}>Stat Sources to be Created</h2>
            <p style={{ color: "#666", marginBottom: "1rem", fontSize: "0.9rem" }}>
              These will be added to your character's sources system and will appear in hover tooltips on the character sheet.
            </p>
            <div style={{ display: "grid", gap: "0.4rem" }}>
              {/* Base scores */}
              {STAT_KEYS.map(k => {
                const base = scoreMethod === "standard" ? (standardAssigned[k] ?? 10) : scores[k];
                return (
                  <SourceRow key={`base-${k}`} category={STAT_LABELS[k]} name="Base Score" value={base} type="base" />
                );
              })}
              {/* Racial mods */}
              {selectedRace && selectedRace.id !== "custom" && !["human","half-elf","half-orc"].includes(selectedRace.id) &&
                selectedRace.abilityMods.map(m => (
                  <SourceRow key={`racial-${m.stat}`}
                    category={STAT_LABELS[m.stat.replace("ability_","") as keyof AbilityScores]}
                    name={`${selectedRace.name} racial`} value={m.value} type="racial" />
                ))}
              {["human","half-elf","half-orc"].includes(selectedRace?.id ?? "") && (
                <SourceRow category={STAT_LABELS[humanFlexStat]} name={`${selectedRace!.name} racial`} value={2} type="racial" />
              )}
              {selectedRace?.id === "custom" && STAT_KEYS.filter(k => customRaceMods[k] !== 0).map(k => (
                <SourceRow key={`custom-${k}`} category={STAT_LABELS[k]} name={`${customRaceName || "Race"} racial`} value={customRaceMods[k]} type="racial" />
              ))}
              {/* HP */}
              {Array.from({ length: level }, (_, i) => i + 1).map(lvl => (
                <SourceRow key={`hp-${lvl}`} category="HP Max" name={`${primaryClass?.name ?? "Class"} HD (lv ${lvl})`} value={hpRollForLevel(lvl)} type="class" />
              ))}
              {conMod !== 0 && <SourceRow category="HP Max" name={`CON modifier (×${level})`} value={conMod * level} type="ability" />}
              {/* BAB */}
              <SourceRow category="BAB" name={`${primaryClass?.name ?? "Class"} BAB`} value={babValue} type="class" />
              {/* Saves */}
              {(["fort","ref","will"] as const).map(s => {
                const cls = selectedClasses[0]?.cls;
                if (!cls) return null;
                const base = cls.saves[s] === "good" ? getGoodSaveAtLevel(level) : getPoorSaveAtLevel(level);
                const abKey: Record<string,keyof AbilityScores> = { fort:"con", ref:"dex", will:"wis" };
                const abMod = calcMod(effectiveScores[abKey[s]]);
                const saveLabel = { fort:"Fortitude", ref:"Reflex", will:"Will" }[s];
                return (
                  <React.Fragment key={s}>
                    <SourceRow category={saveLabel!} name={`${cls.name} base`} value={base} type="class" />
                    {abMod !== 0 && <SourceRow category={saveLabel!} name={`${s === "fort" ? "CON" : s === "ref" ? "DEX" : "WIS"} mod`} value={abMod} type="ability" />}
                  </React.Fragment>
                );
              })}
            </div>
          </section>

          {/* Skill ranks summary */}
          {usedSkillRanks > 0 && (
            <section style={card}>
              <h2 style={cardTitle}>Skill Ranks ({usedSkillRanks} assigned)</h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {Object.entries(skillRanks).filter(([_name, r]) => r > 0).map(([name, ranks]) => (
                  <span key={name} style={{ padding: "0.25rem 0.6rem", borderRadius: 6, background: "#eff6ff", fontSize: "0.85rem" }}>
                    {name} <strong>{ranks}</strong>{allClassSkills.has(name) && <span style={{ color: "#10b981", marginLeft: 2 }}>+CS</span>}
                  </span>
                ))}
              </div>
            </section>
          )}

          {selectedFeats.length > 0 && (
            <section style={card}>
              <h2 style={cardTitle}>Feats ({selectedFeats.length})</h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {selectedFeats.map((f, i) => (
                  <span key={i} style={{ padding: "0.3rem 0.75rem", background: "#eff6ff", borderRadius: 6, fontWeight: 600, fontSize: "0.85rem" }}>{f.name}</span>
                ))}
              </div>
            </section>
          )}

          {selectedTraits.length > 0 && (
            <section style={card}>
              <h2 style={cardTitle}>Traits ({selectedTraits.length})</h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {selectedTraits.map((t, i) => (
                  <span key={i} style={{ padding: "0.3rem 0.75rem", borderRadius: 6, fontWeight: 600, fontSize: "0.85rem",
                    background: t.type === "drawback" ? "#fee2e2" : "#f0fdf4",
                    color: t.type === "drawback" ? "#991b1b" : "#166534" }}>
                    {t.name} <span style={{ fontWeight: 400, opacity: 0.7 }}>({t.type})</span>
                  </span>
                ))}
              </div>
            </section>
          )}

          {selectedRace && selectedRace.traits.length > 0 && (
            <section style={card}>
              <h2 style={cardTitle}>Racial Traits ({selectedRace.traits.length})</h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {selectedRace.traits.map(t => (
                  <span key={t.name} style={{ padding: "0.3rem 0.75rem", background: "#ede9fe", borderRadius: 6, fontWeight: 600, fontSize: "0.85rem", color: "#5b21b6" }}>{t.name}</span>
                ))}
              </div>
            </section>
          )}

          {selectedClasses.length > 0 && (
            <section style={card}>
              <h2 style={cardTitle}>Class Features</h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {selectedClasses.flatMap(({ cls }) => cls.level1Features.map(f => (
                  <span key={`${cls.name}-${f.name}`} style={{ padding: "0.3rem 0.75rem", background: "#fef3c7", borderRadius: 6, fontWeight: 600, fontSize: "0.85rem", color: "#713f12" }}>
                    {f.name} <span style={{ fontWeight: 400, opacity: 0.7 }}>({cls.name})</span>
                  </span>
                )))}
              </div>
            </section>
          )}

          <div style={{ padding: "1rem", background: "#fffbeb", border: "1px solid #fef08a", borderRadius: 8, fontSize: "0.9rem", color: "#713f12" }}>
            💡 After creation, you can add armor, weapons, spells, and more from the character sheet.
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────
          NAV BUTTONS
      ───────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2rem", paddingTop: "1.5rem", borderTop: "1px solid #e5e7eb" }}>
        <div>
          {currentIndex > 0 && (
            <button onClick={goBack} style={{ ...navBtn, background: "#f3f4f6", color: "#374151" }}>
              ← Back
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <Link href={`/pathfinder/${campaignId}/characters`}
            style={{ color: "#999", fontSize: "0.9rem", textDecoration: "none" }}>Cancel</Link>

          {step === "review" ? (
            <button onClick={handleCreate} disabled={saving}
              style={{ ...navBtn, background: saving ? "#9ca3af" : "#10b981", color: "white", fontSize: "1.05rem" }}>
              {saving ? "Creating..." : "✨ Create Character"}
            </button>
          ) : (
            <button onClick={goNext} style={{ ...navBtn, background: "#0070f3", color: "white" }}>
              Next →
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────
// MINI COMPONENTS
// ─────────────────────────────────────────────

function Tag({ label, color }: { label: string; color: "blue"|"green"|"purple"|"gray" }) {
  const styles: Record<string,{bg:string;text:string}> = {
    blue:   { bg:"#dbeafe", text:"#1e40af" },
    green:  { bg:"#dcfce7", text:"#166534" },
    purple: { bg:"#ede9fe", text:"#5b21b6" },
    gray:   { bg:"#f3f4f6", text:"#374151" },
  };
  return (
    <span style={{ padding:"0.2rem 0.6rem", borderRadius:6, fontSize:"0.8rem", fontWeight:600, background:styles[color].bg, color:styles[color].text }}>
      {label}
    </span>
  );
}

function StatPreview({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: "0.75rem", color: "#999", fontWeight: 600 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{value}</div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ textAlign: "center", padding: "1rem", background: "#f9fafb", borderRadius: 10, border: `2px solid ${color}20` }}>
      <div style={{ color: "#666", fontSize: "0.8rem", marginBottom: "0.25rem" }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: "1.8rem", color }}>{value}</div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: "0.5rem", padding: "0.4rem 0", borderBottom: "1px solid #f3f4f6" }}>
      <span style={{ color: "#999", minWidth: 90, fontSize: "0.9rem" }}>{label}</span>
      <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{value}</span>
    </div>
  );
}

function SourceRow({ category, name, value, type }: { category:string; name:string; value:number; type:string }) {
  if (value === 0) return null;
  const typeColor: Record<string,string> = { base:"#6b7280", racial:"#7c3aed", class:"#0070f3", ability:"#10b981" };
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"0.75rem", padding:"0.4rem 0.75rem", background:"#f9fafb", borderRadius:6 }}>
      <span style={{ minWidth:80, fontWeight:600, fontSize:"0.85rem" }}>{category}</span>
      <span style={{ flex:1, fontSize:"0.85rem", color:"#555" }}>{name}</span>
      <span style={{ padding:"0.1rem 0.4rem", borderRadius:4, fontSize:"0.72rem", fontWeight:600, background:typeColor[type]+"20", color:typeColor[type] }}>{type}</span>
      <span style={{ fontWeight:700, fontSize:"0.95rem", color:value>=0?"#10b981":"#ef4444", minWidth:36, textAlign:"right" }}>
        {value>=0?"+":""}{value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// SHARED STYLES
// ─────────────────────────────────────────────

const card: React.CSSProperties = {
  background: "white", border: "1px solid #ddd", borderRadius: 12, padding: "1.5rem",
};
const cardTitle: React.CSSProperties = {
  marginTop: 0, marginBottom: "1rem", fontSize: "1.15rem",
};
const label: React.CSSProperties = {
  display: "block", fontWeight: 600, marginBottom: "0.5rem", fontSize: "0.9rem",
};
const input: React.CSSProperties = {
  width: "100%", padding: "0.75rem", border: "1px solid #ddd", borderRadius: 6,
  fontSize: "1rem", boxSizing: "border-box",
};
const pbBtn: React.CSSProperties = {
  width: 28, height: 28, border: "1px solid #ddd", borderRadius: 6,
  background: "white", cursor: "pointer", fontWeight: 700, fontSize: "1rem",
  display: "flex", alignItems: "center", justifyContent: "center",
};
const navBtn: React.CSSProperties = {
  padding: "0.75rem 1.75rem", border: "none", borderRadius: 8,
  cursor: "pointer", fontWeight: 700, fontSize: "1rem",
};
