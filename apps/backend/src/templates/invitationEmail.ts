import {
  renderEmailLayout,
  renderParagraph,
  renderButton,
  renderInfoBox,
  EMAIL_THEME,
} from './emailLayout.js';

export interface InvitationEmailData {
  to: string;
  organizationName: string;
  inviterName: string;
  invitationUrl: string;
  expiresInHours?: number;
}

export function generateInvitationEmailHtml(data: InvitationEmailData): string {
  const { organizationName, inviterName, invitationUrl, expiresInHours = 48 } = data;

  const subtitle = `<strong style="color:${EMAIL_THEME.body};">${inviterName}</strong> has invited you to join <strong style="color:${EMAIL_THEME.green};">${organizationName}</strong> on Dculus Forms.`;

  const bodyHtml = `
    ${renderParagraph('Join your team to collaborate on forms, manage responses, and streamline your workflow together.')}
    ${renderButton(invitationUrl, 'Accept Invitation')}
    ${renderInfoBox('warning', `⏰&nbsp;This invitation expires in <strong>${expiresInHours} hours</strong>.`)}
    ${renderInfoBox('security', `🔒&nbsp;<strong>Security Notice:</strong> This invitation was sent to ${data.to}. If you weren't expecting this invitation, you can safely ignore this email.`)}
    <p style="margin:24px 0 6px 0; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size:13px; line-height:1.5; color:${EMAIL_THEME.muted};">Having trouble with the button? Copy and paste this link into your browser:</p>
    <p style="margin:0; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size:13px; line-height:1.5; word-break:break-all;"><a href="${invitationUrl}" style="color:${EMAIL_THEME.green}; text-decoration:none;">${invitationUrl}</a></p>
  `;

  return renderEmailLayout({
    title: 'Organization Invitation',
    preheader: `${inviterName} invited you to join ${organizationName} on Dculus Forms.`,
    heading: "You're Invited!",
    subtitle,
    bodyHtml,
  });
}

export function generateInvitationEmailText(data: InvitationEmailData): string {
  const { organizationName, inviterName, invitationUrl, expiresInHours = 48 } = data;

  return `
🚀 You're Invited to Join ${organizationName} on Dculus Forms!

${inviterName} has invited you to join ${organizationName} on Dculus Forms.

Join your team to collaborate on forms, manage responses, and streamline your workflow together.

Accept your invitation by clicking this link:
${invitationUrl}

⏰ This invitation expires in ${expiresInHours} hours.

🔒 Security Notice: This invitation was sent to ${data.to}. If you weren't expecting this invitation, you can safely ignore this email.

---
© 2024 Dculus Forms. All rights reserved.
Visit us at: https://dculus.com

Having trouble? Copy and paste this link into your browser:
${invitationUrl}
  `;
}