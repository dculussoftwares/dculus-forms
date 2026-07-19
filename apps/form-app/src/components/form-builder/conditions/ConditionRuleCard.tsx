import React, { useMemo } from 'react';
import { AlertTriangle, Pencil, Trash2 } from 'lucide-react';
import { Badge, Button, Card, Switch } from '@dculus/ui';
import { ConditionalRule, FormPage } from '@dculus/types';
import { useTranslation } from '../../../hooks/useTranslation';
import { checkRuleReferences, fieldDisplayLabel } from './conditionFieldConfig';

interface ConditionRuleCardProps {
  rule: ConditionalRule;
  pages: FormPage[];
  canEdit: boolean;
  isCircular?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleEnabled: (enabled: boolean) => void;
}

export const ConditionRuleCard: React.FC<ConditionRuleCardProps> = ({
  rule,
  pages,
  canEdit,
  isCircular,
  onEdit,
  onDelete,
  onToggleEnabled,
}) => {
  const { t } = useTranslation('conditions');

  const { fieldLabels, pageLabels } = useMemo(() => {
    const fieldLabels = new Map<string, string>();
    const pageLabels = new Map<string, string>();
    pages.forEach((page, index) => {
      pageLabels.set(page.id, page.title || `${index + 1}`);
      page.fields.forEach((field) => {
        fieldLabels.set(field.id, fieldDisplayLabel(field));
      });
    });
    return { fieldLabels, pageLabels };
  }, [pages]);

  const references = useMemo(() => checkRuleReferences(rule, pages), [rule, pages]);

  const fieldLabel = (fieldId: string) =>
    fieldLabels.get(fieldId) ?? t('card.deletedField');
  const pageLabel = (pageId: string) => pageLabels.get(pageId) ?? t('card.deletedPage');

  return (
    <Card
      className={`p-4 space-y-3 ${rule.enabled ? '' : 'opacity-60'}`}
      data-testid={`condition-card-${rule.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 min-w-0">
          {/* IF summary */}
          <div className="text-sm">
            <span className="font-semibold text-primary mr-1.5">{t('card.if')}</span>
            {rule.terms.length > 1 && (
              <span className="text-muted-foreground mr-1.5">
                {t(`card.combinator.${rule.combinator}`)}:
              </span>
            )}
            <span className="space-x-1">
              {rule.terms.map((term, index) => (
                <span key={index} className="inline-block mr-1">
                  <span className="font-medium">{fieldLabel(term.fieldId)}</span>{' '}
                  <span className="text-muted-foreground">
                    {t(`operators.${term.operator}`)}
                  </span>
                  {term.value !== undefined && (
                    <span className="font-medium"> “{String(term.value)}”</span>
                  )}
                  {index < rule.terms.length - 1 && <span>,</span>}
                </span>
              ))}
            </span>
          </div>

          {/* THEN summary */}
          <div className="text-sm">
            <span className="font-semibold text-primary mr-1.5">{t('card.then')}</span>
            <span className="space-x-1">
              {rule.actions.map((action, index) => (
                <span key={index} className="inline-block mr-1">
                  <span className="text-muted-foreground">
                    {t(`actions.${action.type}`)}
                  </span>{' '}
                  <span className="font-medium">
                    {'fieldIds' in action
                      ? action.fieldIds.map(fieldLabel).join(', ')
                      : pageLabel(action.pageId)}
                  </span>
                  {index < rule.actions.length - 1 && <span>,</span>}
                </span>
              ))}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {references.hasBrokenReferences && (
              <Badge
                variant="destructive"
                className="gap-1"
                title={t('card.brokenReferenceHint')}
                data-testid={`condition-broken-${rule.id}`}
              >
                <AlertTriangle className="h-3 w-3" />
                {t('card.brokenReference')}
              </Badge>
            )}

            {isCircular && (
              <Badge
                variant="outline"
                className="gap-1 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
                title={t('card.circularHint')}
                data-testid={`condition-circular-${rule.id}`}
              >
                <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                {t('card.circular')}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Switch
            checked={rule.enabled}
            disabled={!canEdit}
            onCheckedChange={onToggleEnabled}
            aria-label={t('card.enabled')}
            data-testid={`condition-toggle-${rule.id}`}
          />
          {canEdit && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onEdit}
                aria-label={t('card.edit')}
                data-testid={`condition-edit-${rule.id}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={onDelete}
                aria-label={t('card.delete')}
                data-testid={`condition-delete-${rule.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
};
