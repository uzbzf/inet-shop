import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

export interface StorageCredentials {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export function getStorageCredentials(): StorageCredentials | null {
  let endpoint = process.env.AWS_ENDPOINT_URL_S3 || '';
  let region = process.env.AWS_REGION || 'us-east-2';
  let accessKeyId = process.env.AWS_ACCESS_KEY_ID || '';
  let secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || '';

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    try {
      const envPath = path.join(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const epMatch = content.match(/AWS_ENDPOINT_URL_S3=["']?([^"'\r\n]+)["']?/);
        if (epMatch && epMatch[1]) endpoint = epMatch[1].trim();

        const keyMatch = content.match(/AWS_ACCESS_KEY_ID=["']?([^"'\r\n]+)["']?/);
        if (keyMatch && keyMatch[1]) accessKeyId = keyMatch[1].trim();

        const secMatch = content.match(/AWS_SECRET_ACCESS_KEY=["']?([^"'\r\n]+)["']?/);
        if (secMatch && secMatch[1]) secretAccessKey = secMatch[1].trim();

        const regMatch = content.match(/AWS_REGION=["']?([^"'\r\n]+)["']?/);
        if (regMatch && regMatch[1]) region = regMatch[1].trim();
      }
    } catch {
      // Ignore read errors
    }
  }

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return { endpoint, region, accessKeyId, secretAccessKey };
}

let cachedS3Client: { client: S3Client; creds: StorageCredentials } | null = null;

export function getS3Client(): { s3: S3Client; creds: StorageCredentials } | null {
  const creds = getStorageCredentials();
  if (!creds) return null;

  if (
    cachedS3Client &&
    cachedS3Client.creds.accessKeyId === creds.accessKeyId &&
    cachedS3Client.creds.endpoint === creds.endpoint
  ) {
    return { s3: cachedS3Client.client, creds };
  }

  const s3 = new S3Client({
    endpoint: creds.endpoint,
    region: creds.region,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
    },
    forcePathStyle: true,
  });

  cachedS3Client = { client: s3, creds };
  return { s3, creds };
}

/**
 * Uploads a receipt image to Neon Object Storage bucket "receipts"
 * Returns the public URL of the uploaded image
 */
export async function uploadReceiptToNeonStorage(
  fileBuffer: Buffer | Uint8Array,
  filename: string,
  contentType = 'image/jpeg',
  bucket = 'receipts'
): Promise<{ success: boolean; url?: string; key?: string; error?: string }> {
  try {
    const s3Data = getS3Client();
    if (!s3Data) {
      return { success: false, error: 'Neon Object Storage credentials not configured' };
    }

    const { s3, creds } = s3Data;
    const cleanName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `receipts/${Date.now()}-${cleanName}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
      })
    );

    // Because receipts bucket is configured with access: "public_read",
    // the public URL is endpoint/bucket/key
    const publicUrl = `${creds.endpoint}/${bucket}/${key}`;

    return {
      success: true,
      url: publicUrl,
      key,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown storage upload error';
    console.error('Neon storage upload error:', err);
    return { success: false, error: errorMsg };
  }
}
