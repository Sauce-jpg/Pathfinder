"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../../lib/supabaseClient";
import Link from "next/link";

export default function NewCharacterPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.campaignId as string;

  const [session, setSession] = useState<any>(null);
  const [campaign, setCampaign] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Basic character info
  const [name, setName] = useState("");
  const [race, setRace] = useState("");
  const [classes, setClasses] = useState("");
  const [level, setLevel] = useState(1);
  const [alignment, setAlignment] = useState("");
  const [deity, setDeity] = useState("");
  const [homeland, setHomeland] = useState("");
  const [characterType, setCharacterType] = useState<"pc" | "npc" | "party_member" | "enemy" | "villain">("pc");

  // Ability scores
  const [str, setStr] = useState(10);
  const [dex, setDex] = useState(10);
  const [con, setCon] = useState(10);
  const [int, setInt] = useState(10);
  const [wis, setWis] = useState(10);
  const [cha, setCha] = useState(10);

  // HP
  const [hpMax, setHpMax] = useState(10);
  const [hpCurrent, setHpCurrent] = useState(10);

  // AC
  const [acArmor, setAcArmor] = useState(0);
  const [acShield, setAcShield] = useState(0);
  const [acNatural, setAcNatural] = useState(0);
  const [acDeflection, setAcDeflection] = useState(0);
  const [acMisc, setAcMisc] = useState(0);

  // Saves
  const [fortBase, setFortBase] = useState(0);
  const [refBase, setRefBase] = useState(0);
  const [willBase, setWillBase] = useState(0);

  // Combat
  const [bab, setBab] = useState(0);

  // Check auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load campaign
  useEffect(() => {
    if (!session?.user?.id) return;
    loadCampaign();
  }, [session?.user?.id, campaignId]);

  async function loadCampaign() {
    const { data } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();
    setCampaign(data);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.user?.id) return;

    setSaving(true);
    setError(null);

    try {
      const { data, error: insertError } = await supabase
        .from("characters")
        .insert({
          campaign_id: campaignId,
          owner_id: session.user.id,
          name,
          race,
          classes,
          level,
          alignment,
          deity,
          homeland,
          character_type: characterType,
          
          // Ability scores
          str, dex, con, int, wis, cha,
          str_temp: 0,
          dex_temp: 0,
          con_temp: 0,
          int_temp: 0,
          wis_temp: 0,
          cha_temp: 0,
          
          // HP
          hp_max: hpMax,
          hp_current: hpCurrent,
          hp_temp: 0,
          
          // AC
          ac_armor: acArmor,
          ac_shield: acShield,
          ac_size: 0,
          ac_natural: acNatural,
          ac_deflection: acDeflection,
          ac_misc: acMisc,
          
          // Saves
          fort_base: fortBase,
          ref_base: refBase,
          will_base: willBase,
          fort_misc: 0,
          ref_misc: 0,
          will_misc: 0,
          
          // Combat
          bab,
          cmb_misc: 0,
          cmd_misc: 0,
          
          // Empty JSON fields
          skills: {},
          feats: {},
          traits: {},
          special_abilities: {},
          spells: {},
          spells_per_day: {},
          carrying_capacity: {},
          currency: {},
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Redirect to the new character sheet
      router.push(`/pathfinder/${campaignId}/characters/${data.id}`);
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (!session) {
    return (
      <main style={{ maxWidth: 900, margin: "4rem auto", padding: "2rem", textAlign: "center" }}>
        <p>Please sign in to create a character.</p>
        <a href="/auth/login" style={{ color: "#0070f3" }}>Sign In</a>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "2rem" }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: "2rem" }}>
        <Link href="/pathfinder" style={{ color: "#0070f3", textDecoration: "none", fontSize: "0.9rem" }}>
          ← Campaigns
        </Link>
        <span style={{ margin: "0 0.5rem", color: "#999" }}>/</span>
        <Link href={`/pathfinder/${campaignId}`} style={{ color: "#0070f3", textDecoration: "none", fontSize: "0.9rem" }}>
          {campaign?.name || "Campaign"}
        </Link>
        <span style={{ margin: "0 0.5rem", color: "#999" }}>/</span>
        <Link href={`/pathfinder/${campaignId}/characters`} style={{ color: "#0070f3", textDecoration: "none", fontSize: "0.9rem" }}>
          Characters
        </Link>
        <span style={{ margin: "0 0.5rem", color: "#999" }}>/</span>
        <span style={{ fontSize: "0.9rem" }}>New Character</span>
      </div>

      <h1 style={{ marginBottom: "2rem" }}>Create New Character</h1>

      {error && (
        <div style={{
          background: "#fee",
          border: "1px solid #fcc",
          padding: "1rem",
          borderRadius: "8px",
          marginBottom: "1.5rem",
          color: "#c33",
        }}>
          Error: {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Basic Info */}
        <section style={{ marginBottom: "2rem", padding: "1.5rem", background: "white", border: "1px solid #ddd", borderRadius: "12px" }}>
          <h2 style={{ marginTop: 0 }}>Basic Information</h2>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>
                Character Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g., Vaelin Duskryn"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "1rem",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>
                Character Type
              </label>
              <select
                value={characterType}
                onChange={(e) => setCharacterType(e.target.value as any)}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "1rem",
                }}
              >
                <option value="pc">Player Character</option>
                <option value="npc">NPC</option>
                <option value="party_member">Party Member</option>
                <option value="enemy">Enemy</option>
                <option value="villain">Villain</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>
                Race
              </label>
              <input
                type="text"
                value={race}
                onChange={(e) => setRace(e.target.value)}
                placeholder="e.g., Drow Noble"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "1rem",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>
                Class(es)
              </label>
              <input
                type="text"
                value={classes}
                onChange={(e) => setClasses(e.target.value)}
                placeholder="e.g., Oracle/Wizard (Necromancer)"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "1rem",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>
                Level
              </label>
              <input
                type="number"
                value={level}
                onChange={(e) => setLevel(parseInt(e.target.value) || 1)}
                min="1"
                max="20"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "1rem",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>
                Alignment
              </label>
              <input
                type="text"
                value={alignment}
                onChange={(e) => setAlignment(e.target.value)}
                placeholder="e.g., Chaotic Neutral"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "1rem",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>
                Deity
              </label>
              <input
                type="text"
                value={deity}
                onChange={(e) => setDeity(e.target.value)}
                placeholder="e.g., Pharasma"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "1rem",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>
                Homeland
              </label>
              <input
                type="text"
                value={homeland}
                onChange={(e) => setHomeland(e.target.value)}
                placeholder="e.g., Underdark"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "1rem",
                }}
              />
            </div>
          </div>
        </section>

        {/* Ability Scores */}
        <section style={{ marginBottom: "2rem", padding: "1.5rem", background: "white", border: "1px solid #ddd", borderRadius: "12px" }}>
          <h2 style={{ marginTop: 0 }}>Ability Scores</h2>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "1rem" }}>
            {[
              { label: "STR", value: str, setter: setStr },
              { label: "DEX", value: dex, setter: setDex },
              { label: "CON", value: con, setter: setCon },
              { label: "INT", value: int, setter: setInt },
              { label: "WIS", value: wis, setter: setWis },
              { label: "CHA", value: cha, setter: setCha },
            ].map((ability) => (
              <div key={ability.label}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, textAlign: "center" }}>
                  {ability.label}
                </label>
                <input
                  type="number"
                  value={ability.value}
                  onChange={(e) => ability.setter(parseInt(e.target.value) || 10)}
                  min="1"
                  max="99"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "1.2rem",
                    textAlign: "center",
                    fontWeight: 600,
                  }}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Hit Points */}
        <section style={{ marginBottom: "2rem", padding: "1.5rem", background: "white", border: "1px solid #ddd", borderRadius: "12px" }}>
          <h2 style={{ marginTop: 0 }}>Hit Points</h2>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>
                Max HP
              </label>
              <input
                type="number"
                value={hpMax}
                onChange={(e) => setHpMax(parseInt(e.target.value) || 10)}
                min="1"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "1rem",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>
                Current HP
              </label>
              <input
                type="number"
                value={hpCurrent}
                onChange={(e) => setHpCurrent(parseInt(e.target.value) || 10)}
                min="0"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "1rem",
                }}
              />
            </div>
          </div>
        </section>

        {/* Armor Class */}
        <section style={{ marginBottom: "2rem", padding: "1.5rem", background: "white", border: "1px solid #ddd", borderRadius: "12px" }}>
          <h2 style={{ marginTop: 0 }}>Armor Class Bonuses</h2>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "1rem" }}>
            {[
              { label: "Armor", value: acArmor, setter: setAcArmor },
              { label: "Shield", value: acShield, setter: setAcShield },
              { label: "Natural", value: acNatural, setter: setAcNatural },
              { label: "Deflection", value: acDeflection, setter: setAcDeflection },
              { label: "Misc", value: acMisc, setter: setAcMisc },
            ].map((bonus) => (
              <div key={bonus.label}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>
                  {bonus.label}
                </label>
                <input
                  type="number"
                  value={bonus.value}
                  onChange={(e) => bonus.setter(parseInt(e.target.value) || 0)}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "1rem",
                  }}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Saves */}
        <section style={{ marginBottom: "2rem", padding: "1.5rem", background: "white", border: "1px solid #ddd", borderRadius: "12px" }}>
          <h2 style={{ marginTop: 0 }}>Saving Throws (Base)</h2>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
            {[
              { label: "Fortitude", value: fortBase, setter: setFortBase },
              { label: "Reflex", value: refBase, setter: setRefBase },
              { label: "Will", value: willBase, setter: setWillBase },
            ].map((save) => (
              <div key={save.label}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>
                  {save.label}
                </label>
                <input
                  type="number"
                  value={save.value}
                  onChange={(e) => save.setter(parseInt(e.target.value) || 0)}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "1rem",
                  }}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Combat */}
        <section style={{ marginBottom: "2rem", padding: "1.5rem", background: "white", border: "1px solid #ddd", borderRadius: "12px" }}>
          <h2 style={{ marginTop: 0 }}>Combat Stats</h2>
          
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>
              Base Attack Bonus (BAB)
            </label>
            <input
              type="number"
              value={bab}
              onChange={(e) => setBab(parseInt(e.target.value) || 0)}
              style={{
                width: "200px",
                padding: "0.75rem",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "1rem",
              }}
            />
          </div>
        </section>

        {/* Submit */}
        <div style={{ display: "flex", gap: "1rem" }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: "1rem 2rem",
              background: "#10b981",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "1rem",
              fontWeight: 600,
            }}
          >
            {saving ? "Creating..." : "Create Character"}
          </button>

          <Link
            href={`/pathfinder/${campaignId}/characters`}
            style={{
              padding: "1rem 2rem",
              background: "#eee",
              color: "#333",
              textDecoration: "none",
              borderRadius: "8px",
              fontSize: "1rem",
              fontWeight: 600,
              display: "inline-block",
            }}
          >
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
