import React from 'react';
import { ArrowRight, Zap } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { useFormBuilderStore } from '../../../store/useFormBuilderStore';
import { useConditionReferenceCounts } from '../../../hooks/useConditionReferenceCounts';
import { useTranslation } from '../../../hooks/useTranslation';

interface FieldLogicSummaryRowProps {
  fieldId: string;
}

/**
 * "N logic rules use this field →" row shown beneath FieldSettingsV2. Deep
 * links into the Logic tab pre-filtered to this field (ConditionsTab reads
 * `?field=`). Hidden entirely when the field has no referencing rules.
 */
export const FieldLogicSummaryRow: React.FC<FieldLogicSummaryRowProps> = ({ fieldId }) => {
  const { t } = useTranslation('pageBuilderTab');
  const navigate = useNavigate();
  const { formId } = useParams<{ formId: string }>();
  const conditions = useFormBuilderStore((state) => state.conditions);
  const { fieldRuleCounts } = useConditionReferenceCounts(conditions);
  const count = fieldRuleCounts.get(fieldId) ?? 0;

  if (count === 0) return null;

  return (
    <div className="border-t border-[var(--tf-border-medium)] dark:border-gray-700 p-4">
      <button
        type="button"
        onClick={() => formId && navigate(`/dashboard/form/${formId}/builder/logic?field=${fieldId}`)}
        data-testid="field-logic-summary"
        className="flex w-full items-center gap-2 rounded-lg border border-[var(--tf-border-medium)] dark:border-gray-700 px-3 py-2 text-xs font-medium text-foreground dark:text-gray-300 hover:border-[var(--tf-border-strong)] hover:bg-[var(--tf-faint)] transition-colors"
      >
        <Zap className="w-3.5 h-3.5 shrink-0 text-amber-500" />
        <span className="flex-1 text-left">
          {t(count === 1 ? 'fieldPane.logicSummary.single' : 'fieldPane.logicSummary.multiple', {
            values: { count },
          })}
        </span>
        <ArrowRight className="w-3.5 h-3.5 shrink-0" />
      </button>
    </div>
  );
};

export default FieldLogicSummaryRow;
