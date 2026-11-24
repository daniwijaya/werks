export type RequestOptions = {
  fetchImpl?: typeof fetch;
  retries?: number;
  timeoutMs?: number;
  headers?: HeadersInit;
  delay?: (milliseconds: number) => Promise<void>;
  random?: () => number;
  redirectValidator?: (url: string) => boolean;
  maxRedirects?: number;
};

function retryAfterMs(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1_000, 30_000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, Math.min(date - Date.now(), 30_000));
}

export async function requestWithRetry(url: string, options: RequestOptions = {}): Promise<Response> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const delay = options.delay ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const random = options.random ?? Math.random;
  const retries = options.retries ?? 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let response: Response | undefined;
    try {
      let target = url;
      let redirects = 0;
      while (true) {
        response = await fetchImpl(target, {
          headers: { accept: "application/json, application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.5", "user-agent": "WERKS-Job-Aggregator/0.2 (+https://werks.id)", ...options.headers },
          signal: AbortSignal.timeout(options.timeoutMs ?? 12_000),
          cache: "no-store",
          ...(options.redirectValidator ? { redirect: "manual" as const } : {}),
        });
        if (!options.redirectValidator || response.status < 300 || response.status >= 400) break;
        const location = response.headers.get("location");
        if (!location || redirects >= (options.maxRedirects ?? 3)) throw new Error(`Too many or invalid redirects for ${url}`);
        const next = new URL(location, target).toString();
        if (!options.redirectValidator(next)) throw new Error("Redirect target is outside registered allowed domains.");
        target = next;
        redirects += 1;
      }
      if (response.ok || response.status === 304) return response;
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === retries) throw new Error(`HTTP ${response.status} for ${url}`);
      lastError = new Error(`HTTP ${response.status} for ${url}`);
    } catch (error) {
      lastError = error;
      if (response && response.status !== 429 && response.status < 500) throw error;
      if (attempt === retries) throw error;
    }

    const backoff = Math.min(10_000, 500 * 2 ** attempt);
    const jitter = Math.floor(random() * Math.min(backoff * 0.25, 1_000));
    const wait = retryAfterMs(response?.headers.get("retry-after") ?? null) ?? backoff + jitter;
    await delay(wait);
  }
  throw lastError instanceof Error ? lastError : new Error(`Request failed for ${url}`);
}

export function responseValidators(response: Response): { etag: string | null; lastModified: string | null } {
  return { etag: response.headers.get("etag"), lastModified: response.headers.get("last-modified") };
}

export function validatorHeaders(etag: string | null, lastModified: string | null): Record<string, string> {
  return {
    ...(etag ? { "if-none-match": etag } : {}),
    ...(lastModified ? { "if-modified-since": lastModified } : {}),
  };
}
