/**
 * 08 — Move a workflow / interface / process-map between environments
 *
 * Use case: build in staging, validate, export to JSON, import into prod.
 * The JSON is portable across deployments (cloud ↔ self-hosted).
 *
 *   ENV: SOURCE_API, SOURCE_TOKEN, TARGET_API, TARGET_TOKEN,
 *        SOURCE_WORKFLOW_ID, TARGET_PROJECT_ID
 *
 * Run: tsx examples/08-import-export.ts
 */
import fs from 'node:fs/promises';
import { LkwClient } from '@lkw-ai/sdk';

async function main() {
  const source = new LkwClient({ apiBaseUrl: process.env.SOURCE_API!, bearerToken: process.env.SOURCE_TOKEN! });
  const target = new LkwClient({ apiBaseUrl: process.env.TARGET_API!, bearerToken: process.env.TARGET_TOKEN! });

  // 1. Export from source. /workflows/:id/export returns the portable JSON.
  const wf = await source.workflows.get(process.env.SOURCE_WORKFLOW_ID!);
  const exportPayload = {
    _lkwExport: true,
    version: '1.0',
    workflow: { name: wf.name, description: wf.description, nodes: wf.nodes, edges: wf.edges },
  };
  await fs.writeFile(`./${wf.name.replace(/\s+/g, '-')}.lkw.json`, JSON.stringify(exportPayload, null, 2));
  console.log(`✓ Exported "${wf.name}"`);

  // 2. Import into target — use the dedicated endpoint via HttpClient
  //    (workflows.create takes the bare shape; for full _lkwExport payload
  //    POST directly to /workflows/import/:projectId).
  const r = await fetch(`${process.env.TARGET_API}/workflows/import/${process.env.TARGET_PROJECT_ID}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.TARGET_TOKEN}`,
    },
    body: JSON.stringify(exportPayload),
  });
  const created = await r.json();
  console.log(`✓ Imported as workflow ${created.id}`);

  // Interfaces and Process Maps work the same way via the SDK directly:
  // const exp = await source.interfaces.export('iface-id');
  // const imp = await target.interfaces.import(targetProjectId, exp);
}

main().catch((err) => { console.error(err); process.exit(1); });
