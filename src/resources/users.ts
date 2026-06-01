import type { HttpClient } from '../http.js';

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'DEVELOPER' | 'VIEWER';
export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  email: string;
  name: string;
  /** Must be ≥ 8 characters. */
  password: string;
  role?: UserRole;
  status?: UserStatus;
  organizationId?: string;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: UserRole;
  status?: UserStatus;
  /** When set, must be ≥ 8 characters. Triggers session revocation. */
  password?: string;
}

export class UsersResource {
  constructor(private readonly http: HttpClient) {}

  async list(): Promise<User[]> {
    const res = await this.http.request<User[]>({ method: 'GET', path: '/users' });
    return res.data;
  }

  async get(id: string): Promise<User> {
    const res = await this.http.request<User>({ method: 'GET', path: `/users/${id}` });
    return res.data;
  }

  async create(input: CreateUserInput): Promise<User> {
    const res = await this.http.request<User>({ method: 'POST', path: '/users', body: input });
    return res.data;
  }

  async update(id: string, input: UpdateUserInput): Promise<User> {
    const res = await this.http.request<User>({ method: 'PUT', path: `/users/${id}`, body: input });
    return res.data;
  }

  async delete(id: string): Promise<void> {
    await this.http.request({ method: 'DELETE', path: `/users/${id}` });
  }
}
