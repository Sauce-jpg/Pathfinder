"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import Link from "next/link";

export default function CampaignDashboard() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.campaignId as string;

  const [session, setSession] = useState<any>(null);
  const [campaign, setCampaign] = useState<any>(null);
  const [characters, setCharacters] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Check auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load campaign data
  useEffect(() => {
    if (!session?.user?.id) return;
    loadCampaignData();
  }, [session?.user?.id, campaignId]);

  async function loadCampaignData() {
    setLoading(true);

    // Load campaign
    const { data: campaignData, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (campaignError) {
      console.error("Error loading campaign:", campaignError);
      setLoading(false);
      return;
    }

    setCampaign(campaignData);

    // Load characters
    const { data: charactersData } = await supabase
      .from("characters")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("name");

    setCharacters(charactersData || []);

    // Load locations
    const { data: locationsData } = await supabase
      .from("locations")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("name");

    setLocations(locationsData || []);

    // Load businesses
    const { data: businessesData } = await supabase
      .from("businesses")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("name");

    setBusinesses(businessesData || []);

    setLoading(false);
  }

  if (!session) {
    return (
      <main style={{ maxWidth: 900, margin: "4rem auto", padding: "2rem", textAlign: "center" }}>
        <p>Please sign in to view this campaign.</p>
        <a href="/auth/login" style={{ color: "#0070f3" }}>Sign In</a>
      </main>
    );
  }

  if (loading) {
    return (
      <main style={{ maxWidth: 900, margin: "4rem auto", padding: "2rem", textAlign: "center" }}>
        <p>Loading campaign...</p>
      </main>
    );
  }

  if (!campaign) {
    return (
      <main style={{ maxWidth: 900, margin: "4rem auto", padding: "2rem", textAlign: "center" }}>
        <h1>Campaign not found</h1>
        <Link href="/pathfinder" style={{ color: "#0070f3" }}>← Back to campaigns</Link>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <Link
          href="/pathfinder"
          style={{
            color: "#0070f3",
            textDecoration: "none",
            fontSize: "0.9rem",
            display: "inline-block",
            marginBottom: "1rem",
          }}
        >
          ← Back to Campaigns
        </Link>
        <h1 style={{ margin: "0 0 0.5rem 0" }}>{campaign.name}</h1>
        {campaign.description && (
          <p style={{ margin: 0, color: "#666" }}>{campaign.description}</p>
        )}
      </div>

      {/* Dashboard Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "1.5rem",
        }}
      >
        {/* Characters Card */}
        <div
          style={{
            background: "white",
            border: "1px solid #ddd",
            borderRadius: "12px",
            padding: "1.5rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 style={{ margin: 0 }}>Characters</h2>
            <span
              style={{
                background: "#e0e7ff",
                color: "#4338ca",
                padding: "0.25rem 0.75rem",
                borderRadius: "12px",
                fontSize: "0.85rem",
                fontWeight: 600,
              }}
            >
              {characters.length}
            </span>
          </div>

          {characters.length === 0 ? (
            <p style={{ color: "#999", fontSize: "0.9rem" }}>No characters yet</p>
          ) : (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {characters.slice(0, 5).map((char) => (
                <Link
                  key={char.id}
                  href={`/pathfinder/${campaignId}/characters/${char.id}`}
                  style={{
                    display: "block",
                    padding: "0.75rem",
                    background: "#f9fafb",
                    borderRadius: "8px",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{char.name}</div>
                  <div style={{ fontSize: "0.85rem", color: "#666", marginTop: "0.25rem" }}>
                    {char.race} {char.classes} • Level {char.level}
                  </div>
                </Link>
              ))}
            </div>
          )}

          <Link
            href={`/pathfinder/${campaignId}/characters`}
            style={{
              display: "inline-block",
              marginTop: "1rem",
              color: "#0070f3",
              textDecoration: "none",
              fontSize: "0.9rem",
            }}
          >
            View all characters →
          </Link>
        </div>

        {/* Locations Card */}
        <div
          style={{
            background: "white",
            border: "1px solid #ddd",
            borderRadius: "12px",
            padding: "1.5rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 style={{ margin: 0 }}>Locations</h2>
            <span
              style={{
                background: "#dcfce7",
                color: "#15803d",
                padding: "0.25rem 0.75rem",
                borderRadius: "12px",
                fontSize: "0.85rem",
                fontWeight: 600,
              }}
            >
              {locations.length}
            </span>
          </div>

          {locations.length === 0 ? (
            <p style={{ color: "#999", fontSize: "0.9rem" }}>No locations yet</p>
          ) : (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {locations.slice(0, 5).map((loc) => (
                <div
                  key={loc.id}
                  style={{
                    padding: "0.75rem",
                    background: "#f9fafb",
                    borderRadius: "8px",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{loc.name}</div>
                  <div style={{ fontSize: "0.85rem", color: "#666", marginTop: "0.25rem" }}>
                    {loc.location_type}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              display: "inline-block",
              marginTop: "1rem",
              color: "#999",
              fontSize: "0.9rem",
            }}
          >
            Coming soon →
          </div>
        </div>

        {/* Businesses Card */}
        <div
          style={{
            background: "white",
            border: "1px solid #ddd",
            borderRadius: "12px",
            padding: "1.5rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 style={{ margin: 0 }}>Businesses</h2>
            <span
              style={{
                background: "#fef3c7",
                color: "#92400e",
                padding: "0.25rem 0.75rem",
                borderRadius: "12px",
                fontSize: "0.85rem",
                fontWeight: 600,
              }}
            >
              {businesses.length}
            </span>
          </div>

          {businesses.length === 0 ? (
            <p style={{ color: "#999", fontSize: "0.9rem" }}>No businesses yet</p>
          ) : (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {businesses.slice(0, 5).map((biz) => (
                <div
                  key={biz.id}
                  style={{
                    padding: "0.75rem",
                    background: "#f9fafb",
                    borderRadius: "8px",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{biz.name}</div>
                  <div style={{ fontSize: "0.85rem", color: "#666", marginTop: "0.25rem" }}>
                    {biz.business_type || "Business"}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              display: "inline-block",
              marginTop: "1rem",
              color: "#999",
              fontSize: "0.9rem",
            }}
          >
            Coming soon →
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div
        style={{
          marginTop: "2rem",
          padding: "1.5rem",
          background: "#f9fafb",
          borderRadius: "12px",
        }}
      >
        <h3 style={{ margin: "0 0 1rem 0" }}>Quick Actions</h3>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link
            href={`/pathfinder/${campaignId}/characters/new`}
            style={{
              padding: "0.75rem 1.5rem",
              background: "#0070f3",
              color: "white",
              textDecoration: "none",
              borderRadius: "8px",
              fontWeight: 600,
            }}
          >
            + New Character
          </Link>
          <button
            disabled
            style={{
              padding: "0.75rem 1.5rem",
              background: "#eee",
              color: "#999",
              border: "none",
              borderRadius: "8px",
              fontWeight: 600,
              cursor: "not-allowed",
            }}
          >
            + New Location (Coming Soon)
          </button>
          <button
            disabled
            style={{
              padding: "0.75rem 1.5rem",
              background: "#eee",
              color: "#999",
              border: "none",
              borderRadius: "8px",
              fontWeight: 600,
              cursor: "not-allowed",
            }}
          >
            + New Business (Coming Soon)
          </button>
        </div>
      </div>
    </main>
  );
}
