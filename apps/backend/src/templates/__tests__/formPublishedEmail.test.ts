import { describe, it, expect } from 'vitest';
import { generateFormPublishedHtml } from '../formPublishedEmail.js';

describe('Form Published Email Template', () => {
  describe('generateFormPublishedHtml', () => {
    it('should generate HTML with form details', () => {
      const data = {
        ownerName: 'John Doe',
        formTitle: 'Customer Feedback Form',
        formDescription: 'Share your experience with us',
        formUrl: 'https://dculus.com/forms/abc123'
      };

      const html = generateFormPublishedHtml(data);

      expect(html).toContain('John Doe');
      expect(html).toContain('Customer Feedback Form');
      expect(html).toContain('Share your experience with us');
      expect(html).toContain('https://dculus.com/forms/abc123');
    });

    it('should handle form without description', () => {
      const data = {
        ownerName: 'Jane Smith',
        formTitle: 'Contact Form',
        formUrl: 'https://dculus.com/forms/xyz789'
      };

      const html = generateFormPublishedHtml(data);

      expect(html).toContain('Jane Smith');
      expect(html).toContain('Contact Form');
      expect(html).toContain('https://dculus.com/forms/xyz789');
    });

    it('should include congratulations message', () => {
      const data = {
        ownerName: 'Test User',
        formTitle: 'Test Form',
        formUrl: 'https://dculus.com/forms/test123'
      };

      const html = generateFormPublishedHtml(data);

      expect(html).toContain('🎉 Your Form is Now Live!');
      expect(html).toContain('Congratulations');
    });

    it('should include view form button', () => {
      const data = {
        ownerName: 'Test User',
        formTitle: 'Test Form',
        formUrl: 'https://dculus.com/forms/test123'
      };

      const html = generateFormPublishedHtml(data);

      expect(html).toContain('View Your Published Form');
      expect(html).toContain('class="cta-button"');
    });

    it('should include next steps list', () => {
      const data = {
        ownerName: 'Test User',
        formTitle: 'Test Form',
        formUrl: 'https://dculus.com/forms/test123'
      };

      const html = generateFormPublishedHtml(data);

      expect(html).toContain('Here are some things you can do now:');
      expect(html).toContain('Share your form link');
      expect(html).toContain('Monitor form responses');
      expect(html).toContain('Update form settings');
      expect(html).toContain('View analytics and insights');
    });

    it('should include Dculus Forms branding', () => {
      const data = {
        ownerName: 'Test User',
        formTitle: 'Test Form',
        formUrl: 'https://dculus.com/forms/test123'
      };

      const html = generateFormPublishedHtml(data);

      expect(html).toContain('Dculus Forms');
      expect(html).toContain('https://dculus.com');
      expect(html).toContain('support@dculus.com');
    });

    it('should generate valid HTML structure', () => {
      const data = {
        ownerName: 'Test User',
        formTitle: 'Test Form',
        formUrl: 'https://dculus.com/forms/test123'
      };

      const html = generateFormPublishedHtml(data);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<head>');
      expect(html).toContain('<body>');
      expect(html).toContain('</html>');
    });

    it('should include responsive CSS styles', () => {
      const data = {
        ownerName: 'Test User',
        formTitle: 'Test Form',
        formUrl: 'https://dculus.com/forms/test123'
      };

      const html = generateFormPublishedHtml(data);

      expect(html).toContain('<style>');
      expect(html).toContain('@media only screen and (max-width: 600px)');
    });

    it('should handle special characters in form title', () => {
      const data = {
        ownerName: 'Test User',
        formTitle: 'Form with "Quotes" & Symbols',
        formUrl: 'https://dculus.com/forms/test123'
      };

      const html = generateFormPublishedHtml(data);

      expect(html).toContain('Form with "Quotes" & Symbols');
    });

    it('should handle very long form URLs', () => {
      const data = {
        ownerName: 'Test User',
        formTitle: 'Test Form',
        formUrl: 'https://dculus.com/forms/' + 'a'.repeat(200)
      };

      const html = generateFormPublishedHtml(data);

      expect(html).toContain('https://dculus.com/forms/');
    });
  });
});
