import './styles.css';
import React, { useMemo } from 'react';
// Deep import (not the @dculus/ui barrel) so the rest of the UI kit isn't bundled.
import { FormRenderer } from '../../ui/src/renderers/FormRenderer';
import { RendererMode } from '@dculus/utils';
import { deserializeFormSchema, type FormSchema } from '@dculus/types';

export { FormRenderer, RendererMode, deserializeFormSchema };

/** Class every renderer root carries; all bundled styles are scoped to it. */
export const SCOPE_CLASS = 'dculus-form-renderer';

export interface TemplatePreviewProps {
  /** A form/template schema as stored (plain JSON) or already deserialized. */
  formSchema: unknown;
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

/**
 * Read-only, fully interactive preview of a form: visitors can type, choose,
 * page through and press Submit, but nothing is submitted.
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
    try {
      return deserializeFormSchema(formSchema as any);
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
