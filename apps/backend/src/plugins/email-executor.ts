import nodemailer from 'nodemailer';
import { emailConfig } from '../lib/env.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ExecutionContext {
  pluginConfigId: string;
  event: string;
  payload: Record<string, any>;
  config: Record<string, any>;
  formId: string;
}

export interface ExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Email Plugin Executor
 *
 * Sends email notifications when form events occur.
 * Supports field substitution in subject and message.
 */
export async function executeEmailPlugin(context: ExecutionContext): Promise<ExecutionResult> {
  const { config, payload, formId } = context;

  try {
    // Get form details
    const form = await prisma.form.findUnique({
      where: { id: formId }
    });

    if (!form) {
      throw new Error('Form not found');
    }

    // Create transporter using existing email configuration
    const transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: false,
      auth: {
        user: emailConfig.user,
        pass: emailConfig.password,
      },
    });

    // Render email template with form data
    const subject = renderTemplate(config.subject || 'New Form Submission', payload);
    const htmlBody = renderEmailTemplate(config.message || 'You received a new form submission!', payload, form.title);

    // Send email to configured recipient
    const result = await transporter.sendMail({
      from: emailConfig.from,
      to: config.recipientEmail,
      subject,
      html: htmlBody
    });

    // Optionally send to submitter if configured
    if (config.sendToSubmitter && config.submitterEmailFieldId && payload[config.submitterEmailFieldId]) {
      const submitterEmail = payload[config.submitterEmailFieldId];
      await transporter.sendMail({
        from: emailConfig.from,
        to: submitterEmail,
        subject: `Thank you for your submission - ${form.title}`,
        html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Thank you for your submission!</h2>
          <p>We've received your form submission for <strong>${form.title}</strong>.</p>
          <p>We'll get back to you soon.</p>
        </div>`
      });
    }

    await prisma.$disconnect();

    return {
      success: true,
      data: { messageId: result.messageId }
    };
  } catch (error: any) {
    await prisma.$disconnect();
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Render template with field substitution
 * Supports {{fieldId}} syntax
 */
function renderTemplate(template: string, data: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, field) => {
    return data[field] !== undefined ? String(data[field]) : match;
  });
}

/**
 * Render HTML email template
 */
function renderEmailTemplate(message: string, data: Record<string, any>, formTitle: string): string {
  const renderedMessage = renderTemplate(message, data);

  // Build field values table
  const fieldsHtml = Object.entries(data)
    .map(([key, value]) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: 600;">${key}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${value}</td>
      </tr>
    `)
    .join('');

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; color: #111827;">New Form Submission</h2>
        <p style="margin: 10px 0 0 0; color: #6b7280;">${formTitle}</p>
      </div>

      <div style="padding: 20px; background-color: #ffffff;">
        <div style="margin-bottom: 20px;">
          ${renderedMessage}
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
