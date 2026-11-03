import type * as React from 'react';

/** Class every renderer root carries; all bundled styles are scoped to it. */
export declare const SCOPE_CLASS: 'dculus-form-renderer';

export declare enum RendererMode {
  PREVIEW = 'PREVIEW',
  BUILDER = 'BUILDER',
  SUBMISSION = 'SUBMISSION',
  EDIT = 'EDIT',
}

export interface TemplatePreviewProps {
  /** A form/template schema as stored (plain JSON) or already deserialized. */
  formSchema: unknown;
  /** Public CDN base URL — layout background keys are resolved against it. */
  cdnEndpoint?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Open on this page instead of the first one. */
  initialPageId?: string;
  /** Called when the visitor presses Submit. Nothing is ever submitted. */
  onSubmitAttempt?: () => void;
}

/** Read-only, fully interactive preview of a form. Import '@dculus/form-renderer/style.css' once. */
export declare function TemplatePreview(props: TemplatePreviewProps): React.ReactElement | null;

/** Low-level renderer, for advanced use. Wrap it in an element with SCOPE_CLASS. */
export declare const FormRenderer: React.FC<Record<string, unknown> & { formSchema?: unknown; mode: RendererMode }>;

/** Turn a stored (plain JSON) schema into the renderer's field classes. */
export declare function deserializeFormSchema(schema: unknown): unknown;
