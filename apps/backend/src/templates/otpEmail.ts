import {
  renderEmailLayout,
  renderOtpCode,
  renderInfoBox,
} from './emailLayout.js';

export interface OTPEmailData {
  otp: string;
  type: 'sign-in' | 'sign-up' | 'email-verification' | 'forget-password' | 'change-email';
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

  const bodyHtml = `
    ${renderOtpCode(otp)}
    ${renderInfoBox('info', `⏰&nbsp;<strong>This code will expire in ${expiresInMinutes} minutes.</strong>`)}
    ${renderInfoBox('security', `<strong>Security Notice:</strong> Never share this code with anyone. Our team will never ask for your verification code. If you didn't request this code, please ignore this email or contact our support team.`)}
  `;

  return renderEmailLayout({
    title: getTitle(),
    preheader: `Your Dculus Forms code is ${otp} — expires in ${expiresInMinutes} minutes.`,
    heading: getTitle(),
    subtitle: getMessage(),
    bodyHtml,
  });
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