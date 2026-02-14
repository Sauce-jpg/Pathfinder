"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Sign up
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName || email.split("@")[0],
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) throw signUpError;

      // Create user profile
      if (data.user) {
        const { error: profileError } = await supabase.from("users").insert({
          id: data.user.id,
          email: data.user.email!,
          display_name: displayName || email.split("@")[0],
        });

        // Ignore error if user already exists
        if (profileError && !profileError.message.includes("duplicate")) {
          console.error("Profile creation error:", profileError);
        }
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <main style={{ maxWidth: 500, margin: "4rem auto", padding: "2rem", textAlign: "center" }}>
        <h1>✅ Check your email!</h1>
        <p style={{ marginTop: "1rem", color: "#666" }}>
          We sent a confirmation email to <strong>{email}</strong>
        </p>
        <p style={{ color: "#666" }}>Click the link to verify your account, then sign in.</p>
        <Link
          href="/auth/login"
          style={{
            display: "inline-block",
            marginTop: "2rem",
            padding: "0.75rem 1.5rem",
            background: "#0070f3",
            color: "white",
            borderRadius: "8px",
            textDecoration: "none",
          }}
        >
          Go to Sign In
        </Link>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 450, margin: "4rem auto", padding: "2rem" }}>
      <h1 style={{ textAlign: "center", marginBottom: "2rem" }}>Create Account</h1>

      {error && (
        <div style={{
          background: "#fee",
          border: "1px solid #fcc",
          padding: "1rem",
          borderRadius: "8px",
          marginBottom: "1rem",
          color: "#c33",
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSignup} style={{ display: "grid", gap: "1rem" }}>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Display Name (optional)"
          style={{
            padding: "0.75rem",
            border: "1px solid #ddd",
            borderRadius: "8px",
            fontSize: "1rem",
          }}
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          style={{
            padding: "0.75rem",
            border: "1px solid #ddd",
            borderRadius: "8px",
            fontSize: "1rem",
          }}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min 6 characters)"
          required
          minLength={6}
          style={{
            padding: "0.75rem",
            border: "1px solid #ddd",
            borderRadius: "8px",
            fontSize: "1rem",
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "0.75rem",
            background: "#10b981",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "1rem",
            fontWeight: 600,
          }}
        >
          {loading ? "Creating account..." : "Create Account"}
        </button>
      </form>

      <p style={{ textAlign: "center", marginTop: "2rem", color: "#666" }}>
        Already have an account?{" "}
        <Link href="/auth/login" style={{ color: "#0070f3", textDecoration: "none" }}>
          Sign in
        </Link>
      </p>
    </main>
  );
}
