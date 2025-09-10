import nodemailer from 'nodemailer';
import { emailConfig } from '../lib/env.js';
import { generateFormPublishedHtml } from '../templates/formPublishedEmail.js';

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