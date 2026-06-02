/**
 * 03 — Error handling: branch on LkwError.category
 *
 * Every SDK call throws `LkwError` on failure. The `category` field tells
 * you what KIND of failure it was so you can react appropriately
 * (re-login on auth, backoff on rate_limit, queue on network, etc).
 *
 *   ENV: LKW_API, LKW_API_KEY
 *
 * Run: tsx examples/03-error-handling.ts
 */
import { LkwClient, LkwError } from '@lkw-ai/sdk';

async function safeCall<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof LkwError) {
      switch (err.category) {
        case 'auth':
          console.error('🔒 Auth failed — token expired or invalid:', err.message);
          // → kick off re-login flow, or use onAuthRefresh hook (example 04)
          return null;

        case 'rate_limit':
          console.error('⏳ Rate limited — back off and retry later');
          // → queue the work, retry in N minutes
          return null;

        case 'server':
          console.error(`💥 LKW server error (${err.status}): ${err.message}`);
          if (err.retryable) {
            console.error('   (retryable — will succeed on its own next try)');
          }
          return null;

        case 'network':
        case 'timeout':
          console.error(`🌐 Connectivity issue: ${err.message}`);
          // → queue locally and flush when connectivity returns
          return null;

        case 'client':
          console.error(`❌ Bad request (${err.status}): ${err.message}`);
          console.error('   body:', err.body);
          // → fix the call, don't retry
          throw err;

        default:
          console.error('Unknown LKW error:', err.toString());
          throw err;
      }
    }
    throw err; // not a LkwError — rethrow
  }
}

async function main() {
  const lkw = new LkwClient({
    apiBaseUrl: process.env.LKW_API ?? 'https://api.lkw.digital',
    apiKey: process.env.LKW_API_KEY ?? 'invalid-on-purpose',
  });

  // Intentionally call with bad data to trigger different errors:
  await safeCall(() => lkw.workflows.get('does-not-exist'));
  await safeCall(() => lkw.workflows.trigger('also-not-real', 'bad-key', {}));
}

main();
