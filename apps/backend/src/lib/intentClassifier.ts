/**
 * Heuristic intent classifier for the AI chat form editor.
 *
 * Zero-latency classification via regex — no API call overhead.
 * Determines which model tier and tool tier to use for a given user message.
 *
 * Routing decisions:
 *   'simple'   → gpt-5.4-nano  + 'core' tools  (single ops: add, rename, remove, reorder)
 *   'complex'  → gpt-5.4-mini  + 'full' tools  (analysis, remix, bulk validation)
 *   'question' → gpt-5.4-nano  + 'minimal' tools, skip ToolLoopAgent (no edits expected)
 */

// Phase 2.1: type lives in @dculus/types. Re-exported for backward compat.
export type { IntentTier } from '@dculus/types/ai.js';
import type { IntentTier } from '@dculus/types/ai.js';

// Matches requests that are likely complex multi-step operations requiring the
// full mini model and all tools (analysis, bulk ops, remixing, merging pages).
const COMPLEX_PATTERNS: RegExp[] = [
  /\b(analy[sz]e|review|audit|assess|evaluate)\b/i,
  /\b(remix|transform|redesign|rebuild|rethink|reimagine)\b/i,
  /\b(suggest|recommend|propose)\b.{0,30}\b(validation|rules|improvements?|changes?|structure)\b/i,
  /\b(generate|create|build)\b.{0,30}\b(all|multiple|several|a\s+complete|a\s+full)\b/i,
  /\b(merge|combine|consolidate)\b.{0,20}\bpages?\b/i,
  /\b(reorgani[sz]e|restructure|refactor)\b/i,
  /\bmake\s+(this\s+form\s+)?better\b/i,
  /\bwhat('s|\s+is)\s+(wrong|missing|off)\b/i,
  /\bimprove\b.{0,30}\b(form|structure|flow|fields)\b/i,
  /\ball\s+(fields?|questions?)\b.{0,20}\b(required|optional|validation)\b/i,
  /\b(apply|add)\b.{0,20}\bvalidation\b.{0,30}\b(all|every|each)\b/i,
  /\bconvert\b.{0,30}\b(into|to)\b.{0,30}\b(form|survey|quiz)\b/i,
];

// Matches requests that are likely pure questions (no edits) — no tool loop needed.
const QUESTION_PATTERNS: RegExp[] = [
  /\bwhat\b.{0,30}\b(field\s+types?|types?\s+of\s+fields?|can\s+you\s+do|support)\b/i,
  /\bhow\s+(do|can|should)\b/i,
  /\bcan\s+you\s+(help|explain|tell|show|list)\b/i,
  /\bwhat('s|\s+is)\b.{0,30}\b(the\s+difference|a\s+[a-z]+\s+field)\b/i,
  /\bdo\s+you\s+(support|have|know)\b/i,
  /\bexplain\b/i,
  /\bwhat\s+are\s+(the\s+)?(options|available|supported)\b/i,
];

// Matches clear simple single-operation requests.
// These take priority over question patterns to avoid mis-routing "add a text field" as a question.
const SIMPLE_PATTERNS: RegExp[] = [
  /\b(add|create|insert|put|include)\b.{0,30}\b(field|question|input|dropdown|checkbox|radio|email|number|date|text|file)\b/i,
  /\b(rename|change\s+(the\s+)?name\s+of|relabel)\b/i,
  /\b(remove|delete|get\s+rid\s+of)\b.{0,30}\b(field|question|page)\b/i,
  /\b(make|set)\b.{0,30}\b(required|optional|mandatory)\b/i,
  /\b(reorder|move|swap|rearrange|drag)\b.{0,30}\b(field|page|question|order)\b/i,
  /\b(update|change|edit|modify)\b.{0,30}\b(label|placeholder|hint|options?|title|description)\b/i,
  /\b(add|create|insert)\b.{0,20}\bpage\b/i,
  /\b(rename|change\s+(the\s+)?title\s+of)\b.{0,20}\bpage\b/i,
  /\b(move|copy)\b.{0,30}\b(field|question)\b.{0,20}\b(to|onto|into)\b/i,
  /\bchange\b.{0,30}\bbutton\b/i,
  /\bupdate\b.{0,30}\b(intro|header|cta)\b/i,
];

/**
 * Classify a user message into an intent tier.
 * Order: complex → simple → question → fallback to 'simple'
 * (defaulting to 'simple' keeps nano as the cost-saving default for ambiguous messages)
 */
export function classifyIntent(message: string): IntentTier {
  const trimmed = message.trim();
  if (!trimmed) return 'simple';

  // Complex check first — these take highest priority as they need the more capable model
  if (COMPLEX_PATTERNS.some((p) => p.test(trimmed))) return 'complex';

  // Simple single-op check next — catches "add email field" before question check
  if (SIMPLE_PATTERNS.some((p) => p.test(trimmed))) return 'simple';

  // Pure question — no edits expected, skip tool loop
  if (QUESTION_PATTERNS.some((p) => p.test(trimmed))) return 'question';

  // Ambiguous / short messages — default to simple (nano, cost-saving)
  return 'simple';
}

/**
 * Maps an intent tier to the appropriate model tier.
 * 'simple' and 'question' use nano; 'complex' uses mini.
 */
export function intentToModelTier(intent: IntentTier): 'nano' | 'mini' {
  return intent === 'complex' ? 'mini' : 'nano';
}

/**
 * Maps an intent tier to the appropriate tool tier.
 * 'question' → 'minimal' (no heavy tool schemas)
 * 'simple'   → 'core'    (CRUD tools, no proposals/relocation)
 * 'complex'  → 'full'    (all tools)
 */
export function intentToToolTier(intent: IntentTier): 'minimal' | 'core' | 'full' {
  if (intent === 'question') return 'minimal';
  if (intent === 'simple') return 'core';
  return 'full';
}
