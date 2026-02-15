"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { SpellBrowser } from "./SpellBrowser";
import { SpellCard } from "./SpellCard";
import { AddSpellcastingClassModal } from "./AddSpellcastingClassModal";

interface SpellsProps {
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
}

interface SpellcastingClass {
  id: string;
  class_name: string;
  casting_type: 'spontaneous' | 'prepared';
  spellcasting_ability: string;
  caster_level: number;
  concentration_bonus: number;
  base_spell_dc: number;
  notes: string;
}

interface SpellSlot {
  id: string;
  spell_level: number;
  slots_total: number;
  slots_used: number;
}

interface SpellKnown {
  id: string;
  spell_name: string;
  spell_level: number;
  school: string;
  spell_data: any;
  source: string;
  is_active: boolean;
}

interface PreparedSpell {
  id: string;
  spell_known_id: string;
  spell_level: number;
  is_cast: boolean;
  spell_known: SpellKnown;
}

export function Spells({ characterId, characterLevel, abilityMods }: SpellsProps) {
  const [classes, setClasses] = useState<SpellcastingClass[]>([]);
  const [activeClass, setActiveClass] = useState<SpellcastingClass | null>(null);
  const [spellsKnown, setSpellsKnown] = useState<SpellKnown[]>([]);
  const [spellsPrepared, setSpellsPrepared] = useState<PreparedSpell[]>([]);
  const [spellSlots, setSpellSlots] = useState<SpellSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBrowser, setShowBrowser] = useState(false);
  const [browserSpellLevel, setBrowserSpellLevel] = useState<number | null>(null);
  const [showAddClassModal, setShowAddClassModal] = useState(false);

  // Load spellcasting classes
  useEffect(() => {
    loadClasses();
  }, [characterId]);

  // Load data when active class changes
  useEffect(() => {
    if (activeClass) {
      loadSpellData();
    }
  }, [activeClass]);

  async function loadClasses() {
    setLoading(true);
    const { data } = await supabase
      .from("character_spellcasting_classes")
      .select("*")
      .eq("character_id", characterId)
      .order("class_name");

    if (data && data.length > 0) {
      setClasses(data as SpellcastingClass[]);
      setActiveClass(data[0] as SpellcastingClass);
    }
    setLoading(false);
  }

  async function loadSpellData() {
    if (!activeClass) return;

    // Load spells known
    const { data: knownData } = await supabase
      .from("character_spells_known")
      .select("*")
      .eq("spellcasting_class_id", activeClass.id)
      .order("spell_level")
      .order("spell_name");

    setSpellsKnown((knownData || []) as SpellKnown[]);

    // Load spell slots
    const { data: slotsData } = await supabase
      .from("character_spell_slots")
      .select("*")
      .eq("spellcasting_class_id", activeClass.id)
      .order("spell_level");

    setSpellSlots((slotsData || []) as SpellSlot[]);

    // Load prepared spells (if prepared caster)
    if (activeClass.casting_type === "prepared") {
      const { data: preparedData } = await supabase
        .from("character_spells_prepared")
        .select(`
          id,
          spell_known_id,
          spell_level,
          is_cast,
          spell_known:character_spells_known(*)
        `)
        .eq("spellcasting_class_id", activeClass.id);

      setSpellsPrepared((preparedData || []) as any);
    }
  }

  async function useSpellSlot(spellLevel: number) {
    const slot = spellSlots.find((s) => s.spell_level === spellLevel);
    if (!slot || slot.slots_used >= slot.slots_total) return;

    await supabase
      .from("character_spell_slots")
      .update({ slots_used: slot.slots_used + 1 })
      .eq("id", slot.id);

    loadSpellData();
  }

  async function restoreSpellSlot(spellLevel: number) {
    const slot = spellSlots.find((s) => s.spell_level === spellLevel);
    if (!slot || slot.slots_used === 0) return;

    await supabase
      .from("character_spell_slots")
      .update({ slots_used: slot.slots_used - 1 })
      .eq("id", slot.id);

    loadSpellData();
  }

  async function resetAllSlots() {
    if (!confirm("Reset all spell slots for this class?")) return;

    await supabase
      .from("character_spell_slots")
      .update({ slots_used: 0 })
      .eq("spellcasting_class_id", activeClass!.id);

    // Also reset prepared spells
    if (activeClass!.casting_type === "prepared") {
      await supabase
        .from("character_spells_prepared")
        .update({ is_cast: false })
        .eq("spellcasting_class_id", activeClass!.id);
    }

    loadSpellData();
  }

  async function addSpellToKnown(spell: any) {
    if (!activeClass) return;

    const spellLevel = spell.level[activeClass.class_name];
    if (spellLevel === undefined) {
      alert(`This spell is not available to ${activeClass.class_name}`);
      return;
    }

    const { error } = await supabase.from("character_spells_known").insert({
      character_id: characterId,
      spellcasting_class_id: activeClass.id,
      spell_name: spell.name,
      spell_level: spellLevel,
      school: spell.school,
      spell_data: spell,
      source: "Added manually",
      is_active: true,
    });

    if (error) {
      alert("Error adding spell: " + error.message);
    } else {
      setShowBrowser(false);
      loadSpellData();
    }
  }

  async function removeSpellFromKnown(spellId: string) {
    if (!confirm("Remove this spell?")) return;

    await supabase.from("character_spells_known").delete().eq("id", spellId);
    loadSpellData();
  }

  async function prepareSpell(spellKnownId: string, spellLevel: number) {
    const slot = spellSlots.find((s) => s.spell_level === spellLevel);
    const preparedCount = spellsPrepared.filter(
      (p) => p.spell_level === spellLevel && !p.is_cast
    ).length;

    if (preparedCount >= (slot?.slots_total || 0)) {
      alert(`All level ${spellLevel} slots are already prepared!`);
      return;
    }

    await supabase.from("character_spells_prepared").insert({
      character_id: characterId,
      spellcasting_class_id: activeClass!.id,
      spell_known_id: spellKnownId,
      spell_level: spellLevel,
      is_cast: false,
    });

    loadSpellData();
  }

  async function unprepareSpell(preparedId: string) {
    await supabase.from("character_spells_prepared").delete().eq("id", preparedId);
    loadSpellData();
  }

  async function castPreparedSpell(preparedId: string) {
    await supabase
      .from("character_spells_prepared")
      .update({ is_cast: true })
      .eq("id", preparedId);

    loadSpellData();
  }

  if (loading) {
    return <div style={{ padding: "2rem", textAlign: "center" }}>Loading spells...</div>;
  }

  if (classes.length === 0) {
    return (
      <div style={{ padding: "2rem" }}>
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "12px", padding: "2rem", marginBottom: "2rem" }}>
          <h3 style={{ marginTop: 0, color: "#16a34a" }}>No Spellcasting Classes</h3>
          <p style={{ color: "#666", marginBottom: "1.5rem" }}>
            Add your first spellcasting class (Oracle, Wizard, Cleric, etc.) to start managing spells!
          </p>
          <button
            onClick={() => setShowAddClassModal(true)}
            style={{
              padding: "0.75rem 1.5rem",
              background: "#8b5cf6",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "1rem",
            }}
          >
            + Add Spellcasting Class
          </button>
        </div>

        {/* Add Class Modal */}
        <AddSpellcastingClassModal
          characterId={characterId}
          characterLevel={characterLevel}
          abilityMods={abilityMods}
          isOpen={showAddClassModal}
          onClose={() => setShowAddClassModal(false)}
          onClassAdded={() => {
            setShowAddClassModal(false);
            loadClasses();
          }}
        />
      </div>
    );
  }

  const abilityMod =
    abilityMods[activeClass!.spellcasting_ability.toLowerCase() as keyof typeof abilityMods];

  return (
    <div>
      {/* Class Tabs */}
      <div style={{ borderBottom: "2px solid #ddd", marginBottom: "2rem" }}>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "1rem" }}>
            {classes.map((cls) => (
              <button
                key={cls.id}
                onClick={() => setActiveClass(cls)}
                style={{
                  padding: "0.75rem 1.5rem",
                  background: activeClass?.id === cls.id ? "#8b5cf6" : "transparent",
                  color: activeClass?.id === cls.id ? "white" : "#8b5cf6",
                  border: `2px solid #8b5cf6`,
                  borderBottom: activeClass?.id === cls.id ? "none" : `2px solid #8b5cf6`,
                  borderRadius: "8px 8px 0 0",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {cls.class_name}
                <span style={{ fontSize: "0.85rem", marginLeft: "0.5rem", opacity: 0.8 }}>
                  (CL {cls.caster_level})
                </span>
              </button>
            ))}
          </div>
          
          <button
            onClick={() => setShowAddClassModal(true)}
            style={{
              padding: "0.5rem 1rem",
              background: "#10b981",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: 600,
            }}
          >
            + Add Class
          </button>
        </div>
      </div>

      {/* Add Class Modal */}
      <AddSpellcastingClassModal
        characterId={characterId}
        characterLevel={characterLevel}
        abilityMods={abilityMods}
        isOpen={showAddClassModal}
        onClose={() => setShowAddClassModal(false)}
        onClassAdded={() => {
          setShowAddClassModal(false);
          loadClasses();
        }}
      />

      {/* Class Info */}
      <div
        style={{
          background: "#f0fdf4",
          padding: "1rem",
          borderRadius: "8px",
          marginBottom: "1.5rem",
          display: "flex",
          gap: "2rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <strong>Type:</strong> {activeClass!.casting_type === "spontaneous" ? "Spontaneous" : "Prepared"}
        </div>
        <div>
          <strong>Ability:</strong> {activeClass!.spellcasting_ability}
        </div>
        <div>
          <strong>Spell DC:</strong> {activeClass!.base_spell_dc} + spell level + {abilityMod}
        </div>
        <div>
          <strong>Concentration:</strong> +{activeClass!.caster_level + abilityMod}
        </div>
        {activeClass!.notes && (
          <div>
            <strong>Notes:</strong> {activeClass!.notes}
          </div>
        )}
      </div>

      {/* Spell Slots */}
      <div style={{ background: "white", border: "1px solid #ddd", borderRadius: "12px", padding: "1.5rem", marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h3 style={{ margin: 0 }}>Spell Slots</h3>
          <button
            onClick={resetAllSlots}
            style={{
              padding: "0.5rem 1rem",
              background: "#10b981",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.9rem",
            }}
          >
            🌙 Rest (Reset All)
          </button>
        </div>

        <div style={{ display: "grid", gap: "0.75rem" }}>
          {spellSlots.map((slot) => {
            const available = slot.slots_total - slot.slots_used;
            const isCantrip = slot.spell_level === 0;

            return (
              <div
                key={slot.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  padding: "0.75rem",
                  background: "#f9fafb",
                  borderRadius: "8px",
                }}
              >
                <div style={{ minWidth: "60px", fontWeight: 600 }}>
                  {slot.spell_level === 0 ? "Cantrips" : `Level ${slot.spell_level}`}
                </div>

                {isCantrip ? (
                  <div style={{ fontSize: "1.5rem" }}>∞</div>
                ) : (
                  <>
                    <div style={{ flex: 1, display: "flex", gap: "0.25rem" }}>
                      {Array.from({ length: slot.slots_total }).map((_, i) => (
                        <div
                          key={i}
                          onClick={() => {
                            if (i < slot.slots_used) restoreSpellSlot(slot.spell_level);
                            else useSpellSlot(slot.spell_level);
                          }}
                          style={{
                            width: "24px",
                            height: "24px",
                            borderRadius: "50%",
                            background: i < slot.slots_used ? "#6b7280" : "#8b5cf6",
                            cursor: "pointer",
                            transition: "transform 0.1s",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.2)")}
                          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                        />
                      ))}
                    </div>

                    <div style={{ fontSize: "0.9rem", color: "#666", minWidth: "80px", textAlign: "right" }}>
                      {available} / {slot.slots_total} left
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Spells Section */}
      <div style={{ display: "grid", gridTemplateColumns: activeClass!.casting_type === "prepared" ? "1fr 1fr" : "1fr", gap: "2rem" }}>
        {/* Spells Known / Spellbook */}
        <div style={{ background: "white", border: "1px solid #ddd", borderRadius: "12px", padding: "1.5rem" }}>
          <h3 style={{ marginTop: 0 }}>
            {activeClass!.casting_type === "spontaneous" ? "Spells Known" : "Spellbook"}
          </h3>

          <button
            onClick={() => {
              setBrowserSpellLevel(null);
              setShowBrowser(true);
            }}
            style={{
              width: "100%",
              padding: "0.75rem",
              background: "#8b5cf6",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 600,
              marginBottom: "1rem",
            }}
          >
            + Add Spell from Database
          </button>

          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => {
            const levelSpells = spellsKnown.filter((s) => s.spell_level === level && s.is_active);
            if (levelSpells.length === 0) return null;

            return (
              <div key={level} style={{ marginBottom: "1.5rem" }}>
                <h4 style={{ margin: "0 0 0.75rem 0", color: "#8b5cf6" }}>
                  {level === 0 ? "Cantrips" : `Level ${level}`} ({levelSpells.length})
                </h4>
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  {levelSpells.map((spell) => (
                    <SpellCard
                      key={spell.id}
                      spell={spell}
                      onRemove={() => removeSpellFromKnown(spell.id)}
                      onPrepare={
                        activeClass!.casting_type === "prepared"
                          ? () => prepareSpell(spell.id, spell.spell_level)
                          : undefined
                      }
                      spellDC={activeClass!.base_spell_dc + spell.spell_level + abilityMod}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {spellsKnown.filter((s) => s.is_active).length === 0 && (
            <div style={{ padding: "2rem", textAlign: "center", color: "#999" }}>
              No spells {activeClass!.casting_type === "spontaneous" ? "known" : "in spellbook"} yet.
              <br />
              Click "Add Spell" above to browse the spell database!
            </div>
          )}
        </div>

        {/* Prepared Spells (Prepared casters only) */}
        {activeClass!.casting_type === "prepared" && (
          <div style={{ background: "white", border: "1px solid #ddd", borderRadius: "12px", padding: "1.5rem" }}>
            <h3 style={{ marginTop: 0 }}>Prepared Today</h3>

            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => {
              const levelPrepared = spellsPrepared.filter((p) => p.spell_level === level);
              const slot = spellSlots.find((s) => s.spell_level === level);
              if (!slot) return null;

              return (
                <div key={level} style={{ marginBottom: "1.5rem" }}>
                  <h4 style={{ margin: "0 0 0.75rem 0", color: "#8b5cf6" }}>
                    {level === 0 ? "Cantrips" : `Level ${level}`}{" "}
                    <span style={{ fontSize: "0.85rem", color: "#666" }}>
                      ({levelPrepared.filter((p) => !p.is_cast).length} / {slot.slots_total} prepared)
                    </span>
                  </h4>

                  {levelPrepared.length === 0 ? (
                    <div style={{ padding: "1rem", background: "#f9fafb", borderRadius: "6px", fontSize: "0.9rem", color: "#999" }}>
                      No spells prepared at this level
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: "0.5rem" }}>
                      {levelPrepared.map((prep) => (
                        <div
                          key={prep.id}
                          style={{
                            padding: "0.75rem",
                            background: prep.is_cast ? "#f3f4f6" : "#f0fdf4",
                            border: `1px solid ${prep.is_cast ? "#d1d5db" : "#86efac"}`,
                            borderRadius: "6px",
                            opacity: prep.is_cast ? 0.6 : 1,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div style={{ fontWeight: 600, textDecoration: prep.is_cast ? "line-through" : "none" }}>
                                {prep.spell_known.spell_name}
                              </div>
                              <div style={{ fontSize: "0.85rem", color: "#666" }}>
                                {prep.spell_known.school}
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                              {!prep.is_cast && (
                                <button
                                  onClick={() => castPreparedSpell(prep.id)}
                                  style={{
                                    padding: "0.25rem 0.75rem",
                                    background: "#8b5cf6",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    fontSize: "0.85rem",
                                  }}
                                >
                                  Cast
                                </button>
                              )}
                              <button
                                onClick={() => unprepareSpell(prep.id)}
                                style={{
                                  padding: "0.25rem 0.75rem",
                                  background: "#ef4444",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                  fontSize: "0.85rem",
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Spell Browser Modal */}
      {showBrowser && (
        <SpellBrowser
          onClose={() => setShowBrowser(false)}
          onAddSpell={addSpellToKnown}
          className={activeClass!.class_name}
          filterLevel={browserSpellLevel}
        />
      )}
    </div>
  );
}
