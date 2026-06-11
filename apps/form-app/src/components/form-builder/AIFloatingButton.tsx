import React from 'react';

interface AIFloatingButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

function GradientSparkles() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="url(#ai-sparkles-grad)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ai-sparkles-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="50%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}

export const AIFloatingButton: React.FC<AIFloatingButtonProps> = ({ isOpen, onClick }) => {
  if (isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="ai-gradient-ring rounded-full p-[2px]">
        <button
          type="button"
          onClick={onClick}
          aria-label="Open AI assistant"
          aria-expanded={false}
          className="flex items-center gap-2 rounded-full bg-black px-5 h-12 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors"
        >
          <GradientSparkles />
          Ask AI
        </button>
      </div>
    </div>
  );
};
