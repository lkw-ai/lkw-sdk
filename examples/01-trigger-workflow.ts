/**
 * 01 — Trigger a workflow by API key (most common use case)
 *
 * When you have a workflow with a public HTTP trigger + API key, you can
 * fire it from anywhere (cron, webhook, integration code) without an
 * authenticated user session.
 *
 *   ENV: LKW_API   = https://api.lkw.digital
 *        LKW_API_KEY = lkw_xxx (create in the workflow's "API Keys" tab)
 *        WORKFLOW_ID = uuid of the workflow you want to trigger
 *
 * Run: tsx examples/01-trigger-workflow.ts
 */
import { LkwClient } from '@lkw-ai/sdk';

async function main() {
  const lkw = new LkwClient({
    apiBaseUrl: process.env.LKW_API ?? 'https://api.lkw.digital',
  });

  const result = await lkw.workflows.trigger(
    process.env.WORKFLOW_ID!,
    process.env.LKW_API_KEY!,
    { orderId: 'PED-12345', customer: 'ACME Logistics' },
  );

  console.log('success:', result.success);
  console.log('executionId:', result.executionId);
  console.log('output:', JSON.stringify(result.output, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
