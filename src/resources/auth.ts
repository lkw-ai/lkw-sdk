import type { HttpClient } from '../http.js';

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export class AuthResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Login with email + password. Returns a JWT access token and the
   * authenticated user profile. The token is automatically applied to
   * subsequent requests on the same client instance.
   */
  async login(input: LoginInput): Promise<LoginResponse> {
    const res = await this.http.request<LoginResponse>({
      method: 'POST',
      path: '/auth/login',
      body: input,
      auth: { type: 'none' },
    });
    this.http.setBearerToken(res.data.accessToken);
    return res.data;
  }

  /** Revoke the current session server-side. The local token is forgotten. */
  async logout(): Promise<{ message: string }> {
    const res = await this.http.request<{ message: string }>({
      method: 'POST',
      path: '/auth/logout',
    });
    return res.data;
  }

  /** Validate the current token and return the authenticated user. */
  async verify(): Promise<{ user: LoginResponse['user'] | null }> {
    const res = await this.http.request<{ user: LoginResponse['user'] | null }>({
      method: 'GET',
      path: '/auth/verify',
    });
    return res.data;
  }

  /** List the authenticated user's sessions (one per device/login). */
  async listSessions(): Promise<Array<{ id: string; userAgent: string; ipAddress: string; createdAt: string; current: boolean }>> {
    const res = await this.http.request<Array<{ id: string; userAgent: string; ipAddress: string; createdAt: string; current: boolean }>>({
      method: 'GET',
      path: '/auth/sessions',
    });
    return res.data;
  }

  /** Revoke a specific session by ID. */
  async revokeSession(sessionId: string): Promise<void> {
    await this.http.request({ method: 'DELETE', path: `/auth/sessions/${sessionId}` });
  }

  /** Revoke all sessions for the current user (including the current one). */
  async logoutAll(): Promise<void> {
    await this.http.request({ method: 'POST', path: '/auth/sessions/logout-all' });
  }
}
