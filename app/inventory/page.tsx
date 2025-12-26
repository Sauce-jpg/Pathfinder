"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function InventoryPage() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

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
        <p>Sign in to edit and sync across devices.</p>

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

      <p style={{ opacity: 0.8 }}>
        Next step: load items from Supabase + add/edit UI.
      </p>
    </main>
  );
}
