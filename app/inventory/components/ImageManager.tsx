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
};

export function ImageManager({ itemId, images, onImagesChanged, session }: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);
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
      const token     = await getAccessToken();
      const uploaded: string[] = [];

      for (const file of Array.from(files)) {
        // Client-side validation
        if (!file.type.startsWith("image/")) {
          throw new Error(`${file.name} is not an image.`);
        }
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`${file.name} is over 10 MB.`);
        }

        const url = await uploadInventoryImage(file, token);
        uploaded.push(url);
      }

      const next = [...images, ...uploaded];

      // Save to Supabase
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

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  return (
    <div className={imgStyles.wrapper}>
      <div className={imgStyles.sectionHeader}>Images</div>

      {/* Image grid */}
      {images.length > 0 && (
        <div className={imgStyles.grid}>
          {images.map((url, idx) => (
            <div key={url} className={imgStyles.thumb}>
              <img src={url} alt={`Image ${idx + 1}`} className={imgStyles.img} />
              {idx === 0 && <span className={imgStyles.primaryBadge}>Primary</span>}
              <button
                className={imgStyles.deleteBtn}
                onClick={() => handleDelete(url)}
                disabled={deletingUrl === url}
                title="Remove image"
              >
                {deletingUrl === url ? "…" : "✕"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone */}
      <div
        className={`${imgStyles.dropZone} ${uploading ? imgStyles.dropZoneUploading : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => !uploading && inputRef.current?.click()}
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

      {uploadError && (
        <div style={{ color: "crimson", fontSize: "0.88rem", marginTop: "0.5rem" }}>
          {uploadError}
        </div>
      )}

      {images.length > 1 && (
        <p className={styles.muted} style={{ fontSize: "0.82rem", marginTop: "0.5rem" }}>
          First image is used as the thumbnail in card and table views.
        </p>
      )}
    </div>
  );
}
