import './styles.css';
import React, { useMemo } from 'react';
// Deep import (not the @dculus/ui barrel) so the rest of the UI kit isn't bundled.
import { FormRenderer } from '../../ui/src/renderers/FormRenderer';
import { RendererMode } from '@dculus/utils';
import { deserializeFormSchema, type FormSchema } from '@dculus/types';
import { z } from 'zod';

/** Class every renderer root carries; all bundled styles are scoped to it. */
export const SCOPE_CLASS = 'dculus-form-renderer';

/**
 * The parts of a stored form schema the preview relies on. Extra keys are
 * fine at runtime; Dculus' own FormSchema type is assignable to this.
 */
export interface TemplateFormSchema {
  pages: ReadonlyArray<{ id: string; fields: readonly unknown[] }>;
  layout: object;
}

const templateFormSchema = z.object({
  pages: z.array(z.object({ id: z.string().min(1), fields: z.array(z.unknown()) })).min(1),
  layout: z.record(z.string(), z.unknown()),
});

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
  return templateFormSchema.safeParse(value).success;
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
