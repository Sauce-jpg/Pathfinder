"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface AddSpellcastingClassModalProps {
  characterId: string;
  characterLevel: number;
  abilityMods: {
    str: number; dex: number; con: number;
    int: number; wis: number; cha: number;
  };
  isOpen: boolean;
  onClose: () => void;
  onClassAdded: () => void;
}

const CLASS_DEFAULTS: Record<string, {
  castingType: "spontaneous" | "prepared";
  ability: "INT" | "WIS" | "CHA";
  unlimitedCantrips: boolean | null; // true=∞, false=INT-based (Wizard), null=none
}> = {
  Wizard:      { castingType: "prepared",    ability: "INT", unlimitedCantrips: false },
  Sorcerer:    { castingType: "spontaneous", ability: "CHA", unlimitedCantrips: true  },
  Cleric:      { castingType: "prepared",    ability: "WIS", unlimitedCantrips: true  },
  Druid:       { castingType: "prepared",    ability: "WIS", unlimitedCantrips: true  },
  Oracle:      { castingType: "spontaneous", ability: "CHA", unlimitedCantrips: true  },
  Bard:        { castingType: "spontaneous", ability: "CHA", unlimitedCantrips: true  },
  Witch:       { castingType: "prepared",    ability: "INT", unlimitedCantrips: true  },
  Magus:       { castingType: "prepared",    ability: "INT", unlimitedCantrips: true  },
  Inquisitor:  { castingType: "prepared",    ability: "WIS", unlimitedCantrips: true  },
  Shaman:      { castingType: "prepared",    ability: "WIS", unlimitedCantrips: true  },
  Psychic:     { castingType: "spontaneous", ability: "INT", unlimitedCantrips: true  },
  Mesmerist:   { castingType: "spontaneous", ability: "CHA", unlimitedCantrips: true  },
  Spiritualist:{ castingType: "prepared",    ability: "WIS", unlimitedCantrips: true  },
  Alchemist:   { castingType: "prepared",    ability: "INT", unlimitedCantrips: null  },
  Occultist:   { castingType: "prepared",    ability: "INT", unlimitedCantrips: null  },
  Ranger:      { castingType: "prepared",    ability: "WIS", unlimitedCantrips: null  },
  Paladin:     { castingType: "prepared",    ability: "CHA", unlimitedCantrips: null  },
  Summoner:    { castingType: "spontaneous", ability: "CHA", unlimitedCantrips: true  },
};

