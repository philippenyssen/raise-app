import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

export async function GET() {
  const dbUrl = process.env.TURSO_DATABASE_URL;
  const hasToken = !!process.env.TURSO_AUTH_TOKEN;
  const tokenLen = process.env.TURSO_AUTH_TOKEN?.length ?? 0;

  const result: Record<string, unknown> = {
    dbUrl: dbUrl || 'NOT SET',
    dbUrlProtocol: dbUrl ? dbUrl.split('://')[0] : 'N/A',
    hasToken,
    tokenLen,
    nodeEnv: process.env.NODE_ENV,
  };

  if (dbUrl) {
    try {
      const client = createClient({
        url: dbUrl,
        authToken: process.env.TURSO_AUTH_TOKEN,
      });
      const test = await client.execute('SELECT 1 as ok');
      result.connection = 'OK';
      result.testResult = test.rows[0];
    } catch (err) {
      result.connection = 'FAILED';
      result.error = err instanceof Error ? err.message : String(err);
    }
  }

  return NextResponse.json(result);
}
