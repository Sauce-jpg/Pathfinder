// lib/r2Client.ts
export async function uploadImageToR2(
  file: File,
  folder: 'character-portraits' | 'character-tokens' | 'location-maps' | 'item-images' | 'campaign-images'
): Promise<string> {
  const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  
  if (!publicUrl) {
    throw new Error('R2 public URL not configured. Add NEXT_PUBLIC_R2_PUBLIC_URL to .env.local');
  }

  // Generate unique filename
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 10);
  const extension = file.name.split('.').pop();
  const key = `pathfinder/${folder}/${timestamp}-${randomString}.${extension}`;

  try {
    // Upload directly to R2
    const response = await fetch(`${publicUrl}/${key}`, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    // Return the public URL (using custom domain if available)
    const imageUrl = `https://images.danielhallberg.com/${key}`;
    return imageUrl;
  } catch (error) {
    console.error('R2 upload error:', error);
    throw error;
  }
}

export async function deleteImageFromR2(imageUrl: string): Promise<void> {
  const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  
  if (!publicUrl) {
    throw new Error('R2 public URL not configured');
  }

  try {
    // Extract key from URL
    const urlObj = new URL(imageUrl);
    const key = urlObj.pathname.substring(1); // Remove leading slash

    const response = await fetch(`${publicUrl}/${key}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Delete failed: ${response.statusText}`);
    }
  } catch (error) {
    console.error('R2 delete error:', error);
    throw error;
  }
}
