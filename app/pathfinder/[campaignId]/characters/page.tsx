"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";
import Link from "next/link";

export default function CharactersPage() {
  const params = useParams();
  const campaignId = params.campaignId as string;

  const [session, setSession] = useState<any>(null);
  const [campaign, setCampaign] = useState<any>(null);
  const [characters, setCharacters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    loadData();
  }, [session?.user?.id, campaignId]);

  async function loadData() {
    setLoading(true);

    // Load campaign
    const { data: campaignData } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    setCampaign(campaignData);

    // Load characters
    const { data: charactersData } = await supabase
      .from("characters")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("name");

    setCharacters(charactersData || []);
    setLoading(false);
  }

  if (!session) {
    return (
      <main style={{ maxWidth: 900, margin: "4rem auto", padding: "2rem", textAlign: "center" }}>
        <p>Please sign in to view characters.</p>
        <a href="/auth/login" style={{ color: "#0070f3" }}>Sign In</a>
      </main>
    );
  }

  if (loading) {
    return (
      <main style={{ maxWidth: 900, margin: "4rem auto", padding: "2rem", textAlign: "center" }}>
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem" }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: "2rem" }}>
        <Link href="/pathfinder" style={{ color: "#0070f3", textDecoration: "none", fontSize: "0.9rem" }}>
          ← Campaigns
        </Link>
        <span style={{ margin: "0 0.5rem", color: "#999" }}>/</span>
        <Link href={`/pathfinder/${campaignId}`} style={{ color: "#0070f3", textDecoration: "none", fontSize: "0.9rem" }}>
          {campaign?.name || "Campaign"}
        </Link>
        <span style={{ margin: "0 0.5rem", color: "#999" }}>/</span>
        <span style={{ fontSize: "0.9rem" }}>Characters</span>
      </div>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ margin: 0 }}>Characters</h1>
          <p style={{ margin: "0.5rem 0 0", color: "#666" }}>
            {characters.length} character{characters.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href={`/pathfinder/${campaignId}/characters/new`}
          style={{
            padding: "0.75rem 1.5rem",
            background: "#10b981",
            color: "white",
            textDecoration: "none",
            borderRadius: "8px",
            fontWeight: 600,
          }}
        >
          + New Character
        </Link>
      </div>

      {/* Character Grid */}
      {characters.length === 0 ? (
        <div
          style={{
            background: "#f9fafb",
            border: "2px dashed #ddd",
            borderRadius: "12px",
            padding: "3rem",
            textAlign: "center",
          }}
        >
          <h2 style={{ margin: 0, color: "#666" }}>No characters yet</h2>
          <p style={{ margin: "0.5rem 0 1.5rem", color: "#999" }}>
            Create your first character to get started!
          </p>
          <Link
            href={`/pathfinder/${campaignId}/characters/new`}
            style={{
              display: "inline-block",
              padding: "0.75rem 1.5rem",
              background: "#0070f3",
              color: "white",
              textDecoration: "none",
              borderRadius: "8px",
              fontWeight: 600,
            }}
          >
            + Create Character
          </Link>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "1.5rem",
          }}
        >
          {characters.map((char) => (
            <Link
              key={char.id}
              href={`/pathfinder/${campaignId}/characters/${char.id}`}
              style={{
                background: "white",
                border: "1px solid #ddd",
                borderRadius: "12px",
                padding: "1.5rem",
                textDecoration: "none",
                color: "inherit",
                transition: "box-shadow 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {/* Character Portrait */}
              {char.portrait_url && (
                <img
                  src={char.portrait_url}
                  alt={char.name}
                  style={{
                    width: "100%",
                    height: "200px",
                    objectFit: "cover",
                    borderRadius: "8px",
                    marginBottom: "1rem",
                  }}
                />
              )}

              {/* Character Info */}
              <h3 style={{ margin: "0 0 0.5rem 0" }}>{char.name}</h3>
              
              <div style={{ fontSize: "0.9rem", color: "#666", marginBottom: "0.75rem" }}>
                {char.race} {char.classes}
              </div>

              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <span
                  style={{
                    padding: "0.25rem 0.75rem",
                    background: "#e0e7ff",
                    color: "#4338ca",
                    borderRadius: "12px",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                  }}
                >
                  Level {char.level}
                </span>
                <span
                  style={{
                    padding: "0.25rem 0.75rem",
                    background: "#fef3c7",
                    color: "#92400e",
                    borderRadius: "12px",
                    fontSize: "0.85rem",
                  }}
                >
                  {char.character_type || "PC"}
                </span>
              </div>

              {char.alignment && (
                <div style={{ marginTop: "0.75rem", fontSize: "0.85rem", color: "#999" }}>
                  {char.alignment}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
