/**
 * NodeBuilder — strongly-typed helpers that produce LKW workflow node
 * objects without having to remember the exact shape of every type.
 *
 *   import { n } from '@lkw-ai/sdk';
 *
 *   const node = n.code('Parse input', `return { ok: true };`);
 *   const trigger = n.httpTrigger('Webhook');
 *   const api = n.apiCall('Fetch data', { url: 'https://...', method: 'GET' });
 *
 * Output is a `Node` object that can be appended to a workflow definition
 * (see WorkflowBuilder) or POSTed directly.
 */

export interface Node {
  id: string;
  type: 'custom';
  position: { x: number; y: number };
  data: {
    type: string;
    label: string;
    config?: Record<string, unknown>;
    executionOrder?: number;
    continueOnFail?: boolean;
    retryOnFail?: boolean;
    maxRetries?: number;
    retryDelayMs?: number;
  };
}

export interface Edge {
  id: string;
  type: 'smoothstep';
  source: string;
  target: string;
  sourceHandle?: string;
}

let _idCounter = 0;
function nextId(): string { return String(++_idCounter); }
/** Reset the auto-id counter — useful between independent builds (tests, scripts). */
export function resetNodeIds(): void { _idCounter = 0; }

interface BaseOpts {
  id?: string;
  position?: { x: number; y: number };
  executionOrder?: number;
  continueOnFail?: boolean;
  retryOnFail?: boolean;
  maxRetries?: number;
  retryDelayMs?: number;
}

function build(type: string, label: string, config: Record<string, unknown> | undefined, opts?: BaseOpts): Node {
  const id = opts?.id ?? nextId();
  return {
    id,
    type: 'custom',
    position: opts?.position ?? { x: 400, y: 30 + (Number(id) - 1) * 170 },
    data: {
      type, label, ...(config ? { config } : {}),
      ...(opts?.executionOrder !== undefined ? { executionOrder: opts.executionOrder } : {}),
      ...(opts?.continueOnFail !== undefined ? { continueOnFail: opts.continueOnFail } : {}),
      ...(opts?.retryOnFail !== undefined ? { retryOnFail: opts.retryOnFail } : {}),
      ...(opts?.maxRetries !== undefined ? { maxRetries: opts.maxRetries } : {}),
      ...(opts?.retryDelayMs !== undefined ? { retryDelayMs: opts.retryDelayMs } : {}),
    },
  };
}

// ──────────────────────────────────────────────────────────────────────
// Triggers
// ──────────────────────────────────────────────────────────────────────

