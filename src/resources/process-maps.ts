/**
 * Process Maps — high-level diagrams that orchestrate multiple workflows
 * + interfaces into an end-to-end business process view (the "Catálogo de
 * Automações" sort of artifact).
 */
import type { HttpClient } from '../http.js';

export interface ProcessMap {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  graph: unknown; // free-form (nodes/edges of the high-level map)
  createdAt: string;
  updatedAt: string;
}

export interface CreateProcessMapInput {
  name: string;
  description?: string;
  graph?: unknown;
}

export class ProcessMapsResource {
  constructor(private readonly http: HttpClient) {}

  async list(projectId: string): Promise<ProcessMap[]> {
    const r = await this.http.request<ProcessMap[]>({ method: 'GET', path: `/process-maps/project/${projectId}` });
    return r.data;
  }

  async get(id: string): Promise<ProcessMap> {
    const r = await this.http.request<ProcessMap>({ method: 'GET', path: `/process-maps/${id}` });
    return r.data;
  }

  async create(projectId: string, input: CreateProcessMapInput): Promise<ProcessMap> {
    const r = await this.http.request<ProcessMap>({ method: 'POST', path: `/process-maps/${projectId}`, body: input });
    return r.data;
  }

  async update(id: string, input: Partial<CreateProcessMapInput>): Promise<ProcessMap> {
    const r = await this.http.request<ProcessMap>({ method: 'PUT', path: `/process-maps/${id}`, body: input });
    return r.data;
  }

  async delete(id: string): Promise<void> {
    await this.http.request({ method: 'DELETE', path: `/process-maps/${id}` });
  }

  /** Portable JSON export — paste into another env via `import()`. */
  async export(id: string): Promise<unknown> {
    const r = await this.http.request({ method: 'GET', path: `/process-maps/${id}/export` });
    return r.data;
  }

  /** Import a previously-exported JSON into a project. */
  async import(projectId: string, exportData: unknown): Promise<ProcessMap> {
    const r = await this.http.request<ProcessMap>({
      method: 'POST',
      path: `/process-maps/import/${projectId}`,
      body: exportData,
    });
    return r.data;
  }
}
