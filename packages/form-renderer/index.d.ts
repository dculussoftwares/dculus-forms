import type * as React from 'react';

/** Class every renderer root carries; all bundled styles are scoped to it. */
export declare const SCOPE_CLASS: 'dculus-form-renderer';

/** A form/template schema as stored by Dculus Forms (plain JSON). */
export interface TemplateFormSchema {
  pages: Array<{ id: string; title?: string; fields: unknown[]; [key: string]: unknown }>;
  layout: { [key: string]: unknown };
  isShuffleEnabled?: boolean;
  [key: string]: unknown;
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
