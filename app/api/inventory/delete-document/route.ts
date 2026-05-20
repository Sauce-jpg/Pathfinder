import { NextRequest, NextResponse } from "next/server";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

const r2 = new S3Client({
  region:   "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { documentUrl } = await req.json();
    if (!documentUrl)
      return NextResponse.json({ error: "documentUrl is required" }, { status: 400 });

    const urlObj = new URL(documentUrl);
    const key    = urlObj.pathname.substring(1);

    if (!key.startsWith(`inventory/orders/${user.id}/`))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await r2.send(new DeleteObjectCommand({
      Bucket: process.env.R2_INVENTORY_BUCKET!,
      Key:    key,
    }));

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Delete document error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
