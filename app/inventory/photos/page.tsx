"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import { uploadInventoryImage } from "../../../lib/r2Client";
import { DbItem, DbPhoto } from "../types";
import { PhotoModal } from "../components/PhotoModal";
import styles from "./photos.module.css";
import invStyles from "../inventory.module.css";

export default function PhotosPage() {
  const [session,    setSession]    = useState<any>(null);
  const [photos,     setPhotos]     = useState<DbPhoto[]>([]);
  const [items,      setItems]      = useState<DbItem[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const [uploadErr,  setUploadErr]  = useState<string | null>(null);
  const [modalPhoto, setModalPhoto] = useState<DbPhoto | null>(null);
  const [q,          setQ]          = useState("");
  const [locFilter,  setLocFilter]  = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user?.id) loadAll();
  }, [session?.user?.id]);

  async function loadAll() {
    if (!session?.user?.id) return;
    setLoading(true);

    const [photosRes, itemsRes] = await Promise.all([
      supabase
        .from("inventory_photos")
        .select("*")
        .order("date_taken", { ascending: false, nullsFirst: false }),
      supabase
        .from("inventory_items")
        .select("id, name, category")
        .order("name", { ascending: true }),
    ]);

    setPhotos((photosRes.data || []) as DbPhoto[]);
    setItems((itemsRes.data || []) as DbItem[]);
    setLoading(false);
  }

  async function getAccessToken(): Promise<string> {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length || !session?.user?.id) return;
    setUploading(true);
    setUploadErr(null);

    try {
      const token = await getAccessToken();
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/"))
          throw new Error(`${file.name} is not an image.`);
        if (file.size > 20 * 1024 * 1024)
          throw new Error(`${file.name} is over 20 MB.`);

        // Upload to R2 — reuse existing presign flow, folder is inventory/photos/
        const url = await uploadInventoryImage(file, token);

        // Create DB record with just the URL — user edits metadata after
        const { error } = await supabase.from("inventory_photos").insert({
          user_id:     session.user.id,
          url,
          date_taken:  null,
          location:    null,
          description: null,
          tags:        [],
          item_ids:    [],
        });

        if (error) throw new Error(error.message);
      }

      await loadAll();
    } catch (e: any) {
      setUploadErr(e?.message || "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  // Derived suggestion lists
  const locations = useMemo(
    () => [...new Set(photos.map((p) => p.location).filter(Boolean) as string[])].sort(),
    [photos]
  );

  const filtered = useMemo(() => {
    let list = [...photos];
    if (q.trim()) {
      const lq = q.trim().toLowerCase();
      list = list.filter(
        (p) =>
          (p.description ?? "").toLowerCase().includes(lq) ||
          (p.location    ?? "").toLowerCase().includes(lq) ||
          (p.tags || []).some((t) => t.toLowerCase().includes(lq))
      );
    }
    if (locFilter) list = list.filter((p) => p.location === locFilter);
    return list;
  }, [photos, q, locFilter]);

  function itemName(id: string) {
    return items.find((x) => x.id === id)?.name ?? id;
  }

  if (!session) {
    return (
      <main style={{ maxWidth: 600, margin: "4rem auto", textAlign: "center", padding: "0 1rem" }}>
        <h1>📷 Photos</h1>
        <p>Sign in to view your photos.</p>
        <Link href="/auth/login" style={{ color: "#0070f3" }}>Sign in</Link>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.25rem" }}>
            <h1 style={{ margin: 0 }}>📷 Photos</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <p style={{ margin: 0, opacity: 0.6, fontSize: "0.95rem" }}>
              Photos linked to your inventory items.
            </p>
            <Link
              href="/"
              style={{ fontSize: "0.82rem", opacity: 0.5, textDecoration: "none", whiteSpace: "nowrap" }}
            >
              ← Hub
            </Link>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.65rem", alignItems: "center" }}>
          <Link
            href="/inventory"
            style={{
              fontSize: "0.88rem",
              padding: "0.35rem 0.75rem",
              borderRadius: "999px",
              background: "rgba(0,0,0,0.06)",
              textDecoration: "none",
              color: "inherit",
              fontWeight: 600,
            }}
          >
            ← Inventory
          </Link>
          <button
            className={invStyles.invBtn}
            onClick={loadAll}
            disabled={loading}
          >
            {loading ? "Loading…" : "↻ Refresh"}
          </button>
        </div>
      </div>

      {/* Drop zone */}
      <div
        className={`${styles.dropZone} ${uploading ? styles.dropZoneUploading : ""}`}
        onClick={() => !uploading && inputRef.current?.click()}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
        onDragOver={(e) => e.preventDefault()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => handleFiles(e.target.files)}
        />
        {uploading ? (
          <span className={styles.dropZoneText}>Uploading…</span>
        ) : (
          <>
            <span className={styles.dropZoneIcon}>📷</span>
            <span className={styles.dropZoneText}>Drop photos here or click to upload</span>
            <span className={styles.dropZoneHint}>JPEG, PNG, WebP · max 20 MB each</span>
          </>
        )}
      </div>

      {uploadErr && (
        <p style={{ color: "crimson", marginBottom: "0.75rem" }}>{uploadErr}</p>
      )}

      {/* Filter bar */}
      {!!photos.length && (
        <div className={styles.filterBar}>
          <div>
            <div className={styles.filterLabel}>Search</div>
            <input
              className={invStyles.invInput}
              type="search"
              placeholder="Description, location, tag…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>
          <div>
            <div className={styles.filterLabel}>Location</div>
            <select
              className={invStyles.invSelect}
              value={locFilter}
              onChange={(e) => setLocFilter(e.target.value)}
              style={{ width: "100%" }}
            >
              <option value="">All locations</option>
              {locations.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <span style={{ fontSize: "0.88rem", opacity: 0.5 }}>
              {filtered.length} photo{filtered.length === 1 ? "" : "s"}
            </span>
          </div>
          <button
            className={invStyles.invBtn}
            onClick={() => { setQ(""); setLocFilter(""); }}
          >
            Reset
          </button>
        </div>
      )}

      {/* Grid */}
      {!photos.length && !loading ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📷</div>
          <p>No photos yet — upload one above.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((photo) => (
            <div
              key={photo.id}
              className={styles.card}
              onClick={() => setModalPhoto(photo)}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setModalPhoto(photo); }}
            >
              <img
                className={styles.cardImg}
                src={photo.url}
                alt={photo.description || ""}
                loading="lazy"
              />
              <div className={styles.cardBody}>
                {photo.date_taken && (
                  <div className={styles.cardDate}>{photo.date_taken}</div>
                )}
                {photo.description && (
                  <div className={styles.cardDesc}>{photo.description}</div>
                )}
                {photo.location && (
                  <div className={styles.cardLocation}>📍 {photo.location}</div>
                )}
                {!!(photo.item_ids || []).length && (
                  <div className={styles.cardItems}>
                    {photo.item_ids.slice(0, 3).map((id) => (
                      <span key={id} className={styles.cardItemBadge}>
                        {itemName(id)}
                      </span>
                    ))}
                    {photo.item_ids.length > 3 && (
                      <span className={styles.cardItemBadge}>
                        +{photo.item_ids.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Photo modal */}
      <PhotoModal
        photo={modalPhoto}
        allItems={items}
        onClose={() => setModalPhoto(null)}
        onSaved={async () => { await loadAll(); }}
        onDeleted={() => { setModalPhoto(null); loadAll(); }}
        session={session}
      />
    </main>
  );
}
