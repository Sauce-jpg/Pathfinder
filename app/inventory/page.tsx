"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type InventoryItem = {
  id: string;
  name: string;
  type?: string | null;
  category?: string | null;
  brand?: string | null;
  model?: string | null;
  quantity?: number | null;
  location?: string | null;
  tags?: string[] | null;
  notes?: string | null;
  images?: string[] | null;
  purchase?: any;
  specs?: any;
  purchaseHistory?: any[]; // from your JSON
  orderId?: string | null; // optional
};

type SetupJson = {
  id: string;
  name: string;
  description?: string | null;
  items: string[];
};

export default function InventoryPage() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");

  const [items, setItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);

  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string>("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadItems() {
    if (!session?.user?.id) return;

    setLoadingItems(true);
    setItemsError(null);

    const { data, error } = await supabase
      .from("inventory_items")
      .select("id,name,category,location,quantity")
      .order("name", { ascending: true });

    if (error) setItemsError(error.message);
    setItems(data || []);
    setLoadingItems(false);
  }

  useEffect(() => {
    if (!session?.user?.id) return;
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

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

  async function importFromJson() {
    if (!session?.user?.id) return;

    setImporting(true);
    setImportMsg("");

    try {
      // 1) Fetch JSON from /public
      const [itemsRes, setupsRes] = await Promise.all([
        fetch("/inventory/data/items.json", { cache: "no-store" }),
        fetch("/inventory/data/setups.json", { cache: "no-store" }),
      ]);

      if (!itemsRes.ok) throw new Error("Failed to fetch /inventory/data/items.json");
      if (!setupsRes.ok) throw new Error("Failed to fetch /inventory/data/setups.json");

      const rawItems = (await itemsRes.json()) as InventoryItem[];
      const setups = (await setupsRes.json()) as SetupJson[];

      const userId = session.user.id as string;

      // 2) Normalize + map JSON -> DB shape
      const dbItems = rawItems.map((it) => ({
        id: it.id,
        user_id: userId,
        name: it.name ?? "",
        type: it.type ?? null,
        category: it.category ?? null,
        brand: it.brand ?? null,
        model: it.model ?? null,
        quantity: it.quantity ?? 1,
        location: it.location ?? null,
        tags: it.tags ?? [],
        notes: it.notes ?? null,
        images: it.images ?? [],
        purchase: it.purchase ?? {},
        specs: it.specs ?? {},
        purchase_history: it.purchaseHistory ?? [],
      }));

      setImportMsg(`Upserting ${dbItems.length} items…`);

      // 3) Upsert items (private per user via user_id)
      const { error: upsertItemsError } = await supabase
        .from("inventory_items")
        .upsert(dbItems, { onConflict: "id" });

      if (upsertItemsError) throw new Error(upsertItemsError.message);

      // 4) Upsert setups
      const dbSetups = setups.map((s) => ({
        id: s.id,
        user_id: userId,
        name: s.name,
        description: s.description ?? null,
      }));

      setImportMsg(`Upserting ${dbSetups.length} setups…`);

      const { error: upsertSetupsError } = await supabase
        .from("inventory_setups")
        .upsert(dbSetups, { onConflict: "id" });

      if (upsertSetupsError) throw new Error(upsertSetupsError.message);

      // 5) Rebuild join rows (simple + reliable)
      setImportMsg(`Rebuilding setup ↔ items links…`);

      // Delete existing join rows for this user (so you don’t get stale links)
      const { error: delJoinError } = await supabase
        .from("inventory_setup_items")
        .delete()
        .eq("user_id", userId);

      if (delJoinError) throw new Error(delJoinError.message);

      const joinRows = setups.flatMap((s) =>
        (s.items || []).map((itemId, idx) => ({
          user_id: userId,
          setup_id: s.id,
          item_id: itemId,
          position: idx,
        }))
      );

      if (joinRows.length) {
        const { error: insJoinError } = await supabase
          .from("inventory_setup_items")
          .insert(joinRows);

        if (insJoinError) throw new Error(insJoinError.message);
      }

      setImportMsg("✅ Import complete.");
      await loadItems();
    } catch (e: any) {
      setImportMsg(`❌ Import failed: ${e?.message || String(e)}`);
    } finally {
      setImporting(false);
    }
  }

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
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <h1 style={{ margin: 0 }}>Inventory</h1>
        <button onClick={logout}>Sign out</button>
      </div>

      <p style={{ marginTop: "1rem" }}>
        Logged in as: <b>{session.user.email}</b>
      </p>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", margin: "1rem 0" }}>
        <button onClick={importFromJson} disabled={importing}>
          {importing ? "Importing…" : "Import from JSON seed"}
        </button>
        <span style={{ opacity: 0.8 }}>{importMsg}</span>
      </div>

      <hr style={{ margin: "1rem 0" }} />

      <h2 style={{ margin: "0 0 0.5rem" }}>Items</h2>

      {loadingItems && <p>Loading…</p>}
      {itemsError && <p style={{ color: "crimson" }}>Error: {itemsError}</p>}
      {!loadingItems && !itemsError && items.length === 0 && (
        <p style={{ opacity: 0.8 }}>No items in Supabase yet. Use “Import from JSON seed”.</p>
      )}

      <ul style={{ paddingLeft: "1.2rem" }}>
        {items.map((it) => (
          <li key={it.id}>
            <b>{it.name}</b>
            {it.category ? ` — ${it.category}` : ""}
            {it.location ? ` (📍 ${it.location})` : ""}
          </li>
        ))}
      </ul>
    </main>
  );
}
