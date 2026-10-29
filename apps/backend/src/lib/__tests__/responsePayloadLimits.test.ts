import { describe, it, expect } from 'vitest';
import {
  assertResponsePayloadWithinLimits,
  MAX_RESPONSE_FIELDS,
  MAX_RESPONSE_KEY_LENGTH,
  MAX_RESPONSE_NESTING_DEPTH,
  MAX_RESPONSE_STRING_LENGTH,
} from '../responsePayloadLimits.js';

describe('assertResponsePayloadWithinLimits', () => {
  it('accepts a normal answers object', () => {
    expect(() =>
      assertResponsePayloadWithinLimits({ f1: 'hello', f2: ['a', 'b'], f3: { nested: 1 } })
    ).not.toThrow();
  });

  it.each([
    ['a string', 'x'.repeat(50_000)],
    ['a number', 42],
    ['an array', ['a', 'b']],
    ['null', null],
    ['undefined', undefined],
  ])('rejects %s as data (S04-03)', (_label, value) => {
    expect(() => assertResponsePayloadWithinLimits(value)).toThrow(/must be an object/);
  });

  it('rejects too many fields', () => {
    const data: Record<string, string> = {};
    for (let i = 0; i <= MAX_RESPONSE_FIELDS; i++) data[`f${i}`] = 'x';
    expect(() => assertResponsePayloadWithinLimits(data)).toThrow(/more than/);
  });

  it('rejects oversized keys', () => {
    expect(() =>
      assertResponsePayloadWithinLimits({ ['k'.repeat(MAX_RESPONSE_KEY_LENGTH + 1)]: 'x' })
    ).toThrow(/oversized field key/);
  });

  it('rejects oversized strings', () => {
    expect(() =>
      assertResponsePayloadWithinLimits({ f1: 'x'.repeat(MAX_RESPONSE_STRING_LENGTH + 1) })
    ).toThrow(/10,000 character limit/);
  });

  it('rejects deeply nested values', () => {
    let nested: unknown = 'leaf';
    for (let i = 0; i < MAX_RESPONSE_NESTING_DEPTH + 2; i++) nested = { next: nested };
    expect(() => assertResponsePayloadWithinLimits({ f1: nested })).toThrow(/nested too deeply/);
  });
});
