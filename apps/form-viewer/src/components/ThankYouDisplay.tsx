import React from 'react';
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
    // Display custom rich text message
    return (
      <div className="text-center p-8 max-w-2xl mx-auto">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-8 h-8 text-green-600"
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
        
        <div className="mb-6 prose prose-lg max-w-none mx-auto">
          <RichTextEditor
            value={message}
            editable={false}
            onChange={() => {}} // No-op since it's read-only
            className="border-none shadow-none"
            placeholder=""
          />
        </div>
      </div>
    );
  }

  // Display default success message
  return (
    <div className="text-center p-8 max-w-md mx-auto">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg
          className="w-8 h-8 text-green-600"
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
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Success!</h1>
      <p className="text-gray-600 mb-6">{message}</p>
    </div>
  );
};

export default ThankYouDisplay;