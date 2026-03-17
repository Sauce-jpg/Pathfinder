"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function CallbackPage() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Manually set a cookie that middleware can read
        document.cookie = `sb-session=1; path=/; max-age=3600; SameSite=Lax`;
        window.location.href = '/';
        return;
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
          subscription.unsubscribe();
          document.cookie = `sb-session=1; path=/; max-age=3600; SameSite=Lax`;
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
