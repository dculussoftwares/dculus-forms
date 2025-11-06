import { describe, it, expect } from 'vitest';
import { generateResetPasswordEmailHtml, generateResetPasswordEmailText, ResetPasswordEmailData } from '../resetPasswordEmail.js';

describe('Reset Password Email Templates', () => {
  describe('generateResetPasswordEmailHtml', () => {
    it('should generate HTML with reset URL', () => {
      const data: ResetPasswordEmailData = {
        userEmail: 'test@example.com',
        resetUrl: 'https://dculus.com/reset?token=abc123',
        expiresInHours: 1
      };

      const html = generateResetPasswordEmailHtml(data);

      expect(html).toContain('https://dculus.com/reset?token=abc123');
      expect(html).toContain('Reset My Password');
    });

    it('should display correct expiry time in singular form', () => {
      const data: ResetPasswordEmailData = {
        userEmail: 'test@example.com',
        resetUrl: 'https://dculus.com/reset?token=abc123',
        expiresInHours: 1
      };

      const html = generateResetPasswordEmailHtml(data);

      expect(html).toContain('This reset link will expire in 1 hour');
      expect(html).not.toContain('1 hours');
    });

    it('should display correct expiry time in plural form', () => {
      const data: ResetPasswordEmailData = {
        userEmail: 'test@example.com',
        resetUrl: 'https://dculus.com/reset?token=abc123',
        expiresInHours: 24
      };

      const html = generateResetPasswordEmailHtml(data);

      expect(html).toContain('This reset link will expire in 24 hours');
    });

    it('should use default expiry time when not provided', () => {
      const data: ResetPasswordEmailData = {
        userEmail: 'test@example.com',
        resetUrl: 'https://dculus.com/reset?token=abc123'
      };

      const html = generateResetPasswordEmailHtml(data);

      expect(html).toContain('This reset link will expire in 1 hour');
    });

    it('should include security warnings', () => {
      const data: ResetPasswordEmailData = {
        userEmail: 'test@example.com',
        resetUrl: 'https://dculus.com/reset?token=abc123'
      };

      const html = generateResetPasswordEmailHtml(data);

      expect(html).toContain('If you didn\'t request a password reset');
      expect(html).toContain('this link can only be used once');
    });

    it('should include Dculus Forms branding', () => {
      const data: ResetPasswordEmailData = {
        userEmail: 'test@example.com',
        resetUrl: 'https://dculus.com/reset?token=abc123'
      };

      const html = generateResetPasswordEmailHtml(data);

      expect(html).toContain('🔐');
      expect(html).toContain('Dculus Forms');
    });

    it('should include alternative link for button issues', () => {
      const data: ResetPasswordEmailData = {
        userEmail: 'test@example.com',
        resetUrl: 'https://dculus.com/reset?token=xyz789'
      };

      const html = generateResetPasswordEmailHtml(data);

      expect(html).toContain('If you\'re having trouble with the button');
      expect(html).toContain('https://dculus.com/reset?token=xyz789');
    });

    it('should include support links in footer', () => {
      const data: ResetPasswordEmailData = {
        userEmail: 'test@example.com',
        resetUrl: 'https://dculus.com/reset?token=abc123'
      };

      const html = generateResetPasswordEmailHtml(data);

      expect(html).toContain('https://dculus.com/support');
      expect(html).toContain('https://dculus.com');
    });

    it('should generate valid HTML structure', () => {
      const data: ResetPasswordEmailData = {
        userEmail: 'test@example.com',
        resetUrl: 'https://dculus.com/reset?token=abc123'
      };

      const html = generateResetPasswordEmailHtml(data);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<head>');
      expect(html).toContain('<body>');
      expect(html).toContain('</html>');
    });

    it('should include responsive CSS styles', () => {
      const data: ResetPasswordEmailData = {
        userEmail: 'test@example.com',
        resetUrl: 'https://dculus.com/reset?token=abc123'
      };

      const html = generateResetPasswordEmailHtml(data);

      expect(html).toContain('<style>');
      expect(html).toContain('@media only screen and (max-width: 480px)');
    });

    it('should include proper title', () => {
      const data: ResetPasswordEmailData = {
        userEmail: 'test@example.com',
        resetUrl: 'https://dculus.com/reset?token=abc123'
      };

      const html = generateResetPasswordEmailHtml(data);

      expect(html).toContain('<title>Reset Your Password - Dculus Forms</title>');
      expect(html).toContain('Reset Your Password');
    });
  });

  describe('generateResetPasswordEmailText', () => {
    it('should generate plain text with reset URL', () => {
      const data: ResetPasswordEmailData = {
        userEmail: 'test@example.com',
        resetUrl: 'https://dculus.com/reset?token=abc123',
        expiresInHours: 1
      };

      const text = generateResetPasswordEmailText(data);

      expect(text).toContain('https://dculus.com/reset?token=abc123');
      expect(text).toContain('Reset Your Password');
    });

    it('should display correct expiry time in singular form', () => {
      const data: ResetPasswordEmailData = {
        userEmail: 'test@example.com',
        resetUrl: 'https://dculus.com/reset?token=abc123',
        expiresInHours: 1
      };

      const text = generateResetPasswordEmailText(data);

      expect(text).toContain('This reset link will expire in 1 hour');
      expect(text).not.toContain('1 hours');
    });

    it('should display correct expiry time in plural form', () => {
      const data: ResetPasswordEmailData = {
        userEmail: 'test@example.com',
        resetUrl: 'https://dculus.com/reset?token=abc123',
        expiresInHours: 48
      };

      const text = generateResetPasswordEmailText(data);

      expect(text).toContain('This reset link will expire in 48 hours');
    });

    it('should use default expiry time when not provided', () => {
      const data: ResetPasswordEmailData = {
        userEmail: 'test@example.com',
        resetUrl: 'https://dculus.com/reset?token=abc123'
      };

      const text = generateResetPasswordEmailText(data);

      expect(text).toContain('This reset link will expire in 1 hour');
    });

    it('should include security warnings', () => {
      const data: ResetPasswordEmailData = {
        userEmail: 'test@example.com',
        resetUrl: 'https://dculus.com/reset?token=abc123'
      };

      const text = generateResetPasswordEmailText(data);

      expect(text).toContain('If you didn\'t request a password reset');
      expect(text).toContain('this link can only be used once');
    });

    it('should include support links', () => {
      const data: ResetPasswordEmailData = {
        userEmail: 'test@example.com',
        resetUrl: 'https://dculus.com/reset?token=abc123'
      };

      const text = generateResetPasswordEmailText(data);

      expect(text).toContain('https://dculus.com/support');
      expect(text).toContain('https://dculus.com');
    });

    it('should not contain HTML tags', () => {
      const data: ResetPasswordEmailData = {
        userEmail: 'test@example.com',
        resetUrl: 'https://dculus.com/reset?token=abc123'
      };

      const text = generateResetPasswordEmailText(data);

      expect(text).not.toContain('<html>');
      expect(text).not.toContain('<div>');
      expect(text).not.toContain('<style>');
    });

    it('should be properly formatted as plain text', () => {
      const data: ResetPasswordEmailData = {
        userEmail: 'test@example.com',
        resetUrl: 'https://dculus.com/reset?token=abc123'
      };

      const text = generateResetPasswordEmailText(data);

      expect(text).toContain('\n');
      expect(text.trim().length).toBeGreaterThan(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle very long reset URLs', () => {
      const data: ResetPasswordEmailData = {
        userEmail: 'test@example.com',
        resetUrl: 'https://dculus.com/reset?token=' + 'a'.repeat(500),
        expiresInHours: 1
      };

      const html = generateResetPasswordEmailHtml(data);
      const text = generateResetPasswordEmailText(data);

      expect(html).toContain('https://dculus.com/reset?token=');
      expect(text).toContain('https://dculus.com/reset?token=');
    });

    it('should handle zero expiry time', () => {
      const data: ResetPasswordEmailData = {
        userEmail: 'test@example.com',
        resetUrl: 'https://dculus.com/reset?token=abc123',
        expiresInHours: 0
      };

      const html = generateResetPasswordEmailHtml(data);
      const text = generateResetPasswordEmailText(data);

      expect(html).toContain('0 hour');
      expect(text).toContain('0 hour');
    });

    it('should handle very large expiry time', () => {
      const data: ResetPasswordEmailData = {
        userEmail: 'test@example.com',
        resetUrl: 'https://dculus.com/reset?token=abc123',
        expiresInHours: 999
      };

      const html = generateResetPasswordEmailHtml(data);
      const text = generateResetPasswordEmailText(data);

      expect(html).toContain('999 hours');
      expect(text).toContain('999 hours');
    });

    it('should handle URLs with special characters', () => {
      const data: ResetPasswordEmailData = {
        userEmail: 'test@example.com',
        resetUrl: 'https://dculus.com/reset?token=abc-123_xyz&user=test',
        expiresInHours: 1
      };

      const html = generateResetPasswordEmailHtml(data);
      const text = generateResetPasswordEmailText(data);

      expect(html).toContain('https://dculus.com/reset?token=abc-123_xyz&user=test');
      expect(text).toContain('https://dculus.com/reset?token=abc-123_xyz&user=test');
    });
  });
});
