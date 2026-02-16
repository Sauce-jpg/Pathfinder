"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { StatWithSources } from "./StatWithSources";
import { AddCustomSkillModal } from "./AddCustomSkillModal";

// Pathfinder 1e skill definitions
const SKILL_DEFINITIONS = [
  { name: "Acrobatics", ability: "DEX", armorPenalty: true, trainedOnly: false },
  { name: "Appraise", ability: "INT", armorPenalty: false, trainedOnly: false },
  { name: "Bluff", ability: "CHA", armorPenalty: false, trainedOnly: false },
  { name: "Climb", ability: "STR", armorPenalty: true, trainedOnly: false },
  { name: "Diplomacy", ability: "CHA", armorPenalty: false, trainedOnly: false },
  { name: "Disable Device", ability: "DEX", armorPenalty: true, trainedOnly: true },
  { name: "Disguise", ability: "CHA", armorPenalty: false, trainedOnly: false },
  { name: "Escape Artist", ability: "DEX", armorPenalty: true, trainedOnly: false },
  { name: "Fly", ability: "DEX", armorPenalty: true, trainedOnly: false },
  { name: "Handle Animal", ability: "CHA", armorPenalty: false, trainedOnly: true },
  { name: "Heal", ability: "WIS", armorPenalty: false, trainedOnly: false },
  { name: "Intimidate", ability: "CHA", armorPenalty: false, trainedOnly: false },
  { name: "Knowledge (Arcana)", ability: "INT", armorPenalty: false, trainedOnly: true },
  { name: "Knowledge (Dungeoneering)", ability: "INT", armorPenalty: false, trainedOnly: true },
  { name: "Knowledge (Engineering)", ability: "INT", armorPenalty: false, trainedOnly: true },
  { name: "Knowledge (Geography)", ability: "INT", armorPenalty: false, trainedOnly: true },
  { name: "Knowledge (History)", ability: "INT", armorPenalty: false, trainedOnly: true },
  { name: "Knowledge (Local)", ability: "INT", armorPenalty: false, trainedOnly: true },
  { name: "Knowledge (Nature)", ability: "INT", armorPenalty: false, trainedOnly: true },
  { name: "Knowledge (Nobility)", ability: "INT", armorPenalty: false, trainedOnly: true },
  { name: "Knowledge (Planes)", ability: "INT", armorPenalty: false, trainedOnly: true },
  { name: "Knowledge (Religion)", ability: "INT", armorPenalty: false, trainedOnly: true },
  { name: "Linguistics", ability: "INT", armorPenalty: false, trainedOnly: true },
  { name: "Perception", ability: "WIS", armorPenalty: false, trainedOnly: false },
  { name: "Ride", ability: "DEX", armorPenalty: true, trainedOnly: false },
  { name: "Sense Motive", ability: "WIS", armorPenalty: false, trainedOnly: false },
  { name: "Sleight of Hand", ability: "DEX", armorPenalty: true, trainedOnly: true },
  { name: "Spellcraft", ability: "INT", armorPenalty: false, trainedOnly: true },
  { name: "Stealth", ability: "DEX", armorPenalty: true, trainedOnly: false },
  { name: "Survival", ability: "WIS", armorPenalty: false, trainedOnly: false },
  { name: "Swim", ability: "STR", armorPenalty: true, trainedOnly: false },
  { name: "Use Magic Device", ability: "CHA", armorPenalty: false, trainedOnly: true },
];

interface SkillsProps {
  characterId: string;
  characterLevel: number;
  abilityMods: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
  armorCheckPenalty: number;
}

