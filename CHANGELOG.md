# Changelog

All notable changes to `@lkw-ai/sdk` are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.3.0] — 2026-06-02

### Added
- **`LkwError` is now a real class** (not just an interface) with
  `instanceof` support, a `category` field (`network` | `timeout` |
  `auth` | `rate_limit` | `server` | `client` | `parse` | `unknown`),
  a `retryable` boolean, and a `.toString()` formatter for logs.
- **Automatic JWT refresh** via the new `onAuthRefresh` option. When
  the SDK gets a 401 with the default bearer token, it calls your
  hook once, swaps in the new token, and retries silently.
- **`onRequest` telemetry hook** — one callback per HTTP attempt with
  method/url/status/duration/attempt/retried. Plug into Datadog,
  Sentry, your own logger.
- **`retryBaseMs` option** to tune the initial backoff (default 500ms,
  doubles each retry, capped at 8s + jitter).
- **48 unit tests** covering HttpClient (21) + 12 resources (17) +
  builders (9 from 0.2.0). All run offline with mocked fetch.
- **`examples/` folder** with 10 runnable scripts covering trigger,
  auth, error handling, auto-refresh, polling, log streaming, builder,
  import/export, telemetry, custom retry.

### Changed
- `LkwError` constructor now takes a structured options object instead
  of the loose `{ status, body }` interface. The interface export is
  preserved as a type alias for backward compatibility.
- User-Agent string now includes the SDK version (`@lkw-ai/sdk/0.3.0`)
  so support can identify the client version in logs.

### Migration from 0.2.0
Most callers won't need any code changes — `LkwError.status` and
`LkwError.body` remain. If you were branching on string-matched error
messages, switch to `err.category` for stable matching.

```ts
// before
if (err.message.includes('Unauthorized')) login();

// after
if (err instanceof LkwError && err.category === 'auth') login();
```

## [0.2.0] — 2026-06-01

### Added
- Fluent workflow builder: `workflow()` + `n.*` typed node helpers
  (covers all 25+ node types incl. 9 logistics nodes) + `e.*` edge
  helpers + `.branch()` for if/else flows.
- `InterfacesResource` and `ProcessMapsResource` with full CRUD and
  `export()`/`import()` for portable JSON.
- `executions.waitUntilDone(id)` — block until terminal status.
- `executions.tailLogs(id)` — async generator yielding new logs live.
- 9 unit tests for builders.

## [0.1.0] — 2026-05-29

Initial release.

- Resources: Auth, Workflows, Executions, Organizations, Projects,
  Users, ApiKeys.
- HTTP client with bearer + API-key auth, retry on 5xx/429/network,
  configurable timeout.
- Type generation via `openapi-typescript` from the LKW Swagger spec.
