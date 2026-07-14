import { describe, it, expect } from 'vitest';
import { generateResponseCopyEmailHtml } from '../responseCopyEmail.js';

describe('generateResponseCopyEmailHtml', () => {
  it('renders a Q&A table when there is no PDF attachment', () => {
    const html = generateResponseCopyEmailHtml({
      formTitle: 'Feedback Form',
      hasAttachment: false,
      qaRows: [
        { label: 'Full Name', answer: 'Alice' },
        { label: 'Interests', answer: 'A, B' },
      ],
    });

    expect(html).toContain('Feedback Form');
    expect(html).toContain('Full Name');
    expect(html).toContain('Alice');
    expect(html).toContain('Interests');
    expect(html).toContain('A, B');
    expect(html).toContain('Here is a copy of the answers you submitted');
  });

  it('omits the Q&A table and shows an attachment note when a PDF is attached', () => {
    const html = generateResponseCopyEmailHtml({
      formTitle: 'Feedback Form',
      hasAttachment: true,
      qaRows: [{ label: 'Full Name', answer: 'Alice' }],
    });

    expect(html).toContain('A PDF copy of your answers is attached to this email.');
    expect(html).not.toContain('Full Name');
    expect(html).not.toContain('Alice');
  });

  it('handles an empty Q&A row list without throwing', () => {
    const html = generateResponseCopyEmailHtml({
      formTitle: 'Empty Form',
      hasAttachment: false,
      qaRows: [],
    });

    expect(html).toContain('Empty Form');
    expect(html).toContain('<!DOCTYPE html>');
  });

  it('generates valid HTML structure with the form title in the heading', () => {
    const html = generateResponseCopyEmailHtml({
      formTitle: 'Survey',
      hasAttachment: false,
      qaRows: [],
    });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Thanks for your response!');
    expect(html).toContain('Survey');
  });
});
