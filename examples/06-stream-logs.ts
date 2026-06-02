/**
 * 06 — Stream execution logs live (tail -f style)
 *
 * `tailLogs()` is an async generator that yields each new log entry as
 * it appears and closes when the execution reaches a terminal status.
 *
 *   ENV: LKW_API, LKW_API_KEY, WORKFLOW_ID
 *
 * Run: tsx examples/06-stream-logs.ts
 */
import { LkwClient } from '@lkw-ai/sdk';

const COLORS: Record<string, string> = {
  error: '\x1b[31m', warn: '\x1b[33m', info: '\x1b[36m', debug: '\x1b[90m',
};
const RESET = '\x1b[0m';

async function main() {
  const lkw = new LkwClient({ apiBaseUrl: process.env.LKW_API!, apiKey: process.env.LKW_API_KEY! });

  const r = await lkw.workflows.trigger(process.env.WORKFLOW_ID!, process.env.LKW_API_KEY!, {});
  console.log(`Streaming logs for execution ${r.executionId}...\n`);

  for await (const log of lkw.executions.tailLogs(r.executionId, { intervalMs: 1000 })) {
    const c = COLORS[log.level] ?? '';
    const ts = log.createdAt?.slice(11, 19) ?? '';
    const node = log.nodeId ? `[node:${log.nodeId}] ` : '';
    console.log(`${c}${ts} ${log.level.toUpperCase().padEnd(5)} ${node}${log.message}${RESET}`);
  }

  console.log('\n— execution finished —');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