// Index = spell level. 999 = unlimited cantrips. 0 = none.
const SPELL_SLOTS: Record<string, Record<number, number[]>> = {
  // 9-level prepared
  Cleric:  { 1:[999,3],2:[999,4],3:[999,4,2],4:[999,4,3],5:[999,4,3,2],6:[999,4,4,3],7:[999,4,4,3,2],8:[999,4,4,4,3],9:[999,4,4,4,3,2],10:[999,4,4,4,4,3],11:[999,4,4,4,4,3,2],12:[999,4,4,4,4,4,3],13:[999,4,4,4,4,4,3,2],14:[999,4,4,4,4,4,4,3],15:[999,4,4,4,4,4,4,3,2],16:[999,4,4,4,4,4,4,4,3],17:[999,4,4,4,4,4,4,4,3,2],18:[999,4,4,4,4,4,4,4,4,3],19:[999,4,4,4,4,4,4,4,4,4],20:[999,4,4,4,4,4,4,4,4,4] },
  Druid:   { 1:[999,3],2:[999,4],3:[999,4,2],4:[999,4,3],5:[999,4,3,2],6:[999,4,4,3],7:[999,4,4,3,2],8:[999,4,4,4,3],9:[999,4,4,4,3,2],10:[999,4,4,4,4,3],11:[999,4,4,4,4,3,2],12:[999,4,4,4,4,4,3],13:[999,4,4,4,4,4,3,2],14:[999,4,4,4,4,4,4,3],15:[999,4,4,4,4,4,4,3,2],16:[999,4,4,4,4,4,4,4,3],17:[999,4,4,4,4,4,4,4,3,2],18:[999,4,4,4,4,4,4,4,4,3],19:[999,4,4,4,4,4,4,4,4,4],20:[999,4,4,4,4,4,4,4,4,4] },
  Witch:   { 1:[999,3],2:[999,4],3:[999,4,2],4:[999,4,3],5:[999,4,3,2],6:[999,4,4,3],7:[999,4,4,3,2],8:[999,4,4,4,3],9:[999,4,4,4,3,2],10:[999,4,4,4,4,3],11:[999,4,4,4,4,3,2],12:[999,4,4,4,4,4,3],13:[999,4,4,4,4,4,3,2],14:[999,4,4,4,4,4,4,3],15:[999,4,4,4,4,4,4,3,2],16:[999,4,4,4,4,4,4,4,3],17:[999,4,4,4,4,4,4,4,3,2],18:[999,4,4,4,4,4,4,4,4,3],19:[999,4,4,4,4,4,4,4,4,4],20:[999,4,4,4,4,4,4,4,4,4] },
  Shaman:  { 1:[999,3],2:[999,4],3:[999,4,2],4:[999,4,3],5:[999,4,3,2],6:[999,4,4,3],7:[999,4,4,3,2],8:[999,4,4,4,3],9:[999,4,4,4,3,2],10:[999,4,4,4,4,3],11:[999,4,4,4,4,3,2],12:[999,4,4,4,4,4,3],13:[999,4,4,4,4,4,3,2],14:[999,4,4,4,4,4,4,3],15:[999,4,4,4,4,4,4,3,2],16:[999,4,4,4,4,4,4,4,3],17:[999,4,4,4,4,4,4,4,3,2],18:[999,4,4,4,4,4,4,4,4,3],19:[999,4,4,4,4,4,4,4,4,4],20:[999,4,4,4,4,4,4,4,4,4] },
  // Wizard: cantrip count overridden to 3+INT at runtime
  Wizard:  { 1:[3,3],2:[4,4],3:[4,4,2],4:[4,4,3],5:[4,4,3,2],6:[4,4,4,3],7:[4,4,4,3,2],8:[4,4,4,4,3],9:[4,4,4,4,3,2],10:[4,4,4,4,4,3],11:[4,4,4,4,4,3,2],12:[4,4,4,4,4,4,3],13:[4,4,4,4,4,4,3,2],14:[4,4,4,4,4,4,4,3],15:[4,4,4,4,4,4,4,3,2],16:[4,4,4,4,4,4,4,4,3],17:[4,4,4,4,4,4,4,4,3,2],18:[4,4,4,4,4,4,4,4,4,3],19:[4,4,4,4,4,4,4,4,4,4],20:[4,4,4,4,4,4,4,4,4,4] },
  // 9-level spontaneous
  Sorcerer:{ 1:[999,3],2:[999,4],3:[999,5],4:[999,6,3],5:[999,6,4],6:[999,6,5,3],7:[999,6,6,4],8:[999,6,6,5,3],9:[999,6,6,6,4],10:[999,6,6,6,5,3],11:[999,6,6,6,6,4],12:[999,6,6,6,6,5,3],13:[999,6,6,6,6,6,4],14:[999,6,6,6,6,6,5,3],15:[999,6,6,6,6,6,6,4],16:[999,6,6,6,6,6,6,5,3],17:[999,6,6,6,6,6,6,6,4],18:[999,6,6,6,6,6,6,6,5,3],19:[999,6,6,6,6,6,6,6,6,4],20:[999,6,6,6,6,6,6,6,6,6] },
  Oracle:  { 1:[999,4],2:[999,5],3:[999,6],4:[999,6,3],5:[999,6,4],6:[999,6,5,3],7:[999,6,6,4],8:[999,6,6,5,3],9:[999,6,6,6,4],10:[999,6,6,6,5,3],11:[999,6,6,6,6,4],12:[999,6,6,6,6,5,3],13:[999,6,6,6,6,6,4],14:[999,6,6,6,6,6,5,3],15:[999,6,6,6,6,6,6,4],16:[999,6,6,6,6,6,6,5,3],17:[999,6,6,6,6,6,6,6,4],18:[999,6,6,6,6,6,6,6,5,3],19:[999,6,6,6,6,6,6,6,6,4],20:[999,6,6,6,6,6,6,6,6,6] },
  Psychic: { 1:[999,3],2:[999,4],3:[999,5],4:[999,6,3],5:[999,6,4],6:[999,6,5,3],7:[999,6,6,4],8:[999,6,6,5,3],9:[999,6,6,6,4],10:[999,6,6,6,5,3],11:[999,6,6,6,6,4],12:[999,6,6,6,6,5,3],13:[999,6,6,6,6,6,4],14:[999,6,6,6,6,6,5,3],15:[999,6,6,6,6,6,6,4],16:[999,6,6,6,6,6,6,5,3],17:[999,6,6,6,6,6,6,6,4],18:[999,6,6,6,6,6,6,6,5,3],19:[999,6,6,6,6,6,6,6,6,4],20:[999,6,6,6,6,6,6,6,6,6] },
  Summoner:{ 1:[999,2],2:[999,3],3:[999,4],4:[999,4,2],5:[999,4,3],6:[999,4,4,2],7:[999,4,4,3],8:[999,4,4,4,2],9:[999,4,4,4,3],10:[999,4,4,4,4,2],11:[999,4,4,4,4,3],12:[999,4,4,4,4,4,2],13:[999,4,4,4,4,4,3],14:[999,4,4,4,4,4,4],15:[999,4,4,4,4,4,4],16:[999,4,4,4,4,4,4],17:[999,4,4,4,4,4,4],18:[999,4,4,4,4,4,4],19:[999,4,4,4,4,4,4],20:[999,4,4,4,4,4,4] },
  // 6-level
  Bard:      { 1:[999,2],2:[999,3],3:[999,4],4:[999,4,2],5:[999,4,3],6:[999,4,4,2],7:[999,4,4,3],8:[999,4,4,4,2],9:[999,4,4,4,3],10:[999,4,4,4,4,2],11:[999,4,4,4,4,3],12:[999,4,4,4,4,4,2],13:[999,4,4,4,4,4,3],14:[999,4,4,4,4,4,4],15:[999,4,4,4,4,4,4],16:[999,4,4,4,4,4,4],17:[999,4,4,4,4,4,4],18:[999,4,4,4,4,4,4],19:[999,4,4,4,4,4,4],20:[999,4,4,4,4,4,4] },
  Inquisitor:{ 1:[999,2],2:[999,3],3:[999,3,2],4:[999,3,3],5:[999,4,3,2],6:[999,4,4,3],7:[999,4,4,3,2],8:[999,4,4,4,3],9:[999,4,4,4,3,2],10:[999,4,4,4,4,3],11:[999,4,4,4,4,3,2],12:[999,4,4,4,4,4,3],13:[999,4,4,4,4,4,3],14:[999,4,4,4,4,4,4],15:[999,4,4,4,4,4,4],16:[999,4,4,4,4,4,4],17:[999,4,4,4,4,4,4],18:[999,4,4,4,4,4,4],19:[999,4,4,4,4,4,4],20:[999,4,4,4,4,4,4] },
  Magus:     { 1:[999,1],2:[999,2],3:[999,3],4:[999,3,1],5:[999,4,2],6:[999,4,3],7:[999,4,3,1],8:[999,4,4,2],9:[999,4,4,3],10:[999,4,4,3,1],11:[999,4,4,4,2],12:[999,4,4,4,3],13:[999,4,4,4,3,1],14:[999,4,4,4,4,2],15:[999,4,4,4,4,3],16:[999,4,4,4,4,3],17:[999,4,4,4,4,4],18:[999,4,4,4,4,4],19:[999,4,4,4,4,4],20:[999,4,4,4,4,4] },
  Mesmerist: { 1:[999,2],2:[999,3],3:[999,4],4:[999,4,2],5:[999,4,3],6:[999,4,4,2],7:[999,4,4,3],8:[999,4,4,4,2],9:[999,4,4,4,3],10:[999,4,4,4,4,2],11:[999,4,4,4,4,3],12:[999,4,4,4,4,4,2],13:[999,4,4,4,4,4,3],14:[999,4,4,4,4,4,4],15:[999,4,4,4,4,4,4],16:[999,4,4,4,4,4,4],17:[999,4,4,4,4,4,4],18:[999,4,4,4,4,4,4],19:[999,4,4,4,4,4,4],20:[999,4,4,4,4,4,4] },
  Spiritualist:{ 1:[999,2],2:[999,3],3:[999,4],4:[999,4,2],5:[999,4,3],6:[999,4,4,2],7:[999,4,4,3],8:[999,4,4,4,2],9:[999,4,4,4,3],10:[999,4,4,4,4,2],11:[999,4,4,4,4,3],12:[999,4,4,4,4,4,2],13:[999,4,4,4,4,4,3],14:[999,4,4,4,4,4,4],15:[999,4,4,4,4,4,4],16:[999,4,4,4,4,4,4],17:[999,4,4,4,4,4,4],18:[999,4,4,4,4,4,4],19:[999,4,4,4,4,4,4],20:[999,4,4,4,4,4,4] },
  // 4-level (no spells until level 4)
  Ranger:  { 1:[0],2:[0],3:[0],4:[0,1],5:[0,1],6:[0,1,1],7:[0,1,1],8:[0,2,1,1],9:[0,2,1,1],10:[0,2,1,1],11:[0,2,2,1,1],12:[0,2,2,1,1],13:[0,3,2,1,1],14:[0,3,2,1,1],15:[0,3,2,2,1],16:[0,3,3,2,1],17:[0,4,3,2,1],18:[0,4,3,2,1],19:[0,4,3,3,2],20:[0,4,3,3,2] },
  Paladin: { 1:[0],2:[0],3:[0],4:[0,1],5:[0,1],6:[0,1,1],7:[0,1,1],8:[0,2,1,1],9:[0,2,1,1],10:[0,2,1,1],11:[0,2,2,1,1],12:[0,2,2,1,1],13:[0,3,2,1,1],14:[0,3,2,1,1],15:[0,3,2,2,1],16:[0,3,3,2,1],17:[0,4,3,2,1],18:[0,4,3,2,1],19:[0,4,3,3,2],20:[0,4,3,3,2] },
  // Alchemist (extracts, no cantrips)
  Alchemist:{ 1:[0,1],2:[0,2],3:[0,3],4:[0,3,1],5:[0,4,2],6:[0,4,3,1],7:[0,4,4,2],8:[0,4,4,3,1],9:[0,5,4,4,2],10:[0,5,5,4,3,1],11:[0,5,5,5,4,2],12:[0,5,5,5,5,3,1],13:[0,5,5,5,5,4,2],14:[0,5,5,5,5,5,3,1],15:[0,5,5,5,5,5,4,2],16:[0,5,5,5,5,5,5,3,1],17:[0,5,5,5,5,5,5,4,2],18:[0,5,5,5,5,5,5,5,3,1],19:[0,5,5,5,5,5,5,5,4,2],20:[0,5,5,5,5,5,5,5,5,3] },
  // Occultist (no cantrips, implements)
  Occultist:{ 1:[0,3],2:[0,4],3:[0,5],4:[0,5,3],5:[0,5,4],6:[0,5,5,3],7:[0,6,5,4],8:[0,6,6,5,3],9:[0,6,6,5,4],10:[0,6,6,6,5,3],11:[0,6,6,6,5,4],12:[0,6,6,6,6,5,3],13:[0,6,6,6,6,5,4],14:[0,6,6,6,6,6,5,3],15:[0,6,6,6,6,6,5,4],16:[0,6,6,6,6,6,6,5,3],17:[0,6,6,6,6,6,6,5,4],18:[0,6,6,6,6,6,6,6,5,3],19:[0,6,6,6,6,6,6,6,5,4],20:[0,6,6,6,6,6,6,6,6,5] },
};

