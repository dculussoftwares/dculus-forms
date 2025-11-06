import { describe, it, expect } from 'vitest';
import { generateInvitationEmailHtml, generateInvitationEmailText, InvitationEmailData } from '../invitationEmail.js';

describe('Invitation Email Templates', () => {
  describe('generateInvitationEmailHtml', () => {
    it('should generate HTML with organization and inviter details', () => {
      const data: InvitationEmailData = {
        to: 'user@example.com',
        organizationName: 'Acme Corp',
        inviterName: 'John Doe',
        invitationUrl: 'https://dculus.com/invite/abc123',
        expiresInHours: 48
      };

      const html = generateInvitationEmailHtml(data);

      expect(html).toContain('Acme Corp');
      expect(html).toContain('John Doe');
      expect(html).toContain('https://dculus.com/invite/abc123');
    });

    it('should display correct expiry time', () => {
      const data: InvitationEmailData = {
        to: 'user@example.com',
        organizationName: 'Test Org',
        inviterName: 'Jane Smith',
        invitationUrl: 'https://dculus.com/invite/xyz789',
        expiresInHours: 24
      };

      const html = generateInvitationEmailHtml(data);

      expect(html).toContain('24 hours');
    });

    it('should use default expiry time when not provided', () => {
      const data: InvitationEmailData = {
        to: 'user@example.com',
        organizationName: 'Test Org',
        inviterName: 'Jane Smith',
        invitationUrl: 'https://dculus.com/invite/xyz789'
      };

      const html = generateInvitationEmailHtml(data);

      expect(html).toContain('48 hours');
    });

    it('should include security notice with recipient email', () => {
      const data: InvitationEmailData = {
        to: 'secure@example.com',
        organizationName: 'Test Org',
        inviterName: 'Jane Smith',
        invitationUrl: 'https://dculus.com/invite/xyz789'
      };

      const html = generateInvitationEmailHtml(data);

      expect(html).toContain('Security Notice');
      expect(html).toContain('secure@example.com');
    });

    it('should include Dculus Forms branding', () => {
      const data: InvitationEmailData = {
        to: 'user@example.com',
        organizationName: 'Test Org',
        inviterName: 'Jane Smith',
        invitationUrl: 'https://dculus.com/invite/xyz789'
      };

      const html = generateInvitationEmailHtml(data);

      expect(html).toContain('🚀 Dculus Forms');
      expect(html).toContain('You\'re Invited!');
    });

    it('should include accept invitation button', () => {
      const data: InvitationEmailData = {
        to: 'user@example.com',
        organizationName: 'Test Org',
        inviterName: 'Jane Smith',
        invitationUrl: 'https://dculus.com/invite/xyz789'
      };

      const html = generateInvitationEmailHtml(data);

      expect(html).toContain('Accept Invitation');
      expect(html).toContain('class="cta-button"');
    });

    it('should include alternative link for button issues', () => {
      const data: InvitationEmailData = {
        to: 'user@example.com',
        organizationName: 'Test Org',
        inviterName: 'Jane Smith',
        invitationUrl: 'https://dculus.com/invite/xyz789'
      };

      const html = generateInvitationEmailHtml(data);

      expect(html).toContain('Having trouble with the button');
    });

    it('should generate valid HTML structure', () => {
      const data: InvitationEmailData = {
        to: 'user@example.com',
        organizationName: 'Test Org',
        inviterName: 'Jane Smith',
        invitationUrl: 'https://dculus.com/invite/xyz789'
      };

      const html = generateInvitationEmailHtml(data);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<head>');
      expect(html).toContain('<body>');
      expect(html).toContain('</html>');
    });
  });

  describe('generateInvitationEmailText', () => {
    it('should generate plain text with organization and inviter details', () => {
      const data: InvitationEmailData = {
        to: 'user@example.com',
        organizationName: 'Acme Corp',
        inviterName: 'John Doe',
        invitationUrl: 'https://dculus.com/invite/abc123',
        expiresInHours: 48
      };

      const text = generateInvitationEmailText(data);

      expect(text).toContain('Acme Corp');
      expect(text).toContain('John Doe');
      expect(text).toContain('https://dculus.com/invite/abc123');
    });

    it('should display correct expiry time', () => {
      const data: InvitationEmailData = {
        to: 'user@example.com',
        organizationName: 'Test Org',
        inviterName: 'Jane Smith',
        invitationUrl: 'https://dculus.com/invite/xyz789',
        expiresInHours: 72
      };

      const text = generateInvitationEmailText(data);

      expect(text).toContain('72 hours');
    });

    it('should use default expiry time when not provided', () => {
      const data: InvitationEmailData = {
        to: 'user@example.com',
        organizationName: 'Test Org',
        inviterName: 'Jane Smith',
        invitationUrl: 'https://dculus.com/invite/xyz789'
      };

      const text = generateInvitationEmailText(data);

      expect(text).toContain('48 hours');
    });

    it('should include security notice with recipient email', () => {
      const data: InvitationEmailData = {
        to: 'secure@example.com',
        organizationName: 'Test Org',
        inviterName: 'Jane Smith',
        invitationUrl: 'https://dculus.com/invite/xyz789'
      };

      const text = generateInvitationEmailText(data);

      expect(text).toContain('Security Notice');
      expect(text).toContain('secure@example.com');
    });

    it('should not contain HTML tags', () => {
      const data: InvitationEmailData = {
        to: 'user@example.com',
        organizationName: 'Test Org',
        inviterName: 'Jane Smith',
        invitationUrl: 'https://dculus.com/invite/xyz789'
      };

      const text = generateInvitationEmailText(data);

      expect(text).not.toContain('<html>');
      expect(text).not.toContain('<div>');
      expect(text).not.toContain('<style>');
    });
  });
});
