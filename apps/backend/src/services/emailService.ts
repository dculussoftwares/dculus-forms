import nodemailer from 'nodemailer';
import { emailConfig } from '../lib/env.js';
import { generateFormPublishedHtml } from '../templates/formPublishedEmail.js';
import { generateOTPEmailHtml, generateOTPEmailText, type OTPEmailData } from '../templates/otpEmail.js';
import { generateResetPasswordEmailHtml, generateResetPasswordEmailText, type ResetPasswordEmailData } from '../templates/resetPasswordEmail.js';
import { generateInvitationEmailHtml, generateInvitationEmailText, type InvitationEmailData } from '../templates/invitationEmail.js';
import { generateMagicLinkEmailHtml, generateMagicLinkEmailText } from '../templates/magicLinkEmail.js';
import {
  generateAutomationFailureEmailHtml,
  generateAutomationFailureEmailText,
} from '../templates/automationFailureEmail.js';
import { logger } from '../lib/logger.js';

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

export interface FormPublishedEmailData {
  formTitle: string;
  formDescription?: string;
  formUrl: string;
  ownerName: string;
}

export interface SendOTPEmailOptions {
  to: string;
  otp: string;
  type: 'sign-in' | 'sign-up' | 'email-verification' | 'forget-password' | 'change-email';
}

export interface SendResetPasswordEmailOptions {
  to: string;
  resetUrl: string;
  expiresInHours?: number;
}

export interface SendInvitationEmailOptions {
  to: string;
  invitationId: string;
  organizationName: string;
  inviterName: string;
}

export interface SendMagicLinkEmailOptions {
  to: string;
  url: string;
}

// Create transporter instance
// P2-11: Enforce TLS for outbound email.
//   port 465 → implicit TLS (secure: true, requireTLS not needed)
//   other ports (587, 25) → STARTTLS upgrade required (requireTLS: true prevents
//   silent downgrade to plaintext when the server advertises STARTTLS).
const createTransporter = () => {
  const port = emailConfig.port;
  return nodemailer.createTransport({
    host: emailConfig.host,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: {
      user: emailConfig.user,
      pass: emailConfig.password,
    },
  });
};

export async function sendEmail(options: EmailOptions): Promise<void> {
  try {
    const transporter = createTransporter();
    const mailOptions = {
      from: emailConfig.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType ?? 'application/octet-stream',
      })),
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Email sent successfully to: ${options.to}`);
  } catch (error) {
    logger.error('Failed to send email:', error);
    throw new Error(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function sendFormPublishedNotification(data: FormPublishedEmailData, recipientEmail: string): Promise<void> {
  const html = generateFormPublishedHtml(data);
  const text = `Congratulations! Your form "${data.formTitle}" has been published and is now live at: ${data.formUrl}`;

  await sendEmail({
    to: recipientEmail,
    subject: `🎉 Your form "${data.formTitle}" is now published!`,
    html,
    text,
  });
}

export async function sendOTPEmail(options: SendOTPEmailOptions): Promise<void> {
  const { to, otp, type } = options;
  const expiresInMinutes = 5;

  const otpData: OTPEmailData = {
    otp,
    type,
    expiresInMinutes,
  };

  const getSubject = () => {
    switch (type) {
      case 'sign-in':
        return `🔐 Your sign-in code: ${otp}`;
      case 'sign-up':
        return `🎉 Welcome to Dculus Forms - Verify your account`;
      case 'email-verification':
        return `✅ Verify your email address`;
      case 'forget-password':
        return `🔑 Reset your password`;
      default:
        return `🔐 Your verification code: ${otp}`;
    }
  };

  const html = generateOTPEmailHtml(otpData);
  const text = generateOTPEmailText(otpData);

  await sendEmail({
    to,
    subject: getSubject(),
    html,
    text,
  });

  logger.info(`OTP email sent successfully to: ${to} (Type: ${type})`);
}

export async function sendResetPasswordEmail(options: SendResetPasswordEmailOptions): Promise<void> {
  const { to, resetUrl, expiresInHours = 1 } = options;

  const resetPasswordData: ResetPasswordEmailData = {
    userEmail: to,
    resetUrl,
    expiresInHours,
  };

  const html = generateResetPasswordEmailHtml(resetPasswordData);
  const text = generateResetPasswordEmailText(resetPasswordData);

  await sendEmail({
    to,
    subject: '🔑 Reset your password - Dculus Forms',
    html,
    text,
  });

  logger.info(`Password reset email sent successfully to: ${to}`);
}

export async function sendInvitationEmail(options: SendInvitationEmailOptions): Promise<void> {
  const { to, invitationId, organizationName, inviterName } = options;
  const expiresInHours = 48;

  // Create invitation URL - this will point to the form app's invite handler
  const invitationUrl = `${process.env.FORM_APP_URL || 'http://localhost:3000'}/invite/${invitationId}`;

  const invitationData: InvitationEmailData = {
    to,
    organizationName,
    inviterName,
    invitationUrl,
    expiresInHours,
  };

  const html = generateInvitationEmailHtml(invitationData);
  const text = generateInvitationEmailText(invitationData);

  await sendEmail({
    to,
    subject: `🎉 You've been invited to join ${organizationName} on Dculus Forms`,
    html,
    text,
  });

  logger.info(`Invitation email sent successfully to: ${to} for organization: ${organizationName}`);
}

export async function sendMagicLinkEmail(options: SendMagicLinkEmailOptions): Promise<void> {
  const { to, url } = options;
  const expiresInMinutes = 5;

  const html = generateMagicLinkEmailHtml({ url, expiresInMinutes });
  const text = generateMagicLinkEmailText({ url, expiresInMinutes });

  await sendEmail({
    to,
    subject: '🔗 Your sign-in link for Dculus Forms',
    html,
    text,
  });

  logger.info(`Magic link email sent successfully to: ${to}`);
}
export interface SendAutomationFailureEmailOptions {
  to: string;
  ownerName: string;
  automationName: string;
  automationId: string;
  formId: string;
  runId: string;
  reason: 'first-failure' | 'auto-paused';
  consecutiveFailures: number;
}

/**
 * Tells an automation's owner that it is failing (gap G). Deep-links straight to the failed run —
 * the runs view already supports a `?runId=` param — because "an automation failed" is useless
 * without the step and error behind it.
 */
export async function sendAutomationFailureEmail(
  options: SendAutomationFailureEmailOptions
): Promise<void> {
  const { to, ownerName, automationName, automationId, formId, runId, reason, consecutiveFailures } =
    options;

  const baseUrl = process.env.FORM_APP_URL || 'http://localhost:3000';
  const runUrl = `${baseUrl}/dashboard/form/${formId}/builder/automations/${automationId}/runs?runId=${runId}`;

  const data = { ownerName, automationName, runUrl, reason, consecutiveFailures };

  await sendEmail({
    to,
    subject:
      reason === 'auto-paused'
        ? `\u26a0\ufe0f "${automationName}" has been paused after repeated failures`
        : `\u26a0\ufe0f A run of "${automationName}" failed`,
    html: generateAutomationFailureEmailHtml(data),
    text: generateAutomationFailureEmailText(data),
  });

  logger.info(`Automation failure email sent to ${to} (automation: ${automationId}, reason: ${reason})`);
}
