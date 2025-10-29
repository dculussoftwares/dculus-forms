import React from 'react';
import { Check } from 'lucide-react';
import { LayoutCode } from '@dculus/types';
import { Button } from '@dculus/ui';
import { cn } from '@dculus/utils';

// Layout templates with accurate visual representations
const LAYOUT_TEMPLATES: Array<{
  code: LayoutCode;
  name: string;
  description: string;
  preview: React.ReactNode;
}> = [
  {
    code: 'L1',
    name: 'Split',
    description: 'Two-chunk layout with image + content',
    preview: (
      <div className="flex space-x-0.5 h-6">
        {/* Image chunk */}
        <div className="flex-1 bg-gradient-to-br from-blue-100 to-blue-200 rounded-l border border-gray-300"></div>
        {/* White paper chunk with content */}
        <div className="flex-1 bg-white border border-gray-300 rounded-r p-0.5 flex flex-col justify-between">
          <div className="space-y-0.5">
            <div className="h-0.5 bg-gray-400 rounded w-full" />
            <div className="h-0.5 bg-gray-300 rounded w-3/4" />
          </div>
          <div className="h-1 bg-slate-600 rounded w-2/3 mx-auto" />
        </div>
      </div>
    )
  },
  {
    code: 'L2',
    name: 'Grid',
    description: 'Clean two-column grid layout',
    preview: (
      <div className="grid grid-cols-2 gap-0.5 h-6">
        <div className="bg-white border border-gray-300 rounded p-0.5 space-y-0.5">
          <div className="h-0.5 bg-gray-400 rounded w-full" />
          <div className="h-0.5 bg-gray-300 rounded w-3/4" />
        </div>
        <div className="bg-white border border-gray-300 rounded p-0.5 space-y-0.5">
          <div className="h-0.5 bg-gray-400 rounded w-full" />
          <div className="h-0.5 bg-gray-300 rounded w-2/3" />
        </div>
      </div>
    )
  },
  {
    code: 'L3',
    name: 'Cards',
    description: 'Compact card-based design',
    preview: (
      <div className="space-y-0.5 h-6">
        <div className="bg-white border border-gray-300 rounded px-1 py-0.5 shadow-sm">
          <div className="h-0.5 bg-gray-400 rounded w-full mb-0.5" />
          <div className="h-0.5 bg-gray-300 rounded w-3/4" />
        </div>
        <div className="bg-white border border-gray-300 rounded px-1 py-0.5 shadow-sm">
          <div className="h-0.5 bg-gray-400 rounded w-full mb-0.5" />
          <div className="h-0.5 bg-gray-300 rounded w-2/3" />
        </div>
      </div>
    )
  },
  {
    code: 'L4',
    name: 'Clean',
    description: 'Spacious minimal single column',
    preview: (
      <div className="bg-white border border-gray-200 rounded p-1 h-6 flex flex-col justify-center space-y-1">
        <div className="h-0.5 bg-gray-300 rounded w-full" />
        <div className="h-0.5 bg-gray-200 rounded w-2/3 mx-auto" />
        <div className="h-0.5 bg-gray-200 rounded w-1/2 mx-auto" />
      </div>
    )
  },
  {
    code: 'L5',
    name: 'Dual',
    description: 'Left-right split with image & content',
    preview: (
      <div className="flex space-x-0.5 h-6">
        {/* Content chunk */}
        <div className="flex-1 bg-white border border-gray-300 rounded-l p-0.5 flex flex-col justify-between">
          <div className="space-y-0.5">
            <div className="h-0.5 bg-gray-400 rounded w-full" />
            <div className="h-0.5 bg-gray-300 rounded w-3/4" />
          </div>
          <div className="h-1 bg-slate-600 rounded w-full" />
        </div>
        {/* Image chunk */}
        <div className="flex-1 bg-gradient-to-br from-gray-200 to-gray-400 rounded-r border border-gray-300"></div>
      </div>
    )
  },
  {
    code: 'L6',
    name: 'Steps',
    description: 'Step-by-step wizard with progress',
    preview: (
      <div className="bg-white border border-gray-300 rounded p-0.5 h-6 space-y-0.5">
        {/* Progress dots */}
        <div className="flex justify-center space-x-0.5">
          <div className="w-1 h-1 bg-purple-500 rounded-full" />
          <div className="w-1 h-1 bg-gray-300 rounded-full" />
          <div className="w-1 h-1 bg-gray-300 rounded-full" />
        </div>
        {/* Content */}
        <div className="space-y-0.5">
          <div className="h-0.5 bg-gray-400 rounded w-full" />
          <div className="h-0.5 bg-gray-300 rounded w-3/4" />
        </div>
        {/* Navigation */}
        <div className="flex justify-between">
          <div className="h-0.5 bg-gray-200 rounded w-4" />
          <div className="h-0.5 bg-purple-400 rounded w-4" />
        </div>
      </div>
    )
  },
  {
    code: 'L7',
    name: 'Wide',
    description: 'Full-width content section only',
    preview: (
      <div className="h-6">
        {/* Single full-width content chunk */}
        <div className="w-full h-full bg-white border border-gray-300 rounded p-0.5 flex flex-col justify-between">
          <div className="space-y-0.5">
            <div className="h-0.5 bg-gray-400 rounded w-full" />
            <div className="h-0.5 bg-gray-300 rounded w-4/5" />
            <div className="h-0.5 bg-gray-300 rounded w-3/5" />
          </div>
          <div className="h-1 bg-slate-600 rounded w-1/2 mx-auto" />
        </div>
      </div>
    )
  },
  {
    code: 'L8',
    name: 'Hero',
    description: 'Full-width image with floating CTA',
    preview: (
      <div className="relative h-6">
        {/* Full image background */}
        <div className="w-full h-full bg-gradient-to-br from-blue-200 via-purple-200 to-pink-200 rounded border border-gray-300"></div>
        {/* Floating CTA button */}
        <div className="absolute bottom-0.5 left-1/2 transform -translate-x-1/2">
          <div className="h-1 bg-slate-700 rounded w-6 shadow-sm" />
        </div>
      </div>
    )
  },
  {
    code: 'L9',
    name: 'Direct',
    description: 'Direct form pages without intro',
    preview: (
      <div className="space-y-0.5 h-6">
        {/* Header */}
        <div className="h-0.5 bg-gray-400 rounded w-1/3" />
        {/* Form pages */}
        <div className="bg-white border border-gray-300 rounded p-0.5 shadow-sm">
          <div className="h-0.5 bg-gray-300 rounded w-full mb-0.5" />
          <div className="h-0.5 bg-gray-200 rounded w-3/4" />
        </div>
        <div className="bg-white border border-gray-300 rounded p-0.5 shadow-sm">
          <div className="h-0.5 bg-gray-300 rounded w-full mb-0.5" />
          <div className="h-0.5 bg-gray-200 rounded w-2/3" />
        </div>
      </div>
    )
  }
];

