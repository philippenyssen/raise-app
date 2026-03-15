type CacheEntry = { data: Response; ts: number; };
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<Response>>();
const DEFAULT_TTL = 2 * 60 * 1000; // 2 minutes

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

  // Deduplicate in-flight requests
  const existing = inflight.get(url);
  if (existing) return (await existing).clone();

  const promise = fetch(url, opts).then(res => {
    inflight.delete(url);
    if (res.ok) cache.set(url, { data: res.clone(), ts: Date.now() });
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
