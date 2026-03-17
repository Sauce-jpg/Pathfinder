"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function CallbackPage() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Hard redirect so middleware sees the session cookie
        window.location.href = '/';
        return;
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
          subscription.unsubscribe();
          window.location.href = '/';
        }
      });
    });
  }, []);

  return (
    <main style={{ maxWidth: 400, margin: "4rem auto", padding: "2rem", textAlign: "center" }}>
      <p>Signing you in...</p>
    </main>
  );
}
