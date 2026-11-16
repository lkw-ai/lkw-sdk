# @lkw-ai/sdk

Official TypeScript SDK for the [LKW](https://lkw.digital) low-code workflow
platform. Type-safe wrapper over the REST API with retry, auth refresh,
telemetry, fluent workflow builders, and live log streaming.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
![Node.js >=18](https://img.shields.io/badge/Node.js-%E2%89%A518-brightgreen)

## Install

```bash
npm install @lkw-ai/sdk
```

Works on Node 18+ (uses the global `fetch`). For browser/edge runtimes,
inject your own fetch via the `fetch` option.

## Quick start (5 minutes)

### Trigger a workflow via API key (most common)

```ts
import { LkwClient } from '@lkw-ai/sdk';

const lkw = new LkwClient({ apiBaseUrl: 'https://api.lkw.digital' });

const result = await lkw.workflows.trigger(
  'WORKFLOW_ID',
  process.env.LKW_API_KEY!,
  { orderId: 'PED-123', customer: 'ACME' },
);
console.log(result.success, result.output);
```

### Authenticated session (management ops)

```ts
const lkw = new LkwClient({ apiBaseUrl: 'https://api.lkw.digital' });

await lkw.auth.login({ email: 'me@co.com', password: '...' });
const wfs = await lkw.workflows.list(projectId);
```

### Build a workflow programmatically

```ts
import { workflow, n } from '@lkw-ai/sdk';

const wf = workflow('CEP lookup + freight')
  .add(n.httpTrigger('In'))
  .add(n.cepLookup('CEP', { cep: '{{$input.body.cep}}' }))
  .add(n.freightCalc('Freight', { distanceKm: 500, peso_kg: 1000 }))
  .add(n.respond())
  .chain()
  .build();

await lkw.workflows.create(projectId, wf);
```

## Constructor options

```ts
new LkwClient({
  apiBaseUrl: 'https://api.lkw.digital', // required

  // Auth (one of):
  bearerToken: 'eyJ...',                 // JWT from /auth/login
  apiKey: 'lkw_demo_...',                // API key for workflow trigger

  timeoutMs: 30_000,                     // per-request timeout (default 30s)
  retries: 2,                            // retry on 5xx/429/network (default 2)
  retryBaseMs: 500,                      // initial backoff (default 500ms; doubles, capped 8s)
  userAgent: 'my-app/1.0',               // default '@lkw-ai/sdk/<version>'
  fetch: customFetch,                    // inject for non-Node runtimes

  // Auto-refresh JWT on 401 (long-running services):
  onAuthRefresh: async () => {
    const r = await myRefreshFlow();
    return r.accessToken; // or null to give up
  },

  // Telemetry: called once per HTTP attempt (success or failure)
  onRequest: ({ method, url, status, durationMs, attempt, retried, error }) => {
    statsd.timing('lkw.req', durationMs, { method, status });
  },
});
```

## Resource API

| Resource | Methods |
| :--- | :--- |
| `lkw.auth` | `login`, `logout`, `verify`, `listSessions`, `revokeSession`, `logoutAll` |
| `lkw.workflows` | `list`, `listTemplates`, `get`, `create`, `update`, `delete`, `execute`, `trigger` |
| `lkw.executions` | `list`, `get`, `logs`, **`waitUntilDone(id)`**, **`tailLogs(id)` (async gen)** |
| `lkw.organizations` | `list`, `get`, `create`, `update`, `delete`, `listMembers`, `addMember` |
| `lkw.projects` | `list`, `get`, `create`, `update`, `delete` |
| `lkw.users` | `list`, `get`, `create`, `update`, `delete` |
| `lkw.apiKeys` | `list`, `create`, `revoke` |
| `lkw.interfaces` | `list`, `listTemplates`, `get`, `create`, `update`, `delete`, **`export`**, **`import`** |
| `lkw.processMaps` | `list`, `get`, `create`, `update`, `delete`, **`export`**, **`import`** |

Full type signatures and JSDoc available via your editor's IntelliSense.

## Error handling

Every failure throws `LkwError` — branch on its `category` to decide what
to do:

```ts
import { LkwError } from '@lkw-ai/sdk';

try {
  await lkw.workflows.get(id);
} catch (err) {
  if (!(err instanceof LkwError)) throw err;

  switch (err.category) {
    case 'auth':        return relogin();                 // 401/403
    case 'rate_limit':  return queueRetry(err);           // 429
    case 'server':      console.error(err.toString());    // 5xx (retryable)
                        return null;
    case 'network':
    case 'timeout':     return enqueueLocally();
    case 'client':      throw err;                        // 4xx — your bug
  }
}
```

`err.retryable` is a convenience boolean for the common case.
The full `LkwError` shape:

```ts
class LkwError extends Error {
  readonly status: number;        // HTTP status, 0 on network failure
  readonly body: unknown;         // raw response body
  readonly category: LkwErrorCategory;
  readonly url: string;
  readonly method: string;
  readonly retryable: boolean;
  readonly cause?: unknown;       // original Error if wrapping
  toString(): string;             // formatted summary for logs
}
```

## Retry behavior

By default the SDK retries:
- **Network errors** (DNS, connection refused, TypeError from fetch)
- **Timeouts** (request exceeded `timeoutMs`)
- **5xx** server errors
- **429** rate limit

Each retry waits `retryBaseMs * 2^attempt + random(0..200ms)` jitter,
capped at 8s. To disable: `retries: 0`. To configure deeply, see
[examples/10-custom-retry.ts](./examples/10-custom-retry.ts).

## Auto-refresh JWT (long-running services)

For services that run for hours/days and outlive the JWT TTL:

```ts
const lkw = new LkwClient({
  apiBaseUrl: '...',
  bearerToken: initialToken,
  onAuthRefresh: async () => {
    const r = await auth.auth.login({ email, password });
    return r.accessToken;
  },
});

// 8 hours later, a request gets 401 → onAuthRefresh fires once → request retries
```

The SDK coalesces concurrent 401s into a single refresh call, so a
burst of requests doesn't trigger N refreshes.

## Streaming execution logs

`tailLogs()` is an async generator that polls behind the scenes and
yields each new log as it appears:

```ts
const r = await lkw.workflows.execute(workflowId, { inputData: {...} });
for await (const log of lkw.executions.tailLogs(r.executionId)) {
  console.log(`[${log.level}] ${log.message}`);
}
// Generator closes when execution reaches SUCCESS/FAILED/CANCELLED
```

`waitUntilDone(id, opts)` is the simpler "block until terminal" variant
with an `onPoll` callback.

## Builders (`workflow()` + `n.*` + `e.*`)

Construct workflows programmatically with full type safety:

```ts
import { workflow, n, e } from '@lkw-ai/sdk';

const cond = n.condition('?', { conditionField: 'status', conditionOperator: 'equals', conditionValue: 'OK' });

const wf = workflow('Validate then route')
  .description('Webhook → condition → success/failure branches')
  .add(n.httpTrigger('In'), n.code('Validate', 'return input.body;'))
  .branch(cond,
    [n.send_sms('Notify OK', { to: '{{$input.phone}}', message: 'OK!' }), n.respond('OK', { statusCode: 200 })],
    [n.respond('Bad', { statusCode: 400 })],
  )
  .build();

await lkw.workflows.create(projectId, wf);
```

Covers all 25+ node types incl. the 9 logistics ones
(`n.cepLookup`, `n.routeCalculator`, `n.freightCalc`, etc).

## Examples

The [`examples/`](./examples) folder has 10 runnable scripts:

| # | What |
| :---: | :--- |
| 01 | Trigger a workflow via API key |
| 02 | Login + list projects/workflows |
| 03 | Error handling by category |
| 04 | Long-running service with `onAuthRefresh` |
| 05 | `waitUntilDone()` polling |
| 06 | `tailLogs()` live streaming |
| 07 | Build a workflow programmatically |
| 08 | Export from env A, import into env B |
| 09 | Plug `onRequest` into observability |
| 10 | Custom retry/timeout profiles |

```bash
npm install tsx --save-dev
LKW_API=https://api.lkw.digital LKW_API_KEY=lkw_... WORKFLOW_ID=... \
  npx tsx examples/01-trigger-workflow.ts
```

## Auto-generated types

Regenerate request/response types from the live Swagger:

```bash
LKW_API_URL=https://api.lkw.digital npm run gen:types
```

Output lands in `src/types.gen.ts`. The hand-curated resource API
doesn't depend on these, but they're available for advanced use:

```ts
import type { paths, components } from '@lkw-ai/sdk/types.gen';
```

## Versioning & stability

We follow [Semantic Versioning](https://semver.org). The SDK is at
`0.x` while we collect feedback from the first wave of customers. We
won't break the surface gratuitously, but we may iterate on shapes for
edge cases. Pin to a minor (e.g. `^0.3.0`) for stability and read the
[CHANGELOG](./CHANGELOG.md) before bumping.

`1.0` ships when:
- 30 consecutive days of zero breaking changes on `main`
- 3+ external customers running 0.x in production
- Coverage of every backend endpoint reflected in the SDK

## Compatibility

| SDK | LKW backend (api.lkw.digital) |
| :---: | :--- |
| 0.3.x | ≥ 1.2.0 (billing + StateService + audit-fixed ARCOM workflows) |
| 0.2.x | ≥ 1.1.0 |
| 0.1.x | ≥ 1.0.0 |

## Support

- Issues: https://github.com/lkw-ai/lkw-sdk/issues
- Docs: https://lkw.digital/documentation
- Contact: contact@lkw.digital

## License

Apache 2.0 — see [LICENSE](./LICENSE).
