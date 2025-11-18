import React from 'react';
import { Chip } from '@dculus/ui';
import { FilterState } from './FilterPanel';
import { FillableFormField } from '@dculus/types';
import { getFieldIcon } from '../utils/fieldIcons';

interface FilterChipProps {
  field: FillableFormField;
  filter: FilterState;
  onRemove: () => void;
}

const getFilterLabel = (filter: FilterState): string => {
  switch (filter.operator) {
    case 'EQUALS': {
      if (filter.values && filter.values.length > 0) {
        const eqValues = filter.values.slice(0, 2).join(', ');
        const eqExtraCount = filter.values.length - 2;
        return `equals ${eqValues}${eqExtraCount > 0 ? ` +${eqExtraCount} more` : ''}`;
      }
      return `equals "${filter.value ?? ''}"`;
    }
    case 'NOT_EQUALS':
      return `not equals "${filter.value}"`;
    case 'CONTAINS':
      return `contains "${filter.value}"`;
    case 'NOT_CONTAINS':
      return `doesn't contain "${filter.value}"`;
    case 'STARTS_WITH':
      return `starts with "${filter.value}"`;
    case 'ENDS_WITH':
      return `ends with "${filter.value}"`;
    case 'IS_EMPTY':
      return 'is empty';
    case 'IS_NOT_EMPTY':
      return 'is not empty';
    case 'GREATER_THAN':
      return `> ${filter.value}`;
    case 'LESS_THAN':
      return `< ${filter.value}`;
    case 'BETWEEN': {
      const min = filter.numberRange?.min ?? '';
      const max = filter.numberRange?.max ?? '';
      return `between ${min} and ${max}`;
    }
    case 'DATE_EQUALS':
      return `date equals ${filter.value}`;
    case 'DATE_BEFORE':
      return `before ${filter.value}`;
    case 'DATE_AFTER':
      return `after ${filter.value}`;
    case 'DATE_BETWEEN': {
      const from = filter.dateRange?.from ?? '';
      const to = filter.dateRange?.to ?? '';
      return `between ${from} and ${to}`;
    }
    case 'IN': {
      const inValues = filter.values?.slice(0, 2).join(', ') || '';
      const extraCount = (filter.values?.length ?? 0) - 2;
      return `is ${inValues}${extraCount > 0 ? ` +${extraCount} more` : ''}`;
    }
    case 'NOT_IN': {
      const notInValues = filter.values?.slice(0, 2).join(', ') || '';
      const notInExtraCount = (filter.values?.length ?? 0) - 2;
      return `is not ${notInValues}${notInExtraCount > 0 ? ` +${notInExtraCount} more` : ''}`;
    }
    case 'CONTAINS_ALL': {
      const allValues = filter.values?.slice(0, 2).join(', ') || '';
      const allExtraCount = (filter.values?.length ?? 0) - 2;
      return `has all: ${allValues}${allExtraCount > 0 ? ` +${allExtraCount} more` : ''}`;
    }
    default:
      return 'filtered';
  }
};

const truncateLabel = (label: string, maxLength = 30): string => {
  return label.length > maxLength ? `${label.slice(0, maxLength)}...` : label;
};

export const FilterChip: React.FC<FilterChipProps> = ({
  field,
  filter,
  onRemove,
}) => {
  const truncatedLabel = truncateLabel(field.label);
  const filterLabel = getFilterLabel(filter);

  return (
    <Chip
      variant="filter"
      icon={getFieldIcon(field.type)}
      onRemove={onRemove}
    >
      <span className="font-semibold">{truncatedLabel}</span>
      <span className="font-normal ml-1">{filterLabel}</span>
    </Chip>
  );
};
