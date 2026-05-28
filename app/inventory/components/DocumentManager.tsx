"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { DocumentUpload } from "./DocumentUpload";
import { DocumentList, DocumentRecord } from "./DocumentList";
import styles from "../inventory.module.css";

type Props = {
  entityType: "item" | "order";
  entityId:   string;
  session:    any;
};

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

export function DocumentManager({ entityType, entityId, session }: Props) {
  const [docs,    setDocs]    = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const table   = entityType === "item" ? "item_documents" : "order_documents";
  const idField = entityType === "item" ? "item_id"        : "order_id";

  useEffect(() => {
    if (!entityId) return;
    loadDocs();
  }, [entityId]);

  async function loadDocs() {
    setLoading(true);
    const { data } = await supabase
      .from(table)
      .select("*")
      .eq(idField, entityId)
      .order("uploaded_at", { ascending: true });
    setDocs((data || []) as DocumentRecord[]);
    setLoading(false);
  }

  function handleUploaded(doc: DocumentRecord) {
    setDocs((prev) => [...prev, doc]);
  }

  async function handleDelete(docId: string) {
    const token  = await getToken();
    const route  = entityType === "item"
      ? "/api/inventory/delete-item-document"
      : "/api/inventory/delete-order-document";

    const res = await fetch(route, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ docId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || "Delete failed");
    }

    setDocs((prev) => prev.filter((d) => d.id !== docId));
  }

  return (
    <div style={{
      border:       "1px solid rgba(0,0,0,0.08)",
      borderRadius: 12,
      overflow:     "hidden",
      marginTop:    "1rem",
    }}>
      {/* Header */}
      <div style={{
        padding:         "0.5rem 0.85rem",
        background:      "rgba(0,0,0,0.03)",
        borderBottom:    "1px solid rgba(0,0,0,0.07)",
        fontWeight:      700,
        fontSize:        "0.82rem",
        textTransform:   "uppercase",
        letterSpacing:   "0.05em",
        opacity:         0.7,
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "space-between",
      }}>
        <span>Documents</span>
        <span style={{ opacity: 0.6, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
          {loading ? "Loading…" : `${docs.length} file${docs.length === 1 ? "" : "s"}`}
        </span>
      </div>

      <div style={{ padding: "0.75rem 0.85rem", display: "grid", gap: "0.65rem" }}>
        <DocumentList
          documents={docs}
          canDelete={true}
          onDelete={handleDelete}
        />
        <DocumentUpload
          entityType={entityType}
          entityId={entityId}
          onUploaded={handleUploaded}
          session={session}
        />
      </div>
    </div>
  );
}