export const n = {
  httpTrigger(label = 'HTTP Trigger', opts?: BaseOpts): Node {
    return build('http_trigger', label, {}, opts);
  },

  schedule(label: string, cfg: { interval?: string; cron?: string }, opts?: BaseOpts): Node {
    return build('schedule', label, cfg, opts);
  },

  amqpTrigger(label: string, cfg: { queue: string; exchange?: string; routingKey?: string }, opts?: BaseOpts): Node {
    return build('amqp_trigger', label, cfg, opts);
  },

  // ────────────────────────────────────────────────────────────────────
  // Core processing
  // ────────────────────────────────────────────────────────────────────

  code(label: string, code: string, opts?: BaseOpts): Node {
    return build('code', label, { code }, opts);
  },

  apiCall(label: string, cfg: { url: string; method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; headers?: Record<string, string> | string; body?: string; query?: Record<string, string> }, opts?: BaseOpts): Node {
    return build('api_call', label, {
      ...cfg,
      method: cfg.method ?? 'GET',
      headers: typeof cfg.headers === 'object' ? JSON.stringify(cfg.headers) : cfg.headers,
    }, opts);
  },

  llm(label: string, cfg: { prompt: string; systemPrompt?: string; model?: string; temperature?: number; maxTokens?: number; responseFormat?: 'json' }, opts?: BaseOpts): Node {
    return build('llm', label, cfg, opts);
  },

  // ────────────────────────────────────────────────────────────────────
  // Flow control
  // ────────────────────────────────────────────────────────────────────

  condition(label: string, cfg: { conditionField: string; conditionOperator: 'equals' | 'not_equals' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'in'; conditionValue: unknown }, opts?: BaseOpts): Node {
    return build('condition', label, cfg, opts);
  },

  switch(label: string, cfg: { switchField: string; cases: Array<{ value: string | number; outputIndex: number }>; defaultOutput?: number }, opts?: BaseOpts): Node {
    return build('switch', label, cfg, opts);
  },

  merge(label: string, opts?: BaseOpts): Node {
    return build('merge', label, {}, opts);
  },

  splitItems(label: string, cfg: { itemsField: string }, opts?: BaseOpts): Node {
    return build('split_items', label, cfg, opts);
  },

  loop(label: string, cfg: { items: string; maxIterations?: number }, opts?: BaseOpts): Node {
    return build('loop', label, cfg, opts);
  },

  wait(label: string, cfg: { ms: number }, opts?: BaseOpts): Node {
    return build('wait', label, cfg, opts);
  },

  // ────────────────────────────────────────────────────────────────────
  // Response + side effects
  // ────────────────────────────────────────────────────────────────────

  respond(label = 'Respond', cfg: { statusCode?: number; body?: unknown; headers?: Record<string, string> } = {}, opts?: BaseOpts): Node {
    return build('respond', label, { statusCode: 200, ...cfg }, opts);
  },

  sendEmail(label: string, cfg: { to: string; subject: string; body: string; from?: string }, opts?: BaseOpts): Node {
    return build('send_email', label, cfg, opts);
  },

  sendSms(label: string, cfg: { to: string; message: string }, opts?: BaseOpts): Node {
    return build('send_sms', label, cfg, opts);
  },

  amqpPublish(label: string, cfg: { exchange?: string; routingKey: string; payload?: string }, opts?: BaseOpts): Node {
    return build('amqp_publish', label, cfg, opts);
  },

  subWorkflow(label: string, cfg: { workflowId: string; inputMapping?: Record<string, string> }, opts?: BaseOpts): Node {
    return build('sub_workflow', label, cfg, opts);
  },

  dbQuery(label: string, cfg: { query: string; params?: unknown[] }, opts?: BaseOpts): Node {
    return build('db_query', label, cfg, opts);
  },

  // ────────────────────────────────────────────────────────────────────
  // Logistics nodes (LKW-native, shipped with the platform)
  // ────────────────────────────────────────────────────────────────────

  cepLookup(label: string, cfg: { cep?: string } = {}, opts?: BaseOpts): Node {
    return build('cep_lookup', label, cfg, opts);
  },

  geocode(label: string, cfg: { query?: string } = {}, opts?: BaseOpts): Node {
    return build('geocode', label, cfg, opts);
  },

  reverseGeocode(label: string, cfg: { lat?: number; lng?: number } = {}, opts?: BaseOpts): Node {
    return build('reverse_geocode', label, cfg, opts);
  },

  routeCalculator(label: string, cfg: { origin?: { lat: number; lng: number }; destination?: { lat: number; lng: number }; provider?: 'haversine' | 'osrm' | 'google'; profile?: 'driving' | 'walking' | 'cycling'; avgSpeedKmh?: number } = {}, opts?: BaseOpts): Node {
    return build('route_calculator', label, cfg, opts);
  },

  distanceMatrix(label: string, cfg: { origins?: unknown[]; destinations?: unknown[]; provider?: 'haversine' | 'osrm' | 'google' } = {}, opts?: BaseOpts): Node {
    return build('distance_matrix', label, cfg, opts);
  },

  routeCompare(label: string, opts?: BaseOpts): Node {
    return build('route_compare', label, {}, opts);
  },

  routeOptimizer(label: string, cfg: { points?: unknown[]; startIndex?: number; returnToStart?: boolean } = {}, opts?: BaseOpts): Node {
    return build('route_optimizer', label, cfg, opts);
  },

  etaCalculator(label: string, cfg: { distanceKm?: number; avgSpeedKmh?: number; departure?: string; stopMinutes?: number; breakAfterHours?: number; breakMinutes?: number } = {}, opts?: BaseOpts): Node {
    return build('eta_calculator', label, cfg, opts);
  },

  freightCalc(label: string, cfg: { distanceKm?: number; peso_kg?: number; volume_m3?: number; valor_nf_brl?: number; pedagio_brl?: number; uf_origem?: string; uf_destino?: string } = {}, opts?: BaseOpts): Node {
    return build('freight_calc', label, cfg, opts);
  },

  vehicleCapacityCheck(label: string, cfg: { veiculo?: unknown; carga?: unknown } = {}, opts?: BaseOpts): Node {
    return build('vehicle_capacity_check', label, cfg, opts);
  },
};

// ──────────────────────────────────────────────────────────────────────
// Edge helpers
// ──────────────────────────────────────────────────────────────────────

export const e = {
  /** Linear chain: edges from 1→2→3→...→N. */
  chain(...nodes: Node[]): Edge[] {
    const out: Edge[] = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      out.push({
        id: `e${nodes[i].id}-${nodes[i + 1].id}`,
        type: 'smoothstep',
        source: nodes[i].id,
        target: nodes[i + 1].id,
      });
    }
    return out;
  },

  /** Single edge with optional sourceHandle (for condition true/false, switch outputs, etc). */
  link(from: Node, to: Node, sourceHandle?: string): Edge {
    return {
      id: `e${from.id}-${to.id}${sourceHandle ? '_' + sourceHandle : ''}`,
      type: 'smoothstep',
      source: from.id,
      target: to.id,
      ...(sourceHandle ? { sourceHandle } : {}),
    };
  },
};
