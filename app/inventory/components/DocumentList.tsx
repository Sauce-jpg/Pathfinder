"use client";

import { useState } from "react";
import styles from "../inventory.module.css";

export type DocumentRecord = {
  id:          string;
  file_url:    string;
  filename:    string;
  file_size:   number;
  mime_type:   string;
  uploaded_at: string;
  metadata:    Record<string, string>;
};

type Props = {
  documents:  DocumentRecord[];
  canDelete?: boolean;
  onDelete:   (docId: string) => Promise<void>;
};

function fileIcon(mime: string, filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (mime.startsWith("image/"))             return "🖼️";
  if (mime === "application/pdf")            return "📄";
  if (ext === "eml" || ext === "html")       return "📧";
  if (["doc","docx"].includes(ext))          return "📝";
  if (["xls","xlsx","csv"].includes(ext))    return "📊";
  if (["ppt","pptx"].includes(ext))          return "📑";
  if (["zip","rar","7z"].includes(ext))      return "🗜️";
  if (["txt","md"].includes(ext))            return "📃";
  return "📎";
}

function fmtSize(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch { return iso; }
}

function isPreviewable(mime: string, filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (mime.startsWith("image/"))  return true;
  if (mime === "application/pdf") return true;
  if (["txt", "md"].includes(ext)) return true;
  if (ext === "eml")              return true; // has previewUrl
  if (["doc","docx","xls","xlsx","ppt","pptx"].includes(ext)) return true;
  return false;
}

type PreviewState = {
  doc:  DocumentRecord;
  type: "image" | "pdf" | "text" | "google" | "html";
  url:  string;
};

async function fetchTextContent(url: string): Promise<string> {
  const res = await fetch(url);
  return res.text();
}

