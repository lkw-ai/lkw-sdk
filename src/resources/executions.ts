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

  /**
   * Waits for an execution to finish (SUCCESS / FAILED / CANCELLED).
   *
   * Polls `get(id)` every `intervalMs` (default 1s) up to `timeoutMs`
   * (default 5min). Returns the final Execution; throws if timeout.
   * Useful for sync waits on long-running runs without holding an HTTP
   * connection open.
   */
  async waitUntilDone(
    id: string,
    opts: { intervalMs?: number; timeoutMs?: number; onPoll?: (e: Execution) => void } = {},
  ): Promise<Execution> {
    const intervalMs = opts.intervalMs ?? 1000;
    const timeoutMs = opts.timeoutMs ?? 5 * 60_000;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const e = await this.get(id);
      opts.onPoll?.(e);
      if (e.status === 'SUCCESS' || e.status === 'FAILED' || e.status === 'CANCELLED') return e;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error(`Execution ${id} did not finish within ${timeoutMs}ms`);
  }

  /**
   * Streams new log entries as they appear. Subscribes via simple polling
   * (interval 1s by default). Yields ExecutionLog one at a time as it sees
   * them; closes when execution reaches a terminal status.
   *
   * Example:
   *   for await (const log of lkw.executions.tailLogs(executionId)) {
   *     console.log(`[${log.level}] node=${log.nodeId} ${log.message}`);
   *   }
   */
  async *tailLogs(
    id: string,
    opts: { intervalMs?: number; timeoutMs?: number } = {},
  ): AsyncGenerator<ExecutionLog, Execution, void> {
    const intervalMs = opts.intervalMs ?? 1000;
    const timeoutMs = opts.timeoutMs ?? 30 * 60_000;
    const deadline = Date.now() + timeoutMs;
    const seen = new Set<string>();
    let finalExec: Execution | null = null;
    while (Date.now() < deadline) {
      const [exec, logs] = await Promise.all([this.get(id), this.logs(id)]);
      for (const l of logs) {
        if (!seen.has(l.id)) {
          seen.add(l.id);
          yield l;
        }
      }
      if (exec.status === 'SUCCESS' || exec.status === 'FAILED' || exec.status === 'CANCELLED') {
        finalExec = exec;
        break;
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    if (!finalExec) throw new Error(`Execution ${id} did not finish within ${timeoutMs}ms`);
    return finalExec;
  }
}
