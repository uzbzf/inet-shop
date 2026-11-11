import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getDb, initDb } from '@/lib/neon-db';
import { getS3Client } from '@/lib/neon-storage';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';

export async function GET(req: Request) {
  await headers();
  const results: {
    postgres: { success: boolean; message: string; details?: any };
    objectStorage: { success: boolean; message: string; details?: any };
  } = {
    postgres: { success: false, message: 'Not tested' },
    objectStorage: { success: false, message: 'Not tested' },
  };

  // 1. Test Neon Postgres
  try {
    const sql = getDb();
    if (!sql) {
      results.postgres = {
        success: false,
        message: 'DATABASE_URL is not configured',
      };
    } else {
      await initDb();
      const rows = await sql`
        SELECT
          NOW() as server_time,
          (SELECT COUNT(*) FROM orders)::int as orders_count,
          (SELECT COUNT(*) FROM products)::int as products_count,
          (SELECT COUNT(*) FROM games)::int as games_count;
      `;
      results.postgres = {
        success: true,
        message: 'Neon Postgres is connected and responsive',
        details: rows[0],
      };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    results.postgres = { success: false, message: msg };
  }

  // 2. Test Neon Object Storage
  try {
    const storage = getS3Client();
    if (!storage) {
      results.objectStorage = {
        success: false,
        message: 'Neon Object Storage credentials not configured',
      };
    } else {
      const { s3, creds } = storage;
      const listRes = await s3.send(
        new ListObjectsV2Command({
          Bucket: 'receipts',
          MaxKeys: 10,
        })
      );
      results.objectStorage = {
        success: true,
        message: 'Neon Object Storage is connected and responsive',
        details: {
          bucket: 'receipts',
          endpoint: creds.endpoint,
          keyCount: listRes.KeyCount || 0,
        },
      };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    results.objectStorage = { success: false, message: msg };
  }

  const allSuccess = results.postgres.success && results.objectStorage.success;
  return NextResponse.json({ success: allSuccess, services: results });
}
