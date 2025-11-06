import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sendEmail,
  sendFormPublishedNotification,
  sendOTPEmail,
  sendResetPasswordEmail,
  sendInvitationEmail,
} from '../emailService.js';
import nodemailer from 'nodemailer';
import { emailConfig } from '../../lib/env.js';
import { generateFormPublishedHtml } from '../../templates/formPublishedEmail.js';
import { generateOTPEmailHtml, generateOTPEmailText } from '../../templates/otpEmail.js';
import { generateResetPasswordEmailHtml, generateResetPasswordEmailText } from '../../templates/resetPasswordEmail.js';
import { generateInvitationEmailHtml, generateInvitationEmailText } from '../../templates/invitationEmail.js';
import { logger } from '../../lib/logger.js';

// Mock all dependencies
vi.mock('nodemailer');
vi.mock('../../lib/env.js');
vi.mock('../../templates/formPublishedEmail.js');
vi.mock('../../templates/otpEmail.js');
vi.mock('../../templates/resetPasswordEmail.js');
vi.mock('../../templates/invitationEmail.js');

describe('Email Service', () => {
  const mockTransporter = {
    sendMail: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(nodemailer.createTransport).mockReturnValue(mockTransporter as any);
    vi.mocked(emailConfig).host = 'smtp.example.com';
    vi.mocked(emailConfig).port = 587;
    vi.mocked(emailConfig).user = 'test@example.com';
    vi.mocked(emailConfig).password = 'password123';
    vi.mocked(emailConfig).from = 'noreply@example.com';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sendEmail', () => {
    it('should send email successfully', async () => {
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });

      await sendEmail({
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML</p>',
        text: 'Test Text',
      });

      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@example.com',
          pass: 'password123',
        },
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'noreply@example.com',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML</p>',
        text: 'Test Text',
      });
    });

    it('should send email without text parameter', async () => {
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });

      await sendEmail({
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML</p>',
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'noreply@example.com',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML</p>',
        text: undefined,
      });
    });

    it('should throw error when email sending fails', async () => {
      const error = new Error('SMTP connection failed');
      mockTransporter.sendMail.mockRejectedValue(error);

      await expect(
        sendEmail({
          to: 'recipient@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
        })
      ).rejects.toThrow('Failed to send email: SMTP connection failed');
    });

    it('should handle non-Error exceptions', async () => {
      mockTransporter.sendMail.mockRejectedValue('String error');

      await expect(
        sendEmail({
          to: 'recipient@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
        })
      ).rejects.toThrow('Failed to send email: Unknown error');
    });

    it('should log success message', async () => {
      const loggerInfo = vi.spyOn(logger, 'info').mockImplementation(() => {});
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });

      await sendEmail({
        to: 'recipient@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(loggerInfo).toHaveBeenCalledWith('Email sent successfully to: recipient@example.com');
      loggerInfo.mockRestore();
    });
  });

  describe('sendFormPublishedNotification', () => {
    it('should send form published notification', async () => {
      const mockHtml = '<html>Form published</html>';
      vi.mocked(generateFormPublishedHtml).mockReturnValue(mockHtml);
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-id' });

      const formData = {
        formTitle: 'Contact Form',
        formDescription: 'A contact form',
        formUrl: 'https://example.com/form/123',
        ownerName: 'John Doe',
      };

      await sendFormPublishedNotification(formData, 'owner@example.com');

      expect(generateFormPublishedHtml).toHaveBeenCalledWith(formData);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'noreply@example.com',
        to: 'owner@example.com',
        subject: '🎉 Your form "Contact Form" is now published!',
        html: mockHtml,
        text: expect.stringContaining('Contact Form'),
      });
    });

    it('should handle form without description', async () => {
      vi.mocked(generateFormPublishedHtml).mockReturnValue('<html>Test</html>');
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-id' });

      const formData = {
        formTitle: 'Simple Form',
        formUrl: 'https://example.com/form/456',
        ownerName: 'Jane Smith',
      };

      await sendFormPublishedNotification(formData, 'owner@example.com');

      expect(generateFormPublishedHtml).toHaveBeenCalledWith(formData);
    });
  });

  describe('sendOTPEmail', () => {
    beforeEach(() => {
      vi.mocked(generateOTPEmailHtml).mockReturnValue('<html>OTP Email</html>');
      vi.mocked(generateOTPEmailText).mockReturnValue('OTP: 123456');
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-id' });
    });

    it('should send OTP email for sign-in', async () => {
      await sendOTPEmail({
        to: 'user@example.com',
        otp: '123456',
        type: 'sign-in',
      });

      expect(generateOTPEmailHtml).toHaveBeenCalledWith({
        otp: '123456',
        type: 'sign-in',
        expiresInMinutes: 5,
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'noreply@example.com',
        to: 'user@example.com',
        subject: '🔐 Your sign-in code: 123456',
        html: '<html>OTP Email</html>',
        text: 'OTP: 123456',
      });
    });

    it('should send OTP email for sign-up', async () => {
      await sendOTPEmail({
        to: 'user@example.com',
        otp: '654321',
        type: 'sign-up',
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: '🎉 Welcome to Dculus Forms - Verify your account',
        })
      );
    });

    it('should send OTP email for email verification', async () => {
      await sendOTPEmail({
        to: 'user@example.com',
        otp: '111111',
        type: 'email-verification',
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: '✅ Verify your email address',
        })
      );
    });

    it('should send OTP email for forget password', async () => {
      await sendOTPEmail({
        to: 'user@example.com',
        otp: '222222',
        type: 'forget-password',
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: '🔑 Reset your password',
        })
      );
    });

    it('should log success message', async () => {
      const loggerInfo = vi.spyOn(logger, 'info').mockImplementation(() => {});

      await sendOTPEmail({
        to: 'user@example.com',
        otp: '123456',
        type: 'sign-in',
      });

      expect(loggerInfo).toHaveBeenCalledWith(
        'OTP email sent successfully to: user@example.com (Type: sign-in)'
      );
      loggerInfo.mockRestore();
    });
  });

  describe('sendResetPasswordEmail', () => {
    beforeEach(() => {
      vi.mocked(generateResetPasswordEmailHtml).mockReturnValue('<html>Reset Password</html>');
      vi.mocked(generateResetPasswordEmailText).mockReturnValue('Reset your password');
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-id' });
    });

    it('should send reset password email with default expiry', async () => {
      await sendResetPasswordEmail({
        to: 'user@example.com',
        resetUrl: 'https://example.com/reset/token123',
      });

      expect(generateResetPasswordEmailHtml).toHaveBeenCalledWith({
        userEmail: 'user@example.com',
        resetUrl: 'https://example.com/reset/token123',
        expiresInHours: 1,
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'noreply@example.com',
        to: 'user@example.com',
        subject: '🔑 Reset your password - Dculus Forms',
        html: '<html>Reset Password</html>',
        text: 'Reset your password',
      });
    });

    it('should send reset password email with custom expiry', async () => {
      await sendResetPasswordEmail({
        to: 'user@example.com',
        resetUrl: 'https://example.com/reset/token456',
        expiresInHours: 2,
      });

      expect(generateResetPasswordEmailHtml).toHaveBeenCalledWith({
        userEmail: 'user@example.com',
        resetUrl: 'https://example.com/reset/token456',
        expiresInHours: 2,
      });
    });

    it('should log success message', async () => {
      const loggerInfo = vi.spyOn(logger, 'info').mockImplementation(() => {});

      await sendResetPasswordEmail({
        to: 'user@example.com',
        resetUrl: 'https://example.com/reset/token123',
      });

      expect(loggerInfo).toHaveBeenCalledWith(
        'Password reset email sent successfully to: user@example.com'
      );
      loggerInfo.mockRestore();
    });
  });

  describe('sendInvitationEmail', () => {
    beforeEach(() => {
      vi.mocked(generateInvitationEmailHtml).mockReturnValue('<html>Invitation</html>');
      vi.mocked(generateInvitationEmailText).mockReturnValue('You are invited');
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-id' });
    });

    it('should send invitation email with default form app URL', async () => {
      delete process.env.FORM_APP_URL;

      await sendInvitationEmail({
        to: 'newuser@example.com',
        invitationId: 'inv-123',
        organizationName: 'Acme Corp',
        inviterName: 'John Doe',
      });

      expect(generateInvitationEmailHtml).toHaveBeenCalledWith({
        to: 'newuser@example.com',
        organizationName: 'Acme Corp',
        inviterName: 'John Doe',
        invitationUrl: 'http://localhost:3000/invite/inv-123',
        expiresInHours: 48,
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'noreply@example.com',
        to: 'newuser@example.com',
        subject: "🎉 You've been invited to join Acme Corp on Dculus Forms",
        html: '<html>Invitation</html>',
        text: 'You are invited',
      });
    });

    it('should send invitation email with custom form app URL', async () => {
      process.env.FORM_APP_URL = 'https://app.example.com';

      await sendInvitationEmail({
        to: 'newuser@example.com',
        invitationId: 'inv-456',
        organizationName: 'Tech Startup',
        inviterName: 'Jane Smith',
      });

      expect(generateInvitationEmailHtml).toHaveBeenCalledWith({
        to: 'newuser@example.com',
        organizationName: 'Tech Startup',
        inviterName: 'Jane Smith',
        invitationUrl: 'https://app.example.com/invite/inv-456',
        expiresInHours: 48,
      });

      delete process.env.FORM_APP_URL;
    });

    it('should log success message', async () => {
      const loggerInfo = vi.spyOn(logger, 'info').mockImplementation(() => {});

      await sendInvitationEmail({
        to: 'newuser@example.com',
        invitationId: 'inv-789',
        organizationName: 'My Organization',
        inviterName: 'Admin User',
      });

      expect(loggerInfo).toHaveBeenCalledWith(
        'Invitation email sent successfully to: newuser@example.com for organization: My Organization'
      );
      loggerInfo.mockRestore();
    });
  });
});
