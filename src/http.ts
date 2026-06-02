/**
 * Thin HTTP client with retry, timeout, JWT/API-key auth, optional auth
 * refresh, and telemetry hook.
 *
 * Resources wrap this for typed surface. Network/policy concerns
 * (retries, backoff, error categorization) live here once.
 */
import { LkwError, type LkwErrorCategory, type LkwOptions, type RequestTelemetry } from './types.js';

export interface HttpRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  /** Override auth for this specific call (e.g. API key for workflow trigger). */
  auth?: { type: 'bearer'; token: string } | { type: 'apiKey'; key: string } | { type: 'none' };
}

export interface HttpResponse<T = unknown> {
  status: number;
  data: T;
  headers: Headers;
}

const SDK_VERSION = '0.3.0';

export class HttpClient {
  private readonly baseUrl: string;
  private defaultAuth: HttpRequest['auth'];
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly retryBaseMs: number;
  private readonly userAgent: string;
  private readonly fetchImpl: typeof fetch;
  private readonly onAuthRefresh?: () => Promise<string | null>;
  private readonly onRequest?: (info: RequestTelemetry) => void;
  /** Prevents concurrent refresh storms — coalesces all 401s into one refresh. */
  private inflightRefresh: Promise<string | null> | null = null;

  constructor(opts: LkwOptions) {
    if (!opts.apiBaseUrl) throw new Error('LkwClient: apiBaseUrl is required');
    this.baseUrl = opts.apiBaseUrl.replace(/\/$/, '');
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    this.retries = opts.retries ?? 2;
    this.retryBaseMs = opts.retryBaseMs ?? 500;
    this.userAgent = opts.userAgent ?? `@lkw-ai/sdk/${SDK_VERSION}`;
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
    this.onAuthRefresh = opts.onAuthRefresh;
    this.onRequest = opts.onRequest;
    this.defaultAuth = opts.bearerToken
      ? { type: 'bearer', token: opts.bearerToken }
      : opts.apiKey
        ? { type: 'apiKey', key: opts.apiKey }
        : { type: 'none' };
  }

  /** Replace the bearer token at runtime (e.g. after a manual refresh). */
  setBearerToken(token: string): void {
    this.defaultAuth = { type: 'bearer', token };
  }

  /** Get current default auth — useful for tests/inspection. */
  getDefaultAuth(): HttpRequest['auth'] {
    return this.defaultAuth;
  }

