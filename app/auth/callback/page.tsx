"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function CallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    console.log('[callback page] hash:', hash ? 'EXISTS' : 'EMPTY');
    console.log('[callback page] full url:', window.location.href);

    // Let Supabase process the hash automatically
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[callback page] session after getSession:', session ? 'EXISTS' : 'NULL');
      if (session) {
        router.push('/');
        return;
      }

      // If no session yet, wait for auth state change
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        console.log('[callback page] auth event:', event, 'session:', session ? 'EXISTS' : 'NULL');
        if (session) {
          subscription.unsubscribe();
          router.push('/');
        }
      });
    });
  }, [router]);

  return (
    <main style={{ maxWidth: 400, margin: "4rem auto", padding: "2rem", textAlign: "center" }}>
      <p>Signing you in...</p>
    </main>
  );
}
