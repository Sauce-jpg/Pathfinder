"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { deleteInventoryImage } from "../../../lib/r2Client";
import { DbItem, DbPhoto } from "../types";
import { Modal } from "./Modal";
import styles from "../inventory.module.css";

type Pin = { item_id: string; x: number; y: number };

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
  pins:        Pin[];
};

function draftFromPhoto(p: DbPhoto): Draft {
  return {
    date_taken:  p.date_taken  ?? "",
    location:    p.location    ?? "",
    description: p.description ?? "",
    tags:        (p.tags || []).join(", "),
    item_ids:    p.item_ids    || [],
    pins:        p.pins        || [],
  };
}

// All item IDs connected to a photo (union of item_ids + pinned items)
function allConnectedIds(draft: Draft): string[] {
  const pinned = draft.pins.map((p) => p.item_id);
  return [...new Set([...draft.item_ids, ...pinned])];
}

// Popover for picking an item after clicking the photo
function PinPopover({
  x, y,
  allItems,
  existingItemIds,
  onPick,
  onCancel,
}: {
  x: number; y: number;
  allItems: DbItem[];
  existingItemIds: string[];
  onPick: (itemId: string) => void;
  onCancel: () => void;
}) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = allItems
    .filter((it) => !existingItemIds.includes(it.id))
    .filter((it) =>
      !q.trim() ||
      it.name.toLowerCase().includes(q.toLowerCase()) ||
      (it.category ?? "").toLowerCase().includes(q.toLowerCase())
    )
    .slice(0, 8);

  // Position popover — flip left if too far right, flip up if too far down
  const flipX = x > 65;
  const flipY = y > 65;

  return (
    <div
      style={{
        position: "absolute",
        left:  flipX ? undefined : `${x}%`,
        right: flipX ? `${100 - x}%` : undefined,
        top:   flipY ? undefined : `${y}%`,
        bottom: flipY ? `${100 - y}%` : undefined,
        zIndex: 20,
        background: "#fff",
        border: "1px solid rgba(0,0,0,0.15)",
        borderRadius: 12,
        boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        padding: "0.65rem",
        width: 220,
        color: "#111",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search items…"
        style={{
          width: "100%", padding: "0.35rem 0.55rem",
          border: "1px solid rgba(0,0,0,0.15)", borderRadius: 8,
          fontSize: "0.85rem", marginBottom: "0.45rem",
          boxSizing: "border-box",
        }}
      />
      <div style={{ maxHeight: 180, overflowY: "auto" }}>
        {filtered.length === 0 && (
          <div style={{ opacity: 0.45, fontSize: "0.82rem", padding: "0.25rem 0.1rem" }}>
            No items found
          </div>
        )}
        {filtered.map((it) => (
          <div
            key={it.id}
            onClick={() => onPick(it.id)}
            style={{
              padding: "0.4rem 0.5rem",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: "0.88rem",
              fontWeight: 600,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.05)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            {it.name}
            {it.category && (
              <span style={{ fontWeight: 400, opacity: 0.45, marginLeft: 6, fontSize: "0.78rem" }}>
                {it.category}
              </span>
            )}
          </div>
        ))}
      </div>
      <button
        onClick={onCancel}
        style={{
          marginTop: "0.45rem", width: "100%",
          padding: "0.3rem", border: "none",
          borderRadius: 8, background: "rgba(0,0,0,0.05)",
          cursor: "pointer", fontSize: "0.82rem", opacity: 0.6,
        }}
      >
        Cancel
      </button>
    </div>
  );
}

// The interactive pin canvas — used in both edit and read lightbox
function PinCanvas({
  url,
  pins,
  allItems,
  pinsVisible,
  editable,
  existingItemIds,
  onAddPin,
  onRemovePin,
}: {
  url: string;
  pins: Pin[];
  allItems: DbItem[];
  pinsVisible: boolean;
  editable: boolean;
  existingItemIds: string[];
  onAddPin?: (pin: Pin) => void;
  onRemovePin?: (itemId: string) => void;
}) {
  const [pendingPos, setPendingPos] = useState<{ x: number; y: number } | null>(null);
  const [hoveredPin, setHoveredPin] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function handleImageClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!editable || !onAddPin) return;
    if ((e.target as HTMLElement).closest("[data-pin]")) return;

    const rect = containerRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width)  * 100;
    const y = ((e.clientY - rect.top)  / rect.height) * 100;
    setPendingPos({ x, y });
  }

  function handlePick(itemId: string) {
    if (!pendingPos || !onAddPin) return;
    onAddPin({ item_id: itemId, x: pendingPos.x, y: pendingPos.y });
    setPendingPos(null);
  }

  function itemName(id: string) {
    return allItems.find((x) => x.id === id)?.name ?? id;
  }

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", lineHeight: 0, cursor: editable ? "crosshair" : "default" }}
      onClick={handleImageClick}
    >
      <img
        src={url}
        alt=""
        style={{ width: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: 8 }}
        draggable={false}
      />

      {/* Pins */}
      {pinsVisible && pins.map((pin, idx) => (
        <div
          key={pin.item_id}
          data-pin="true"
          style={{
            position: "absolute",
            left: `${pin.x}%`,
            top:  `${pin.y}%`,
            transform: "translate(-50%, -50%)",
            zIndex: 10,
          }}
          onMouseEnter={() => setHoveredPin(pin.item_id)}
          onMouseLeave={() => setHoveredPin(null)}
        >
          {/* Pin circle */}
          <div
            style={{
              width: 28, height: 28,
              borderRadius: "50%",
              background: "#fff",
              border: "2.5px solid #333",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 800, fontSize: "0.75rem", color: "#333",
              boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
              cursor: editable ? "pointer" : "default",
              userSelect: "none",
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (editable && onRemovePin) onRemovePin(pin.item_id);
            }}
            title={editable ? `${itemName(pin.item_id)} — click to remove` : itemName(pin.item_id)}
          >
            {idx + 1}
          </div>

          {/* Tooltip on hover */}
          {hoveredPin === pin.item_id && (
            <div
              style={{
                position: "absolute",
                bottom: "calc(100% + 6px)",
                left: "50%",
                transform: "translateX(-50%)",
                background: "rgba(0,0,0,0.82)",
                color: "#fff",
                padding: "0.25rem 0.6rem",
                borderRadius: 8,
                fontSize: "0.78rem",
                whiteSpace: "nowrap",
                pointerEvents: "none",
                zIndex: 20,
              }}
            >
              {itemName(pin.item_id)}
            </div>
          )}
        </div>
      ))}

      {/* Pending pin popover */}
      {pendingPos && (
        <div
          style={{
            position: "absolute",
            left: `${pendingPos.x}%`,
            top:  `${pendingPos.y}%`,
            zIndex: 30,
          }}
        >
          <PinPopover
            x={pendingPos.x}
            y={pendingPos.y}
            allItems={allItems}
            existingItemIds={existingItemIds}
            onPick={handlePick}
            onCancel={() => setPendingPos(null)}
          />
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────

export function PhotoModal({
  photo,
  allItems,
  onClose,
  onSaved,
  onDeleted,
  session,
}: Props) {
  const [isEditing,    setIsEditing]    = useState(false);
  const [draft,        setDraft]        = useState<Draft | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [saveError,    setSaveError]    = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [pinsVisible,  setPinsVisible]  = useState(true);
  const [itemSearch,   setItemSearch]   = useState("");

  useEffect(() => {
    if (!photo) {
      setIsEditing(false);
      setDraft(null);
      setSaveError(null);
      setLightboxOpen(false);
      return;
    }
    setIsEditing(false);
    setSaveError(null);
    setItemSearch("");
    setDraft(draftFromPhoto(photo));
  }, [photo?.id]);

  function set(patch: Partial<Draft>) {
    setDraft((d) => d ? { ...d, ...patch } : d);
  }

  function toggleUnpinnedItem(id: string, checked: boolean) {
    setDraft((d) => {
      if (!d) return d;
      const ids = checked
        ? [...d.item_ids, id]
        : d.item_ids.filter((x) => x !== id);
      return { ...d, item_ids: ids };
    });
  }

  function handleAddPin(pin: Pin) {
    setDraft((d) => {
      if (!d) return d;
      // Replace if same item already pinned
      const pins = [...d.pins.filter((p) => p.item_id !== pin.item_id), pin];
      // Remove from flat item_ids if it's being pinned
      const item_ids = d.item_ids.filter((id) => id !== pin.item_id);
      return { ...d, pins, item_ids };
    });
  }

  function handleRemovePin(itemId: string) {
    setDraft((d) => {
      if (!d) return d;
      return { ...d, pins: d.pins.filter((p) => p.item_id !== itemId) };
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
          pins:        draft.pins,
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
    } catch {}
    const { error } = await supabase
      .from("inventory_photos").delete().eq("id", photo.id);
    if (error) { alert(error.message); return; }
    onDeleted();
  }

  function itemName(id: string) {
    return allItems.find((x) => x.id === id)?.name ?? id;
  }

  if (!photo || !draft) return null;

  const pinnedIds    = draft.pins.map((p) => p.item_id);
  const allConnected = allConnectedIds(draft);

  // Items available for checkbox list (not yet pinned)
  const unpinnedConnected = draft.item_ids;

  // Filtered item list for checkbox
  const filteredItems = allItems
    .filter((it) => !pinnedIds.includes(it.id)) // pinned items managed via canvas
    .filter((it) =>
      !itemSearch.trim() ||
      it.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
      (it.category ?? "").toLowerCase().includes(itemSearch.toLowerCase())
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <Modal open={!!photo} onClose={onClose}>
        <div>
          {/* Preview image (click to open lightbox) */}
          <div style={{ position: "relative", marginBottom: "0.85rem" }}>
            <img
              src={photo.url}
              alt={photo.description || ""}
              style={{
                width: "100%", maxHeight: 320,
                objectFit: "cover", borderRadius: 12,
                cursor: "zoom-in", display: "block",
              }}
              onClick={() => setLightboxOpen(true)}
            />
            {/* Pin count badge */}
            {(photo.pins || []).length > 0 && (
              <div
                style={{
                  position: "absolute", bottom: 8, right: 8,
                  background: "rgba(0,0,0,0.6)", color: "#fff",
                  borderRadius: 999, padding: "0.2rem 0.6rem",
                  fontSize: "0.78rem", fontWeight: 700,
                }}
              >
                📍 {photo.pins.length} pin{photo.pins.length === 1 ? "" : "s"} · click to view
              </div>
            )}
          </div>

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

              {/* Metadata fields */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <label>
                  <div style={{ fontSize: "0.8rem", opacity: 0.6, fontWeight: 600, marginBottom: "0.25rem" }}>Date taken</div>
                  <input className={styles.invInput} type="date" value={draft.date_taken}
                    onChange={(e) => set({ date_taken: e.target.value })} style={{ width: "100%" }} />
                </label>
                <label>
                  <div style={{ fontSize: "0.8rem", opacity: 0.6, fontWeight: 600, marginBottom: "0.25rem" }}>Location</div>
                  <input className={styles.invInput} value={draft.location}
                    onChange={(e) => set({ location: e.target.value })}
                    placeholder="e.g. Living room" style={{ width: "100%" }} />
                </label>
              </div>

              <label>
                <div style={{ fontSize: "0.8rem", opacity: 0.6, fontWeight: 600, marginBottom: "0.25rem" }}>Description / caption</div>
                <textarea className={styles.invInput} value={draft.description}
                  onChange={(e) => set({ description: e.target.value })}
                  style={{ width: "100%", minHeight: 60, resize: "vertical" }}
                  placeholder="What's in this photo?" />
              </label>

              <label>
                <div style={{ fontSize: "0.8rem", opacity: 0.6, fontWeight: 600, marginBottom: "0.25rem" }}>Tags (comma separated)</div>
                <input className={styles.invInput} value={draft.tags}
                  onChange={(e) => set({ tags: e.target.value })}
                  placeholder="e.g. bookshelf, living room" style={{ width: "100%" }} />
              </label>

              {/* Pin canvas */}
              <div>
                <div style={{ fontSize: "0.8rem", opacity: 0.6, fontWeight: 600, marginBottom: "0.35rem" }}>
                  📍 Click photo to pin an item
                </div>
                <PinCanvas
                  url={photo.url}
                  pins={draft.pins}
                  allItems={allItems}
                  pinsVisible={true}
                  editable={true}
                  existingItemIds={allConnected}
                  onAddPin={handleAddPin}
                  onRemovePin={handleRemovePin}
                />
                {draft.pins.length > 0 && (
                  <div style={{ marginTop: "0.5rem", fontSize: "0.82rem", opacity: 0.5 }}>
                    Click a pin number to remove it.
                  </div>
                )}
              </div>

              {/* Pinned items legend */}
              {draft.pins.length > 0 && (
                <div>
                  <div style={{ fontSize: "0.8rem", opacity: 0.6, fontWeight: 600, marginBottom: "0.35rem" }}>
                    Pinned items
                  </div>
                  <div style={{ display: "grid", gap: "0.3rem" }}>
                    {draft.pins.map((pin, idx) => (
                      <div key={pin.item_id}
                        style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.88rem" }}>
                        <span style={{
                          width: 22, height: 22, borderRadius: "50%",
                          background: "#fff", border: "2px solid #333",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "0.72rem", fontWeight: 800, flexShrink: 0,
                        }}>{idx + 1}</span>
                        <span style={{ fontWeight: 600 }}>{itemName(pin.item_id)}</span>
                        <button
                          onClick={() => handleRemovePin(pin.item_id)}
                          style={{ marginLeft: "auto", background: "none", border: "none",
                            cursor: "pointer", opacity: 0.4, fontSize: "0.85rem" }}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional items (unpinned) */}
              <div>
                <div style={{ fontSize: "0.8rem", opacity: 0.6, fontWeight: 600, marginBottom: "0.35rem" }}>
                  Connected items (without pin)
                </div>
                <input
                  className={styles.invInput}
                  type="search"
                  placeholder="Search items…"
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  style={{ width: "100%", marginBottom: "0.4rem" }}
                />
                <div style={{
                  maxHeight: 200, overflow: "auto",
                  border: "1px solid rgba(0,0,0,0.12)",
                  borderRadius: 10, padding: "0.5rem 0.65rem",
                }}>
                  {filteredItems.length === 0 && (
                    <div style={{ opacity: 0.4, fontSize: "0.85rem", padding: "0.25rem 0" }}>
                      No items found
                    </div>
                  )}
                  {filteredItems.map((it) => (
                    <label key={it.id}
                      style={{ display: "flex", gap: 10, alignItems: "center",
                        padding: "5px 2px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={unpinnedConnected.includes(it.id)}
                        onChange={(e) => toggleUnpinnedItem(it.id, e.target.checked)}
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
                    <span key={t} style={{
                      fontSize: "0.78rem", padding: "0.2rem 0.5rem",
                      borderRadius: 999, background: "rgba(0,0,0,0.07)",
                    }}>#{t}</span>
                  ))}
                </div>
              )}

              {/* Connected items summary */}
              {!!allConnectedIds(draftFromPhoto(photo)).length && (
                <div>
                  <div style={{ fontWeight: 700, marginBottom: "0.4rem" }}>Connected items</div>
                  <div style={{ display: "grid", gap: "0.4rem" }}>
                    {allConnectedIds(draftFromPhoto(photo)).map((id, idx) => {
                      const pin = (photo.pins || []).find((p) => p.item_id === id);
                      return (
                        <div key={id} style={{
                          padding: "0.5rem 0.75rem",
                          border: "1px solid rgba(0,0,0,0.09)",
                          borderRadius: 10, fontSize: "0.92rem",
                          display: "flex", alignItems: "center", gap: "0.5rem",
                        }}>
                          {pin && (
                            <span style={{
                              width: 20, height: 20, borderRadius: "50%",
                              background: "#fff", border: "2px solid #333",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: "0.68rem", fontWeight: 800, flexShrink: 0,
                            }}>
                              {(photo.pins || []).indexOf(pin) + 1}
                            </span>
                          )}
                          <span style={{ fontWeight: 600 }}>{itemName(id)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {!allConnectedIds(draftFromPhoto(photo)).length && !photo.description && !photo.date_taken && (
                <p style={{ opacity: 0.45 }}>No metadata yet — click Edit to add details.</p>
              )}

              <button
                className={styles.invBtn}
                style={{ justifySelf: "start" }}
                onClick={() => setLightboxOpen(true)}
              >
                🔍 View full size
              </button>
            </div>
          )}
        </div>
      </Modal>

      {/* Lightbox with pins */}
      {lightboxOpen && (
        <div
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.92)",
            zIndex: 300,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            padding: "2rem",
          }}
          onClick={() => setLightboxOpen(false)}
        >
          {/* Lightbox toolbar */}
          <div
            style={{
              position: "fixed", top: "1rem", right: "1rem",
              display: "flex", gap: "0.5rem", zIndex: 301,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPinsVisible((v) => !v)}
              style={{
                padding: "0.4rem 0.85rem", borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.3)",
                background: pinsVisible ? "rgba(255,255,255,0.2)" : "transparent",
                color: "#fff", cursor: "pointer", fontSize: "0.85rem",
                fontWeight: 600, transition: "background 0.15s",
              }}
            >
              {pinsVisible ? "📍 Hide pins" : "📍 Show pins"}
            </button>
            <button
              onClick={() => setLightboxOpen(false)}
              style={{
                width: 36, height: 36, borderRadius: 999,
                border: "none", background: "rgba(255,255,255,0.15)",
                color: "#fff", fontSize: "1rem", cursor: "pointer",
                display: "grid", placeItems: "center",
              }}
            >✕</button>
          </div>

          {/* Pin canvas (read-only in lightbox) */}
          <div
            style={{ maxWidth: "90vw", maxHeight: "80vh", position: "relative" }}
            onClick={(e) => e.stopPropagation()}
          >
            <PinCanvas
              url={photo.url}
              pins={photo.pins || []}
              allItems={allItems}
              pinsVisible={pinsVisible}
              editable={false}
              existingItemIds={[]}
            />
          </div>

          {/* Pin legend below image */}
          {pinsVisible && (photo.pins || []).length > 0 && (
            <div
              style={{
                marginTop: "1rem", display: "flex", gap: "0.75rem",
                flexWrap: "wrap", justifyContent: "center",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {photo.pins.map((pin, idx) => (
                <div key={pin.item_id}
                  style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#fff" }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: "50%",
                    background: "#fff", color: "#333",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.72rem", fontWeight: 800, flexShrink: 0,
                  }}>{idx + 1}</span>
                  <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                    {itemName(pin.item_id)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
