"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type InventoryItem = {
  id: string;
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
  purchase: any;          // jsonb
  specs: any;             // jsonb
  purchase_history: any;  // jsonb
};

export default function InventoryPage() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;

    (async () => {
      setLoadingItems(true);
      setItemsError(null);

      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .order("name", { ascending: true });

      if (error) setItemsError(error.message);
      setItems((data || []) as InventoryItem[]);
      setLoadingItems(false);
    })();
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

      <hr style={{ margin: "1rem 0" }} />

      <h2 style={{ margin: "0 0 0.5rem" }}>Items</h2>

      {loadingItems && <p>Loading…</p>}
      {itemsError && <p style={{ color: "crimson" }}>Error: {itemsError}</p>}
      {!loadingItems && !itemsError && items.length === 0 && (
        <p style={{ opacity: 0.8 }}>No items yet. Next: import your JSON into Supabase.</p>
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
