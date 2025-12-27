"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import styles from "./inventory.module.css";

type DbItem = {
  id: string;
  user_id: string;
  name: string;
  type: string | null;
  category: string | null;
  brand: string | null;
  model: string | null;
  quantity: number;
  location: string | null;
  tags: string[];
  notes: string | null;
  images: string[];
  purchase: any; // jsonb
  specs: any; // jsonb
  purchase_history: any; // jsonb
};

type DbSetup = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  parent_setup_id: string | null;
};

type DbSetupItem = {
  id: string;
  setup_id: string;
  item_id: string;
  user_id: string;
  position: number;
  include_in_parent_summary: boolean;
};

type Tab = "inventory" | "setups" | "orders";

type Filters = {
  q: string;
  category: string;
  location: string;
  buildStatus: string;
  paintStatus: string;
  sort: "name-asc" | "name-desc" | "date-desc" | "date-asc" | "price-desc" | "price-asc";
};

const DEFAULT_FILTERS: Filters = {
  q: "",
  category: "",
  location: "",
  buildStatus: "",
  paintStatus: "",
  sort: "name-asc",
};



function slugifyId(input: string) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}




function safeText(v: any) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function parseDate(d?: string | null) {
  if (!d) return null;
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function fmtMoney(purchase: any) {
  if (!purchase || purchase.price == null) return "";
  const cur = purchase.currency || "";
  const price = Number(purchase.price);
  if (Number.isNaN(price)) return "";
  return `${price.toLocaleString()} ${cur}`.trim();
}

function uniq(arr: string[]) {
  return [...new Set(arr.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function itemSearchText(item: DbItem) {
  const parts = [
    item.name,
    item.brand,
    item.model,
    item.category,
    item.type,
    item.location,
    ...(item.tags || []),
  ];
  return parts.map(safeText).join(" ").toLowerCase();
}

function getOrderId(item: DbItem) {
  // support either top-level orderId (if you ever add it) or purchase.orderId
  return (item as any).orderId || (item.purchase && item.purchase.orderId) || "";
}

function humanKey(key: string) {
  return String(key)
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function slugifySpecId(key: string) {
  return (
    "spec-" +
    String(key)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
  );
}

function renderKVTable(obj: Record<string, any>) {
  const rows = Object.entries(obj).map(([k, v]) => {
    const val = v && typeof v === "object" ? JSON.stringify(v) : safeText(v);
    return (
      <tr key={k}>
        <td className={styles.specK}>{humanKey(k)}</td>
        <td className={styles.specV}>{val}</td>
      </tr>
    );
  });

  return (
    <table className={styles.specTable}>
      <tbody>{rows}</tbody>
    </table>
  );
}

function Specs({ specs }: { specs: any }) {
  if (!specs || typeof specs !== "object") return null;

  const entries = Object.entries(specs).filter(([_, v]) => v != null && v !== "");
  if (!entries.length) return null;

  const toc = entries
    .map(([sectionKey, sectionVal]) => {
      const hasContent =
        typeof sectionVal !== "object" ? true : Object.keys(sectionVal || {}).length > 0;
      if (!hasContent) return null;
      const id = slugifySpecId(sectionKey);
      return (
        <a key={sectionKey} className={styles.specTocLink} href={`#${id}`}>
          {humanKey(sectionKey)}
        </a>
      );
    })
    .filter(Boolean);

  return (
    <>
      {!!toc.length && (
        <div className={styles.specToc}>
          <div className={styles.specTocTitle}>Specs</div>
          <div className={styles.specTocLinks}>{toc}</div>
        </div>
      )}

      <div>
        {entries.map(([sectionKey, sectionVal]) => {
          const id = slugifySpecId(sectionKey);
          if (typeof sectionVal !== "object") {
            return (
              <div key={sectionKey}>
                <h4 id={id} className={styles.specSectionTitle}>
                  {humanKey(sectionKey)}
                </h4>
                {renderKVTable({ value: sectionVal })}
              </div>
            );
          }
          return (
            <div key={sectionKey}>
              <h4 id={id} className={styles.specSectionTitle}>
                {humanKey(sectionKey)}
              </h4>
              {renderKVTable(sectionVal || {})}
            </div>
          );
        })}
      </div>
    </>
  );
}

function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={styles.modalOverlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modalContent}>
        <div className={styles.modalCloseRow}>
          <button className={styles.modalCloseBtn} onClick={onClose} title="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function getViews(): Record<string, Partial<Filters>> {
  try {
    return JSON.parse(localStorage.getItem("inventoryViews") || "{}");
  } catch {
    return {};
  }
}
function setViews(v: Record<string, Partial<Filters>>) {
  localStorage.setItem("inventoryViews", JSON.stringify(v));
}

export default function InventoryPage() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");

  const [tab, setTab] = useState<Tab>("inventory");

  const [items, setItems] = useState<DbItem[]>([]);
  const [setups, setSetups] = useState<DbSetup[]>([]);
  const [setupItems, setSetupItems] = useState<DbSetupItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [activeOrderId, setActiveOrderId] = useState<string>("");

  const [page, setPage] = useState(1);
  const pageSize = 48;

  const [selectedSetupId, setSelectedSetupId] = useState<string | null>(null);
  const [showAccessories, setShowAccessories] = useState(false);

  const [modalItemId, setModalItemId] = useState<string | null>(null);
  const [modalOrderId, setModalOrderId] = useState<string | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [newId, setNewId] = useState<string>("");

  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [setupCreateOpen, setSetupCreateOpen] = useState(false);
  const [setupDraft, setSetupDraft] = useState({ name: "", description: "", parent_setup_id: "" });
  const [setupSelectedItemIds, setSetupSelectedItemIds] = useState<string[]>([]);

  const [savedViews, setSavedViewsState] = useState<Record<string, Partial<Filters>>>({});

  // auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  // load saved views
  useEffect(() => {
    if (!session) return;
    setSavedViewsState(getViews());
  }, [session]);

  async function loginGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/inventory` },
    });
    if (error) alert(error.message);
  }

  async function loginEmail() {
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) alert(error.message);
    else alert("Check your email for the login link.");
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  // load from supabase
  async function loadAll() {
    if (!session?.user?.id) return;

    setLoading(true);
    setLoadError(null);

    const [itemsRes, setupsRes, joinRes] = await Promise.all([
      supabase.from("inventory_items").select("*").order("name", { ascending: true }),
      supabase.from("inventory_setups").select("*").order("name", { ascending: true }),
      supabase.from("inventory_setup_items").select("*").order("position", { ascending: true }),
    ]);

    if (itemsRes.error) setLoadError(itemsRes.error.message);
    if (setupsRes.error) setLoadError(setupsRes.error.message);
    if (joinRes.error) setLoadError(joinRes.error.message);

    setItems((itemsRes.data || []) as DbItem[]);
    setSetups((setupsRes.data || []) as DbSetup[]);
    setSetupItems((joinRes.data || []) as DbSetupItem[]);

    setLoading(false);
  }


  function openCreateModal() {
    setModalOrderId(null);
    setModalItemId(null);

    setIsCreating(true);
    setIsEditing(true); // start in edit mode
    setSaveError(null);

    const draft = {
      name: "",
      category: "",
      type: "",
      brand: "",
      model: "",
      quantity: 1,
      location: "",
      tags: "",
      notes: "",

      purchase_date: "",
      purchase_price: "",
      purchase_currency: "SEK",
      purchase_store: "",
      purchase_orderRef: "",
      purchase_orderId: "",

      specs_json: "{}",
    };

    setEditDraft(draft);
    setNewId("");
  }

  async function toggleIncludeInParent(setupId: string, itemId: string, value: boolean) {
    const si = setupItemBySetupAndItem.get(`${setupId}:${itemId}`);
    if (!si) return;

    const { error } = await supabase
      .from("inventory_setup_items")
      .update({ include_in_parent_summary: value })
      .eq("setup_id", setupId)
      .eq("item_id", itemId);

    if (error) {
      alert(error.message);
      return;
    }

    await loadAll();
  }


  async function createNewItem() {
    if (!session?.user?.id) return;
    if (!editDraft) return;

    setSaving(true);
    setSaveError(null);

    try {
      const id = (newId || slugifyId(editDraft.name)).trim();
      if (!id) throw new Error("ID is required (enter a name or an id).");

      // Prevent accidental duplicates client-side (still protected by DB unique id)
      if (items.some((x) => x.id === id)) {
        throw new Error(`An item with id "${id}" already exists.`);
      }

      let specsObj: any = {};
      try {
        specsObj = editDraft.specs_json ? JSON.parse(editDraft.specs_json) : {};
      } catch {
        throw new Error("Specs JSON is invalid. Fix it or clear it.");
      }

      const tagsArr =
        String(editDraft.tags || "")
          .split(",")
          .map((t: string) => t.trim())
          .filter(Boolean);

      const purchase: any = {
        date: editDraft.purchase_date || null,
        price: editDraft.purchase_price === "" ? null : editDraft.purchase_price,
        currency: editDraft.purchase_currency || "SEK",
        store: editDraft.purchase_store || null,
        orderRef: editDraft.purchase_orderRef || null,
        orderId: editDraft.purchase_orderId || null,
      };

      if (purchase.price != null) {
        const n = typeof purchase.price === "number" ? purchase.price : Number(purchase.price);
        purchase.price = Number.isFinite(n) ? n : purchase.price;
      }

      const payload = {
        id,
        user_id: session.user.id,
        name: editDraft.name || id,
        category: editDraft.category || null,
        type: editDraft.type || null,
        brand: editDraft.brand || null,
        model: editDraft.model || null,
        quantity: Number(editDraft.quantity) || 1,
        location: editDraft.location || null,
        tags: tagsArr,
        notes: editDraft.notes || null,
        images: [],              // you can add later
        purchase,
        specs: specsObj,
        purchase_history: [],    // keep for later
      };

      const { error } = await supabase.from("inventory_items").insert(payload);
      if (error) throw new Error(error.message);

      // refresh and open the newly created item
      await loadAll();
      setIsCreating(false);
      setIsEditing(false);
      setModalItemId(id);
    } catch (e: any) {
      setSaveError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }





  async function createSetup() {
    if (!session?.user?.id) return;

    const name = setupDraft.name.trim();
    if (!name) {
      alert("Setup name is required.");
      return;
    }

    const payload = {
      user_id: session.user.id,
      name,
      description: setupDraft.description.trim() || null,
      parent_setup_id: setupDraft.parent_setup_id || null,
    };

    const { data, error } = await supabase
      .from("inventory_setups")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    const setupId = data.id as string;

    // Add selected items into the setup
    if (setupSelectedItemIds.length) {
      const rows = setupSelectedItemIds.map((itemId, idx) => ({
        user_id: session.user.id,
        setup_id: setupId,
        item_id: itemId,
        position: idx + 1,
      }));

      const ins = await supabase.from("inventory_setup_items").insert(rows);
      if (ins.error) {
        alert("Setup created, but adding items failed: " + ins.error.message);
        // still continue
      }
    }

    setSetupCreateOpen(false);
    setSetupDraft({ name: "", description: "", parent_setup_id: "" });
    setSetupSelectedItemIds([]);

   await loadAll();

    // auto-select new setup in UI
    setSelectedSetupId(setupId);
  }





  


  
  async function saveItemEdits(itemId: string) {
    if (!editDraft) return;
    setSaving(true);
    setSaveError(null);

    try {
      let specsObj: any = {};
      try {
        specsObj = editDraft.specs_json ? JSON.parse(editDraft.specs_json) : {};
      } catch {
        throw new Error("Specs JSON is invalid. Fix it or clear it.");
      }

      const nextPurchase: any = {
        ...(modalItem?.purchase || {}),
        date: editDraft.purchase_date || null,
        price: editDraft.purchase_price === "" ? null : editDraft.purchase_price,
        currency: editDraft.purchase_currency || "SEK",
        store: editDraft.purchase_store || null,
        orderRef: editDraft.purchase_orderRef || null,
        orderId: editDraft.purchase_orderId || null,
      };

      // If price looks numeric, store it as a number
      if (nextPurchase.price != null) {
        const n = typeof nextPurchase.price === "number" ? nextPurchase.price : Number(nextPurchase.price);
        nextPurchase.price = Number.isFinite(n) ? n : nextPurchase.price;
      }

      const tagsArr =
        String(editDraft.tags || "")
          .split(",")
          .map((t: string) => t.trim())
          .filter(Boolean);

      const payload = {
        name: editDraft.name,
        category: editDraft.category || null,
        type: editDraft.type || null,
        brand: editDraft.brand || null,
        model: editDraft.model || null,
        quantity: Number(editDraft.quantity) || 1,
        location: editDraft.location || null,
        tags: tagsArr,
        notes: editDraft.notes || null,
        purchase: nextPurchase,
        specs: specsObj,
      };

      const { error } = await supabase
        .from("inventory_items")
        .update(payload)
        .eq("id", itemId);

      if (error) throw new Error(error.message);

      setIsEditing(false);
      await loadAll();
    } catch (e: any) {
      setSaveError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(itemId: string) {
    if (!confirm("Delete this item? This cannot be undone.")) return;

    const { error } = await supabase.from("inventory_items").delete().eq("id", itemId);
    if (error) {
      alert(error.message);
      return;
    }

    setModalItemId(null);
    await loadAll();
  }



  
  useEffect(() => {
    if (!session?.user?.id) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const categories = useMemo(() => uniq(items.map((i) => i.category || "").filter(Boolean)), [items]);
  const locations = useMemo(() => uniq(items.map((i) => i.location || "").filter(Boolean)), [items]);

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    const category = filters.category;
    const location = filters.location;
    const build = filters.buildStatus;
    const paint = filters.paintStatus;
    const sort = filters.sort;

    let list = [...items];

    if (activeOrderId) {
      list = list.filter((it) => getOrderId(it) === activeOrderId);
    }

    if (q) list = list.filter((it) => itemSearchText(it).includes(q));
    if (category) list = list.filter((it) => (it.category || "") === category);
    if (location) list = list.filter((it) => (it.location || "") === location);

    if (build) {
      list = list.filter((it) => it.type === "miniatures" && (it.specs?.buildStatus || "") === build);
    }
    if (paint) {
      list = list.filter((it) => it.type === "miniatures" && (it.specs?.paintStatus || "") === paint);
    }

    list.sort((a, b) => {
      switch (sort) {
        case "name-desc":
          return safeText(b.name).localeCompare(safeText(a.name));
        case "date-desc": {
          const da = parseDate(a.purchase?.date);
          const db = parseDate(b.purchase?.date);
          return (db?.getTime() || 0) - (da?.getTime() || 0);
        }
        case "date-asc": {
          const da = parseDate(a.purchase?.date);
          const db = parseDate(b.purchase?.date);
          return (da?.getTime() || 0) - (db?.getTime() || 0);
        }
        case "price-desc":
          return (Number(b.purchase?.price) || 0) - (Number(a.purchase?.price) || 0);
        case "price-asc":
          return (Number(a.purchase?.price) || 0) - (Number(b.purchase?.price) || 0);
        case "name-asc":
        default:
          return safeText(a.name).localeCompare(safeText(b.name));
      }
    });

    return list;
  }, [items, filters, activeOrderId]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filtered.length / pageSize)),
    [filtered.length]
  );

  const pageItems = useMemo(() => {
    const p = Math.min(page, totalPages);
    const start = (p - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [filters, activeOrderId]);

  const modalItem = useMemo(
    () => (modalItemId ? items.find((x) => x.id === modalItemId) : null),
    [items, modalItemId]
  );



  useEffect(() => {
    if (!modalItem) {
      setIsEditing(false);
      setEditDraft(null);
      setSaveError(null);
      return;
    }

    setIsEditing(false);
    setSaveError(null);

    setEditDraft({
      name: modalItem.name ?? "",
      category: modalItem.category ?? "",
      type: modalItem.type ?? "",
      brand: modalItem.brand ?? "",
      model: modalItem.model ?? "",
      quantity: modalItem.quantity ?? 1,
      location: modalItem.location ?? "",
      tags: (modalItem.tags || []).join(", "),
      notes: modalItem.notes ?? "",

      purchase_date: modalItem.purchase?.date ?? "",
      purchase_price: modalItem.purchase?.price ?? "",
      purchase_currency: modalItem.purchase?.currency ?? "SEK",
      purchase_store: modalItem.purchase?.store ?? "",
      purchase_orderRef: modalItem.purchase?.orderRef ?? "",
      purchase_orderId: modalItem.purchase?.orderId ?? "",

      specs_json: JSON.stringify(modalItem.specs ?? {}, null, 2),
    });
  }, [modalItem]);




  const setupsOrdered = useMemo(() => {
    const byParent = new Map<string, DbSetup[]>();

    for (const s of setups) {
      const key = s.parent_setup_id || "";
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(s);
    }

    // Sort children alphabetically
    for (const [, list] of byParent) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    const out: Array<{ setup: DbSetup; depth: number }> = [];

    function walk(parentId: string, depth: number) {
      const list = byParent.get(parentId) || [];
      for (const s of list) {
        out.push({ setup: s, depth });
        walk(s.id, depth + 1);
      }
    }

    walk("", 0);
    return out;
  }, [setups]);



  const selectedSetup = useMemo(
    () => setups.find((s) => s.id === selectedSetupId) || null,
    [setups, selectedSetupId]
  );

  const childrenByParent = useMemo(() => {
    const map = new Map<string, DbSetup[]>();
    for (const s of setups) {
      const pid = s.parent_setup_id || "";
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid)!.push(s);
    }
    for (const [, list] of map) list.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [setups]);

  function getDescendantSetupIds(rootId: string) {
    const out: string[] = [];
    const stack: string[] = [rootId];

    while (stack.length) {
      const cur = stack.pop()!;
      const kids = childrenByParent.get(cur) || [];
      for (const k of kids) {
        out.push(k.id);
        stack.push(k.id);
      }
    }
    return out;
  }

  const setupView = useMemo(() => {
    if (!selectedSetup) {
      return { direct: [] as DbItem[], bubbled: [] as DbItem[], accessories: [] as Array<{ setup: DbSetup; items: DbItem[] }> };
    }

    const directItemIds = new Set(
      setupItems
        .filter((si) => si.setup_id === selectedSetup.id)
        .map((si) => si.item_id)
    );

    const direct = items.filter((it) => directItemIds.has(it.id));

    // Collect descendants
    const descendantIds = getDescendantSetupIds(selectedSetup.id);

    // For each child setup, split items into bubbled vs accessory
    const bubbledSet = new Set<string>();
    const accessoriesBySetup: Array<{ setup: DbSetup; items: DbItem[] }> = [];

    for (const sid of descendantIds) {
      const childSetup = setups.find((s) => s.id === sid);
      if (!childSetup) continue;

      const links = setupItems.filter((si) => si.setup_id === sid);
      const bubbledIds = new Set(links.filter((x) => x.include_in_parent_summary).map((x) => x.item_id));
      const accessoryIds = new Set(links.filter((x) => !x.include_in_parent_summary).map((x) => x.item_id));

      for (const id of bubbledIds) bubbledSet.add(id);

      const accessoryItems = items.filter((it) => accessoryIds.has(it.id));
      if (accessoryItems.length) accessoriesBySetup.push({ setup: childSetup, items: accessoryItems });
    }

    // Bubbled items, excluding items already direct (avoid duplicates)
    const bubbled = items.filter((it) => bubbledSet.has(it.id) && !directItemIds.has(it.id));

    return {
      direct,
      bubbled,
      accessories: accessoriesBySetup,
    };
  }, [selectedSetup, setupItems, items, setups, childrenByParent]);


  const setupItemBySetupAndItem = useMemo(() => {
    const map = new Map<string, DbSetupItem>();
    for (const si of setupItems) {
      map.set(`${si.setup_id}:${si.item_id}`, si);
    }
    return map;
  }, [setupItems]);





  






  

  const orders = useMemo(() => {
    // group items by orderId
    const map = new Map<string, DbItem[]>();
    for (const it of items) {
      const oid = getOrderId(it);
      if (!oid) continue;
      if (!map.has(oid)) map.set(oid, []);
      map.get(oid)!.push(it);
    }

    const list = [...map.entries()].map(([orderId, its]) => {
      const first = its[0];
      const purchase = first?.purchase || {};
      const store = purchase.store || "Unknown store";
      const date = purchase.date || "";
      const orderRef = purchase.orderRef || "";
      const currency = purchase.currency || "SEK";
      const total = its.reduce((sum, x) => {
        const p = x.purchase?.price;
        const n = typeof p === "number" ? p : Number(p);
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0);

      return { orderId, store, date, orderRef, currency, total, items: its };
    });

    list.sort((a, b) => (parseDate(b.date)?.getTime() || 0) - (parseDate(a.date)?.getTime() || 0));
    return list;
  }, [items]);

  const modalOrder = useMemo(
    () => (modalOrderId ? orders.find((o) => o.orderId === modalOrderId) : null),
    [orders, modalOrderId]
  );

  const setupDetail = useMemo(() => {
    if (!selectedSetupId) return null;
    const s = setups.find((x) => x.id === selectedSetupId);
    if (!s) return null;

    const ids = setupItems
      .filter((j) => j.setup_id === selectedSetupId)
      .sort((a, b) => (a.position || 0) - (b.position || 0))
      .map((j) => j.item_id);

    const its = ids.map((id) => items.find((it) => it.id === id)).filter(Boolean) as DbItem[];

    // group by category
    const groups = new Map<string, DbItem[]>();
    for (const it of its) {
      const key = it.category || "Other";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(it);
    }

    const groupList = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    return { setup: s, grouped: groupList };
  }, [selectedSetupId, setups, setupItems, items]);

  if (!session) {
    return (
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "2rem" }}>
        <h1>Inventory</h1>
        <p>Sign in to sync across devices.</p>

        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", flexWrap: "wrap" }}>
          <button onClick={loginGoogle}>Sign in with Google</button>

          <div style={{ display: "flex", gap: "0.5rem", flex: 1, minWidth: 280 }}>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{ flex: 1, padding: "0.6rem" }}
            />
            <button onClick={loginEmail} disabled={!email.includes("@")}>
              Email link
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.invPage}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
          <div>
            <h1 style={{ margin: 0 }}>📦 Inventory</h1>
            <p className={styles.muted} style={{ marginTop: "0.35rem" }}>
              Track items + curated “Setups” + auto Orders.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <span className={styles.muted}>Logged in as <b>{session.user.email}</b></span>
            <button className={styles.invBtn} onClick={logout}>Sign out</button>
          </div>
        </div>
      </div>

      <div className={styles.invTabs}>
        <button
          className={`${styles.invTab} ${tab === "inventory" ? styles.invTabActive : ""}`}
          onClick={() => setTab("inventory")}
        >
          Inventory
        </button>
        <button
          className={`${styles.invTab} ${tab === "setups" ? styles.invTabActive : ""}`}
          onClick={() => setTab("setups")}
        >
          Setups
        </button>
        <button
          className={`${styles.invTab} ${tab === "orders" ? styles.invTabActive : ""}`}
          onClick={() => setTab("orders")}
        >
          Orders
        </button>
        <button className={styles.invBtn} onClick={loadAll} disabled={loading}>
          {loading ? "Refreshing…" : "↻ Refresh"}
        </button>


        <button className={styles.invBtn} onClick={openCreateModal}>
          + Add item
        </button>
       
        <button
          className={styles.invBtn}
          onClick={() => {
            const rows = filtered.map((it) => ({
              id: it.id,
              name: it.name,
              category: it.category || "",
              type: it.type || "",
              quantity: it.quantity ?? 1,
              location: it.location || "",
              buildStatus: it.specs?.buildStatus || "",
              paintStatus: it.specs?.paintStatus || "",
              price: it.purchase?.price ?? "",
              currency: it.purchase?.currency ?? "",
              date: it.purchase?.date ?? "",
              orderId: it.purchase?.orderId ?? "",
              store: it.purchase?.store ?? "",
              orderRef: it.purchase?.orderRef ?? "",
              tags: (it.tags || []).join(" "),
            }));

            if (!rows.length) {
              alert("Nothing to export (no items in current view).");
              return;
            }

            const headers = Object.keys(rows[0]);

            const csv = [
              headers.join(","),
              ...rows.map((r) =>
                headers
                  .map((h) => `"${String((r as any)[h] ?? "").replace(/"/g, '""')}"`)
                  .join(",")
              ),
            ].join("\n");

            const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);

            const stamp = new Date().toISOString().slice(0, 10);
            a.download = `inventory-export-${stamp}.csv`;

            a.click();
            URL.revokeObjectURL(a.href);
          }}
        >
          ⬇ Export CSV
        </button>
      </div>

      {/* INVENTORY */}
      <section className={`${styles.invPanel} ${tab === "inventory" ? styles.invPanelActive : ""}`}>
        <div className={styles.invControls}>
          <input
            className={styles.invInput}
            type="search"
            placeholder="Search name / model / tags..."
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          />

          <select
            className={styles.invSelect}
            value={filters.category}
            onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            className={styles.invSelect}
            value={filters.location}
            onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value }))}
          >
            <option value="">All locations</option>
            {locations.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>

          <select
            className={styles.invSelect}
            value={filters.buildStatus}
            onChange={(e) => setFilters((f) => ({ ...f, buildStatus: e.target.value }))}
          >
            <option value="">Build: All</option>
            <option value="boxed">Boxed</option>
            <option value="partiallyBuilt">Partially built</option>
            <option value="assembled">Assembled</option>
            <option value="primed">Primed</option>
          </select>

          <select
            className={styles.invSelect}
            value={filters.paintStatus}
            onChange={(e) => setFilters((f) => ({ ...f, paintStatus: e.target.value }))}
          >
            <option value="">Paint: All</option>
            <option value="unpainted">Unpainted</option>
            <option value="wip">WIP</option>
            <option value="finished">Finished</option>
            <option value="mixed">Mixed</option>
          </select>

          <select
            className={styles.invSelect}
            value={filters.sort}
            onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value as Filters["sort"] }))}
          >
            <option value="name-asc">Sort: Name (A → Z)</option>
            <option value="name-desc">Sort: Name (Z → A)</option>
            <option value="date-desc">Sort: Purchase date (new → old)</option>
            <option value="date-asc">Sort: Purchase date (old → new)</option>
            <option value="price-desc">Sort: Price (high → low)</option>
            <option value="price-asc">Sort: Price (low → high)</option>
          </select>

          <select
            className={styles.invSelect}
            value=""
            onChange={(e) => {
              const name = e.target.value;
              if (!name) return;
              const view = savedViews[name];
              if (!view) return;

              setFilters((f) => ({
                ...f,
                q: view.q ?? f.q,
                category: view.category ?? f.category,
                location: view.location ?? f.location,
                buildStatus: view.buildStatus ?? f.buildStatus,
                paintStatus: view.paintStatus ?? f.paintStatus,
                sort: (view.sort as any) ?? f.sort,
              }));

              setActiveOrderId("");
              e.target.value = "";
            }}
          >
            <option value="">Saved views…</option>
            {Object.keys(savedViews).sort().map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          <button
            className={styles.invBtn}
            onClick={() => {
              const name = prompt("Name this view:");
              if (!name) return;

              const next = {
                ...savedViews,
                [name]: { ...filters },
              };
              setViews(next);
              setSavedViewsState(next);
            }}
          >
            💾 Save view
          </button>

          <button
            className={styles.invBtn}
            onClick={() => {
              const name = prompt("Delete which view? (type exact name)");
              if (!name) return;
              if (!savedViews[name]) return alert("No such view.");
              if (!confirm(`Delete view "${name}"?`)) return;

              const next = { ...savedViews };
              delete next[name];
              setViews(next);
              setSavedViewsState(next);
            }}
          >
            🗑 Delete
          </button>

          <button
            className={styles.invBtn}
            onClick={() => {
              setFilters(DEFAULT_FILTERS);
              setActiveOrderId("");
            }}
          >
            Reset
          </button>
        </div>

        <div className={styles.invMeta}>
          <span>
            {filtered.length} item{filtered.length === 1 ? "" : "s"}
            {activeOrderId ? ` • Order: ${activeOrderId}` : ""}
          </span>

          {activeOrderId && (
            <button className={styles.invBtn} onClick={() => setActiveOrderId("")}>
              Clear order filter
            </button>
          )}
        </div>

        {loadError && (
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1rem 1rem", color: "crimson" }}>
            Error: {loadError}
          </div>
        )}

        <div className={styles.invGrid}>
          {pageItems.map((it) => {
            const thumb = it.images?.[0] || "";
            const subtitleParts = [
              it.brand && it.model ? `${it.brand} ${it.model}` : (it.model || it.brand || ""),
              it.location ? `📍 ${it.location}` : "",
            ].filter(Boolean);

            const money = fmtMoney(it.purchase);
            const date = it.purchase?.date ? it.purchase.date : "";

            const isMini = it.type === "miniatures";
            const buildStatus = isMini ? (it.specs?.buildStatus || "") : "";
            const paintStatus = isMini ? (it.specs?.paintStatus || "") : "";

            return (
              <div
                key={it.id}
                className={styles.invCard}
                tabIndex={0}
                onClick={() => setModalItemId(it.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setModalItemId(it.id);
                }}
              >
                <div className={styles.invCardTop}>
                  {thumb ? (
                    <img className={styles.invThumb} src={thumb} alt="" />
                  ) : (
                    <div className={styles.invThumb} aria-hidden="true" />
                  )}

                  <div>
                    <h3 style={{ margin: 0, fontSize: "1.05rem" }}>{it.name}</h3>
                    <p className={styles.invSub}>{subtitleParts.join(" • ")}</p>
                    <p className={styles.invSub}>{[money, date].filter(Boolean).join(" • ")}</p>
                  </div>
                </div>

                <div className={styles.badges}>
                  {it.category ? <span className={styles.badge}>{it.category}</span> : null}
                  {it.type ? <span className={styles.badge}>{it.type}</span> : null}
                  {buildStatus ? <span className={styles.badge}>🧩 {buildStatus}</span> : null}
                  {paintStatus ? <span className={styles.badge}>🎨 {paintStatus}</span> : null}
                  {(it.tags || []).slice(0, 3).map((t) => (
                    <span key={t} className={styles.badge}>#{t}</span>
                  ))}
                  {it.quantity && it.quantity !== 1 ? (
                    <span className={styles.badge}>x{it.quantity}</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <div className={styles.invPager}>
          <button className={styles.invBtn} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            ← Prev
          </button>
          <span className={styles.muted}>
            Page {Math.min(page, totalPages)} / {totalPages}
          </span>
          <button className={styles.invBtn} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            Next →
          </button>
        </div>
      </section>

      {/* SETUPS */}
      <section className={`${styles.invPanel} ${tab === "setups" ? styles.invPanelActive : ""}`}>
        <div className={styles.setupLayout}>
          <div>
            <h2 style={{ marginTop: 0 }}>🧩 Your Setups</h2>
            <p className={styles.muted}>Pick a setup to view it like a “nice sheet”.</p>

            <button className={styles.invBtn} onClick={() => setSetupCreateOpen(true)}>
              + Add setup
            </button>

           <div className={styles.setupList}>
            {setupsOrdered.map(({ setup: s, depth }) => (
              <div
                key={s.id}
                className={`${styles.setupCard} ${
                  selectedSetupId === s.id ? styles.setupCardActive : ""
                }`}
                onClick={() => {
                  setSelectedSetupId(s.id);
                  setShowAccessories(false);
                }}
                style={{ marginLeft: depth * 14 }}
              >
                <h3 style={{ margin: 0 }}>{s.name}</h3>
                {s.description && (
                  <p className={styles.muted} style={{ margin: "0.35rem 0 0" }}>
                    {s.description}
                  </p>
                )}
              </div>
            ))}
          </div>
          </div>

          <div>
            {!selectedSetup ? (
              <div className={`${styles.setupDetail} ${styles.setupDetailEmpty}`}>
                <div>
                  <h2>Select a setup</h2>
                  <p className={styles.muted}>Examples: “Desk / PC Setup”, “Living Room TV”, “Lighting”, etc.</p>
                </div>
              </div>
            ) : (
              <div className={styles.setupDetail}>
                <h2 style={{ marginTop: 0 }}>{selectedSetup!.name}</h2>
                <p className={styles.muted} style={{ marginTop: "0.25rem" }}>
                  {selectedSetup!.description || ""}
                </p>

                <h3 style={{ marginTop: "1rem" }}>Core items</h3>

                <div className={styles.setupItems}>
                  {[...setupView.direct, ...setupView.bubbled].map((it) => {
                    const canBubbleUp = !!selectedSetup?.parent_setup_id; // only child setups show checkbox
                    const si = selectedSetup
                      ? setupItemBySetupAndItem.get(`${selectedSetup.id}:${it.id}`)
                      : undefined;

                    return (
                      <div
                        key={it.id}
                        className={styles.setupItemRow}
                        onClick={() => setModalItemId(it.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") setModalItemId(it.id);
                        }}
                      >
                        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", width: "100%" }}>
                          {it.images?.[0] ? (
                            <img className={styles.invThumb} src={it.images[0]} alt="" />
                          ) : (
                            <div className={styles.invThumb} aria-hidden="true" />
                          )}

                          <div>
                            <div style={{ fontWeight: 800 }}>{it.name}</div>
                            <div className={styles.muted} style={{ fontSize: "0.95rem" }}>
                              {[it.brand, it.model].filter(Boolean).map(safeText).join(" • ")}
                            </div>

                            {/* Label when included */}
                            {canBubbleUp && si?.include_in_parent_summary && (
                              <div className={styles.muted} style={{ fontSize: "0.85rem" }}>
                                Shown in parent setup
                              </div>
                            )}

                            {/* Label when bubbled into parent (only makes sense when viewing parent) */}
                            {!canBubbleUp && setupView.bubbled.some((x) => x.id === it.id) && (
                              <div className={styles.muted} style={{ fontSize: "0.85rem" }}>
                                Included from a sub-setup
                              </div>
                            )}
                          </div>

                          {/* Checkbox on the far right (only in child setups) */}
                          {canBubbleUp && si && (
                            <label
                              className={styles.muted}
                              style={{
                                marginLeft: "auto",
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                whiteSpace: "nowrap",
                                paddingLeft: 12,
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={!!si.include_in_parent_summary}
                                onChange={(e) =>
                                  toggleIncludeInParent(selectedSetup!.id, it.id, e.target.checked)
                                }
                              />
                              Include in parent
                            </label>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>


                      

                {!!setupView.accessories.length && (
                  <div style={{ marginTop: "1rem" }}>
                    <button className={styles.invBtn} onClick={() => setShowAccessories((v) => !v)}>
                      {showAccessories
                        ? "Hide accessories"
                        : `Show accessories (${setupView.accessories.reduce(
                            (n, g) => n + g.items.length,
                            0
                          )})`}
                    </button>

                    {showAccessories && (
                      <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.75rem" }}>
                        {setupView.accessories.map(({ setup, items: accItems }) => (
                          <div
                            key={setup.id}
                            className={styles.invCard}
                            style={{ padding: "0.75rem" }}
                          >
                            <div style={{ fontWeight: 800 }}>{setup.name}</div>
                            <div className={styles.muted} style={{ fontSize: "0.9rem" }}>
                              Extra items
                            </div>

                            <div style={{ marginTop: "0.5rem", display: "grid", gap: "0.5rem" }}>
                              {accItems.map((it) => (
                                <div
                                  key={it.id}
                                  className={styles.setupItemRow}
                                  style={{ padding: "0.55rem", opacity: 0.9 }}
                                  onClick={() => setModalItemId(it.id)}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") setModalItemId(it.id);
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
                                      <div className={styles.muted} style={{ fontSize: "0.9rem" }}>
                                        {[it.brand, it.model].filter(Boolean).map(safeText).join(" • ")}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ORDERS */}
      <section className={`${styles.invPanel} ${tab === "orders" ? styles.invPanelActive : ""}`}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1rem 2rem" }}>
          <h2 style={{ marginTop: 0 }}>🧾 Orders</h2>
          <p className={styles.muted}>Auto-generated from items that share the same purchase.orderId.</p>

          <div className={styles.invGrid}>
            {!orders.length ? (
              <div className={styles.invCard}>
                <h3 style={{ marginTop: 0 }}>No orders yet</h3>
                <p className={styles.muted}>Add purchase.orderId to items to group them.</p>
              </div>
            ) : (
              orders.map((o) => (
                <div
                  key={o.orderId}
                  className={styles.invCard}
                  tabIndex={0}
                  onClick={() => setModalOrderId(o.orderId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setModalOrderId(o.orderId);
                  }}
                >
                  <h3 style={{ margin: 0 }}>
                    {o.store}
                    {o.orderRef ? ` • ${o.orderRef}` : ""}
                  </h3>
                  <p className={styles.invSub}>
                    {o.date} • {o.items.length} item(s)
                  </p>
                  <p className={styles.invSub}>
                    {o.total ? `${o.total.toLocaleString()} ${o.currency}` : ""}
                  </p>
                  <div className={styles.badges}>
                    <span className={styles.badge}>{o.orderId}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>





      
     {/* ITEM MODAL */}
     <Modal
       open={!!modalItem || isCreating}
       onClose={() => {
         setModalItemId(null);
         setIsCreating(false);
         setIsEditing(false);
         setSaveError(null);
       }}
     >
       {(modalItem || isCreating) && (
        <div>
          <h2 style={{ marginTop: 0 }}>
            {isCreating ? "Add new item" : modalItem!.name}
          </h2>

          {!isCreating && (
            <p className={styles.muted} style={{ marginTop: "0.25rem" }}>
              {[modalItem!.brand, modalItem!.model].filter(Boolean).map(safeText).join(" • ")}
            </p>
          )}

          {/* Create-mode ID input */}
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
                Suggested: <b>{slugifyId(editDraft?.name || "") || "—"}</b>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", margin: "0.75rem 0" }}>
            {/* In create mode: primary action is Create */}
            {isCreating ? (
              <>
                <button className={styles.invBtn} onClick={createNewItem} disabled={saving}>
                  {saving ? "Creating…" : "Create"}
                </button>

                <button
                  className={styles.invBtn}
                  onClick={() => {
                    setIsCreating(false);
                    setIsEditing(false);
                    setSaveError(null);
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button className={styles.invBtn} onClick={() => setIsEditing((v) => !v)}>
                  {isEditing ? "Cancel edit" : "Edit"}
                </button>

                {isEditing && (
                  <button className={styles.invBtn} onClick={() => saveItemEdits(modalItem!.id)} disabled={saving}>
                    {saving ? "Saving…" : "Save"}
                  </button>
                )}

                <button className={styles.invBtn} onClick={() => deleteItem(modalItem!.id)} disabled={saving}>
                  🗑 Delete
                </button>
              </>
            )}


             {saveError && <span style={{ color: "crimson" }}>Error: {saveError}</span>}
           </div>

           {isEditing ? (
             // -------- EDIT MODE --------
             <div style={{ display: "grid", gap: "0.75rem" }}>
               <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                 <label>
                   <div className={styles.muted}>Name</div>
                   <input
                     className={styles.invInput}
                     value={editDraft?.name || ""}
                     onChange={(e) => setEditDraft((d: any) => ({ ...d, name: e.target.value }))}
                   />
                 </label>

                 <label>
                   <div className={styles.muted}>Category</div>
                   <input
                     className={styles.invInput}
                     value={editDraft?.category || ""}
                     onChange={(e) => setEditDraft((d: any) => ({ ...d, category: e.target.value }))}
                   />
                 </label>

                 <label>
                   <div className={styles.muted}>Type</div>
                   <input
                     className={styles.invInput}
                     value={editDraft?.type || ""}
                     onChange={(e) => setEditDraft((d: any) => ({ ...d, type: e.target.value }))}
                   />
                 </label>

                 <label>
                   <div className={styles.muted}>Location</div>
                   <input
                     className={styles.invInput}
                     value={editDraft?.location || ""}
                     onChange={(e) => setEditDraft((d: any) => ({ ...d, location: e.target.value }))}
                   />
                 </label>

                 <label>
                   <div className={styles.muted}>Brand</div>
                   <input
                     className={styles.invInput}
                     value={editDraft?.brand || ""}
                     onChange={(e) => setEditDraft((d: any) => ({ ...d, brand: e.target.value }))}
                   />
                 </label>

                 <label>
                   <div className={styles.muted}>Model</div>
                   <input
                     className={styles.invInput}
                     value={editDraft?.model || ""}
                     onChange={(e) => setEditDraft((d: any) => ({ ...d, model: e.target.value }))}
                   />
                 </label>

                 <label>
                   <div className={styles.muted}>Quantity</div>
                   <input
                     className={styles.invInput}
                     type="number"
                     value={editDraft?.quantity ?? 1}
                     onChange={(e) => setEditDraft((d: any) => ({ ...d, quantity: e.target.value }))}
                   />
                 </label>

                 <label>
                   <div className={styles.muted}>Tags (comma separated)</div>
                   <input
                     className={styles.invInput}
                     value={editDraft?.tags || ""}
                     onChange={(e) => setEditDraft((d: any) => ({ ...d, tags: e.target.value }))}
                   />
                 </label>
               </div>

               <label>
                 <div className={styles.muted}>Notes</div>
                 <textarea
                   className={styles.invInput}
                   style={{ minHeight: 90 }}
                   value={editDraft?.notes || ""}
                   onChange={(e) => setEditDraft((d: any) => ({ ...d, notes: e.target.value }))}
                 />
               </label>

               <h3 style={{ margin: "0.5rem 0 0" }}>Purchase</h3>

               <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                 <label>
                   <div className={styles.muted}>Date (YYYY-MM-DD)</div>
                   <input
                     className={styles.invInput}
                     value={editDraft?.purchase_date || ""}
                     onChange={(e) => setEditDraft((d: any) => ({ ...d, purchase_date: e.target.value }))}
                   />
                 </label>

                 <label>
                   <div className={styles.muted}>Price</div>
                   <input
                     className={styles.invInput}
                     value={editDraft?.purchase_price ?? ""}
                     onChange={(e) => setEditDraft((d: any) => ({ ...d, purchase_price: e.target.value }))}
                   />
                 </label>

                 <label>
                   <div className={styles.muted}>Currency</div>
                   <input
                     className={styles.invInput}
                     value={editDraft?.purchase_currency || "SEK"}
                     onChange={(e) => setEditDraft((d: any) => ({ ...d, purchase_currency: e.target.value }))}
                   />
                 </label>

                 <label>
                   <div className={styles.muted}>Store</div>
                   <input
                     className={styles.invInput}
                     value={editDraft?.purchase_store || ""}
                     onChange={(e) => setEditDraft((d: any) => ({ ...d, purchase_store: e.target.value }))}
                   />
                 </label>

                 <label>
                   <div className={styles.muted}>Order ref</div>
                   <input
                     className={styles.invInput}
                     value={editDraft?.purchase_orderRef || ""}
                     onChange={(e) => setEditDraft((d: any) => ({ ...d, purchase_orderRef: e.target.value }))}
                   />
                 </label>
     
                 <label>
                   <div className={styles.muted}>OrderId</div>
                   <input
                     className={styles.invInput}
                     value={editDraft?.purchase_orderId || ""}
                     onChange={(e) => setEditDraft((d: any) => ({ ...d, purchase_orderId: e.target.value }))}
                   />
                 </label>
               </div>

               <h3 style={{ margin: "0.5rem 0 0" }}>Specs (JSON)</h3>
               <textarea
                 className={styles.invInput}
                 style={{
                   minHeight: 240,
                   fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                 }}
                 value={editDraft?.specs_json || "{}"}
                 onChange={(e) => setEditDraft((d: any) => ({ ...d, specs_json: e.target.value }))}
               />
             </div>
           ) : (
             // -------- READ MODE (your existing view) --------
             <>
              {(modalItem.images || []).map((src) => (
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
                     {modalItem.category ? <li><b>Category:</b> {modalItem.category}</li> : null}
                     {modalItem.type ? <li><b>Type:</b> {modalItem.type}</li> : null}
                     {modalItem.location ? <li><b>Location:</b> {modalItem.location}</li> : null}
                     {modalItem.quantity != null ? <li><b>Quantity:</b> {modalItem.quantity}</li> : null}
                   </ul>
                 </div>

                 <div>
                   <h3>Purchase</h3>
                   <ul className={styles.detailList}>
                     {modalItem.purchase?.date ? <li><b>Date:</b> {safeText(modalItem.purchase.date)}</li> : null}
                     {modalItem.purchase?.price != null ? <li><b>Price:</b> {fmtMoney(modalItem.purchase)}</li> : null}
                     {modalItem.purchase?.store ? <li><b>Store:</b> {safeText(modalItem.purchase.store)}</li> : null}
                     {modalItem.purchase?.orderRef ? <li><b>Order ref:</b> {safeText(modalItem.purchase.orderRef)}</li> : null}
                     {modalItem.purchase?.orderId ? <li><b>OrderId:</b> {safeText(modalItem.purchase.orderId)}</li> : null}
                   </ul>
                 </div>
               </div>

               {!!(modalItem.tags || []).length && (
                 <p className={styles.muted}>
                   Tags: {(modalItem.tags || []).map((t) => `#${t}`).join(" ")}
                 </p>
               )}

               {modalItem.notes ? (
                 <>
                   <h3>Notes</h3>
                   <p>{modalItem.notes}</p>
                 </>
               ) : null}

               <Specs specs={modalItem.specs} />
             </>
           )}
         </div>
       )}
     </Modal>





      <Modal
        open={setupCreateOpen}
        onClose={() => {
          setSetupCreateOpen(false);
         setSetupDraft({ name: "", description: "", parent_setup_id: "" });
          setSetupSelectedItemIds([]);
        }}
      >
        <div>
          <h2 style={{ marginTop: 0 }}>Create setup</h2>

          <div style={{ display: "grid", gap: "0.75rem" }}>
            <label>
              <div className={styles.muted}>Name</div>
              <input
                className={styles.invInput}
                value={setupDraft.name}
                onChange={(e) => setSetupDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder='e.g. "Mechanical Keyboard"'
              />
            </label>

            <label>
              <div className={styles.muted}>Description</div>
              <input
                className={styles.invInput}
                value={setupDraft.description}
                onChange={(e) => setSetupDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="Optional"
              />
            </label>

            <label>
              <div className={styles.muted}>Parent setup (optional)</div>
              <select
                className={styles.invSelect}
                value={setupDraft.parent_setup_id}
                onChange={(e) => setSetupDraft((d) => ({ ...d, parent_setup_id: e.target.value }))}
              >
                <option value="">None (top-level)</option>
                {setups.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <div className={styles.muted} style={{ fontSize: "0.9rem", marginTop: "0.25rem" }}>
                For your case: pick <b>Desk / PC Setup</b> as parent.
              </div>
            </label>

            <div>
              <div className={styles.muted} style={{ marginBottom: "0.35rem" }}>
                Add items to this setup
              </div>

              <div style={{ maxHeight: 240, overflow: "auto", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 12, padding: 10 }}>
                {items
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((it) => {
                    const checked = setupSelectedItemIds.includes(it.id);
                    return (
                      <label key={it.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 4px" }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setSetupSelectedItemIds((prev) => {
                              if (e.target.checked) return [...prev, it.id];
                              return prev.filter((x) => x !== it.id);
                            });
                          }}
                        />
                        <span style={{ fontWeight: 700 }}>{it.name}</span>
                        <span className={styles.muted} style={{ fontSize: "0.9rem" }}>
                          {it.model ? ` • ${it.model}` : ""}
                        </span>
                      </label>
                    );
                  })}
              </div>

              <div className={styles.muted} style={{ marginTop: "0.35rem" }}>
                Tip: select your keyboard + the two extra plates.
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
              <button className={styles.invBtn} onClick={createSetup}>
                Create setup
              </button>
              <button
                className={styles.invBtn}
                onClick={() => {
                  setSetupCreateOpen(false);
                  setSetupDraft({ name: "", description: "", parent_setup_id: "" });
                  setSetupSelectedItemIds([]);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Modal>




      

      

      {/* ORDER MODAL */}
      <Modal open={!!modalOrder} onClose={() => setModalOrderId(null)}>
        {modalOrder && (
          <div>
            <h2 style={{ marginTop: 0 }}>
              {modalOrder.store}
              {modalOrder.orderRef ? ` • ${modalOrder.orderRef}` : ""}
            </h2>
            <p className={styles.muted} style={{ marginTop: "0.25rem" }}>
              {modalOrder.date} • {modalOrder.items.length} item(s)
            </p>
            <p className={styles.muted}>
              {modalOrder.total ? `Total: ${modalOrder.total.toLocaleString()} ${modalOrder.currency}` : ""}
            </p>

            <button
              className={styles.invBtn}
              style={{ margin: "0.5rem 0 1rem" }}
              onClick={() => {
                setActiveOrderId(modalOrder.orderId);
                setModalOrderId(null);
                setTab("inventory");
              }}
            >
              Filter inventory by this order
            </button>

            <h3>Items</h3>
            <div className={styles.setupItems}>
              {modalOrder.items.map((it) => (
                <div
                  key={it.id}
                  className={styles.setupItemRow}
                  onClick={() => {
                    setModalOrderId(null);
                    setModalItemId(it.id);
                  }}
                  role="button"
                  tabIndex={0}
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
                        {[it.brand, it.model].filter(Boolean).map(safeText).join(" • ")}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </main>
  );
}
