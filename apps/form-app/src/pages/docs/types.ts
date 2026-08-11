/**
 * Shared shapes for the "How Dculus Works" architecture docs (`/docs`).
 *
 * A doc page is a Markdown file (authored in `docs/architecture/`, so it stays
 * readable on GitHub and in PR diffs) optionally paired with a diagram defined
 * here. The diagram is the interactive half: every node names the source file it
 * describes, which is what powers the click-to-explain panel — and what the
 * file-reference test asserts still exists.
 */

/**
 * Controls a node's colour and icon. Kept deliberately small — the value of the
 * diagrams is in the arrows, not in a rainbow of node types.
 */
export type DocNodeKind =
  /** Where execution starts. */
  | 'entry'
  /** A check that can reject the request. */
  | 'gate'
  /** A durable write — the point of no return in most flows. */
  | 'write'
  /** Something that happens afterwards and cannot fail the request. */
  | 'effect'
  /** A datastore, queue, or bucket. */
  | 'store'
  /** A third party outside our process. */
  | 'external';

export interface DocNodeData extends Record<string, unknown> {
  /** Short name shown on the node itself. Keep it to a few words. */
  label: string;
  kind: DocNodeKind;
  /** Repo-relative path, e.g. `apps/backend/src/graphql/resolvers/responses.ts`. */
  file?: string;
  /** 1-indexed line the node describes, when there's a specific one. */
  line?: number;
  /** One sentence: what this step does. Shown in the detail panel. */
  does: string;
  /** Optional second sentence: why it works this way, or what to watch out for. */
  note?: string;
  /**
   * Set when this node is a boundary another subsystem depends on. Rendered as
   * a badge on the canvas so cross-subsystem coupling is visible without
   * clicking, and points the reader at the page's "Shared surfaces" section.
   */
  shared?: string;
}

export interface DocDiagramNode {
  id: string;
  data: DocNodeData;
}

export interface DocDiagramEdge {
  source: string;
  target: string;
  /** Drawn on the edge — use for branch labels like "limit set" / "no limit". */
  label?: string;
  /** Dashed + muted. For asynchronous or fire-and-forget hops. */
  async?: boolean;
}

export interface DocDiagram {
  /** `TB` reads as a sequence, `LR` suits fan-outs and layered stacks. */
  direction: 'TB' | 'LR';
  nodes: DocDiagramNode[];
  edges: DocDiagramEdge[];
}

export type DocTier = 'The spine' | 'Feature engines' | 'Cross-cutting';

export interface DocPageMeta {
  /** URL segment: `/docs/{slug}`. */
  slug: string;
  title: string;
  /** One line, shown on the index card. */
  summary: string;
  tier: DocTier;
  /** Basename in `docs/architecture/`, e.g. `01-submission-lifecycle.md`. */
  markdownFile: string;
  /** Reading order within the whole set. */
  order: number;
  /**
   * Heading of the `##` section holding the ASCII diagram, e.g. `The flow`.
   * In the app that section is swapped for the interactive canvas; on GitHub the
   * ASCII version is all there is, so it has to stay in the file.
   */
  diagramSection?: string;
}
