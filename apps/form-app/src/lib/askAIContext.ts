// apps/form-app/src/lib/askAIContext.ts
//
// Builder-context seeding for the unified Ask-AI drawer. See
// docs/form-builder-redesign.md §2.7 and epic #226 / ticket #232.

import type { FormPage } from '@dculus/types';

export type AskAITab = 'content' | 'logic' | 'automations';

/**
 * Mirrors the store's `Selection` shape (store/types/store.types.ts), plus a
 * resolved `fieldLabel` — the drawer has no reason to look up field labels itself,
 * the caller (which already has the field instance) provides it.
 */
export interface AskAIBuilderSelection {
  kind: 'intro' | 'page' | 'field' | 'thankYou';
  pageId?: string;
  fieldId?: string;
  fieldLabel?: string;
}

export interface AskAIBuilderContext {
  activeTab: AskAITab;
  selection?: AskAIBuilderSelection;
}

export type AskAIContextDetail =
  | { kind: 'none' }
  | { kind: 'intro' }
  | { kind: 'thankYou' }
  | { kind: 'field'; fieldLabel: string }
  | { kind: 'page'; pageTitle: string };

/**
 * Resolves what (if anything) the drawer's context line should show beyond the
 * active tab name. Matches the prototype's `updateAiCtx`: selection detail is only
 * shown while on the Content tab — Logic/Automations show the tab name alone, even
 * though `selection` itself stays populated (rail selection is Content-only state).
 */
export function resolveAskAIContextDetail(
  builderContext: AskAIBuilderContext,
  pages: Pick<FormPage, 'id' | 'title'>[]
): AskAIContextDetail {
  if (builderContext.activeTab !== 'content' || !builderContext.selection) {
    return { kind: 'none' };
  }

  const { selection } = builderContext;
  switch (selection.kind) {
    case 'intro':
      return { kind: 'intro' };
    case 'thankYou':
      return { kind: 'thankYou' };
    case 'field':
      return { kind: 'field', fieldLabel: selection.fieldLabel ?? '' };
    case 'page': {
      const page = pages.find((p) => p.id === selection.pageId);
      return { kind: 'page', pageTitle: page?.title ?? '' };
    }
    default:
      return { kind: 'none' };
  }
}
