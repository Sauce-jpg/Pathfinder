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

const BUCKET     = process.env.R2_INVENTORY_BUCKET!;
const PUBLIC_URL = process.env.NEXT_PUBLIC_R2_INVENTORY_URL!;

function urlToKey(url: string): string {
  return url.replace(PUBLIC_URL + "/", "");
}

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

    const { docId } = await req.json();
    if (!docId)
      return NextResponse.json({ error: "docId is required" }, { status: 400 });

    // Fetch doc to get URLs
    const { data: doc, error: fetchErr } = await supabase
      .from("item_documents")
      .select("*")
      .eq("id", docId)
      .eq("user_id", user.id)
      .single();

    if (fetchErr || !doc)
      return NextResponse.json({ error: "Document not found" }, { status: 404 });

    // Delete from R2
    await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: urlToKey(doc.file_url) }));

    // Delete EML preview if present
    if (doc.metadata?.previewUrl) {
      await r2.send(new DeleteObjectCommand({
        Bucket: BUCKET,
        Key:    urlToKey(doc.metadata.previewUrl),
      })).catch(() => {});
    }

    // Delete from DB
    await supabase.from("item_documents").delete().eq("id", docId);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("delete-item-document error:", err);
    return NextResponse.json({ error: err?.message || "Delete failed" }, { status: 500 });
  }
}
