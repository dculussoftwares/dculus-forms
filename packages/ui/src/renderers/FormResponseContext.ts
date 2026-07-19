import { createContext, useContext } from 'react';
import type { FormSchema } from '@dculus/types';
import type { RendererMode } from '@dculus/utils';

export interface ResponseCopySettings {
  enabled: boolean;
  mode: 'always' | 'respondentChoice';
}

// Context for sharing form response state throughout the form.
// Lives in its own module so consumers deep in the renderer chain
// (PageRenderer, SinglePageForm) don't import FormRenderer and close a
// circular module dependency (FormRenderer → LayoutRenderer → PageRenderer).
export interface FormResponseContextValue {
  formSchema?: FormSchema;
  mode: RendererMode;
  onFormSubmit?: (formId: string, responses: Record<string, any>) => void;
  onResponseUpdate?: (responseId: string, responses: Record<string, any>) => void;
  formId?: string;
  responseId?: string;
  responseCopySettings?: ResponseCopySettings;
  onResponseCopyConsentChange?: (consent: boolean) => void;
  // Conditional logic — one evaluation shared by rendering, validation,
  // navigation, and submit (docs/conditional-logic-v1-strategy.md §3.1)
  hiddenFieldIds: ReadonlySet<string>;
  hiddenPageIds: ReadonlySet<string>;
  getHiddenFieldIds: () => ReadonlySet<string>;
  // Conditional required/unrequired overrides (v2)
  requiredOverrides: ReadonlyMap<string, boolean>;
  getRequiredOverrides: () => ReadonlyMap<string, boolean>;
}

export const FormResponseContext = createContext<FormResponseContextValue | null>(null);

export const useFormResponseContext = () => {
  const context = useContext(FormResponseContext);
  if (!context) {
    throw new Error('useFormResponseContext must be used within a FormRenderer');
  }
  return context;
};
