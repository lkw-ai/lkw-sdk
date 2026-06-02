/**
 * Smoke tests for each resource: verify they hit the right method+path
 * with the expected body shape. We don't validate the LKW backend itself
 * here (that's integration). What we DO validate:
 *   - URLs are constructed correctly (especially path params)
 *   - HTTP verb is right
 *   - Body is serialized when expected
 *   - Response shape passes through unchanged
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LkwClient } from '../index.js';

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

let fetchMock: ReturnType<typeof vi.fn>;
function client() {
  return new LkwClient({
    apiBaseUrl: 'https://api.test',
    bearerToken: 't',
    retries: 0,
    fetch: fetchMock as any,
  });
}
function callArgs(idx = 0) {
  const [url, init] = fetchMock.mock.calls[idx]!;
  return { url: url as string, method: (init as RequestInit).method, body: (init as RequestInit).body, headers: (init as RequestInit).headers as Record<string, string> };
}

beforeEach(() => { fetchMock = vi.fn(); });

describe('AuthResource', () => {
  it('login posts credentials and switches default token', async () => {
    fetchMock.mockResolvedValueOnce(jsonResp({ accessToken: 'new-jwt', user: { id: '1', email: 'a@b.c', name: 'A', role: 'ADMIN' } }));
    const c = client();
    const r = await c.auth.login({ email: 'a@b.c', password: 'x' });
    expect(r.accessToken).toBe('new-jwt');
    const a = callArgs();
    expect(a.method).toBe('POST');
    expect(a.url).toContain('/auth/login');
    expect(a.body).toContain('a@b.c');
  });
});

describe('WorkflowsResource', () => {
  it('list hits /workflows/project/:id', async () => {
    fetchMock.mockResolvedValueOnce(jsonResp([{ id: 'w1', name: 'W' }]));
    await client().workflows.list('proj-1');
    expect(callArgs().url).toContain('/workflows/project/proj-1');
  });
  it('get hits /workflows/:id', async () => {
    fetchMock.mockResolvedValueOnce(jsonResp({ id: 'w1' }));
    await client().workflows.get('w1');
    expect(callArgs().url).toContain('/workflows/w1');
  });
  it('create posts to /workflows/:projectId', async () => {
    fetchMock.mockResolvedValueOnce(jsonResp({ id: 'new' }));
    await client().workflows.create('p1', { name: 'X' });
    const a = callArgs();
    expect(a.method).toBe('POST');
    expect(a.url).toContain('/workflows/p1');
    expect(a.body).toContain('"name":"X"');
  });
  it('update PUTs to /workflows/:id', async () => {
    fetchMock.mockResolvedValueOnce(jsonResp({ id: 'w' }));
    await client().workflows.update('w', { name: 'Y' });
    expect(callArgs().method).toBe('PUT');
  });
  it('delete DELETEs /workflows/:id', async () => {
    fetchMock.mockResolvedValueOnce(jsonResp({}));
    await client().workflows.delete('w');
    expect(callArgs().method).toBe('DELETE');
  });
  it('trigger uses X-API-Key not Bearer', async () => {
    fetchMock.mockResolvedValueOnce(jsonResp({ success: true, executionId: 'e1' }));
    await client().workflows.trigger('w1', 'lkw_key_xyz', { foo: 1 });
    const a = callArgs();
    expect(a.url).toContain('/workflows/trigger/w1');
    expect(a.headers['X-API-Key']).toBe('lkw_key_xyz');
    expect(a.headers.Authorization).toBeUndefined();
  });
});

describe('ExecutionsResource', () => {
  it('list filters by workflowId', async () => {
    fetchMock.mockResolvedValueOnce(jsonResp([]));
    await client().executions.list('w1');
    expect(callArgs().url).toContain('/executions');
    expect(callArgs().url).toContain('workflowId=w1');
  });

  it('logs hits /executions/:id/logs', async () => {
    fetchMock.mockResolvedValueOnce(jsonResp([]));
    await client().executions.logs('e1');
    expect(callArgs().url).toContain('/executions/e1/logs');
  });

  it('waitUntilDone polls until status terminal', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResp({ id: 'e1', status: 'RUNNING', workflowId: 'w', createdAt: 'now' }))
      .mockResolvedValueOnce(jsonResp({ id: 'e1', status: 'RUNNING', workflowId: 'w', createdAt: 'now' }))
      .mockResolvedValueOnce(jsonResp({ id: 'e1', status: 'SUCCESS', workflowId: 'w', createdAt: 'now' }));
    const r = await client().executions.waitUntilDone('e1', { intervalMs: 5, timeoutMs: 5000 });
    expect(r.status).toBe('SUCCESS');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('waitUntilDone times out gracefully', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResp({ id: 'e1', status: 'RUNNING', workflowId: 'w', createdAt: 'now' })));
    await expect(client().executions.waitUntilDone('e1', { intervalMs: 5, timeoutMs: 30 })).rejects.toThrow(/did not finish/);
  });

  it('tailLogs yields new logs, returns final exec', async () => {
    // exec polling sequence: RUNNING, RUNNING, SUCCESS
    // logs polling sequence: [], [log1], [log1, log2]
    fetchMock
      .mockResolvedValueOnce(jsonResp({ id: 'e1', status: 'RUNNING', workflowId: 'w', createdAt: 'now' }))
      .mockResolvedValueOnce(jsonResp([]))
      .mockResolvedValueOnce(jsonResp({ id: 'e1', status: 'RUNNING', workflowId: 'w', createdAt: 'now' }))
      .mockResolvedValueOnce(jsonResp([{ id: 'l1', executionId: 'e1', level: 'info', message: 'hi', createdAt: 'now' }]))
      .mockResolvedValueOnce(jsonResp({ id: 'e1', status: 'SUCCESS', workflowId: 'w', createdAt: 'now' }))
      .mockResolvedValueOnce(jsonResp([
        { id: 'l1', executionId: 'e1', level: 'info', message: 'hi', createdAt: 'now' },
        { id: 'l2', executionId: 'e1', level: 'info', message: 'done', createdAt: 'now' },
      ]));

    const yielded: any[] = [];
    const iter = client().executions.tailLogs('e1', { intervalMs: 5, timeoutMs: 5000 });
    let result;
    while (true) {
      const r = await iter.next();
      if (r.done) { result = r.value; break; }
      yielded.push(r.value);
    }
    expect(yielded.map(l => l.id)).toEqual(['l1', 'l2']);
    expect((result as any).status).toBe('SUCCESS');
  });
});

describe('OrganizationsResource', () => {
  it('list, get, create, update, delete map to the expected URLs', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResp([])).mockResolvedValueOnce(jsonResp({}))
      .mockResolvedValueOnce(jsonResp({})).mockResolvedValueOnce(jsonResp({}))
      .mockResolvedValueOnce(jsonResp({}));
    const c = client();
    await c.organizations.list();           expect(callArgs(0).url).toContain('/organizations');
    await c.organizations.get('o1');        expect(callArgs(1).url).toContain('/organizations/o1');
    await c.organizations.create({ name: 'X' });
    expect(callArgs(2).method).toBe('POST');
    await c.organizations.update('o1', { name: 'Y' });
    expect(callArgs(3).method).toBe('PUT');
    await c.organizations.delete('o1');
    expect(callArgs(4).method).toBe('DELETE');
  });

  it('addMember posts userId + role', async () => {
    fetchMock.mockResolvedValueOnce(jsonResp({}));
    await client().organizations.addMember('o1', 'u1', 'ADMIN');
    const a = callArgs();
    expect(a.url).toContain('/organizations/o1/members');
    expect(a.body).toContain('"userId":"u1"');
    expect(a.body).toContain('"role":"ADMIN"');
  });
});

describe('ProjectsResource + UsersResource + ApiKeysResource', () => {
  it('basic CRUD maps', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResp([]))
      .mockResolvedValueOnce(jsonResp({}))
      .mockResolvedValueOnce(jsonResp({}))
      .mockResolvedValueOnce(jsonResp([])).mockResolvedValueOnce(jsonResp([]))
      .mockResolvedValueOnce(jsonResp([{ id: 'k1' }]));
    const c = client();
    await c.projects.list();    expect(callArgs(0).url).toContain('/projects');
    await c.projects.get('p1'); expect(callArgs(1).url).toContain('/projects/p1');
    await c.users.create({ email: 'u@u', password: 'pass1234', name: 'U', role: 'ADMIN' });
    expect(callArgs(2).method).toBe('POST');
    await c.users.list();
    await c.users.get('u1');
    await c.apiKeys.list('w1');
    const apiKeysUrl = callArgs(5).url;
    expect(apiKeysUrl).toContain('/api-keys');
    expect(apiKeysUrl).toContain('workflowId=w1');
  });
});

describe('InterfacesResource', () => {
  it('export + import use /export and /import/:projectId', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResp({ _lkwExport: true, kind: 'interface', interface: {} }))
      .mockResolvedValueOnce(jsonResp({ id: 'i2' }));
    const c = client();
    await c.interfaces.export('i1');
    expect(callArgs(0).url).toContain('/interfaces/i1/export');
    await c.interfaces.import('p1', { _lkwExport: true });
    expect(callArgs(1).url).toContain('/interfaces/import/p1');
    expect(callArgs(1).method).toBe('POST');
  });
});

describe('ProcessMapsResource', () => {
  it('export + import work', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResp({ _lkwExport: true, kind: 'process_map', processMap: {} }))
      .mockResolvedValueOnce(jsonResp({ id: 'pm2' }));
    const c = client();
    await c.processMaps.export('pm1');
    expect(callArgs(0).url).toContain('/process-maps/pm1/export');
    await c.processMaps.import('p1', { _lkwExport: true });
    expect(callArgs(1).method).toBe('POST');
  });
});
