"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

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
  const [activeTab, setActiveTab] = useState<"overview" | "combat" | "skills" | "spells" | "story">("overview");

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

  // Calculate modifiers
  const strMod = calculateMod(char.str, char.str_temp || 0);
  const dexMod = calculateMod(char.dex, char.dex_temp || 0);
  const conMod = calculateMod(char.con, char.con_temp || 0);
  const intMod = calculateMod(char.int, char.int_temp || 0);
  const wisMod = calculateMod(char.wis, char.wis_temp || 0);
  const chaMod = calculateMod(char.cha, char.cha_temp || 0);

  // Calculate AC
  const acTotal = 10 + (char.ac_armor || 0) + (char.ac_shield || 0) + dexMod + 
                  (char.ac_size || 0) + (char.ac_natural || 0) + 
                  (char.ac_deflection || 0) + (char.ac_misc || 0);
  const acTouch = 10 + dexMod + (char.ac_size || 0) + (char.ac_deflection || 0) + (char.ac_misc || 0);
  const acFlatFooted = acTotal - dexMod;

  // Calculate saves
  const fortTotal = (char.fort_base || 0) + conMod + (char.fort_misc || 0);
  const refTotal = (char.ref_base || 0) + dexMod + (char.ref_misc || 0);
  const willTotal = (char.will_base || 0) + wisMod + (char.will_misc || 0);

  // Calculate CMB/CMD
  const cmb = (char.bab || 0) + strMod + (char.cmb_misc || 0);
  const cmd = 10 + (char.bab || 0) + strMod + dexMod + (char.cmd_misc || 0);

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
            { id: "skills", label: "Skills & Feats" },
            { id: "spells", label: "Spells" },
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
                { label: "STR", score: char.str, temp: char.str_temp || 0, mod: strMod, field: "str" },
                { label: "DEX", score: char.dex, temp: char.dex_temp || 0, mod: dexMod, field: "dex" },
                { label: "CON", score: char.con, temp: char.con_temp || 0, mod: conMod, field: "con" },
                { label: "INT", score: char.int, temp: char.int_temp || 0, mod: intMod, field: "int" },
                { label: "WIS", score: char.wis, temp: char.wis_temp || 0, mod: wisMod, field: "wis" },
                { label: "CHA", score: char.cha, temp: char.cha_temp || 0, mod: chaMod, field: "cha" },
              ].map((ability) => (
                <div key={ability.label} style={{ textAlign: "center" }}>
                  <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>{ability.label}</div>
                  {editing ? (
                    <input
                      type="number"
                      value={ability.score}
                      onChange={(e) => updateField(ability.field, parseInt(e.target.value) || 10)}
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        border: "1px solid #ddd",
                        borderRadius: "6px",
                        fontSize: "1.5rem",
                        textAlign: "center",
                        fontWeight: 600,
                      }}
                    />
                  ) : (
                    <div style={{ fontSize: "2rem", fontWeight: 700 }}>{ability.score + ability.temp}</div>
                  )}
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
                {editing ? (
                  <input
                    type="number"
                    value={char.hp_max || 0}
                    onChange={(e) => updateField("hp_max", parseInt(e.target.value) || 0)}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                      fontSize: "1.5rem",
                    }}
                  />
                ) : (
                  <div style={{ fontSize: "2rem", fontWeight: 700, color: "#666" }}>{char.hp_max || 0}</div>
                )}
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>Temp HP</label>
                {editing ? (
                  <input
                    type="number"
                    value={char.hp_temp || 0}
                    onChange={(e) => updateField("hp_temp", parseInt(e.target.value) || 0)}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                      fontSize: "1.5rem",
                    }}
                  />
                ) : (
                  <div style={{ fontSize: "2rem", fontWeight: 700, color: "#10b981" }}>{char.hp_temp || 0}</div>
                )}
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
                <div style={{ fontSize: "3rem", fontWeight: 700, color: "#0070f3" }}>{acTotal}</div>
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

            <h3>AC Breakdown</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "1rem" }}>
              {[
                { label: "Armor", field: "ac_armor", value: char.ac_armor || 0 },
                { label: "Shield", field: "ac_shield", value: char.ac_shield || 0 },
                { label: "Natural", field: "ac_natural", value: char.ac_natural || 0 },
                { label: "Deflection", field: "ac_deflection", value: char.ac_deflection || 0 },
                { label: "Misc", field: "ac_misc", value: char.ac_misc || 0 },
              ].map((bonus) => (
                <div key={bonus.field}>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>{bonus.label}</label>
                  {editing ? (
                    <input
                      type="number"
                      value={bonus.value}
                      onChange={(e) => updateField(bonus.field, parseInt(e.target.value) || 0)}
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        border: "1px solid #ddd",
                        borderRadius: "6px",
                        fontSize: "1rem",
                      }}
                    />
                  ) : (
                    <div style={{ padding: "0.75rem", background: "#f9fafb", borderRadius: "6px", textAlign: "center" }}>
                      {bonus.value}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Saving Throws */}
          <section style={{ background: "white", border: "1px solid #ddd", borderRadius: "12px", padding: "1.5rem" }}>
            <h2 style={{ marginTop: 0 }}>Saving Throws</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2rem" }}>
              {[
                { label: "Fortitude", total: fortTotal, base: char.fort_base || 0, basefield: "fort_base", mod: conMod, modName: "CON" },
                { label: "Reflex", total: refTotal, base: char.ref_base || 0, basefield: "ref_base", mod: dexMod, modName: "DEX" },
                { label: "Will", total: willTotal, base: char.will_base || 0, basefield: "will_base", mod: wisMod, modName: "WIS" },
              ].map((save) => (
                <div key={save.label} style={{ textAlign: "center" }}>
                  <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>{save.label}</div>
                  <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "#10b981" }}>{formatMod(save.total)}</div>
                  <div style={{ color: "#666", fontSize: "0.9rem", marginTop: "0.5rem" }}>
                    {editing ? (
                      <div>
                        Base:{" "}
                        <input
                          type="number"
                          value={save.base}
                          onChange={(e) => updateField(save.basefield, parseInt(e.target.value) || 0)}
                          style={{ width: "50px", padding: "0.25rem", border: "1px solid #ddd", borderRadius: "4px" }}
                        />
                      </div>
                    ) : (
                      `Base ${save.base} + ${save.modName} ${formatMod(save.mod)}`
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Combat Stats */}
          <section style={{ background: "white", border: "1px solid #ddd", borderRadius: "12px", padding: "1.5rem" }}>
            <h2 style={{ marginTop: 0 }}>Combat Stats</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2rem" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#666", marginBottom: "0.5rem" }}>Base Attack Bonus</div>
                {editing ? (
                  <input
                    type="number"
                    value={char.bab || 0}
                    onChange={(e) => updateField("bab", parseInt(e.target.value) || 0)}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                      fontSize: "2rem",
                      textAlign: "center",
                      fontWeight: 700,
                    }}
                  />
                ) : (
                  <div style={{ fontSize: "2.5rem", fontWeight: 700 }}>{formatMod(char.bab || 0)}</div>
                )}
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#666", marginBottom: "0.5rem" }}>CMB</div>
                <div style={{ fontSize: "2.5rem", fontWeight: 700 }}>{formatMod(cmb)}</div>
                <div style={{ color: "#666", fontSize: "0.9rem", marginTop: "0.5rem" }}>
                  BAB {formatMod(char.bab || 0)} + STR {formatMod(strMod)}
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#666", marginBottom: "0.5rem" }}>CMD</div>
                <div style={{ fontSize: "2.5rem", fontWeight: 700 }}>{cmd}</div>
                <div style={{ color: "#666", fontSize: "0.9rem", marginTop: "0.5rem" }}>
                  10 + BAB + STR + DEX
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {activeTab === "skills" && (
        <div style={{ background: "white", border: "1px solid #ddd", borderRadius: "12px", padding: "1.5rem" }}>
          <h2 style={{ marginTop: 0 }}>Skills & Feats</h2>
          <p style={{ color: "#999" }}>Skills and feats management coming soon!</p>
        </div>
      )}

      {activeTab === "spells" && (
        <div style={{ background: "white", border: "1px solid #ddd", borderRadius: "12px", padding: "1.5rem" }}>
          <h2 style={{ marginTop: 0 }}>Spells</h2>
          <p style={{ color: "#999" }}>Spell management coming soon!</p>
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
