"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function CallbackPage() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        console.log('[callback] cookies:', document.cookie);
        console.log('[callback] localStorage keys:', Object.keys(localStorage).filter(k => k.includes('sb-')));
        window.location.href = '/';
        return;
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
          subscription.unsubscribe();
          console.log('[callback] cookies:', document.cookie);
          console.log('[callback] localStorage keys:', Object.keys(localStorage).filter(k => k.includes('sb-')));
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
