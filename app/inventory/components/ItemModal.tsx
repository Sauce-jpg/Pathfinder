"use client";

import { useEffect, useState, useId, useRef } from "react";
import styles from "../inventory.module.css";
import m from "./ItemModal.module.css";
import { fmtMoney, safeText, slugifyId } from "../helpers";
import { Modal } from "./Modal";
import { Specs } from "./Specs";
import { supabase } from "../../../lib/supabaseClient";
import { ImageManager, ImageUploadTrigger } from "./ImageManager";
import { DbItem, DbItemLink, DbPhoto } from "../types";
import { PhotoStrip } from "./PhotoStrip";
import { ChildCreatorModal } from "./ChildCreatorModal";

// ── Types ──────────────────────────────────────────────────────────────

type Props = {
  item: DbItem | null;
  isCreating: boolean;
  links: { outgoing: DbItemLink[]; incoming: DbItemLink[] };
  allItems: DbItem[];
  photos: DbPhoto[];
  onPhotosChanged: () => void;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
  onNavigate: (id: string) => void;
  onOpenLinkModal: () => void;
  onOpenOrder: (orderId: string) => void;
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
  wg_system: string;
  wg_faction: string;
  wg_subfaction: string;
  wg_unitType: string;
  wg_baseSize: string;
  wg_scale: string;
  wg_buildStatus: string;
  wg_paintStatus: string;
  wg_storage: string;
  wg_priority: string;
  wg_points: string;
  wg_rules: string;
};

// ── Collapsible section ────────────────────────────────────────────────

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={m.section}>
      <div
        className={`${m.sectionHeader} ${!open ? m.sectionHeaderCollapsed : ""}`}
        onClick={() => setOpen((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setOpen((v) => !v); }}
      >
        <span>{title}</span>
        <span className={`${m.sectionChevron} ${!open ? m.sectionChevronCollapsed : ""}`}>▼</span>
      </div>
      <div className={open ? m.sectionBody : m.sectionBodyHidden}>
        {children}
      </div>
    </div>
  );
}

// ── Wargame helpers ────────────────────────────────────────────────────

function isWargame(category: string) {
  return category.trim().toLowerCase() === "wargame";
}

function wargameSuggest(allItems: DbItem[], field: string): string[] {
  const vals = allItems
    .filter((i) => isWargame(i.category || ""))
    .map((i) => i.specs?.wargame?.[field] ?? "")
    .filter(Boolean) as string[];
  return [...new Set(vals)].sort((a, b) => a.localeCompare(b));
}

function wargameStatusSuggest(
  allItems: DbItem[],
  field: "buildStatus" | "paintStatus"
): string[] {
  const vals = allItems
    .filter((i) => isWargame(i.category || ""))
    .map((i) => i.specs?.[field] ?? "")
    .filter(Boolean) as string[];
  return [...new Set(vals)].sort((a, b) => a.localeCompare(b));
}

function wgFromItem(item: DbItem): Partial<EditDraft> {
  const wg = item.specs?.wargame || {};
  return {
    wg_system:      wg.system      ?? "",
    wg_faction:     wg.faction     ?? "",
    wg_subfaction:  wg.subfaction  ?? "",
    wg_unitType:    wg.unitType    ?? "",
    wg_baseSize:    wg.baseSize    ?? "",
    wg_scale:       wg.scale       ?? "",
    wg_buildStatus: item.specs?.buildStatus ?? "",
    wg_paintStatus: item.specs?.paintStatus ?? "",
    wg_storage:     wg.storage     ?? "",
    wg_priority:    wg.priority    ?? "",
    wg_points:      wg.points != null ? String(wg.points) : "",
    wg_rules:       wg.rules       ?? "",
  };
}

function emptyWg(): Partial<EditDraft> {
  return {
    wg_system: "", wg_faction: "", wg_subfaction: "", wg_unitType: "",
    wg_baseSize: "", wg_scale: "", wg_buildStatus: "", wg_paintStatus: "",
    wg_storage: "", wg_priority: "", wg_points: "", wg_rules: "",
  };
}

function mergeWargameIntoSpecs(specsObj: any, draft: EditDraft): any {
  if (!isWargame(draft.category)) return specsObj;

  const wg: Record<string, any> = {};
  if (draft.wg_system)     wg.system     = draft.wg_system;
  if (draft.wg_faction)    wg.faction    = draft.wg_faction;
  if (draft.wg_subfaction) wg.subfaction = draft.wg_subfaction;
  if (draft.wg_unitType)   wg.unitType   = draft.wg_unitType;
  if (draft.wg_baseSize)   wg.baseSize   = draft.wg_baseSize;
  if (draft.wg_scale)      wg.scale      = draft.wg_scale;
  if (draft.wg_storage)    wg.storage    = draft.wg_storage;
  if (draft.wg_priority)   wg.priority   = draft.wg_priority;
  if (draft.wg_points)     wg.points     = draft.wg_points;
  if (draft.wg_rules)      wg.rules      = draft.wg_rules;

  const next = { ...specsObj };
  if (Object.keys(wg).length) next.wargame = wg;
  if (draft.wg_buildStatus) next.buildStatus = draft.wg_buildStatus;
  if (draft.wg_paintStatus) next.paintStatus = draft.wg_paintStatus;

  return next;
}

