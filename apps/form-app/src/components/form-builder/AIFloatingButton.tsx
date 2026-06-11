import React from 'react';
import { GradientSparkles } from './GradientSparkles.js';

interface AIFloatingButtonProps {
  isOpen: boolean;
  onClick: () => void;
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
          className="flex items-center gap-1 rounded-full bg-black px-5 h-12 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors"
        >
          <GradientSparkles size={28} />
          Ask AI
        </button>
      </div>
    </div>
  );
};
