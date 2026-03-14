import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory rate limiter for API routes
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMITS: Record<string, number> = {
  '/api/workspace': 20,    // AI chat: 20 req/min
  '/api/generate': 5,      // Document generation: 5 req/min
  '/api/data-room': 60,    // Data room CRUD: 60 req/min
  '/api/model': 60,        // Model CRUD: 60 req/min
  '/api/documents': 60,    // Documents: 60 req/min
};

function getRateLimit(pathname: string): number {
  for (const [prefix, limit] of Object.entries(RATE_LIMITS)) {
    if (pathname.startsWith(prefix)) return limit;
  }
  return 120; // default: 120 req/min
}

function getClientKey(req: NextRequest): string {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
  return ip;
}

export function middleware(req: NextRequest) {
  // Only rate limit API routes
  if (!req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Skip GET requests for rate limiting (only limit mutations)
  if (req.method === 'GET') {
    return NextResponse.next();
  }

  const clientKey = getClientKey(req);
  const pathname = req.nextUrl.pathname;
  const key = `${clientKey}:${pathname}`;
  const limit = getRateLimit(pathname);
  const now = Date.now();

  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return NextResponse.next();
  }

  if (entry.count >= limit) {
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
  }

  entry.count++;
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