function formatMod(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function Skills({ characterId, characterLevel, abilityMods, armorCheckPenalty }: SkillsProps) {
  const [skills, setSkills] = useState<any[]>([]);
  const [statSources, setStatSources] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [showOnlyTrained, setShowOnlyTrained] = useState(false);
  const [showCustomSkillModal, setShowCustomSkillModal] = useState(false);

  useEffect(() => {
    loadSkills();
  }, [characterId]);

  async function loadSkills() {
    setLoading(true);

    // Load skill ranks
    const { data: skillsData } = await supabase
      .from("character_skills")
      .select("*")
      .eq("character_id", characterId);

    // Load all stat sources for skills
    const { data: sourcesData } = await supabase
      .from("character_stat_sources")
      .select("*")
      .eq("character_id", characterId)
      .like("stat_category", "skill_%")
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

    // Create skill objects combining definition + data
    const skillsList = SKILL_DEFINITIONS.map((def) => {
      const skillData = (skillsData || []).find((s: any) => s.skill_name === def.name);
      return {
        ...def,
        id: skillData?.id,
        ranks: skillData?.ranks || 0,
        isClassSkill: skillData?.is_class_skill || false,
      };
    });

    setSkills(skillsList);
    setLoading(false);
  }

  async function updateSkillRanks(skillName: string, newRanks: number) {
    // Clamp to valid range
    const validRanks = Math.max(0, Math.min(characterLevel, newRanks));

    const existingSkill = skills.find((s) => s.name === skillName);

    if (existingSkill?.id) {
      // Update existing
      await supabase
        .from("character_skills")
        .update({ ranks: validRanks })
        .eq("id", existingSkill.id);
    } else {
      // Insert new
      await supabase.from("character_skills").insert({
        character_id: characterId,
        skill_name: skillName,
        ranks: validRanks,
        is_class_skill: false,
      });
    }

    loadSkills();
  }

  async function toggleClassSkill(skillName: string) {
    const existingSkill = skills.find((s) => s.name === skillName);

    if (existingSkill?.id) {
      // Update existing
      await supabase
        .from("character_skills")
        .update({ is_class_skill: !existingSkill.isClassSkill })
        .eq("id", existingSkill.id);
    } else {
      // Insert new with class skill flag
      await supabase.from("character_skills").insert({
        character_id: characterId,
        skill_name: skillName,
        ranks: 0,
        is_class_skill: true,
      });
    }

    loadSkills();
  }

  function getStatTotal(category: string): number {
    const sources = statSources[category] || [];
    return sources.reduce((sum: number, s: any) => sum + s.bonus_value, 0);
  }

  function calculateSkillTotal(skill: any): number {
    const abilityMod = abilityMods[skill.ability.toLowerCase() as keyof typeof abilityMods];
    const classSkillBonus = skill.isClassSkill && skill.ranks > 0 ? 3 : 0;
    const miscBonus = getStatTotal(`skill_${skill.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`);
    const penalty = skill.armorPenalty ? armorCheckPenalty : 0;

    return skill.ranks + abilityMod + classSkillBonus + miscBonus + penalty;
  }

  const filteredSkills = skills.filter((skill) => {
    const matchesSearch = skill.name.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesTrainedFilter = !showOnlyTrained || skill.ranks > 0;
    return matchesSearch && matchesTrainedFilter;
  });

  if (loading) {
    return <div style={{ padding: "2rem", textAlign: "center" }}>Loading skills...</div>;
  }

  return (
    <div>
      {/* Filters */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", alignItems: "center" }}>
        <input
          type="text"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          placeholder="Search skills..."
          style={{
            flex: 1,
            padding: "0.75rem",
            border: "1px solid #ddd",
            borderRadius: "8px",
            fontSize: "1rem",
          }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={showOnlyTrained}
            onChange={(e) => setShowOnlyTrained(e.target.checked)}
            style={{ width: "18px", height: "18px", cursor: "pointer" }}
          />
          <span>Trained only</span>
        </label>
        <button
          onClick={() => setShowCustomSkillModal(true)}
          style={{
            padding: "0.75rem 1.25rem",
            background: "#10b981",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          + Custom Skill
        </button>
      </div>

      {/* Skills Table */}
      <div style={{ background: "white", border: "1px solid #ddd", borderRadius: "12px", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9fafb", borderBottom: "2px solid #ddd" }}>
              <th style={{ padding: "1rem", textAlign: "left", fontWeight: 600 }}>Skill</th>
              <th style={{ padding: "1rem", textAlign: "center", fontWeight: 600, width: "80px" }}>Total</th>
              <th style={{ padding: "1rem", textAlign: "center", fontWeight: 600, width: "100px" }}>Ranks</th>
              <th style={{ padding: "1rem", textAlign: "center", fontWeight: 600, width: "80px" }}>Class?</th>
              <th style={{ padding: "1rem", textAlign: "center", fontWeight: 600, width: "60px" }}>Ability</th>
              <th style={{ padding: "1rem", textAlign: "left", fontWeight: 600 }}>Breakdown</th>
            </tr>
          </thead>
          <tbody>
            {filteredSkills.map((skill) => {
              const total = calculateSkillTotal(skill);
              const abilityMod = abilityMods[skill.ability.toLowerCase() as keyof typeof abilityMods];
              const classSkillBonus = skill.isClassSkill && skill.ranks > 0 ? 3 : 0;
              const miscBonus = getStatTotal(`skill_${skill.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`);
              const penalty = skill.armorPenalty ? armorCheckPenalty : 0;
              const canUseUntrained = !skill.trainedOnly || skill.ranks > 0;

              return (
                <tr
                  key={skill.name}
                  style={{
                    borderBottom: "1px solid #eee",
                    opacity: canUseUntrained ? 1 : 0.5,
                    background: skill.isClassSkill ? "#f0f9ff" : "white",
                  }}
                >
                  <td style={{ padding: "0.75rem" }}>
                    <div style={{ fontWeight: 600 }}>{skill.name}</div>
                    {skill.trainedOnly && skill.ranks === 0 && (
                      <div style={{ fontSize: "0.8rem", color: "#ef4444" }}>Trained only</div>
                    )}
                  </td>
                  <td style={{ padding: "0.75rem", textAlign: "center" }}>
                    <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0070f3" }}>
                      <StatWithSources
                        characterId={characterId}
                        statCategory={`skill_${skill.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`}
                        displayValue={total}
                        label={skill.name}
                        editable={true}
                      />
                    </div>
                  </td>
                  <td style={{ padding: "0.75rem", textAlign: "center" }}>
                    <input
                      type="number"
                      value={skill.ranks}
                      onChange={(e) => updateSkillRanks(skill.name, parseInt(e.target.value) || 0)}
                      min="0"
                      max={characterLevel}
                      style={{
                        width: "60px",
                        padding: "0.5rem",
                        border: "1px solid #ddd",
                        borderRadius: "6px",
                        textAlign: "center",
                        fontSize: "1rem",
                      }}
                    />
                  </td>
                  <td style={{ padding: "0.75rem", textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={skill.isClassSkill}
                      onChange={() => toggleClassSkill(skill.name)}
                      style={{ width: "20px", height: "20px", cursor: "pointer" }}
                    />
                  </td>
                  <td style={{ padding: "0.75rem", textAlign: "center", fontWeight: 600 }}>
                    {skill.ability}
                  </td>
                  <td style={{ padding: "0.75rem", fontSize: "0.9rem", color: "#666" }}>
                    {skill.ranks} ranks
                    {classSkillBonus > 0 && ` + ${classSkillBonus} class`}
                    {` + ${formatMod(abilityMod)} ${skill.ability}`}
                    {miscBonus !== 0 && ` + ${formatMod(miscBonus)} misc`}
                    {penalty !== 0 && ` ${formatMod(penalty)} ACP`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredSkills.length === 0 && (
        <div style={{ padding: "3rem", textAlign: "center", color: "#999" }}>
          No skills found matching "{searchFilter}"
        </div>
      )}

      {/* Custom Skill Modal */}
      <AddCustomSkillModal
        characterId={characterId}
        isOpen={showCustomSkillModal}
        onClose={() => setShowCustomSkillModal(false)}
        onSkillAdded={loadSkills}
      />
    </div>
  );
}
