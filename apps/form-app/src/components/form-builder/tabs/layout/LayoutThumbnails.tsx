import React from 'react';
import { Check } from 'lucide-react';
import { LayoutCode } from '@dculus/types';
import { Button, ScrollArea } from '@dculus/ui';
import { cn } from '@dculus/utils';
import { useTranslation } from '../../../../hooks/useTranslation';

// Accurate SVG wireframes derived from actual layout implementations
const LAYOUT_TEMPLATES: Array<{
  code: LayoutCode;
  preview: React.ReactNode;
}> = [
  {
    // L1 Classic: outer BG → inner padded frame → image LEFT + content RIGHT
    code: 'L1',
    preview: (
      <svg viewBox="0 0 100 56" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="56" fill="#e8edf2" rx="2"/>
        <rect x="6" y="5" width="88" height="46" fill="#fff" rx="2" stroke="#d1d8e0" strokeWidth="0.5"/>
        {/* Image panel — LEFT half */}
        <rect x="6" y="5" width="44" height="46" fill="#bfdbfe" rx="2"/>
        <line x1="50" y1="5" x2="50" y2="51" stroke="#d1d8e0" strokeWidth="0.5"/>
        {/* Mountain + sun icon */}
        <polygon points="14,44 28,30 42,44" fill="#93c5fd" opacity="0.8"/>
        <circle cx="36" cy="19" r="4" fill="#93c5fd" opacity="0.8"/>
        {/* Content — RIGHT half */}
        <rect x="54" y="14" width="28" height="3" rx="0.5" fill="#94a3b8"/>
        <rect x="54" y="20" width="22" height="2" rx="0.5" fill="#cbd5e1"/>
        <rect x="54" y="25" width="18" height="2" rx="0.5" fill="#cbd5e1"/>
        {/* Blue CTA */}
        <rect x="57" y="41" width="22" height="6" rx="2" fill="#1e40af"/>
      </svg>
    )
  },
  {
    // L2 Modern: outer BG → inner padded frame → content LEFT + image RIGHT (swapped vs L1)
    code: 'L2',
    preview: (
      <svg viewBox="0 0 100 56" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="56" fill="#e8edf2" rx="2"/>
        <rect x="6" y="5" width="88" height="46" fill="#fff" rx="2" stroke="#d1d8e0" strokeWidth="0.5"/>
        {/* Image panel — RIGHT half */}
        <rect x="50" y="5" width="44" height="46" fill="#c4b5fd" rx="2"/>
        <line x1="50" y1="5" x2="50" y2="51" stroke="#d1d8e0" strokeWidth="0.5"/>
        {/* Mountain + sun icon in right panel */}
        <polygon points="57,44 70,30 83,44" fill="#a78bfa" opacity="0.8"/>
        <circle cx="78" cy="19" r="4" fill="#a78bfa" opacity="0.8"/>
        {/* Content — LEFT half */}
        <rect x="9" y="14" width="28" height="3" rx="0.5" fill="#94a3b8"/>
        <rect x="9" y="20" width="22" height="2" rx="0.5" fill="#cbd5e1"/>
        <rect x="9" y="25" width="18" height="2" rx="0.5" fill="#cbd5e1"/>
        {/* Purple-blue CTA */}
        <rect x="10" y="41" width="22" height="6" rx="2" fill="#7c3aed"/>
      </svg>
    )
  },
  {
    // L3 Card: full background → centered floating card (max-w-md, no side image panel)
    code: 'L3',
    preview: (
      <svg viewBox="0 0 100 56" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        {/* Full purple-blue background */}
        <rect width="100" height="56" fill="#818cf8" rx="2"/>
        {/* Centered floating card */}
        <rect x="20" y="6" width="60" height="44" fill="#fff" rx="3" stroke="#e2e8f0" strokeWidth="0.5"/>
        <rect x="28" y="14" width="44" height="3" rx="0.5" fill="#94a3b8"/>
        <rect x="28" y="21" width="36" height="2" rx="0.5" fill="#cbd5e1"/>
        <rect x="28" y="26" width="30" height="2" rx="0.5" fill="#cbd5e1"/>
        {/* Full-width CTA inside card */}
        <rect x="26" y="39" width="48" height="7" rx="2" fill="#7c3aed"/>
      </svg>
    )
  },
  {
    // L4 Minimal: same split as L1 (image LEFT, content RIGHT) but slate/minimal palette
    code: 'L4',
    preview: (
      <svg viewBox="0 0 100 56" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="56" fill="#f1f5f9" rx="2"/>
        <rect x="6" y="5" width="88" height="46" fill="#fff" rx="2" stroke="#e2e8f0" strokeWidth="0.5"/>
        {/* Image panel — LEFT, slate-toned */}
        <rect x="6" y="5" width="44" height="46" fill="#e2e8f0" rx="2"/>
        <line x1="50" y1="5" x2="50" y2="51" stroke="#cbd5e1" strokeWidth="0.5"/>
        <polygon points="14,44 28,30 42,44" fill="#94a3b8" opacity="0.6"/>
        <circle cx="36" cy="19" r="4" fill="#94a3b8" opacity="0.6"/>
        {/* Content — RIGHT, minimal style */}
        <rect x="54" y="14" width="28" height="3" rx="0.5" fill="#94a3b8"/>
        <rect x="54" y="20" width="22" height="2" rx="0.5" fill="#cbd5e1"/>
        <rect x="54" y="25" width="18" height="2" rx="0.5" fill="#cbd5e1"/>
        {/* Slate CTA */}
        <rect x="57" y="41" width="22" height="6" rx="2" fill="#1e293b"/>
      </svg>
    )
  },
  {
    // L5 Split: content LEFT + image RIGHT, slate/minimal palette (mirror of L4)
    code: 'L5',
    preview: (
      <svg viewBox="0 0 100 56" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="56" fill="#f1f5f9" rx="2"/>
        <rect x="6" y="5" width="88" height="46" fill="#fff" rx="2" stroke="#e2e8f0" strokeWidth="0.5"/>
        {/* Image panel — RIGHT, slate-toned */}
        <rect x="50" y="5" width="44" height="46" fill="#e2e8f0" rx="2"/>
        <line x1="50" y1="5" x2="50" y2="51" stroke="#cbd5e1" strokeWidth="0.5"/>
        <polygon points="57,44 70,30 83,44" fill="#94a3b8" opacity="0.6"/>
        <circle cx="78" cy="19" r="4" fill="#94a3b8" opacity="0.6"/>
        {/* Content — LEFT, minimal style */}
        <rect x="9" y="14" width="28" height="3" rx="0.5" fill="#94a3b8"/>
        <rect x="9" y="20" width="22" height="2" rx="0.5" fill="#cbd5e1"/>
        <rect x="9" y="25" width="18" height="2" rx="0.5" fill="#cbd5e1"/>
        {/* Slate CTA */}
        <rect x="10" y="41" width="22" height="6" rx="2" fill="#1e293b"/>
      </svg>
    )
  },
  {
    // L6 Wizard: outer BG → vertical stack: wide image banner + content card + form card
    code: 'L6',
    preview: (
      <svg viewBox="0 0 100 56" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="56" fill="#e8edf2" rx="2"/>
        {/* Wide image banner strip (4:1 ratio at top) */}
        <rect x="6" y="5" width="88" height="15" fill="#bfdbfe" rx="2"/>
        <polygon points="32,18 44,11 56,18" fill="#93c5fd" opacity="0.8"/>
        <circle cx="62" cy="10" r="3" fill="#93c5fd" opacity="0.8"/>
        {/* Content card */}
        <rect x="6" y="23" width="88" height="11" fill="#fff" rx="2" stroke="#e2e8f0" strokeWidth="0.5"/>
        <rect x="11" y="27" width="30" height="2.5" rx="0.5" fill="#94a3b8"/>
        <rect x="11" y="31" width="22" height="1.5" rx="0.5" fill="#cbd5e1"/>
        {/* Form card with field placeholders */}
        <rect x="6" y="37" width="88" height="14" fill="#fff" rx="2" stroke="#e2e8f0" strokeWidth="0.5"/>
        <rect x="11" y="40" width="70" height="3" rx="1" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="0.5"/>
        <rect x="11" y="45" width="70" height="3" rx="1" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="0.5"/>
      </svg>
    )
  },
  {
    // L7 Single: outer BG → inner padded frame → full-width white panel (no image split)
    code: 'L7',
    preview: (
      <svg viewBox="0 0 100 56" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="56" fill="#e8edf2" rx="2"/>
        {/* Single full-width content panel */}
        <rect x="6" y="5" width="88" height="46" fill="#fff" rx="2" stroke="#e2e8f0" strokeWidth="0.5"/>
        {/* Centered content (no image panel at all) */}
        <rect x="25" y="13" width="50" height="3" rx="0.5" fill="#94a3b8"/>
        <rect x="28" y="20" width="44" height="2" rx="0.5" fill="#cbd5e1"/>
        <rect x="30" y="25" width="40" height="2" rx="0.5" fill="#cbd5e1"/>
        <rect x="32" y="30" width="36" height="2" rx="0.5" fill="#cbd5e1"/>
        {/* Centered slate CTA */}
        <rect x="33" y="41" width="34" height="6" rx="2" fill="#1e293b"/>
      </svg>
    )
  },
  {
    // L8 Image: outer BG → inner padded frame → full-width image, CTA overlay at bottom center
    code: 'L8',
    preview: (
      <svg viewBox="0 0 100 56" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="56" fill="#e8edf2" rx="2"/>
        {/* Full image panel — no content/text area */}
        <rect x="6" y="5" width="88" height="46" fill="#bfdbfe" rx="2"/>
        {/* Landscape scene */}
        <polygon points="16,44 36,24 56,44" fill="#93c5fd" opacity="0.7"/>
        <polygon points="44,44 62,30 80,44" fill="#7dd3fc" opacity="0.6"/>
        <circle cx="74" cy="15" r="6" fill="#93c5fd" opacity="0.7"/>
        {/* CTA button overlay at bottom center of image */}
        <rect x="34" y="42" width="32" height="6" rx="2" fill="#1e293b"/>
      </svg>
    )
  },
  {
    // L9 Direct: BG fill → white rounded card (max-w-2xl) with form fields directly, no intro screen
    code: 'L9',
    preview: (
      <svg viewBox="0 0 100 56" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="56" fill="#e8edf2" rx="2"/>
        {/* White form card — no intro, direct to fields */}
        <rect x="10" y="5" width="80" height="46" fill="#fff" rx="3" stroke="#e2e8f0" strokeWidth="0.5"/>
        {/* Field 1 label + input */}
        <rect x="16" y="11" width="30" height="2.5" rx="0.5" fill="#94a3b8"/>
        <rect x="16" y="16" width="68" height="5" rx="1.5" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="0.5"/>
        {/* Field 2 label + input */}
        <rect x="16" y="25" width="30" height="2.5" rx="0.5" fill="#94a3b8"/>
        <rect x="16" y="30" width="68" height="5" rx="1.5" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="0.5"/>
        {/* Submit button */}
        <rect x="16" y="39" width="68" height="8" rx="2" fill="#1e293b"/>
      </svg>
    )
  }
];

