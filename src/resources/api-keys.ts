import type { HttpClient } from '../http.js';

export interface ApiKey {
  id: string;
  name: string;
  description?: string;
  keyPrefix: string;
  /** Full API key. Returned ONLY on creation — never stored in plain text. */
  key?: string;
  workflowId: string;
  isActive: boolean;
  expiresAt?: string;
  createdAt: string;
}

export interface CreateApiKeyInput {
  name: string;
  description?: string;
  /** ISO 8601 date. If omitted, key never expires. */
  expiresAt?: string;
}

export class ApiKeysResource {
  constructor(private readonly http: HttpClient) {}

  /** List API keys for a workflow. */
  async list(workflowId: string): Promise<ApiKey[]> {
    const res = await this.http.request<ApiKey[]>({
      method: 'GET',
      path: `/api-keys`,
      query: { workflowId },
    });
    return res.data;
  }

  /**
   * Create a new API key for a workflow. The full key is returned ONCE
   * on creation — store it securely; it's not retrievable later.
   */
  async create(workflowId: string, input: CreateApiKeyInput): Promise<ApiKey> {
    const res = await this.http.request<ApiKey>({
      method: 'POST',
      path: `/api-keys/${workflowId}`,
      body: input,
    });
    return res.data;
  }

  async revoke(id: string): Promise<void> {
    await this.http.request({ method: 'DELETE', path: `/api-keys/${id}` });
  }
}
