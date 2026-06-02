# @lkw-ai/sdk — Examples

Each file is a runnable script — copy, fill in your credentials, run with
`tsx`, `ts-node`, or after `tsc`. All examples use the SDK as you would
in production code (no mocks).

## Setup

```bash
npm install @lkw-ai/sdk tsx --save-dev

export LKW_API=https://api.lkw.digital
export LKW_EMAIL=you@company.com
export LKW_PASSWORD=...
# OR (after creating a workflow API key in the LKW UI):
export LKW_API_KEY=lkw_...
```

## Index

| # | File | What it shows |
| :---: | :--- | :--- |
| 01 | [`01-trigger-workflow.ts`](./01-trigger-workflow.ts) | Fire a workflow by API key, log the result |
| 02 | [`02-login-and-list.ts`](./02-login-and-list.ts) | Auth with email/password, list projects + workflows |
| 03 | [`03-error-handling.ts`](./03-error-handling.ts) | Branch on `LkwError.category` (auth / rate_limit / server / network) |
| 04 | [`04-auto-refresh-token.ts`](./04-auto-refresh-token.ts) | Long-running process with `onAuthRefresh` hook |
| 05 | [`05-poll-execution.ts`](./05-poll-execution.ts) | `waitUntilDone()` for synchronous wait on async jobs |
| 06 | [`06-stream-logs.ts`](./06-stream-logs.ts) | `tailLogs()` async generator — live tail of an execution |
| 07 | [`07-build-workflow.ts`](./07-build-workflow.ts) | Construct a workflow programmatically with `workflow()` + `n.*` |
| 08 | [`08-import-export.ts`](./08-import-export.ts) | Export workflow JSON from env A, import into env B |
| 09 | [`09-telemetry.ts`](./09-telemetry.ts) | Plug `onRequest` into your observability stack |
| 10 | [`10-custom-retry.ts`](./10-custom-retry.ts) | Tune `retries`, `retryBaseMs`, `timeoutMs` for fragile networks |
