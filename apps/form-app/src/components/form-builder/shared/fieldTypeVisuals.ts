import React from 'react';
import {
  Calendar,
  CheckSquare,
  ChevronDown,
  Circle,
  FileCode,
  FileText,
  Hash,
  Mail,
  Phone,
  Type,
  Upload,
} from 'lucide-react';

/**
 * Field-type icon + category-colour mapping, shared by every surface that shows
 * a field: the canvas cards, the journey rail chips, the field library, and the
 * Logic workspace's rule chips.
 *
 * Lives in its own module rather than beside `FieldCard` so that pure, non-React
 * consumers (and their unit tests) can use it without pulling in the card
 * component's dependency graph — react-router, the builder store, dnd-kit.
 * `PageBuilderFieldCard` re-exports both for backwards compatibility.
 */

export const getFieldTypeConfig = (
  type: string
): { icon: React.ElementType; category: string; label: string } => {
  const configs: Record<string, { icon: React.ElementType; category: string; label: string }> = {
    text_input_field: { icon: Type, category: 'input', label: 'Short Text' },
    text_area_field: { icon: FileText, category: 'input', label: 'Long Text' },
    email_field: { icon: Mail, category: 'input', label: 'Email' },
    number_field: { icon: Hash, category: 'input', label: 'Number' },
    select_field: { icon: ChevronDown, category: 'choice', label: 'Dropdown' },
    radio_field: { icon: Circle, category: 'choice', label: 'Multiple Choice' },
    checkbox_field: { icon: CheckSquare, category: 'choice', label: 'Checkboxes' },
    date_field: { icon: Calendar, category: 'input', label: 'Date' },
    phone_number_field: { icon: Phone, category: 'input', label: 'Phone Number' },
    rich_text_field: { icon: FileCode, category: 'content', label: 'Rich Text' },
    file_upload_field: { icon: Upload, category: 'advanced', label: 'File Upload' },
  };
  return configs[type] || { icon: Type, category: 'input', label: 'Unknown' };
};

/**
 * Tile background + glyph colour for a field-type icon.
 *
 * The dark variants are spelled out rather than left to the `--tf-icon-*` tokens:
 * `apps/form-app/src/index.css` redefines those tokens with their light values and
 * its `.dark` block omits them entirely, so in dark mode the tiles kept rendering
 * as light pastels with a near-black glyph — pale pink squares with an almost
 * invisible icon. Here the tile dims and the glyph takes the pastel hue, which
 * reads at any size in both themes.
 */
export const getCategoryColor = (category: string) => {
  /* Typeform field-icon palette (exact extracted colors) */
  switch (category) {
    case 'input': /* salmon */
      return 'bg-[var(--tf-icon-salmon)] text-primary dark:bg-[rgba(248,205,216,0.16)] dark:text-[#f5bccd]';
    case 'choice': /* lavender */
      return 'bg-[var(--tf-icon-lavender)] text-[#5c2e6b] dark:bg-[rgba(221,214,250,0.16)] dark:text-[#cfc4f8]';
    case 'content': /* teal */
      return 'bg-[var(--tf-icon-teal)] text-[var(--tf-green)] dark:bg-[rgba(201,236,227,0.16)] dark:text-[#a8e2d3]';
    default: /* neutral gray */
      return 'bg-[var(--tf-icon-gray)] text-foreground dark:bg-[rgba(222,220,222,0.14)] dark:text-gray-200';
  }
};
