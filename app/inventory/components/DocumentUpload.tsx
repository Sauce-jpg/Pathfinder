"use client";

import { useRef, useState } from "react";
import styles from "../inventory.module.css";
import { DocumentRecord } from "./DocumentList";

type Props = {
  entityType: "item" | "order";
  entityId:   string;
  onUploaded: (doc: DocumentRecord) => void;
  session:    any;
};

const ACCEPTED = [
  "image/*",
  ".pdf",
  ".doc,.docx",
  ".xls,.xlsx",
  ".ppt,.pptx",
  ".txt,.md",
  ".csv",
  ".eml",
  ".zip,.rar,.7z",
].join(",");

export function DocumentUpload({ entityType, entityId, onUploaded, session }: Props) {
  const [uploading,   setUploading]   = useState(false);
  const [progress,    setProgress]    = useState(0);
  const [error,       setError]       = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function getToken(): Promise<string> {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await sb.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function uploadFile(file: File) {
    if (file.size > 25 * 1024 * 1024) {
      setError(`${file.name} exceeds 25 MB limit.`);
      return;
    }

    const token    = await getToken();
    const route    = entityType === "item"
      ? "/api/inventory/upload-item-document"
      : "/api/inventory/upload-order-document";
    const idField  = entityType === "item" ? "itemId" : "orderId";

    const formData = new FormData();
    formData.append("file", file);
    formData.append(idField, entityId);

    const res = await fetch(route, {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}` },
      body:    formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || "Upload failed");
    }

    const { doc } = await res.json();
    onUploaded(doc as DocumentRecord);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setUploading(true);
    setError(null);
    setProgress(0);

    const total = files.length;
    let done    = 0;

    try {
      for (const file of Array.from(files)) {
        await uploadFile(file);
        done++;
        setProgress(Math.round((done / total) * 100));
      }
    } catch (e: any) {
      setError(e?.message || "Upload failed");
    } finally {
      setUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED}
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div
        style={{
          border:         "2px dashed rgba(0,0,0,0.13)",
          borderRadius:   10,
          padding:        "1.25rem 1rem",
          textAlign:      "center",
          cursor:         uploading ? "wait" : "pointer",
          opacity:        uploading ? 0.7 : 1,
          transition:     "border-color 0.15s, background 0.15s",
        }}
        onClick={() => !uploading && inputRef.current?.click()}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
        onDragOver={(e) => e.preventDefault()}
        onDragEnter={(e) => { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.background = "rgba(0,0,0,0.03)"; }}
        onDragLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
      >
        {uploading ? (
          <div>
            <div style={{ fontSize: "0.88rem", fontWeight: 600, opacity: 0.6, marginBottom: "0.5rem" }}>
              Uploading… {progress}%
            </div>
            <div style={{
              height:       6,
              borderRadius: 999,
              background:   "rgba(0,0,0,0.08)",
              overflow:     "hidden",
              maxWidth:     200,
              margin:       "0 auto",
            }}>
              <div style={{
                height:     "100%",
                width:      `${progress}%`,
                background: "#22c55e",
                transition: "width 0.2s ease",
                borderRadius: 999,
              }} />
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: "1.5rem", opacity: 0.3, marginBottom: "0.35rem" }}>📎</div>
            <div style={{ fontSize: "0.9rem", fontWeight: 600, opacity: 0.6 }}>
              Drop files here or click to upload
            </div>
            <div style={{ fontSize: "0.76rem", opacity: 0.38, marginTop: "0.2rem" }}>
              PDF · Word · Excel · Images · EML · TXT · ZIP · max 25 MB
            </div>
          </>
        )}
      </div>

      {error && (
        <p style={{ color: "crimson", fontSize: "0.82rem", margin: "0.35rem 0 0" }}>
          {error}
        </p>
      )}
    </div>
  );
}
