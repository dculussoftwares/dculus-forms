import express, { Express, Request, Response } from 'express';
import { Server } from 'http';
import { SMTPServer, SMTPServerSession } from 'smtp-server';
import { simpleParser, ParsedMail } from 'mailparser';
import { Readable } from 'stream';

/**
 * Mock Servers for Integration Tests
 *
 * Provides mock HTTP servers for testing webhooks and email delivery
 */

export interface ReceivedWebhookRequest {
  url: string;
  method: string;
  headers: Record<string, string | string[] | undefined>;
  body: any;
  timestamp: Date;
}

export interface MockServerConfig {
  port?: number;
  timeout?: number;
  simulateErrors?: boolean;
}

export class MockWebhookServer {
  private app: Express;
  private server: Server | null = null;
  private receivedRequests: ReceivedWebhookRequest[] = [];
  private config: MockServerConfig;
  private simulatedEndpoints: Map<string, { statusCode: number; delay?: number }> = new Map();

  constructor(config: MockServerConfig = {}) {
    this.config = {
      port: config.port || 9999,
      timeout: config.timeout || 30000,
      simulateErrors: config.simulateErrors ?? false,
    };

    this.app = express();
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    this.setupRoutes();
  }

  /**
   * Setup mock webhook endpoints
   */
  private setupRoutes(): void {
    // Catch-all route for webhook testing
    this.app.all('*', (req: Request, res: Response) => {
      const requestData: ReceivedWebhookRequest = {
        url: req.url,
        method: req.method,
        headers: req.headers as Record<string, string | string[] | undefined>,
        body: req.body,
        timestamp: new Date(),
      };

      // Store received request
      this.receivedRequests.push(requestData);

      console.log(
        `📥 Mock webhook received: ${req.method} ${req.url} at ${requestData.timestamp.toISOString()}`
      );

      // Check if this endpoint has simulated behavior
      const simulation = this.simulatedEndpoints.get(req.url);

      if (simulation) {
        // Simulate delay if configured
        if (simulation.delay) {
          setTimeout(() => {
            res.status(simulation.statusCode).json({ success: true });
          }, simulation.delay);
        } else {
          res.status(simulation.statusCode).json({ success: true });
        }
      } else {
        // Default successful response
        res.status(200).json({
          success: true,
          received: true,
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  /**
   * Start the mock webhook server
   */
  async start(port?: number): Promise<void> {
    const serverPort = port || this.config.port!;

    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(serverPort, () => {
          console.log(`✅ Mock Webhook Server started on port ${serverPort}`);
          resolve();
        });

        this.server.on('error', (error: any) => {
          if (error.code === 'EADDRINUSE') {
            console.warn(`⚠️  Port ${serverPort} is already in use, trying next port...`);
            this.start((port || serverPort) + 1).then(resolve).catch(reject);
          } else {
            reject(error);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the mock webhook server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('🛑 Mock Webhook Server stopped');
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get all received webhook requests
   */
  getReceivedRequests(): ReceivedWebhookRequest[] {
    return this.receivedRequests;
  }

  /**
   * Get requests to a specific URL
   */
  getRequestsByUrl(url: string): ReceivedWebhookRequest[] {
    return this.receivedRequests.filter((req) => req.url.includes(url));
  }

  /**
   * Clear all received requests
   */
  clearRequests(): void {
    this.receivedRequests = [];
    console.log('🧹 Cleared all received webhook requests');
  }

  /**
   * Simulate timeout for a specific endpoint
   */
  simulateTimeout(url: string, delay: number = 31000): void {
    this.simulatedEndpoints.set(url, {
      statusCode: 200,
      delay,
    });
    console.log(`⏱️  Simulating ${delay}ms delay for ${url}`);
  }

  /**
   * Simulate error response for a specific endpoint
   */
  simulateError(url: string, statusCode: number = 500): void {
    this.simulatedEndpoints.set(url, {
      statusCode,
    });
    console.log(`❌ Simulating ${statusCode} error for ${url}`);
  }

  /**
   * Reset simulated endpoints
   */
  resetSimulations(): void {
    this.simulatedEndpoints.clear();
    console.log('🔄 Reset all endpoint simulations');
  }

  /**
   * Verify a webhook was received with specific payload
   */
  verifyWebhookReceived(urlPattern: string, payloadMatcher?: (body: any) => boolean): boolean {
    const requests = this.receivedRequests.filter((req) => req.url.includes(urlPattern));

    if (requests.length === 0) {
      return false;
    }

    if (payloadMatcher) {
      return requests.some((req) => payloadMatcher(req.body));
    }

    return true;
  }

  /**
   * Get request count for a specific URL pattern
   */
  getRequestCount(urlPattern: string): number {
    return this.receivedRequests.filter((req) => req.url.includes(urlPattern)).length;
  }
}

/**
 * Mock SMTP Server for testing email delivery
 * Uses real SMTP server to capture emails sent by backend
 */
export interface CapturedEmail {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
  timestamp: Date;
}

export class MockSMTPServer {
  private server: SMTPServer | null = null;
  private capturedEmails: CapturedEmail[] = [];
  private port: number = 1025;

  /**
   * Start the mock SMTP server
   */
  async start(port: number = 1025): Promise<void> {
    this.port = port;
    this.capturedEmails = [];

    return new Promise((resolve, reject) => {
      this.server = new SMTPServer({
        authOptional: true,
        disabledCommands: ['STARTTLS'], // Disable TLS for local testing
        onData: (stream: Readable, session: SMTPServerSession, callback: (err?: Error | null) => void) => {
          this.handleEmailData(stream, session, callback);
        },
      });

      this.server.listen(this.port, () => {
        console.log(`✅ Mock SMTP Server started on port ${this.port}`);
        resolve();
      });

      this.server.on('error', (err) => {
        console.error('❌ Mock SMTP Server error:', err);
        reject(err);
      });
    });
  }

  /**
   * Handle incoming email data
   */
  private handleEmailData(
    stream: Readable,
    session: SMTPServerSession,
    callback: (err?: Error | null) => void
  ): void {
    simpleParser(stream, (err: any, parsed: ParsedMail) => {
      if (err) {
        console.error('Error parsing email:', err);
        callback(err);
        return;
      }

      // Extract email addresses from AddressObject
      const toAddress = parsed.to ? (Array.isArray(parsed.to) ? parsed.to[0]?.text : parsed.to.text) : '';
      const fromAddress = parsed.from ? (Array.isArray(parsed.from) ? parsed.from[0]?.text : parsed.from.text) : '';

      const email: CapturedEmail = {
        to: toAddress || '',
        from: fromAddress || '',
        subject: parsed.subject || '',
        text: parsed.text || '',
        html: (parsed.html as string) || '',
        timestamp: new Date(),
      };

      this.capturedEmails.push(email);
      console.log(`📧 Mock SMTP captured email to ${email.to}: ${email.subject}`);
      callback();
    });
  }

  /**
   * Stop the mock SMTP server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('🛑 Mock SMTP Server stopped');
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get all captured emails
   */
  getCapturedEmails(): CapturedEmail[] {
    return this.capturedEmails;
  }

  /**
   * Get the last captured email
   */
  getLastEmail(): CapturedEmail | undefined {
    return this.capturedEmails[this.capturedEmails.length - 1];
  }

  /**
   * Extract OTP code from email text
   */
  extractOTP(email: CapturedEmail | undefined): string | null {
    if (!email) {
      return null;
    }

    const text = email.text || '';
    const otpMatch = text.match(/\b\d{6}\b/);
    return otpMatch ? otpMatch[0] : null;
  }

  /**
   * Clear all captured emails
   */
  clearEmails(): void {
    this.capturedEmails = [];
    console.log('🧹 Cleared all captured emails');
  }

  /**
   * Verify an email was sent to a specific recipient
   */
  verifyEmailSent(to: string, subject?: string): boolean {
    return this.capturedEmails.some((email) => {
      const toMatches = email.to.includes(to);

      if (subject) {
        return toMatches && email.subject.includes(subject);
      }

      return toMatches;
    });
  }

  /**
   * Get emails sent to a specific recipient
   */
  getEmailsByRecipient(to: string): CapturedEmail[] {
    return this.capturedEmails.filter((email) => email.to.includes(to));
  }

  /**
   * Verify email content contains specific text
   */
  verifyEmailContent(to: string, contentMatcher: (text: string) => boolean): boolean {
    const emails = this.getEmailsByRecipient(to);
    return emails.some((email) => contentMatcher(email.text));
  }

  /**
   * Wait for email delivery (with timeout)
   */
  async waitForEmail(timeout: number = 5000): Promise<CapturedEmail | null> {
    const startTime = Date.now();
    const initialCount = this.capturedEmails.length;

    while (Date.now() - startTime < timeout) {
      if (this.capturedEmails.length > initialCount) {
        return this.getLastEmail() || null;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return null;
  }
}
