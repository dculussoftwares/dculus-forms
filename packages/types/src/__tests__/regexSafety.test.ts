import { describe, it, expect } from 'vitest';
import { gradingFormSchema, hasQuantifiedAlternation } from '../index.js';

describe('hasQuantifiedAlternation', () => {
  it.each(['(a|aa)+', '(\\w|\\d)*', '(?:a|aa){1,}', '((a|b)c)+', '(a|aa){2,30}'])(
    'flags %s',
    (pattern) => {
      expect(hasQuantifiedAlternation(pattern)).toBe(true);
    }
  );

  it.each(['(yes|no)', 'colou?r', '[(|]+', '\\(a|b\\)+', '(a|b)?', '(a|b){2}', '(abc)+', 'a|b+'])(
    'allows %s',
    (pattern) => {
      expect(hasQuantifiedAlternation(pattern)).toBe(false);
    }
  );
});

describe('gradingFormSchema regex safety', () => {
  const build = (pattern: string) =>
    gradingFormSchema.safeParse({
      mode: 'text',
      pointValue: 1,
      acceptedAnswers: [pattern],
      text: { regex: true },
    });

  it('rejects a quantified alternation with a dedicated message', () => {
    const result = build('(a|aa)+');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('quizGrading:errors.regexUnsafe');
    }
  });

  it('accepts a plain pattern', () => {
    expect(build('^(red|blue) car$').success).toBe(true);
  });
});
