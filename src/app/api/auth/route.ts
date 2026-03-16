import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

function makeSessionToken(password: string): string {
  // HMAC-based session token — never stores the raw password in the cookie
  const secret = process.env.RAISE_APP_PASSWORD || 'dev';
  return crypto.createHmac('sha256', secret).update(password + ':raise-session').digest('hex');
}

export function verifySessionToken(token: string): boolean {
  const password = process.env.RAISE_APP_PASSWORD;
  if (!password) return true; // No password = dev mode
  return token === makeSessionToken(password);
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }
  const { password } = body;
  const expected = process.env.RAISE_APP_PASSWORD;

  if (!expected) {
    return NextResponse.json({ error: 'Auth not configured' }, { status: 500 });
  }

  if (password !== expected) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  // Set HMAC session token cookie — no raw password stored
  const token = makeSessionToken(password);
  const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  response.cookies.set('raise_auth', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days (reduced from 30)
    path: '/',
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete('raise_auth');
  return response;
}
