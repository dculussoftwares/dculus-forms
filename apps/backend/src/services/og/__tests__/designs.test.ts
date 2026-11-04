import { describe, it, expect } from 'vitest';
import { describeSchema } from '../describe.js';
import { CARD_SIZE, SHARE_SIZE, formShare, templateCard, templateShare } from '../designs.js';
import { renderPng } from '../render.js';
import { truncate } from '../element.js';

const pngSize = (png: Buffer) => ({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) });

const summaryFor = (code: string) =>
  describeSchema({
    pages: [
      {
        id: 'p',
        title: 'P',
        fields: [
          { id: 'g', type: 'grid_field' },
          { id: 'a', type: 'text_input_field', label: 'First name', gridId: 'g', validation: { required: true } },
          { id: 'b', type: 'text_input_field', label: 'Last name', gridId: 'g' },
          { id: 'c', type: 'radio_field', label: 'Score', options: ['0', '1', '2', '3', '4', '5'] },
          { id: 'd', type: 'select_field', label: 'Topic', options: ['A'] },
          { id: 'e', type: 'date_field', label: 'Day' },
          { id: 'f', type: 'file_upload_field', label: 'CV' },
          { id: 'h', type: 'text_area_field', label: 'Message' },
        ],
      },
    ],
    layout: { code, content: '<h1>வணக்கம் Hello</h1><p>Intro</p>', backgroundDominantColor: '#336699' },
  });

describe('generated images', () => {
  it.each(['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9'])('renders the %s gallery card without a photo', async (code) => {
    const png = await renderPng(templateCard({ summary: summaryFor(code), title: 'Hello' }), CARD_SIZE);
    expect(pngSize(png)).toEqual(CARD_SIZE);
  });

  it('renders the template and form share images at 1200×630', async () => {
    const summary = summaryFor('L1');
    const share = await renderPng(templateShare({ summary, title: 'x', heading: 'Contact Us Form Template', category: 'Business' }), SHARE_SIZE);
    const form = await renderPng(formShare({ summary, title: 'A very long form title '.repeat(6), description: 'desc' }), SHARE_SIZE);
    expect(pngSize(share)).toEqual(SHARE_SIZE);
    expect(pngSize(form)).toEqual(SHARE_SIZE);
  });
});

describe('truncate', () => {
  it('cuts on a word boundary with an ellipsis', () => {
    expect(truncate('Overall, how satisfied are you with us?', 30)).toBe('Overall, how satisfied are…');
    expect(truncate('  short  ', 30)).toBe('short');
  });
});