export function DocumentList({ documents, canDelete = true, onDelete }: Props) {
  const [preview,     setPreview]     = useState<PreviewState | null>(null);
  const [textContent, setTextContent] = useState<string>("");
  const [deletingId,  setDeletingId]  = useState<string | null>(null);
  const [loadingId,   setLoadingId]   = useState<string | null>(null);

  async function openPreview(doc: DocumentRecord) {
    const ext  = doc.filename.split(".").pop()?.toLowerCase() ?? "";
    const mime = doc.mime_type;

    setLoadingId(doc.id);
    try {
      if (mime.startsWith("image/")) {
        setPreview({ doc, type: "image", url: doc.file_url });
      } else if (mime === "application/pdf") {
        setPreview({ doc, type: "pdf", url: doc.file_url });
      } else if (["txt", "md"].includes(ext)) {
        const text = await fetchTextContent(doc.file_url);
        setTextContent(text);
        setPreview({ doc, type: "text", url: doc.file_url });
      } else if (ext === "eml") {
        const previewUrl = doc.metadata?.previewUrl;
        if (previewUrl) {
          setPreview({ doc, type: "html", url: previewUrl });
        }
      } else if (["doc","docx","xls","xlsx","ppt","pptx"].includes(ext)) {
        const googleUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(doc.file_url)}&embedded=true`;
        setPreview({ doc, type: "google", url: googleUrl });
      }
    } finally {
      setLoadingId(null);
    }
  }

  async function handleDelete(docId: string) {
    if (!confirm("Delete this document? This cannot be undone.")) return;
    setDeletingId(docId);
    try {
      await onDelete(docId);
    } finally {
      setDeletingId(null);
    }
  }

  if (!documents.length) {
    return (
      <p className={styles.muted} style={{ fontSize: "0.88rem", margin: 0 }}>
        No documents yet.
      </p>
    );
  }

  return (
    <>
      <div style={{ display: "grid", gap: "0.45rem" }}>
        {documents.map((doc) => {
          const isEml    = doc.filename.toLowerCase().endsWith(".eml");
          const title    = isEml && doc.metadata?.subject ? doc.metadata.subject : doc.filename;
          const subtitle = isEml && doc.metadata?.from    ? `From: ${doc.metadata.from}` : null;
          const canView  = isPreviewable(doc.mime_type, doc.filename);

          return (
            <div
              key={doc.id}
              style={{
                display:       "flex",
                alignItems:    "center",
                gap:           "0.65rem",
                padding:       "0.5rem 0.65rem",
                border:        "1px solid rgba(0,0,0,0.08)",
                borderRadius:  10,
                background:    "rgba(0,0,0,0.01)",
              }}
            >
              {/* Icon */}
              <span style={{ fontSize: "1.4rem", flexShrink: 0 }}>
                {fileIcon(doc.mime_type, doc.filename)}
              </span>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight:   600,
                  fontSize:     "0.9rem",
                  overflow:     "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace:   "nowrap",
                }}>
                  {title}
                </div>
                {subtitle && (
                  <div className={styles.muted} style={{ fontSize: "0.78rem" }}>
                    {subtitle}
                  </div>
                )}
                <div className={styles.muted} style={{ fontSize: "0.75rem" }}>
                  {fmtSize(doc.file_size)} · {fmtDate(doc.uploaded_at)}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "0.35rem", flexShrink: 0 }}>
                {/* Preview */}
                {canView && (
                  <button
                    title="Preview"
                    disabled={loadingId === doc.id}
                    onClick={() => openPreview(doc)}
                    style={{
                      width:          32,
                      height:         32,
                      borderRadius:   8,
                      border:         "none",
                      background:     "#22c55e",
                      color:          "#fff",
                      cursor:         "pointer",
                      display:        "flex",
                      alignItems:     "center",
                      justifyContent: "center",
                      fontSize:       "0.9rem",
                      opacity:        loadingId === doc.id ? 0.5 : 1,
                    }}
                  >
                    {loadingId === doc.id ? "…" : "👁"}
                  </button>
                )}

                {/* Download */}
                
                  href={doc.file_url}
                  download={doc.filename}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Download"
                  style={{
                    width:          32,
                    height:         32,
                    borderRadius:   8,
                    background:     "#3b82f6",
                    color:          "#fff",
                    display:        "flex",
                    alignItems:     "center",
                    justifyContent: "center",
                    textDecoration: "none",
                    fontSize:       "0.9rem",
                  }}
                >
                  ↓
                </a>

                {/* Delete */}
                {canDelete && (
                  <button
                    title="Delete"
                    disabled={deletingId === doc.id}
                    onClick={() => handleDelete(doc.id)}
                    style={{
                      width:          32,
                      height:         32,
                      borderRadius:   8,
                      border:         "none",
                      background:     "#ef4444",
                      color:          "#fff",
                      cursor:         "pointer",
                      display:        "flex",
                      alignItems:     "center",
                      justifyContent: "center",
                      fontSize:       "0.85rem",
                      opacity:        deletingId === doc.id ? 0.5 : 1,
                    }}
                  >
                    {deletingId === doc.id ? "…" : "🗑"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Fullscreen preview overlay */}
      {preview && (
        <div
          style={{
            position:       "fixed",
            inset:          0,
            background:     "rgba(0,0,0,0.92)",
            zIndex:         500,
            display:        "flex",
            flexDirection:  "column",
          }}
          onClick={() => setPreview(null)}
        >
          {/* Toolbar */}
          <div
            style={{
              display:        "flex",
              alignItems:     "center",
              gap:            "0.75rem",
              padding:        "0.75rem 1rem",
              background:     "rgba(0,0,0,0.5)",
              flexShrink:     0,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <span style={{ color: "#fff", fontWeight: 600, flex: 1, fontSize: "0.92rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {preview.doc.metadata?.subject ?? preview.doc.filename}
            </span>
            
              href={preview.doc.file_url}
              download={preview.doc.filename}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding:        "0.35rem 0.85rem",
                borderRadius:   8,
                background:     "#3b82f6",
                color:          "#fff",
                textDecoration: "none",
                fontSize:       "0.85rem",
                fontWeight:     600,
              }}
            >
              ↓ Download
            </a>
            <button
              onClick={() => setPreview(null)}
              style={{
                width:          36,
                height:         36,
                borderRadius:   999,
                border:         "none",
                background:     "rgba(255,255,255,0.15)",
                color:          "#fff",
                fontSize:       "1rem",
                cursor:         "pointer",
                display:        "grid",
                placeItems:     "center",
              }}
            >✕</button>
          </div>

          {/* Content */}
          <div
            style={{ flex: 1, overflow: "hidden", padding: preview.type === "text" ? "1.5rem" : "0" }}
            onClick={(e) => e.stopPropagation()}
          >
            {preview.type === "image" && (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
                <img
                  src={preview.url}
                  alt={preview.doc.filename}
                  style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8 }}
                />
              </div>
            )}

            {(preview.type === "pdf" || preview.type === "google" || preview.type === "html") && (
              <iframe
                src={preview.url}
                style={{ width: "100%", height: "100%", border: "none", background: "#fff" }}
                title={preview.doc.filename}
              />
            )}

            {preview.type === "text" && (
              <pre style={{
                color:      "#e2e8f0",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize:   "0.85rem",
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
                wordBreak:  "break-word",
                margin:     0,
                overflow:   "auto",
                height:     "100%",
              }}>
                {textContent}
              </pre>
            )}
          </div>
        </div>
      )}
    </>
  );
}
