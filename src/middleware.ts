import { NextRequest, NextResponse } from 'next/server';

// --- AUTH ---
// Set RAISE_APP_PASSWORD env var to enable auth protection
// Cookie stores HMAC(password, secret) — never the raw password
const AUTH_COOKIE = 'raise_auth';

async function makeExpectedToken(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(password + ':raise-session'));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function checkAuth(req: NextRequest): Promise<boolean> {
  const password = process.env.RAISE_APP_PASSWORD;
  if (!password) return true;

  if (req.nextUrl.pathname === '/api/auth') return true;
  if (req.nextUrl.pathname === '/login') return true;
  if (req.nextUrl.pathname === '/api/health') return true;

  const cookie = req.cookies.get(AUTH_COOKIE);
  if (!cookie) return false;

  try {
    const expected = await makeExpectedToken(password);
    return constantTimeEqual(cookie.value, expected);
  } catch {
    return false;
  }
}

// --- RATE LIMITING ---
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
let lastCleanup = Date.now();

function cleanupRateLimitMap() {
  const now = Date.now();
  if (now - lastCleanup < 120_000) return;
  lastCleanup = now;
  if (rateLimitMap.size > 10_000) {
    rateLimitMap.clear();
    return;
  }
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}

const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMITS: Record<string, number> = {
  '/api/workspace': 20,
  '/api/generate': 5,
  '/api/data-room': 60,
  '/api/model': 60,
  '/api/documents': 60,
};

function getRateLimit(pathname: string): number {
  for (const [prefix, limit] of Object.entries(RATE_LIMITS)) {
    if (pathname.startsWith(prefix)) return limit;
  }
  return 120;
}

function getClientKey(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

// --- SEED PROTECTION ---
function blockSeedInProd(req: NextRequest): boolean {
  if (req.nextUrl.pathname === '/api/seed' && process.env.NODE_ENV === 'production') {
    return true;
  }
  return false;
}

export async function middleware(req: NextRequest) {
  const startTime = Date.now();
  const isApiRoute = req.nextUrl.pathname.startsWith('/api/');

  // Handle CORS preflight
  if (req.method === 'OPTIONS' && isApiRoute) {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': req.headers.get('origin') || '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // Block /api/seed in production
  if (blockSeedInProd(req)) {
    return NextResponse.json(
      { error: 'Seed endpoint disabled in production' },
      { status: 403 }
    );
  }

  // Auth check
  if (!(await checkAuth(req))) {
    if (isApiRoute) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Rate limiting (only for POST/PUT/DELETE on API routes)
  if (isApiRoute && req.method !== 'GET') {
    cleanupRateLimitMap();
    const clientKey = getClientKey(req);
    const pathname = req.nextUrl.pathname;
    const key = `${clientKey}:${pathname}`;
    const limit = getRateLimit(pathname);
    const now = Date.now();

    const entry = rateLimitMap.get(key);
    if (!entry || now > entry.resetAt) {
      rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    } else if (entry.count >= limit) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait before trying again.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)),
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    } else {
      entry.count++;
    }
  }

  const response = NextResponse.next();

  // Add response timing header for API routes
  if (isApiRoute) {
    response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`);
  }

  // Add security + CORS headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if (!isApiRoute) {
    response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'");
  }
  if (isApiRoute) {
    const origin = req.headers.get('origin');
    if (origin) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
