/**
 * Routing eval for the zero-cost intent classifier. Runs in CI (no model calls).
 *
 * A misroute is not just a cost issue: an editing request routed to 'question' runs without
 * tools, so the assistant can only describe the change instead of making it.
 */
import { describe, it, expect } from 'vitest';
import { classifyIntent } from '../lib/intentClassifier.js';
import { INTENT_CASES } from './intentCases.js';

describe('intent routing eval', () => {
  it.each(INTENT_CASES)('routes "$message" → $expected', ({ message, expected }) => {
    expect(classifyIntent(message)).toBe(expected);
  });
});
