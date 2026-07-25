/**
 * Automation Builder Slice
 *
 * Owns the React Flow controlled nodes/edges for the automation canvas (#197), plus
 * builder-only UI state (selection, dirty flag, server validation errors). Lives in its
 * own store (useAutomationBuilderStore) rather than the form-builder store — automations
 * are a single-editor, last-write-wins feature with no Y.js sync, so there's no reason to
 * share state with the collaborative form-builder slices.
 *
 * Nodes are never user-draggable: every structural mutation (insert/remove/load) re-runs
 * dagre's TB auto-layout so the canvas always reads top-to-bottom.
 */

import { generateId } from '@dculus/utils';
import type { FillableFormField } from '@dculus/types';
import type { AutomationEdge, AutomationNode } from '../../components/automations/builder/layout';
import { layoutAutomationGraph } from '../../components/automations/builder/layout';
import type { AutomationNodeData, AutomationNodeType, ValidationErrorEntry } from '../../components/automations/builder/types';
import {
  clearDraftGraph,
  persistDraftGraph,
  persistSelectedNodeId,
  readDraftGraph,
  readSelectedNodeId,
  type SerializedGraph,
} from '../../components/automations/builder/draftStorage';

export interface AutomationBuilderState {
  automationId: string | null;
  formTitle: string;
  /** Fillable fields from the form schema — powers the condition rule editor's field picker
   * and the ConditionNode summary card. Loaded once alongside the graph (#200). */
  formFields: FillableFormField[];
  /** The automation's triggerType — read-only mirror of Automation.triggerType (#201), not
   * part of the graph nodes/edges. Never changes after creation, so it's loaded once here
   * for the TriggerNode/config panel rather than re-fetched from `automation` every render. */
  triggerType: string;
  /** Mirror of Automation.triggerConfig (#201) — e.g. { cron, timezone } for schedule
   * automations. Saved immediately via its own updateAutomation call (like rename), not
   * through the graph save/dirty flow, so it's kept separate from nodes/edges here. */
  triggerConfig: Record<string, any> | null;
  nodes: AutomationNode[];
  edges: AutomationEdge[];
  selectedNodeId: string | null;
  isDirty: boolean;
  isReadOnly: boolean;
  validationErrorsByNode: Record<string, ValidationErrorEntry[]>;
  structuralErrors: ValidationErrorEntry[];

  loadGraph: (params: {
    automationId: string;
    formTitle: string;
    formFields?: FillableFormField[];
    triggerType: string;
    triggerConfig?: Record<string, any> | null;
    graph: { nodes: any[]; edges: any[] };
    isReadOnly: boolean;
  }) => void;
  setSelectedNodeId: (id: string | null) => void;
  /** Re-runs dagre layout using each node's actual rendered size (reported by React
   * Flow's `onNodesChange` as 'dimensions' change events — see AutomationCanvas.tsx) in
   * place of the type-based `DEFAULT_DIMENSIONS` fallback that layout otherwise assumes
   * before first paint. Node label text length varies per node (condition rule
   * summaries, i18n — form-app ships English and Tamil) so the fallback is frequently
   * wrong; without this correction, edges terminate at a dagre-assumed center that
   * doesn't match where the node's handle actually renders, producing a visible kink
   * right before the node. No-ops if neither positions nor edge bend routes would
   * meaningfully change, so it's safe to call on every dimensions event. */
  applyMeasuredLayout: (measuredNodes: { id: string; width?: number; height?: number }[]) => void;
  insertStepOnEdge: (edgeId: string, type: AutomationNodeType, data: AutomationNodeData) => string | null;
  updateNodeData: (nodeId: string, data: Partial<AutomationNodeData>) => void;
  removeNode: (nodeId: string) => void;
  setValidationErrors: (errors: ValidationErrorEntry[]) => void;
  clearValidationErrors: () => void;
  markSaved: () => void;
  getSerializableGraph: () => SerializedGraph;
  /** Clears the session draft/selection for the current automation — called when the user explicitly discards unsaved changes. */
  discardDraft: () => void;
  /** Updates the local triggerConfig mirror after a successful updateAutomation save (#201). */
  setTriggerConfig: (triggerConfig: Record<string, any> | null) => void;
}

const EDGE_TYPE = 'addStep';

