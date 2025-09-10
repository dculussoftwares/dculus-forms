import { FormPublishedEmailData } from '../services/emailService.js';

export function generateFormPublishedHtml(data: FormPublishedEmailData): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your Form is Now Published</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8fafc;
        }
        .container {
          background-color: #ffffff;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          padding: 40px;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo {
          font-size: 24px;
          font-weight: bold;
          color: #3b82f6;
          margin-bottom: 20px;
        }
        .title {
          font-size: 28px;
          font-weight: bold;
          color: #1f2937;
          margin-bottom: 10px;
        }
        .subtitle {
          font-size: 16px;
          color: #6b7280;
          margin-bottom: 30px;
        }
        .form-details {
          background-color: #f3f4f6;
          border-radius: 6px;
          padding: 24px;
          margin: 30px 0;
        }
        .form-title {
          font-size: 20px;
          font-weight: bold;
          color: #1f2937;
          margin-bottom: 8px;
        }
        .form-description {
          color: #6b7280;
          font-size: 14px;
          margin-bottom: 20px;
        }
        .cta-button {
          display: inline-block;
          background-color: #3b82f6;
          color: #ffffff;
          text-decoration: none;
          padding: 12px 24px;
          border-radius: 6px;
          font-weight: 600;
          text-align: center;
          margin: 20px 0;
        }
        .cta-button:hover {
          background-color: #2563eb;
        }
        .footer {
          text-align: center;
          margin-top: 40px;
          padding-top: 30px;
          border-top: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 14px;
        }
        .footer a {
          color: #3b82f6;
          text-decoration: none;
        }
        @media only screen and (max-width: 600px) {
          body {
            padding: 10px;
          }
          .container {
            padding: 20px;
          }
          .title {
            font-size: 24px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Dculus Forms</div>
          <h1 class="title">🎉 Your Form is Now Live!</h1>
          <p class="subtitle">Congratulations, ${data.ownerName}! Your form has been successfully published.</p>
        </div>
        
        <div class="form-details">
          <div class="form-title">${data.formTitle}</div>
          ${data.formDescription ? `<div class="form-description">${data.formDescription}</div>` : ''}
          
          <a href="${data.formUrl}" class="cta-button">View Your Published Form</a>
        </div>
        
        <p>Your form is now accessible to anyone with the link. You can share it with your audience, embed it on your website, or use it however you need.</p>
        
        <p>Here are some things you can do now:</p>
        <ul>
          <li>Share your form link: <a href="${data.formUrl}">${data.formUrl}</a></li>
          <li>Monitor form responses in your dashboard</li>
          <li>Update form settings anytime</li>
          <li>View analytics and insights</li>
        </ul>
        
        <div class="footer">
          <p>This email was sent from Dculus Forms. If you have any questions, please contact our support team.</p>
          <p><a href="https://dculus.com">Visit Dculus</a> | <a href="mailto:support@dculus.com">Support</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
}