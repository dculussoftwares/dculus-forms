import './styles.css';
import React, { useMemo } from 'react';
// Deep import (not the @dculus/ui barrel) so the rest of the UI kit isn't bundled.
import { FormRenderer } from '../../ui/src/renderers/FormRenderer';
import { RendererMode } from '@dculus/utils';
import { deserializeFormSchema, type FormSchema } from '@dculus/types';

/** Class every renderer root carries; all bundled styles are scoped to it. */
export const SCOPE_CLASS = 'dculus-form-renderer';

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
  /**
   * Called when the visitor presses Submit. Nothing is ever sent anywhere —
   * use it to show a call to action ("Use this template").
   */
  onSubmitAttempt?: () => void;
}

/** Shape check at the package boundary: callers may pass any JSON at runtime. */
export function isTemplateFormSchema(value: unknown): value is TemplateFormSchema {
  if (!value || typeof value !== 'object') return false;
  const schema = value as Record<string, unknown>;
  return (
    Array.isArray(schema.pages) &&
    schema.pages.length > 0 &&
    schema.pages.every((p) => p && typeof p === 'object' && Array.isArray((p as { fields?: unknown }).fields)) &&
    !!schema.layout &&
    typeof schema.layout === 'object' &&
    !Array.isArray(schema.layout)
  );
}

/**
 * Read-only, fully interactive preview of a form: visitors can type, choose,
 * page through and press Submit, but nothing is submitted. Renders nothing for
 * a schema it can't read.
 */
export function TemplatePreview({
  formSchema,
  cdnEndpoint,
  className,
  style,
  initialPageId,
  onSubmitAttempt,
}: TemplatePreviewProps) {
  const schema = useMemo<FormSchema | null>(() => {
    if (!isTemplateFormSchema(formSchema)) return null;
    try {
      return deserializeFormSchema(formSchema as never);
    } catch {
      return null;
    }
  }, [formSchema]);

  if (!schema) return null;

  return (
    <div className={className ? `${SCOPE_CLASS} ${className}` : SCOPE_CLASS} style={style}>
      <FormRenderer
        formSchema={schema}
        cdnEndpoint={cdnEndpoint}
        mode={RendererMode.PREVIEW}
        // The renderer only reports a submit when it has a form id; nothing is sent.
        formId="template-preview"
        initialPageId={initialPageId}
        onFormSubmit={() => {
          onSubmitAttempt?.();
        }}
      />
    </div>
  );
}