interface LayoutThumbnailsProps {
  currentLayoutCode: LayoutCode;
  onLayoutSelect: (layoutCode: LayoutCode) => void;
  disabled?: boolean;
  scrollAreaClassName?: string;
}

export const LayoutThumbnails: React.FC<LayoutThumbnailsProps> = ({
  currentLayoutCode,
  onLayoutSelect,
  disabled = false,
  scrollAreaClassName = 'h-40',
}) => {
  const { t } = useTranslation('layoutThumbnails');
  return (
    <ScrollArea className={scrollAreaClassName}>
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
            {/* Header: layout name + check */}
            <div className="flex items-center justify-between w-full mb-1.5">
              <span className="text-xs font-semibold text-primary dark:text-white truncate">
                {t(`layouts.${template.code}.name`)}
              </span>
              {currentLayoutCode === template.code && (
                <Check className="w-3 h-3 text-purple-600 dark:text-purple-400 flex-shrink-0" />
              )}
            </div>

            {/* SVG wireframe preview */}
            <div className="rounded border border-[var(--tf-border-medium)] dark:border-gray-600 h-14 overflow-hidden w-full mb-1.5">
              {template.preview}
            </div>

            {/* Layout code badge */}
            <span className="text-xs font-mono bg-background dark:bg-gray-800 px-1.5 py-0.5 rounded-full text-foreground dark:text-gray-400 border">
              {template.code}
            </span>
          </Button>
        ))}
      </div>
    </ScrollArea>
  );
};
