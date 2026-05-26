"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import styles from "./inventory.module.css";

import {
  DbItem, DbItemLink, DbSetup, DbSetupItem, DbPhoto, DbOrderMeta, Tab,
} from "./types";
import { getOrderId, parseDate } from "./helpers";

import { InventoryTab }  from "./components/InventoryTab";
import { SetupsTab }     from "./components/SetupsTab";
import { OrdersTab }     from "./components/OrdersTab";
import { ItemModal }     from "./components/ItemModal";
import { SetupModal }    from "./components/SetupModal";
import { LinkModal }     from "./components/LinkModal";
import { OrderModal }    from "./components/OrderModal";

export default function InventoryPage() {
  const [session,     setSession]     = useState<any>(null);
  const [tab,         setTab]         = useState<Tab>("inventory");
  const [loading,     setLoading]     = useState(false);
  const [loadError,   setLoadError]   = useState<string | null>(null);

  // ── Raw data ────────────────────────────────────────────────────────
  const [items,       setItems]       = useState<DbItem[]>([]);
  const [links,       setLinks]       = useState<DbItemLink[]>([]);
  const [setups,      setSetups]      = useState<DbSetup[]>([]);
  const [setupItems,  setSetupItems]  = useState<DbSetupItem[]>([]);
  const [photos,      setPhotos]      = useState<DbPhoto[]>([]);
  const [orderMetas,  setOrderMetas]  = useState<DbOrderMeta[]>([]);

  // ── Modal state ─────────────────────────────────────────────────────
  const [modalItemId,    setModalItemId]    = useState<string | null>(null);
  const [isCreating,     setIsCreating]     = useState(false);
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [linkModalOpen,  setLinkModalOpen]  = useState(false);
  const [modalOrderId,   setModalOrderId]   = useState<string | null>(null);

  // ── Cross-tab state ─────────────────────────────────────────────────
  const [activeOrderId, setActiveOrderId] = useState("");

  // ── Auth ────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) =>
      setSession(sess)
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user?.id) loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  async function logout() {
    await supabase.auth.signOut();
    document.cookie = "sb-session=; path=/; max-age=0";
    window.location.href = "/auth/login";
  }


  async function fetchAllItems(): Promise<DbItem[]> {
  const allRows: DbItem[] = [];
  const batchSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .order("name", { ascending: true })
      .range(from, from + batchSize - 1);

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;

    allRows.push(...(data as DbItem[]));

    if (data.length < batchSize) break;
    from += batchSize;
  }

  return allRows;
}

  // ── Data loading ────────────────────────────────────────────────────
  async function loadAll() {
    if (!session?.user?.id) return;
    setLoading(true);
    setLoadError(null);

    const [setupsRes, joinRes, linksRes, photosRes, orderMetasRes] =
      await Promise.all([
        supabase.from("inventory_setups").select("*").order("name", { ascending: true }),
        supabase.from("inventory_setup_items").select("*").order("position", { ascending: true }),
        supabase.from("inventory_item_links").select("*").order("created_at", { ascending: false }),
        supabase.from("inventory_photos").select("*").order("date_taken", { ascending: false, nullsFirst: false }),
        supabase.from("inventory_orders").select("*"),
      ]);

    if (setupsRes.error) setLoadError(setupsRes.error.message);
    if (joinRes.error)   setLoadError(joinRes.error.message);
    if (linksRes.error)  setLoadError(linksRes.error.message);

    setItems      (fetchedItems);
    setSetups     ((setupsRes.data     || []) as DbSetup[]);
    setSetupItems ((joinRes.data       || []) as DbSetupItem[]);
    setLinks      ((linksRes.data      || []) as DbItemLink[]);
    setPhotos     ((photosRes.data     || []) as DbPhoto[]);
    setOrderMetas ((orderMetasRes.data || []) as DbOrderMeta[]);

    setLoading(false);
  }

  // ── Derived data ────────────────────────────────────────────────────
  const modalItem = useMemo(
    () => (modalItemId ? items.find((x) => x.id === modalItemId) ?? null : null),
    [items, modalItemId]
  );

  const modalLinks = useMemo(() => {
    if (!modalItem) return { outgoing: [] as DbItemLink[], incoming: [] as DbItemLink[] };
    return {
      outgoing: links.filter((l) => l.from_item_id === modalItem.id),
      incoming: links.filter((l) => l.to_item_id   === modalItem.id),
    };
  }, [links, modalItem]);

  const orders = useMemo(() => {
    const map = new Map<string, DbItem[]>();
    for (const it of items) {
      const oid = getOrderId(it);
      if (!oid) continue;
      if (!map.has(oid)) map.set(oid, []);
      map.get(oid)!.push(it);
    }

    return [...map.entries()]
      .map(([orderId, its]) => {
        const first    = its[0];
        const purchase = first?.purchase || {};
        const total    = its.reduce((sum, x) => {
          const n = Number(x.purchase?.price);
          return sum + (Number.isFinite(n) && !x.purchase?.inherited ? n : 0);
        }, 0);
        return {
          orderId,
          store:    purchase.store    || "Unknown store",
          date:     purchase.date     || "",
          orderRef: purchase.orderRef || "",
          currency: purchase.currency || "SEK",
          total,
          items: its,
        };
      })
      .sort(
        (a, b) =>
          (parseDate(b.date)?.getTime() || 0) -
          (parseDate(a.date)?.getTime() || 0)
      );
  }, [items]);

  const modalOrder = useMemo(
    () => (modalOrderId ? orders.find((o) => o.orderId === modalOrderId) ?? null : null),
    [orders, modalOrderId]
  );

  const modalOrderMeta = useMemo(
    () => (modalOrderId ? orderMetas.find((m) => m.order_id === modalOrderId) ?? null : null),
    [orderMetas, modalOrderId]
  );

  // ── Handlers ────────────────────────────────────────────────────────
  function handleOpenOrderFromItem(orderId: string) {
    setModalItemId(null);
    setIsCreating(false);
    setModalOrderId(orderId);
  }

  // ── Not signed in ───────────────────────────────────────────────────
  if (!session) {
    return (
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "2rem", textAlign: "center" }}>
        <h1>📦 Inventory</h1>
        <p>Sign in to sync across devices.</p>
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "2rem", justifyContent: "center" }}>
          <a href="/auth/login" style={{ padding: "0.75rem 1.5rem", background: "#0070f3", color: "white", textDecoration: "none", borderRadius: "8px", fontWeight: 600 }}>
            Sign In
          </a>
          <a href="/auth/signup" style={{ padding: "0.75rem 1.5rem", background: "#10b981", color: "white", textDecoration: "none", borderRadius: "8px", fontWeight: 600 }}>
            Create Account
          </a>
        </div>
      </main>
    );
  }

  // ── Main UI ─────────────────────────────────────────────────────────
  return (
    <main className={styles.invPage}>

      {/* Header */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.25rem" }}>
              <h1 style={{ margin: 0 }}>📦 Inventory</h1>
              <Link
                href="/inventory/photos"
                style={{
                  fontSize: "0.88rem", padding: "0.35rem 0.75rem",
                  borderRadius: "999px", background: "rgba(0,0,0,0.06)",
                  textDecoration: "none", color: "inherit", fontWeight: 600,
                }}
              >
                📷 Photos
              </Link>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <p className={styles.muted} style={{ margin: 0 }}>
                Track items + curated "Setups" + auto Orders.
              </p>
              <Link
                href="/"
                style={{ fontSize: "0.82rem", opacity: 0.5, textDecoration: "none", whiteSpace: "nowrap" }}
              >
                ← Hub
              </Link>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <span className={styles.muted}>
              Logged in as <b>{session.user.email}</b>
            </span>
            <button className={styles.invBtn} onClick={logout}>Sign out</button>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className={styles.invTabs}>
        {(["inventory", "setups", "orders"] as Tab[]).map((t) => (
          <button
            key={t}
            className={`${styles.invTab} ${tab === t ? styles.invTabActive : ""}`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
        <button className={styles.invBtn} onClick={loadAll} disabled={loading}>
          {loading ? "Refreshing…" : "↻ Refresh"}
        </button>
        <button className={styles.invBtn} onClick={() => {
          setIsCreating(true);
          setModalItemId(null);
        }}>
          + Add item
        </button>
      </div>

      {/* Tabs */}
      <section className={`${styles.invPanel} ${tab === "inventory" ? styles.invPanelActive : ""}`}>
        <InventoryTab
          items={items}
          activeOrderId={activeOrderId}
          onClearOrder={() => setActiveOrderId("")}
          onSelectItem={setModalItemId}
          loadError={loadError}
        />
      </section>

      <section className={`${styles.invPanel} ${tab === "setups" ? styles.invPanelActive : ""}`}>
        <SetupsTab
          items={items}
          setups={setups}
          setupItems={setupItems}
          onSelectItem={setModalItemId}
          onOpenSetupModal={() => setSetupModalOpen(true)}
          onReload={loadAll}
          session={session}
        />
      </section>

      <section className={`${styles.invPanel} ${tab === "orders" ? styles.invPanelActive : ""}`}>
        <OrdersTab
          orders={orders}
          onSelectOrder={setModalOrderId}
        />
      </section>

      {/* Modals */}
      <ItemModal
        item={modalItem}
        isCreating={isCreating}
        links={modalLinks}
        allItems={items}
        photos={photos}
        onClose={() => { setModalItemId(null); setIsCreating(false); }}
        onSaved={loadAll}
        onDeleted={() => { setModalItemId(null); loadAll(); }}
        onNavigate={setModalItemId}
        onOpenLinkModal={() => setLinkModalOpen(true)}
        onOpenOrder={handleOpenOrderFromItem}
        onPhotosChanged={loadAll}
        session={session}
      />

      <SetupModal
        open={setupModalOpen}
        setups={setups}
        allItems={items}
        onClose={() => setSetupModalOpen(false)}
        onSaved={() => { setSetupModalOpen(false); loadAll(); }}
        session={session}
      />

      <LinkModal
        open={linkModalOpen}
        sourceItem={modalItem}
        allItems={items}
        onClose={() => setLinkModalOpen(false)}
        onSaved={loadAll}
        session={session}
      />

      <OrderModal
        order={modalOrder}
        orderMeta={modalOrderMeta}
        onClose={() => setModalOrderId(null)}
        onFilterByOrder={(oid) => {
          setActiveOrderId(oid);
          setTab("inventory");
        }}
        onSelectItem={setModalItemId}
        onMetaSaved={loadAll}
        session={session}
      />

    </main>
  );
}
