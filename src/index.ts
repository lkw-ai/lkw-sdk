/**
 * @lkw-ai/sdk — TypeScript SDK for the LKW low-code workflow platform.
 *
 * Public exports:
 *   LkwClient (main entrypoint)
 *   Resource classes & types
 */
export { LkwClient } from './client.js';
export type { LkwOptions, LkwError, Paginated } from './types.js';

export { AuthResource } from './resources/auth.js';
export type { LoginInput, LoginResponse } from './resources/auth.js';

export { WorkflowsResource } from './resources/workflows.js';
export type {
  Workflow,
  CreateWorkflowInput,
  UpdateWorkflowInput,
  WorkflowExecutionResult,
} from './resources/workflows.js';

export { ExecutionsResource } from './resources/executions.js';
export type { Execution, ExecutionLog } from './resources/executions.js';

export { OrganizationsResource } from './resources/organizations.js';
export type {
  Organization,
  CreateOrganizationInput,
  OrganizationMember,
} from './resources/organizations.js';

export { ProjectsResource } from './resources/projects.js';
export type { Project, CreateProjectInput } from './resources/projects.js';

export { UsersResource } from './resources/users.js';
export type { User, CreateUserInput, UpdateUserInput, UserRole, UserStatus } from './resources/users.js';

export { ApiKeysResource } from './resources/api-keys.js';
export type { ApiKey, CreateApiKeyInput } from './resources/api-keys.js';

export { InterfacesResource } from './resources/interfaces.js';
export type { Interface, CreateInterfaceInput, UpdateInterfaceInput } from './resources/interfaces.js';

export { ProcessMapsResource } from './resources/process-maps.js';
export type { ProcessMap, CreateProcessMapInput } from './resources/process-maps.js';

// Builders — fluent programmatic construction of workflows
export { n, e, resetNodeIds } from './builders/node-builder.js';
export type { Node, Edge } from './builders/node-builder.js';
export { workflow, WorkflowBuilder } from './builders/workflow-builder.js';
