import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@dculus/ui';

export interface PrimaryColumnOption {
  id: string;
  label: string;
}

interface PrimaryColumnHeaderProps {
  value: string;
  options: PrimaryColumnOption[];
  onChange: (columnId: string) => void;
  ariaLabel: string;
}

/** Header of the frozen first column: picking another column swaps it into this slot. */
export const PrimaryColumnHeader: React.FC<PrimaryColumnHeaderProps> = ({
  value,
  options,
  onChange,
  ariaLabel,
}) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger aria-label={ariaLabel} className="h-8 w-full text-[13px] font-normal">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {options.map((option) => (
        <SelectItem key={option.id} value={option.id}>
          {option.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);
