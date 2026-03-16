type CacheEntry = { data: Response; ts: number; };
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<Response>>();
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes — aligned with dashboard refresh interval
const MAX_CACHE_SIZE = 500;
const MAX_INFLIGHT = 100;

function evictCache() {
  if (cache.size <= MAX_CACHE_SIZE) return;
  const now = Date.now();
  // First pass: remove expired entries
  for (const [key, entry] of cache) {
    if (now - entry.ts > DEFAULT_TTL) cache.delete(key);
  }
  // Second pass: if still over limit, remove oldest entries
  if (cache.size > MAX_CACHE_SIZE) {
    const sorted = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts);
    const toRemove = sorted.slice(0, cache.size - MAX_CACHE_SIZE);
    for (const [key] of toRemove) cache.delete(key);
  }
}

export async function cachedFetch(
  url: string,
  opts?: RequestInit & { skipCache?: boolean; ttl?: number },
): Promise<Response> {
  const ttl = opts?.ttl ?? DEFAULT_TTL;
  const skip = opts?.skipCache ?? false;
  const method = opts?.method?.toUpperCase() ?? 'GET';

  // Only cache GET requests
  if (method !== 'GET' || skip) return fetch(url, opts);

  const cached = cache.get(url);
  if (cached && Date.now() - cached.ts < ttl) {
    return cached.data.clone();
  }

  // Deduplicate in-flight requests (with bounded size)
  if (inflight.size > MAX_INFLIGHT) inflight.clear();
  const existing = inflight.get(url);
  if (existing) return (await existing).clone();

  const promise = fetch(url, opts).then(res => {
    inflight.delete(url);
    if (res.ok) {
      cache.set(url, { data: res.clone(), ts: Date.now() });
      evictCache();
    }
    return res;
  }).catch(err => {
    inflight.delete(url);
    throw err;
  });

  inflight.set(url, promise);
  return (await promise).clone();
}

export function invalidateCache(urlPrefix?: string) {
  if (!urlPrefix) { cache.clear(); return; }
  for (const key of cache.keys()) if (key.startsWith(urlPrefix)) cache.delete(key);
}
