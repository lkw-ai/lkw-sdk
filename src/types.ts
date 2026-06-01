/**
 * Public-facing types used by the SDK surface. For full request/response
 * shapes from the OpenAPI spec, see src/types.gen.ts (auto-generated via
 * `npm run gen:types`).
 *
 * These are kept hand-curated because they're the API the user codes
 * against, not the wire format.
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
  /** Retry attempts on network errors / 5xx / 429. Default 2. */
  retries?: number;
  /** User-Agent header. Default "@lkw-ai/sdk". */
  userAgent?: string;
  /** Inject a custom fetch implementation (for tests / non-Node runtimes). */
  fetch?: typeof fetch;
}

export interface LkwError extends Error {
  /** HTTP status code (0 on network failure). */
  status: number;
  /** Raw response body — useful for custom error handling. */
  body: unknown;
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
