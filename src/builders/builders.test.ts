import { describe, it, expect, beforeEach } from 'vitest';
import { n, e, resetNodeIds, workflow } from '../index.js';

describe('NodeBuilder', () => {
  beforeEach(() => resetNodeIds());

  it('builds http_trigger with auto id and default position', () => {
    const node = n.httpTrigger('Receive');
    expect(node.type).toBe('custom');
    expect(node.data.type).toBe('http_trigger');
    expect(node.data.label).toBe('Receive');
    expect(node.id).toBe('1');
    expect(node.position).toEqual({ x: 400, y: 30 });
  });

  it('serializes apiCall headers object → string', () => {
    const node = n.apiCall('Fetch', { url: 'https://x', method: 'POST', headers: { Authorization: 'Bearer X' } });
    expect((node.data.config as any).headers).toBe('{"Authorization":"Bearer X"}');
    expect((node.data.config as any).method).toBe('POST');
  });

  it('respects custom opts (continueOnFail, retryOnFail)', () => {
    const node = n.apiCall('Fetch', { url: 'https://x' }, { continueOnFail: true, retryOnFail: true, maxRetries: 5 });
    expect(node.data.continueOnFail).toBe(true);
    expect(node.data.retryOnFail).toBe(true);
    expect(node.data.maxRetries).toBe(5);
  });

  it('builds logistics nodes', () => {
    expect(n.cepLookup('CEP').data.type).toBe('cep_lookup');
    expect(n.routeCalculator('Rota').data.type).toBe('route_calculator');
    expect(n.freightCalc('Frete').data.type).toBe('freight_calc');
    expect(n.vehicleCapacityCheck('Cap').data.type).toBe('vehicle_capacity_check');
  });
});

describe('EdgeBuilder', () => {
  beforeEach(() => resetNodeIds());

  it('chains nodes 1→2→3', () => {
    const a = n.code('a', 'return 1');
    const b = n.code('b', 'return 2');
    const c = n.code('c', 'return 3');
    const edges = e.chain(a, b, c);
    expect(edges).toHaveLength(2);
    expect(edges[0]).toEqual(expect.objectContaining({ source: a.id, target: b.id }));
    expect(edges[1]).toEqual(expect.objectContaining({ source: b.id, target: c.id }));
  });

  it('link adds sourceHandle when provided', () => {
    const cond = n.condition('?', { conditionField: 'x', conditionOperator: 'equals', conditionValue: 1 });
    const trueNode = n.code('t', '');
    const edge = e.link(cond, trueNode, 'true');
    expect(edge.sourceHandle).toBe('true');
  });
});

describe('WorkflowBuilder', () => {
  beforeEach(() => resetNodeIds());

  it('builds a chained workflow', () => {
    const wf = workflow('Test')
      .description('demo')
      .add(n.httpTrigger('In'))
      .add(n.code('Process', 'return input;'))
      .add(n.respond())
      .chain()
      .build();

    expect(wf.name).toBe('Test');
    expect(wf.description).toBe('demo');
    expect(wf.nodes).toHaveLength(3);
    expect(wf.edges).toHaveLength(2);
  });

  it('branch helper creates true/false sub-chains with handles', () => {
    const builder = workflow('Br');
    builder.add(n.httpTrigger('In'));
    const cond = n.condition('?', { conditionField: 'x', conditionOperator: 'equals', conditionValue: 1 });
    builder.branch(cond,
      [n.code('t1', ''), n.respond('rt')],
      [n.code('f1', ''), n.respond('rf')],
    );
    const wf = builder.build();
    expect(wf.nodes!.length).toBe(6); // 1 trigger + 1 cond + 2 true + 2 false
    const trueEdge = (wf.edges as any[]).find((e: any) => e.sourceHandle === 'true');
    const falseEdge = (wf.edges as any[]).find((e: any) => e.sourceHandle === 'false');
    expect(trueEdge).toBeTruthy();
    expect(falseEdge).toBeTruthy();
  });

  it('edge(from, to, handle) accepts strings or Node refs', () => {
    const a = n.code('a', '');
    const b = n.code('b', '');
    const wf = workflow('e').add(a, b).edge(a, b).build();
    expect(wf.edges).toHaveLength(1);
    expect((wf.edges as any[])[0].source).toBe(a.id);
  });
});