// ── Spec builder types ─────────────────────────────────────────────────

type SpecField = { key: string; value: string };
type SpecSection = { name: string; fields: SpecField[] };

function specsToSections(specs: any): SpecSection[] {
  if (!specs || typeof specs !== "object") return [];
  return Object.entries(specs)
    .filter(([name]) => !["wargame", "buildStatus", "paintStatus"].includes(name))
    .map(([name, val]) => {
      if (val && typeof val === "object" && !Array.isArray(val)) {
        return {
          name,
          fields: Object.entries(val as Record<string, any>).map(([k, v]) => ({
            key: k, value: String(v ?? ""),
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
    name:                    item.name               ?? "",
    category:                item.category           ?? "",
    type:                    item.type               ?? "",
    brand:                   item.brand              ?? "",
    model:                   item.model              ?? "",
    quantity:                item.quantity           ?? 1,
    location:                item.location           ?? "",
    tags:                    (item.tags || []).join(", "),
    notes:                   item.notes              ?? "",
    purchase_date:           item.purchase?.date     ?? "",
    purchase_price:          item.purchase?.price    ?? "",
    purchase_currency:       item.purchase?.currency ?? "SEK",
    purchase_store:          item.purchase?.store    ?? "",
    purchase_orderRef:       item.purchase?.orderRef ?? "",
    purchase_orderId:        item.purchase?.orderId  ?? "",
    purchase_orderId_manual: !!(item.purchase?.orderId),
    specs_json:              JSON.stringify(item.specs ?? {}, null, 2),
    ...wgFromItem(item),
  } as EditDraft;
}

function emptyDraft(): EditDraft {
  return {
    name: "", category: "", type: "", brand: "", model: "",
    quantity: 1, location: "", tags: "", notes: "",
    purchase_date: "", purchase_price: "", purchase_currency: "SEK",
    purchase_store: "", purchase_orderRef: "", purchase_orderId: "",
    purchase_orderId_manual: false,
    specs_json: "{}",
    ...emptyWg(),
  } as EditDraft;
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
    onChange(sections.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  }
  function removeSection(i: number) {
    onChange(sections.filter((_, idx) => idx !== i));
  }
  function addSection() {
    onChange([...sections, { name: "", fields: [{ key: "", value: "" }] }]);
  }
  function updateField(si: number, fi: number, patch: Partial<SpecField>) {
    onChange(sections.map((s, idx) => {
      if (idx !== si) return s;
      return { ...s, fields: s.fields.map((f, fIdx) => fIdx === fi ? { ...f, ...patch } : f) };
    }));
  }
  function addField(si: number) {
    onChange(sections.map((s, idx) => {
      if (idx !== si) return s;
      return { ...s, fields: [...s.fields, { key: "", value: "" }] };
    }));
  }
  function removeField(si: number, fi: number) {
    onChange(sections.map((s, idx) => {
      if (idx !== si) return s;
      const fields = s.fields.filter((_, fIdx) => fIdx !== fi);
      return { ...s, fields: fields.length ? fields : [{ key: "", value: "" }] };
    }));
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
            <button className={m.iconBtn} onClick={() => removeSection(si)} title="Remove section">✕</button>
          </div>
          <div className={m.specSectionBody}>
            {sec.fields.map((f, fi) => (
              <div key={fi} className={m.specFieldRow}>
                <input className={m.specInput} value={f.key} placeholder="Key"
                  onChange={(e) => updateField(si, fi, { key: e.target.value })} />
                <input className={m.specInput} value={f.value} placeholder="Value"
                  onChange={(e) => updateField(si, fi, { value: e.target.value })} />
                <button className={m.iconBtn} onClick={() => removeField(si, fi)} title="Remove field">✕</button>
              </div>
            ))}
            <button className={m.addFieldBtn} onClick={() => addField(si)}>+ Add field</button>
          </div>
        </div>
      ))}
      <button className={m.addSectionBtn} onClick={addSection}>+ Add section</button>
    </div>
  );
}

// ── Wargame read summary ───────────────────────────────────────────────

const BUILD_STATUS_COLORS: Record<string, string> = {
  boxed:          "#94a3b8",
  partiallyBuilt: "#fb923c",
  assembled:      "#60a5fa",
  primed:         "#c084fc",
};

const PAINT_STATUS_COLORS: Record<string, string> = {
  unpainted: "#94a3b8",
  wip:       "#fb923c",
  finished:  "#4ade80",
  mixed:     "#c084fc",
};

function WargameSummary({ specs }: { specs: any }) {
  if (!specs) return null;
  const wg    = specs.wargame || {};
  const build = specs.buildStatus || "";
  const paint = specs.paintStatus || "";

  const rows: Array<[string, string]> = ([
    ["System",      wg.system],
    ["Faction",     wg.faction],
    ["Sub-faction", wg.subfaction],
    ["Unit type",   wg.unitType],
    ["Base size",   wg.baseSize],
    ["Scale",       wg.scale],
    ["Storage",     wg.storage],
    ["Priority",    wg.priority],
    ["Points",      wg.points],
    ["Rules ref",   wg.rules],
  ] as Array<[string, string]>).filter(([, v]) => v);

  if (!rows.length && !build && !paint) return null;

  return (
    <div style={{ border: "1px solid rgba(0,0,0,0.09)", borderRadius: 12, overflow: "hidden", marginBottom: "1rem" }}>
      <div style={{
        padding: "0.55rem 0.85rem",
        background: "rgba(0,0,0,0.03)",
        borderBottom: rows.length ? "1px solid rgba(0,0,0,0.07)" : "none",
        fontWeight: 700, fontSize: "0.85rem",
        textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.7,
        display: "flex", alignItems: "center", gap: "0.75rem",
      }}>
        <span>⚔️ Wargame</span>
        {build && (
          <span style={{
            fontSize: "0.75rem", padding: "0.15rem 0.55rem", borderRadius: 999,
            background: BUILD_STATUS_COLORS[build] ?? "rgba(0,0,0,0.12)",
            color: "#fff", fontWeight: 700, textTransform: "none", letterSpacing: 0,
          }}>🧩 {build}</span>
        )}
        {paint && (
          <span style={{
            fontSize: "0.75rem", padding: "0.15rem 0.55rem", borderRadius: 999,
            background: PAINT_STATUS_COLORS[paint] ?? "rgba(0,0,0,0.12)",
            color: "#fff", fontWeight: 700, textTransform: "none", letterSpacing: 0,
          }}>🎨 {paint}</span>
        )}
      </div>
      {!!rows.length && (
        <div style={{
          padding: "0.75rem 0.85rem",
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.3rem 1.5rem",
        }}>
          {rows.map(([label, value]) => (
            <div key={label} style={{ display: "flex", gap: "0.5rem", fontSize: "0.92rem" }}>
              <span style={{ opacity: 0.55, fontWeight: 600, whiteSpace: "nowrap" }}>{label}:</span>
              <span>{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────

export function ItemModal({
  item,
  isCreating,
  links,
  allItems,
  photos,
  onClose,
  onSaved,
  onDeleted,
  onNavigate,
  onOpenLinkModal,
  onOpenOrder,
  onPhotosChanged,
  session,
}: Props) {
  const [isCloning,     setIsCloning]     = useState(false);
  const [isEditing,     setIsEditing]     = useState(false);
  const [draft,         setDraft]         = useState<EditDraft>(emptyDraft);
  const [newId,         setNewId]         = useState("");
  const [saving,        setSaving]        = useState(false);
  const [saveError,     setSaveError]     = useState<string | null>(null);
  const [specsMode,     setSpecsMode]     = useState<"builder" | "json">("builder");
  const [specSections,  setSpecSections]  = useState<SpecSection[]>([]);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [childCreatorOpen, setChildCreatorOpen] = useState(false);
  const uploadTriggerRef = useRef<HTMLInputElement>(null);

  const open = !!item || isCreating || isCloning;
  const dlId = useId();

  // Derived suggestion lists — general
  const suggestCategories = uniqSorted(allItems, (i) => i.category);
  const suggestTypes       = uniqSorted(allItems, (i) => i.type);
  const suggestLocations   = uniqSorted(allItems, (i) => i.location);
  const suggestBrands      = uniqSorted(allItems, (i) => i.brand);
  const suggestStores      = uniqSorted(allItems, (i) => i.purchase?.store ?? null);

  // Derived suggestion lists — wargame
  const suggestSystems       = wargameSuggest(allItems, "system");
  const suggestFactions      = wargameSuggest(allItems, "faction");
  const suggestSubfactions   = wargameSuggest(allItems, "subfaction");
  const suggestUnitTypes     = wargameSuggest(allItems, "unitType");
  const suggestBaseSizes     = wargameSuggest(allItems, "baseSize");
  const suggestScales        = wargameSuggest(allItems, "scale");
  const suggestBuildStatuses = wargameStatusSuggest(allItems, "buildStatus");
  const suggestPaintStatuses = wargameStatusSuggest(allItems, "paintStatus");

  // Sync draft when item identity or isCreating changes
  useEffect(() => {
    if (isCreating) {
      setDraft(emptyDraft());
      setNewId("");
      setIsEditing(true);
      setIsCloning(false);
      setSaveError(null);
      setSpecsMode("builder");
      setSpecSections([]);
      setNotesExpanded(false);
      return;
    }
    if (!item) {
      setIsEditing(false);
      setIsCloning(false);
      setDraft(emptyDraft());
      setSaveError(null);
      setNotesExpanded(false);
      return;
    }
    setIsEditing(false);
    setIsCloning(false);
    setSaveError(null);
    setNotesExpanded(false);
    setDraft(draftFromItem(item));
    setSpecSections(specsToSections(item.specs));
    setSpecsMode("builder");
  }, [item?.id, isCreating]);

  // Auto-compose orderId unless manually overridden
  useEffect(() => {
    if (draft.purchase_orderId_manual) return;
    const auto = autoOrderId(draft.purchase_store, draft.purchase_date, draft.purchase_orderRef);
    if (auto) setDraft((d) => ({ ...d, purchase_orderId: auto }));
  }, [draft.purchase_store, draft.purchase_date, draft.purchase_orderRef, draft.purchase_orderId_manual]);

  function switchToJson() {
    setDraft((d) => ({ ...d, specs_json: sectionsToJson(specSections) }));
    setSpecsMode("json");
  }

  function switchToBuilder() {
    try {
      setSpecSections(specsToSections(JSON.parse(draft.specs_json || "{}")));
      setSpecsMode("builder");
    } catch {
      alert("Fix JSON errors before switching to builder.");
    }
  }

  function set(patch: Partial<EditDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  // ── Clone ────────────────────────────────────────────────────────────

  function handleClone() {
    if (!item) return;
    setDraft(draftFromItem(item));
    setSpecSections(specsToSections(item.specs));
    setNewId("");
    setSpecsMode("builder");
    setIsCloning(true);
    setIsEditing(false);
    setSaveError(null);
    setNotesExpanded(false);
  }

  // ── Payload builders ─────────────────────────────────────────────────

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

    specsObj = mergeWargameIntoSpecs(specsObj, draft);

    const tagsArr = String(draft.tags || "")
      .split(",").map((t) => t.trim()).filter(Boolean);

    return {
      ...(id ? { id } : {}),
      name:     draft.name     || (id ?? ""),
      category: draft.category || null,
      type:     draft.type     || null,
      brand:    draft.brand    || null,
      model:    draft.model    || null,
      quantity: Number(draft.quantity) || 1,
      location: draft.location || null,
      tags:     tagsArr,
      notes:    draft.notes    || null,
      purchase: buildPurchase(isCloning ? {} : item?.purchase),
      specs:    specsObj,
    };
  }

  // ── CRUD handlers ────────────────────────────────────────────────────

  async function handleCreate() {
    if (!session?.user?.id) return;
    setSaving(true); setSaveError(null);
    try {
      const id = (newId || slugifyId(draft.name)).trim();
      if (!id) throw new Error("ID is required (enter a name or an id).");
      if (allItems.some((x) => x.id === id))
        throw new Error(`An item with id "${id}" already exists.`);
      const { error } = await supabase.from("inventory_items").insert({
        ...buildPayload(id),
        user_id: session.user.id, images: [], purchase_history: [],
      });
      if (error) throw new Error(error.message);
      setIsCloning(false);
      onSaved();
      onNavigate(id);
    } catch (e: any) {
      setSaveError(e?.message || String(e));
    } finally { setSaving(false); }
  }

  async function handleSave() {
    if (!item) return;
    setSaving(true); setSaveError(null);
    try {
      const { error } = await supabase
        .from("inventory_items").update(buildPayload()).eq("id", item.id);
      if (error) throw new Error(error.message);
      setIsEditing(false);
      onSaved();
    } catch (e: any) {
      setSaveError(e?.message || String(e));
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!item) return;
    if (!confirm("Delete this item? This cannot be undone.")) return;
    const { error } = await supabase.from("inventory_items").delete().eq("id", item.id);
    if (error) { alert(error.message); return; }
    onDeleted();
  }

  async function handleDeleteLink(linkId: string) {
    if (!confirm("Delete link?")) return;
    const { error } = await supabase.from("inventory_item_links").delete().eq("id", linkId);
    if (error) { alert(error.message); return; }
    onSaved();
  }

  function itemLabel(id: string) {
    return allItems.find((x) => x.id === id)?.name ?? id;
  }

  // ── Edit form ────────────────────────────────────────────────────────

  function renderEditForm() {
    const autoId      = autoOrderId(draft.purchase_store, draft.purchase_date, draft.purchase_orderRef);
    const showWargame = isWargame(draft.category);

    return (
      <div>
        {/* Datalists — general */}
        <DL id={`${dlId}-cat`}   options={suggestCategories} />
        <DL id={`${dlId}-type`}  options={suggestTypes} />
        <DL id={`${dlId}-loc`}   options={suggestLocations} />
        <DL id={`${dlId}-brand`} options={suggestBrands} />
        <DL id={`${dlId}-store`} options={suggestStores} />

        {/* Datalists — wargame */}
        <DL id={`${dlId}-wg-system`}     options={suggestSystems} />
        <DL id={`${dlId}-wg-faction`}    options={suggestFactions} />
        <DL id={`${dlId}-wg-subfaction`} options={suggestSubfactions} />
        <DL id={`${dlId}-wg-unitType`}   options={suggestUnitTypes} />
        <DL id={`${dlId}-wg-baseSize`}   options={suggestBaseSizes} />
        <DL id={`${dlId}-wg-scale`}      options={suggestScales} />
        <DL id={`${dlId}-wg-build`}      options={suggestBuildStatuses} />
        <DL id={`${dlId}-wg-paint`}      options={suggestPaintStatuses} />

        {/* ── Details (open by default) ── */}
        <CollapsibleSection title="Details" defaultOpen={true}>
          <div className={m.fieldRow4}>
            <label>
              <div className={m.fieldLabel}>Name *</div>
              <input className={styles.invInput} value={draft.name}
                onChange={(e) => set({ name: e.target.value })} style={{ width: "100%" }} />
            </label>
            <label>
              <div className={m.fieldLabel}>Category</div>
              <input className={styles.invInput} list={`${dlId}-cat`} value={draft.category}
                onChange={(e) => set({ category: e.target.value })} style={{ width: "100%" }} />
            </label>
            <label>
              <div className={m.fieldLabel}>Type</div>
              <input className={styles.invInput} list={`${dlId}-type`} value={draft.type}
                onChange={(e) => set({ type: e.target.value })} style={{ width: "100%" }} />
            </label>
            <label>
              <div className={m.fieldLabel}>Location</div>
              <input className={styles.invInput} list={`${dlId}-loc`} value={draft.location}
                onChange={(e) => set({ location: e.target.value })} style={{ width: "100%" }} />
            </label>
          </div>

          <div className={m.fieldRow4}>
            <label>
              <div className={m.fieldLabel}>Brand</div>
              <input className={styles.invInput} list={`${dlId}-brand`} value={draft.brand}
                onChange={(e) => set({ brand: e.target.value })} style={{ width: "100%" }} />
            </label>
            <label>
              <div className={m.fieldLabel}>Model</div>
              <input className={styles.invInput} value={draft.model}
                onChange={(e) => set({ model: e.target.value })} style={{ width: "100%" }} />
            </label>
            <label>
              <div className={m.fieldLabel}>Quantity</div>
              <input className={styles.invInput} type="number" value={draft.quantity}
                onChange={(e) => set({ quantity: e.target.value })} style={{ width: "100%" }} />
            </label>
            <label>
              <div className={m.fieldLabel}>Tags (comma separated)</div>
              <input className={styles.invInput} value={draft.tags}
                onChange={(e) => set({ tags: e.target.value })} style={{ width: "100%" }} />
            </label>
          </div>

          <label>
            <div className={m.fieldLabel}>Notes</div>
            <textarea
              className={`${styles.invInput} ${m.notesTextarea} ${notesExpanded ? m.notesTextareaExpanded : ""}`}
              value={draft.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
            <button
              type="button"
              className={m.notesExpandBtn}
              onClick={() => setNotesExpanded((v) => !v)}
            >
              {notesExpanded ? "▲ Collapse notes" : "▼ Expand notes"}
            </button>
          </label>
        </CollapsibleSection>

        {/* ── Purchase (open by default) ── */}
        <CollapsibleSection title="Purchase" defaultOpen={true}>
          <div className={m.fieldRow4}>
            <label>
              <div className={m.fieldLabel}>Date</div>
              <input className={styles.invInput} type="date" value={draft.purchase_date}
                onChange={(e) => set({ purchase_date: e.target.value })} style={{ width: "100%" }} />
            </label>
            <label>
              <div className={m.fieldLabel}>Price</div>
              <input className={styles.invInput} value={draft.purchase_price}
                onChange={(e) => set({ purchase_price: e.target.value })} style={{ width: "100%" }} />
            </label>
            <label>
              <div className={m.fieldLabel}>Currency</div>
              <input className={styles.invInput} value={draft.purchase_currency}
                onChange={(e) => set({ purchase_currency: e.target.value })} style={{ width: "100%" }} />
            </label>
            <label>
              <div className={m.fieldLabel}>Store</div>
              <input className={styles.invInput} list={`${dlId}-store`} value={draft.purchase_store}
                onChange={(e) => set({ purchase_store: e.target.value })} style={{ width: "100%" }} />
            </label>
          </div>

          <div className={m.fieldRow}>
            <label>
              <div className={m.fieldLabel}>Order ref</div>
              <input className={styles.invInput} value={draft.purchase_orderRef}
                onChange={(e) => set({ purchase_orderRef: e.target.value })} style={{ width: "100%" }} />
            </label>
            <label>
              <div className={m.fieldLabel}>
                OrderId
                {!draft.purchase_orderId_manual && autoId && (
                  <span className={m.orderIdAuto}> · auto</span>
                )}
              </div>
              <div className={m.orderIdRow}>
                <input className={styles.invInput} value={draft.purchase_orderId}
                  onChange={(e) => set({ purchase_orderId: e.target.value, purchase_orderId_manual: true })}
                  style={{ width: "100%" }} />
                {draft.purchase_orderId_manual && (
                  <button className={styles.invBtn} style={{ whiteSpace: "nowrap" }}
                    onClick={() => set({ purchase_orderId: autoId || "", purchase_orderId_manual: false })}
                    title="Reset to auto">↺ Auto</button>
                )}
              </div>
            </label>
          </div>
        </CollapsibleSection>

        {/* ── Wargame (open by default, only shown when category = Wargame) ── */}
        {showWargame && (
          <CollapsibleSection title="⚔️ Wargame" defaultOpen={true}>
            <div className={m.fieldRow4}>
              <label>
                <div className={m.fieldLabel}>System</div>
                <input className={styles.invInput} list={`${dlId}-wg-system`} value={draft.wg_system}
                  onChange={(e) => set({ wg_system: e.target.value })} style={{ width: "100%" }}
                  placeholder="e.g. Age of Sigmar" />
              </label>
              <label>
                <div className={m.fieldLabel}>Faction</div>
                <input className={styles.invInput} list={`${dlId}-wg-faction`} value={draft.wg_faction}
                  onChange={(e) => set({ wg_faction: e.target.value })} style={{ width: "100%" }}
                  placeholder="e.g. Skaven" />
              </label>
              <label>
                <div className={m.fieldLabel}>Sub-faction</div>
                <input className={styles.invInput} list={`${dlId}-wg-subfaction`} value={draft.wg_subfaction}
                  onChange={(e) => set({ wg_subfaction: e.target.value })} style={{ width: "100%" }}
                  placeholder="e.g. Verminus" />
              </label>
              <label>
                <div className={m.fieldLabel}>Unit type</div>
                <input className={styles.invInput} list={`${dlId}-wg-unitType`} value={draft.wg_unitType}
                  onChange={(e) => set({ wg_unitType: e.target.value })} style={{ width: "100%" }}
                  placeholder="e.g. Infantry" />
              </label>
            </div>

            <div className={m.fieldRow4}>
              <label>
                <div className={m.fieldLabel}>Base size</div>
                <input className={styles.invInput} list={`${dlId}-wg-baseSize`} value={draft.wg_baseSize}
                  onChange={(e) => set({ wg_baseSize: e.target.value })} style={{ width: "100%" }}
                  placeholder="e.g. 25mm" />
              </label>
              <label>
                <div className={m.fieldLabel}>Scale</div>
                <input className={styles.invInput} list={`${dlId}-wg-scale`} value={draft.wg_scale}
                  onChange={(e) => set({ wg_scale: e.target.value })} style={{ width: "100%" }}
                  placeholder="e.g. 28mm heroic" />
              </label>
              <label>
                <div className={m.fieldLabel}>Points cost</div>
                <input className={styles.invInput} type="number" value={draft.wg_points}
                  onChange={(e) => set({ wg_points: e.target.value })} style={{ width: "100%" }}
                  placeholder="e.g. 120" />
              </label>
              <label>
                <div className={m.fieldLabel}>Rules reference</div>
                <input className={styles.invInput} value={draft.wg_rules}
                  onChange={(e) => set({ wg_rules: e.target.value })} style={{ width: "100%" }}
                  placeholder="e.g. Battletome p.42" />
              </label>
            </div>

            <div className={m.fieldRow4}>
              <label>
                <div className={m.fieldLabel}>Build status</div>
                <input className={styles.invInput} list={`${dlId}-wg-build`} value={draft.wg_buildStatus}
                  onChange={(e) => set({ wg_buildStatus: e.target.value })} style={{ width: "100%" }}
                  placeholder="e.g. assembled" />
              </label>
              <label>
                <div className={m.fieldLabel}>Paint status</div>
                <input className={styles.invInput} list={`${dlId}-wg-paint`} value={draft.wg_paintStatus}
                  onChange={(e) => set({ wg_paintStatus: e.target.value })} style={{ width: "100%" }}
                  placeholder="e.g. wip" />
              </label>
              <label>
                <div className={m.fieldLabel}>Storage location</div>
                <input className={styles.invInput} value={draft.wg_storage}
                  onChange={(e) => set({ wg_storage: e.target.value })} style={{ width: "100%" }}
                  placeholder="e.g. Box A, Shelf 2" />
              </label>
              <label>
                <div className={m.fieldLabel}>Priority</div>
                <select className={styles.invSelect} value={draft.wg_priority}
                  onChange={(e) => set({ wg_priority: e.target.value })} style={{ width: "100%" }}>
                  <option value="">—</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
            </div>
          </CollapsibleSection>
        )}

        {/* ── Specs (collapsed by default — most complex) ── */}
        <CollapsibleSection title="Specs" defaultOpen={false}>
          <div className={m.specsToolbar}>
            <button className={`${m.specsModeBtn} ${specsMode === "builder" ? m.specsModeActive : ""}`}
              onClick={switchToBuilder}>⊞ Builder</button>
            <button className={`${m.specsModeBtn} ${specsMode === "json" ? m.specsModeActive : ""}`}
              onClick={switchToJson}>{"{ }"} JSON</button>
          </div>
          {specsMode === "builder" ? (
            <SpecBuilder sections={specSections} onChange={setSpecSections} />
          ) : (
            <textarea className={styles.invInput}
              style={{ minHeight: 240, width: "100%", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: "0.85rem" }}
              value={draft.specs_json} onChange={(e) => set({ specs_json: e.target.value })} />
          )}
        </CollapsibleSection>
      </div>
    );
  }

  // ── Read view ────────────────────────────────────────────────────────

  function renderReadView() {
    if (!item) return null;
    const money              = fmtMoney(item.purchase);
    const showWargameSummary = isWargame(item.category || "");

    return (
      <>
        <ImageManager
          itemId={item.id}
          images={item.images || []}
          onImagesChanged={onSaved}
          session={session}
          compact
        />

        {showWargameSummary && <WargameSummary specs={item.specs} />}

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
              {money && (
                <li>
                  <b>Price:</b> {money}
                  {item.purchase?.inherited && (
                    <span className={styles.muted} style={{ fontSize: "0.82rem", marginLeft: "0.4rem" }}>
                      (inherited from parent — not counted separately)
                    </span>
                  )}
                </li>
              )}
              {item.purchase?.store    && <li><b>Store:</b> {safeText(item.purchase.store)}</li>}
              {item.purchase?.orderRef && <li><b>Order ref:</b> {safeText(item.purchase.orderRef)}</li>}
              {item.purchase?.orderId && (
                <li>
                  <b>OrderId:</b>{" "}
                  <button
                    onClick={() => onOpenOrder(item.purchase.orderId)}
                    style={{
                      background: "none", border: "none", padding: 0,
                      cursor: "pointer", color: "inherit",
                      textDecoration: "underline", textDecorationStyle: "dotted",
                      font: "inherit", opacity: 0.8,
                    }}
                  >
                    {safeText(item.purchase.orderId)}
                  </button>
                </li>
              )}
            </ul>
          </div>
        </div>

        {!!(item.tags || []).length && (
          <p className={styles.muted}>Tags: {item.tags.map((t) => `#${t}`).join(" ")}</p>
        )}

        {/* Notes — pre-wrap preserves paragraphs and line breaks */}
        {item.notes && (
          <>
            <h3>Notes</h3>
            <p className={m.notesReadView}>{item.notes}</p>
          </>
        )}

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
                        <div role="button" tabIndex={0} style={{ cursor: "pointer" }}
                          onClick={() => onNavigate(l.to_item_id)}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onNavigate(l.to_item_id); }}>
                          <div style={{ fontWeight: 800 }}>{itemLabel(l.to_item_id)}</div>
                          {l.note && <div className={styles.muted}>{l.note}</div>}
                        </div>
                        <button className={styles.invBtn}
                          style={{ padding: "0.35rem 0.6rem", height: "fit-content" }}
                          onClick={() => handleDeleteLink(l.id)}>Remove</button>
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
                <div key={l.id} className={styles.setupItemRow}
                  style={{ padding: "0.55rem", cursor: "pointer" }}
                  role="button" tabIndex={0}
                  onClick={() => onNavigate(l.from_item_id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onNavigate(l.from_item_id); }}>
                  <div style={{ fontWeight: 800 }}>{itemLabel(l.from_item_id)}</div>
                  <div className={styles.muted}>{l.relation_type}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Part of (child items) */}
        {item.parent_id && (() => {
          const parent = allItems.find((x) => x.id === item.parent_id);
          if (!parent) return null;
          return (
            <div style={{ marginTop: "1rem" }}>
              <h3 style={{ marginBottom: "0.4rem" }}>Part of</h3>
              <div
                className={styles.setupItemRow}
                style={{ padding: "0.6rem 0.85rem", cursor: "pointer" }}
                role="button"
                tabIndex={0}
                onClick={() => onNavigate(parent.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onNavigate(parent.id); }}
              >
                <div style={{ fontWeight: 800 }}>{parent.name}</div>
                <div className={styles.muted} style={{ fontSize: "0.88rem" }}>
                  {[parent.category, parent.brand].filter(Boolean).join(" · ")}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Contains (parent items — wargame only) */}
        {(item.category ?? "").trim().toLowerCase() === "wargame" && (() => {
          const children = allItems.filter((x) => x.parent_id === item.id);
          if (!children.length && !isEditing) return (
            <div style={{ marginTop: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                <h3 style={{ margin: 0 }}>Contains</h3>
                <button
                  className={styles.invBtn}
                  style={{ fontSize: "0.82rem", padding: "0.25rem 0.65rem" }}
                  onClick={() => setChildCreatorOpen(true)}
                >
                  + Add units
                </button>
              </div>
              <p className={styles.muted} style={{ fontSize: "0.88rem" }}>
                No child items yet.
              </p>
            </div>
          );
          if (!children.length) return null;
          return (
            <div style={{ marginTop: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                <h3 style={{ margin: 0 }}>Contains</h3>
                <button
                  className={styles.invBtn}
                  style={{ fontSize: "0.82rem", padding: "0.25rem 0.65rem" }}
                  onClick={() => setChildCreatorOpen(true)}
                >
                  + Add units
                </button>
              </div>
              <div style={{ display: "grid", gap: "0.4rem" }}>
                {children.map((child) => {
                  const build = child.specs?.buildStatus || "";
                  const paint = child.specs?.paintStatus || "";
                  return (
                    <div
                      key={child.id}
                      className={styles.setupItemRow}
                      style={{ padding: "0.6rem 0.85rem", cursor: "pointer" }}
                      role="button"
                      tabIndex={0}
                      onClick={() => onNavigate(child.id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onNavigate(child.id); }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700 }}>{child.name}</span>
                        {child.quantity > 1 && (
                          <span className={styles.badge}>x{child.quantity}</span>
                        )}
                        {child.specs?.wargame?.faction && (
                          <span className={styles.badge}>{child.specs.wargame.faction}</span>
                        )}
                        {child.specs?.wargame?.unitType && (
                          <span className={styles.badge}>{child.specs.wargame.unitType}</span>
                        )}
                        {build && (
                          <span className={styles.badge}>🧩 {build}</span>
                        )}
                        {paint && (
                          <span className={styles.badge}>🎨 {paint}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        <Specs specs={item.specs} />

        <PhotoStrip
          itemId={item.id}
          photos={photos}
          allItems={allItems}
          onPhotoSaved={async () => onPhotosChanged()}
          onPhotoDeleted={onPhotosChanged}
          session={session}
        />
      </>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <>
    <Modal open={open} onClose={onClose}>
      {open && (
        <div>
          <h2 style={{ marginTop: 0 }}>
            {isCreating ? "Add new item" : isCloning ? `Clone — ${item!.name}` : item!.name}
          </h2>

          {!isCreating && !isCloning && (
            <p className={styles.muted} style={{ marginTop: "0.25rem" }}>
              {[item!.brand, item!.model].filter(Boolean).map(safeText).join(" • ")}
            </p>
          )}

          {(isCreating || isCloning) && (
            <div style={{ display: "grid", gap: "0.35rem", margin: "0.5rem 0 0.75rem" }}>
              <div className={styles.muted}>ID (slug)</div>
              <input className={styles.invInput} value={newId}
                placeholder="auto from name (or type your own)"
                onChange={(e) => setNewId(slugifyId(e.target.value))} />
              <div className={styles.muted} style={{ fontSize: "0.9rem" }}>
                Suggested: <b>{slugifyId(draft.name) || "—"}</b>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", margin: "0.75rem 0" }}>
            {isCreating || isCloning ? (
              <>
                <button className={styles.invBtn} onClick={handleCreate} disabled={saving}>
                  {saving ? "Creating…" : "Create"}
                </button>
                <button className={styles.invBtn}
                  onClick={() => { setIsCloning(false); setSaveError(null); if (isCreating) onClose(); }}
                  disabled={saving}>Cancel</button>
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
                <button className={styles.invBtn} onClick={handleDelete} disabled={saving}>🗑 Delete</button>
                <button className={styles.invBtn} onClick={onOpenLinkModal}>+ Link item</button>
                <button className={styles.invBtn} onClick={() => uploadTriggerRef.current?.click()}
                  title="Upload images">🖼 Add image</button>
                <button className={styles.invBtn} onClick={handleClone}>⧉ Clone item</button>
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
              <span style={{ color: "crimson", alignSelf: "center" }}>Error: {saveError}</span>
            )}
          </div>

          {isEditing || isCreating || isCloning ? renderEditForm() : renderReadView()}
        </div>
      )}
    </Modal>

    <ChildCreatorModal
      open={childCreatorOpen}
      parent={item}
      allItems={allItems}
      onClose={() => setChildCreatorOpen(false)}
      onSaved={() => { setChildCreatorOpen(false); onSaved(); }}
      session={session}
    />
    </>
  );
}