const toAutomationEdge = (edge: { id: string; source: string; target: string; sourceHandle?: 'true' | 'false' }): AutomationEdge => ({
  id: edge.id,
  source: edge.source,
  target: edge.target,
  sourceHandle: edge.sourceHandle,
  type: EDGE_TYPE,
});

const serializeGraph = (nodes: AutomationNode[], edges: AutomationEdge[]): SerializedGraph => ({
  nodes: nodes.map((n) => ({ id: n.id, type: n.type as string, data: n.data })),
  edges: edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    ...(e.sourceHandle ? { sourceHandle: e.sourceHandle as 'true' | 'false' } : {}),
  })),
});

/**
 * Walks forward from `startId` collecting every node reachable via outgoing edges, stopping
 * at (and excluding) `endNodeId` — the graph's shared terminal node — and at nodes already
 * visited. Used by removeNode's condition branch-keep convention: everything strictly
 * downstream of a discarded branch's first node belongs exclusively to that branch (this
 * builder only ever inserts linear extensions per branch, never merges branches back
 * together before End), so it's safe to delete the whole subtree in one pass.
 */
function collectDownstreamNodeIds(
  startId: string,
  edges: AutomationEdge[],
  endNodeId: string | undefined,
  visited: Set<string>
): void {
  if (startId === endNodeId || visited.has(startId)) return;
  visited.add(startId);
  for (const edge of edges) {
    if (edge.source === startId) collectDownstreamNodeIds(edge.target, edges, endNodeId, visited);
  }
}

type Get = () => AutomationBuilderState;
type SetState = (partial: Partial<AutomationBuilderState> | ((state: AutomationBuilderState) => Partial<AutomationBuilderState>)) => void;

