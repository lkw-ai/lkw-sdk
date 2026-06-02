/**
 * 10 — Custom retry/timeout for fragile networks
 *
 * Defaults: timeoutMs=30000, retries=2, retryBaseMs=500 (exp backoff up
 * to 8s). Tweak when you know your environment:
 *
 *   - On-prem self-hosted, slow VPN  → bigger timeout, more retries
 *   - Same-region cloud, healthy    → tighter timeout, fewer retries
 *   - Critical bulk job              → never retry, fail fast
 *
 *   ENV: LKW_API, LKW_API_KEY
 *
 * Run: tsx examples/10-custom-retry.ts
 */
import { LkwClient } from '@lkw-ai/sdk';

async function main() {
  // Profile A: slow on-prem cluster behind enterprise VPN
  const onPrem = new LkwClient({
    apiBaseUrl: process.env.LKW_API!,
    apiKey: process.env.LKW_API_KEY!,
    timeoutMs: 90_000,     // 1.5 min for slow links
    retries: 5,            // tolerate more transient failures
    retryBaseMs: 1000,     // start at 1s
  });

  // Profile B: fail-fast for bulk migration that must run end-to-end
  const failFast = new LkwClient({
    apiBaseUrl: process.env.LKW_API!,
    apiKey: process.env.LKW_API_KEY!,
    timeoutMs: 5_000,
    retries: 0,
  });

  console.log('Templates from slow profile:', await onPrem.workflows.listTemplates());
  console.log('Templates from fail-fast profile:', await failFast.workflows.listTemplates());
}

main().catch((err) => { console.error(err); process.exit(1); });
