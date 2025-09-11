export interface ResetPasswordEmailData {
  userEmail: string;
  resetUrl: string;
  expiresInHours?: number;
}

export function generateResetPasswordEmailHtml(data: ResetPasswordEmailData): string {
  const { resetUrl, expiresInHours = 1 } = data;
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password - Dculus Forms</title>
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #374151;
          background-color: #f9fafb;
          margin: 0;
          padding: 20px;
        }
        
        .email-container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
          overflow: hidden;
        }
        
        .header {
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: white;
          padding: 40px 30px;
          text-align: center;
        }
        
        .logo {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 16px;
        }
        
        .logo-icon {
          font-size: 28px;
        }
        
        .header-title {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 8px;
          line-height: 1.2;
        }
        
        .header-subtitle {
          font-size: 16px;
          opacity: 0.9;
          font-weight: 400;
        }
        
        .content {
          padding: 40px 30px;
        }
        
        .content p {
          margin-bottom: 20px;
          font-size: 16px;
          line-height: 1.6;
        }
        
        .cta-container {
          text-align: center;
          margin: 32px 0;
        }
        
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: #ffffff;
          text-decoration: none;
          padding: 14px 32px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }
        
        .cta-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
        }
        
        .security-info {
          background-color: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          padding: 16px;
          margin: 24px 0;
        }
        
        .security-info-icon {
          color: #d97706;
          font-size: 18px;
          margin-right: 8px;
        }
        
        .security-info p {
          margin: 0;
          font-size: 14px;
          color: #92400e;
        }
        
        .footer {
          background-color: #f9fafb;
          border-top: 1px solid #e5e7eb;
          padding: 24px 30px;
          text-align: center;
        }
        
        .footer p {
          margin: 8px 0;
          font-size: 14px;
          color: #6b7280;
        }
        
        .footer a {
          color: #3b82f6;
          text-decoration: none;
        }
        
        .footer a:hover {
          text-decoration: underline;
        }
        
        @media only screen and (max-width: 480px) {
          body {
            padding: 10px;
          }
          
          .header {
            padding: 30px 20px;
          }
          
          .content {
            padding: 30px 20px;
          }
          
          .header-title {
            font-size: 24px;
          }
          
          .cta-button {
            padding: 12px 24px;
            font-size: 15px;
          }
          
          .footer {
            padding: 20px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <div class="logo">
            <span class="logo-icon">🔐</span>
            <span>Dculus Forms</span>
          </div>
          <h1 class="header-title">Reset Your Password</h1>
          <p class="header-subtitle">Secure password reset for your account</p>
        </div>
        
        <div class="content">
          <p>Hello,</p>
          
          <p>We received a request to reset the password for your Dculus Forms account. If you made this request, click the button below to set a new password:</p>
          
          <div class="cta-container">
            <a href="${resetUrl}" class="cta-button">Reset My Password</a>
          </div>
          
          <div class="security-info">
            <p><span class="security-info-icon">⚠️</span> <strong>Important:</strong> This reset link will expire in ${expiresInHours} hour${expiresInHours > 1 ? 's' : ''} for your security.</p>
          </div>
          
          <p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
          
          <p>For security reasons, this link can only be used once. If you need to reset your password again, please request a new reset link.</p>
          
          <p>If you're having trouble with the button above, copy and paste the following link into your web browser:</p>
          <p style="word-break: break-all; color: #6b7280; font-size: 14px;">${resetUrl}</p>
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