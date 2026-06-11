import React from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@dculus/utils';

interface AIFloatingButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

export const AIFloatingButton: React.FC<AIFloatingButtonProps> = ({ isOpen, onClick }) => {
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className={cn('ai-gradient-ring rounded-full p-[2px]', isOpen && 'opacity-70')}>
        <button
          type="button"
          onClick={onClick}
          aria-label={isOpen ? 'Close AI assistant' : 'Open AI assistant'}
          aria-expanded={isOpen}
          className="flex items-center gap-2 rounded-full bg-white dark:bg-card px-5 h-12 text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
        >
          <Sparkles className="h-4 w-4 text-purple-600" />
          AI
        </button>
      </div>
    </div>
  );
};
