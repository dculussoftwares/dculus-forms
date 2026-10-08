import React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { isToolFailed, type MutationToolPart } from '../../../lib/aiAgentTypes';
import { buildOpLabel } from '../../../hooks/useAIChat';

interface Props {
  part: MutationToolPart;
}

const CHIP = 'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs';

const MutationToolPart: React.FC<Props> = ({ part }) => {
  const { t } = useTranslation('aiEditDrawer');
  const toolName = part.type.slice(5);

  if (isToolFailed(part)) {
    const output = part.output as { error?: string } | undefined;
    const detail = output?.error ?? (part as { errorText?: string }).errorText;
    return (
      <span className={`${CHIP} border-red-200 bg-red-50 text-red-700`} title={detail}>
        <AlertCircle className="h-3 w-3" />
        {t('toolFailed')}
      </span>
    );
  }

  if (part.state === 'input-streaming' || part.state === 'input-available') {
    // Legacy parts from old conversations (e.g. tool-updateField) fall back to the default label.
    const key = `toolStatus.${toolName}`;
    const label = t(key);
    return (
      <span className={`${CHIP} border-border bg-muted text-muted-foreground`}>
        <Loader2 className="h-3 w-3 animate-spin" />
        {label !== key ? label : t('toolStatus.default')}
      </span>
    );
  }

  return (
    <span className={`${CHIP} border-green-200 bg-green-50 font-medium text-green-700`}>
      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
      {part.output ? buildOpLabel(part.output as Record<string, unknown>) : t('toolStatus.default')}
    </span>
  );
};

export default MutationToolPart;
