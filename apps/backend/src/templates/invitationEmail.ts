export interface InvitationEmailData {
  inviterName: string;
  organizationName: string;
  invitationId: string;
  acceptUrl: string;
  rejectUrl: string;
  expiresInDays?: number;
}

export function generateInvitationEmailHtml(data: InvitationEmailData): string {
  const { inviterName, organizationName, acceptUrl, rejectUrl, expiresInDays = 7 } = data;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Join ${organizationName} on Dculus Forms</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8fafc;
        }
        .container {
          background-color: #ffffff;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          padding: 40px;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo {
          font-size: 24px;
          font-weight: bold;
          color: #3b82f6;
          margin-bottom: 20px;
        }
        .title {
          font-size: 28px;
          font-weight: bold;
          color: #1f2937;
          margin-bottom: 10px;
        }
        .message {
          font-size: 16px;
          color: #6b7280;
          margin-bottom: 30px;
          text-align: center;
        }
        .invitation-container {
          background-color: #f3f4f6;
          border-radius: 8px;
          padding: 30px;
          margin: 30px 0;
          text-align: center;
        }
        .organization-name {
          font-size: 24px;
          font-weight: bold;
          color: #1f2937;
          margin-bottom: 10px;
        }
        .inviter-info {
          font-size: 16px;
          color: #6b7280;
          margin-bottom: 20px;
        }
        .button-container {
          margin: 30px 0;
          text-align: center;
        }
        .button {
          display: inline-block;
          padding: 15px 30px;
          margin: 0 10px 10px 10px;
          border-radius: 6px;
          text-decoration: none;
          font-weight: bold;
          font-size: 16px;
          text-align: center;
          min-width: 120px;
        }
        .accept-button {
          background-color: #10b981;
          color: white;
        }
        .reject-button {
          background-color: #ef4444;
          color: white;
        }
        .button:hover {
          opacity: 0.9;
        }
        .expiry-notice {
          background-color: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 6px;
          padding: 16px;
          margin: 20px 0;
          color: #92400e;
          text-align: center;
        }
        .features {
          margin: 30px 0;
          text-align: left;
        }
        .features h3 {
          color: #1f2937;
          margin-bottom: 15px;
        }
        .features ul {
          color: #6b7280;
          padding-left: 20px;
        }
        .features li {
          margin-bottom: 8px;
        }
        .footer {
          text-align: center;
          margin-top: 40px;
          padding-top: 30px;
          border-top: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 14px;
        }
        .footer a {
          color: #3b82f6;
          text-decoration: none;
        }
        @media only screen and (max-width: 600px) {
          body {
            padding: 10px;
          }
          .container {
            padding: 20px;
          }
          .title {
            font-size: 24px;
          }
          .button {
            display: block;
            margin: 10px 0;
            width: calc(100% - 60px);
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🎉 Dculus Forms</div>
          <h1 class="title">You're Invited!</h1>
          <p class="message">Join your team on Dculus Forms and start collaborating on forms together.</p>
        </div>
        
        <div class="invitation-container">
          <div class="organization-name">${organizationName}</div>
          <div class="inviter-info">Invited by ${inviterName}</div>
          
          <div class="button-container">
            <a href="${acceptUrl}" class="button accept-button">✅ Accept Invitation</a>
            <a href="${rejectUrl}" class="button reject-button">❌ Decline</a>
          </div>
        </div>
        
        <div class="expiry-notice">
          ⏰ This invitation will expire in ${expiresInDays} days
        </div>
        
        <div class="features">
          <h3>What you'll get access to:</h3>
          <ul>
            <li>Create and manage forms collaboratively</li>
            <li>Real-time form editing with team members</li>
            <li>Advanced form analytics and reporting</li>
            <li>Secure form responses and data management</li>
            <li>Custom form layouts and themes</li>
          </ul>
        </div>
        
        <div class="footer">
          <p>This invitation was sent to you by ${inviterName} from ${organizationName}.</p>
          <p>If you don't want to join this organization, you can safely ignore this email.</p>
          <p><a href="https://dculus.com">Visit Dculus</a> | <a href="mailto:support@dculus.com">Support</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function generateInvitationEmailText(data: InvitationEmailData): string {
  const { inviterName, organizationName, acceptUrl, rejectUrl, expiresInDays = 7 } = data;

  return `
You're Invited to Join ${organizationName} on Dculus Forms!

${inviterName} has invited you to join their team on Dculus Forms.

Accept the invitation: ${acceptUrl}
Decline the invitation: ${rejectUrl}

What you'll get access to:
• Create and manage forms collaboratively
• Real-time form editing with team members
• Advanced form analytics and reporting
• Secure form responses and data management
• Custom form layouts and themes

This invitation will expire in ${expiresInDays} days.

If you don't want to join this organization, you can safely ignore this email.

---
Dculus Forms
https://dculus.com
support@dculus.com
  `.trim();
}