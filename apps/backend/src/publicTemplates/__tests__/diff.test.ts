import { describe, it, expect } from 'vitest';
import { canonicalJson, changedFields } from '../diff.js';

describe('changedFields', () => {
  it('ignores object key order (jsonb reorders keys) and null vs missing', () => {
    const row = { formSchema: { pages: [], layout: { b: 1, a: 2 } }, seoTitle: null, tags: ['x'] };
    expect(changedFields(row, { formSchema: { layout: { a: 2, b: 1 }, pages: [] }, seoTitle: undefined, tags: ['x'] })).toEqual([]);
  });

  it('reports the fields that differ, including array order', () => {
    expect(changedFields({ name: 'A', tags: ['x', 'y'], featured: false }, { name: 'B', tags: ['y', 'x'], featured: false })).toEqual([
      'name',
      'tags',
    ]);
  });

  it('canonicalJson sorts nested keys', () => {
    expect(canonicalJson({ b: { d: 1, c: 2 }, a: 1 })).toBe('{"a":1,"b":{"c":2,"d":1}}');
  });
});
