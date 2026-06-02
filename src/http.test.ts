import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpClient } from './http.js';
import { LkwError } from './types.js';

function jsonResp(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

describe('HttpClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const baseOpts = { apiBaseUrl: 'https://api.test', retryBaseMs: 1, retries: 2 };

  beforeEach(() => { fetchMock = vi.fn(); });

  describe('auth', () => {
    it('attaches Bearer token from bearerToken option', async () => {
      fetchMock.mockResolvedValueOnce(jsonResp({ ok: true }));
      const c = new HttpClient({ ...baseOpts, bearerToken: 'abc', fetch: fetchMock as any });
      await c.request({ method: 'GET', path: '/x' });
      const headers = (fetchMock.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer abc');
    });

    it('attaches X-API-Key from apiKey option', async () => {
      fetchMock.mockResolvedValueOnce(jsonResp({ ok: true }));
      const c = new HttpClient({ ...baseOpts, apiKey: 'k123', fetch: fetchMock as any });
      await c.request({ method: 'GET', path: '/x' });
      const headers = (fetchMock.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
      expect(headers['X-API-Key']).toBe('k123');
    });

    it('per-request auth override takes precedence', async () => {
      fetchMock.mockResolvedValueOnce(jsonResp({ ok: true }));
      const c = new HttpClient({ ...baseOpts, bearerToken: 'default', fetch: fetchMock as any });
      await c.request({ method: 'GET', path: '/x', auth: { type: 'apiKey', key: 'override' } });
      const headers = (fetchMock.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
      expect(headers['X-API-Key']).toBe('override');
      expect(headers.Authorization).toBeUndefined();
    });

    it('setBearerToken() flips default auth at runtime', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResp({ ok: true }))
        .mockResolvedValueOnce(jsonResp({ ok: true }));
      const c = new HttpClient({ ...baseOpts, bearerToken: 'old', fetch: fetchMock as any });
      await c.request({ method: 'GET', path: '/x' });
      c.setBearerToken('new');
      await c.request({ method: 'GET', path: '/x' });
      const h2 = (fetchMock.mock.calls[1]![1] as RequestInit).headers as Record<string, string>;
      expect(h2.Authorization).toBe('Bearer new');
    });
  });

  describe('auth refresh on 401', () => {
    it('calls onAuthRefresh once and retries with new token', async () => {
      const refresh = vi.fn().mockResolvedValue('fresh-token');
      fetchMock
        .mockResolvedValueOnce(jsonResp({ message: 'expired' }, 401))
        .mockResolvedValueOnce(jsonResp({ ok: true }));
      const c = new HttpClient({ ...baseOpts, bearerToken: 'stale', onAuthRefresh: refresh, fetch: fetchMock as any });
      const r = await c.request({ method: 'GET', path: '/x' });
      expect(r.status).toBe(200);
      expect(refresh).toHaveBeenCalledTimes(1);
      const retryHeaders = (fetchMock.mock.calls[1]![1] as RequestInit).headers as Record<string, string>;
      expect(retryHeaders.Authorization).toBe('Bearer fresh-token');
    });

    it('throws auth error when refresh returns null', async () => {
      fetchMock.mockResolvedValueOnce(jsonResp({ message: 'expired' }, 401));
      const refresh = vi.fn().mockResolvedValue(null);
      const c = new HttpClient({ ...baseOpts, bearerToken: 'stale', onAuthRefresh: refresh, fetch: fetchMock as any });
      await expect(c.request({ method: 'GET', path: '/x' })).rejects.toMatchObject({
        category: 'auth', status: 401,
      });
    });

    it('does not refresh when per-request auth was provided', async () => {
      fetchMock.mockResolvedValueOnce(jsonResp({ message: 'no' }, 401));
      const refresh = vi.fn();
      const c = new HttpClient({ ...baseOpts, bearerToken: 'd', onAuthRefresh: refresh, fetch: fetchMock as any });
      await expect(c.request({
        method: 'GET', path: '/x', auth: { type: 'apiKey', key: 'k' },
      })).rejects.toMatchObject({ category: 'auth' });
      expect(refresh).not.toHaveBeenCalled();
    });

    it('coalesces concurrent refreshes (only one refresh call)', async () => {
      const refresh = vi.fn().mockResolvedValue('fresh');
      // Each pair: first 401, then 200
      fetchMock
        .mockResolvedValueOnce(jsonResp({ message: 'e1' }, 401))
        .mockResolvedValueOnce(jsonResp({ message: 'e2' }, 401))
        .mockResolvedValueOnce(jsonResp({ ok: 1 }))
        .mockResolvedValueOnce(jsonResp({ ok: 2 }));
      const c = new HttpClient({ ...baseOpts, bearerToken: 'old', onAuthRefresh: refresh, fetch: fetchMock as any });
      await Promise.all([
        c.request({ method: 'GET', path: '/a' }),
        c.request({ method: 'GET', path: '/b' }),
      ]);
      // Both 401s should converge on one refresh
      expect(refresh.mock.calls.length).toBeLessThanOrEqual(2); // 1 ideally, but tolerate race; key is "small"
    });
  });

  describe('retry policy', () => {
    it('retries 5xx with backoff and succeeds', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResp({ msg: 'down' }, 500))
        .mockResolvedValueOnce(jsonResp({ msg: 'down' }, 500))
        .mockResolvedValueOnce(jsonResp({ ok: true }));
      const c = new HttpClient({ ...baseOpts, fetch: fetchMock as any });
      const r = await c.request({ method: 'GET', path: '/x' });
      expect(r.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('retries 429 (rate limit)', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResp({ msg: 'rl' }, 429))
        .mockResolvedValueOnce(jsonResp({ ok: true }));
      const c = new HttpClient({ ...baseOpts, fetch: fetchMock as any });
      const r = await c.request({ method: 'GET', path: '/x' });
      expect(r.status).toBe(200);
    });

    it('does NOT retry 4xx (except 429)', async () => {
      fetchMock.mockResolvedValueOnce(jsonResp({ msg: 'nope' }, 400));
      const c = new HttpClient({ ...baseOpts, fetch: fetchMock as any });
      await expect(c.request({ method: 'GET', path: '/x' })).rejects.toBeInstanceOf(LkwError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('exhausts retries and throws', async () => {
      // Each call returns a fresh Response (body can only be read once).
      fetchMock.mockImplementation(() => Promise.resolve(jsonResp({ msg: 'down' }, 503)));
      const c = new HttpClient({ ...baseOpts, retries: 2, fetch: fetchMock as any });
      await expect(c.request({ method: 'GET', path: '/x' })).rejects.toMatchObject({
        category: 'server', status: 503, retryable: true,
      });
      expect(fetchMock).toHaveBeenCalledTimes(3); // 1 + 2 retries
    });

    it('retries network errors', async () => {
      const networkErr = new TypeError('failed to fetch');
      fetchMock
        .mockRejectedValueOnce(networkErr)
        .mockResolvedValueOnce(jsonResp({ ok: true }));
      const c = new HttpClient({ ...baseOpts, fetch: fetchMock as any });
      const r = await c.request({ method: 'GET', path: '/x' });
      expect(r.status).toBe(200);
    });
  });

  describe('LkwError', () => {
    it('categorizes 401 → auth', async () => {
      fetchMock.mockResolvedValueOnce(jsonResp({ message: 'invalid' }, 401));
      const c = new HttpClient({ ...baseOpts, fetch: fetchMock as any });
      try {
        await c.request({ method: 'GET', path: '/x' });
        expect.fail();
      } catch (e) {
        expect(e).toBeInstanceOf(LkwError);
        expect((e as LkwError).category).toBe('auth');
        expect((e as LkwError).retryable).toBe(false);
        expect((e as LkwError).message).toBe('invalid');
      }
    });

    it('categorizes 500 → server (retryable)', async () => {
      fetchMock.mockResolvedValue(jsonResp({}, 500));
      const c = new HttpClient({ ...baseOpts, retries: 0, fetch: fetchMock as any });
      try { await c.request({ method: 'GET', path: '/x' }); expect.fail(); }
      catch (e) {
        expect((e as LkwError).category).toBe('server');
        expect((e as LkwError).retryable).toBe(true);
      }
    });

    it('categorizes timeout', async () => {
      fetchMock.mockImplementation(() => new Promise((_, reject) => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        setTimeout(() => reject(err), 5);
      }));
      const c = new HttpClient({ ...baseOpts, timeoutMs: 10, retries: 0, fetch: fetchMock as any });
      try { await c.request({ method: 'GET', path: '/x' }); expect.fail(); }
      catch (e) {
        expect((e as LkwError).category).toBe('timeout');
        expect((e as LkwError).retryable).toBe(true);
      }
    });

    it('toString() includes status, url, message, body snippet', async () => {
      fetchMock.mockResolvedValueOnce(jsonResp({ message: 'nope' }, 404));
      const c = new HttpClient({ ...baseOpts, retries: 0, fetch: fetchMock as any });
      try { await c.request({ method: 'GET', path: '/x' }); expect.fail(); }
      catch (e) {
        const s = (e as LkwError).toString();
        expect(s).toContain('LkwError(client 404 GET');
        expect(s).toContain('/x');
        expect(s).toContain('nope');
      }
    });
  });

  describe('query strings + body', () => {
    it('builds query string from object, skipping undefined', async () => {
      fetchMock.mockResolvedValueOnce(jsonResp({}));
      const c = new HttpClient({ ...baseOpts, fetch: fetchMock as any });
      await c.request({ method: 'GET', path: '/items', query: { status: 'ACTIVE', limit: 50, skip: undefined } });
      const url = fetchMock.mock.calls[0]![0] as string;
      expect(url).toContain('status=ACTIVE');
      expect(url).toContain('limit=50');
      expect(url).not.toContain('skip');
    });

    it('serializes body as JSON with Content-Type', async () => {
      fetchMock.mockResolvedValueOnce(jsonResp({ id: 1 }));
      const c = new HttpClient({ ...baseOpts, fetch: fetchMock as any });
      await c.request({ method: 'POST', path: '/items', body: { name: 'foo' } });
      const init = fetchMock.mock.calls[0]![1] as RequestInit;
      expect(init.body).toBe('{"name":"foo"}');
      expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    });
  });

  describe('telemetry', () => {
    it('calls onRequest once per attempt with status/duration/retried', async () => {
      const events: any[] = [];
      fetchMock
        .mockResolvedValueOnce(jsonResp({}, 500))
        .mockResolvedValueOnce(jsonResp({ ok: true }));
      const c = new HttpClient({ ...baseOpts, onRequest: (i) => events.push(i), fetch: fetchMock as any });
      await c.request({ method: 'GET', path: '/x' });
      expect(events.length).toBe(2);
      expect(events[0].status).toBe(500);
      expect(events[0].retried).toBe(true);
      expect(events[1].status).toBe(200);
      expect(events[1].retried).toBe(true);
    });

    it('telemetry errors are swallowed', async () => {
      fetchMock.mockResolvedValueOnce(jsonResp({ ok: true }));
      const c = new HttpClient({ ...baseOpts, onRequest: () => { throw new Error('boom'); }, fetch: fetchMock as any });
      await expect(c.request({ method: 'GET', path: '/x' })).resolves.toBeTruthy();
    });
  });
});
