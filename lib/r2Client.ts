// lib/r2Client.ts

// ── Pathfinder (existing, public bucket) ──────────────────────────────

export async function uploadImageToR2(
  file: File,
  folder:
    | "character-portraits"
    | "character-tokens"
    | "location-maps"
    | "item-images"
    | "campaign-images"
): Promise<string> {
  const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

  if (!publicUrl) {
    throw new Error(
      "R2 public URL not configured. Add NEXT_PUBLIC_R2_PUBLIC_URL to .env.local"
    );
  }

  const timestamp    = Date.now();
  const randomString = Math.random().toString(36).substring(2, 10);
  const extension    = file.name.split(".").pop();
  const key          = `pathfinder/${folder}/${timestamp}-${randomString}.${extension}`;

  const response = await fetch(`${publicUrl}/${key}`, {
    method:  "PUT",
    body:    file,
    headers: { "Content-Type": file.type },
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  return `https://images.danielhallberg.com/${key}`;
}

export async function deleteImageFromR2(imageUrl: string): Promise<void> {
  const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

  if (!publicUrl) {
    throw new Error("R2 public URL not configured");
  }

  const urlObj = new URL(imageUrl);
  const key    = urlObj.pathname.substring(1);

  const response = await fetch(`${publicUrl}/${key}`, { method: "DELETE" });

  if (!response.ok) {
    throw new Error(`Delete failed: ${response.statusText}`);
  }
}

// ── Inventory (new, private bucket via presigned URLs) ────────────────

export async function uploadInventoryImage(
  file: File,
  accessToken: string
): Promise<string> {
  // Step 1: get presigned URL from our API route
  const presignRes = await fetch("/api/inventory/presign", {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      filename:    file.name,
      contentType: file.type,
    }),
  });

  if (!presignRes.ok) {
    const err = await presignRes.json().catch(() => ({}));
    throw new Error(err?.error || "Failed to get upload URL");
  }

  const { uploadUrl, publicUrl } = await presignRes.json();

  // Step 2: upload directly to R2
  const uploadRes = await fetch(uploadUrl, {
    method:  "PUT",
    body:    file,
    headers: { "Content-Type": file.type },
  });

  if (!uploadRes.ok) {
    throw new Error(`Upload to R2 failed: ${uploadRes.statusText}`);
  }

  return publicUrl;
}

export async function deleteInventoryImage(
  imageUrl: string,
  accessToken: string
): Promise<void> {
  const res = await fetch("/api/inventory/delete-image", {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ imageUrl }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || "Failed to delete image");
  }
}
