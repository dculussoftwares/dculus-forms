import nodemailer from 'nodemailer';
import { emailConfig } from '../lib/env.js';
import { generateFormPublishedHtml } from '../templates/formPublishedEmail.js';
import { generateOTPEmailHtml, generateOTPEmailText, type OTPEmailData } from '../templates/otpEmail.js';
import { generateResetPasswordEmailHtml, generateResetPasswordEmailText, type ResetPasswordEmailData } from '../templates/resetPasswordEmail.js';

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