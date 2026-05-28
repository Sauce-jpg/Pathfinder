import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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

const BUCKET      = process.env.R2_INVENTORY_BUCKET!;
const PUBLIC_URL  = process.env.NEXT_PUBLIC_R2_INVENTORY_URL!;
const MAX_SIZE    = 25 * 1024 * 1024; // 25 MB

function slugFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function parseEml(buffer: Buffer): Promise<{
  subject: string;
  from: string;
  to: string;
  date: string;
  htmlContent: string;
}> {
  const { simpleParser } = await import("mailparser");
  const parsed = await simpleParser(buffer);

  const subject = parsed.subject ?? "(no subject)";
  const from    = parsed.from?.text ?? "";
  const to      = (parsed.to as any)?.text ?? "";
  const date    = parsed.date?.toISOString() ?? "";

  const htmlContent = parsed.html
    ? parsed.html
    : `<pre style="font-family:sans-serif;padding:1rem">${
        (parsed.text ?? "").replace(/</g, "&lt;")
      }</pre>`;

  return { subject, from, to, date, htmlContent };
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

    const formData = await req.formData();
    const file     = formData.get("file") as File | null;
    const itemId   = formData.get("itemId") as string | null;

    if (!file || !itemId)
      return NextResponse.json({ error: "file and itemId are required" }, { status: 400 });

    if (file.size > MAX_SIZE)
      return NextResponse.json({ error: "File exceeds 25 MB limit" }, { status: 400 });

    const buffer    = Buffer.from(await file.arrayBuffer());
    const timestamp = Date.now();
    const random    = Math.random().toString(36).substring(2, 8);
    const safeName  = slugFilename(file.name);
    const isEml     = file.name.toLowerCase().endsWith(".eml");

    // Upload original file
    const key      = `item-documents/${itemId}-${timestamp}-${random}-${safeName}`;
    const mimeType = isEml ? "message/rfc822" : (file.type || "application/octet-stream");

    await r2.send(new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         key,
      Body:        buffer,
      ContentType: mimeType,
    }));

    const fileUrl  = `${PUBLIC_URL}/${key}`;
    let metadata: Record<string, string> = {};

    // Parse EML and upload HTML preview
    if (isEml) {
      const eml        = await parseEml(buffer);
      const htmlKey    = `item-documents/${itemId}-${timestamp}-${random}-preview.html`;
      const htmlBuffer = Buffer.from(eml.htmlContent, "utf-8");

      await r2.send(new PutObjectCommand({
        Bucket:      BUCKET,
        Key:         htmlKey,
        Body:        htmlBuffer,
        ContentType: "text/html; charset=utf-8",
      }));

      metadata = {
        subject:    eml.subject,
        from:       eml.from,
        to:         eml.to,
        date:       eml.date,
        previewUrl: `${PUBLIC_URL}/${htmlKey}`,
      };
    }

    // Save to DB
    const { data: doc, error: dbErr } = await supabase
      .from("item_documents")
      .insert({
        item_id:   itemId,
        user_id:   user.id,
        file_url:  fileUrl,
        filename:  file.name,
        file_size: file.size,
        mime_type: mimeType,
        metadata,
      })
      .select()
      .single();

    if (dbErr) throw new Error(dbErr.message);

    return NextResponse.json({ doc });
  } catch (err: any) {
    console.error("upload-item-document error:", err);
    return NextResponse.json({ error: err?.message || "Upload failed" }, { status: 500 });
  }
}
