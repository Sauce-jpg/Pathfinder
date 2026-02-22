"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { StatWithSources } from "@/components/StatWithSources";
import { Skills } from "@/components/Skills";
import { Features } from "@/components/Features";
import { Spells } from "@/components/Spells";
import { Inventory } from "@/components/Inventory";
import { Equipment } from "@/components/Equipment";
import { FeatBrowser } from "@/components/FeatBrowser";
import { getBabAtLevel, getGoodSaveAtLevel, getPoorSaveAtLevel, CLASSES } from "@/lib/pf-data";

// Utility functions
function calculateMod(score: number, temp: number = 0): number {
  return Math.floor(((score + temp) - 10) / 2);
}

function formatMod(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export default function CharacterSheetPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.campaignId as string;
  const characterId = params.characterId as string;

  const [session, setSession] = useState<any>(null);
  const [character, setCharacter] = useState<any>(null);
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "combat" | "skills" | "feats" | "spells" | "equipment" | "inventory" | "story">("overview");

  // Sources for calculated stats
  const [statSources, setStatSources] = useState<any>({});
  const [equippedAcp, setEquippedAcp] = useState<number>(0);
  const [equippedArmorAcBonus, setEquippedArmorAcBonus] = useState<number>(0);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  // Level up wizard
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpStep, setLevelUpStep] = useState<"class" | "hp" | "skills" | "feats" | "confirm">("class");
  const [levelUpChosenClassId, setLevelUpChosenClassId] = useState<string>("");
  const [levelUpHpMethod, setLevelUpHpMethod] = useState<"max"|"average"|"manual">("average");
  const [levelUpHpRoll, setLevelUpHpRoll] = useState<number>(0);
  const [levelUpSkillRanks, setLevelUpSkillRanks] = useState<Record<string, number>>({});
  const [levelUpFeats, setLevelUpFeats] = useState<any[]>([]);
  const [levelUpShowFeatBrowser, setLevelUpShowFeatBrowser] = useState(false);
  const [levelUpSaving, setLevelUpSaving] = useState(false);
  const [levelUpFeatSlots, setLevelUpFeatSlots] = useState<{label:string;source:string}[]>([]);
  // Existing data loaded when wizard opens
  const [existingSkills, setExistingSkills] = useState<Record<string, { ranks: number; is_class_skill: boolean }>>({});
  const [existingFeats, setExistingFeats] = useState<any[]>([]);
  // Class level history loaded from stat_sources
  const [classLevelHistory, setClassLevelHistory] = useState<Array<{ className: string; classId: string; charLevel: number; classLevel: number }>>([]);

  // Editable state
  const [editData, setEditData] = useState<any>(null);

  // Check auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load character
  useEffect(() => {
    if (!session?.user?.id) return;
    loadCharacter();
  }, [session?.user?.id, characterId]);

  async function loadCharacter() {
    setLoading(true);

    // Load campaign
    const { data: campaignData } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();
    setCampaign(campaignData);

    // Load character
    const { data: charData, error } = await supabase
      .from("characters")
      .select("*")
      .eq("id", characterId)
      .single();

    if (error) {
      console.error("Error loading character:", error);
    } else {
      setCharacter(charData);
      setEditData(charData);
    }

    // Load all stat sources
    const { data: sourcesData } = await supabase
      .from("character_stat_sources")
      .select("*")
      .eq("character_id", characterId)
      .eq("is_active", true);

    // Group sources by stat category
    const grouped: any = {};
    (sourcesData || []).forEach((source: any) => {
      if (!grouped[source.stat_category]) {
        grouped[source.stat_category] = [];
      }
      grouped[source.stat_category].push(source);
    });

    setStatSources(grouped);

    // Load equipped armor stats (ACP and AC bonus) across all equipped pieces
    const { data: equippedArmors } = await supabase
      .from("character_armor")
      .select("armor_check_penalty, ac_bonus, enhancement_bonus")
      .eq("character_id", characterId)
      .eq("is_equipped", true);

    const totalAcp = (equippedArmors || []).reduce((sum, a) => sum + (a.armor_check_penalty ?? 0), 0);
    const totalArmorAc = (equippedArmors || []).reduce((sum, a) => sum + (a.ac_bonus ?? 0) + (a.enhancement_bonus ?? 0), 0);
    setEquippedAcp(totalAcp);
    setEquippedArmorAcBonus(totalArmorAc);

    setLoading(false);
  }

  async function openLevelUpWizard() {
    const [{ data: skillsData }, { data: featsData }, { data: classLevelData }] = await Promise.all([
      supabase.from("character_skills").select("skill_name, ranks, is_class_skill").eq("character_id", characterId),
      supabase.from("character_features").select("name, description, prerequisites, category, feature_type, obtained_level").eq("character_id", characterId).eq("feature_type", "feat").eq("is_active", true),
      supabase.from("character_stat_sources").select("source_name, obtained_notes, obtained_level").eq("character_id", characterId).eq("stat_category", "class_level").order("obtained_level", { ascending: true }),
    ]);

    const skillMap: Record<string, { ranks: number; is_class_skill: boolean }> = {};
    (skillsData || []).forEach((s: any) => { skillMap[s.skill_name] = { ranks: s.ranks || 0, is_class_skill: s.is_class_skill || false }; });
    setExistingSkills(skillMap);
    setExistingFeats(featsData || []);

    // Parse class level history: obtained_notes = "classId", source_name = "ClassName level N"
    const history = (classLevelData || []).map((r: any) => {
      const match = r.source_name?.match(/^(.+) level (\d+)$/);
      return {
        className: match?.[1] ?? r.source_name,
        classId: r.obtained_notes ?? "",
        charLevel: r.obtained_level,
        classLevel: match ? parseInt(match[2]) : 1,
      };
    });
    setClassLevelHistory(history);

    setLevelUpStep("class");
    setLevelUpChosenClassId("");
    setLevelUpHpMethod("average");
    setLevelUpHpRoll(0);
    setLevelUpSkillRanks({});
    setLevelUpFeats([]);
    setShowLevelUp(true);
  }

  async function handleSave() {

    const { error } = await supabase
      .from("characters")
      .update(editData)
      .eq("id", characterId);

    if (error) {
      alert("Error saving: " + error.message);
    } else {
      setCharacter(editData);
      setEditing(false);
    }

    setSaving(false);
  }

  async function handleDelete() {
    if (deleteInput.trim().toUpperCase() !== "DELETE") return;
    setDeleting(true);
    try {
      // Delete all related data first
      await Promise.all([
        supabase.from("character_stat_sources").delete().eq("character_id", characterId),
        supabase.from("character_features").delete().eq("character_id", characterId),
        supabase.from("character_skills").delete().eq("character_id", characterId),
      ]);
      await supabase.from("characters").delete().eq("id", characterId);
      router.push(`/pathfinder/${char.campaign_id ?? ""}`);
    } catch (err: any) {
      alert("Error deleting character: " + err.message);
      setDeleting(false);
    }
  }

  async function handleSetStatus(status: string) {
    const baseType = (character.character_type || "PC").split(":")[0];
    const newType = status === "active" ? baseType : `${baseType}:${status}`;
    await supabase.from("characters").update({ character_type: newType }).eq("id", characterId);
    setCharacter((prev: any) => ({ ...prev, character_type: newType }));
    setShowStatusMenu(false);
  }

  async function handleLevelUp() {
    setLevelUpSaving(true);
    const newCharLevel = (character.level || 1) + 1;

    const chosenClass = CLASSES.find((c: any) => c.id === levelUpChosenClassId);
    if (!chosenClass) { alert("No class selected."); setLevelUpSaving(false); return; }

    // Compute new class level: count how many times this class appears in history + 1
    const prevClassLevels = classLevelHistory.filter(h => h.classId === levelUpChosenClassId).length;
    const newClassLevel = prevClassLevels + 1;

    // Update the classes display string on the character
    // Build a map of classId -> level from history + new level
    const classLevelMap: Record<string, { name: string; level: number }> = {};
    classLevelHistory.forEach(h => { classLevelMap[h.classId] = { name: h.className, level: h.classLevel }; });
    classLevelMap[levelUpChosenClassId] = { name: chosenClass.name, level: newClassLevel };
    const classesString = Object.values(classLevelMap)
      .sort((a, b) => b.level - a.level)
      .map(c => `${c.name} ${c.level}`)
      .join(" / ");

    // HP calculation
    const hpSources = statSources["hp_max"] || [];
    const hitDie = chosenClass.hitDie;
    const averageRoll = Math.ceil(hitDie / 2) + 1;
    const currentConMod = Math.floor((getStatTotal("ability_con") - 10) / 2);
    const hpRoll = levelUpHpMethod === "max" ? hitDie
      : levelUpHpMethod === "average" ? averageRoll
      : Math.max(1, Math.min(hitDie, levelUpHpRoll));

    try {
      // ── Record class level choice ──
      await supabase.from("character_stat_sources").insert({
        character_id: characterId,
        stat_category: "class_level",
        source_name: `${chosenClass.name} level ${newClassLevel}`,
        source_type: "class",
        bonus_value: newClassLevel,
        bonus_type: "untyped",
        is_active: true,
        obtained_level: newCharLevel,
        obtained_notes: chosenClass.id,
      });

      // ── HP source for new level ──
      await supabase.from("character_stat_sources").insert({
        character_id: characterId,
        stat_category: "hp_max",
        source_name: `${chosenClass.name} HD (level ${newCharLevel})`,
        source_type: "class",
        bonus_value: hpRoll,
        bonus_type: "untyped",
        is_active: true,
        obtained_level: newCharLevel,
        obtained_notes: `d${hitDie}`,
      });

      // ── Update CON modifier HP source ──
      const conModSource = hpSources.find((s: any) => s.source_type === "ability" && s.source_name?.includes("CON"));
      if (conModSource && currentConMod !== 0) {
        await supabase.from("character_stat_sources")
          .update({ bonus_value: currentConMod * newCharLevel, source_name: `CON modifier (×${newCharLevel})` })
          .eq("id", conModSource.id);
      } else if (!conModSource && currentConMod !== 0) {
        await supabase.from("character_stat_sources").insert({
          character_id: characterId, stat_category: "hp_max",
          source_name: `CON modifier (×${newCharLevel})`, source_type: "ability",
          bonus_value: currentConMod * newCharLevel, bonus_type: "untyped",
          is_active: true, obtained_level: newCharLevel,
        });
      }

      // ── BAB: recalculate from class level history + new class ──
      // Build combined BAB across all classes at their new levels
      const newClassMap = { ...classLevelMap };
      let totalBab = 0;
      Object.entries(newClassMap).forEach(([cid, cd]) => {
        const cls = CLASSES.find(c => c.id === cid);
        if (cls) totalBab += getBabAtLevel(cls.babProgression, cd.level);
      });
      const babSources = statSources["bab"] || [];
      const classBabSrc = babSources.find((s: any) => s.source_type === "class");
      if (classBabSrc) {
        await supabase.from("character_stat_sources").update({ bonus_value: totalBab, obtained_level: newCharLevel }).eq("id", classBabSrc.id);
      }

      // ── Saves: recalculate from class level history ──
      for (const saveKey of ["save_fort", "save_ref", "save_will"] as const) {
        const saveType = saveKey.replace("save_", "") as "fort" | "ref" | "will";
        let totalBase = 0;
        Object.entries(newClassMap).forEach(([cid, cd]) => {
          const cls = CLASSES.find(c => c.id === cid);
          if (cls) {
            totalBase += cls.saves[saveType] === "good"
              ? getGoodSaveAtLevel(cd.level)
              : getPoorSaveAtLevel(cd.level);
          }
        });
        // Multiclass stacking adjustment
        const extraClasses = Object.keys(newClassMap).length - 1;
        if (extraClasses > 0) totalBase -= extraClasses * 2;
        const finalBase = Math.max(0, totalBase);

        const saveSources = statSources[saveKey] || [];
        const classSaveSrc = saveSources.find((s: any) => s.source_type === "class");
        if (classSaveSrc) {
          await supabase.from("character_stat_sources")
            .update({ bonus_value: finalBase, obtained_level: newCharLevel })
            .eq("id", classSaveSrc.id);
        } else {
          // Row was never created (poor save = 0 at level 1 was skipped) — insert it now
          const saveLabel = saveType === "fort" ? "Fortitude" : saveType === "ref" ? "Reflex" : "Will";
          await supabase.from("character_stat_sources").insert({
            character_id: characterId,
            stat_category: saveKey,
            source_name: `${chosenClass.name} base ${saveLabel}`,
            source_type: "class",
            bonus_value: finalBase,
            bonus_type: "untyped",
            is_active: true,
            obtained_level: newCharLevel,
          });
        }
      }

      // ── Skill ranks ──
      for (const [skillName, newRanks] of Object.entries(levelUpSkillRanks)) {
        if (newRanks <= 0) continue;
        const { data: existing } = await supabase.from("character_skills").select("id, ranks").eq("character_id", characterId).eq("skill_name", skillName).single();
        if (existing) {
          await supabase.from("character_skills").update({ ranks: (existing.ranks || 0) + newRanks }).eq("id", existing.id);
        } else {
          await supabase.from("character_skills").insert({ character_id: characterId, skill_name: skillName, ranks: newRanks, is_class_skill: false });
        }
      }

      // ── New feats ──
      if (levelUpFeats.length > 0) {
        await supabase.from("character_features").insert(
          levelUpFeats.map((f, i) => ({
            character_id: characterId,
            feature_type: "feat",
            name: f.name,
            description: f.benefit || f.description || null,
            prerequisites: f.prerequisites || null,
            category: f.slotLabel || f.category || null,
            source: f.slotSource || levelUpFeatSlots[i]?.source || `${chosenClass.name} level ${newClassLevel}`,
            obtained_level: newCharLevel,
            is_active: true,
          }))
        );
      }

      // ── Update character level and classes string ──
      await supabase.from("characters").update({ level: newCharLevel, classes: classesString }).eq("id", characterId);

      setShowLevelUp(false);
      setLevelUpStep("class");
      setLevelUpChosenClassId("");
      setLevelUpHpRoll(0);
      setLevelUpSkillRanks({});
      setLevelUpFeats([]);
      await loadCharacter();
    } catch (err: any) {
      alert("Error leveling up: " + err.message);
    }
    setLevelUpSaving(false);
  }

  function updateField(field: string, value: any) {
    setEditData((prev: any) => ({ ...prev, [field]: value }));
  }

  // Calculate totals from sources
  function getStatTotal(category: string): number {
    const sources = statSources[category] || [];
    return sources.reduce((sum: number, s: any) => sum + s.bonus_value, 0);
  }

  if (!session) {
    return (
      <main style={{ maxWidth: 900, margin: "4rem auto", padding: "2rem", textAlign: "center" }}>
        <p>Please sign in to view this character.</p>
        <a href="/auth/login" style={{ color: "#0070f3" }}>Sign In</a>
      </main>
    );
  }

  if (loading) {
    return (
      <main style={{ maxWidth: 900, margin: "4rem auto", padding: "2rem", textAlign: "center" }}>
        <p>Loading character...</p>
      </main>
    );
  }

  if (!character) {
    return (
      <main style={{ maxWidth: 900, margin: "4rem auto", padding: "2rem", textAlign: "center" }}>
        <h1>Character not found</h1>
        <Link href={`/pathfinder/${campaignId}/characters`} style={{ color: "#0070f3" }}>
          ← Back to characters
        </Link>
      </main>
    );
  }

  const char = editing ? editData : character;

  // Calculate ability scores from sources (base racial + level increases + items + temp)
  const strTotal = getStatTotal("ability_str");
  const dexTotal = getStatTotal("ability_dex");
  const conTotal = getStatTotal("ability_con");
  const intTotal = getStatTotal("ability_int");
  const wisTotal = getStatTotal("ability_wis");
  const chaTotal = getStatTotal("ability_cha");

  // Calculate modifiers from source-driven ability scores
  const strMod = calculateMod(strTotal, 0);
  const dexMod = calculateMod(dexTotal, 0);
  const conMod = calculateMod(conTotal, 0);
  const intMod = calculateMod(intTotal, 0);
  const wisMod = calculateMod(wisTotal, 0);
  const chaMod = calculateMod(chaTotal, 0);

  // Calculate AC from sources + equipped armor
  const acFromSources = getStatTotal("ac");
  const acTotal = 10 + dexMod + equippedArmorAcBonus + acFromSources;
  const acTouch = 10 + dexMod + getStatTotal("ac_touch_bonus");
  const acFlatFooted = acTotal - dexMod;

  // Calculate saves from sources (sources include base saves, ability mods, and all bonuses)
  const fortTotal = getStatTotal("save_fort");
  const refTotal = getStatTotal("save_ref");
  const willTotal = getStatTotal("save_will");

  // Calculate HP from sources
  const hpMax = getStatTotal("hp_max");
  const hpTemp = getStatTotal("hp_temp");

  // Calculate CMB/CMD from sources
  const babFromSources = getStatTotal("bab");
  const cmb = babFromSources + strMod + getStatTotal("cmb");
  const cmd = 10 + babFromSources + strMod + dexMod + getStatTotal("cmd");

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem" }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: "2rem" }}>
        <Link href="/pathfinder" style={{ color: "#0070f3", textDecoration: "none", fontSize: "0.9rem" }}>
          ← Campaigns
        </Link>
        <span style={{ margin: "0 0.5rem", color: "#999" }}>/</span>
        <Link href={`/pathfinder/${campaignId}`} style={{ color: "#0070f3", textDecoration: "none", fontSize: "0.9rem" }}>
          {campaign?.name}
        </Link>
        <span style={{ margin: "0 0.5rem", color: "#999" }}>/</span>
        <Link href={`/pathfinder/${campaignId}/characters`} style={{ color: "#0070f3", textDecoration: "none", fontSize: "0.9rem" }}>
          Characters
        </Link>
        <span style={{ margin: "0 0.5rem", color: "#999" }}>/</span>
        <span style={{ fontSize: "0.9rem" }}>{character.name}</span>
      </div>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "2rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <h1 style={{ margin: 0 }}>{char.name}</h1>
            {/* Status badge */}
            {(() => {
              const status = (character.character_type || "").split(":")[1];
              if (!status) return null;
              const colors: Record<string, { bg: string; color: string }> = {
                dead: { bg: "#fee2e2", color: "#991b1b" },
                departed: { bg: "#fef3c7", color: "#92400e" },
                retired: { bg: "#e5e7eb", color: "#374151" },
                missing: { bg: "#ede9fe", color: "#5b21b6" },
              };
              const c = colors[status] ?? { bg: "#f3f4f6", color: "#666" };
              return (
                <span style={{ padding: "0.2rem 0.7rem", borderRadius: 20, fontSize: "0.78rem", fontWeight: 700, textTransform: "capitalize", background: c.bg, color: c.color }}>
                  {status}
                </span>
              );
            })()}
          </div>
          <p style={{ margin: "0.5rem 0 0", color: "#666", fontSize: "1.1rem" }}>
            {char.race} {char.classes}
          </p>
          {char.alignment && (
            <p style={{ margin: "0.25rem 0 0", color: "#999" }}>{char.alignment}</p>
          )}
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "start" }}>
          {editing ? (
            <>
              <button onClick={handleSave} disabled={saving}
                style={{ padding: "0.75rem 1.5rem", background: "#10b981", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button onClick={() => { setEditing(false); setEditData(character); }}
                style={{ padding: "0.75rem 1.5rem", background: "#eee", border: "none", borderRadius: "8px", cursor: "pointer" }}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button onClick={() => openLevelUpWizard()}
                style={{ padding: "0.75rem 1.5rem", background: "#f59e0b", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}>
                ⬆ Level Up
              </button>
              {/* Status menu */}
              <div style={{ position: "relative" }}>
                <button onClick={() => setShowStatusMenu(s => !s)}
                  style={{ padding: "0.75rem 1rem", background: "#f3f4f6", border: "1px solid #ddd", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}>
                  ◉ Status
                </button>
                {showStatusMenu && (
                  <div style={{ position: "absolute", right: 0, top: "calc(100% + 0.4rem)", background: "white", border: "1px solid #ddd", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 100, minWidth: 160 }}>
                    {[
                      { id: "active", label: "✅ Active", color: "#166534" },
                      { id: "departed", label: "🚪 Departed", color: "#92400e" },
                      { id: "retired", label: "🏡 Retired", color: "#374151" },
                      { id: "missing", label: "❓ Missing", color: "#5b21b6" },
                      { id: "dead", label: "💀 Dead", color: "#991b1b" },
                    ].map(s => (
                      <button key={s.id} onClick={() => handleSetStatus(s.id)}
                        style={{ display: "block", width: "100%", padding: "0.6rem 1rem", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontSize: "0.9rem", color: s.color, fontWeight: 600 }}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => setEditing(true)}
                style={{ padding: "0.75rem 1.5rem", background: "#0070f3", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}>
                Edit Character
              </button>
              <button onClick={() => { setShowDeleteConfirm(true); setDeleteInput(""); }}
                style={{ padding: "0.75rem 1rem", background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}>
                🗑
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: "2px solid #ddd", marginBottom: "2rem" }}>
        <div style={{ display: "flex", gap: "2rem" }}>
          {[
            { id: "overview", label: "Overview" },
            { id: "combat", label: "Combat" },
            { id: "skills", label: "Skills" },
            { id: "feats", label: "Feats & Abilities" },
            { id: "spells", label: "Spells" },
            { id: "equipment", label: "Equipment" },
            { id: "inventory", label: "Inventory" },
            { id: "story", label: "Story" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: "1rem 0",
                background: "none",
                border: "none",
                borderBottom: activeTab === tab.id ? "3px solid #0070f3" : "3px solid transparent",
                color: activeTab === tab.id ? "#0070f3" : "#666",
                fontWeight: activeTab === tab.id ? 600 : 400,
                cursor: "pointer",
                fontSize: "1rem",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div style={{ display: "grid", gap: "2rem" }}>
          {/* Ability Scores */}
          <section style={{ background: "white", border: "1px solid #ddd", borderRadius: "12px", padding: "1.5rem" }}>
            <h2 style={{ marginTop: 0 }}>Ability Scores</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "1rem" }}>
              {[
                { label: "STR", total: strTotal, mod: strMod, statCat: "ability_str" },
                { label: "DEX", total: dexTotal, mod: dexMod, statCat: "ability_dex" },
                { label: "CON", total: conTotal, mod: conMod, statCat: "ability_con" },
                { label: "INT", total: intTotal, mod: intMod, statCat: "ability_int" },
                { label: "WIS", total: wisTotal, mod: wisMod, statCat: "ability_wis" },
                { label: "CHA", total: chaTotal, mod: chaMod, statCat: "ability_cha" },
              ].map((ability) => (
                <div key={ability.label} style={{ textAlign: "center" }}>
                  <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>{ability.label}</div>
                  <div style={{ fontSize: "2rem", fontWeight: 700 }}>
                    <StatWithSources
                      characterId={characterId}
                      statCategory={ability.statCat}
                      displayValue={ability.total}
                      label={ability.label}
                      editable={true}
                    />
                  </div>
                  <div style={{ fontSize: "1.2rem", color: "#666", marginTop: "0.25rem" }}>
                    {formatMod(ability.mod)}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* HP */}
          <section style={{ background: "white", border: "1px solid #ddd", borderRadius: "12px", padding: "1.5rem" }}>
            <h2 style={{ marginTop: 0 }}>Hit Points</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>Current HP</label>
                {editing ? (
                  <input
                    type="number"
                    value={char.hp_current || 0}
                    onChange={(e) => updateField("hp_current", parseInt(e.target.value) || 0)}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                      fontSize: "1.5rem",
                    }}
                  />
                ) : (
                  <div style={{ fontSize: "2rem", fontWeight: 700 }}>{char.hp_current || 0}</div>
                )}
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>Max HP</label>
                <div style={{ fontSize: "2rem", fontWeight: 700, color: "#666" }}>
                  <StatWithSources
                    characterId={characterId}
                    statCategory="hp_max"
                    displayValue={hpMax}
                    label="Max HP"
                    editable={true}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>Temp HP</label>
                <div style={{ fontSize: "2rem", fontWeight: 700, color: "#10b981" }}>
                  <StatWithSources
                    characterId={characterId}
                    statCategory="hp_temp"
                    displayValue={hpTemp}
                    label="Temp HP"
                    editable={true}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Character Info */}
          <section style={{ background: "white", border: "1px solid #ddd", borderRadius: "12px", padding: "1.5rem" }}>
            <h2 style={{ marginTop: 0 }}>Character Information</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              {[
                { label: "Race", field: "race", value: char.race },
                { label: "Class(es)", field: "classes", value: char.classes },
                { label: "Level", field: "level", value: char.level, type: "number" },
                { label: "Alignment", field: "alignment", value: char.alignment },
                { label: "Deity", field: "deity", value: char.deity },
                { label: "Homeland", field: "homeland", value: char.homeland },
              ].map((field) => (
                <div key={field.field}>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>{field.label}</label>
                  {editing ? (
                    <input
                      type={field.type || "text"}
                      value={field.value || ""}
                      onChange={(e) => updateField(field.field, field.type === "number" ? parseInt(e.target.value) || 1 : e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        border: "1px solid #ddd",
                        borderRadius: "6px",
                        fontSize: "1rem",
                      }}
                    />
                  ) : (
                    <div style={{ padding: "0.75rem", background: "#f9fafb", borderRadius: "6px" }}>
                      {field.value || "—"}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {activeTab === "combat" && (
        <div style={{ display: "grid", gap: "2rem" }}>
          {/* Armor Class */}
          <section style={{ background: "white", border: "1px solid #ddd", borderRadius: "12px", padding: "1.5rem" }}>
            <h2 style={{ marginTop: 0 }}>Armor Class</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2rem", marginBottom: "2rem" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#666", marginBottom: "0.5rem" }}>Total AC</div>
                <div style={{ fontSize: "3rem", fontWeight: 700, color: "#0070f3" }}>
                  <StatWithSources
                    characterId={characterId}
                    statCategory="ac"
                    displayValue={acTotal}
                    label="Armor Class"
                    editable={true}
                    breakdown={[
                      { label: "Base", value: 10 },
                      { label: "DEX mod", value: dexMod },
                      ...(equippedArmorAcBonus !== 0 ? [{ label: "Armor/Shield", value: equippedArmorAcBonus }] : []),
                    ]}
                  />
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#666", marginBottom: "0.5rem" }}>Touch</div>
                <div style={{ fontSize: "3rem", fontWeight: 700 }}>{acTouch}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#666", marginBottom: "0.5rem" }}>Flat-Footed</div>
                <div style={{ fontSize: "3rem", fontWeight: 700 }}>{acFlatFooted}</div>
              </div>
            </div>

          </section>

          {/* Saving Throws */}
          <section style={{ background: "white", border: "1px solid #ddd", borderRadius: "12px", padding: "1.5rem" }}>
            <h2 style={{ marginTop: 0 }}>Saving Throws</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2rem" }}>
              {[
                { label: "Fortitude", total: fortTotal, statCat: "save_fort" },
                { label: "Reflex", total: refTotal, statCat: "save_ref" },
                { label: "Will", total: willTotal, statCat: "save_will" },
              ].map((save) => (
                <div key={save.label} style={{ textAlign: "center" }}>
                  <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>{save.label}</div>
                  <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "#10b981" }}>
                    <StatWithSources
                      characterId={characterId}
                      statCategory={save.statCat}
                      displayValue={save.total}
                      label={`${save.label} Save`}
                      editable={true}
                    />
                  </div>
                </div>
              ))}
            </div>
            
            <div style={{ padding: "1rem", background: "#f0f9ff", borderRadius: "8px", fontSize: "0.9rem", marginTop: "1.5rem" }}>
              <strong>💡 Tip:</strong> Click any save to add base save (from class), ability modifier, resistance bonuses, etc.
            </div>
          </section>

          {/* Combat Stats */}
          <section style={{ background: "white", border: "1px solid #ddd", borderRadius: "12px", padding: "1.5rem" }}>
            <h2 style={{ marginTop: 0 }}>Combat Stats</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2rem" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#666", marginBottom: "0.5rem" }}>Base Attack Bonus</div>
                <div style={{ fontSize: "2.5rem", fontWeight: 700 }}>
                  <StatWithSources
                    characterId={characterId}
                    statCategory="bab"
                    displayValue={babFromSources}
                    label="BAB"
                    editable={true}
                  />
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#666", marginBottom: "0.5rem" }}>CMB</div>
                <div style={{ fontSize: "2.5rem", fontWeight: 700 }}>
                  <StatWithSources
                    characterId={characterId}
                    statCategory="cmb"
                    displayValue={cmb}
                    label="CMB"
                    editable={true}
                    breakdown={[
                      { label: "BAB", value: babFromSources },
                      { label: "STR mod", value: strMod },
                    ]}
                  />
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#666", marginBottom: "0.5rem" }}>CMD</div>
                <div style={{ fontSize: "2.5rem", fontWeight: 700 }}>
                  <StatWithSources
                    characterId={characterId}
                    statCategory="cmd"
                    displayValue={cmd}
                    label="CMD"
                    editable={true}
                    breakdown={[
                      { label: "Base", value: 10 },
                      { label: "BAB", value: babFromSources },
                      { label: "STR mod", value: strMod },
                      { label: "DEX mod", value: dexMod },
                    ]}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {activeTab === "skills" && (
        <div style={{ background: "white", border: "1px solid #ddd", borderRadius: "12px", padding: "1.5rem" }}>
          <h2 style={{ marginTop: 0 }}>Skills</h2>
          <Skills
            characterId={characterId}
            characterLevel={char.level || 1}
            abilityMods={{ str: strMod, dex: dexMod, con: conMod, int: intMod, wis: wisMod, cha: chaMod }}
            armorCheckPenalty={equippedAcp}
          />
        </div>
      )}

      {activeTab === "feats" && (
        <div style={{ background: "white", border: "1px solid #ddd", borderRadius: "12px", padding: "1.5rem" }}>
          <h2 style={{ marginTop: 0 }}>Feats, Traits & Abilities</h2>
          <Features
            characterId={characterId}
            characterLevel={char.level || 1}
          />
        </div>
      )}

      {activeTab === "spells" && (
        <div style={{ background: "white", border: "1px solid #ddd", borderRadius: "12px", padding: "1.5rem" }}>
          <h2 style={{ marginTop: 0 }}>Spells</h2>
          <Spells
            characterId={characterId}
            characterLevel={char.level || 1}
            characterClasses={char.classes || ""}
            abilityMods={{ str: strMod, dex: dexMod, con: conMod, int: intMod, wis: wisMod, cha: chaMod }}
          />
        </div>
      )}

      {activeTab === "equipment" && (
        <div style={{ background: "white", border: "1px solid #ddd", borderRadius: "12px", padding: "1.5rem" }}>
          <h2 style={{ marginTop: 0 }}>Equipment Slots</h2>
          <Equipment characterId={characterId} />
        </div>
      )}

      {activeTab === "inventory" && (
        <div style={{ background: "white", border: "1px solid #ddd", borderRadius: "12px", padding: "1.5rem" }}>
          <h2 style={{ marginTop: 0 }}>Inventory & Equipment</h2>
          <Inventory
            characterId={characterId}
            characterLevel={char.level || 1}
            strengthScore={strTotal}
          />
        </div>
      )}

      {activeTab === "story" && (
        <div style={{ background: "white", border: "1px solid #ddd", borderRadius: "12px", padding: "1.5rem" }}>
          <h2 style={{ marginTop: 0 }}>Backstory & Notes</h2>
          {editing ? (
            <textarea
              value={char.backstory || ""}
              onChange={(e) => updateField("backstory", e.target.value)}
              placeholder="Write your character's backstory..."
              rows={15}
              style={{
                width: "100%",
                padding: "1rem",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "1rem",
                fontFamily: "inherit",
                resize: "vertical",
              }}
            />
          ) : (
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
              {char.backstory || <span style={{ color: "#999" }}>No backstory written yet.</span>}
            </div>
          )}
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {showDeleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000 }}
          onClick={() => setShowDeleteConfirm(false)}>
          <div style={{ background: "white", borderRadius: 16, padding: "2rem", width: "90%", maxWidth: 420 }}
            onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 0.5rem", color: "#991b1b" }}>🗑 Delete Character</h2>
            <p style={{ color: "#555", marginBottom: "0.5rem" }}>
              This will permanently delete <strong>{char.name}</strong> and all their data. This cannot be undone.
            </p>
            <p style={{ color: "#555", marginBottom: "1rem" }}>
              Type <strong style={{ fontFamily: "monospace" }}>DELETE</strong> to confirm:
            </p>
            <input
              type="text"
              value={deleteInput}
              onChange={e => setDeleteInput(e.target.value)}
              placeholder="Type DELETE to confirm"
              autoFocus
              style={{ width: "100%", padding: "0.65rem 0.9rem", border: `2px solid ${deleteInput.toUpperCase() === "DELETE" ? "#ef4444" : "#ddd"}`, borderRadius: 8, fontSize: "1rem", boxSizing: "border-box", marginBottom: "1rem" }}
            />
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button onClick={() => setShowDeleteConfirm(false)}
                style={{ padding: "0.65rem 1.25rem", background: "#f3f4f6", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleteInput.trim().toUpperCase() !== "DELETE" || deleting}
                style={{ padding: "0.65rem 1.25rem", background: deleteInput.trim().toUpperCase() === "DELETE" ? "#ef4444" : "#fca5a5", color: "white", border: "none", borderRadius: 8, cursor: deleteInput.trim().toUpperCase() === "DELETE" ? "pointer" : "not-allowed", fontWeight: 700 }}>
                {deleting ? "Deleting..." : "Delete Forever"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LEVEL UP WIZARD ── */}
      {showLevelUp && (() => {
        const newCharLevel = (character.level || 1) + 1;

        // Compute class level map from history
        const classLevelMap: Record<string, { name: string; level: number; classData: any }> = {};
        classLevelHistory.forEach(h => {
          const cls = CLASSES.find((c: any) => c.id === h.classId);
          classLevelMap[h.classId] = { name: h.className, level: h.classLevel, classData: cls };
        });
        // Also include the character's existing class string for characters with no history yet
        if (Object.keys(classLevelMap).length === 0 && character.classes) {
          const parts = character.classes.split("/").map((s: string) => s.trim());
          parts.forEach((p: string) => {
            const match = p.match(/^(.+?)\s+(\d+)$/);
            const clsName = match ? match[1].trim() : p.trim();
            const clsLvl = match ? parseInt(match[2]) : (character.level || 1);
            const cls = CLASSES.find((c: any) => c.name.toLowerCase() === clsName.toLowerCase() || c.id === clsName.toLowerCase());
            if (cls) classLevelMap[cls.id] = { name: cls.name, level: clsLvl, classData: cls };
          });
          // If still empty, just try all classes by name
          if (Object.keys(classLevelMap).length === 0) {
            const cls = CLASSES.find((c: any) => character.classes?.toLowerCase().includes(c.name.toLowerCase()) || character.classes?.toLowerCase().includes(c.id));
            if (cls) classLevelMap[cls.id] = { name: cls.name, level: character.level || 1, classData: cls };
          }
        }

        const chosenClass = CLASSES.find((c: any) => c.id === levelUpChosenClassId);
        const prevClassLevels = classLevelHistory.filter(h => h.classId === levelUpChosenClassId).length;
        // For chars with no history yet, use existing class level
        const existingClassLevel = classLevelMap[levelUpChosenClassId]?.level ?? 0;
        const newClassLevel = classLevelHistory.length > 0
          ? prevClassLevels + 1
          : (existingClassLevel + 1);

        // HP calc
        const hitDie = chosenClass?.hitDie ?? 8;
        const averageRoll = Math.ceil(hitDie / 2) + 1;
        const currentConMod = Math.floor((getStatTotal("ability_con") - 10) / 2);
        const hpRoll = levelUpHpMethod === "max" ? hitDie : levelUpHpMethod === "average" ? averageRoll : Math.max(1, Math.min(hitDie, levelUpHpRoll || 1));
        const hpGain = Math.max(1, hpRoll + currentConMod);

        // Skill ranks for chosen class
        const intMod_ = Math.floor((getStatTotal("ability_int") - 10) / 2);
        const isHuman_ = char.race?.toLowerCase().includes("human") && !char.race?.toLowerCase().includes("half");
        const isHalfElf_ = char.race?.toLowerCase().includes("half-elf") || char.race?.toLowerCase().includes("half elf");
        const humanBonus_ = (isHuman_ || isHalfElf_) ? 1 : 0;
        const skillRanksAvailable_ = chosenClass ? Math.max(1, chosenClass.skillsPerLevel + intMod_ + humanBonus_) : 1;
        const skillRanksUsed_ = Object.values(levelUpSkillRanks).reduce((a: number, b: number) => a + b, 0);

        // Feat slots for this level-up
        const featSlots: { label: string; source: string; color: string; bg: string }[] = [];
        // Standard feat every odd character level
        if (newCharLevel % 2 === 1) {
          featSlots.push({ label: "Standard Feat", source: `Character level ${newCharLevel}`, color: "#0070f3", bg: "#eff6ff" });
        }
        // Class bonus feats: does this class grant one at this class level?
        if (chosenClass?.bonusFeatLevels?.includes(newClassLevel)) {
          featSlots.push({
            label: `Bonus Feat${chosenClass.bonusFeatLabel ? ` — ${chosenClass.bonusFeatLabel}` : ""}`,
            source: `${chosenClass.name} level ${newClassLevel}`,
            color: "#b45309", bg: "#fefce8",
          });
        }

        const wizardSteps: { id: "class"|"hp"|"skills"|"feats"|"confirm"; icon: string; label: string }[] = [
          { id: "class",   icon: "🎭", label: "Class" },
          { id: "hp",      icon: "❤️", label: "HP" },
          { id: "skills",  icon: "📚", label: "Skills" },
          { id: "feats",   icon: "⚔️", label: "Feats" },
          { id: "confirm", icon: "✅", label: "Confirm" },
        ];
        const stepIdx = wizardSteps.findIndex(s => s.id === levelUpStep);
        const stepOrder: ("class"|"hp"|"skills"|"feats"|"confirm")[] = ["class","hp","skills","feats","confirm"];

        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}
            onClick={() => setShowLevelUp(false)}>
            <div style={{ background: "white", borderRadius: 16, width: "90%", maxWidth: 640, maxHeight: "90vh", display: "flex", flexDirection: "column" }}
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div style={{ padding: "1.5rem 2rem 1rem", borderBottom: "1px solid #e5e7eb" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <h2 style={{ margin: 0, color: "#f59e0b" }}>⬆ Level Up to {newCharLevel}</h2>
                    <p style={{ margin: "0.25rem 0 0", color: "#666", fontSize: "0.9rem" }}>{char.name} — {char.race}</p>
                  </div>
                  <button onClick={() => setShowLevelUp(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: "1.4rem" }}>✕</button>
                </div>
                <div style={{ display: "flex", gap: "0.35rem", marginTop: "1rem" }}>
                  {wizardSteps.map((s, i) => (
                    <div key={s.id} style={{ flex: 1, textAlign: "center" }}>
                      <div style={{ width: 30, height: 30, borderRadius: "50%", margin: "0 auto 0.2rem", fontSize: "0.8rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
                        background: i < stepIdx ? "#10b981" : s.id === levelUpStep ? "#f59e0b" : "#e5e7eb",
                        color: i <= stepIdx ? "white" : "#999" }}>
                        {i < stepIdx ? "✓" : s.icon}
                      </div>
                      <div style={{ fontSize: "0.65rem", color: s.id === levelUpStep ? "#f59e0b" : "#999", fontWeight: s.id === levelUpStep ? 700 : 400 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Step content */}
              <div style={{ flex: 1, overflow: "auto", padding: "1.5rem 2rem" }}>

                {/* ── CLASS STEP ── */}
                {levelUpStep === "class" && (
                  <div>
                    <h3 style={{ marginTop: 0 }}>Which class are you leveling?</h3>
                    <p style={{ color: "#666", fontSize: "0.85rem", marginBottom: "1rem" }}>
                      Choose the class this level goes into. For multiclassing, pick a different class than before.
                    </p>

                    {/* Current class levels summary */}
                    {Object.keys(classLevelMap).length > 0 && (
                      <div style={{ marginBottom: "1.25rem", padding: "0.75rem 1rem", background: "#f9fafb", borderRadius: 8 }}>
                        <div style={{ fontSize: "0.8rem", color: "#666", fontWeight: 700, marginBottom: "0.4rem" }}>Current class levels:</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                          {Object.values(classLevelMap).map(({ name, level }) => (
                            <span key={name} style={{ padding: "0.2rem 0.6rem", background: "#e5e7eb", borderRadius: 6, fontSize: "0.85rem", fontWeight: 600 }}>{name} {level}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ display: "grid", gap: "0.5rem", maxHeight: 340, overflowY: "auto" }}>
                      {CLASSES.filter((c: any) => !c.tags?.includes("prestige") && !c.tags?.includes("npc")).map((cls: any) => {
                        const currentLvl = classLevelMap[cls.id]?.level ?? 0;
                        const isSelected = levelUpChosenClassId === cls.id;
                        return (
                          <div key={cls.id} onClick={() => setLevelUpChosenClassId(cls.id)}
                            style={{ padding: "0.75rem 1rem", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.75rem",
                              border: isSelected ? "2px solid #f59e0b" : "1px solid #e5e7eb",
                              background: isSelected ? "#fffbeb" : "white" }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{cls.name}
                                {currentLvl > 0 && <span style={{ marginLeft: "0.5rem", fontSize: "0.8rem", color: "#666", fontWeight: 400 }}>(currently level {currentLvl})</span>}
                              </div>
                              <div style={{ fontSize: "0.78rem", color: "#888", marginTop: "0.1rem" }}>
                                d{cls.hitDie} HD · {cls.babProgression} BAB · {cls.skillsPerLevel} skill ranks
                                {cls.bonusFeatLevels?.includes(currentLvl + 1) && <span style={{ marginLeft: "0.5rem", color: "#b45309", fontWeight: 600 }}>★ Bonus feat at level {currentLvl + 1}!</span>}
                              </div>
                            </div>
                            {isSelected && <span style={{ color: "#f59e0b", fontSize: "1.2rem" }}>✓</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── HP STEP ── */}
                {levelUpStep === "hp" && chosenClass && (
                  <div>
                    <h3 style={{ marginTop: 0 }}>Roll Hit Points (d{hitDie})</h3>
                    <p style={{ color: "#666", fontSize: "0.85rem", marginBottom: "1rem" }}>
                      Leveling {chosenClass.name} to {newClassLevel} (character level {newCharLevel})
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.75rem", marginBottom: "1rem" }}>
                      {([{ id:"max", label:"Maximum", value: hitDie }, { id:"average", label:"Average", value: averageRoll }, { id:"manual", label:"Roll Dice", value: null }] as const).map(m => (
                        <div key={m.id} onClick={() => setLevelUpHpMethod(m.id)}
                          style={{ padding: "1rem", borderRadius: 8, cursor: "pointer", textAlign: "center",
                            border: levelUpHpMethod === m.id ? "2px solid #f59e0b" : "1px solid #ddd",
                            background: levelUpHpMethod === m.id ? "#fffbeb" : "white" }}>
                          <div style={{ fontWeight: 700 }}>{m.label}</div>
                          <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#f59e0b", marginTop: "0.25rem" }}>{m.value ?? "?"}</div>
                        </div>
                      ))}
                    </div>
                    {levelUpHpMethod === "manual" && (
                      <div style={{ marginBottom: "1rem" }}>
                        <label style={{ display: "block", fontWeight: 600, marginBottom: "0.4rem", fontSize: "0.9rem" }}>Your roll (1–{hitDie}):</label>
                        <input type="number" value={levelUpHpRoll || ""} min={1} max={hitDie}
                          onChange={e => setLevelUpHpRoll(Math.min(hitDie, Math.max(1, parseInt(e.target.value) || 1)))}
                          style={{ width: 80, padding: "0.5rem", border: "2px solid #f59e0b", borderRadius: 6, fontSize: "1.4rem", textAlign: "center", fontWeight: 700 }} />
                      </div>
                    )}
                    <div style={{ padding: "0.75rem 1rem", background: "#f0fdf4", borderRadius: 8, display: "flex", gap: "2rem", flexWrap: "wrap" }}>
                      <span><span style={{ color: "#666", fontSize: "0.9rem" }}>Roll: </span><strong>{hpRoll}</strong></span>
                      <span><span style={{ color: "#666", fontSize: "0.9rem" }}>CON: </span><strong style={{ color: currentConMod >= 0 ? "#10b981" : "#ef4444" }}>{currentConMod >= 0 ? "+" : ""}{currentConMod}</strong></span>
                      <span><span style={{ color: "#666", fontSize: "0.9rem" }}>Gain: </span><strong style={{ color: "#10b981", fontSize: "1.1rem" }}>+{hpGain} HP</strong></span>
                    </div>
                  </div>
                )}

                {/* ── SKILLS STEP ── */}
                {levelUpStep === "skills" && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                      <h3 style={{ margin: 0 }}>Assign Skill Ranks</h3>
                      <div style={{ padding: "0.4rem 0.9rem", borderRadius: 8, fontWeight: 700, fontSize: "0.9rem",
                        background: skillRanksUsed_ > skillRanksAvailable_ ? "#fee2e2" : skillRanksUsed_ === skillRanksAvailable_ ? "#dcfce7" : "#eff6ff",
                        color: skillRanksUsed_ > skillRanksAvailable_ ? "#991b1b" : skillRanksUsed_ === skillRanksAvailable_ ? "#166534" : "#1e40af" }}>
                        {skillRanksUsed_} / {skillRanksAvailable_} used
                      </div>
                    </div>
                    <p style={{ color: "#666", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
                      {skillRanksAvailable_} ranks from {chosenClass?.name ?? "class"}
                      {humanBonus_ > 0 && <span style={{ color: "#7c3aed" }}> (+{humanBonus_} {isHalfElf_ ? "Half-Elf" : "Human"})</span>}.
                      Max per skill = character level ({newCharLevel}).
                    </p>
                    <p style={{ color: "#888", fontSize: "0.78rem", marginBottom: "0.75rem" }}>
                      <span style={{ background: "#dbeafe", color: "#1e40af", padding: "0.1rem 0.35rem", borderRadius: 3, fontWeight: 600, fontSize: "0.7rem", marginRight: "0.3rem" }}>CS</span>class skill (+3 when ranked)
                    </p>
                    <div style={{ display: "grid", gap: "0.3rem", maxHeight: 300, overflowY: "auto" }}>
                      {["Acrobatics","Appraise","Bluff","Climb","Diplomacy","Disable Device","Disguise","Escape Artist","Fly","Handle Animal","Heal","Intimidate","Knowledge (Arcana)","Knowledge (Dungeoneering)","Knowledge (Engineering)","Knowledge (Geography)","Knowledge (History)","Knowledge (Local)","Knowledge (Nature)","Knowledge (Nobility)","Knowledge (Planes)","Knowledge (Religion)","Linguistics","Perception","Ride","Sense Motive","Sleight of Hand","Spellcraft","Stealth","Survival","Swim","Use Magic Device"].map(skillName => {
                        const existing = existingSkills[skillName] ?? { ranks: 0, is_class_skill: false };
                        const added = levelUpSkillRanks[skillName] ?? 0;
                        const totalAfter = existing.ranks + added;
                        const atCap = totalAfter >= newCharLevel;
                        const isCS = existing.is_class_skill || (chosenClass?.classSkills?.includes(skillName) ?? false);
                        return (
                          <div key={skillName} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.35rem 0.65rem", borderRadius: 5, background: added > 0 ? "#eff6ff" : isCS ? "#f0fdf4" : "#f9fafb" }}>
                            <span style={{ flex: 1, fontSize: "0.85rem", fontWeight: added > 0 ? 600 : 400 }}>
                              {skillName}
                              {isCS && <span style={{ marginLeft: "0.3rem", padding: "0.05rem 0.3rem", background: "#dbeafe", color: "#1e40af", borderRadius: 3, fontSize: "0.68rem", fontWeight: 700 }}>CS</span>}
                            </span>
                            <span style={{ fontSize: "0.75rem", color: "#9ca3af", minWidth: 48, textAlign: "right" }}>{existing.ranks > 0 ? `${existing.ranks} now` : "—"}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                              <button onClick={() => setLevelUpSkillRanks(p => ({ ...p, [skillName]: Math.max(0, (p[skillName] ?? 0) - 1) }))} disabled={added === 0}
                                style={{ width: 24, height: 24, border: "1px solid #ddd", borderRadius: 4, background: added === 0 ? "#f3f4f6" : "white", cursor: added === 0 ? "not-allowed" : "pointer", fontWeight: 700, fontSize: "0.9rem" }}>−</button>
                              <span style={{ width: 20, textAlign: "center", fontWeight: 700, fontSize: "0.85rem", color: added > 0 ? "#0070f3" : "#999" }}>+{added}</span>
                              <button onClick={() => { if (skillRanksUsed_ < skillRanksAvailable_ && !atCap) setLevelUpSkillRanks(p => ({ ...p, [skillName]: (p[skillName] ?? 0) + 1 })); }}
                                disabled={skillRanksUsed_ >= skillRanksAvailable_ || atCap} title={atCap ? `Max ${newCharLevel} reached` : ""}
                                style={{ width: 24, height: 24, border: "1px solid #ddd", borderRadius: 4, background: (skillRanksUsed_ >= skillRanksAvailable_ || atCap) ? "#f3f4f6" : "white", cursor: (skillRanksUsed_ >= skillRanksAvailable_ || atCap) ? "not-allowed" : "pointer", fontWeight: 700, fontSize: "0.9rem" }}>+</button>
                            </div>
                            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: atCap ? "#ef4444" : added > 0 ? "#10b981" : "#9ca3af", minWidth: 36, textAlign: "right" }}>→ {totalAfter}{atCap ? "!" : ""}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── FEATS STEP ── */}
                {levelUpStep === "feats" && (
                  <div>
                    <h3 style={{ marginTop: 0 }}>Feats</h3>

                    {featSlots.length === 0 ? (
                      <div style={{ padding: "1rem", background: "#f9fafb", borderRadius: 8, color: "#666", fontSize: "0.9rem", marginBottom: "1rem" }}>
                        No feats this level — level {newCharLevel} is even and {chosenClass?.name ?? "this class"} has no bonus feat at class level {newClassLevel}.
                      </div>
                    ) : (
                      <div style={{ marginBottom: "1.25rem" }}>
                        <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                          Pick <strong style={{ color: "#0070f3", fontSize: "1.05rem" }}>{featSlots.length}</strong> feat{featSlots.length !== 1 ? "s" : ""} this level:
                        </div>
                        <div style={{ display: "grid", gap: "0.35rem" }}>
                          {featSlots.map((slot, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.5rem 0.75rem", borderRadius: 6, background: slot.bg, borderLeft: `3px solid ${slot.color}` }}>
                              <div style={{ width: 22, height: 22, borderRadius: "50%", background: levelUpFeats[i] ? "#10b981" : slot.color, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem", fontWeight: 700, flexShrink: 0 }}>
                                {levelUpFeats[i] ? "✓" : i + 1}
                              </div>
                              <div style={{ flex: 1 }}>
                                <span style={{ fontWeight: 700, color: slot.color, fontSize: "0.85rem" }}>{slot.label}</span>
                                <span style={{ color: "#6b7280", fontSize: "0.78rem", marginLeft: "0.4rem" }}>from {slot.source}</span>
                              </div>
                              {levelUpFeats[i] ? (
                                <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#065f46", background: "#d1fae5", padding: "0.1rem 0.4rem", borderRadius: 4 }}>{levelUpFeats[i].name}</span>
                              ) : (
                                <span style={{ fontSize: "0.73rem", color: "#9ca3af" }}>not chosen</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Existing feats reference */}
                    {existingFeats.length > 0 && (
                      <div style={{ marginBottom: "1rem" }}>
                        <div style={{ fontWeight: 600, fontSize: "0.82rem", color: "#666", marginBottom: "0.4rem" }}>Already have ({existingFeats.length}):</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", padding: "0.6rem", background: "#f9fafb", borderRadius: 8, maxHeight: 90, overflowY: "auto" }}>
                          {existingFeats.map((f: any, i: number) => (
                            <span key={i} style={{ padding: "0.15rem 0.5rem", background: "#e5e7eb", borderRadius: 5, fontSize: "0.78rem" }}>{f.name}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {featSlots.length > 0 && (
                      <>
                        <button onClick={() => setLevelUpShowFeatBrowser(true)}
                          style={{ padding: "0.6rem 1.25rem", background: "#0070f3", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, marginBottom: "0.75rem" }}>
                          ⚔️ Browse Feats
                        </button>
                        {levelUpFeats.length > 0 && (
                          <div style={{ display: "grid", gap: "0.4rem" }}>
                            {levelUpFeats.map((f: any, i: number) => (
                              <div key={i} style={{ padding: "0.6rem 0.9rem", background: "#eff6ff", borderRadius: 7, display: "flex", justifyContent: "space-between", alignItems: "center", borderLeft: "3px solid #0070f3" }}>
                                <div>
                                  <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>{f.name}</span>
                                  {f.prerequisites && <span style={{ fontSize: "0.75rem", color: "#888", marginLeft: "0.4rem" }}>· Req: {f.prerequisites}</span>}
                                </div>
                                <button onClick={() => setLevelUpFeats(prev => prev.filter((_: any, j: number) => j !== i))}
                                  style={{ background: "none", border: "none", cursor: "pointer", color: "#999" }}>✕</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* ── CONFIRM STEP ── */}
                {levelUpStep === "confirm" && chosenClass && (
                  <div>
                    <h3 style={{ marginTop: 0 }}>Confirm Level Up</h3>
                    <div style={{ display: "grid", gap: "0.65rem" }}>
                      <div style={{ padding: "0.75rem 1rem", background: "#fffbeb", borderRadius: 8, borderLeft: "3px solid #f59e0b" }}>
                        <div style={{ fontWeight: 700, marginBottom: "0.2rem" }}>🎭 Class</div>
                        <div style={{ color: "#555", fontSize: "0.9rem" }}>{chosenClass.name} → level {newClassLevel} (character level {newCharLevel})</div>
                      </div>
                      <div style={{ padding: "0.75rem 1rem", background: "#f0fdf4", borderRadius: 8 }}>
                        <div style={{ fontWeight: 700, marginBottom: "0.2rem" }}>❤️ Hit Points</div>
                        <div style={{ color: "#555", fontSize: "0.9rem" }}>+{hpGain} HP (d{hitDie} roll: {hpRoll}, CON: {currentConMod >= 0 ? "+" : ""}{currentConMod})</div>
                      </div>
                      <div style={{ padding: "0.75rem 1rem", background: "#eff6ff", borderRadius: 8 }}>
                        <div style={{ fontWeight: 700, marginBottom: "0.2rem" }}>📊 BAB & Saves</div>
                        <div style={{ color: "#555", fontSize: "0.9rem" }}>Recalculated from all class levels automatically.</div>
                      </div>
                      {skillRanksUsed_ > 0 && (
                        <div style={{ padding: "0.75rem 1rem", background: "#fefce8", borderRadius: 8 }}>
                          <div style={{ fontWeight: 700, marginBottom: "0.4rem" }}>📚 Skill Ranks ({skillRanksUsed_})</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                            {Object.entries(levelUpSkillRanks).filter(([, r]) => r > 0).map(([name, r]) => (
                              <span key={name} style={{ padding: "0.15rem 0.45rem", background: "white", borderRadius: 4, fontSize: "0.78rem" }}>{name} +{r}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {levelUpFeats.length > 0 && (
                        <div style={{ padding: "0.75rem 1rem", background: "#f3e8ff", borderRadius: 8 }}>
                          <div style={{ fontWeight: 700, marginBottom: "0.4rem" }}>⚔️ Feats ({levelUpFeats.length})</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                            {levelUpFeats.map((f: any, i: number) => (
                              <span key={i} style={{ padding: "0.15rem 0.45rem", background: "white", borderRadius: 4, fontSize: "0.78rem" }}>{f.name}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div style={{ padding: "0.75rem 1rem", background: "#fef3c7", borderRadius: 8, fontSize: "0.82rem", color: "#713f12" }}>
                        💡 Add class features and spells manually from the character sheet after confirming.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: "1rem 2rem 1.5rem", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
                <button onClick={() => { const i = stepOrder.indexOf(levelUpStep); if (i > 0) setLevelUpStep(stepOrder[i - 1]); else setShowLevelUp(false); }}
                  style={{ padding: "0.65rem 1.25rem", background: "#f3f4f6", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
                  {levelUpStep === "class" ? "Cancel" : "← Back"}
                </button>
                {levelUpStep !== "confirm" ? (
                  <button
                    onClick={() => {
                      const i = stepOrder.indexOf(levelUpStep);
                      const nextStep = stepOrder[i + 1];
                      // When advancing to feats step, snapshot the current feat slots into state
                      // so the external FeatBrowser onSelectFeat can access them
                      if (nextStep === "feats") {
                        setLevelUpFeatSlots(featSlots.map(s => ({ label: s.label, source: s.source })));
                      }
                      setLevelUpStep(nextStep);
                    }}
                    disabled={levelUpStep === "class" && !levelUpChosenClassId || (levelUpStep === "hp" && levelUpHpMethod === "manual" && !levelUpHpRoll)}
                    style={{ padding: "0.65rem 1.5rem", background: (!levelUpChosenClassId && levelUpStep === "class") ? "#d1d5db" : "#f59e0b", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>
                    Next →
                  </button>
                ) : (
                  <button onClick={handleLevelUp} disabled={levelUpSaving}
                    style={{ padding: "0.65rem 1.5rem", background: levelUpSaving ? "#9ca3af" : "#10b981", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: "1rem" }}>
                    {levelUpSaving ? "Saving..." : `✨ Confirm Level ${newCharLevel}`}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
      {/* FeatBrowser for level up */}
      <FeatBrowser
        isOpen={levelUpShowFeatBrowser}
        onClose={() => setLevelUpShowFeatBrowser(false)}
        onSelectFeat={(feat: any) => {
          setLevelUpFeats(prev => {
            const slotSource = levelUpFeatSlots[prev.length]?.source ?? "";
            return [...prev, { ...feat, slotSource }];
          });
          setLevelUpShowFeatBrowser(false);
        }}
      />
    </main>
  );
}
