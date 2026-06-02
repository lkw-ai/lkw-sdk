/**
 * Interfaces — auto-generated forms attached to workflows so non-tech
 * users can trigger them with a friendly UI instead of curling.
 */
import type { HttpClient } from '../http.js';

export interface Interface {
  id: string;
  projectId: string;
  workflowId?: string;
  name: string;
  description?: string;
  schema: unknown;          // JSON schema describing the form
  uiSchema?: unknown;       // optional UI hints
  isTemplate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInterfaceInput {
  name: string;
  description?: string;
  workflowId?: string;
  schema: unknown;
  uiSchema?: unknown;
}

export interface UpdateInterfaceInput {
  name?: string;
  description?: string;
  schema?: unknown;
  uiSchema?: unknown;
}

export class InterfacesResource {
  constructor(private readonly http: HttpClient) {}

  async list(projectId: string): Promise<Interface[]> {
    const r = await this.http.request<Interface[]>({ method: 'GET', path: `/interfaces/project/${projectId}` });
    return r.data;
  }

  async listTemplates(): Promise<Interface[]> {
    const r = await this.http.request<Interface[]>({ method: 'GET', path: '/interfaces/templates/all' });
    return r.data;
  }

  async get(id: string): Promise<Interface> {
    const r = await this.http.request<Interface>({ method: 'GET', path: `/interfaces/${id}` });
    return r.data;
  }

  async create(projectId: string, input: CreateInterfaceInput): Promise<Interface> {
    const r = await this.http.request<Interface>({ method: 'POST', path: `/interfaces/${projectId}`, body: input });
    return r.data;
  }

  async update(id: string, input: UpdateInterfaceInput): Promise<Interface> {
    const r = await this.http.request<Interface>({ method: 'PUT', path: `/interfaces/${id}`, body: input });
    return r.data;
  }

  async delete(id: string): Promise<void> {
    await this.http.request({ method: 'DELETE', path: `/interfaces/${id}` });
  }
}
