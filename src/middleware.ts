import { NextRequest, NextResponse } from 'next/server';

// --- AUTH ---
// Set RAISE_APP_PASSWORD env var to enable auth protection
// When set, users must log in before accessing any page or API
const AUTH_COOKIE = 'raise_auth';

function checkAuth(req: NextRequest): boolean {
  const password = process.env.RAISE_APP_PASSWORD;
  // If no password is set, auth is disabled (development mode)
  if (!password) return true;

  // Allow the login API endpoint without auth
  if (req.nextUrl.pathname === '/api/auth') return true;
  // Allow the login page itself
  if (req.nextUrl.pathname === '/login') return true;
  // Allow health check
  if (req.nextUrl.pathname === '/api/health') return true;

  // Check for auth cookie
  const cookie = req.cookies.get(AUTH_COOKIE);
  if (!cookie) return false;

  // Verify cookie value matches a hash of the password
  // Simple but effective: cookie = base64(password)
  try {
    const decoded = Buffer.from(cookie.value, 'base64').toString();
    return decoded === password;
  } catch {
    return false;
  }
}

// --- RATE LIMITING ---
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

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

export function middleware(req: NextRequest) {
  // Block /api/seed in production
  if (blockSeedInProd(req)) {
    return NextResponse.json(
      { error: 'Seed endpoint disabled in production' },
      { status: 403 }
    );
  }

  // Auth check
  if (!checkAuth(req)) {
    // For API routes, return 401
    if (req.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // For page routes, redirect to login
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Rate limiting (only for POST/PUT/DELETE on API routes)
  if (req.nextUrl.pathname.startsWith('/api/') && req.method !== 'GET') {
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

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
