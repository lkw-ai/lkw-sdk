/**
 * Thin HTTP client with retry, timeout, and JWT/API-key auth.
 *
 * Resources (workflows, executions, etc) wrap this to provide a typed
 * surface for each endpoint. Network/policy concerns live here once;
 * resources stay focused on shape and ergonomics.
 */
import type { LkwError, LkwOptions } from './types.js';

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

export class HttpClient {
  private readonly baseUrl: string;
  // Mutable: setBearerToken() flips this after construction (e.g. after auth.login).
  private defaultAuth: HttpRequest['auth'];
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly userAgent: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: LkwOptions) {
    if (!opts.apiBaseUrl) throw new Error('LkwClient: apiBaseUrl is required');
    this.baseUrl = opts.apiBaseUrl.replace(/\/$/, '');
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    this.retries = opts.retries ?? 2;
    this.userAgent = opts.userAgent ?? `@lkw-ai/sdk`;
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
    this.defaultAuth = opts.bearerToken
      ? { type: 'bearer', token: opts.bearerToken }
      : opts.apiKey
        ? { type: 'apiKey', key: opts.apiKey }
        : { type: 'none' };
  }

  /** Replace the bearer token at runtime (e.g. after a refresh). */
  setBearerToken(token: string): void {
    this.defaultAuth = { type: 'bearer', token };
  }

  async request<T = unknown>(req: HttpRequest): Promise<HttpResponse<T>> {
    const url = this.buildUrl(req.path, req.query);
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': this.userAgent,
      ...req.headers,
    };
    if (req.body !== undefined) headers['Content-Type'] = 'application/json';

    const auth = req.auth ?? this.defaultAuth;
    if (auth?.type === 'bearer') headers.Authorization = `Bearer ${auth.token}`;
    else if (auth?.type === 'apiKey') headers['X-API-Key'] = auth.key;

    const body = req.body === undefined ? undefined : JSON.stringify(req.body);

    let lastErr: unknown = null;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await this.fetchImpl(url, { method: req.method, headers, body, signal: controller.signal });
        const text = await res.text();
        let data: unknown = null;
        if (text) {
          try {
            data = JSON.parse(text);
          } catch {
            data = text;
          }
        }
        if (!res.ok) {
          const err = this.toError(res.status, data);
          // Retry on 5xx and 429; don't retry on 4xx (other than 429)
          if (attempt < this.retries && (res.status >= 500 || res.status === 429)) {
            await this.sleep(this.backoffMs(attempt));
            continue;
          }
          throw err;
        }
        return { status: res.status, data: data as T, headers: res.headers };
      } catch (err) {
        lastErr = err;
        // AbortError or network errors → retry
        if (attempt < this.retries && this.isRetryable(err)) {
          await this.sleep(this.backoffMs(attempt));
          continue;
        }
        throw err;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastErr ?? new Error('Unknown error');
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

  private toError(status: number, data: unknown): LkwError {
    const e = new Error(this.extractMessage(status, data)) as LkwError;
    e.name = 'LkwError';
    e.status = status;
    e.body = data;
    return e;
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

  private isRetryable(err: unknown): boolean {
    if (!err) return false;
    const e = err as { name?: string };
    return e.name === 'AbortError' || e.name === 'TypeError'; // TypeError = network in fetch
  }

  private backoffMs(attempt: number): number {
    return Math.min(1000 * 2 ** attempt, 8000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
