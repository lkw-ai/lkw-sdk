/**
 * 09 — Plug the SDK into your observability stack
 *
 * `onRequest` fires once per HTTP call (success or failure) with
 * method/url/status/duration/attempt/retried. Use it to feed your
 * Datadog, Sentry, console, or in-house logger without monkeypatching.
 *
 *   ENV: LKW_API, LKW_API_KEY
 *
 * Run: tsx examples/09-telemetry.ts
 */
import { LkwClient } from '@lkw-ai/sdk';

async function main() {
  const lkw = new LkwClient({
    apiBaseUrl: process.env.LKW_API!,
    apiKey: process.env.LKW_API_KEY!,
    onRequest: (info) => {
      // Replace with: datadog.statsd.timing('lkw.request', info.durationMs, [...])
      const tag = info.error ? `❌ ${info.error.category}` : '✓';
      const retry = info.retried ? ` (retry attempt ${info.attempt})` : '';
      console.log(`${tag} ${info.method} ${info.url} → ${info.status} in ${info.durationMs}ms${retry}`);
    },
  });

  // Triggers two HTTP calls (login + list)
  await lkw.workflows.listTemplates();
}

main().catch((err) => { console.error(err); process.exit(1); });
