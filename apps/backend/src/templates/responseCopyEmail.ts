import { renderEmailLayout, renderParagraph, EMAIL_THEME } from './emailLayout.js';

export interface ResponseCopyQaRow {
  label: string;
  answer: string;
}

export interface ResponseCopyEmailData {
  formTitle: string;
  /** True when the answers are attached as a PDF, so the Q&A table is omitted. */
  hasAttachment: boolean;
  qaRows: ResponseCopyQaRow[];
}

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

function renderQaTable(qaRows: ResponseCopyQaRow[]): string {
  if (qaRows.length === 0) return '';

  const rowsHtml = qaRows
    .map(
      (row, index) => `
      <tr>
        <td style="padding:14px 16px; ${index > 0 ? `border-top:1px solid ${EMAIL_THEME.border};` : ''}">
          <div style="font-family:${FONT_STACK}; font-size:13px; font-weight:600; color:${EMAIL_THEME.muted}; margin-bottom:4px;">${row.label}</div>
          <div style="font-family:${FONT_STACK}; font-size:15px; line-height:1.5; color:${EMAIL_THEME.body};">${row.answer}</div>
        </td>
      </tr>`
    )
    .join('');

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px 0; border:1px solid ${EMAIL_THEME.border}; border-radius:10px; overflow:hidden;">
    ${rowsHtml}
  </table>`;
}

export function generateResponseCopyEmailHtml(data: ResponseCopyEmailData): string {
  const { formTitle, hasAttachment, qaRows } = data;

  const bodyHtml = hasAttachment
    ? renderParagraph('A PDF copy of your answers is attached to this email.')
    : `${renderParagraph('Here is a copy of the answers you submitted:')}${renderQaTable(qaRows)}`;

  return renderEmailLayout({
    title: `Your response to ${formTitle}`,
    preheader: `Here's a copy of your response to ${formTitle}.`,
    heading: 'Thanks for your response!',
    subtitle: `This is a copy of your submission to <strong style="color:${EMAIL_THEME.body};">${formTitle}</strong>.`,
    bodyHtml,
  });
}
