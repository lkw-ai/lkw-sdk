/**
 * 05 — Poll an execution to wait for completion
 *
 * When a workflow takes longer than your HTTP timeout (or you queued
 * via `executeAsync`), use `waitUntilDone` to block until terminal
 * status without holding an open connection.
 *
 *   ENV: LKW_API, LKW_API_KEY, WORKFLOW_ID
 *
 * Run: tsx examples/05-poll-execution.ts
 */
import { LkwClient } from '@lkw-ai/sdk';

async function main() {
  const lkw = new LkwClient({
    apiBaseUrl: process.env.LKW_API!,
    apiKey: process.env.LKW_API_KEY!,
  });

  // Fire-and-forget trigger
  const fired = await lkw.workflows.trigger(process.env.WORKFLOW_ID!, process.env.LKW_API_KEY!, {});
  console.log('Triggered:', fired.executionId);

  // Wait up to 10 minutes, polling every 2s; log progress on each poll.
  const final = await lkw.executions.waitUntilDone(fired.executionId, {
    intervalMs: 2_000,
    timeoutMs: 10 * 60_000,
    onPoll: (e) => console.log(`  status=${e.status}`),
  });

  console.log(`\nFinal: ${final.status}`);
  if (final.error) console.error('Error:', final.error);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
