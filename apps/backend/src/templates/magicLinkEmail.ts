export interface MagicLinkEmailData {
  url: string;
  expiresInMinutes?: number;
}

export function generateMagicLinkEmailHtml(data: MagicLinkEmailData): string {
  const { url, expiresInMinutes = 5 } = data;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Sign in to Dculus Forms</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6; color: #374151; background-color: #f9fafb; padding: 20px;
        }
        .email-container {
          max-width: 600px; margin: 0 auto; background-color: #ffffff;
          border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.07); overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: white; padding: 40px 30px; text-align: center;
        }
        .logo { display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 24px; font-weight: 700; margin-bottom: 16px; }
        .header-title { font-size: 28px; font-weight: 700; margin-bottom: 8px; line-height: 1.2; }
        .header-subtitle { font-size: 16px; opacity: 0.9; font-weight: 400; }
        .content { padding: 40px 30px; }
        .content p { margin-bottom: 20px; font-size: 16px; line-height: 1.6; }
        .cta-container { text-align: center; margin: 32px 0; }
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: #ffffff !important; text-decoration: none;
          padding: 14px 40px; border-radius: 8px; font-weight: 600;
          font-size: 16px; box-shadow: 0 4px 12px rgba(59,130,246,0.3);
        }
        .expiry-info {
          background-color: #eff6ff; border: 1px solid #bfdbfe;
          border-radius: 8px; padding: 16px; margin: 24px 0;
        }
        .expiry-info p { margin: 0; font-size: 14px; color: #1e40af; }
        .footer {
          background-color: #f9fafb; border-top: 1px solid #e5e7eb;
          padding: 24px 30px; text-align: center;
        }
        .footer p { margin: 8px 0; font-size: 14px; color: #6b7280; }
        .footer a { color: #3b82f6; text-decoration: none; }
        @media only screen and (max-width: 480px) {
          body { padding: 10px; }
          .header { padding: 30px 20px; }
          .content { padding: 30px 20px; }
          .header-title { font-size: 24px; }
          .cta-button { padding: 12px 28px; font-size: 15px; }
          .footer { padding: 20px; }
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <div class="logo"><span>🔗</span><span>Dculus Forms</span></div>
          <h1 class="header-title">Your Sign-In Link</h1>
          <p class="header-subtitle">One click to access your account</p>
        </div>
        <div class="content">
          <p>Hello,</p>
          <p>We received a request to sign in to your Dculus Forms account without a password. Click the button below to sign in instantly:</p>
          <div class="cta-container">
            <a href="${url}" class="cta-button">Sign In to Dculus Forms</a>
          </div>
          <div class="expiry-info">
            <p>⏱️ <strong>This link expires in ${expiresInMinutes} minutes</strong> and can only be used once.</p>
          </div>
          <p>If you didn't request this link, you can safely ignore this email — your account remains secure and no changes were made.</p>
          <p>If the button above doesn't work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #6b7280; font-size: 14px;">${url}</p>
        </div>
        <div class="footer">
          <p>This email was sent from <strong>Dculus Forms</strong></p>
          <p>Need help? <a href="https://dculus.com/support">Contact our support team</a></p>
          <p><a href="https://dculus.com">Visit Dculus.com</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
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
