import React from 'react';
import { Plus } from 'lucide-react';

interface DropIndicatorProps {
  className?: string;
}

export const DropIndicator: React.FC<DropIndicatorProps> = ({ className = '' }) => {
  return (
    <div 
      data-testid="drop-indicator"
      className={`relative flex items-center justify-center py-2 ${className}`}
    >
      {/* Horizontal line */}
      <div className="absolute inset-x-0 h-0.5 bg-blue-500 rounded-full animate-pulse" />
      
      {/* Center circle with plus icon */}
      <div className="relative bg-blue-500 rounded-full p-1 shadow-lg animate-pulse">
        <Plus className="w-4 h-4 text-white" />
      </div>
      
      {/* Glow effect */}
      <div className="absolute inset-x-0 h-1 bg-blue-400/30 rounded-full blur-sm" />
    </div>
  );
};

export default DropIndicator;