export interface InvitationEmailData {
  to: string;
  organizationName: string;
  inviterName: string;
  invitationUrl: string;
  expiresInHours?: number;
}

export function generateInvitationEmailHtml(data: InvitationEmailData): string {
  const { organizationName, inviterName, invitationUrl, expiresInHours = 48 } = data;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Organization Invitation</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      margin: 0;
      padding: 0;
      background-color: #f8fafc;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .email-card {
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      padding: 40px;
      text-align: center;
    }
    .logo {
      margin-bottom: 24px;
    }
    .logo h1 {
      color: #1e293b;
      font-size: 24px;
      margin: 0;
      font-weight: 700;
    }
    .invitation-icon {
      width: 80px;
      height: 80px;
      background: linear-gradient(135deg, #3b82f6, #1d4ed8);
      border-radius: 50%;
      margin: 0 auto 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      color: white;
    }
    .title {
      color: #1e293b;
      font-size: 28px;
      font-weight: 700;
      margin: 0 0 16px 0;
    }
    .subtitle {
      color: #64748b;
      font-size: 18px;
      margin: 0 0 32px 0;
      line-height: 1.5;
    }
    .organization-name {
      color: #3b82f6;
      font-weight: 600;
    }
    .inviter-name {
      color: #1e293b;
      font-weight: 600;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #3b82f6, #1d4ed8);
      color: white !important;
      text-decoration: none;
      padding: 16px 32px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 24px 0;
      transition: transform 0.2s;
    }
    .cta-button:hover {
      transform: translateY(-1px);
    }
    .expiry-notice {
      background: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 8px;
      padding: 16px;
      margin: 24px 0;
      color: #92400e;
      font-size: 14px;
    }
    .footer {
      text-align: center;
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e2e8f0;
      color: #64748b;
      font-size: 14px;
    }
    .footer a {
      color: #3b82f6;
      text-decoration: none;
    }
    .security-note {
      background: #f1f5f9;
      border-radius: 8px;
      padding: 16px;
      margin: 24px 0;
      color: #475569;
      font-size: 13px;
      text-align: left;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="email-card">
      <div class="logo">
        <h1>🚀 Dculus Forms</h1>
      </div>
      
      <div class="invitation-icon">
        👥
      </div>
      
      <h1 class="title">You're Invited!</h1>
      <p class="subtitle">
        <span class="inviter-name">${inviterName}</span> has invited you to join 
        <span class="organization-name">${organizationName}</span> on Dculus Forms.
      </p>
      
      <p>Join your team to collaborate on forms, manage responses, and streamline your workflow together.</p>
      
      <a href="${invitationUrl}" class="cta-button">Accept Invitation</a>
      
      <div class="expiry-notice">
        ⏰ This invitation expires in <strong>${expiresInHours} hours</strong>
      </div>
      
      <div class="security-note">
        <strong>🔒 Security Notice:</strong> This invitation was sent to ${data.to}. 
        If you weren't expecting this invitation, you can safely ignore this email.
      </div>
    </div>
    
    <div class="footer">
      <p>
        Having trouble with the button? Copy and paste this link into your browser:<br>
        <a href="${invitationUrl}">${invitationUrl}</a>
      </p>
      <p>
        © 2024 Dculus Forms. All rights reserved.<br>
        <a href="https://dculus.com">dculus.com</a>
      </p>
    </div>
  </div>
</body>
</html>
  `;
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