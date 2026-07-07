import { NextResponse } from 'next/server';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// IMPORTANT: check these env var names against your existing Inventory
// Manager upload route and rename them here to match what's already
// configured in Vercel. The logic is identical.
const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
});

export async function POST(req: Request) {
  try {
    const { filename, contentType } = await req.json();
    if (!filename || !contentType) {
      return NextResponse.json(
        { error: 'filename and contentType are required' },
        { status: 400 }
      );
    }

    const safeName = String(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `rpg-archive/${crypto.randomUUID()}-${safeName}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 600 });
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

    return NextResponse.json({ uploadUrl, key, publicUrl });
  } catch (err) {
    console.error('rpg-archive upload route error:', err);
    return NextResponse.json(
      { error: 'Failed to create upload URL' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { key } = await req.json();
    if (!key || !String(key).startsWith('rpg-archive/')) {
      return NextResponse.json({ error: 'Invalid key' }, { status: 400 });
    }

    await s3.send(
      new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
      })
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('rpg-archive delete route error:', err);
    return NextResponse.json(
      { error: 'Failed to delete object' },
      { status: 500 }
    );
  }
}
