# @lkw-ai/sdk

TypeScript SDK for the [LKW](https://lkw.digital) low-code workflow platform.

Type-safe wrapper over the LKW REST API with retry, auth, and typed payloads.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## Install

```bash
npm install @lkw-ai/sdk
```

Works on Node 18+. Uses the global `fetch` API.

## Quick start

### Trigger a workflow via API key (most common)

```ts
import { LkwClient } from '@lkw-ai/sdk';

const lkw = new LkwClient({ apiBaseUrl: 'https://api.lkw.digital' });

const result = await lkw.workflows.trigger(
  '5e816a27-9c3d-4e4e-90f0-ce1fb585f4bb', // workflow ID
  process.env.LKW_API_KEY!,               // API key from the workflow's Trigger & API Keys tab
  { orderId: 12345, customer: 'ACME' },   // arbitrary payload
);

console.log(result.success, result.output);
```

### Authenticated session (for management ops)

```ts
import { LkwClient } from '@lkw-ai/sdk';

const lkw = new LkwClient({ apiBaseUrl: 'https://api.lkw.digital' });

await lkw.auth.login({ email: 'me@co.com', password: '...' });
// JWT is auto-applied to subsequent requests

const workflows = await lkw.workflows.list(projectId);
const workflow = await lkw.workflows.create(projectId, { name: 'My new workflow' });
```

### Pass an existing token

```ts
const lkw = new LkwClient({
  apiBaseUrl: 'https://api.lkw.digital',
  bearerToken: process.env.LKW_TOKEN!,
});
```

## Resource API

| Resource | Methods |
| :--- | :--- |
| `lkw.auth` | `login`, `logout`, `verify`, `listSessions`, `revokeSession`, `logoutAll` |
| `lkw.workflows` | `list`, `listTemplates`, `get`, `create`, `update`, `delete`, `execute`, `trigger` |
| `lkw.executions` | `list`, `get`, `logs` |
| `lkw.organizations` | `list`, `get`, `create`, `update`, `delete`, `listMembers`, `addMember` |
| `lkw.projects` | `list`, `get`, `create`, `update`, `delete` |
| `lkw.users` | `list`, `get`, `create`, `update`, `delete` |
| `lkw.apiKeys` | `list`, `create`, `revoke` |

Full type signatures and JSDoc available via your editor's IntelliSense.

## Options

```ts
new LkwClient({
  apiBaseUrl: 'https://api.lkw.digital', // required
  bearerToken: 'eyJ...',                 // OR
  apiKey: 'lkw_demo_...',                // (either, depending on use case)
  timeoutMs: 30_000,                     // default 30s
  retries: 2,                            // default 2 (retries on network errors and 5xx/429)
  userAgent: 'my-app/1.0',               // default '@lkw-ai/sdk'
  fetch: customFetch,                    // inject for tests or non-Node runtimes
});
```

## Error handling

All failures throw an `LkwError` (Error subclass) with:

```ts
import type { LkwError } from '@lkw-ai/sdk';

try {
  await lkw.workflows.get('does-not-exist');
} catch (err) {
  const e = err as LkwError;
  console.log(e.status); // 404
  console.log(e.body);   // server response body
  console.log(e.message); // extracted error message
}
```

Retries happen automatically on `5xx`, `429`, and network failures
(configurable via `retries`).

## Auto-generated types

The repo includes a script to regenerate request/response types from the
LKW Swagger spec:

```bash
LKW_API_URL=https://api.lkw.digital npm run gen:types
```

Output lands in `src/types.gen.ts`. The hand-curated resource API in
`src/resources/*` does not depend on these directly today, but they're
available for advanced use (`import type { paths, components } from
'@lkw-ai/sdk/types.gen'`).

## License

Apache 2.0.
