"use client";

import { useState } from "react";
import { DbPhoto } from "../types";
import { PhotoModal } from "./PhotoModal";
import { DbItem } from "../types";

type Props = {
  itemId: string;
  photos: DbPhoto[];
  allItems: DbItem[];
  onPhotoSaved: () => Promise<void>;
  onPhotoDeleted: () => void;
  session: any;
};

export function PhotoStrip({
  itemId,
  photos,
  allItems,
  onPhotoSaved,
  onPhotoDeleted,
  session,
}: Props) {
  const [selectedPhoto, setSelectedPhoto] = useState<DbPhoto | null>(null);

  // Only photos that include this item
  const linked = photos.filter((p) =>
    (p.item_ids || []).includes(itemId) ||
    (p.pins || []).some((pin) => pin.item_id === itemId)
  );

  if (!linked.length) return null;

  return (
    <>
      <div style={{ marginTop: "1rem" }}>
        <h3 style={{ marginBottom: "0.5rem" }}>📷 Photos</h3>
        <div
          style={{
            display: "flex",
            gap: "0.6rem",
            overflowX: "auto",
            paddingBottom: "0.4rem",
          }}
        >
          {linked.map((photo) => (
            <div
              key={photo.id}
              onClick={() => setSelectedPhoto(photo)}
              style={{
                flexShrink: 0,
                width: 90,
                height: 90,
                borderRadius: 10,
                overflow: "hidden",
                cursor: "pointer",
                border: "1px solid rgba(0,0,0,0.1)",
                transition: "opacity 0.15s",
              }}
              title={photo.description || photo.date_taken || ""}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setSelectedPhoto(photo);
              }}
            >
              <img
                src={photo.url}
                alt={photo.description || ""}
                style={{
                  width: "100%", height: "100%",
                  objectFit: "cover", display: "block",
                }}
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </div>

      <PhotoModal
        photo={selectedPhoto}
        allItems={allItems}
        onClose={() => setSelectedPhoto(null)}
        onSaved={async () => {
          await onPhotoSaved();
          setSelectedPhoto(null);
        }}
        onDeleted={() => {
          setSelectedPhoto(null);
          onPhotoDeleted();
        }}
        session={session}
      />
    </>
  );
}
