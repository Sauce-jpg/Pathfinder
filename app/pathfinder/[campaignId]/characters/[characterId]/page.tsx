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

    // Load equipped armor's armor check penalty
    const { data: equippedArmor } = await supabase
      .from("character_armor")
      .select("armor_check_penalty")
      .eq("character_id", characterId)
      .eq("is_equipped", true)
      .single();

    setEquippedAcp(equippedArmor?.armor_check_penalty ?? 0);

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

  // Calculate AC from sources
  const acFromSources = getStatTotal("ac");
  const acTotal = 10 + dexMod + acFromSources;
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
                      { label: `DEX mod`, value: dexMod },
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
            armorCheckPenalty={equippedAcp > 0 ? -equippedAcp : 0}
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
    </main>
  );
}
