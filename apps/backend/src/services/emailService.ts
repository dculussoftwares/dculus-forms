import nodemailer from 'nodemailer';
import { emailConfig } from '../lib/env.js';
import { generateFormPublishedHtml } from '../templates/formPublishedEmail.js';
import { generateOTPEmailHtml, generateOTPEmailText, type OTPEmailData } from '../templates/otpEmail.js';
import { generateResetPasswordEmailHtml, generateResetPasswordEmailText, type ResetPasswordEmailData } from '../templates/resetPasswordEmail.js';
import { generateInvitationEmailHtml, generateInvitationEmailText, type InvitationEmailData } from '../templates/invitationEmail.js';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
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
  type: 'sign-in' | 'sign-up' | 'email-verification' | 'forget-password';
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

export interface FormSubmissionEmailData {
  formTitle: string;
  subject: string;
  message: string;
  submissionData: Record<string, any>;
  recipientEmail: string;
}

// Create transporter instance
const createTransporter = () => {
  return nodemailer.createTransport({
    host: emailConfig.host,
    port: emailConfig.port,
    secure: false, // true for 465, false for other ports
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
    };

    await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to: ${options.to}`);
  } catch (error) {
    console.error('Failed to send email:', error);
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

  console.log(`OTP email sent successfully to: ${to} (Type: ${type})`);
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

  console.log(`Password reset email sent successfully to: ${to}`);
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

  console.log(`Invitation email sent successfully to: ${to} for organization: ${organizationName}`);
}

/**
 * Send form submission notification email
 * Used by email plugin to send notifications when forms are submitted
 */
export async function sendFormSubmissionEmail(data: FormSubmissionEmailData): Promise<string> {
  const { formTitle, subject, message, submissionData, recipientEmail } = data;

  // Render HTML email template
  const html = renderFormSubmissionEmailTemplate(message, submissionData, formTitle);
  const text = `${message}\n\n${Object.entries(submissionData)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')}`;

  const transporter = createTransporter();
  const result = await transporter.sendMail({
    from: emailConfig.from,
    to: recipientEmail,
    subject,
    html,
    text,
  });

  console.log(`Form submission email sent successfully to: ${recipientEmail}`);
  return result.messageId;
}

/**
 * Render HTML email template for form submissions
 */
function renderFormSubmissionEmailTemplate(
  message: string,
  submissionData: Record<string, any>,
  formTitle: string
): string {
  // Build field values table
  const fieldsHtml = Object.entries(submissionData)
    .map(
      ([key, value]) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: 600;">${key}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${value}</td>
      </tr>
    `
    )
    .join('');

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; color: #111827;">New Form Submission</h2>
        <p style="margin: 10px 0 0 0; color: #6b7280;">${formTitle}</p>
      </div>

      <div style="padding: 20px; background-color: #ffffff;">
        <div style="margin-bottom: 20px;">
          ${message}
        </div>

        <h3 style="color: #374151; margin-bottom: 15px;">Submission Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${fieldsHtml}
        </table>

        <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">
          Submitted: ${new Date().toLocaleString()}
        </p>
      </div>

      <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-radius: 0 0 8px 8px;">
        <p style="margin: 0; color: #9ca3af; font-size: 12px;">
          Powered by Dculus Forms
        </p>
      </div>
    </div>
  `;
}