"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { DbItem, DbOrderMeta } from "../types";
import { Modal } from "./Modal";
import styles from "../inventory.module.css";

type Order = {
  orderId:  string;
  store:    string;
  date:     string;
  orderRef: string;
  currency: string;
  total:    number;
  items:    DbItem[];
};

type ExtraCost = {
  label:    string;
  amount:   string;
  currency: string;
};

type Props = {
  order:           Order | null;
  orderMeta:       DbOrderMeta | null;
  onClose:         () => void;
  onFilterByOrder: (orderId: string) => void;
  onSelectItem:    (id: string) => void;
  onMetaSaved:     () => void;
  session:         any;
};

function fileLabel(url: string): string {
  try {
    const parts = new URL(url).pathname.split("/");
    return decodeURIComponent(parts[parts.length - 1]);
  } catch {
    return url;
  }
}

function isImage(url: string): boolean {
  return /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url);
}

function isPdf(url: string): boolean {
  return /\.pdf(\?|$)/i.test(url);
}

async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

export function OrderModal({
  order,
  orderMeta,
  onClose,
  onFilterByOrder,
  onSelectItem,
  onMetaSaved,
  session,
}: Props) {
  const [isEditing,    setIsEditing]    = useState(false);
  const [extraCosts,   setExtraCosts]   = useState<ExtraCost[]>([]);
  const [notes,        setNotes]        = useState("");
  const [saving,       setSaving]       = useState(false);
  const [saveError,    setSaveError]    = useState<string | null>(null);
  const [uploading,    setUploading]    = useState(false);
  const [uploadError,  setUploadError]  = useState<string | null>(null);
  const [documents,    setDocuments]    = useState<string[]>([]);
  const [deletingDoc,  setDeletingDoc]  = useState<string | null>(null);
  const [lightboxUrl,  setLightboxUrl]  = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state when order/meta changes
  useEffect(() => {
    if (!order) {
      setIsEditing(false);
      setExtraCosts([]);
      setNotes("");
      setDocuments([]);
      setSaveError(null);
      setUploadError(null);
      return;
    }

    const costs = (orderMeta?.extra_costs || []).map((c) => ({
      label:    c.label,
      amount:   String(c.amount),
      currency: c.currency,
    }));
    setExtraCosts(costs.length ? costs : []);
    setNotes(orderMeta?.notes ?? "");
    setDocuments(orderMeta?.documents || []);
    setIsEditing(false);
    setSaveError(null);
    setUploadError(null);
  }, [order?.orderId, orderMeta]);

  function addCostRow() {
    setExtraCosts((prev) => [
      ...prev,
      { label: "", amount: "", currency: order?.currency ?? "SEK" },
    ]);
  }

  function setCost(idx: number, patch: Partial<ExtraCost>) {
    setExtraCosts((prev) =>
      prev.map((c, i) => i === idx ? { ...c, ...patch } : c)
    );
  }

  function removeCost(idx: number) {
    setExtraCosts((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    if (!order || !session?.user?.id) return;
    setSaving(true);
    setSaveError(null);

    try {
      const costs = extraCosts
        .filter((c) => c.label.trim() && c.amount !== "")
        .map((c) => ({
          label:    c.label.trim(),
          amount:   Number(c.amount) || 0,
          currency: c.currency || order.currency,
        }));

      const payload = {
        order_id:    order.orderId,
        user_id:     session.user.id,
        extra_costs: costs,
        documents,
        notes:       notes.trim() || null,
        updated_at:  new Date().toISOString(),
      };

      const { error } = await supabase
        .from("inventory_orders")
        .upsert(payload, { onConflict: "order_id,user_id" });

      if (error) throw new Error(error.message);
      setIsEditing(false);
      onMetaSaved();
    } catch (e: any) {
      setSaveError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadFiles(files: FileList | null) {
    if (!files || !files.length || !session?.user?.id || !order) return;
    setUploading(true);
    setUploadError(null);

    try {
      const token = await getAccessToken();

      for (const file of Array.from(files)) {
        if (file.size > 20 * 1024 * 1024)
          throw new Error(`${file.name} is over 20 MB.`);

        const ext       = file.name.split(".").pop()?.toLowerCase() || "bin";
        const timestamp = Date.now();
        const random    = Math.random().toString(36).substring(2, 8);
        const key       = `inventory/orders/${session.user.id}/${timestamp}-${random}.${ext}`;

        // Get presigned URL
        const presignRes = await fetch("/api/inventory/presign", {
          method:  "POST",
          headers: {
            "Content-Type":  "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({ filename: file.name, contentType: file.type || "application/octet-stream" }),
        });

        if (!presignRes.ok) {
          const err = await presignRes.json().catch(() => ({}));
          throw new Error(err?.error || "Failed to get upload URL");
        }

        const { uploadUrl, publicUrl } = await presignRes.json();

        // Upload to R2
        const uploadRes = await fetch(uploadUrl, {
          method:  "PUT",
          body:    file,
          headers: { "Content-Type": file.type || "application/octet-stream" },
        });

        if (!uploadRes.ok)
          throw new Error(`Upload failed: ${uploadRes.statusText}`);

        const next = [...documents, publicUrl];
        setDocuments(next);

        // Save immediately so document isn't lost if user closes without saving
        await supabase.from("inventory_orders").upsert({
          order_id:    order.orderId,
          user_id:     session.user.id,
          extra_costs: extraCosts
            .filter((c) => c.label.trim() && c.amount !== "")
            .map((c) => ({ label: c.label, amount: Number(c.amount) || 0, currency: c.currency })),
          documents:   next,
          notes:       notes.trim() || null,
          updated_at:  new Date().toISOString(),
        }, { onConflict: "order_id,user_id" });

        onMetaSaved();
      }
    } catch (e: any) {
      setUploadError(e?.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteDocument(url: string) {
    if (!confirm("Remove this document?")) return;
    setDeletingDoc(url);

    try {
      const token = await getAccessToken();
      await fetch("/api/inventory/delete-document", {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ documentUrl: url }),
      });

      const next = documents.filter((d) => d !== url);
      setDocuments(next);

      await supabase.from("inventory_orders").upsert({
        order_id:    order!.orderId,
        user_id:     session.user.id,
        extra_costs: extraCosts
          .filter((c) => c.label.trim() && c.amount !== "")
          .map((c) => ({ label: c.label, amount: Number(c.amount) || 0, currency: c.currency })),
        documents:   next,
        notes:       notes.trim() || null,
        updated_at:  new Date().toISOString(),
      }, { onConflict: "order_id,user_id" });

      onMetaSaved();
    } catch (e: any) {
      alert(e?.message || "Delete failed");
    } finally {
      setDeletingDoc(null);
    }
  }

  // Totals
  const itemsTotal  = order?.total ?? 0;
  const extraTotal  = extraCosts
    .filter((c) => c.amount !== "")
    .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const grandTotal  = itemsTotal + extraTotal;
  const currency    = order?.currency ?? "SEK";

  if (!order) return null;

  return (
    <>
      <Modal open={!!order} onClose={onClose}>
        <div>
          {/* Header */}
          <h2 style={{ marginTop: 0 }}>
            {order.store}
            {order.orderRef ? ` • ${order.orderRef}` : ""}
          </h2>

          <p className={styles.muted} style={{ marginTop: "0.25rem" }}>
            {order.date} • {order.items.length} item{order.items.length === 1 ? "" : "s"}
          </p>

          {/* Totals summary */}
          <div style={{
            background: "rgba(0,0,0,0.03)",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 10,
            padding: "0.65rem 0.85rem",
            marginBottom: "0.85rem",
            display: "grid",
            gap: "0.2rem",
            fontSize: "0.92rem",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className={styles.muted}>Items total</span>
              <span>{itemsTotal.toLocaleString()} {currency}</span>
            </div>
            {extraCosts.filter((c) => c.label && c.amount).map((c, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
                <span className={styles.muted}>{c.label}</span>
                <span>{Number(c.amount).toLocaleString()} {c.currency || currency}</span>
              </div>
            ))}
            {extraTotal > 0 && (
              <div style={{
                display: "flex", justifyContent: "space-between",
                borderTop: "1px solid rgba(0,0,0,0.09)",
                paddingTop: "0.35rem", marginTop: "0.15rem",
                fontWeight: 700,
              }}>
                <span>Grand total</span>
                <span>{grandTotal.toLocaleString()} {currency}</span>
              </div>
            )}
          </div>

          {/* Action bar */}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.85rem" }}>
            <button
              className={styles.invBtn}
              onClick={() => { onFilterByOrder(order.orderId); onClose(); }}
            >
              Filter inventory by this order
            </button>
            <button
              className={styles.invBtn}
              onClick={() => setIsEditing((v) => !v)}
            >
              {isEditing ? "Cancel" : "✏ Edit costs & notes"}
            </button>
            {isEditing && (
              <button className={styles.invBtn} onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            )}
            {saveError && (
              <span style={{ color: "crimson", fontSize: "0.85rem", alignSelf: "center" }}>
                {saveError}
              </span>
            )}
          </div>

          {/* Extra costs editor */}
          {isEditing && (
            <div style={{
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 12,
              overflow: "hidden",
              marginBottom: "0.85rem",
            }}>
              <div style={{
                padding: "0.5rem 0.85rem",
                background: "rgba(0,0,0,0.03)",
                borderBottom: "1px solid rgba(0,0,0,0.07)",
                fontWeight: 700, fontSize: "0.82rem",
                textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.7,
              }}>
                Extra costs
              </div>
              <div style={{ padding: "0.75rem 0.85rem", display: "grid", gap: "0.5rem" }}>
                {extraCosts.length === 0 && (
                  <p className={styles.muted} style={{ fontSize: "0.88rem", margin: 0 }}>
                    No extra costs yet.
                  </p>
                )}
                {extraCosts.map((cost, idx) => (
                  <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 120px 90px auto", gap: "0.5rem", alignItems: "center" }}>
                    <input
                      className={styles.invInput}
                      value={cost.label}
                      onChange={(e) => setCost(idx, { label: e.target.value })}
                      placeholder="e.g. Shipping"
                    />
                    <input
                      className={styles.invInput}
                      type="number"
                      value={cost.amount}
                      onChange={(e) => setCost(idx, { amount: e.target.value })}
                      placeholder="Amount"
                    />
                    <input
                      className={styles.invInput}
                      value={cost.currency}
                      onChange={(e) => setCost(idx, { currency: e.target.value })}
                      placeholder="SEK"
                    />
                    <button
                      className={styles.invBtn}
                      style={{ padding: "0.35rem 0.6rem" }}
                      onClick={() => removeCost(idx)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  className={styles.invBtn}
                  style={{ justifySelf: "start", marginTop: "0.25rem" }}
                  onClick={addCostRow}
                >
                  + Add cost
                </button>
              </div>
            </div>
          )}

          {/* Notes editor */}
          {isEditing && (
            <div style={{ marginBottom: "0.85rem" }}>
              <div style={{ fontSize: "0.8rem", opacity: 0.6, fontWeight: 600, marginBottom: "0.25rem" }}>
                Notes
              </div>
              <textarea
                className={styles.invInput}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ width: "100%", minHeight: 70, resize: "vertical" }}
                placeholder="Delivery notes, tracking info, etc."
              />
            </div>
          )}

          {/* Notes read view */}
          {!isEditing && orderMeta?.notes && (
            <div style={{ marginBottom: "0.85rem" }}>
              <div style={{ fontWeight: 700, marginBottom: "0.35rem" }}>Notes</div>
              <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: "0.92rem" }}>
                {orderMeta.notes}
              </p>
            </div>
          )}

          {/* Documents section */}
          <div style={{
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 12,
            overflow: "hidden",
            marginBottom: "0.85rem",
          }}>
            <div style={{
              padding: "0.5rem 0.85rem",
              background: "rgba(0,0,0,0.03)",
              borderBottom: documents.length ? "1px solid rgba(0,0,0,0.07)" : "none",
              fontWeight: 700, fontSize: "0.82rem",
              textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.7,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span>Documents</span>
              <span style={{ opacity: 0.6, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                {documents.length} file{documents.length === 1 ? "" : "s"}
              </span>
            </div>

            {/* Document list */}
            {!!documents.length && (
              <div style={{ padding: "0.65rem 0.85rem", display: "grid", gap: "0.5rem" }}>
                {documents.map((url) => (
                  <div key={url} style={{
                    display: "flex", alignItems: "center", gap: "0.65rem",
                    padding: "0.5rem 0.65rem",
                    border: "1px solid rgba(0,0,0,0.08)",
                    borderRadius: 10,
                  }}>
                    {/* Thumbnail or icon */}
                    {isImage(url) ? (
                      <img
                        src={url}
                        alt=""
                        style={{
                          width: 48, height: 48, objectFit: "cover",
                          borderRadius: 6, flexShrink: 0, cursor: "zoom-in",
                        }}
                        onClick={() => setLightboxUrl(url)}
                      />
                    ) : (
                      <div style={{
                        width: 48, height: 48, borderRadius: 6,
                        background: "rgba(0,0,0,0.05)",
                        display: "flex", alignItems: "center",
                        justifyContent: "center", fontSize: "1.4rem",
                        flexShrink: 0,
                      }}>
                        {isPdf(url) ? "📄" : "📎"}
                      </div>
                    )}

                    {/* Filename + link */}
                    <div style={{ flex: 1, minWidth: 0 }}><a
                      
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: "0.88rem", fontWeight: 600,
                          color: "inherit", wordBreak: "break-all",
                        }}
                      >
                        {fileLabel(url)}
                      </a>
                    </div>

                    {/* Delete */}
                    <button
                      className={styles.invBtn}
                      style={{ padding: "0.3rem 0.6rem", flexShrink: 0 }}
                      onClick={() => handleDeleteDocument(url)}
                      disabled={deletingDoc === url}
                    >
                      {deletingDoc === url ? "…" : "✕"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload area */}
            <div style={{ padding: "0.65rem 0.85rem" }}>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                style={{ display: "none" }}
                onChange={(e) => handleUploadFiles(e.target.files)}
              />
              <div
                style={{
                  border: "2px dashed rgba(0,0,0,0.13)",
                  borderRadius: 10,
                  padding: "1rem",
                  textAlign: "center",
                  cursor: uploading ? "wait" : "pointer",
                  opacity: uploading ? 0.6 : 1,
                  transition: "border-color 0.15s, background 0.15s",
                }}
                onClick={() => !uploading && fileInputRef.current?.click()}
                onDrop={(e) => { e.preventDefault(); handleUploadFiles(e.dataTransfer.files); }}
                onDragOver={(e) => e.preventDefault()}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.02)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {uploading ? (
                  <span style={{ fontSize: "0.88rem", opacity: 0.6 }}>Uploading…</span>
                ) : (
                  <>
                    <div style={{ fontSize: "1.3rem", opacity: 0.3, marginBottom: "0.25rem" }}>📎</div>
                    <div style={{ fontSize: "0.88rem", fontWeight: 600, opacity: 0.55 }}>
                      Drop files here or click to upload
                    </div>
                    <div style={{ fontSize: "0.76rem", opacity: 0.38, marginTop: "0.2rem" }}>
                      Images, PDFs, Word, Excel · max 20 MB
                    </div>
                  </>
                )}
              </div>
              {uploadError && (
                <p style={{ color: "crimson", fontSize: "0.82rem", margin: "0.35rem 0 0" }}>
                  {uploadError}
                </p>
              )}
            </div>
          </div>

          {/* Items list */}
          <h3 style={{ marginBottom: "0.5rem" }}>Items</h3>
          <div className={styles.setupItems}>
            {order.items.map((it) => (
              <div
                key={it.id}
                className={styles.setupItemRow}
                role="button"
                tabIndex={0}
                onClick={() => { onClose(); onSelectItem(it.id); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") { onClose(); onSelectItem(it.id); }
                }}
              >
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                  {it.images?.[0] ? (
                    <img className={styles.invThumb} src={it.images[0]} alt="" />
                  ) : (
                    <div className={styles.invThumb} aria-hidden="true" />
                  )}
                  <div>
                    <div style={{ fontWeight: 800 }}>{it.name}</div>
                    <div className={styles.muted} style={{ fontSize: "0.95rem" }}>
                      {[it.brand, it.model].filter(Boolean).join(" • ")}
                    </div>
                  </div>
                  {it.purchase?.price != null && !it.purchase?.inherited && (
                    <div className={styles.muted} style={{ marginLeft: "auto", fontSize: "0.88rem" }}>
                      {Number(it.purchase.price).toLocaleString()} {it.purchase.currency ?? ""}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* Lightbox for image documents */}
      {lightboxUrl && (
        <div
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.9)",
            zIndex: 400,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "2rem", cursor: "zoom-out",
          }}
          onClick={() => setLightboxUrl(null)}
        >
          <button
            style={{
              position: "fixed", top: "1.25rem", right: "1.25rem",
              width: 36, height: 36, borderRadius: 999,
              border: "none", background: "rgba(255,255,255,0.15)",
              color: "#fff", fontSize: "1rem", cursor: "pointer",
              display: "grid", placeItems: "center",
            }}
            onClick={() => setLightboxUrl(null)}
          >✕</button>
          <img
            src={lightboxUrl}
            alt=""
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
