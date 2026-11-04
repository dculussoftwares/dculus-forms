import { describe, it, expect } from 'vitest';
import { describeSchema, introFromHtml } from '../describe.js';

const schema = (fields: any[], layout: Record<string, unknown> = {}, pages = 1) => ({
  pages: Array.from({ length: pages }, (_, i) => ({ id: `p${i}`, title: 'Page', fields: i === 0 ? fields : [] })),
  layout: { code: 'L5', content: '<h1>Get <em>in</em> touch</h1><p>We reply &amp; fast.</p>', ...layout },
});

describe('introFromHtml', () => {
  it('takes the first heading and paragraph as plain text', () => {
    expect(introFromHtml('<h1><strong>Hello</strong> there</h1><p>One <b>two</b></p><p>three</p>')).toEqual({
      headline: 'Hello there',
      intro: 'One two',
    });
  });

  it('decodes entities once, without double unescaping', () => {
    expect(introFromHtml('<h1>A &amp;lt;b&amp;gt; &lt;tag&gt;</h1>').headline).toBe('A &lt;b&gt; <tag>');
  });

  it('handles empty and non-string content', () => {
    expect(introFromHtml('')).toEqual({});
    expect(introFromHtml(undefined)).toEqual({});
  });
});

describe('describeSchema', () => {
  it('lists answerable fields only, in order, and counts them', () => {
    const s = describeSchema(
      schema(
        [
          { id: 'g', type: 'grid_field' },
          { id: 'a', type: 'text_input_field', label: 'First name', validation: { required: true }, gridId: 'g' },
          { id: 'b', type: 'rich_text_field', content: '<p>hi</p>' },
          { id: 'c', type: 'radio_field', label: 'Topic', options: ['A', '', 'B'] },
          { id: 'd', type: 'email_field', label: 'Old', deleted: true },
          { id: 'e', type: 'text_area_field', label: '  ' },
        ],
        {},
        3
      )
    );
    expect(s.fields.map((f) => f.label)).toEqual(['First name', 'Topic']);
    expect(s.fields[0]).toMatchObject({ kind: 'text', required: true, gridId: 'g' });
    expect(s.fields[1].options).toEqual(['A', 'B']);
    expect(s.questionCount).toBe(2);
    expect(s.pageCount).toBe(3);
    expect(s.headline).toBe('Get in touch');
    expect(s.intro).toBe('We reply & fast.');
    expect(s.minutes).toBe(1);
  });

  it('reads layout presentation and ignores white or malformed tints', () => {
    expect(describeSchema(schema([], { backgroundDominantColor: '#a1b2c3', theme: 'DARK' }))).toMatchObject({
      tint: '#a1b2c3',
      dark: true,
      layoutCode: 'L5',
    });
    expect(describeSchema(schema([], { customBackGroundColor: '#ffffff', backgroundDominantColor: 'red' })).tint).toBeUndefined();
  });

  it('survives an empty or broken schema', () => {
    expect(describeSchema(null)).toMatchObject({ fields: [], questionCount: 0, pageCount: 0, layoutCode: 'L1' });
  });
});
