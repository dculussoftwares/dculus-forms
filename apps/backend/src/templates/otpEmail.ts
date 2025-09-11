export interface OTPEmailData {
  otp: string;
  type: 'sign-in' | 'sign-up' | 'email-verification' | 'forget-password';
  expiresInMinutes?: number;
}

export function generateOTPEmailHtml(data: OTPEmailData): string {
  const { otp, type, expiresInMinutes = 5 } = data;
  
  const getTitle = () => {
    switch (type) {
      case 'sign-in':
        return 'Sign In to Your Account';
      case 'sign-up':
        return 'Welcome to Dculus Forms';
      case 'email-verification':
        return 'Verify Your Email Address';
      case 'forget-password':
        return 'Reset Your Password';
      default:
        return 'Authentication Code';
    }
  };

  const getMessage = () => {
    switch (type) {
      case 'sign-in':
        return 'Use the code below to sign in to your Dculus Forms account:';
      case 'sign-up':
        return 'Welcome! Use the code below to complete your account setup:';
      case 'email-verification':
        return 'Please use the code below to verify your email address:';
      case 'forget-password':
        return 'Use the code below to reset your password:';
      default:
        return 'Here is your verification code:';
    }
  };

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${getTitle()}</title>
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
        .otp-container {
          background-color: #f3f4f6;
          border-radius: 8px;
          padding: 30px;
          margin: 30px 0;
          text-align: center;
        }
        .otp-label {
          font-size: 14px;
          color: #6b7280;
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .otp-code {
          font-size: 36px;
          font-weight: bold;
          color: #1f2937;
          letter-spacing: 8px;
          margin: 20px 0;
          font-family: 'Courier New', monospace;
          background-color: #ffffff;
          padding: 20px;
          border-radius: 6px;
          border: 2px solid #e5e7eb;
          display: inline-block;
          min-width: 280px;
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
        .security-notice {
          background-color: #fef2f2;
          border: 1px solid #f87171;
          border-radius: 6px;
          padding: 16px;
          margin: 20px 0;
          color: #991b1b;
          font-size: 14px;
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
          .otp-code {
            font-size: 28px;
            letter-spacing: 4px;
            min-width: 220px;
            padding: 15px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🔐 Dculus Forms</div>
          <h1 class="title">${getTitle()}</h1>
          <p class="message">${getMessage()}</p>
        </div>
        
        <div class="otp-container">
          <div class="otp-label">Your verification code</div>
          <div class="otp-code">${otp}</div>
        </div>
        
        <div class="expiry-notice">
          ⏰ This code will expire in ${expiresInMinutes} minutes
        </div>
        
        <div class="security-notice">
          <strong>Security Notice:</strong> Never share this code with anyone. Our team will never ask for your verification code. If you didn't request this code, please ignore this email or contact our support team.
        </div>
        
        <div class="footer">
          <p>This email was sent from Dculus Forms. If you have any questions, please contact our support team.</p>
          <p><a href="https://dculus.com">Visit Dculus</a> | <a href="mailto:support@dculus.com">Support</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function generateOTPEmailText(data: OTPEmailData): string {
  const { otp, type, expiresInMinutes = 5 } = data;
  
  const getMessage = () => {
    switch (type) {
      case 'sign-in':
        return 'Use this code to sign in to your Dculus Forms account';
      case 'sign-up':
        return 'Welcome! Use this code to complete your account setup';
      case 'email-verification':
        return 'Please use this code to verify your email address';
      case 'forget-password':
        return 'Use this code to reset your password';
      default:
        return 'Here is your verification code';
    }
  };

  return `
Dculus Forms - Authentication Code

${getMessage()}:

${otp}

This code will expire in ${expiresInMinutes} minutes.

Security Notice: Never share this code with anyone. If you didn't request this code, please ignore this email or contact our support team.

---
Dculus Forms
https://dculus.com
support@dculus.com
  `.trim();
}