import type * as React from 'react';

/** Class every renderer root carries; all bundled styles are scoped to it. */
export declare const SCOPE_CLASS: 'dculus-form-renderer';

/**
 * The parts of a stored form schema the preview relies on. Extra keys are
 * fine at runtime; Dculus' own FormSchema type is assignable to this.
 */
export interface TemplateFormSchema {
  pages: ReadonlyArray<{ id: string; fields: readonly unknown[] }>;
  layout: object;
}

export interface TemplatePreviewProps {
  formSchema: TemplateFormSchema;
  /** Public CDN base URL — layout background keys are resolved against it. */
  cdnEndpoint?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Open on this page instead of the first one. */
  initialPageId?: string;
  /** Called when the visitor presses Submit. Nothing is ever submitted. */
  onSubmitAttempt?: () => void;
}

/** True when `value` has the pages/layout shape TemplatePreview can render. */
export declare function isTemplateFormSchema(value: unknown): value is TemplateFormSchema;

/**
 * Read-only, fully interactive preview of a form. Renders nothing for a schema
 * it can't read. Import '@dculus/form-renderer/style.css' once.
 */
export declare function TemplatePreview(props: TemplatePreviewProps): React.ReactElement | null;
