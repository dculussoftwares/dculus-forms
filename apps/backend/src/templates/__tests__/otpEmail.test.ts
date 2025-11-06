import { describe, it, expect } from 'vitest';
import { generateOTPEmailHtml, generateOTPEmailText, OTPEmailData } from '../otpEmail.js';

describe('OTP Email Templates', () => {
  describe('generateOTPEmailHtml', () => {
    it('should generate HTML for sign-in OTP', () => {
      const data: OTPEmailData = {
        otp: '123456',
        type: 'sign-in',
        expiresInMinutes: 5
      };

      const html = generateOTPEmailHtml(data);

      expect(html).toContain('123456');
      expect(html).toContain('Sign In to Your Account');
      expect(html).toContain('Use the code below to sign in to your Dculus Forms account');
      expect(html).toContain('This code will expire in 5 minutes');
    });

    it('should generate HTML for sign-up OTP', () => {
      const data: OTPEmailData = {
        otp: '654321',
        type: 'sign-up',
        expiresInMinutes: 10
      };

      const html = generateOTPEmailHtml(data);

      expect(html).toContain('654321');
      expect(html).toContain('Welcome to Dculus Forms');
      expect(html).toContain('Welcome! Use the code below to complete your account setup');
      expect(html).toContain('This code will expire in 10 minutes');
    });

    it('should generate HTML for email-verification OTP', () => {
      const data: OTPEmailData = {
        otp: '789012',
        type: 'email-verification'
      };

      const html = generateOTPEmailHtml(data);

      expect(html).toContain('789012');
      expect(html).toContain('Verify Your Email Address');
      expect(html).toContain('Please use the code below to verify your email address');
      expect(html).toContain('This code will expire in 5 minutes'); // Default
    });

    it('should generate HTML for forget-password OTP', () => {
      const data: OTPEmailData = {
        otp: '345678',
        type: 'forget-password',
        expiresInMinutes: 15
      };

      const html = generateOTPEmailHtml(data);

      expect(html).toContain('345678');
      expect(html).toContain('Reset Your Password');
      expect(html).toContain('Use the code below to reset your password');
      expect(html).toContain('This code will expire in 15 minutes');
    });

    it('should use default expiry time when not provided', () => {
      const data: OTPEmailData = {
        otp: '111111',
        type: 'sign-in'
      };

      const html = generateOTPEmailHtml(data);

      expect(html).toContain('This code will expire in 5 minutes');
    });

    it('should include security notice', () => {
      const data: OTPEmailData = {
        otp: '999999',
        type: 'sign-in'
      };

      const html = generateOTPEmailHtml(data);

      expect(html).toContain('Security Notice');
      expect(html).toContain('Never share this code with anyone');
    });

    it('should include Dculus Forms branding', () => {
      const data: OTPEmailData = {
        otp: '888888',
        type: 'sign-in'
      };

      const html = generateOTPEmailHtml(data);

      expect(html).toContain('🔐 Dculus Forms');
      expect(html).toContain('https://dculus.com');
      expect(html).toContain('support@dculus.com');
    });

    it('should generate valid HTML structure', () => {
      const data: OTPEmailData = {
        otp: '777777',
        type: 'sign-in'
      };

      const html = generateOTPEmailHtml(data);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<head>');
      expect(html).toContain('<body>');
      expect(html).toContain('</html>');
    });

    it('should include responsive CSS styles', () => {
      const data: OTPEmailData = {
        otp: '666666',
        type: 'sign-in'
      };

      const html = generateOTPEmailHtml(data);

      expect(html).toContain('<style>');
      expect(html).toContain('@media only screen and (max-width: 600px)');
      expect(html).toContain('font-family');
    });
  });

  describe('generateOTPEmailText', () => {
    it('should generate plain text for sign-in OTP', () => {
      const data: OTPEmailData = {
        otp: '123456',
        type: 'sign-in',
        expiresInMinutes: 5
      };

      const text = generateOTPEmailText(data);

      expect(text).toContain('123456');
      expect(text).toContain('Use this code to sign in to your Dculus Forms account');
      expect(text).toContain('This code will expire in 5 minutes');
    });

    it('should generate plain text for sign-up OTP', () => {
      const data: OTPEmailData = {
        otp: '654321',
        type: 'sign-up',
        expiresInMinutes: 10
      };

      const text = generateOTPEmailText(data);

      expect(text).toContain('654321');
      expect(text).toContain('Welcome! Use this code to complete your account setup');
      expect(text).toContain('This code will expire in 10 minutes');
    });

    it('should generate plain text for email-verification OTP', () => {
      const data: OTPEmailData = {
        otp: '789012',
        type: 'email-verification'
      };

      const text = generateOTPEmailText(data);

      expect(text).toContain('789012');
      expect(text).toContain('Please use this code to verify your email address');
      expect(text).toContain('This code will expire in 5 minutes'); // Default
    });

    it('should generate plain text for forget-password OTP', () => {
      const data: OTPEmailData = {
        otp: '345678',
        type: 'forget-password',
        expiresInMinutes: 15
      };

      const text = generateOTPEmailText(data);

      expect(text).toContain('345678');
      expect(text).toContain('Use this code to reset your password');
      expect(text).toContain('This code will expire in 15 minutes');
    });

    it('should use default expiry time when not provided', () => {
      const data: OTPEmailData = {
        otp: '111111',
        type: 'sign-in'
      };

      const text = generateOTPEmailText(data);

      expect(text).toContain('This code will expire in 5 minutes');
    });

    it('should include security notice in plain text', () => {
      const data: OTPEmailData = {
        otp: '999999',
        type: 'sign-in'
      };

      const text = generateOTPEmailText(data);

      expect(text).toContain('Security Notice');
      expect(text).toContain('Never share this code with anyone');
    });

    it('should include Dculus Forms contact information', () => {
      const data: OTPEmailData = {
        otp: '888888',
        type: 'sign-in'
      };

      const text = generateOTPEmailText(data);

      expect(text).toContain('Dculus Forms');
      expect(text).toContain('https://dculus.com');
      expect(text).toContain('support@dculus.com');
    });

    it('should not contain HTML tags', () => {
      const data: OTPEmailData = {
        otp: '777777',
        type: 'sign-in'
      };

      const text = generateOTPEmailText(data);

      expect(text).not.toContain('<html>');
      expect(text).not.toContain('<div>');
      expect(text).not.toContain('<style>');
    });

    it('should be properly formatted as plain text', () => {
      const data: OTPEmailData = {
        otp: '666666',
        type: 'sign-in'
      };

      const text = generateOTPEmailText(data);

      expect(text).toContain('\n');
      expect(text.trim().length).toBeGreaterThan(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle very long OTP codes', () => {
      const data: OTPEmailData = {
        otp: '123456789012345678',
        type: 'sign-in'
      };

      const html = generateOTPEmailHtml(data);
      const text = generateOTPEmailText(data);

      expect(html).toContain('123456789012345678');
      expect(text).toContain('123456789012345678');
    });

    it('should handle zero expiry time', () => {
      const data: OTPEmailData = {
        otp: '123456',
        type: 'sign-in',
        expiresInMinutes: 0
      };

      const html = generateOTPEmailHtml(data);
      const text = generateOTPEmailText(data);

      expect(html).toContain('This code will expire in 0 minutes');
      expect(text).toContain('This code will expire in 0 minutes');
    });

    it('should handle very large expiry time', () => {
      const data: OTPEmailData = {
        otp: '123456',
        type: 'sign-in',
        expiresInMinutes: 99999
      };

      const html = generateOTPEmailHtml(data);
      const text = generateOTPEmailText(data);

      expect(html).toContain('This code will expire in 99999 minutes');
      expect(text).toContain('This code will expire in 99999 minutes');
    });

    it('should handle OTP with special characters', () => {
      const data: OTPEmailData = {
        otp: 'ABC-123',
        type: 'sign-in'
      };

      const html = generateOTPEmailHtml(data);
      const text = generateOTPEmailText(data);

      expect(html).toContain('ABC-123');
      expect(text).toContain('ABC-123');
    });
  });
});
