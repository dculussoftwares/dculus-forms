import {
  renderEmailLayout,
  renderParagraph,
  renderButton,
  renderInfoBox,
  renderAltLink,
} from './emailLayout.js';

export interface MagicLinkEmailData {
  url: string;
  expiresInMinutes?: number;
}

export function generateMagicLinkEmailHtml(data: MagicLinkEmailData): string {
  const { url, expiresInMinutes = 5 } = data;

  const bodyHtml = `
    ${renderParagraph('Hello,')}
    ${renderParagraph('We received a request to sign in to your Dculus Forms account without a password. Click the button below to sign in instantly:')}
    ${renderButton(url, 'Sign In to Dculus Forms')}
    ${renderInfoBox('info', `⏱️&nbsp;<strong>This link expires in ${expiresInMinutes} minutes</strong> and can only be used once.`)}
    ${renderParagraph("If you didn't request this link, you can safely ignore this email — your account remains secure and no changes were made.")}
    ${renderAltLink(url)}
  `;

  return renderEmailLayout({
    title: 'Sign in to Dculus Forms',
    preheader: `Your Dculus Forms sign-in link — expires in ${expiresInMinutes} minutes.`,
    heading: 'Your Sign-In Link',
    subtitle: 'One click to access your account.',
    bodyHtml,
  });
}

export function generateMagicLinkEmailText(data: MagicLinkEmailData): string {
  const { url, expiresInMinutes = 5 } = data;

  return `
Sign In to Dculus Forms

Hello,

We received a request to sign in to your Dculus Forms account without a password.

Click or copy this link to sign in:
${url}

IMPORTANT: This link expires in ${expiresInMinutes} minutes and can only be used once.

If you didn't request this, you can safely ignore this email. Your account remains secure.

Need help? Contact our support team: https://dculus.com/support
Visit Dculus Forms: https://dculus.com

This email was sent from Dculus Forms.
  `.trim();
}
