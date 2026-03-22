"use client";

import { useEffect, useState } from "react";
import styles from "../inventory.module.css";
import { DbItem, DbItemLink } from "../types";
import { fmtMoney, safeText, slugifyId } from "../helpers";
import { Modal } from "./Modal";
import { Specs } from "./Specs";
import { supabase } from "../../../lib/supabaseClient";

type Props = {
  item: DbItem | null;
  isCreating: boolean;
  links: { outgoing: DbItemLink[]; incoming: DbItemLink[] };
  allItems: DbItem[];
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
  onNavigate: (id: string) => void;
  onOpenLinkModal: () => void;
  session: any;
};

type EditDraft = {
  name: string;
  category: string;
  type: string;
  brand: string;
  model: string;
  quantity: number | string;
  location: string;
  tags: string;
  notes: string;
  purchase_date: string;
  purchase_price: string | number;
  purchase_currency: string;
  purchase_store: string;
  purchase_orderRef: string;
  purchase_orderId: string;
  specs_json: string;
};

function draftFromItem(item: DbItem): EditDraft {
  return {
    name:               item.name             ?? "",
    category:           item.category         ?? "",
    type:               item.type             ?? "",
    brand:              item.brand            ?? "",
    model:              item.model            ?? "",
    quantity:           item.quantity         ?? 1,
    location:           item.location         ?? "",
    tags:               (item.tags || []).join(", "),
    notes:              item.notes            ?? "",
    purchase_date:      item.purchase?.date   ?? "",
    purchase_price:     item.purchase?.price  ?? "",
    purchase_currency:  item.purchase?.currency ?? "SEK",
    purchase_store:     item.purchase?.store  ?? "",
    purchase_orderRef:  item.purchase?.orderRef ?? "",
    purchase_orderId:   item.purchase?.orderId  ?? "",
    specs_json:         JSON.stringify(item.specs ?? {}, null, 2),
  };
}

function emptyDraft(): EditDraft {
  return {
    name: "", category: "", type: "", brand: "", model: "",
    quantity: 1, location: "", tags: "", notes: "",
    purchase_date: "", purchase_price: "", purchase_currency: "SEK",
    purchase_store: "", purchase_orderRef: "", purchase_orderId: "",
    specs_json: "{}",
  };
}

