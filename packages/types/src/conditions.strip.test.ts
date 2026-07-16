import { describe, it, expect } from 'vitest';
import { stripHiddenResponses, type FormResponsesByPage } from './conditions.js';

const responses = (): FormResponsesByPage => ({
  p1: { name: 'Jane', age: 30, secret: 'stale hidden value' },
  p2: { details: 'long text', files: [{ name: 'a.pdf' }] },
  p3: { email: 'jane@example.com' },
});

const visibility = (fields: string[] = [], pages: string[] = []) => ({
  hiddenFieldIds: new Set(fields),
  hiddenPageIds: new Set(pages),
});

describe('stripHiddenResponses', () => {
  it('passes everything through when nothing is hidden', () => {
    expect(stripHiddenResponses(responses(), visibility())).toEqual(responses());
  });

  it('removes hidden fields but keeps their page siblings', () => {
    const result = stripHiddenResponses(responses(), visibility(['secret']));
    expect(result.p1).toEqual({ name: 'Jane', age: 30 });
    expect(result.p2).toEqual(responses().p2);
  });

  it('drops every value on a hidden page (including file arrays)', () => {
    const result = stripHiddenResponses(responses(), visibility([], ['p2']));
    expect(result.p2).toBeUndefined();
    expect(result.p1).toEqual(responses().p1);
    expect(result.p3).toEqual(responses().p3);
  });

  it('combines hidden fields and hidden pages', () => {
    const result = stripHiddenResponses(
      responses(),
      visibility(['age', 'email'], ['p2'])
    );
    expect(result).toEqual({ p1: { name: 'Jane', secret: 'stale hidden value' }, p3: {} });
  });

  it('does not mutate the input', () => {
    const input = responses();
    stripHiddenResponses(input, visibility(['name'], ['p2']));
    expect(input).toEqual(responses());
  });

  it('tolerates empty and null-ish page maps', () => {
    const result = stripHiddenResponses(
      { p1: {}, p2: null } as unknown as FormResponsesByPage,
      visibility(['x'])
    );
    expect(result).toEqual({ p1: {}, p2: {} });
  });
});