  async request<T = unknown>(req: HttpRequest): Promise<HttpResponse<T>> {
    const url = this.buildUrl(req.path, req.query);
    const method = req.method;
    let didRefresh = false;

    for (let attempt = 1; attempt <= this.retries + 1; attempt++) {
      const startedAt = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await this.fetchImpl(url, {
          method,
          headers: this.buildHeaders(req),
          body: req.body === undefined ? undefined : JSON.stringify(req.body),
          signal: controller.signal,
        });
        const data = await this.parseBody(res);

        if (!res.ok) {
          const err = this.makeError(res.status, data, url, method);

          // 401 with default bearer + auth refresh configured → try refresh once
          if (
            err.category === 'auth' &&
            !didRefresh &&
            !req.auth && // only refresh when using default auth
            this.defaultAuth?.type === 'bearer' &&
            this.onAuthRefresh
          ) {
            didRefresh = true;
            const newToken = await this.refreshTokenOnce();
            if (newToken) {
              this.telemetry({ method, url, status: res.status, durationMs: Date.now() - startedAt, attempt, retried: true, error: err });
              continue; // retry with refreshed token
            }
          }

          if (err.retryable && attempt <= this.retries) {
            this.telemetry({ method, url, status: res.status, durationMs: Date.now() - startedAt, attempt, retried: true, error: err });
            await this.sleep(this.backoffMs(attempt));
            continue;
          }
          this.telemetry({ method, url, status: res.status, durationMs: Date.now() - startedAt, attempt, retried: false, error: err });
          throw err;
        }

        this.telemetry({ method, url, status: res.status, durationMs: Date.now() - startedAt, attempt, retried: attempt > 1 });
        return { status: res.status, data: data as T, headers: res.headers };
      } catch (err) {
        if (err instanceof LkwError) throw err;
        // network / timeout
        const isAbort = (err as { name?: string })?.name === 'AbortError';
        const category: LkwErrorCategory = isAbort ? 'timeout' : 'network';
        const wrapped = new LkwError({
          message: isAbort ? `Request timed out after ${this.timeoutMs}ms` : (err as Error)?.message ?? 'Network error',
          status: 0, body: null, category, url, method, cause: err,
        });
        if (attempt <= this.retries) {
          this.telemetry({ method, url, status: 0, durationMs: Date.now() - startedAt, attempt, retried: true, error: wrapped });
          await this.sleep(this.backoffMs(attempt));
          continue;
        }
        this.telemetry({ method, url, status: 0, durationMs: Date.now() - startedAt, attempt, retried: false, error: wrapped });
        throw wrapped;
      } finally {
        clearTimeout(timer);
      }
    }
    // Unreachable but TS doesn't know
    throw new LkwError({ message: 'exhausted retries', status: 0, body: null, category: 'unknown', url, method });
  }

  // ────────────────────────────────────────────────────────────────────
  // Internals
  // ────────────────────────────────────────────────────────────────────

  private async refreshTokenOnce(): Promise<string | null> {
    if (!this.onAuthRefresh) return null;
    if (this.inflightRefresh) return this.inflightRefresh;
    this.inflightRefresh = (async () => {
      try {
        const token = await this.onAuthRefresh!();
        if (token) this.setBearerToken(token);
        return token;
      } catch {
        return null;
      } finally {
        this.inflightRefresh = null;
      }
    })();
    return this.inflightRefresh;
  }

  private buildHeaders(req: HttpRequest): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': this.userAgent,
      ...req.headers,
    };
    if (req.body !== undefined) headers['Content-Type'] = 'application/json';
    const auth = req.auth ?? this.defaultAuth;
    if (auth?.type === 'bearer') headers.Authorization = `Bearer ${auth.token}`;
    else if (auth?.type === 'apiKey') headers['X-API-Key'] = auth.key;
    return headers;
  }

  private async parseBody(res: Response): Promise<unknown> {
    const ct = res.headers.get('content-type') || '';
    const text = await res.text();
    if (!text) return null;
    if (ct.includes('json')) {
      try { return JSON.parse(text); } catch { return text; }
    }
    return text;
  }

  private makeError(status: number, body: unknown, url: string, method: string): LkwError {
    const message = this.extractMessage(status, body);
    let category: LkwErrorCategory;
    if (status === 401 || status === 403) category = 'auth';
    else if (status === 429) category = 'rate_limit';
    else if (status >= 500) category = 'server';
    else if (status >= 400) category = 'client';
    else category = 'unknown';
    return new LkwError({ message, status, body, category, url, method });
  }

  private extractMessage(status: number, data: unknown): string {
    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      if (typeof obj.message === 'string') return obj.message;
      if (Array.isArray(obj.message) && obj.message.every((m) => typeof m === 'string')) return obj.message.join('; ');
      if (typeof obj.error === 'string') return obj.error;
    }
    return `LKW request failed with status ${status}`;
  }

  private telemetry(info: RequestTelemetry): void {
    if (!this.onRequest) return;
    try { this.onRequest(info); } catch { /* swallow telemetry errors */ }
  }

  private buildUrl(path: string, query?: HttpRequest['query']): string {
    const p = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${this.baseUrl}${p}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null) continue;
        url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }

  private backoffMs(attempt: number): number {
    return Math.min(this.retryBaseMs * 2 ** (attempt - 1) + Math.random() * 200, 8000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