export function ItemModal({
  item,
  isCreating,
  links,
  allItems,
  onClose,
  onSaved,
  onDeleted,
  onNavigate,
  onOpenLinkModal,
  session,
}: Props) {
  const open = !!item || isCreating;

  const [isEditing, setIsEditing]   = useState(false);
  const [draft, setDraft]           = useState<EditDraft>(emptyDraft);
  const [newId, setNewId]           = useState("");
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState<string | null>(null);

  // Sync draft when item changes
  useEffect(() => {
    if (isCreating) {
      setDraft(emptyDraft());
      setNewId("");
      setIsEditing(true);
      setSaveError(null);
      return;
    }
    if (!item) {
      setIsEditing(false);
      setDraft(emptyDraft());
      setSaveError(null);
      return;
    }
    setIsEditing(false);
    setSaveError(null);
    setDraft(draftFromItem(item));
  }, [item, isCreating]);

  function set(patch: Partial<EditDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  function buildPurchase(base: any = {}) {
    const p: any = {
      ...base,
      date:     draft.purchase_date     || null,
      price:    draft.purchase_price === "" ? null : draft.purchase_price,
      currency: draft.purchase_currency || "SEK",
      store:    draft.purchase_store    || null,
      orderRef: draft.purchase_orderRef || null,
      orderId:  draft.purchase_orderId  || null,
    };
    if (p.price != null) {
      const n = Number(p.price);
      if (Number.isFinite(n)) p.price = n;
    }
    return p;
  }

  function buildPayload(id?: string) {
    let specsObj: any = {};
    const raw = draft.specs_json?.trim();
    if (raw && raw !== "{}") {
      try { specsObj = JSON.parse(raw); }
      catch { throw new Error("Specs JSON is invalid. Fix it or clear it."); }
    }

    const tagsArr = String(draft.tags || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    return {
      ...(id ? { id } : {}),
      name:     draft.name || (id ?? ""),
      category: draft.category  || null,
      type:     draft.type      || null,
      brand:    draft.brand     || null,
      model:    draft.model     || null,
      quantity: Number(draft.quantity) || 1,
      location: draft.location  || null,
      tags:     tagsArr,
      notes:    draft.notes     || null,
      purchase: buildPurchase(item?.purchase),
      specs:    specsObj,
    };
  }

  async function handleCreate() {
    if (!session?.user?.id) return;
    setSaving(true);
    setSaveError(null);
    try {
      const id = (newId || slugifyId(draft.name)).trim();
      if (!id) throw new Error("ID is required (enter a name or an id).");
      if (allItems.some((x) => x.id === id))
        throw new Error(`An item with id "${id}" already exists.`);

      const payload = {
        ...buildPayload(id),
        user_id:          session.user.id,
        images:           [],
        purchase_history: [],
      };

      const { error } = await supabase.from("inventory_items").insert(payload);
      if (error) throw new Error(error.message);

      onSaved();
      onNavigate(id);
    } catch (e: any) {
      setSaveError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (!item) return;
    setSaving(true);
    setSaveError(null);
    try {
      const { error } = await supabase
        .from("inventory_items")
        .update(buildPayload())
        .eq("id", item.id);
      if (error) throw new Error(error.message);
      setIsEditing(false);
      onSaved();
    } catch (e: any) {
      setSaveError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!item) return;
    if (!confirm("Delete this item? This cannot be undone.")) return;
    const { error } = await supabase
      .from("inventory_items")
      .delete()
      .eq("id", item.id);
    if (error) { alert(error.message); return; }
    onDeleted();
  }

  async function handleDeleteLink(linkId: string) {
    if (!confirm("Delete link?")) return;
    const { error } = await supabase
      .from("inventory_item_links")
      .delete()
      .eq("id", linkId);
    if (error) { alert(error.message); return; }
    onSaved();
  }

  function itemLabel(id: string) {
    return allItems.find((x) => x.id === id)?.name ?? id;
  }

  // ── Shared field grid ──────────────────────────────────────────────
  function renderEditForm() {
    return (
      <div style={{ display: "grid", gap: "0.75rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          {(
            [
              ["Name",     "name",     "text"],
              ["Category", "category", "text"],
              ["Type",     "type",     "text"],
              ["Location", "location", "text"],
              ["Brand",    "brand",    "text"],
              ["Model",    "model",    "text"],
              ["Quantity", "quantity", "number"],
              ["Tags (comma separated)", "tags", "text"],
            ] as [string, keyof EditDraft, string][]
          ).map(([label, field, inputType]) => (
            <label key={field}>
              <div className={styles.muted}>{label}</div>
              <input
                className={styles.invInput}
                type={inputType}
                value={String(draft[field] ?? "")}
                onChange={(e) => set({ [field]: e.target.value } as any)}
              />
            </label>
          ))}
        </div>

        <label>
          <div className={styles.muted}>Notes</div>
          <textarea
            className={styles.invInput}
            style={{ minHeight: 90 }}
            value={draft.notes}
            onChange={(e) => set({ notes: e.target.value })}
          />
        </label>

        <h3 style={{ margin: "0.5rem 0 0" }}>Purchase</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          {(
            [
              ["Date (YYYY-MM-DD)", "purchase_date",     "text"],
              ["Price",             "purchase_price",    "text"],
              ["Currency",          "purchase_currency", "text"],
              ["Store",             "purchase_store",    "text"],
              ["Order ref",         "purchase_orderRef", "text"],
              ["OrderId",           "purchase_orderId",  "text"],
            ] as [string, keyof EditDraft, string][]
          ).map(([label, field]) => (
            <label key={field}>
              <div className={styles.muted}>{label}</div>
              <input
                className={styles.invInput}
                value={String(draft[field] ?? "")}
                onChange={(e) => set({ [field]: e.target.value } as any)}
              />
            </label>
          ))}
        </div>

        <h3 style={{ margin: "0.5rem 0 0" }}>Specs (JSON)</h3>
        <textarea
          className={styles.invInput}
          style={{
            minHeight: 240,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          }}
          value={draft.specs_json}
          onChange={(e) => set({ specs_json: e.target.value })}
        />
      </div>
    );
  }

  // ── Read view ──────────────────────────────────────────────────────
  function renderReadView() {
    if (!item) return null;
    const money = fmtMoney(item.purchase);

    return (
      <>
        {(item.images || []).map((src) => (
          <img
            key={src}
            src={src}
            alt=""
            style={{
              width: "100%",
              maxHeight: 320,
              objectFit: "cover",
              borderRadius: 12,
              margin: "0.5rem 0",
            }}
          />
        ))}

        <div className={styles.detailGrid}>
          <div>
            <h3>Details</h3>
            <ul className={styles.detailList}>
              {item.category && <li><b>Category:</b> {item.category}</li>}
              {item.type     && <li><b>Type:</b> {item.type}</li>}
              {item.location && <li><b>Location:</b> {item.location}</li>}
              {item.quantity != null && <li><b>Quantity:</b> {item.quantity}</li>}
            </ul>
          </div>
          <div>
            <h3>Purchase</h3>
            <ul className={styles.detailList}>
              {item.purchase?.date     && <li><b>Date:</b> {safeText(item.purchase.date)}</li>}
              {money                   && <li><b>Price:</b> {money}</li>}
              {item.purchase?.store    && <li><b>Store:</b> {safeText(item.purchase.store)}</li>}
              {item.purchase?.orderRef && <li><b>Order ref:</b> {safeText(item.purchase.orderRef)}</li>}
              {item.purchase?.orderId  && <li><b>OrderId:</b> {safeText(item.purchase.orderId)}</li>}
            </ul>
          </div>
        </div>

        {!!(item.tags || []).length && (
          <p className={styles.muted}>
            Tags: {(item.tags || []).map((t) => `#${t}`).join(" ")}
          </p>
        )}

        {item.notes && <><h3>Notes</h3><p>{item.notes}</p></>}

        <h3>Relationships</h3>

        {links.outgoing.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {Object.entries(
              links.outgoing.reduce((acc: Record<string, DbItemLink[]>, l) => {
                (acc[l.relation_type] ||= []).push(l);
                return acc;
              }, {})
            ).map(([type, list]) => (
              <div key={type}>
                <div className={styles.muted} style={{ fontWeight: 800, marginBottom: 4 }}>
                  {type}
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  {list.map((l) => (
                    <div
                      key={l.id}
                      className={styles.setupItemRow}
                      style={{ padding: "0.55rem" }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div
                          role="button"
                          tabIndex={0}
                          style={{ cursor: "pointer" }}
                          onClick={() => onNavigate(l.to_item_id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") onNavigate(l.to_item_id);
                          }}
                        >
                          <div style={{ fontWeight: 800 }}>{itemLabel(l.to_item_id)}</div>
                          {l.note && <div className={styles.muted}>{l.note}</div>}
                        </div>
                        <button
                          className={styles.invBtn}
                          style={{ padding: "0.35rem 0.6rem", height: "fit-content" }}
                          onClick={() => handleDeleteLink(l.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.muted}>No links from this item yet.</p>
        )}

        {!!links.incoming.length && (
          <div style={{ marginTop: 12 }}>
            <div className={styles.muted} style={{ fontWeight: 800, marginBottom: 6 }}>
              Linked from
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {links.incoming.map((l) => (
                <div
                  key={l.id}
                  className={styles.setupItemRow}
                  style={{ padding: "0.55rem", cursor: "pointer" }}
                  role="button"
                  tabIndex={0}
                  onClick={() => onNavigate(l.from_item_id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onNavigate(l.from_item_id);
                  }}
                >
                  <div style={{ fontWeight: 800 }}>{itemLabel(l.from_item_id)}</div>
                  <div className={styles.muted}>{l.relation_type}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Specs specs={item.specs} />
      </>
    );
  }

  return (
    <Modal open={open} onClose={onClose}>
      {open && (
        <div>
          <h2 style={{ marginTop: 0 }}>
            {isCreating ? "Add new item" : item!.name}
          </h2>

          {!isCreating && (
            <p className={styles.muted} style={{ marginTop: "0.25rem" }}>
              {[item!.brand, item!.model]
                .filter(Boolean)
                .map(safeText)
                .join(" • ")}
            </p>
          )}

          {/* ID input (create mode only) */}
          {isCreating && (
            <div style={{ display: "grid", gap: "0.35rem", margin: "0.5rem 0 0.75rem" }}>
              <div className={styles.muted}>ID (slug)</div>
              <input
                className={styles.invInput}
                value={newId}
                placeholder="auto from name (or type your own)"
                onChange={(e) => setNewId(slugifyId(e.target.value))}
              />
              <div className={styles.muted} style={{ fontSize: "0.9rem" }}>
                Suggested: <b>{slugifyId(draft.name) || "—"}</b>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", margin: "0.75rem 0" }}>
            {isCreating ? (
              <>
                <button className={styles.invBtn} onClick={handleCreate} disabled={saving}>
                  {saving ? "Creating…" : "Create"}
                </button>
                <button className={styles.invBtn} onClick={onClose} disabled={saving}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  className={styles.invBtn}
                  onClick={() => setIsEditing((v) => !v)}
                >
                  {isEditing ? "Cancel edit" : "Edit"}
                </button>
                {isEditing && (
                  <button className={styles.invBtn} onClick={handleSave} disabled={saving}>
                    {saving ? "Saving…" : "Save"}
                  </button>
                )}
                <button className={styles.invBtn} onClick={handleDelete} disabled={saving}>
                  🗑 Delete
                </button>
                <button className={styles.invBtn} onClick={onOpenLinkModal}>
                  + Link item
                </button>
              </>
            )}
            {saveError && (
              <span style={{ color: "crimson", alignSelf: "center" }}>
                Error: {saveError}
              </span>
            )}
          </div>

          {isEditing ? renderEditForm() : renderReadView()}
        </div>
      )}
    </Modal>
  );
}
