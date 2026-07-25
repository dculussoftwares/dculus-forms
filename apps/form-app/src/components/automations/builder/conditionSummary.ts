import type { FillableFormField } from '@dculus/types';
import { getOperatorOptions } from '../../Filters/FilterRow';
import type { ConditionCombinator, ConditionRule } from './types';

type Translate = (key: string) => string;

const NO_VALUE_OPERATORS = new Set(['IS_EMPTY', 'IS_NOT_EMPTY', 'DATE_TODAY']);

function formatRuleValue(rule: ConditionRule): string {
  if (!rule.operator || NO_VALUE_OPERATORS.has(rule.operator)) return '';

  if (rule.operator === 'BETWEEN' || rule.operator === 'DATE_BETWEEN') {
    const range = rule.operator === 'BETWEEN' ? rule.numberRange : rule.dateRange;
    const from = rule.operator === 'BETWEEN' ? rule.numberRange?.min : rule.dateRange?.from;
    const to = rule.operator === 'BETWEEN' ? rule.numberRange?.max : rule.dateRange?.to;
    if (!range || (from === undefined && to === undefined)) return '';
    return `${from ?? '…'} - ${to ?? '…'}`;
  }

  if (rule.values && rule.values.length > 0) {
    const [first, ...rest] = rule.values;
    return rest.length > 0 ? `${first} (+${rest.length})` : first;
  }

  return rule.value ?? '';
}

/**
 * Builds the ConditionNode summary card text (#200), e.g. "If Email contains @acme.com —
 * AND 1 more". Falls back to placeholder copy when a rule's field can no longer be resolved
 * (field deleted from the form after the rule was created) or when rules are still empty.
 */
export function summarizeConditionRules(
  rules: ConditionRule[],
  combinator: ConditionCombinator,
  fields: FillableFormField[],
  t: Translate,
  tFilter: Translate
): string {
  if (!rules || rules.length === 0) return t('builder.nodes.condition.noRulesConfigured');

  const [first, ...rest] = rules;
  const field = fields.find((f) => f.id === first.fieldId);
  const fieldLabel = field?.label ?? t('builder.nodes.condition.unknownField');
  const operatorLabel = field && first.operator
    ? (getOperatorOptions(field.type, tFilter).find((o) => o.value === first.operator)?.label ?? '')
    : '';
  const valueText = formatRuleValue(first);

  const primary = `${t('builder.nodes.condition.ifPrefix')} ${fieldLabel} ${operatorLabel} ${valueText}`.replace(/\s+/g, ' ').trim();

  if (rest.length === 0) return primary;

  const combinatorLabel = combinator === 'OR' ? t('builder.panel.condition.or') : t('builder.panel.condition.and');
  return `${primary} — ${combinatorLabel} ${rest.length} ${t('builder.nodes.condition.moreRulesSuffix')}`;
}