export const createAutomationBuilderSlice = (set: SetState, get: Get): AutomationBuilderState => ({
  automationId: null,
  formTitle: '',
  formFields: [],
  triggerType: 'form.submitted',
  triggerConfig: null,
  nodes: [],
  edges: [],
  selectedNodeId: null,
  isDirty: false,
  isReadOnly: false,
  validationErrorsByNode: {},
  structuralErrors: [],

  loadGraph: ({ automationId, formTitle, formFields, triggerType, triggerConfig, graph, isReadOnly }) => {
    // A session draft (see draftStorage.ts) means there are unsaved edits that survived a
    // same-tab reload — e.g. the full-page OAuth redirect from a Google/Microsoft Sheets
    // "Connect" click. Prefer it over the server's last-Saved graph when present.
    const draft = readDraftGraph(automationId);
    const sourceNodes = draft?.nodes ?? graph.nodes ?? [];
    const sourceEdges = draft?.edges ?? graph.edges ?? [];

    const nodes: AutomationNode[] = sourceNodes.map(
      (n: any) =>
        ({
          id: n.id,
          type: n.type,
          data: n.data ?? {},
          position: { x: 0, y: 0 },
          draggable: false,
          connectable: false,
          deletable: false,
        }) as AutomationNode
    );
    const edges: AutomationEdge[] = sourceEdges.map(toAutomationEdge);
    const { nodes: layoutedNodes, edges: layoutedEdges } = layoutAutomationGraph(nodes, edges);

    const restoredSelection = readSelectedNodeId(automationId);
    const selectedNodeId = restoredSelection && nodes.some((n) => n.id === restoredSelection) ? restoredSelection : null;

    set({
      automationId,
      formTitle,
      formFields: formFields ?? [],
      triggerType,
      triggerConfig: triggerConfig ?? null,
      nodes: layoutedNodes,
      edges: layoutedEdges,
      selectedNodeId,
      isDirty: Boolean(draft),
      isReadOnly,
      validationErrorsByNode: {},
      structuralErrors: [],
    });
  },

  setSelectedNodeId: (id) => {
    const { automationId } = get();
    if (automationId) persistSelectedNodeId(automationId, id);
    set({ selectedNodeId: id });
  },

  applyMeasuredLayout: (measuredNodes) => {
    const { nodes, edges } = get();
    const measuredById = new Map(measuredNodes.map((n) => [n.id, n]));

    const nodesWithMeasured = nodes.map((node) => {
      const measured = measuredById.get(node.id);
      return measured?.width && measured?.height
        ? { ...node, measured: { width: measured.width, height: measured.height } }
        : node;
    });

    const { nodes: layoutedNodes, edges: layoutedEdges } = layoutAutomationGraph(nodesWithMeasured, edges);

    const positionsChanged = layoutedNodes.some((node, i) => {
      const prev = nodes[i];
      return Math.abs(node.position.x - prev.position.x) > 0.5 || Math.abs(node.position.y - prev.position.y) > 0.5;
    });
    // A rank-skipping edge's curve is derived from spacer-node positions (see layout.ts),
    // which aren't part of `layoutedNodes` — a dimension change can shift a spacer enough
    // to change a route without moving any *real* node past the position-change threshold
    // above, so bend routes need their own comparison rather than piggybacking on it.
    const bendRoutesChanged = layoutedEdges.some((edge, i) => {
      const prev = edges[i];
      return JSON.stringify(edge.data?.bendPoints) !== JSON.stringify(prev?.data?.bendPoints);
    });
    if (!positionsChanged && !bendRoutesChanged) return;

    set({ nodes: layoutedNodes, edges: layoutedEdges });
  },

  insertStepOnEdge: (edgeId, type, data) => {
    const { nodes, edges, automationId } = get();
    const edge = edges.find((e) => e.id === edgeId);
    if (!edge) return null;

    const newNodeId = generateId();
    const newNode: AutomationNode = {
      id: newNodeId,
      type,
      data,
      position: { x: 0, y: 0 },
      draggable: false,
      connectable: false,
      deletable: false,
    };

    const remainingEdges = edges.filter((e) => e.id !== edgeId);
    const edgeIn: AutomationEdge = {
      id: generateId(),
      source: edge.source,
      target: newNodeId,
      sourceHandle: edge.sourceHandle,
      type: EDGE_TYPE,
    };

    let nextEdges: AutomationEdge[];
    if (type === 'condition') {
      // Inserting a condition on an edge attaches the previous successor (the edge's old
      // target) to the `true` branch; the `false` branch is created empty, wired straight to
      // the graph's single End node (#200) — there's always exactly one, created by
      // buildDefaultGraph on the backend and never user-deletable (see EndNode.tsx). Fail
      // loudly rather than silently wiring the false branch to the old successor too — that
      // would make the branch inert without any visible error.
      const endNode = nodes.find((n) => n.type === 'end');
      if (!endNode) {
        throw new Error('insertStepOnEdge(condition): graph has no End node to wire the false branch to');
      }
      const trueEdge: AutomationEdge = {
        id: generateId(),
        source: newNodeId,
        target: edge.target,
        sourceHandle: 'true',
        type: EDGE_TYPE,
      };
      const falseEdge: AutomationEdge = {
        id: generateId(),
        source: newNodeId,
        target: endNode.id,
        sourceHandle: 'false',
        type: EDGE_TYPE,
      };
      nextEdges = [...remainingEdges, edgeIn, trueEdge, falseEdge];
    } else {
      const edgeOut: AutomationEdge = {
        id: generateId(),
        source: newNodeId,
        target: edge.target,
        type: EDGE_TYPE,
      };
      nextEdges = [...remainingEdges, edgeIn, edgeOut];
    }

    const nextNodes = [...nodes, newNode];
    const { nodes: layoutedNodes, edges: layoutedEdges } = layoutAutomationGraph(nextNodes, nextEdges);

    if (automationId) {
      persistDraftGraph(automationId, serializeGraph(layoutedNodes, layoutedEdges));
      persistSelectedNodeId(automationId, newNodeId);
    }

    set({
      nodes: layoutedNodes,
      edges: layoutedEdges,
      selectedNodeId: newNodeId,
      isDirty: true,
    });

    return newNodeId;
  },

  updateNodeData: (nodeId, data) => {
    const { nodes, edges, automationId } = get();
    const nextNodes = nodes.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, ...data } as AutomationNodeData } : n
    );

    if (automationId) {
      persistDraftGraph(automationId, serializeGraph(nextNodes, edges));
    }

    set({
      nodes: nextNodes,
      isDirty: true,
    });
  },

  removeNode: (nodeId) => {
    const { nodes, edges, selectedNodeId, automationId } = get();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    let remainingNodes: AutomationNode[];
    let remainingEdges: AutomationEdge[];
    const deletedNodeIds = new Set<string>([nodeId]);

    if (node.type === 'condition') {
      // Branch-keep convention (#200): deleting a condition node always keeps the `true`
      // branch's continuation (falling back to `false` if a `true` edge was never wired)
      // and discards the other branch's entire subtree, rather than prompting the user —
      // matches the issue's documented "keep true branch by convention" option. Tested in
      // automationBuilderSlice.test.ts.
      const incoming = edges.find((e) => e.target === nodeId);
      const trueEdge = edges.find((e) => e.source === nodeId && e.sourceHandle === 'true');
      const falseEdge = edges.find((e) => e.source === nodeId && e.sourceHandle === 'false');
      const keptEdge = trueEdge ?? falseEdge;
      const discardedEdge = keptEdge === trueEdge ? falseEdge : undefined;

      const endNodeId = nodes.find((n) => n.type === 'end')?.id;
      if (discardedEdge) {
        collectDownstreamNodeIds(discardedEdge.target, edges, endNodeId, deletedNodeIds);
      }

      const survivingEdges = edges.filter(
        (e) => e.source !== nodeId && e.target !== nodeId && !deletedNodeIds.has(e.source) && !deletedNodeIds.has(e.target)
      );
      if (incoming && keptEdge) {
        survivingEdges.push({
          id: generateId(),
          source: incoming.source,
          target: keptEdge.target,
          sourceHandle: incoming.sourceHandle,
          type: EDGE_TYPE,
        });
      }

      remainingEdges = survivingEdges;
      remainingNodes = nodes.filter((n) => !deletedNodeIds.has(n.id));
    } else {
      const incoming = edges.find((e) => e.target === nodeId);
      const outgoing = edges.find((e) => e.source === nodeId);

      remainingEdges = edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
      if (incoming && outgoing) {
        remainingEdges.push({
          id: generateId(),
          source: incoming.source,
          target: outgoing.target,
          sourceHandle: incoming.sourceHandle,
          type: EDGE_TYPE,
        });
      }

      remainingNodes = nodes.filter((n) => n.id !== nodeId);
    }

    const { nodes: layoutedNodes, edges: layoutedEdges } = layoutAutomationGraph(remainingNodes, remainingEdges);
    const nextSelectedNodeId = deletedNodeIds.has(selectedNodeId ?? '') ? null : selectedNodeId;

    if (automationId) {
      persistDraftGraph(automationId, serializeGraph(layoutedNodes, layoutedEdges));
      persistSelectedNodeId(automationId, nextSelectedNodeId);
    }

    set((state) => {
      const restErrors = Object.fromEntries(
        Object.entries(state.validationErrorsByNode).filter(([id]) => !deletedNodeIds.has(id))
      );
      return {
        nodes: layoutedNodes,
        edges: layoutedEdges,
        selectedNodeId: nextSelectedNodeId,
        isDirty: true,
        validationErrorsByNode: restErrors,
      };
    });
  },

  setValidationErrors: (errors) => {
    const byNode: Record<string, ValidationErrorEntry[]> = {};
    const structural: ValidationErrorEntry[] = [];
    for (const err of errors) {
      if (err.nodeId) {
        byNode[err.nodeId] = [...(byNode[err.nodeId] ?? []), err];
      } else {
        structural.push(err);
      }
    }
    set({ validationErrorsByNode: byNode, structuralErrors: structural });
  },

  clearValidationErrors: () => set({ validationErrorsByNode: {}, structuralErrors: [] }),

  markSaved: () => {
    // The server now matches local state — the session draft (if any) is stale, drop it so
    // a later reload restores from the server graph again instead of this now-redundant copy.
    const { automationId } = get();
    if (automationId) clearDraftGraph(automationId);
    set({ isDirty: false });
  },

  getSerializableGraph: () => {
    const { nodes, edges } = get();
    return serializeGraph(nodes, edges);
  },

  discardDraft: () => {
    const { automationId } = get();
    if (automationId) {
      clearDraftGraph(automationId);
      persistSelectedNodeId(automationId, null);
    }
  },

  setTriggerConfig: (triggerConfig) => set({ triggerConfig }),
});
