/**
 * Public-facing types used by the SDK surface. For full request/response
 * shapes from the OpenAPI spec, see src/types.gen.ts (auto-generated via
 * `npm run gen:types`).
 */

export interface LkwOptions {
  /** Base URL of the LKW API (e.g. https://api.lkw.digital). Required. */
  apiBaseUrl: string;

  /**
   * Default auth. Use one of:
   *   - bearerToken: JWT from POST /auth/login (best for user-scoped ops)
   *   - apiKey: API key from the Workflow UI (best for trigger endpoints)
   */
  bearerToken?: string;
  apiKey?: string;

  /** Per-request timeout (ms). Default 30 000. */
  timeoutMs?: number;
  /** Retry attempts on network / timeout / 5xx / 429. Default 2. */
  retries?: number;
  /** Initial retry backoff (ms). Default 500. Each retry doubles, capped at 8s. */
  retryBaseMs?: number;
  /** User-Agent header. Default `@lkw-ai/sdk/<version>`. */
  userAgent?: string;
  /** Inject a custom fetch implementation (for tests / non-Node runtimes). */
  fetch?: typeof fetch;
  /**
   * Optional async hook called whenever a request returns 401 with the
   * default bearer auth. Should return a fresh token (which becomes the
   * new default) or null to give up. Lets long-running processes refresh
   * a JWT before it expires without manually intercepting 401s.
   */
  onAuthRefresh?: () => Promise<string | null>;
  /**
   * Optional telemetry hook called once per request (success or failure).
   * Use to plug your own observability (datadog, sentry, etc).
   */
  onRequest?: (info: RequestTelemetry) => void;
}

export interface RequestTelemetry {
  method: string;
  url: string;
  status: number;
  durationMs: number;
  attempt: number; // 1 = first try, 2+ = retry
  retried: boolean;
  error?: LkwError;
}

/**
 * Normalized error thrown by all SDK methods on failure. Always an instance
 * of LkwError (you can `instanceof` it). Includes a machine-readable
 * `category` so callers can branch on the type of failure without parsing
 * the message string.
 *
 *   try { await lkw.workflows.get(id); }
 *   catch (e) {
 *     if (e instanceof LkwError && e.category === 'auth') login();
 *     else if (e instanceof LkwError && e.retryable) backoffAndRetry();
 *     else throw e;
 *   }
 */
export type LkwErrorCategory =
  | 'network'      // DNS failure, connection refused, etc
  | 'timeout'      // request exceeded timeoutMs
  | 'auth'         // 401 / 403
  | 'rate_limit'   // 429
  | 'server'       // 5xx
  | 'client'       // 4xx (except 401/403/429)
  | 'parse'        // response was supposed to be JSON but wasn't
  | 'unknown';

export class LkwError extends Error {
  readonly name = 'LkwError';
  readonly status: number;
  readonly body: unknown;
  readonly category: LkwErrorCategory;
  readonly url: string;
  readonly method: string;
  /** True when callers can safely retry the operation. */
  readonly retryable: boolean;
  /** The underlying cause if this error wraps another (network, parse, etc). */
  readonly cause?: unknown;

  constructor(opts: {
    message: string;
    status: number;
    body: unknown;
    category: LkwErrorCategory;
    url: string;
    method: string;
    cause?: unknown;
  }) {
    super(opts.message);
    this.status = opts.status;
    this.body = opts.body;
    this.category = opts.category;
    this.url = opts.url;
    this.method = opts.method;
    this.cause = opts.cause;
    this.retryable =
      opts.category === 'network' ||
      opts.category === 'timeout' ||
      opts.category === 'rate_limit' ||
      (opts.category === 'server' && opts.status >= 500);
  }

  /**
   * Best-effort summary suitable for logs. Includes status, URL, message,
   * and the first 200 chars of the body.
   */
  toString(): string {
    const bodyStr =
      this.body == null
        ? ''
        : typeof this.body === 'string'
          ? this.body
          : JSON.stringify(this.body);
    return `LkwError(${this.category} ${this.status} ${this.method} ${this.url}): ${this.message}${
      bodyStr ? ` — body: ${bodyStr.slice(0, 200)}` : ''
    }`;
  }
}

/**
 * Pagination envelope used by list endpoints. The shape mirrors what the
 * core API returns; if a specific list endpoint doesn't paginate yet, the
 * resource method returns the array directly.
 */
export interface Paginated<T> {
  items: T[];
  total?: number;
  page?: number;
  pageSize?: number;
}
