"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import Link from "next/link";

export default function PathfinderPage() {
  const [session, setSession] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [newCampaignDescription, setNewCampaignDescription] = useState("");

  // Check auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      console.log("Session data:", data.session);
      console.log("User ID:", data.session?.user?.id);
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      console.log("Auth state changed:", sess);
      setSession(sess);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load campaigns
  useEffect(() => {
    if (!session?.user?.id) return;
    loadCampaigns();
  }, [session?.user?.id]);

  async function loadCampaigns() {
    console.log("Loading campaigns...");
    console.log("Session user ID:", session?.user?.id);
    
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .order("updated_at", { ascending: false });

    console.log("Campaigns data:", data);
    console.log("Campaigns error:", error);

    if (error) {
      console.error("Error loading campaigns:", error);
    } else {
      setCampaigns(data || []);
    }
  }

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.user?.id) return;

    console.log("Creating campaign with owner_id:", session.user.id);

    const { error } = await supabase.from("campaigns").insert({
      owner_id: session.user.id,
      name: newCampaignName,
      description: newCampaignDescription,
    });

    if (error) {
      console.error("Create campaign error:", error);
      alert("Error creating campaign: " + error.message);
    } else {
      console.log("Campaign created successfully");
      setNewCampaignName("");
      setNewCampaignDescription("");
      setShowNewCampaign(false);
      
      // Add small delay before reloading
      await new Promise(resolve => setTimeout(resolve, 300));
      
      await loadCampaigns();
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    document.cookie = 'sb-session=; path=/; max-age=0';
    window.location.href = '/auth/login';
  }

  // Loading state
  if (loading || !session) {
    return (
      <main style={{ maxWidth: 900, margin: "4rem auto", padding: "2rem", textAlign: "center" }}>
        <p>Loading...</p>
      </main>
    );
  }


  // Logged in - show campaigns
  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ margin: 0 }}>⚔️ Pathfinder Campaigns</h1>
          <p style={{ margin: "0.5rem 0 0", color: "#666" }}>
            Manage your campaigns, characters, and adventures
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.9rem", color: "#666" }}>
            {session.user.email}
          </span>
          <button
            onClick={logout}
            style={{
              padding: "0.5rem 1rem",
              background: "#eee",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* New Campaign Button */}
      <button
        onClick={() => setShowNewCampaign(true)}
        style={{
          padding: "0.75rem 1.5rem",
          background: "#10b981",
          color: "white",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
          fontWeight: 600,
          marginBottom: "1.5rem",
        }}
      >
        + New Campaign
      </button>

      {/* New Campaign Form */}
      {showNewCampaign && (
        <div
          style={{
            background: "white",
            border: "1px solid #ddd",
            borderRadius: "12px",
            padding: "1.5rem",
            marginBottom: "2rem",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Create New Campaign</h2>
          <form onSubmit={createCampaign} style={{ display: "grid", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>
                Campaign Name
              </label>
              <input
                type="text"
                value={newCampaignName}
                onChange={(e) => setNewCampaignName(e.target.value)}
                placeholder="e.g., Rise of the Runelords"
                required
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "1rem",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>
                Description (optional)
              </label>
              <textarea
                value={newCampaignDescription}
                onChange={(e) => setNewCampaignDescription(e.target.value)}
                placeholder="Brief description of the campaign..."
                rows={3}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "1rem",
                  resize: "vertical",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                type="submit"
                style={{
                  padding: "0.75rem 1.5rem",
                  background: "#0070f3",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Create Campaign
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewCampaign(false);
                  setNewCampaignName("");
                  setNewCampaignDescription("");
                }}
                style={{
                  padding: "0.75rem 1.5rem",
                  background: "#eee",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Campaign List */}
      {campaigns.length === 0 ? (
        <div
          style={{
            background: "#f9fafb",
            border: "2px dashed #ddd",
            borderRadius: "12px",
            padding: "3rem",
            textAlign: "center",
          }}
        >
          <h2 style={{ margin: 0, color: "#666" }}>No campaigns yet</h2>
          <p style={{ margin: "0.5rem 0 0", color: "#999" }}>
            Create your first campaign to get started!
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "1.5rem",
          }}
        >
          {campaigns.map((campaign) => (
            <Link
              key={campaign.id}
              href={`/pathfinder/${campaign.id}`}
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
              <h3 style={{ margin: "0 0 0.5rem 0" }}>{campaign.name}</h3>
              {campaign.description && (
                <p style={{ margin: 0, color: "#666", fontSize: "0.95rem" }}>
                  {campaign.description}</p>
              )}
              <div style={{ marginTop: "1rem", fontSize: "0.85rem", color: "#999" }}>
                {campaign.system || "Pathfinder 1e"}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Back to Hub */}
      <div style={{ marginTop: "3rem", textAlign: "center" }}>
        <a
          href="/"
          style={{
            color: "#0070f3",
            textDecoration: "none",
            fontSize: "0.95rem",
          }}
        >
          ← Back to Hub
        </a>
      </div>
    </main>
  );
}
