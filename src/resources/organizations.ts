import type { HttpClient } from '../http.js';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrganizationInput {
  name: string;
  description?: string;
  slug?: string;
}

export interface OrganizationMember {
  id: string;
  userId: string;
  organizationId: string;
  role: 'ADMIN' | 'MANAGER' | 'DEVELOPER' | 'VIEWER';
}

export class OrganizationsResource {
  constructor(private readonly http: HttpClient) {}

  async list(): Promise<Organization[]> {
    const res = await this.http.request<Organization[]>({ method: 'GET', path: '/organizations' });
    return res.data;
  }

  async get(id: string): Promise<Organization> {
    const res = await this.http.request<Organization>({ method: 'GET', path: `/organizations/${id}` });
    return res.data;
  }

  async create(input: CreateOrganizationInput): Promise<Organization> {
    const res = await this.http.request<Organization>({
      method: 'POST',
      path: '/organizations',
      body: input,
    });
    return res.data;
  }

  async update(id: string, input: Partial<CreateOrganizationInput>): Promise<Organization> {
    const res = await this.http.request<Organization>({
      method: 'PUT',
      path: `/organizations/${id}`,
      body: input,
    });
    return res.data;
  }

  async delete(id: string): Promise<void> {
    await this.http.request({ method: 'DELETE', path: `/organizations/${id}` });
  }

  async listMembers(id: string): Promise<OrganizationMember[]> {
    const res = await this.http.request<OrganizationMember[]>({
      method: 'GET',
      path: `/organizations/${id}/members`,
    });
    return res.data;
  }

  async addMember(orgId: string, userId: string, role: OrganizationMember['role']): Promise<OrganizationMember> {
    const res = await this.http.request<OrganizationMember>({
      method: 'POST',
      path: `/organizations/${orgId}/members`,
      body: { userId, role },
    });
    return res.data;
  }
}
