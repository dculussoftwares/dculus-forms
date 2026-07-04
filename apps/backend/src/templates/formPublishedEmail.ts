import { FormPublishedEmailData } from '../services/emailService.js';
import {
  renderEmailLayout,
  renderParagraph,
  renderButton,
  EMAIL_THEME,
} from './emailLayout.js';

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export function generateFormPublishedHtml(data: FormPublishedEmailData): string {
  const descriptionHtml = data.formDescription
    ? `<p style="margin:0 0 20px 0; font-family:${FONT_STACK}; font-size:14px; line-height:1.6; color:${EMAIL_THEME.muted};">${data.formDescription}</p>`
    : '';

  const nextStep = (html: string) =>
    `<li style="margin:0 0 8px 0;">${html}</li>`;

  const formDetails = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px 0;">
      <tr>
        <td align="center" style="background-color:${EMAIL_THEME.pageBg}; border:1px solid ${EMAIL_THEME.border}; border-radius:12px; padding:28px 24px;">
          <div style="font-family:${FONT_STACK}; font-size:19px; font-weight:700; color:${EMAIL_THEME.heading}; margin-bottom:8px;">${data.formTitle}</div>
          ${descriptionHtml}
          ${renderButton(data.formUrl, 'View Your Published Form')}
        </td>
      </tr>
    </table>`;

  const nextSteps = `
    ${renderParagraph('Your form is now accessible to anyone with the link. You can share it with your audience, embed it on your website, or use it however you need.')}
    ${renderParagraph('Here are some things you can do now:')}
    <ul style="margin:0 0 18px 0; padding-left:20px; font-family:${FONT_STACK}; font-size:16px; line-height:1.6; color:${EMAIL_THEME.body};">
      ${nextStep(`Share your form link: <a href="${data.formUrl}" style="color:${EMAIL_THEME.green}; text-decoration:none; word-break:break-all;">${data.formUrl}</a>`)}
      ${nextStep('Monitor form responses in your dashboard')}
      ${nextStep('Update form settings anytime')}
      ${nextStep('View analytics and insights')}
    </ul>`;

  return renderEmailLayout({
    title: 'Your Form is Now Published',
    preheader: `${data.formTitle} is now live and ready to collect responses.`,
    heading: '🎉 Your Form is Now Live!',
    subtitle: `Congratulations, ${data.ownerName}! Your form has been successfully published.`,
    bodyHtml: `${formDetails}${nextSteps}`,
  });
}
