/**
 * @fileoverview Shared AI types for the dculus-forms monorepo.
 *
 * These types are used by backend routes/services and can be consumed by
 * frontend apps (e.g., for displaying AI usage stats or intent badges).
 * Import via: import type { ... } from '@dculus/types/ai.js'
 */

// ─── Intent / Model Routing ───────────────────────────────────────────────────

/**
 * The intent tier inferred from the user's message.
 * - 'complex'  → multi-step restructure, page merge, bulk transform
 * - 'simple'   → single field add/edit/delete, rename, reorder
 * - 'question' → informational query, no form mutation needed
 */
export type IntentTier = 'complex' | 'simple' | 'question';

/**
 * Which model tier handles the request.
 * - 'mini'  → AI_PRIMARY_* deployment (full capability, higher cost)
 * - 'nano'  → AI_FAST_* deployment   (fast, cheap, sufficient for simple turns)
 */
export type ModelTier = 'mini' | 'nano';

/**
 * Which set of tools is injected for the current turn.
 * - 'full'    → all 14 tools (read + write + proposals + relocation)
 * - 'core'    → write tools minus proposals/relocation (8 tools)
 * - 'minimal' → core CRUD only: add/update/addPage/navigateTo/updateLayout
 */
export type ToolTier = 'full' | 'core' | 'minimal';

// ─── Telemetry ────────────────────────────────────────────────────────────────

/** Per-turn telemetry payload logged to structured logs and used for A/B. */
export interface TurnTelemetry {
  conversationId: string;
  formId: string;
  formFieldCount: number;
  /** Full model identifier as reported by the AI SDK (e.g. "gpt-5.4-mini"). */
  model: string;
  intentTier: IntentTier;
  modelTier: ModelTier;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  /** Fraction of input tokens that were served from cache (0–1). */
  cacheHitRatio: number;
  totalTokens: number;
}

/** Extracted and normalised usage stats from a LanguageModelUsage object. */
export interface UsageStats {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  cacheHitRatio: number;
  totalTokens: number;
}

// ─── Operations (form mutation operations returned by tools) ──────────────────

/** Marker for any form edit operation returned by a form-edit tool. */
export type FormEditOpType =
  | 'ADD_FIELD'
  | 'UPDATE_FIELDS'
  | 'REMOVE_FIELDS'
  | 'RELOCATE_FIELD'
  | 'REORDER_FIELDS'
  | 'UPDATE_LAYOUT'
  | 'RENAME_PAGE'
  | 'ADD_PAGE'
  | 'PROPOSE_DELETE_PAGE'
  | 'NAVIGATE_TO_PAGE'
  | 'PROPOSE_VALIDATION'
  | 'PROPOSE_FIELD_TYPE_CHANGE'
  | 'LIST_FIELDS'
  | 'GET_FIELD';

/** Allowed field type strings used in addField / proposeFieldTypeChange. */
export type AIFieldType =
  | 'text'
  | 'email'
  | 'number'
  | 'date'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'textarea'
  | 'file';

// ─── Quick Actions ────────────────────────────────────────────────────────────

/** A context-aware quick action suggestion shown in the chat UI. */
export interface QuickAction {
  id: string;
  label: string;
  prompt: string;
  /** Visual category for grouping/colouring in the UI. */
  category: 'add' | 'edit' | 'remove' | 'structure' | 'style';
  /** Icon name (Lucide). */
  icon: string;
}
