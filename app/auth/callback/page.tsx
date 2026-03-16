"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function CallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // Handle both PKCE (code in query) and implicit (#access_token in hash)
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        router.push("/");
      }
    });
  }, [router]);

  return (
    <main style={{ maxWidth: 400, margin: "4rem auto", padding: "2rem", textAlign: "center" }}>
      <p>Signing you in...</p>
    </main>
  );
}
,
