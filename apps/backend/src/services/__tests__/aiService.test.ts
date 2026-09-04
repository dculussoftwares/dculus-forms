import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/ai.js', () => ({
  getFastModel: vi.fn(),
  getPrimaryModel: vi.fn(),
}));
vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { prepareQuizFields } from '../aiService.js';
import type { AIGeneratedField } from '../aiService.js';

const field = (over: Partial<AIGeneratedField> = {}): AIGeneratedField => ({
  type: 'radio',
  label: 'Q',
  placeholder: null,
  required: true,
  options: null,
  correctAnswers: null,
  section: 'Quiz',
  ...over,
});

const opts = (labels: string[]) => labels.map((l) => ({ value: l, label: l }));

describe('aiService — prepareQuizFields', () => {
  it('keeps the correct answer valid after shuffling the options', () => {
    const [out] = prepareQuizFields([
      field({ options: opts(['A', 'B', 'C', 'D']), correctAnswers: ['C'] }),
    ]);
    expect(out.options!.map((o) => o.label).sort()).toEqual(['A', 'B', 'C', 'D']);
    expect(out.correctAnswers).toEqual(['C']);
    // the kept key must still correspond to a real option
    expect(out.options!.some((o) => o.label === out.correctAnswers![0])).toBe(true);
  });

  it('does actually reshuffle (not always the model order)', () => {
    // 24 permutations of 4 items — 40 runs practically never all stay identical.
    const original = ['A', 'B', 'C', 'D'];
    const anyReordered = Array.from({ length: 40 }).some(() => {
      const [out] = prepareQuizFields([
        field({ options: opts(original), correctAnswers: ['A'] }),
      ]);
      return out.options!.map((o) => o.label).join('') !== original.join('');
    });
    expect(anyReordered).toBe(true);
  });

  it('drops a hallucinated key that matches no option', () => {
    const [out] = prepareQuizFields([
      field({ options: opts(['A', 'B']), correctAnswers: ['Z'] }),
    ]);
    expect(out.correctAnswers).toBeNull();
  });

  it('filters checkbox keys to those present in options', () => {
    const [out] = prepareQuizFields([
      field({ type: 'checkbox', options: opts(['A', 'B', 'C']), correctAnswers: ['A', 'C', 'Q'] }),
    ]);
    expect(out.correctAnswers!.sort()).toEqual(['A', 'C']);
  });

  it('nulls correctAnswers for fields without a real option list', () => {
    const [out] = prepareQuizFields([
      field({ type: 'text', options: null, correctAnswers: ['whatever'] }),
    ]);
    expect(out.correctAnswers).toBeNull();
  });
});
