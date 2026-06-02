/**
 * 04 — Auto-refresh JWT in long-running processes
 *
 * If your service runs for hours/days, the JWT eventually expires.
 * `onAuthRefresh` is called once when the SDK gets a 401 with the
 * default bearer token; return a fresh token (e.g. by re-logging in or
 * calling your refresh endpoint) and the request automatically retries.
 *
 *   ENV: LKW_API, LKW_EMAIL, LKW_PASSWORD
 *
 * Run: tsx examples/04-auto-refresh-token.ts
 */
import { LkwClient } from '@lkw-ai/sdk';

async function main() {
  // First login to get an initial token
  const auth = new LkwClient({ apiBaseUrl: process.env.LKW_API! });
  const loginRes = await auth.auth.login({
    email: process.env.LKW_EMAIL!,
    password: process.env.LKW_PASSWORD!,
  });

  // Create the long-running client with both the initial token AND a
  // refresh hook. When the token expires, the hook is called once,
  // returns a fresh token, and the in-flight request silently retries.
  const lkw = new LkwClient({
    apiBaseUrl: process.env.LKW_API!,
    bearerToken: loginRes.accessToken,
    onAuthRefresh: async () => {
      console.log('🔄 Token expired — refreshing...');
      const fresh = await auth.auth.login({
        email: process.env.LKW_EMAIL!,
        password: process.env.LKW_PASSWORD!,
      });
      return fresh.accessToken;
    },
  });

  // This service polls every 10 minutes forever. Token will expire eventually.
  while (true) {
    const projects = await lkw.projects.list();
    console.log(`[${new Date().toISOString()}] ${projects.length} project(s)`);
    await new Promise((r) => setTimeout(r, 10 * 60_000));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
