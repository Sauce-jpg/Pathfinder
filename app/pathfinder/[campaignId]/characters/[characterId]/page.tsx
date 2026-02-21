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
import { getBabAtLevel, getGoodSaveAtLevel, getPoorSaveAtLevel } from "@/lib/pf-data";

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

  // Level up wizard
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpStep, setLevelUpStep] = useState<"hp" | "skills" | "feats" | "confirm">("hp");
  const [levelUpHpMethod, setLevelUpHpMethod] = useState<"max"|"average"|"manual">("average");
  const [levelUpHpRoll, setLevelUpHpRoll] = useState<number>(0);
  const [levelUpSkillRanks, setLevelUpSkillRanks] = useState<Record<string, number>>({});
  const [levelUpFeats, setLevelUpFeats] = useState<any[]>([]);
  const [levelUpShowFeatBrowser, setLevelUpShowFeatBrowser] = useState(false);
  const [levelUpSaving, setLevelUpSaving] = useState(false);

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

  async function handleSave() {
    setSaving(true);

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

  async function handleLevelUp() {
    setLevelUpSaving(true);
    const newLevel = (character.level || 1) + 1;

    const hpSources = statSources["hp_max"] || [];
    const firstHpSource = hpSources.find((s: any) => s.source_type === "class");
    const hitDieMatch = firstHpSource?.obtained_notes?.match(/d(\d+)/);
    const hitDie = hitDieMatch ? parseInt(hitDieMatch[1]) : 8;
    const averageRoll = Math.ceil(hitDie / 2) + 1;
    const currentConMod = Math.floor((getStatTotal("ability_con") - 10) / 2);
    const hpRoll = levelUpHpMethod === "max" ? hitDie
      : levelUpHpMethod === "average" ? averageRoll
      : Math.max(1, Math.min(hitDie, levelUpHpRoll));

    try {
      // ── HP source for new level ──
      await supabase.from("character_stat_sources").insert({
        character_id: characterId,
        stat_category: "hp_max",
        source_name: `Class HD (level ${newLevel})`,
        source_type: "class",
        bonus_value: hpRoll,
        bonus_type: "untyped",
        is_active: true,
        obtained_level: newLevel,
        obtained_notes: `d${hitDie}`,
      });

      // ── Update CON modifier HP source to reflect new level count ──
      const conModSource = hpSources.find((s: any) => s.source_type === "ability" && s.source_name?.includes("CON"));
      if (conModSource && currentConMod !== 0) {
        await supabase.from("character_stat_sources")
          .update({ bonus_value: currentConMod * newLevel, source_name: `CON modifier (×${newLevel})` })
          .eq("id", conModSource.id);
      } else if (!conModSource && currentConMod !== 0) {
        await supabase.from("character_stat_sources").insert({
          character_id: characterId,
          stat_category: "hp_max",
          source_name: `CON modifier (×${newLevel})`,
          source_type: "ability",
          bonus_value: currentConMod * newLevel,
          bonus_type: "untyped",
          is_active: true,
          obtained_level: newLevel,
        });
      }

      // ── BAB — update each class BAB source ──
      const babSources = statSources["bab"] || [];
      for (const src of babSources) {
        if (src.source_type === "class") {
          const curLevel = character.level || 1;
          let progression: "full" | "three-quarter" | "half" = "three-quarter";
          if (src.bonus_value === curLevel) progression = "full";
          else if (src.bonus_value === Math.floor(curLevel * 0.5)) progression = "half";
          const newBab = getBabAtLevel(progression, newLevel);
          await supabase.from("character_stat_sources").update({ bonus_value: newBab, obtained_level: newLevel }).eq("id", src.id);
        }
      }

      // ── Saves — update each base save source ──
      for (const saveKey of ["save_fort", "save_ref", "save_will"]) {
        const saveSources = statSources[saveKey] || [];
        for (const src of saveSources) {
          if (src.source_type === "class") {
            const curLevel = character.level || 1;
            const isGood = src.bonus_value === getGoodSaveAtLevel(curLevel);
            const newBase = isGood ? getGoodSaveAtLevel(newLevel) : getPoorSaveAtLevel(newLevel);
            await supabase.from("character_stat_sources").update({ bonus_value: newBase, obtained_level: newLevel }).eq("id", src.id);
          }
        }
      }

      // ── Skill ranks ──
      const skillInserts: any[] = [];
      Object.entries(levelUpSkillRanks).forEach(([skillName, ranks]) => {
        if (ranks > 0) {
          skillInserts.push({ character_id: characterId, skill_name: skillName, ranks_added: ranks, level_added: newLevel });
        }
      });
      // Increment existing character_skills rows
      for (const [skillName, newRanks] of Object.entries(levelUpSkillRanks)) {
        if (newRanks <= 0) continue;
        const { data: existing } = await supabase
          .from("character_skills")
          .select("id, ranks")
          .eq("character_id", characterId)
          .eq("skill_name", skillName)
          .single();
        if (existing) {
          await supabase.from("character_skills").update({ ranks: (existing.ranks || 0) + newRanks }).eq("id", existing.id);
        } else {
          await supabase.from("character_skills").insert({ character_id: characterId, skill_name: skillName, ranks: newRanks, is_class_skill: false });
        }
      }

      // ── New feats ──
      if (levelUpFeats.length > 0) {
        await supabase.from("character_features").insert(
          levelUpFeats.map(f => ({
            character_id: characterId,
            feature_type: "feat",
            name: f.name,
            description: f.benefit || f.description || null,
            prerequisites: f.prerequisites || null,
            category: (f.types || []).join(", ") || f.category || null,
            source: f.source || null,
            obtained_level: newLevel,
            is_active: true,
          }))
        );
      }

      // ── Bump character level ──
      await supabase.from("characters").update({ level: newLevel }).eq("id", characterId);

      // Reset wizard state
      setShowLevelUp(false);
      setLevelUpStep("hp");
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
          <h1 style={{ margin: 0 }}>{char.name}</h1>
          <p style={{ margin: "0.5rem 0 0", color: "#666", fontSize: "1.1rem" }}>
            {char.race} {char.classes} {char.level}
          </p>
          {char.alignment && (
            <p style={{ margin: "0.25rem 0 0", color: "#999" }}>{char.alignment}</p>
          )}
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          {editing ? (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: "0.75rem 1.5rem",
                  background: "#10b981",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setEditData(character);
                }}
                style={{
                  padding: "0.75rem 1.5rem",
                  background: "#eee",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowLevelUp(true)}
                style={{
                  padding: "0.75rem 1.5rem",
                  background: "#f59e0b",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                ⬆ Level Up
              </button>
              <button
                onClick={() => setEditing(true)}
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
                Edit Character
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

      {/* ── LEVEL UP WIZARD ── */}
      {showLevelUp && (() => {
        const newLevel = (character.level || 1) + 1;
        const hpSources = statSources["hp_max"] || [];
        const firstHpSource = hpSources.find((s: any) => s.source_type === "class");
        const hitDieMatch = firstHpSource?.obtained_notes?.match(/d(\d+)/);
        const hitDie = hitDieMatch ? parseInt(hitDieMatch[1]) : 8;
        const averageRoll = Math.ceil(hitDie / 2) + 1;
        const currentConMod = Math.floor((getStatTotal("ability_con") - 10) / 2);
        const hpRoll = levelUpHpMethod === "max" ? hitDie : levelUpHpMethod === "average" ? averageRoll : Math.max(1, Math.min(hitDie, levelUpHpRoll || 1));
        const hpGain = Math.max(1, hpRoll + currentConMod);

        // Skill ranks available this level
        const intMod_ = Math.floor((getStatTotal("ability_int") - 10) / 2);
        const isHuman = char.race?.toLowerCase().includes("human") && !char.race?.toLowerCase().includes("half");
        const isHalfElf = char.race?.toLowerCase().includes("half-elf") || char.race?.toLowerCase().includes("half elf");
        const humanSkillBonus_ = (isHuman || isHalfElf) ? 1 : 0;
        // Detect base skill per level from class name (approximation via existing sources)
        const babSrc = (statSources["bab"] || []).find((s: any) => s.source_type === "class");
        const className_ = babSrc?.source_name?.replace(" BAB", "") ?? "";
        // Find the class data
        const classSkillsPerLevel_ = 4; // safe fallback — user will just have extra or fewer points, correctable on sheet
        const skillRanksAvailable_ = Math.max(1, classSkillsPerLevel_ + intMod_ + humanSkillBonus_);
        const skillRanksUsed_ = Object.values(levelUpSkillRanks).reduce((a: number, b: number) => a + b, 0);

        const wizardSteps = [
          { id: "hp",      icon: "❤️",  label: "Hit Points" },
          { id: "skills",  icon: "📚",  label: "Skill Ranks" },
          { id: "feats",   icon: "⚔️",  label: "Feats" },
          { id: "confirm", icon: "✅",  label: "Confirm" },
        ];
        const stepIdx = wizardSteps.findIndex(s => s.id === levelUpStep);

        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}
            onClick={() => setShowLevelUp(false)}>
            <div style={{ background: "white", borderRadius: 16, width: "90%", maxWidth: 620, maxHeight: "90vh", display: "flex", flexDirection: "column" }}
              onClick={e => e.stopPropagation()}>

              {/* Wizard header */}
              <div style={{ padding: "1.5rem 2rem 1rem", borderBottom: "1px solid #e5e7eb" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <h2 style={{ margin: 0, color: "#f59e0b" }}>⬆ Level Up to {newLevel}</h2>
                    <p style={{ margin: "0.25rem 0 0", color: "#666", fontSize: "0.9rem" }}>{char.race} {char.classes}</p>
                  </div>
                  <button onClick={() => setShowLevelUp(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: "1.4rem" }}>✕</button>
                </div>

                {/* Step indicator */}
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                  {wizardSteps.map((s, i) => (
                    <div key={s.id} style={{ flex: 1, textAlign: "center" }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%", margin: "0 auto 0.25rem",
                        background: i < stepIdx ? "#10b981" : s.id === levelUpStep ? "#f59e0b" : "#e5e7eb",
                        color: i <= stepIdx ? "white" : "#999",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: i < stepIdx ? "0.9rem" : "0.85rem", fontWeight: 700,
                      }}>
                        {i < stepIdx ? "✓" : s.icon}
                      </div>
                      <div style={{ fontSize: "0.7rem", color: s.id === levelUpStep ? "#f59e0b" : "#999", fontWeight: s.id === levelUpStep ? 700 : 400 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Step content */}
              <div style={{ flex: 1, overflow: "auto", padding: "1.5rem 2rem" }}>

                {/* ── HP STEP ── */}
                {levelUpStep === "hp" && (
                  <div>
                    <h3 style={{ marginTop: 0 }}>Roll Hit Points (d{hitDie})</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.75rem", marginBottom: "1rem" }}>
                      {([
                        { id:"max",     label:"Maximum", value: hitDie },
                        { id:"average", label:"Average",  value: averageRoll },
                        { id:"manual",  label:"Roll Dice", value: null },
                      ] as const).map(m => (
                        <div key={m.id} onClick={() => setLevelUpHpMethod(m.id)}
                          style={{ padding: "1rem", borderRadius: 8, cursor: "pointer", textAlign: "center",
                            border: levelUpHpMethod === m.id ? "2px solid #f59e0b" : "1px solid #ddd",
                            background: levelUpHpMethod === m.id ? "#fffbeb" : "white" }}>
                          <div style={{ fontWeight: 700 }}>{m.label}</div>
                          <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#f59e0b", marginTop: "0.25rem" }}>
                            {m.value !== null ? m.value : "?"}
                          </div>
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
                      <span><span style={{ color: "#666", fontSize: "0.9rem" }}>HP roll: </span><strong>{hpRoll}</strong></span>
                      <span><span style={{ color: "#666", fontSize: "0.9rem" }}>CON mod: </span><strong style={{ color: currentConMod >= 0 ? "#10b981" : "#ef4444" }}>{currentConMod >= 0 ? "+" : ""}{currentConMod}</strong></span>
                      <span><span style={{ color: "#666", fontSize: "0.9rem" }}>Gain: </span><strong style={{ color: "#10b981", fontSize: "1.1rem" }}>+{hpGain} HP</strong></span>
                    </div>
                  </div>
                )}

                {/* ── SKILLS STEP ── */}
                {levelUpStep === "skills" && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                      <h3 style={{ margin: 0 }}>Assign Skill Ranks</h3>
                      <div style={{
                        padding: "0.4rem 0.9rem", borderRadius: 8, fontWeight: 700, fontSize: "0.9rem",
                        background: skillRanksUsed_ > skillRanksAvailable_ ? "#fee2e2" : skillRanksUsed_ === skillRanksAvailable_ ? "#dcfce7" : "#eff6ff",
                        color: skillRanksUsed_ > skillRanksAvailable_ ? "#991b1b" : skillRanksUsed_ === skillRanksAvailable_ ? "#166534" : "#1e40af",
                      }}>
                        {skillRanksUsed_} / {skillRanksAvailable_} used
                      </div>
                    </div>
                    <p style={{ color: "#666", fontSize: "0.85rem", marginBottom: "1rem" }}>
                      {skillRanksAvailable_} rank{skillRanksAvailable_ !== 1 ? "s" : ""} this level
                      {humanSkillBonus_ > 0 && <span style={{ color: "#7c3aed" }}> (+{humanSkillBonus_} {isHalfElf ? "Half-Elf" : "Human"})</span>}.
                      Max ranks in any skill = character level ({newLevel}).
                    </p>

                    <div style={{ display: "grid", gap: "0.35rem", maxHeight: 280, overflowY: "auto" }}>
                      {["Acrobatics","Appraise","Bluff","Climb","Diplomacy","Disable Device","Disguise","Escape Artist","Fly","Handle Animal","Heal","Intimidate","Knowledge (Arcana)","Knowledge (Dungeoneering)","Knowledge (Engineering)","Knowledge (Geography)","Knowledge (History)","Knowledge (Local)","Knowledge (Nature)","Knowledge (Nobility)","Knowledge (Planes)","Knowledge (Religion)","Linguistics","Perception","Ride","Sense Motive","Sleight of Hand","Spellcraft","Stealth","Survival","Swim","Use Magic Device"].map(skillName => {
                        const addedRanks = levelUpSkillRanks[skillName] ?? 0;
                        return (
                          <div key={skillName} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.4rem 0.75rem", background: addedRanks > 0 ? "#eff6ff" : "#f9fafb", borderRadius: 6 }}>
                            <span style={{ flex: 1, fontSize: "0.88rem" }}>{skillName}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <button onClick={() => setLevelUpSkillRanks(p => ({ ...p, [skillName]: Math.max(0, (p[skillName] ?? 0) - 1) }))}
                                style={{ width: 26, height: 26, border: "1px solid #ddd", borderRadius: 4, background: "white", cursor: "pointer", fontWeight: 700 }}>−</button>
                              <span style={{ width: 20, textAlign: "center", fontWeight: 700 }}>{addedRanks}</span>
                              <button
                                onClick={() => {
                                  if (skillRanksUsed_ < skillRanksAvailable_) {
                                    setLevelUpSkillRanks(p => ({ ...p, [skillName]: (p[skillName] ?? 0) + 1 }));
                                  }
                                }}
                                disabled={skillRanksUsed_ >= skillRanksAvailable_}
                                style={{ width: 26, height: 26, border: "1px solid #ddd", borderRadius: 4, background: skillRanksUsed_ >= skillRanksAvailable_ ? "#f3f4f6" : "white", cursor: skillRanksUsed_ >= skillRanksAvailable_ ? "not-allowed" : "pointer", fontWeight: 700 }}>+</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── FEATS STEP ── */}
                {levelUpStep === "feats" && (
                  <div>
                    <h3 style={{ marginTop: 0 }}>New Feats</h3>
                    <p style={{ color: "#666", fontSize: "0.85rem", marginBottom: "1rem" }}>
                      {newLevel % 2 === 1
                        ? `Level ${newLevel} is an odd level — you earn a new feat!`
                        : `Level ${newLevel} doesn't grant a general feat, but you may have bonus feats from your class.`}
                    </p>

                    <button onClick={() => setLevelUpShowFeatBrowser(true)}
                      style={{ padding: "0.6rem 1.25rem", background: "#0070f3", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, marginBottom: "1rem" }}>
                      ⚔️ Browse Feats
                    </button>

                    {levelUpFeats.length > 0 ? (
                      <div style={{ display: "grid", gap: "0.5rem" }}>
                        {levelUpFeats.map((f: any, i: number) => (
                          <div key={i} style={{ padding: "0.6rem 0.9rem", background: "#eff6ff", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "start", borderLeft: "3px solid #0070f3" }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{f.name}</div>
                              {f.prerequisites && <div style={{ fontSize: "0.75rem", color: "#888" }}>Req: {f.prerequisites}</div>}
                            </div>
                            <button onClick={() => setLevelUpFeats(prev => prev.filter((_: any, j: number) => j !== i))}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#999" }}>✕</button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding: "1.5rem", textAlign: "center", color: "#999", border: "2px dashed #ddd", borderRadius: 8, fontSize: "0.9rem" }}>
                        No feats selected — or skip if none gained this level.
                      </div>
                    )}
                  </div>
                )}

                {/* ── CONFIRM STEP ── */}
                {levelUpStep === "confirm" && (
                  <div>
                    <h3 style={{ marginTop: 0 }}>Confirm Level Up</h3>
                    <div style={{ display: "grid", gap: "0.75rem" }}>
                      <div style={{ padding: "0.75rem 1rem", background: "#f0fdf4", borderRadius: 8 }}>
                        <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>❤️ Hit Points</div>
                        <div style={{ color: "#555" }}>+{hpGain} HP (roll: {hpRoll}, CON: {currentConMod >= 0 ? "+" : ""}{currentConMod})</div>
                      </div>

                      <div style={{ padding: "0.75rem 1rem", background: "#eff6ff", borderRadius: 8 }}>
                        <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>📊 Combat Stats</div>
                        <div style={{ color: "#555", fontSize: "0.9rem" }}>BAB and saving throw progressions updated automatically to level {newLevel}.</div>
                      </div>

                      {skillRanksUsed_ > 0 && (
                        <div style={{ padding: "0.75rem 1rem", background: "#fefce8", borderRadius: 8 }}>
                          <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>📚 Skill Ranks ({skillRanksUsed_})</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                            {Object.entries(levelUpSkillRanks).filter(([, r]) => r > 0).map(([name, r]) => (
                              <span key={name} style={{ padding: "0.15rem 0.5rem", background: "white", borderRadius: 4, fontSize: "0.8rem" }}>{name} +{r}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {levelUpFeats.length > 0 && (
                        <div style={{ padding: "0.75rem 1rem", background: "#f3e8ff", borderRadius: 8 }}>
                          <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>⚔️ Feats ({levelUpFeats.length})</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                            {levelUpFeats.map((f: any, i: number) => (
                              <span key={i} style={{ padding: "0.15rem 0.5rem", background: "white", borderRadius: 4, fontSize: "0.8rem" }}>{f.name}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div style={{ padding: "0.75rem 1rem", background: "#fef3c7", borderRadius: 8, fontSize: "0.85rem", color: "#713f12" }}>
                        💡 Add class features, spells, and any other level {newLevel} benefits manually on the character sheet.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer nav */}
              <div style={{ padding: "1rem 2rem 1.5rem", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
                <button
                  onClick={() => {
                    const order: ("hp" | "skills" | "feats" | "confirm")[] = ["hp","skills","feats","confirm"];
                    const i = order.indexOf(levelUpStep);
                    if (i > 0) setLevelUpStep(order[i - 1]);
                    else setShowLevelUp(false);
                  }}
                  style={{ padding: "0.65rem 1.25rem", background: "#f3f4f6", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
                  {levelUpStep === "hp" ? "Cancel" : "← Back"}
                </button>

                {levelUpStep !== "confirm" ? (
                  <button
                    onClick={() => {
                      const order: ("hp" | "skills" | "feats" | "confirm")[] = ["hp","skills","feats","confirm"];
                      const i = order.indexOf(levelUpStep);
                      setLevelUpStep(order[i + 1]);
                    }}
                    disabled={levelUpStep === "hp" && levelUpHpMethod === "manual" && !levelUpHpRoll}
                    style={{ padding: "0.65rem 1.5rem", background: "#f59e0b", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>
                    Next →
                  </button>
                ) : (
                  <button onClick={handleLevelUp} disabled={levelUpSaving}
                    style={{ padding: "0.65rem 1.5rem", background: levelUpSaving ? "#9ca3af" : "#10b981", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: "1rem" }}>
                    {levelUpSaving ? "Saving..." : `✨ Confirm Level ${newLevel}`}
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
          setLevelUpFeats(prev => [...prev, feat]);
          setLevelUpShowFeatBrowser(false);
        }}
      />
    </main>
  );
}
