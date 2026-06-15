import React from 'react';
import DOMPurify from 'dompurify';
import { RichTextEditor } from '@dculus/ui';

interface ThankYouDisplayProps {
  message: string;
  isCustom: boolean;
}

const ThankYouDisplay: React.FC<ThankYouDisplayProps> = ({
  message,
  isCustom
}) => {
  if (isCustom) {
    const safeMessage = DOMPurify.sanitize(message);
    // Display custom rich text message
    return (
      <div className="text-center p-4 sm:p-8 max-w-2xl mx-auto" data-testid="thank-you-display">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-8 h-8 text-primary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <div className="mb-6 prose prose-lg max-w-none mx-auto" data-testid="thank-you-custom-message">
          <RichTextEditor
            value={safeMessage}
            editable={false}
            onChange={() => {}}
            className="border-none shadow-none"
            placeholder=""
          />
        </div>
      </div>
    );
  }

  // Display default success message
  return (
    <div className="text-center p-4 sm:p-8 max-w-md mx-auto" data-testid="thank-you-display">
      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg
          className="w-8 h-8 text-primary"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-2" data-testid="thank-you-default-title">Success!</h1>
      <p className="text-muted-foreground mb-6" data-testid="thank-you-default-message">{message}</p>
    </div>
  );
};

export default ThankYouDisplay;