export function AddSpellcastingClassModal({
  characterId, characterLevel, abilityMods,
  isOpen, onClose, onClassAdded,
}: AddSpellcastingClassModalProps) {
  const [className, setClassName] = useState("Wizard");
  const [casterLevel, setCasterLevel] = useState(Math.min(characterLevel, 20));
  const [notes, setNotes] = useState("");
  const [arcaneSchool, setArcaneSchool] = useState("Universalist");
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const ARCANE_SCHOOLS = ["Universalist","Abjuration","Conjuration","Divination","Enchantment","Evocation","Illusion","Necromancy","Transmutation"];

  const meta = CLASS_DEFAULTS[className] ?? CLASS_DEFAULTS.Wizard;
  const castingType = meta.castingType;
  const spellcastingAbility = meta.ability;
  const abilityMod = abilityMods[spellcastingAbility.toLowerCase() as keyof typeof abilityMods];
  const unlimitedCantrips = meta.unlimitedCantrips;

  const clampedLevel = Math.max(1, Math.min(20, casterLevel));
  const baseSlots = (SPELL_SLOTS[className] ?? SPELL_SLOTS.Wizard)[clampedLevel] ?? [0, 3];

  const hasSchoolBonus = className === "Wizard" && arcaneSchool !== "Universalist";

  function buildSlots(): { level: number; total: number }[] {
    return baseSlots
      .map((total, level) => {
        let adjusted = total;
        if (className === "Wizard" && level === 0) {
          adjusted = Math.max(3, 3 + abilityMod);
        }
        // Arcane school grants +1 slot per spell level 1–9
        if (hasSchoolBonus && level >= 1 && adjusted > 0) {
          adjusted += 1;
        }
        return { level, total: adjusted };
      })
      .filter(({ level, total }) => !(level === 0 && total === 0));
  }

  const slotsPreview = buildSlots();
  const maxSpellLevel = slotsPreview.filter(s => s.level > 0).length > 0
    ? slotsPreview[slotsPreview.length - 1].level : 0;
  const cantripSlot = slotsPreview.find(s => s.level === 0);

  async function handleSubmit() {
    setSaving(true);
    const schoolNotes = className === "Wizard" && arcaneSchool !== "Universalist"
      ? `Arcane School: ${arcaneSchool}` + (notes ? ` | ${notes}` : "")
      : notes || null;
    const { data: classData, error: classError } = await supabase
      .from("character_spellcasting_classes")
      .insert({
        character_id: characterId,
        class_name: className,
        casting_type: castingType,
        spellcasting_ability: spellcastingAbility,
        caster_level: clampedLevel,
        concentration_bonus: clampedLevel + abilityMod,
        base_spell_dc: 10,
        notes: schoolNotes,
      })
      .select().single();

    if (classError) { alert("Error creating class: " + classError.message); setSaving(false); return; }

    const { error: slotsError } = await supabase.from("character_spell_slots").insert(
      slotsPreview.map(({ level, total }) => ({
        character_id: characterId,
        spellcasting_class_id: classData.id,
        spell_level: level,
        slots_total: total,
        slots_used: 0,
      }))
    );

    if (slotsError) { alert("Error creating spell slots: " + slotsError.message); setSaving(false); return; }
    setSaving(false);
    onClassAdded();
  }

  const sortedClasses = Object.keys(CLASS_DEFAULTS).sort();

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:3000 }} onClick={onClose}>
      <div style={{ background:"white",borderRadius:12,padding:"2rem",maxWidth:520,width:"90%",maxHeight:"90vh",overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
        <h2 style={{ marginTop:0 }}>Add Spellcasting Class</h2>
        <div style={{ display:"grid",gap:"1rem" }}>

          <div>
            <label style={{ display:"block",fontWeight:600,marginBottom:"0.4rem" }}>Class *</label>
            <select value={className} onChange={e=>{ setClassName(e.target.value); setArcaneSchool("Universalist"); }}
              style={{ width:"100%",padding:"0.75rem",border:"1px solid #ddd",borderRadius:6,fontSize:"1rem" }}>
              {sortedClasses.map(c=><option key={c} value={c}>{c}</option>)}
              <option value="Other">Other (Custom)</option>
            </select>
          </div>

          {/* Arcane School picker — Wizard only */}
          {className === "Wizard" && (
            <div style={{ padding:"1rem",background:"#faf5ff",border:"1px solid #e9d5ff",borderRadius:8 }}>
              <label style={{ display:"block",fontWeight:700,marginBottom:"0.5rem",color:"#7c3aed" }}>🔮 Arcane School</label>
              <div style={{ fontSize:"0.82rem",color:"#666",marginBottom:"0.6rem" }}>
                Specialists gain +1 bonus spell slot per spell level (1–9). Universalists get no bonus but have no forbidden schools.
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"0.4rem" }}>
                {ARCANE_SCHOOLS.map(school => (
                  <div key={school} onClick={() => setArcaneSchool(school)}
                    style={{
                      padding:"0.5rem 0.4rem",textAlign:"center",borderRadius:6,cursor:"pointer",fontSize:"0.82rem",
                      border:`2px solid ${arcaneSchool===school?"#7c3aed":"#e5e7eb"}`,
                      background:arcaneSchool===school?"#ede9fe":"white",
                      fontWeight:arcaneSchool===school?700:400,
                    }}>
                    {school}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.75rem",padding:"0.75rem",background:"#f0fdf4",borderRadius:8,fontSize:"0.9rem" }}>
            <div><span style={{ color:"#666" }}>Type: </span><strong>{castingType==="spontaneous"?"Spontaneous":"Prepared"}</strong></div>
            <div><span style={{ color:"#666" }}>Ability: </span><strong>{spellcastingAbility} ({abilityMod>=0?"+":""}{abilityMod})</strong></div>
          </div>

          <div>
            <label style={{ display:"block",fontWeight:600,marginBottom:"0.4rem" }}>Caster Level *</label>
            <input type="number" value={casterLevel} min={1} max={20}
              onChange={e=>setCasterLevel(Math.min(20,Math.max(1,parseInt(e.target.value)||1)))}
              style={{ width:"100%",padding:"0.75rem",border:"1px solid #ddd",borderRadius:6,fontSize:"1rem" }} />
            <div style={{ fontSize:"0.82rem",color:"#666",marginTop:"0.25rem" }}>Usually equals class level</div>
          </div>

          <div>
            <label style={{ display:"block",fontWeight:600,marginBottom:"0.4rem" }}>Notes (optional)</label>
            <input type="text" value={notes} onChange={e=>setNotes(e.target.value)}
              placeholder="e.g., Conjuration school, Necromancy forbidden"
              style={{ width:"100%",padding:"0.75rem",border:"1px solid #ddd",borderRadius:6,fontSize:"1rem" }} />
          </div>

          <div style={{ background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,padding:"1rem",fontSize:"0.9rem" }}>
            <strong>📋 Will create:</strong>
            <div style={{ marginTop:"0.5rem",display:"grid",gap:"0.3rem" }}>
              <div>• Spell DC: 10 + spell level + ({abilityMod >= 0 ? "+" : ""}{abilityMod})</div>
              {cantripSlot && (cantripSlot.total===999
                ? <div>• Cantrips: <strong>∞ unlimited</strong> (cast any number of times)</div>
                : <div>• Cantrips: <strong>{cantripSlot.total} prepared</strong> (3 + INT {abilityMod>=0?"+":""}{abilityMod}), castable unlimited times</div>
              )}
              {!cantripSlot && <div>• No cantrips</div>}
              <div>• Highest spell level: {maxSpellLevel > 0 ? maxSpellLevel : "none yet at this level"}</div>
              {slotsPreview.filter(s=>s.level>0).slice(0,3).map(s=>(
                <div key={s.level}>• Level {s.level} slots: {s.total}{hasSchoolBonus ? <span style={{ color:"#7c3aed" }}> (incl. +1 {arcaneSchool} school)</span> : ""}</div>
              ))}
              {hasSchoolBonus && <div style={{ color:"#7c3aed",fontStyle:"italic" }}>• +1 bonus {arcaneSchool} school slot at each spell level</div>}
            </div>
          </div>

          <div style={{ display:"flex",gap:"0.75rem" }}>
            <button onClick={handleSubmit} disabled={saving}
              style={{ flex:1,padding:"0.75rem",background:"#8b5cf6",color:"white",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600 }}>
              {saving?"Creating...":"Create Class"}
            </button>
            <button onClick={onClose}
              style={{ padding:"0.75rem 1.5rem",background:"#eee",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600 }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
