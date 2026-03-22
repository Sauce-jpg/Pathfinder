"use client";

import { useRef, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { uploadInventoryImage, deleteInventoryImage } from "../../../lib/r2Client";
import styles from "../inventory.module.css";
import imgStyles from "./ImageManager.module.css";

type Props = {
  itemId: string;
  images: string[];
  onImagesChanged: (next: string[]) => void;
  session: any;
  // When true, shows just the grid + lightbox (no drop zone)
  compact?: boolean;
};

export function ImageManager({ itemId, images, onImagesChanged, session, compact }: Props) {
  const [uploading,   setUploading]   = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function getAccessToken(): Promise<string> {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setUploading(true);
    setUploadError(null);

    try {
      const token    = await getAccessToken();
      const uploaded: string[] = [];

      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/"))
          throw new Error(`${file.name} is not an image.`);
        if (file.size > 10 * 1024 * 1024)
          throw new Error(`${file.name} is over 10 MB.`);

        const url = await uploadInventoryImage(file, token);
        uploaded.push(url);
      }

      const next = [...images, ...uploaded];
      const { error } = await supabase
        .from("inventory_items")
        .update({ images: next })
        .eq("id", itemId);

      if (error) throw new Error(error.message);
      onImagesChanged(next);
    } catch (e: any) {
      setUploadError(e?.message || "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete(url: string) {
    if (!confirm("Remove this image?")) return;
    setDeletingUrl(url);
    try {
      const token = await getAccessToken();
      await deleteInventoryImage(url, token);
      const next = images.filter((u) => u !== url);
      const { error } = await supabase
        .from("inventory_items")
        .update({ images: next })
        .eq("id", itemId);
      if (error) throw new Error(error.message);
      onImagesChanged(next);
    } catch (e: any) {
      alert(e?.message || "Delete failed");
    } finally {
      setDeletingUrl(null);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }

  // Expose a trigger for the hidden file input so the parent
  // action bar button can call it directly
  function triggerPick() {
    if (!uploading) inputRef.current?.click();
  }

  // Attach trigger to a data attribute so ItemModal can reach it
  // — simpler than passing a ref up
  return (
    <div className={imgStyles.wrapper} data-image-manager>

      {/* Hidden file input — always present */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Image grid */}
      {images.length > 0 && (
        <div className={imgStyles.grid}>
          {images.map((url, idx) => (
            <div key={url} className={imgStyles.thumb}>
              <img
                src={url}
                alt={`Image ${idx + 1}`}
                className={imgStyles.img}
                onClick={() => setLightboxUrl(url)}
                title="Click to enlarge"
              />
              {idx === 0 && (
                <span className={imgStyles.primaryBadge}>Primary</span>
              )}
              <button
                className={imgStyles.deleteBtn}
                onClick={(e) => { e.stopPropagation(); handleDelete(url); }}
                disabled={deletingUrl === url}
                title="Remove image"
              >
                {deletingUrl === url ? "…" : "✕"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone — hidden in compact mode */}
      {!compact && (
        <div
          className={`${imgStyles.dropZone} ${uploading ? imgStyles.dropZoneUploading : ""}`}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={triggerPick}
        >
          {uploading ? (
            <span className={imgStyles.dropZoneText}>Uploading…</span>
          ) : (
            <>
              <span className={imgStyles.dropZoneIcon}>↑</span>
              <span className={imgStyles.dropZoneText}>
                Drop images here or click to browse
              </span>
              <span className={imgStyles.dropZoneHint}>
                JPEG, PNG, WebP · max 10 MB each
              </span>
            </>
          )}
        </div>
      )}

      {uploading && compact && (
        <div className={imgStyles.uploadingInline}>Uploading…</div>
      )}

      {uploadError && (
        <div style={{ color: "crimson", fontSize: "0.88rem", marginTop: "0.5rem" }}>
          {uploadError}
        </div>
      )}

      {images.length > 1 && (
        <p className={styles.muted} style={{ fontSize: "0.82rem", marginTop: "0.4rem" }}>
          First image is used as the thumbnail in card and table views.
        </p>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className={imgStyles.lightboxOverlay}
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className={imgStyles.lightboxClose}
            onClick={() => setLightboxUrl(null)}
            title="Close"
          >
            ✕
          </button>
          <img
            src={lightboxUrl}
            className={imgStyles.lightboxImg}
            alt="Full size"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// Standalone upload trigger — renders nothing visible,
// just exposes a file picker. Used by the action bar button.
export function ImageUploadTrigger({
  itemId,
  images,
  onImagesChanged,
  session,
  triggerRef,
}: Props & { triggerRef: React.RefObject<HTMLInputElement> }) {
  async function getAccessToken(): Promise<string> {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    try {
      const token    = await getAccessToken();
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/"))
          throw new Error(`${file.name} is not an image.`);
        if (file.size > 10 * 1024 * 1024)
          throw new Error(`${file.name} is over 10 MB.`);
        const url = await uploadInventoryImage(file, token);
        uploaded.push(url);
      }
      const next = [...images, ...uploaded];
      const { error } = await supabase
        .from("inventory_items")
        .update({ images: next })
        .eq("id", itemId);
      if (error) throw new Error(error.message);
      onImagesChanged(next);
    } catch (e: any) {
      alert(e?.message || "Upload failed");
    } finally {
      if (triggerRef.current) triggerRef.current.value = "";
    }
  }

  return (
    <input
      ref={triggerRef}
      type="file"
      accept="image/*"
      multiple
      style={{ display: "none" }}
      onChange={(e) => handleFiles(e.target.files)}
    />
  );
}
