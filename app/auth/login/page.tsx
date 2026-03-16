"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const router = useRouter();

  async function handleEmailPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      router.push("/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLink() {
    if (!email.includes("@")) {
      setError("Please enter a valid email");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
      setMagicLinkSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (magicLinkSent) {
    return (
      <main style={{ maxWidth: 500, margin: "4rem auto", padding: "2rem", textAlign: "center" }}>
        <h1>📧 Check your email</h1>
        <p style={{ marginTop: "1rem", color: "#666" }}>
          We sent a magic link to <strong>{email}</strong>
        </p>
        <p style={{ color: "#666" }}>Click the link to sign in.</p>
        <button
          onClick={() => setMagicLinkSent(false)}
          style={{
            marginTop: "2rem",
            padding: "0.75rem 1.5rem",
            background: "#eee",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          ← Back
        </button>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 450, margin: "4rem auto", padding: "2rem" }}>
      <h1 style={{ textAlign: "center", marginBottom: "2rem" }}>Sign In to HUB</h1>

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

      {/* Google OAuth */}
      <button
        onClick={handleGoogleLogin}
        disabled={loading}
        style={{
          width: "100%",
          padding: "0.75rem",
          background: "#fff",
          border: "1px solid #ddd",
          borderRadius: "8px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          fontSize: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <span>🔐</span>
        Continue with Google
      </button>

      <div style={{ textAlign: "center", margin: "1.5rem 0", color: "#999" }}>or</div>

      {/* Email/Password Form */}
      <form onSubmit={handleEmailPassword} style={{ display: "grid", gap: "1rem" }}>
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
          placeholder="Password"
          required
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
            background: "#0070f3",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "1rem",
            fontWeight: 600,
          }}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>

      {/* Magic Link */}
      <div style={{ textAlign: "center", margin: "1.5rem 0", color: "#999" }}>or</div>

      <button
        onClick={handleMagicLink}
        disabled={loading || !email}
        style={{
          width: "100%",
          padding: "0.75rem",
          background: "#f5f5f5",
          border: "1px solid #ddd",
          borderRadius: "8px",
          cursor: "pointer",
          fontSize: "0.95rem",
        }}
      >
        📧 Send magic link to {email || "email"}
      </button>

      <p style={{ textAlign: "center", marginTop: "2rem", color: "#666" }}>
        Don't have an account?{" "}
        <Link href="/auth/signup" style={{ color: "#0070f3", textDecoration: "none" }}>
          Sign up
        </Link>
      </p>
    </main>
  );
}
