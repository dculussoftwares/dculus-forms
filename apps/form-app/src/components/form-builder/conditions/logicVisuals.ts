/**
 * Shared visual vocabulary for the Logic workspace.
 *
 * Two jobs:
 *  1. Resolve a rule's raw fieldId/pageId references into renderable descriptors
 *     (label, page number, field-type icon) — or mark them as dangling, so every
 *     surface (rule card, inspector, health panel) reports a deleted reference
 *     the same way.
 *  2. Map action types onto semantic colour roles, so `show`/`require` (additive),
 *     `hide`/`unrequire` (subtractive) and `skipToPage` (navigational) are
 *     distinguishable at a glance instead of rendering as identical grey text.
 *
 * Colours are `--tf-*` tokens from packages/ui/src/styles/globals.css — the same
 * palette the Content workspace uses. No new palette is introduced here.
 */

import { ConditionAction, ConditionalRule, FormField, FormPage } from '@dculus/types';
import { getFieldTypeConfig, getCategoryColor } from '../shared/fieldTypeVisuals';
import { fieldDisplayLabel } from './conditionFieldConfig';

// ─────────────────────────────────────────────────────────────────────────────
// Reference resolution
// ─────────────────────────────────────────────────────────────────────────────

export interface FieldRef {
  kind: 'field';
  id: string;
  /** Missing = the field was deleted while a rule still points at it. */
  missing: boolean;
  label: string;
  /** 1-based page number, or null when the field is missing. */
  pageNumber: number | null;
  field: FormField | null;
}

export interface PageRef {
  kind: 'page';
  id: string;
  missing: boolean;
  label: string;
  pageNumber: number | null;
}

/**
 * Single-pass index over the schema. Built once per render in the workspace and
 * threaded down, so cards don't each rebuild a Map over every page/field.
 */
export interface LogicIndex {
  fieldById: Map<string, { field: FormField; pageNumber: number; pageId: string }>;
  pageById: Map<string, { page: FormPage; pageNumber: number }>;
}

export const buildLogicIndex = (pages: FormPage[]): LogicIndex => {
  const fieldById = new Map<string, { field: FormField; pageNumber: number; pageId: string }>();
  const pageById = new Map<string, { page: FormPage; pageNumber: number }>();
  pages.forEach((page, index) => {
    pageById.set(page.id, { page, pageNumber: index + 1 });
    page.fields.forEach((field) => {
      fieldById.set(field.id, { field, pageNumber: index + 1, pageId: page.id });
    });
  });
  return { fieldById, pageById };
};

export const resolveFieldRef = (
  index: LogicIndex,
  fieldId: string,
  missingLabel: string
): FieldRef => {
  const entry = index.fieldById.get(fieldId);
  if (!entry) {
    return { kind: 'field', id: fieldId, missing: true, label: missingLabel, pageNumber: null, field: null };
  }
  return {
    kind: 'field',
    id: fieldId,
    missing: false,
    label: fieldDisplayLabel(entry.field),
    pageNumber: entry.pageNumber,
    field: entry.field,
  };
};

export const resolvePageRef = (
  index: LogicIndex,
  pageId: string,
  missingLabel: string,
  untitledLabel: (n: number) => string
): PageRef => {
  const entry = index.pageById.get(pageId);
  if (!entry) {
    return { kind: 'page', id: pageId, missing: true, label: missingLabel, pageNumber: null };
  }
  return {
    kind: 'page',
    id: pageId,
    missing: false,
    label: entry.page.title?.trim() || untitledLabel(entry.pageNumber),
    pageNumber: entry.pageNumber,
  };
};

/** Field-type icon + pastel tile class, reusing the Content workspace's mapping. */
export const fieldVisual = (field: FormField | null) => {
  const config = getFieldTypeConfig(field?.type ?? '');
  return { Icon: config.icon, tileClass: getCategoryColor(config.category), typeLabel: config.label };
};

// ─────────────────────────────────────────────────────────────────────────────
// Action semantics
// ─────────────────────────────────────────────────────────────────────────────

export type ActionTone = 'additive' | 'subtractive' | 'navigational';

export const ACTION_TONE: Record<ConditionAction['type'], ActionTone> = {
  showField: 'additive',
  requireField: 'additive',
  showPage: 'additive',
  hideField: 'subtractive',
  unrequireField: 'subtractive',
  hidePage: 'subtractive',
  skipToPage: 'navigational',
};

/** Verb-pill classes per tone. Light + dark, both explicitly defined. */
export const actionToneClass = (tone: ActionTone): string => {
  switch (tone) {
    case 'additive':
      return 'bg-[var(--tf-green-bg)] text-[var(--tf-green)] border-[var(--tf-green-bg-md)] dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900';
    case 'subtractive':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900';
    case 'navigational':
      return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900';
  }
};

/** Every field id an action targets (empty for page actions). */
export const actionFieldIds = (action: ConditionAction): string[] =>
  'fieldIds' in action ? action.fieldIds : [];

/** The page id an action targets, or null for field actions. */
export const actionPageId = (action: ConditionAction): string | null =>
  'pageId' in action ? action.pageId : null;

/** Distinct action types present on a rule — drives the rail's action-type filter. */
export const ruleActionTypes = (rule: ConditionalRule): ConditionAction['type'][] =>
  Array.from(new Set(rule.actions.map((action) => action.type)));

/**
 * The page a rule is "anchored" to for grouping purposes: the page of its first
 * resolvable trigger field. Rules whose triggers are all deleted return null and
 * group under "unassigned".
 */
export const ruleTriggerPageId = (rule: ConditionalRule, index: LogicIndex): string | null => {
  for (const term of rule.terms) {
    const entry = index.fieldById.get(term.fieldId);
    if (entry) return entry.pageId;
  }
  return null;
};
