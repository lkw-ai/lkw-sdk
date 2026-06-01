import type { HttpClient } from '../http.js';

export interface Workflow {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  nodes: unknown[];
  edges: unknown[];
  version: number;
  isTemplate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkflowInput {
  name: string;
  description?: string;
  nodes?: unknown[];
  edges?: unknown[];
}

export interface UpdateWorkflowInput {
  name?: string;
  description?: string;
  status?: Workflow['status'];
  nodes?: unknown[];
  edges?: unknown[];
}

export interface WorkflowExecutionResult {
  success: boolean;
  data?: unknown;
  executionId: string;
  output?: unknown;
  logs?: Array<{ level: string; message: string; nodeId?: string; timestamp?: string; data?: unknown }>;
  nodeStatuses?: Record<string, unknown>;
  nodeOutputs?: Record<string, unknown>;
  signature?: string;
  error?: string;
}

export class WorkflowsResource {
  constructor(private readonly http: HttpClient) {}

  /** List workflows belonging to a project. */
  async list(projectId: string): Promise<Workflow[]> {
    const res = await this.http.request<Workflow[]>({
      method: 'GET',
      path: `/workflows/project/${projectId}`,
    });
    return res.data;
  }

  /** List all template workflows. */
  async listTemplates(): Promise<Workflow[]> {
    const res = await this.http.request<Workflow[]>({
      method: 'GET',
      path: '/workflows/templates/all',
    });
    return res.data;
  }

  /** Get a single workflow by ID. */
  async get(id: string): Promise<Workflow> {
    const res = await this.http.request<Workflow>({ method: 'GET', path: `/workflows/${id}` });
    return res.data;
  }

  /** Create a new workflow in the given project. */
  async create(projectId: string, input: CreateWorkflowInput): Promise<Workflow> {
    const res = await this.http.request<Workflow>({
      method: 'POST',
      path: `/workflows/${projectId}`,
      body: input,
    });
    return res.data;
  }

  /** Update fields, status, or the graph (nodes/edges). */
  async update(id: string, input: UpdateWorkflowInput): Promise<Workflow> {
    const res = await this.http.request<Workflow>({
      method: 'PUT',
      path: `/workflows/${id}`,
      body: input,
    });
    return res.data;
  }

  /** Permanently delete a workflow. */
  async delete(id: string): Promise<void> {
    await this.http.request({ method: 'DELETE', path: `/workflows/${id}` });
  }

  /**
   * Execute a workflow synchronously (authenticated). Use this when the
   * workflow finishes quickly and you want the result inline.
   *
   * For long-running workflows or when you want to enqueue and check status
   * later, see `executeAsync` (queues via Bull, returns immediately).
   */
  async execute(
    id: string,
    input?: { inputData?: Record<string, unknown>; startNodeId?: string },
  ): Promise<WorkflowExecutionResult> {
    const res = await this.http.request<WorkflowExecutionResult>({
      method: 'POST',
      path: `/workflows/${id}/execute`,
      body: input ?? {},
    });
    return res.data;
  }

  /**
   * Trigger a workflow via its public HTTP endpoint using an API key.
   * No JWT required — useful for webhooks and external integrations.
   *
   * @param id the workflow ID
   * @param apiKey the API key created in the workflow's Trigger & API Keys tab
   * @param payload arbitrary JSON delivered as the workflow's input
   */
  async trigger(id: string, apiKey: string, payload?: unknown): Promise<WorkflowExecutionResult> {
    const res = await this.http.request<WorkflowExecutionResult>({
      method: 'POST',
      path: `/workflows/trigger/${id}`,
      body: payload ?? {},
      auth: { type: 'apiKey', key: apiKey },
    });
    return res.data;
  }
}
