/**
 * Main client. Aggregates resource APIs and shares a single HttpClient.
 *
 * Usage:
 *   import { LkwClient } from '@lkw-ai/sdk';
 *
 *   const lkw = new LkwClient({ apiBaseUrl: 'https://api.lkw.digital' });
 *   await lkw.auth.login({ email: 'me@co.com', password: '...' });
 *   const workflows = await lkw.workflows.list(projectId);
 *   const result = await lkw.workflows.trigger(workflowId, apiKey, { foo: 'bar' });
 */
import { HttpClient } from './http.js';
import type { LkwOptions } from './types.js';
import { AuthResource } from './resources/auth.js';
import { WorkflowsResource } from './resources/workflows.js';
import { ExecutionsResource } from './resources/executions.js';
import { OrganizationsResource } from './resources/organizations.js';
import { ProjectsResource } from './resources/projects.js';
import { UsersResource } from './resources/users.js';
import { ApiKeysResource } from './resources/api-keys.js';

export class LkwClient {
  private readonly http: HttpClient;

  readonly auth: AuthResource;
  readonly workflows: WorkflowsResource;
  readonly executions: ExecutionsResource;
  readonly organizations: OrganizationsResource;
  readonly projects: ProjectsResource;
  readonly users: UsersResource;
  readonly apiKeys: ApiKeysResource;

  constructor(opts: LkwOptions) {
    this.http = new HttpClient(opts);
    this.auth = new AuthResource(this.http);
    this.workflows = new WorkflowsResource(this.http);
    this.executions = new ExecutionsResource(this.http);
    this.organizations = new OrganizationsResource(this.http);
    this.projects = new ProjectsResource(this.http);
    this.users = new UsersResource(this.http);
    this.apiKeys = new ApiKeysResource(this.http);
  }

  /**
   * Replace the bearer token at runtime. Useful after a manual login flow
   * outside the SDK, or when refreshing.
   */
  setBearerToken(token: string): void {
    this.http.setBearerToken(token);
  }
}
