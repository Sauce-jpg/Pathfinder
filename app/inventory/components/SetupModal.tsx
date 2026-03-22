"use client";

import { useState } from "react";
import styles from "../inventory.module.css";
import { DbItem, DbSetup } from "../types";
import { Modal } from "./Modal";
import { supabase } from "../../../lib/supabaseClient";

type Props = {
  open: boolean;
  setups: DbSetup[];
  allItems: DbItem[];
  onClose: () => void;
  onSaved: (newSetupId: string) => void;
  session: any;
};

export function SetupModal({ open, setups, allItems, onClose, onSaved, session }: Props) {
  const [draft, setDraft]         = useState({ name: "", description: "", parent_setup_id: "" });
  const [selectedIds, setSelected] = useState<string[]>([]);
  const [saving, setSaving]        = useState(false);

  function set(patch: Partial<typeof draft>) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  function toggleItem(id: string, checked: boolean) {
    setSelected((prev) =>
      checked ? [...prev, id] : prev.filter((x) => x !== id)
    );
  }

  async function handleCreate() {
    if (!session?.user?.id) return;
    const name = draft.name.trim();
    if (!name) { alert("Setup name is required."); return; }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("inventory_setups")
        .insert({
          user_id:         session.user.id,
          name,
          description:     draft.description.trim() || null,
          parent_setup_id: draft.parent_setup_id    || null,
        })
        .select("id")
        .single();

      if (error) throw new Error(error.message);
      const setupId = data.id as string;

      if (selectedIds.length) {
        const rows = selectedIds.map((itemId, idx) => ({
          user_id:                  session.user.id,
          setup_id:                 setupId,
          item_id:                  itemId,
          position:                 idx + 1,
          include_in_parent_summary: false,
        }));
        const ins = await supabase.from("inventory_setup_items").insert(rows);
        if (ins.error) alert("Setup created, but adding items failed: " + ins.error.message);
      }

      // Reset
      setDraft({ name: "", description: "", parent_setup_id: "" });
      setSelected([]);
      onSaved(setupId);
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setDraft({ name: "", description: "", parent_setup_id: "" });
    setSelected([]);
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose}>
      <div>
        <h2 style={{ marginTop: 0 }}>Create setup</h2>

        <div style={{ display: "grid", gap: "0.75rem" }}>
          <label>
            <div className={styles.muted}>Name</div>
            <input
              className={styles.invInput}
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder='e.g. "Desk / PC Setup"'
            />
          </label>

          <label>
            <div className={styles.muted}>Description</div>
            <input
              className={styles.invInput}
              value={draft.description}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="Optional"
            />
          </label>

          <label>
            <div className={styles.muted}>Parent setup (optional)</div>
            <select
              className={styles.invSelect}
              value={draft.parent_setup_id}
              onChange={(e) => set({ parent_setup_id: e.target.value })}
            >
              <option value="">None (top-level)</option>
              {setups.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>

          <div>
            <div className={styles.muted} style={{ marginBottom: "0.35rem" }}>
              Add items to this setup
            </div>
            <div
              style={{
                maxHeight: 240,
                overflow: "auto",
                border: "1px solid rgba(0,0,0,0.12)",
                borderRadius: 12,
                padding: 10,
              }}
            >
              {allItems
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((it) => (
                  <label
                    key={it.id}
                    style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 4px" }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(it.id)}
                      onChange={(e) => toggleItem(it.id, e.target.checked)}
                    />
                    <span style={{ fontWeight: 700 }}>{it.name}</span>
                    {it.model && (
                      <span className={styles.muted} style={{ fontSize: "0.9rem" }}>
                        · {it.model}
                      </span>
                    )}
                  </label>
                ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button className={styles.invBtn} onClick={handleCreate} disabled={saving}>
              {saving ? "Creating…" : "Create setup"}
            </button>
            <button className={styles.invBtn} onClick={handleClose} disabled={saving}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
