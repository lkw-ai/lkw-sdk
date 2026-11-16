/**
 * 07 — Build a workflow programmatically with `workflow()` + `n.*`
 *
 * Useful for: bulk creation, CI/CD pipelines, templating per customer,
 * or letting code-savvy users skip the visual editor entirely.
 *
 *   ENV: LKW_API, LKW_EMAIL, LKW_PASSWORD, PROJECT_ID
 *
 * Run: tsx examples/07-build-workflow.ts
 */
import { LkwClient, workflow, n } from '@lkw-ai/sdk';

async function main() {
  const lkw = new LkwClient({ apiBaseUrl: process.env.LKW_API! });
  await lkw.auth.login({ email: process.env.LKW_EMAIL!, password: process.env.LKW_PASSWORD! });

  // Workflow: webhook → cep_lookup → freight_calc → respond
  const wf = workflow('Freight quote by CEP')
    .description('Receives origin CEP + destination CEP + weight → returns estimated freight.')
    .add(n.httpTrigger('Receive request'))
    .add(n.cepLookup('Lookup origin CEP', { cep: '{{$input.body.cep_origem}}' }))
    .add(n.cepLookup('Lookup destination CEP', { cep: '{{$input.body.cep_destino}}' }))
    .add(n.freightCalc('Calculate freight', {
      distanceKm: 500, // placeholder; in prod compute via route_calculator
      peso_kg: 1000,
      uf_origem: '{{$node["2"].uf}}',
      uf_destino: '{{$node["3"].uf}}',
    }))
    .add(n.respond('Return freight', { statusCode: 200 }))
    .chain()
    .build();

  const created = await lkw.workflows.create(process.env.PROJECT_ID!, wf);
  console.log(`Created workflow ${created.id} (${created.name})`);
  console.log(`Nodes: ${(wf.nodes as unknown[]).length}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
