/**
 * 02 — Login with email/password and list projects + workflows
 *
 * Use this pattern for management/CLI-style usage where you act as a user.
 * For server-to-server / webhook style, prefer API keys (example 01).
 *
 *   ENV: LKW_API, LKW_EMAIL, LKW_PASSWORD
 *
 * Run: tsx examples/02-login-and-list.ts
 */
import { LkwClient } from '@lkw-ai/sdk';

async function main() {
  const lkw = new LkwClient({
    apiBaseUrl: process.env.LKW_API ?? 'https://api.lkw.digital',
  });

  const loginRes = await lkw.auth.login({
    email: process.env.LKW_EMAIL!,
    password: process.env.LKW_PASSWORD!,
  });
  console.log(`Logged in as ${loginRes.user.email} (${loginRes.user.role})`);

  const orgs = await lkw.organizations.list();
  console.log(`\nOrganizations you belong to: ${orgs.length}`);
  for (const o of orgs) {
    console.log(`  ${o.id}  ${o.name}`);
  }

  const projects = await lkw.projects.list();
  console.log(`\nProjects: ${projects.length}`);
  for (const p of projects) {
    const workflows = await lkw.workflows.list(p.id);
    console.log(`  ${p.id}  ${p.name} (${workflows.length} workflow(s))`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
