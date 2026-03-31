"use client";

import { useState } from "react";
import styles from "../inventory.module.css";
import { DbItem } from "../types";
import { Modal } from "./Modal";
import { supabase } from "../../../lib/supabaseClient";

type Props = {
  open: boolean;
  sourceItem: DbItem | null;
  allItems: DbItem[];
  onClose: () => void;
  onSaved: () => void;
  session: any;
};

const RELATION_TYPES = [
  "installed_in",
  "uses",
  "painted_with",
  "replaces",
  "compatible_with",
  "originates_from",
];

export function LinkModal({ open, sourceItem, allItems, onClose, onSaved, session }: Props) {
  const [draft, setDraft] = useState({
    relation_type: "installed_in",
    to_item_id:    "",
    note:          "",
    meta_json:     "{}",
  });
  const [saving, setSaving] = useState(false);

  function set(patch: Partial<typeof draft>) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  async function handleCreate() {
    if (!session?.user?.id || !sourceItem) return;
    if (!draft.to_item_id) { alert("Pick a target item."); return; }

    let metaObj: any = {};
    try {
      metaObj = draft.meta_json ? JSON.parse(draft.meta_json) : {};
    } catch {
      alert("Meta JSON is invalid.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("inventory_item_links").insert({
        user_id:       session.user.id,
        from_item_id:  sourceItem.id,
        to_item_id:    draft.to_item_id,
        relation_type: draft.relation_type.trim(),
        note:          draft.note.trim() || null,
        meta:          metaObj,
      });
      if (error) throw new Error(error.message);

      setDraft({ relation_type: "installed_in", to_item_id: "", note: "", meta_json: "{}" });
      onSaved();
      onClose();
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div>
        <h2 style={{ marginTop: 0 }}>Create relationship</h2>

        <div style={{ display: "grid", gap: "0.75rem" }}>
          <label>
            <div className={styles.muted}>Type</div>
            <select
              className={styles.invSelect}
              value={draft.relation_type}
              onChange={(e) => set({ relation_type: e.target.value })}
            >
              {RELATION_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>

          <label>
            <div className={styles.muted}>Target item</div>
            <select
              className={styles.invSelect}
              value={draft.to_item_id}
              onChange={(e) => set({ to_item_id: e.target.value })}
            >
              <option value="">Select…</option>
              {allItems
                .filter((x) => x.id !== sourceItem?.id)
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} ({it.id})
                  </option>
                ))}
            </select>
          </label>

          <label>
            <div className={styles.muted}>Note (optional)</div>
            <input
              className={styles.invInput}
              value={draft.note}
              onChange={(e) => set({ note: e.target.value })}
              placeholder='e.g. "Installed in M.2 slot 2"'
            />
          </label>

          <label>
            <div className={styles.muted}>Meta (JSON, optional)</div>
            <textarea
              className={styles.invInput}
              style={{
                minHeight: 140,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              }}
              value={draft.meta_json}
              onChange={(e) => set({ meta_json: e.target.value })}
            />
          </label>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button className={styles.invBtn} onClick={handleCreate} disabled={saving}>
              {saving ? "Creating…" : "Create link"}
            </button>
            <button className={styles.invBtn} onClick={onClose} disabled={saving}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
