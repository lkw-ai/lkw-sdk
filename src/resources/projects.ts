import type { HttpClient } from '../http.js';

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  organizationId?: string;
}

export class ProjectsResource {
  constructor(private readonly http: HttpClient) {}

  async list(): Promise<Project[]> {
    const res = await this.http.request<Project[]>({ method: 'GET', path: '/projects' });
    return res.data;
  }

  async get(id: string): Promise<Project> {
    const res = await this.http.request<Project>({ method: 'GET', path: `/projects/${id}` });
    return res.data;
  }

  async create(input: CreateProjectInput): Promise<Project> {
    const res = await this.http.request<Project>({
      method: 'POST',
      path: '/projects',
      body: input,
    });
    return res.data;
  }

  async update(id: string, input: Partial<CreateProjectInput>): Promise<Project> {
    const res = await this.http.request<Project>({
      method: 'PUT',
      path: `/projects/${id}`,
      body: input,
    });
    return res.data;
  }

  async delete(id: string): Promise<void> {
    await this.http.request({ method: 'DELETE', path: `/projects/${id}` });
  }
}
