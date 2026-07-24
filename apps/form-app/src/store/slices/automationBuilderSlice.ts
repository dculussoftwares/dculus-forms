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
import type { AutomationEdge, AutomationNode } from '../../components/automations/builder/layout';
import { layoutAutomationGraph } from '../../components/automations/builder/layout';
import type { AutomationNodeData, AutomationNodeType, ValidationErrorEntry } from '../../components/automations/builder/types';

export interface AutomationBuilderState {
  automationId: string | null;
  formTitle: string;
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
    graph: { nodes: any[]; edges: any[] };
    isReadOnly: boolean;
  }) => void;
  setSelectedNodeId: (id: string | null) => void;
  insertStepOnEdge: (edgeId: string, type: AutomationNodeType, data: AutomationNodeData) => string | null;
  updateNodeData: (nodeId: string, data: Partial<AutomationNodeData>) => void;
  removeNode: (nodeId: string) => void;
  setValidationErrors: (errors: ValidationErrorEntry[]) => void;
  clearValidationErrors: () => void;
  markSaved: () => void;
  getSerializableGraph: () => { nodes: any[]; edges: any[] };
  resetBuilder: () => void;
}

const EDGE_TYPE = 'addStep';

const toAutomationEdge = (edge: { id: string; source: string; target: string; sourceHandle?: 'true' | 'false' }): AutomationEdge => ({
  id: edge.id,
  source: edge.source,
  target: edge.target,
  sourceHandle: edge.sourceHandle,
  type: EDGE_TYPE,
});

type Get = () => AutomationBuilderState;
type Set = (partial: Partial<AutomationBuilderState> | ((state: AutomationBuilderState) => Partial<AutomationBuilderState>)) => void;

export const createAutomationBuilderSlice = (set: Set, get: Get): AutomationBuilderState => ({
  automationId: null,
  formTitle: '',
  nodes: [],
  edges: [],
  selectedNodeId: null,
  isDirty: false,
  isReadOnly: false,
  validationErrorsByNode: {},
  structuralErrors: [],

  loadGraph: ({ automationId, formTitle, graph, isReadOnly }) => {
    const nodes: AutomationNode[] = (graph.nodes ?? []).map(
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
    const edges: AutomationEdge[] = (graph.edges ?? []).map(toAutomationEdge);
    const layoutedNodes = layoutAutomationGraph(nodes, edges);

    set({
      automationId,
      formTitle,
      nodes: layoutedNodes,
      edges,
      selectedNodeId: null,
      isDirty: false,
      isReadOnly,
      validationErrorsByNode: {},
      structuralErrors: [],
    });
  },

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  insertStepOnEdge: (edgeId, type, data) => {
    const { nodes, edges } = get();
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
    const edgeOut: AutomationEdge = {
      id: generateId(),
      source: newNodeId,
      target: edge.target,
      type: EDGE_TYPE,
    };

    const nextNodes = [...nodes, newNode];
    const nextEdges = [...remainingEdges, edgeIn, edgeOut];
    const layoutedNodes = layoutAutomationGraph(nextNodes, nextEdges);

    set({
      nodes: layoutedNodes,
      edges: nextEdges,
      selectedNodeId: newNodeId,
      isDirty: true,
    });

    return newNodeId;
  },

  updateNodeData: (nodeId, data) => {
    const { nodes } = get();
    set({
      nodes: nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } as AutomationNodeData } : n
      ),
      isDirty: true,
    });
  },

  removeNode: (nodeId) => {
    const { nodes, edges, selectedNodeId } = get();
    const incoming = edges.find((e) => e.target === nodeId);
    const outgoing = edges.find((e) => e.source === nodeId);

    const remainingEdges = edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
    if (incoming && outgoing) {
      remainingEdges.push({
        id: generateId(),
        source: incoming.source,
        target: outgoing.target,
        sourceHandle: incoming.sourceHandle,
        type: EDGE_TYPE,
      });
    }

    const remainingNodes = nodes.filter((n) => n.id !== nodeId);
    const layoutedNodes = layoutAutomationGraph(remainingNodes, remainingEdges);

    set((state) => {
      const restErrors = Object.fromEntries(
        Object.entries(state.validationErrorsByNode).filter(([id]) => id !== nodeId)
      );
      return {
        nodes: layoutedNodes,
        edges: remainingEdges,
        selectedNodeId: selectedNodeId === nodeId ? null : selectedNodeId,
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

  markSaved: () => set({ isDirty: false }),

  getSerializableGraph: () => {
    const { nodes, edges } = get();
    return {
      nodes: nodes.map((n) => ({ id: n.id, type: n.type, data: n.data })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}),
      })),
    };
  },

  resetBuilder: () =>
    set({
      automationId: null,
      formTitle: '',
      nodes: [],
      edges: [],
      selectedNodeId: null,
      isDirty: false,
      isReadOnly: false,
      validationErrorsByNode: {},
      structuralErrors: [],
    }),
});
