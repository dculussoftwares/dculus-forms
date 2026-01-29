import React from 'react';
import { Plus } from 'lucide-react';

interface DropIndicatorProps {
  className?: string;
  /** Height to match compact card spacing (default matches 52px compact cards) */
  compact?: boolean;
}

export const DropIndicator: React.FC<DropIndicatorProps> = ({
  className = '',
  compact = false,
}) => {
  // For compact mode, use minimal height that doesn't overlap with fields
  // For normal mode, use the standard py-2 padding
  const containerHeight = compact ? 'h-4 my-1' : 'py-2';

  return (
    <div
      data-testid="drop-indicator"
      className={`
        relative flex items-center justify-center 
        ${containerHeight}
        ${className}
      `}
    >
      {/* Horizontal line - more visible */}
      <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent rounded-full" />

      {/* Center circle with plus icon - slightly smaller in compact mode */}
      <div
        className={`
        relative bg-blue-500 rounded-full shadow-lg ring-4 ring-blue-100 dark:ring-blue-900/50
        ${compact ? 'p-0.5' : 'p-1'}
        animate-pulse
      `}
      >
        <Plus className={`text-white ${compact ? 'w-3 h-3' : 'w-4 h-4'}`} />
      </div>

      {/* Glow effect - enhanced visibility */}
      <div className="absolute inset-x-4 h-2 bg-blue-400/40 rounded-full blur-md" />
    </div>
  );
};

export default DropIndicator;
