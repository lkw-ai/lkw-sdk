import type { HttpClient } from '../http.js';

export interface Execution {
  id: string;
  workflowId: string;
  userId?: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  inputData?: unknown;
  outputData?: unknown;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface ExecutionLog {
  id: string;
  executionId: string;
  nodeId?: string;
  level: string;
  message: string;
  data?: unknown;
  createdAt: string;
}

export class ExecutionsResource {
  constructor(private readonly http: HttpClient) {}

  /** List executions for a workflow (most recent first). */
  async list(workflowId: string): Promise<Execution[]> {
    const res = await this.http.request<Execution[]>({
      method: 'GET',
      path: `/executions`,
      query: { workflowId },
    });
    return res.data;
  }

  /** Get a single execution by ID, including snapshot of the workflow at run time. */
  async get(id: string): Promise<Execution> {
    const res = await this.http.request<Execution>({ method: 'GET', path: `/executions/${id}` });
    return res.data;
  }

  /** Get the per-node logs of an execution. */
  async logs(id: string): Promise<ExecutionLog[]> {
    const res = await this.http.request<ExecutionLog[]>({
      method: 'GET',
      path: `/executions/${id}/logs`,
    });
    return res.data;
  }
}
