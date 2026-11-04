import { describe, it, expect } from 'vitest';
import { sanitizeImageCredit, sanitizeStringList, sanitizeTags, sanitizeTemplateContent } from '../templateContent.js';

describe('sanitizeTemplateContent', () => {
  it('keeps known keys, trims and drops unknown or empty values', () => {
    expect(
      sanitizeTemplateContent({
        intro: '  Hello   world ',
        useCases: ['A', ' a ', '', 3, 'B'],
        faq: [{ question: 'Q?', answer: 'A.' }, { question: 'no answer' }],
        evil: '<script>',
      })
    ).toEqual({ intro: 'Hello world', audience: undefined, useCases: ['A', 'B'], tips: [], faq: [{ question: 'Q?', answer: 'A.' }] });
  });

  it('returns null when nothing usable is left', () => {
    expect(sanitizeTemplateContent({ useCases: [] })).toBeNull();
    expect(sanitizeTemplateContent('nope')).toBeNull();
    expect(sanitizeTemplateContent([])).toBeNull();
  });
});

describe('sanitizeImageCredit', () => {
  it('requires a photographer and https links', () => {
    expect(
      sanitizeImageCredit({ source: 'pexels', photographer: 'Ann', photographerUrl: 'http://x.com', sourceUrl: 'https://pexels.com/p/1' })
    ).toEqual({ source: 'pexels', photographer: 'Ann', photographerUrl: undefined, sourceUrl: 'https://pexels.com/p/1' });
    expect(sanitizeImageCredit({ source: 'flickr', photographer: 'Bo' })?.source).toBe('other');
    expect(sanitizeImageCredit({ source: 'pexels' })).toBeNull();
  });
});

describe('keyword and tag lists', () => {
  it('de-duplicates case-insensitively and caps length', () => {
    expect(sanitizeStringList(['Contact form', 'contact FORM', 'x'])).toEqual(['Contact form', 'x']);
    expect(sanitizeTags(Array.from({ length: 12 }, (_, i) => `t${i}`))).toHaveLength(8);
    expect(sanitizeTags('nope')).toEqual([]);
  });
});
