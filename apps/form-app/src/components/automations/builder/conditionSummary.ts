import { getOperatorOptions } from '../../Filters/FilterRow';
import { isMetaFilterField, type FilterableField } from '../../Filters/FilterFieldSelect';
import { getMetaFieldLabel } from '../../Filters/FilterFieldSelect';
import type { ConditionCombinator, ConditionRule } from './types';

type Translate = (key: string, options?: { values?: Record<string, string | number> }) => string;

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
 *
 * The primary sentence and the "N more" suffix are each built from a single interpolated
 * translation key (`summaryPrimary` / `summaryMore`) rather than concatenated from
 * separately-translated fragments — English word order ("If X contains Y") doesn't
 * generalize to other languages, so each locale's JSON controls the full phrase order.
 */
export function summarizeConditionRules(
  rules: ConditionRule[],
  combinator: ConditionCombinator,
  fields: FilterableField[],
  t: Translate,
  tFilter: Translate
): string {
  if (!rules || rules.length === 0) return t('builder.nodes.condition.noRulesConfigured');

  const [first, ...rest] = rules;
  const field = fields.find((f) => f.id === first.fieldId);
  const fieldLabel = field
    ? isMetaFilterField(field)
      ? getMetaFieldLabel(field, tFilter)
      : field.label
    : t('builder.nodes.condition.unknownField');
  const operatorLabel = field && first.operator
    ? (getOperatorOptions(field, tFilter).find((o) => o.value === first.operator)?.label ?? '')
    : '';
  const valueText = formatRuleValue(first);

  const primary = t('builder.nodes.condition.summaryPrimary', {
    values: { field: fieldLabel, operator: operatorLabel, value: valueText },
  }).replace(/\s+/g, ' ').trim();

  if (rest.length === 0) return primary;

  const combinatorLabel = combinator === 'OR' ? t('builder.panel.condition.or') : t('builder.panel.condition.and');
  const more = t('builder.nodes.condition.summaryMore', {
    values: { combinator: combinatorLabel, count: rest.length },
  });
  return `${primary} ${more}`;
}
