type Entry = { value: unknown; at: number };
const MAX_ENTRIES = 200;
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

type Options<T> = {
  ttlMs: number;
  // How long an expired value may still be served when a refresh fails.
  staleMs: number;
  // Return false to skip caching (for example partial results that should be retried promptly).
  cacheable?: (value: T) => boolean;
};

// In-memory cache with in-flight de-duplication and stale-while-error, shared by the feed API routes.
export async function cached<T>(key: string, options: Options<T>, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  const started = Date.now();
  if (hit && started - hit.at < options.ttlMs) return hit.value as T;
  let pending = inflight.get(key) as Promise<T> | undefined;
  if (!pending) {
    pending = load()
      .then((value) => {
        if (!options.cacheable || options.cacheable(value)) {
          cache.delete(key);
          cache.set(key, { value, at: Date.now() });
          if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
        }
        return value;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  try {
    return await pending;
  } catch (error) {
    if (hit && started - hit.at < options.staleMs) {
      console.error(`Serving stale data for ${key}`, error);
      return hit.value as T;
    }
    throw error;
  }
}
