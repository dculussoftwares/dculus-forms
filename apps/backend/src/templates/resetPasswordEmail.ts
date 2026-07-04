import {
  renderEmailLayout,
  renderParagraph,
  renderButton,
  renderInfoBox,
  EMAIL_THEME,
} from './emailLayout.js';

export interface ResetPasswordEmailData {
  userEmail: string;
  resetUrl: string;
  expiresInHours?: number;
}

export function generateResetPasswordEmailHtml(data: ResetPasswordEmailData): string {
  const { resetUrl, expiresInHours = 1 } = data;
  const hoursLabel = `${expiresInHours} hour${expiresInHours > 1 ? 's' : ''}`;

  const bodyHtml = `
    ${renderParagraph('Hello,')}
    ${renderParagraph('We received a request to reset the password for your Dculus Forms account. If you made this request, click the button below to set a new password:')}
    ${renderButton(resetUrl, 'Reset My Password')}
    ${renderInfoBox('warning', `⚠️&nbsp;<strong>Important:</strong> This reset link will expire in ${hoursLabel} for your security.`)}
    ${renderParagraph("If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.")}
    ${renderParagraph('For security reasons, this link can only be used once. If you need to reset your password again, please request a new reset link.')}
    <p style="margin:24px 0 6px 0; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size:13px; line-height:1.5; color:${EMAIL_THEME.muted};">If you're having trouble with the button above, copy and paste the following link into your web browser:</p>
    <p style="margin:0 0 4px 0; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size:13px; line-height:1.5; word-break:break-all;"><a href="${resetUrl}" style="color:${EMAIL_THEME.green}; text-decoration:none;">${resetUrl}</a></p>
    ${renderParagraph(`Need help? <a href="https://dculus.com/support" style="color:${EMAIL_THEME.green}; text-decoration:none;">Contact our support team</a>.`)}
  `;

  return renderEmailLayout({
    title: 'Reset Your Password - Dculus Forms',
    preheader: `Reset your Dculus Forms password — link expires in ${hoursLabel}.`,
    heading: 'Reset Your Password',
    subtitle: 'Secure password reset for your account.',
    bodyHtml,
  });
}

export function generateResetPasswordEmailText(data: ResetPasswordEmailData): string {
  const { resetUrl, expiresInHours = 1 } = data;
  
  return `
Reset Your Password - Dculus Forms

Hello,

We received a request to reset the password for your Dculus Forms account.

If you made this request, click the following link to set a new password:
${resetUrl}

IMPORTANT: This reset link will expire in ${expiresInHours} hour${expiresInHours > 1 ? 's' : ''} for your security.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

For security reasons, this link can only be used once. If you need to reset your password again, please request a new reset link.

Need help? Contact our support team: https://dculus.com/support
Visit Dculus Forms: https://dculus.com

This email was sent from Dculus Forms.
  `.trim();
}