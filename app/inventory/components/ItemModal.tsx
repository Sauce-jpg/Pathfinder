"use client";

import { useEffect, useState, useId } from "react";
import styles from "../inventory.module.css";
import m from "./ItemModal.module.css";
import { DbItem, DbItemLink } from "../types";
import { fmtMoney, safeText, slugifyId } from "../helpers";
import { Modal } from "./Modal";
import { Specs } from "./Specs";
import { supabase } from "../../../lib/supabaseClient";
import { ImageManager, ImageUploadTrigger } from "./ImageManager";
import { useRef } from "react";

// ── Types ──────────────────────────────────────────────────────────────

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
  purchase_orderId_manual: boolean;
  specs_json: string;
};

// ── Spec builder types ─────────────────────────────────────────────────

type SpecField = { key: string; value: string };
type SpecSection = { name: string; fields: SpecField[] };

function specsToSections(specs: any): SpecSection[] {
  if (!specs || typeof specs !== "object") return [];
  return Object.entries(specs).map(([name, val]) => {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      return {
        name,
        fields: Object.entries(val as Record<string, any>).map(([k, v]) => ({
          key: k,
          value: String(v ?? ""),
        })),
      };
    }
    return { name, fields: [{ key: "value", value: String(val ?? "") }] };
  });
}

function sectionsToJson(sections: SpecSection[]): string {
  const obj: Record<string, any> = {};
  for (const sec of sections) {
    if (!sec.name.trim()) continue;
    if (sec.fields.length === 1 && sec.fields[0].key === "value") {
      obj[sec.name] = sec.fields[0].value;
    } else {
      const inner: Record<string, string> = {};
      for (const f of sec.fields) {
        if (f.key.trim()) inner[f.key] = f.value;
      }
      obj[sec.name] = inner;
    }
  }
  return JSON.stringify(obj, null, 2);
}

// ── Helpers ────────────────────────────────────────────────────────────

function draftFromItem(item: DbItem): EditDraft {
  return {
    name:                   item.name             ?? "",
    category:               item.category         ?? "",
    type:                   item.type             ?? "",
    brand:                  item.brand            ?? "",
    model:                  item.model            ?? "",
    quantity:               item.quantity         ?? 1,
    location:               item.location         ?? "",
    tags:                   (item.tags || []).join(", "),
    notes:                  item.notes            ?? "",
    purchase_date:          item.purchase?.date   ?? "",
    purchase_price:         item.purchase?.price  ?? "",
    purchase_currency:      item.purchase?.currency ?? "SEK",
    purchase_store:         item.purchase?.store  ?? "",
    purchase_orderRef:      item.purchase?.orderRef ?? "",
    purchase_orderId:       item.purchase?.orderId  ?? "",
    purchase_orderId_manual: !!(item.purchase?.orderId),
    specs_json:             JSON.stringify(item.specs ?? {}, null, 2),
  };
}

function emptyDraft(): EditDraft {
  return {
    name: "", category: "", type: "", brand: "", model: "",
    quantity: 1, location: "", tags: "", notes: "",
    purchase_date: "", purchase_price: "", purchase_currency: "SEK",
    purchase_store: "", purchase_orderRef: "", purchase_orderId: "",
    purchase_orderId_manual: false,
    specs_json: "{}",
  };
}

function autoOrderId(store: string, date: string, ref: string): string {
  const parts = [store.trim(), date.trim(), ref.trim()].filter(Boolean);
  return parts.length === 3 ? parts.join("-") : "";
}

function uniqSorted(items: DbItem[], fn: (i: DbItem) => string | null): string[] {
  return [...new Set(items.map(fn).filter(Boolean) as string[])].sort((a, b) =>
    a.localeCompare(b)
  );
}

// ── Datalist helper ────────────────────────────────────────────────────

function DL({ id, options }: { id: string; options: string[] }) {
  return (
    <datalist id={id}>
      {options.map((o) => <option key={o} value={o} />)}
    </datalist>
  );
}