interface LayoutThumbnailsProps {
  currentLayoutCode: LayoutCode;
  onLayoutSelect: (layoutCode: LayoutCode) => void;
  disabled?: boolean;
}

export const LayoutThumbnails: React.FC<LayoutThumbnailsProps> = ({
  currentLayoutCode,
  onLayoutSelect,
  disabled = false
}) => {
  return (
    <div className="h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
      <div className="grid grid-cols-2 gap-2 pr-2">
        {LAYOUT_TEMPLATES.map((template) => (
          <Button
            key={template.code}
            variant={currentLayoutCode === template.code ? "default" : "outline"}
            onClick={() => onLayoutSelect(template.code)}
            disabled={disabled}
            className={cn(
              "text-left p-2 h-auto justify-start flex-col items-start gap-0",
              currentLayoutCode === template.code && "ring-2 ring-purple-200 dark:ring-purple-800"
            )}
          >
            {/* Header with name and check */}
            <div className="flex items-center justify-between w-full mb-1.5">
              <span className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                {template.name}
              </span>
              {currentLayoutCode === template.code && (
                <Check className="w-3 h-3 text-purple-600 dark:text-purple-400 flex-shrink-0" />
              )}
            </div>

            {/* Preview - Enhanced */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 h-6 flex items-center justify-center p-0.5 mb-1.5 overflow-hidden w-full">
              <div className="w-full h-full flex items-center justify-center">
                {template.preview}
              </div>
            </div>

            {/* Layout Code Badge and Description */}
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full text-gray-600 dark:text-gray-400 border">
                {template.code}
              </span>
              <div className="w-1 h-1 bg-purple-400 rounded-full opacity-60" />
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
};