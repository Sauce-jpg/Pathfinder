import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@supabase/supabase-js";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function POST(req: NextRequest) {
  try {
    // Verify the user is authenticated
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: req.headers.get("Authorization") ?? "",
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { filename, contentType } = await req.json();

    if (!filename || !contentType) {
      return NextResponse.json(
        { error: "filename and contentType are required" },
        { status: 400 }
      );
    }

    // Validate content type
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(contentType)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, WebP and GIF images are allowed" },
        { status: 400 }
      );
    }

    // Build a unique key: inventory/{userId}/{timestamp}-{random}.{ext}
    const ext         = filename.split(".").pop()?.toLowerCase() || "jpg";
    const timestamp   = Date.now();
    const random      = Math.random().toString(36).substring(2, 10);
    const key         = `inventory/${user.id}/${timestamp}-${random}.${ext}`;

    const command = new PutObjectCommand({
      Bucket:      process.env.R2_INVENTORY_BUCKET!,
      Key:         key,
      ContentType: contentType,
    });

    // Presigned URL expires in 60 seconds
    const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 60 });

    // The final public URL served via your custom domain
    const publicUrl = `${process.env.NEXT_PUBLIC_R2_INVENTORY_URL}/${key}`;

    return NextResponse.json({ uploadUrl, publicUrl });
  } catch (err: any) {
    console.error("Presign error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
