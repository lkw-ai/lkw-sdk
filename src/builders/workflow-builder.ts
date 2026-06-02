/**
 * Fluent workflow builder. Wraps NodeBuilder so you can construct a full
 * workflow definition programmatically:
 *
 *   import { workflow, n } from '@lkw-ai/sdk';
 *
 *   const wf = workflow('Cadastro Cliente')
 *     .description('Onboarding cliente novo via webhook')
 *     .add(n.httpTrigger('Receber'))
 *     .add(n.code('Validar', `return input.body;`))
 *     .add(n.apiCall('Enriquecer', { url: 'https://...' }))
 *     .add(n.respond())
 *     .chain()
 *     .build();
 *
 *   // POST to LKW:
 *   await lkw.workflows.create(projectId, wf);
 *
 * Builder methods:
 *   - .add(...nodes)            push 1+ nodes
 *   - .edge(from, to, handle?)  manual edge
 *   - .chain()                  auto-link all added nodes 1→2→...→N
 *   - .branch(condition, true, false)  helper for if/else split
 *   - .build()                  freezes and returns { name, description, nodes, edges }
 */
import type { Node, Edge } from './node-builder.js';
import { e } from './node-builder.js';
import type { CreateWorkflowInput } from '../resources/workflows.js';

export class WorkflowBuilder {
  private _name: string;
  private _description?: string;
  private _nodes: Node[] = [];
  private _edges: Edge[] = [];

  constructor(name: string) {
    this._name = name;
  }

  description(d: string): this {
    this._description = d;
    return this;
  }

  rename(name: string): this {
    this._name = name;
    return this;
  }

  add(...nodes: Node[]): this {
    this._nodes.push(...nodes);
    return this;
  }

  edge(from: Node | string, to: Node | string, sourceHandle?: string): this {
    const fromId = typeof from === 'string' ? from : from.id;
    const toId = typeof to === 'string' ? to : to.id;
    this._edges.push({
      id: `e${fromId}-${toId}${sourceHandle ? '_' + sourceHandle : ''}`,
      type: 'smoothstep',
      source: fromId,
      target: toId,
      ...(sourceHandle ? { sourceHandle } : {}),
    });
    return this;
  }

  /** Auto-edge all nodes already added in order: 1→2→...→N. */
  chain(): this {
    this._edges.push(...e.chain(...this._nodes));
    return this;
  }

  /**
   * Branch helper: condition node routes to `trueChain[0]` on true and
   * `falseChain[0]` on false; both chains are auto-linked internally.
   * Returns the branch endpoints so you can keep building after the merge.
   */
  branch(condition: Node, trueChain: Node[], falseChain: Node[]): { trueEnd: Node; falseEnd: Node } {
    this._nodes.push(condition, ...trueChain, ...falseChain);
    if (trueChain.length > 0) {
      this._edges.push({ id: `e${condition.id}-${trueChain[0].id}`, type: 'smoothstep', source: condition.id, target: trueChain[0].id, sourceHandle: 'true' });
      this._edges.push(...e.chain(...trueChain));
    }
    if (falseChain.length > 0) {
      this._edges.push({ id: `e${condition.id}-${falseChain[0].id}`, type: 'smoothstep', source: condition.id, target: falseChain[0].id, sourceHandle: 'false' });
      this._edges.push(...e.chain(...falseChain));
    }
    return {
      trueEnd: trueChain[trueChain.length - 1] ?? condition,
      falseEnd: falseChain[falseChain.length - 1] ?? condition,
    };
  }

  build(): CreateWorkflowInput {
    return {
      name: this._name,
      description: this._description,
      nodes: this._nodes,
      edges: this._edges,
    };
  }

  /** Snapshot helpers (useful for tests/debug) */
  get nodes(): Node[] { return [...this._nodes]; }
  get edges(): Edge[] { return [...this._edges]; }
}

/** Shortcut: `workflow('name')` → builder. */
export function workflow(name: string): WorkflowBuilder {
  return new WorkflowBuilder(name);
}
