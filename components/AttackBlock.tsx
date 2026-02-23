"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

interface AttackBlockProps {
  characterId: string;
  bab: number;
  strMod: number;
  dexMod: number;
  miscAtkBonus: number;   // from stat_sources "attack_bonus"
  miscDmgBonus: number;   // from stat_sources "damage_bonus"
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtMod(n: number) { return n >= 0 ? `+${n}` : `${n}`; }

function iteratives(baseAtk: number, count: number, extraAtFullBAB = 0): string {
  const attacks: number[] = [];
  for (let i = 0; i < Math.min(count, 4); i++) attacks.push(baseAtk - i * 5);
  // Haste / Rapid Shot extra attack is added at full BAB (prepended)
  if (extraAtFullBAB > 0) {
    for (let i = 0; i < extraAtFullBAB; i++) attacks.unshift(baseAtk);
  }
  return attacks.map(fmtMod).join(" / ");
}

// Number of iterative attacks from BAB alone
function iterativeCount(bab: number) {
  if (bab >= 16) return 4;
  if (bab >= 11) return 3;
  if (bab >= 6)  return 2;
  return 1;
}

// ── Component ────────────────────────────────────────────────────────────────
export default function AttackBlock({
  characterId, bab, strMod, dexMod, miscAtkBonus, miscDmgBonus,
}: AttackBlockProps) {
  const [weapons, setWeapons]           = useState<any[]>([]);
  const [feats, setFeats]               = useState<string[]>([]);
  const [classNames, setClassNames]     = useState<string[]>([]);
  const [selectedMain, setSelectedMain] = useState("unarmed");
  const [selectedOff, setSelectedOff]   = useState("unarmed");
  const [loading, setLoading]           = useState(true);

  // ── Toggles ──
  const [haste, setHaste]               = useState(false);
  const [powerAtk, setPowerAtk]         = useState(false);
  const [deadlyAim, setDeadlyAim]       = useState(false);
  const [rapidShot, setRapidShot]       = useState(false);
  const [manyshot, setManyshot]         = useState(false);
  const [twf, setTwf]                   = useState(false);
  const [dexToDmg, setDexToDmg]         = useState(false); // manual override

  useEffect(() => { loadData(); }, [characterId]);

  async function loadData() {
    setLoading(true);
    const [{ data: wData }, { data: fData }, { data: cData }] = await Promise.all([
      supabase.from("character_weapons").select("*").eq("character_id", characterId).order("is_primary", { ascending: false }),
      supabase.from("character_features").select("name").eq("character_id", characterId).eq("is_active", true),
      supabase.from("character_stat_sources").select("source_name").eq("character_id", characterId).eq("stat_category", "class_level"),
    ]);

    const weaponList = wData || [];
    setWeapons(weaponList);
    setFeats((fData || []).map((f: any) => f.name.toLowerCase()));

    const classes = (cData || []).map((c: any) =>
      c.source_name?.toLowerCase().split(" level")[0].trim() ?? ""
    );
    setClassNames(classes);

    // Auto-select primary weapon
    const primary = weaponList.find((w: any) => w.is_primary);
    const first   = weaponList[0];
    setSelectedMain(primary?.id ?? first?.id ?? "unarmed");
    setLoading(false);
  }

  // ── Derived flags ────────────────────────────────────────────────────────
  const hasWeaponFinesse  = feats.includes("weapon finesse");
  const hasSlashingGrace  = feats.includes("slashing grace");
  const hasFencingGrace   = feats.includes("fencing grace");
  const hasRapidShot      = feats.includes("rapid shot");
  const hasManyshot       = feats.includes("manyshot");
  const hasTwoWeaponFight = feats.includes("two-weapon fighting") || feats.includes("two weapon fighting");
  const isGunslinger      = classNames.some(c => c.includes("gunslinger"));

  const UNARMED: any = {
    id: "unarmed", weapon_name: "Unarmed Strike", weapon_type: "melee",
    weapon_category: "simple", damage_dice: "1d3", damage_type: "B",
    critical_range: "20", critical_multiplier: "x2",
    range_increment: null, enhancement_bonus: 0, properties: [],
  };

  const allWeapons = [...weapons, UNARMED];
  const mainWeapon = allWeapons.find(w => w.id === selectedMain) ?? UNARMED;
  const offWeapon  = allWeapons.find(w => w.id === selectedOff)  ?? UNARMED;

  // ── Per-weapon helpers ───────────────────────────────────────────────────
  function getWeaponProps(w: any): string[] {
    return (w.properties || []).map((p: string) => p.toLowerCase());
  }

  function isThrown(w: any)   { return getWeaponProps(w).includes("thrown") || w.weapon_type?.toLowerCase() === "thrown"; }
  function isRanged(w: any)   { return w.weapon_type?.toLowerCase() === "ranged" && !isThrown(w); }
  function isFirearm(w: any)  { return getWeaponProps(w).includes("firearm") || w.weapon_category?.toLowerCase() === "firearm"; }
  function isFinessable(w: any) {
    const props = getWeaponProps(w);
    // Light weapons, rapiers, whips, spiked chains are finessable
    const finessableTypes = ["rapier", "whip", "spiked chain"];
    return props.includes("light") || props.includes("finesse") ||
      finessableTypes.some(t => w.weapon_name?.toLowerCase().includes(t)) ||
      w.weapon_category?.toLowerCase() === "light";
  }

  /** Does this weapon use DEX instead of STR for the attack roll? */
  function usesDexToAtk(w: any): boolean {
    if (isRanged(w)) return true;
    if (isFirearm(w)) return true;
    if (hasWeaponFinesse && isFinessable(w)) return true;
    return false;
  }

  /** Does this weapon add DEX (instead of / in addition to STR) to damage? */
  function usesDexToDmg(w: any): boolean {
    if (dexToDmg) return true; // manual override
    if (isRanged(w)) return false; // ranged uses no ability mod normally
    if (isFirearm(w) && isGunslinger) return true;
    if (hasSlashingGrace && getWeaponProps(w).includes("slashing")) return true;
    if (hasFencingGrace && w.weapon_name?.toLowerCase().includes("rapier")) return true;
    return false;
  }

  /** Ability mod used for attack */
  function atkAbilityMod(w: any): { mod: number; label: string } {
    if (isThrown(w)) return { mod: strMod, label: "STR" };
    if (usesDexToAtk(w)) return { mod: dexMod, label: "DEX" };
    return { mod: strMod, label: "STR" };
  }

  /** Ability mod used for damage */
  function dmgAbilityMod(w: any, isOffHand = false): { mod: number; label: string } {
    if (isRanged(w) && !isThrown(w)) return { mod: 0, label: "" };
    if (isThrown(w)) return { mod: strMod, label: "STR" };
    if (usesDexToDmg(w)) return { mod: dexMod, label: "DEX" };
    // Off-hand: 0.5× STR (round down), unless negative then full penalty
    if (isOffHand) {
      const half = strMod > 0 ? Math.floor(strMod / 2) : strMod;
      return { mod: half, label: "½STR" };
    }
    return { mod: strMod, label: "STR" };
  }

  // ── TWF penalties ────────────────────────────────────────────────────────
  // TWF feat: main −2 / off −2   Improved: main −0 / off −0 (light off-hand)
  // Without TWF feat: main −4 / off −8 (light off-hand −4)
  function twfPenalties(offIsLight: boolean): { main: number; off: number } {
    const hasImproved = feats.includes("improved two-weapon fighting") || feats.includes("improved two weapon fighting");
    if (hasTwoWeaponFight || hasImproved) {
      return offIsLight ? { main: -2, off: -2 } : { main: -4, off: -4 };
    }
    return offIsLight ? { main: -4, off: -4 } : { main: -4, off: -8 };
  }

  // ── Build attack entry ───────────────────────────────────────────────────
  function buildAttacks(w: any, isOffHand = false): {
    label: string; attackStr: string; dmgStr: string;
    critStr: string; note: string; atkBreakdown: string; dmgBreakdown: string;
  } {
    const enh = w.enhancement_bonus ?? 0;
    const { mod: ablAtk, label: ablAtkLabel } = atkAbilityMod(w);
    const { mod: ablDmg, label: ablDmgLabel } = dmgAbilityMod(w, isOffHand);

    // Power Attack scaling: −1 attack / +2 damage per 4 BAB (min 1)
    const paSteps = Math.max(1, Math.floor(bab / 4));
    const paPenalty   = powerAtk && !isRanged(w) && !isFirearm(w) ? -paSteps : 0;
    const paDmgBonus  = powerAtk && !isRanged(w) && !isFirearm(w) ? paSteps * 2 : 0;

    // Deadly Aim (ranged equivalent of Power Attack)
    const daPenalty   = deadlyAim && (isRanged(w) || isFirearm(w)) ? -paSteps : 0;
    const daDmgBonus  = deadlyAim && (isRanged(w) || isFirearm(w)) ? paSteps * 2 : 0;

    // TWF penalty
    const offIsLight = getWeaponProps(offWeapon).includes("light") || offWeapon.weapon_category?.toLowerCase() === "light";
    const { main: twfMainPen, off: twfOffPen } = twfPenalties(offIsLight);
    const twfPen = twf ? (isOffHand ? twfOffPen : twfMainPen) : 0;

    // Rapid Shot penalty (all ranged attacks −2, gain 1 extra)
    const rsAll = rapidShot && hasRapidShot && (isRanged(w) || isFirearm(w)) ? -2 : 0;

    const totalAtkMod = bab + ablAtk + enh + miscAtkBonus + paPenalty + daPenalty + twfPen + rsAll;
    const totalDmgMod = ablDmg + enh + miscDmgBonus + paDmgBonus + daDmgBonus;

    // Number of attacks
    const iters = isOffHand ? 1 : iterativeCount(bab); // off-hand gets only 1 attack (without Improved TWF)
    const hasImprovedTWF = feats.includes("improved two-weapon fighting") || feats.includes("improved two weapon fighting");
    const offIters = twf && isOffHand && hasImprovedTWF ? Math.min(2, iterativeCount(bab)) : (twf && isOffHand ? 1 : iters);

    const hasteExtra = haste && !isOffHand ? 1 : 0;
    const rsExtra    = rapidShot && hasRapidShot && (isRanged(w) || isFirearm(w)) && !isOffHand ? 1 : 0;

    const attackStr = iteratives(totalAtkMod, isOffHand ? offIters : iters, hasteExtra + rsExtra);

    // Damage string
    const dice = w.damage_dice || "1d4";
    const dmgStr = totalDmgMod === 0 ? dice : `${dice}${fmtMod(totalDmgMod)}`;

    // Manyshot note (first ranged attack fires 2 arrows = +1 die damage on first hit)
    const msNote = manyshot && hasManyshot && (isRanged(w) || isFirearm(w)) && !isOffHand
      ? " (first hit: 2 arrows)" : "";

    // Crit
    const range = w.critical_range || "20";
    const mult  = w.critical_multiplier || "x2";
    const critStr = range === "20" ? mult : `${range}/${mult}`;

    // Breakdown strings
    const atkParts = [
      `BAB ${fmtMod(bab)}`,
      `${ablAtkLabel} ${fmtMod(ablAtk)}`,
      enh > 0 ? `Enh +${enh}` : null,
      paPenalty !== 0 ? `Power Atk ${fmtMod(paPenalty)}` : null,
      daPenalty !== 0 ? `Deadly Aim ${fmtMod(daPenalty)}` : null,
      twfPen !== 0 ? `TWF ${fmtMod(twfPen)}` : null,
      rsAll !== 0 ? `Rapid Shot ${fmtMod(rsAll)}` : null,
      miscAtkBonus !== 0 ? `Misc ${fmtMod(miscAtkBonus)}` : null,
    ].filter(Boolean).join(" · ");

    const dmgParts = [
      dice,
      ablDmgLabel ? `${ablDmgLabel} ${fmtMod(ablDmg)}` : null,
      enh > 0 ? `Enh +${enh}` : null,
      paDmgBonus > 0 ? `Power Atk +${paDmgBonus}` : null,
      daDmgBonus > 0 ? `Deadly Aim +${daDmgBonus}` : null,
      miscDmgBonus !== 0 ? `Misc ${fmtMod(miscDmgBonus)}` : null,
    ].filter(Boolean).join(" + ");

    const typeNote = [
      w.damage_type || "",
      isThrown(w) ? "thrown" : "",
      isFirearm(w) ? "firearm" : "",
      usesDexToDmg(w) && !isRanged(w) ? "DEX→dmg" : "",
      msNote,
    ].filter(Boolean).join(" · ");

    return {
      label: isOffHand ? `${w.weapon_name} (off-hand)` : w.weapon_name,
      attackStr, dmgStr, critStr,
      note: typeNote,
      atkBreakdown: atkParts,
      dmgBreakdown: dmgParts,
    };
  }

  if (loading) return <div style={{ color: "#999", fontSize: "0.9rem" }}>Loading weapons…</div>;

  const mainResult = buildAttacks(mainWeapon, false);
  const offResult  = twf ? buildAttacks(offWeapon, true) : null;

  const isMainRanged = isRanged(mainWeapon) || isFirearm(mainWeapon);

  // Which toggles are relevant
  const showPowerAtk  = !isMainRanged;
  const showDeadlyAim = isMainRanged;
  const showRapidShot = isMainRanged && hasRapidShot;
  const showManyshot  = isMainRanged && hasManyshot;

  return (
    <div>
      {/* Weapon selector row */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <label style={{ fontWeight: 600, color: "#555", fontSize: "0.85rem", whiteSpace: "nowrap" }}>Main hand:</label>
        <select
          value={selectedMain}
          onChange={e => { setSelectedMain(e.target.value); setTwf(false); }}
          style={{ padding: "0.4rem 0.6rem", border: "2px solid #e5e7eb", borderRadius: "7px", fontSize: "0.95rem", fontWeight: 600, background: "white", cursor: "pointer" }}
        >
          {weapons.map(w => (
            <option key={w.id} value={w.id}>
              {w.weapon_name}{w.is_primary ? " ★" : ""}{w.enhancement_bonus > 0 ? ` (+${w.enhancement_bonus})` : ""}
            </option>
          ))}
          <option value="unarmed">Unarmed Strike</option>
        </select>

        {twf && (
          <>
            <label style={{ fontWeight: 600, color: "#555", fontSize: "0.85rem", whiteSpace: "nowrap" }}>Off hand:</label>
            <select
              value={selectedOff}
              onChange={e => setSelectedOff(e.target.value)}
              style={{ padding: "0.4rem 0.6rem", border: "2px solid #f59e0b", borderRadius: "7px", fontSize: "0.95rem", fontWeight: 600, background: "white", cursor: "pointer" }}
            >
              {weapons.map(w => (
                <option key={w.id} value={w.id}>
                  {w.weapon_name}{w.enhancement_bonus > 0 ? ` (+${w.enhancement_bonus})` : ""}
                </option>
              ))}
              <option value="unarmed">Unarmed Strike</option>
            </select>
          </>
        )}
      </div>

      {/* Toggle row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.25rem" }}>
        {[
          { label: "⚡ Haste",        active: haste,     set: setHaste,     always: true },
          { label: "⚔️ Power Atk",   active: powerAtk,  set: setPowerAtk,  always: showPowerAtk },
          { label: "🎯 Deadly Aim",   active: deadlyAim, set: setDeadlyAim, always: showDeadlyAim },
          { label: "🏹 Rapid Shot",   active: rapidShot, set: setRapidShot, always: showRapidShot },
          { label: "🏹 Manyshot",     active: manyshot,  set: setManyshot,  always: showManyshot },
          { label: "🗡️ TWF",          active: twf,       set: setTwf,       always: !isMainRanged },
          { label: "✨ DEX→Dmg",      active: dexToDmg,  set: setDexToDmg,  always: !isMainRanged },
        ].filter(t => t.always).map(t => (
          <button
            key={t.label}
            onClick={() => t.set(!t.active)}
            style={{
              padding: "0.3rem 0.7rem",
              borderRadius: "6px",
              border: `2px solid ${t.active ? "#3b82f6" : "#e5e7eb"}`,
              background: t.active ? "#eff6ff" : "white",
              color: t.active ? "#1d4ed8" : "#6b7280",
              fontWeight: t.active ? 700 : 500,
              fontSize: "0.82rem",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Attack panels */}
      <div style={{ display: "grid", gridTemplateColumns: offResult ? "1fr 1fr" : "1fr", gap: "1rem" }}>
        {[
          { result: mainResult, accent: { border: "#bfdbfe", bg: "#f8faff", atk: "#1d4ed8", dmg: "#c2410c", atkBg: "#eff6ff", dmgBg: "#fff8f0", atkBorder: "#bfdbfe", dmgBorder: "#fed7aa" } },
          ...(offResult ? [{ result: offResult, accent: { border: "#fde68a", bg: "#fffbeb", atk: "#92400e", dmg: "#92400e", atkBg: "#fffbeb", dmgBg: "#fef3c7", atkBorder: "#fde68a", dmgBorder: "#fde68a" } }] : []),
        ].map(({ result, accent }, idx) => (
          <div key={idx} style={{ border: `2px solid ${accent.border}`, borderRadius: "10px", padding: "1rem", background: accent.bg }}>
            <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#374151", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {result.label}
              {result.note && <span style={{ fontWeight: 400, fontSize: "0.75rem", color: "#9ca3af" }}>{result.note}</span>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              {/* Attack */}
              <div style={{ background: accent.atkBg, border: `1px solid ${accent.atkBorder}`, borderRadius: "8px", padding: "0.6rem 0.75rem" }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#3b82f6", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.2rem" }}>Attack</div>
                <div style={{ fontSize: "1.6rem", fontWeight: 800, color: accent.atk, lineHeight: 1, letterSpacing: "-0.02em" }}>{result.attackStr}</div>
                <div style={{ fontSize: "0.7rem", color: "#9ca3af", marginTop: "0.3rem" }}>{result.atkBreakdown}</div>
              </div>
              {/* Damage */}
              <div style={{ background: accent.dmgBg, border: `1px solid ${accent.dmgBorder}`, borderRadius: "8px", padding: "0.6rem 0.75rem" }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.2rem" }}>Damage · {result.critStr}</div>
                <div style={{ fontSize: "1.6rem", fontWeight: 800, color: accent.dmg, lineHeight: 1, letterSpacing: "-0.02em" }}>{result.dmgStr}</div>
                <div style={{ fontSize: "0.7rem", color: "#9ca3af", marginTop: "0.3rem" }}>{result.dmgBreakdown}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {weapons.length === 0 && (
        <p style={{ color: "#999", fontSize: "0.85rem", marginTop: "0.75rem" }}>
          No weapons added yet — go to Equipment to add some. Unarmed strike is always available.
        </p>
      )}
    </div>
  );
}
