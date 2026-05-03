"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { deleteInventoryImage } from "../../../lib/r2Client";
import { DbItem, DbPhoto } from "../types";
import { Modal } from "./Modal";
import styles from "../inventory.module.css";

type Props = {
  photo: DbPhoto | null;
  allItems: DbItem[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  onDeleted: () => void;
  session: any;
};

type Draft = {
  date_taken:  string;
  location:    string;
  description: string;
  tags:        string;
  item_ids:    string[];
};

function draftFromPhoto(p: DbPhoto): Draft {
  return {
    date_taken:  p.date_taken  ?? "",
    location:    p.location    ?? "",
    description: p.description ?? "",
    tags:        (p.tags || []).join(", "),
    item_ids:    p.item_ids    || [],
  };
}

export function PhotoModal({
  photo,
  allItems,
  onClose,
  onSaved,
  onDeleted,
  session,
}: Props) {
  const [isEditing,   setIsEditing]   = useState(false);
  const [draft,       setDraft]       = useState<Draft | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (!photo) {
      setIsEditing(false);
      setDraft(null);
      setSaveError(null);
      return;
    }
    setIsEditing(false);
    setSaveError(null);
    setDraft(draftFromPhoto(photo));
  }, [photo?.id]);

  function set(patch: Partial<Draft>) {
    setDraft((d) => d ? { ...d, ...patch } : d);
  }

  function toggleItem(id: string, checked: boolean) {
    setDraft((d) => {
      if (!d) return d;
      const ids = checked
        ? [...d.item_ids, id]
        : d.item_ids.filter((x) => x !== id);
      return { ...d, item_ids: ids };
    });
  }

  async function handleSave() {
    if (!photo || !draft) return;
    setSaving(true);
    setSaveError(null);
    try {
      const { error } = await supabase
        .from("inventory_photos")
        .update({
          date_taken:  draft.date_taken  || null,
          location:    draft.location    || null,
          description: draft.description || null,
          tags:        draft.tags.split(",").map((t) => t.trim()).filter(Boolean),
          item_ids:    draft.item_ids,
          updated_at:  new Date().toISOString(),
        })
        .eq("id", photo.id);

      if (error) throw new Error(error.message);
      setIsEditing(false);
      await onSaved();
    } catch (e: any) {
      setSaveError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!photo) return;
    if (!confirm("Delete this photo? This cannot be undone.")) return;

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token ?? "";
      await deleteInventoryImage(photo.url, token);
    } catch {
      // If R2 delete fails, still remove from DB
    }

    const { error } = await supabase
      .from("inventory_photos")
      .delete()
      .eq("id", photo.id);

    if (error) { alert(error.message); return; }
    onDeleted();
  }

  function itemName(id: string) {
    return allItems.find((x) => x.id === id)?.name ?? id;
  }

  return (
    <>
      <Modal open={!!photo} onClose={onClose}>
        {photo && draft && (
          <div>
            {/* Image */}
            <img
              src={photo.url}
              alt={photo.description || ""}
              style={{
                width: "100%",
                maxHeight: 380,
                objectFit: "cover",
                borderRadius: 12,
                marginBottom: "0.85rem",
                cursor: "zoom-in",
              }}
              onClick={() => setLightboxOpen(true)}
            />

            {/* Action bar */}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.85rem" }}>
              <button className={styles.invBtn} onClick={() => setIsEditing((v) => !v)}>
                {isEditing ? "Cancel" : "Edit"}
              </button>
              {isEditing && (
                <button className={styles.invBtn} onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </button>
              )}
              <button className={styles.invBtn} onClick={handleDelete}>
                🗑 Delete photo
              </button>
              {saveError && (
                <span style={{ color: "crimson", alignSelf: "center", fontSize: "0.88rem" }}>
                  {saveError}
                </span>
              )}
            </div>

            {isEditing ? (
              /* ── Edit mode ── */
              <div style={{ display: "grid", gap: "0.75rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <label>
                    <div style={{ fontSize: "0.8rem", opacity: 0.6, fontWeight: 600, marginBottom: "0.25rem" }}>
                      Date taken
                    </div>
                    <input
                      className={styles.invInput}
                      type="date"
                      value={draft.date_taken}
                      onChange={(e) => set({ date_taken: e.target.value })}
                      style={{ width: "100%" }}
                    />
                  </label>
                  <label>
                    <div style={{ fontSize: "0.8rem", opacity: 0.6, fontWeight: 600, marginBottom: "0.25rem" }}>
                      Location
                    </div>
                    <input
                      className={styles.invInput}
                      value={draft.location}
                      onChange={(e) => set({ location: e.target.value })}
                      placeholder="e.g. Living room"
                      style={{ width: "100%" }}
                    />
                  </label>
                </div>

                <label>
                  <div style={{ fontSize: "0.8rem", opacity: 0.6, fontWeight: 600, marginBottom: "0.25rem" }}>
                    Description / caption
                  </div>
                  <textarea
                    className={styles.invInput}
                    value={draft.description}
                    onChange={(e) => set({ description: e.target.value })}
                    style={{ width: "100%", minHeight: 70, resize: "vertical" }}
                    placeholder="What's in this photo?"
                  />
                </label>

                <label>
                  <div style={{ fontSize: "0.8rem", opacity: 0.6, fontWeight: 600, marginBottom: "0.25rem" }}>
                    Tags (comma separated)
                  </div>
                  <input
                    className={styles.invInput}
                    value={draft.tags}
                    onChange={(e) => set({ tags: e.target.value })}
                    placeholder="e.g. bookshelf, living room"
                    style={{ width: "100%" }}
                  />
                </label>

                <div>
                  <div style={{ fontSize: "0.8rem", opacity: 0.6, fontWeight: 600, marginBottom: "0.35rem" }}>
                    Connected items
                  </div>
                  <div
                    style={{
                      maxHeight: 220,
                      overflow: "auto",
                      border: "1px solid rgba(0,0,0,0.12)",
                      borderRadius: 10,
                      padding: "0.5rem 0.65rem",
                    }}
                  >
                    {allItems
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((it) => (
                        <label
                          key={it.id}
                          style={{
                            display: "flex", gap: 10,
                            alignItems: "center", padding: "5px 2px",
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={draft.item_ids.includes(it.id)}
                            onChange={(e) => toggleItem(it.id, e.target.checked)}
                          />
                          <span style={{ fontWeight: 600 }}>{it.name}</span>
                          {it.category && (
                            <span style={{ opacity: 0.45, fontSize: "0.85rem" }}>{it.category}</span>
                          )}
                        </label>
                      ))}
                  </div>
                </div>
              </div>
            ) : (
              /* ── Read mode ── */
              <div style={{ display: "grid", gap: "0.6rem" }}>
                {photo.date_taken && (
                  <div>
                    <span style={{ opacity: 0.55, fontWeight: 600, fontSize: "0.85rem" }}>Date: </span>
                    {photo.date_taken}
                  </div>
                )}
                {photo.location && (
                  <div>
                    <span style={{ opacity: 0.55, fontWeight: 600, fontSize: "0.85rem" }}>Location: </span>
                    📍 {photo.location}
                  </div>
                )}
                {photo.description && (
                  <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                    {photo.description}
                  </p>
                )}
                {!!(photo.tags || []).length && (
                  <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                    {photo.tags.map((t) => (
                      <span
                        key={t}
                        style={{
                          fontSize: "0.78rem", padding: "0.2rem 0.5rem",
                          borderRadius: 999, background: "rgba(0,0,0,0.07)",
                        }}
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}

                {!!(photo.item_ids || []).length && (
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: "0.4rem" }}>
                      Connected items
                    </div>
                    <div style={{ display: "grid", gap: "0.4rem" }}>
                      {photo.item_ids.map((id) => (
                        <div
                          key={id}
                          style={{
                            padding: "0.5rem 0.75rem",
                            border: "1px solid rgba(0,0,0,0.09)",
                            borderRadius: 10,
                            fontSize: "0.92rem",
                            fontWeight: 600,
                          }}
                        >
                          {itemName(id)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!(photo.item_ids || []).length && !photo.description && !photo.date_taken && (
                  <p style={{ opacity: 0.45 }}>No metadata yet — click Edit to add details.</p>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Lightbox */}
      {lightboxOpen && photo && (
        <div
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.9)",
            zIndex: 300,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "2rem",
            cursor: "zoom-out",
          }}
          onClick={() => setLightboxOpen(false)}
        >
          <button
            style={{
              position: "fixed", top: "1.25rem", right: "1.25rem",
              width: 36, height: 36, borderRadius: 999,
              border: "none", background: "rgba(255,255,255,0.15)",
              color: "#fff", fontSize: "1rem", cursor: "pointer",
              display: "grid", placeItems: "center",
            }}
            onClick={() => setLightboxOpen(false)}
          >✕</button>
          <img
            src={photo.url}
            alt={photo.description || ""}
            style={{
              maxWidth: "100%", maxHeight: "90vh",
              borderRadius: 8, objectFit: "contain",
              boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
              cursor: "default",
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