// ── Spec builder ───────────────────────────────────────────────────────

function SpecBuilder({
  sections,
  onChange,
}: {
  sections: SpecSection[];
  onChange: (s: SpecSection[]) => void;
}) {
  function updateSection(i: number, patch: Partial<SpecSection>) {
    const next = sections.map((s, idx) => idx === i ? { ...s, ...patch } : s);
    onChange(next);
  }

  function removeSection(i: number) {
    onChange(sections.filter((_, idx) => idx !== i));
  }

  function addSection() {
    onChange([...sections, { name: "", fields: [{ key: "", value: "" }] }]);
  }

  function updateField(si: number, fi: number, patch: Partial<SpecField>) {
    const next = sections.map((s, idx) => {
      if (idx !== si) return s;
      return {
        ...s,
        fields: s.fields.map((f, fIdx) => fIdx === fi ? { ...f, ...patch } : f),
      };
    });
    onChange(next);
  }

  function addField(si: number) {
    const next = sections.map((s, idx) => {
      if (idx !== si) return s;
      return { ...s, fields: [...s.fields, { key: "", value: "" }] };
    });
    onChange(next);
  }

  function removeField(si: number, fi: number) {
    const next = sections.map((s, idx) => {
      if (idx !== si) return s;
      const fields = s.fields.filter((_, fIdx) => fIdx !== fi);
      return { ...s, fields: fields.length ? fields : [{ key: "", value: "" }] };
    });
    onChange(next);
  }

  return (
    <div>
      {sections.map((sec, si) => (
        <div key={si} className={m.specSectionBlock}>
          <div className={m.specSectionHead}>
            <input
              className={m.specSectionNameInput}
              value={sec.name}
              placeholder="Section name (e.g. CPU, Display)"
              onChange={(e) => updateSection(si, { name: e.target.value })}
            />
            <button className={m.iconBtn} onClick={() => removeSection(si)} title="Remove section">
              ✕
            </button>
          </div>

          <div className={m.specSectionBody}>
            {sec.fields.map((f, fi) => (
              <div key={fi} className={m.specFieldRow}>
                <input
                  className={m.specInput}
                  value={f.key}
                  placeholder="Key"
                  onChange={(e) => updateField(si, fi, { key: e.target.value })}
                />
                <input
                  className={m.specInput}
                  value={f.value}
                  placeholder="Value"
                  onChange={(e) => updateField(si, fi, { value: e.target.value })}
                />
                <button
                  className={m.iconBtn}
                  onClick={() => removeField(si, fi)}
                  title="Remove field"
                >
                  ✕
                </button>
              </div>
            ))}
            <button className={m.addFieldBtn} onClick={() => addField(si)}>
              + Add field
            </button>
          </div>
        </div>
      ))}

      <button className={m.addSectionBtn} onClick={addSection}>
        + Add section
      </button>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────

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

  const [isEditing, setIsEditing]     = useState(false);
  const [draft, setDraft]             = useState<EditDraft>(emptyDraft);
  const [newId, setNewId]             = useState("");
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState<string | null>(null);
  const [specsMode, setSpecsMode]     = useState<"builder" | "json">("builder");
  const [specSections, setSpecSections] = useState<SpecSection[]>([]);
  const uploadTriggerRef              = useRef<HTMLInputElement>(null);

  const dlId = useId();

  // Derived suggestion lists
  const suggestCategories = uniqSorted(allItems, (i) => i.category);
  const suggestTypes       = uniqSorted(allItems, (i) => i.type);
  const suggestLocations   = uniqSorted(allItems, (i) => i.location);
  const suggestBrands      = uniqSorted(allItems, (i) => i.brand);
  const suggestStores      = uniqSorted(allItems, (i) => i.purchase?.store ?? null);

  // Sync draft when item changes
  useEffect(() => {
    if (isCreating) {
      const d = emptyDraft();
      setDraft(d);
      setNewId("");
      setIsEditing(true);
      setSaveError(null);
      setSpecsMode("builder");
      setSpecSections([]);
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
    const d = draftFromItem(item);
    setDraft(d);
    setSpecSections(specsToSections(item.specs));
    setSpecsMode("builder");
  }, [item, isCreating]);

  // Auto-compose orderId unless manually overridden
  useEffect(() => {
    if (draft.purchase_orderId_manual) return;
    const auto = autoOrderId(
      draft.purchase_store,
      draft.purchase_date,
      draft.purchase_orderRef
    );
    if (auto) setDraft((d) => ({ ...d, purchase_orderId: auto }));
  }, [draft.purchase_store, draft.purchase_date, draft.purchase_orderRef, draft.purchase_orderId_manual]);

  // Sync specs JSON <-> sections when switching modes
  function switchToJson() {
    setDraft((d) => ({ ...d, specs_json: sectionsToJson(specSections) }));
    setSpecsMode("json");
  }

  function switchToBuilder() {
    try {
      const parsed = JSON.parse(draft.specs_json || "{}");
      setSpecSections(specsToSections(parsed));
      setSpecsMode("builder");
    } catch {
      alert("Fix JSON errors before switching to builder.");
    }
  }

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
    if (specsMode === "builder") {
      try { specsObj = JSON.parse(sectionsToJson(specSections)); } catch {}
    } else {
      const raw = draft.specs_json?.trim();
      if (raw && raw !== "{}") {
        try { specsObj = JSON.parse(raw); }
        catch { throw new Error("Specs JSON is invalid. Fix it or clear it."); }
      }
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
      .from("inventory_items").delete().eq("id", item.id);
    if (error) { alert(error.message); return; }
    onDeleted();
  }

  async function handleDeleteLink(linkId: string) {
    if (!confirm("Delete link?")) return;
    const { error } = await supabase
      .from("inventory_item_links").delete().eq("id", linkId);
    if (error) { alert(error.message); return; }
    onSaved();
  }

  function itemLabel(id: string) {
    return allItems.find((x) => x.id === id)?.name ?? id;
  }

  // ── Edit form ────────────────────────────────────────────────────────

  function renderEditForm() {
    const autoId = autoOrderId(
      draft.purchase_store,
      draft.purchase_date,
      draft.purchase_orderRef
    );

    return (
      <div>
        {/* Datalists */}
        <DL id={`${dlId}-cat`}      options={suggestCategories} />
        <DL id={`${dlId}-type`}     options={suggestTypes} />
        <DL id={`${dlId}-loc`}      options={suggestLocations} />
        <DL id={`${dlId}-brand`}    options={suggestBrands} />
        <DL id={`${dlId}-store`}    options={suggestStores} />

        {/* Details section */}
        <div className={m.section}>
          <div className={m.sectionHeader}>Details</div>
          <div className={m.sectionBody}>
            <div className={m.fieldRow4}>
              <label>
                <div className={m.fieldLabel}>Name *</div>
                <input
                  className={styles.invInput}
                  value={draft.name}
                  onChange={(e) => set({ name: e.target.value })}
                  style={{ width: "100%" }}
                />
              </label>
              <label>
                <div className={m.fieldLabel}>Category</div>
                <input
                  className={styles.invInput}
                  list={`${dlId}-cat`}
                  value={draft.category}
                  onChange={(e) => set({ category: e.target.value })}
                  style={{ width: "100%" }}
                />
              </label>
              <label>
                <div className={m.fieldLabel}>Type</div>
                <input
                  className={styles.invInput}
                  list={`${dlId}-type`}
                  value={draft.type}
                  onChange={(e) => set({ type: e.target.value })}
                  style={{ width: "100%" }}
                />
              </label>
              <label>
                <div className={m.fieldLabel}>Location</div>
                <input
                  className={styles.invInput}
                  list={`${dlId}-loc`}
                  value={draft.location}
                  onChange={(e) => set({ location: e.target.value })}
                  style={{ width: "100%" }}
                />
              </label>
            </div>

            <div className={m.fieldRow4}>
              <label>
                <div className={m.fieldLabel}>Brand</div>
                <input
                  className={styles.invInput}
                  list={`${dlId}-brand`}
                  value={draft.brand}
                  onChange={(e) => set({ brand: e.target.value })}
                  style={{ width: "100%" }}
                />
              </label>
              <label>
                <div className={m.fieldLabel}>Model</div>
                <input
                  className={styles.invInput}
                  value={draft.model}
                  onChange={(e) => set({ model: e.target.value })}
                  style={{ width: "100%" }}
                />
              </label>
              <label>
                <div className={m.fieldLabel}>Quantity</div>
                <input
                  className={styles.invInput}
                  type="number"
                  value={draft.quantity}
                  onChange={(e) => set({ quantity: e.target.value })}
                  style={{ width: "100%" }}
                />
              </label>
              <label>
                <div className={m.fieldLabel}>Tags (comma separated)</div>
                <input
                  className={styles.invInput}
                  value={draft.tags}
                  onChange={(e) => set({ tags: e.target.value })}
                  style={{ width: "100%" }}
                />
              </label>
            </div>

            <label>
              <div className={m.fieldLabel}>Notes</div>
              <textarea
                className={styles.invInput}
                style={{ minHeight: 70, width: "100%" }}
                value={draft.notes}
                onChange={(e) => set({ notes: e.target.value })}
              />
            </label>
          </div>
        </div>

        {/* Purchase section */}
        <div className={m.section}>
          <div className={m.sectionHeader}>Purchase</div>
          <div className={m.sectionBody}>
            <div className={m.fieldRow4}>
              <label>
                <div className={m.fieldLabel}>Date</div>
                <input
                  className={styles.invInput}
                  type="date"
                  value={draft.purchase_date}
                  onChange={(e) => set({ purchase_date: e.target.value })}
                  style={{ width: "100%" }}
                />
              </label>
              <label>
                <div className={m.fieldLabel}>Price</div>
                <input
                  className={styles.invInput}
                  value={draft.purchase_price}
                  onChange={(e) => set({ purchase_price: e.target.value })}
                  style={{ width: "100%" }}
                />
              </label>
              <label>
                <div className={m.fieldLabel}>Currency</div>
                <input
                  className={styles.invInput}
                  value={draft.purchase_currency}
                  onChange={(e) => set({ purchase_currency: e.target.value })}
                  style={{ width: "100%" }}
                />
              </label>
              <label>
                <div className={m.fieldLabel}>Store</div>
                <input
                  className={styles.invInput}
                  list={`${dlId}-store`}
                  value={draft.purchase_store}
                  onChange={(e) => set({ purchase_store: e.target.value })}
                  style={{ width: "100%" }}
                />
              </label>
            </div>

            <div className={m.fieldRow}>
              <label>
                <div className={m.fieldLabel}>Order ref</div>
                <input
                  className={styles.invInput}
                  value={draft.purchase_orderRef}
                  onChange={(e) => set({ purchase_orderRef: e.target.value })}
                  style={{ width: "100%" }}
                />
              </label>

              <label>
                <div className={m.fieldLabel}>
                  OrderId
                  {!draft.purchase_orderId_manual && autoId && (
                    <span className={m.orderIdAuto}> · auto</span>
                  )}
                </div>
                <div className={m.orderIdRow}>
                  <input
                    className={styles.invInput}
                    value={draft.purchase_orderId}
                    onChange={(e) =>
                      set({
                        purchase_orderId: e.target.value,
                        purchase_orderId_manual: true,
                      })
                    }
                    style={{ width: "100%" }}
                  />
                  {draft.purchase_orderId_manual && (
                    <button
                      className={styles.invBtn}
                      style={{ whiteSpace: "nowrap" }}
                      onClick={() =>
                        set({
                          purchase_orderId: autoId || "",
                          purchase_orderId_manual: false,
                        })
                      }
                      title="Reset to auto"
                    >
                      ↺ Auto
                    </button>
                  )}
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Specs section */}
        <div className={m.section}>
          <div className={m.sectionHeader}>
            <span>Specs</span>
            <div className={m.specsToolbar}>
              <button
                className={`${m.specsModeBtn} ${specsMode === "builder" ? m.specsModeActive : ""}`}
                onClick={switchToBuilder}
              >
                ⊞ Builder
              </button>
              <button
                className={`${m.specsModeBtn} ${specsMode === "json" ? m.specsModeActive : ""}`}
                onClick={switchToJson}
              >
                {"{ }"} JSON
              </button>
            </div>
          </div>

          <div className={m.sectionBody}>
            {specsMode === "builder" ? (
              <SpecBuilder
                sections={specSections}
                onChange={setSpecSections}
              />
            ) : (
              <textarea
                className={styles.invInput}
                style={{
                  minHeight: 240,
                  width: "100%",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  fontSize: "0.85rem",
                }}
                value={draft.specs_json}
                onChange={(e) => set({ specs_json: e.target.value })}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Read view ────────────────────────────────────────────────────────

  function renderReadView() {
    if (!item) return null;
    const money = fmtMoney(item.purchase);

    return (
      <>
        <ImageManager
          itemId={item.id}
          images={item.images || []}
          onImagesChanged={onSaved}
          session={session}
          compact
        />

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
          <p className={styles.muted}>Tags: {item.tags.map((t) => `#${t}`).join(" ")}</p>
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
                <div className={styles.muted} style={{ fontWeight: 800, marginBottom: 4 }}>{type}</div>
                <div style={{ display: "grid", gap: 6 }}>
                  {list.map((l) => (
                    <div key={l.id} className={styles.setupItemRow} style={{ padding: "0.55rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div
                          role="button" tabIndex={0} style={{ cursor: "pointer" }}
                          onClick={() => onNavigate(l.to_item_id)}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onNavigate(l.to_item_id); }}
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
            <div className={styles.muted} style={{ fontWeight: 800, marginBottom: 6 }}>Linked from</div>
            <div style={{ display: "grid", gap: 6 }}>
              {links.incoming.map((l) => (
                <div
                  key={l.id} className={styles.setupItemRow}
                  style={{ padding: "0.55rem", cursor: "pointer" }}
                  role="button" tabIndex={0}
                  onClick={() => onNavigate(l.from_item_id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onNavigate(l.from_item_id); }}
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

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <Modal open={open} onClose={onClose}>
      {open && (
        <div>
          <h2 style={{ marginTop: 0 }}>
            {isCreating ? "Add new item" : item!.name}
          </h2>

          {!isCreating && (
            <p className={styles.muted} style={{ marginTop: "0.25rem" }}>
              {[item!.brand, item!.model].filter(Boolean).map(safeText).join(" • ")}
            </p>
          )}

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
                <button className={styles.invBtn} onClick={() => setIsEditing((v) => !v)}>
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
                <button
                  className={styles.invBtn}
                  onClick={() => uploadTriggerRef.current?.click()}
                  title="Upload images"
                >
                  🖼 Add image
                </button>
                <ImageUploadTrigger
                  itemId={item!.id}
                  images={item?.images || []}
                  onImagesChanged={onSaved}
                  session={session}
                  triggerRef={uploadTriggerRef}
                />
              </>
            )}
            {saveError && (
              <span style={{ color: "crimson", alignSelf: "center" }}>
                Error: {saveError}
              </span>
            )}
          </div>

          {isEditing || isCreating ? renderEditForm() : renderReadView()}
        </div>
      )}
    </Modal>
  );
}
