import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation } from '@apollo/client/react';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  toastSuccess,
  toastError,
} from '@dculus/ui';
import { CREATE_AUTOMATION, GET_FORM_AUTOMATIONS } from '../../graphql/automations';
import { useTranslation } from '../../hooks/useTranslation';
import { SUPPORTED_TRIGGER_TYPES, triggerTypeI18nKey } from './triggerTypes';
import { AUTOMATION_TEMPLATE_OPTIONS, BLANK_TEMPLATE_ID } from './automationTemplates';

interface CreateAutomationDialogProps {
  formId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateAutomationDialog: React.FC<CreateAutomationDialogProps> = ({
  formId,
  open,
  onOpenChange,
}) => {
  const { t } = useTranslation('automations');
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<string>(SUPPORTED_TRIGGER_TYPES[0]);
  const [templateId, setTemplateId] = useState<string>(BLANK_TEMPLATE_ID);

  const [createAutomation, { loading }] = useMutation(CREATE_AUTOMATION);

  const isBlank = templateId === BLANK_TEMPLATE_ID;

  const resetAndClose = () => {
    setName('');
    setTriggerType(SUPPORTED_TRIGGER_TYPES[0]);
    setTemplateId(BLANK_TEMPLATE_ID);
    onOpenChange(false);
  };

  const handleSelectTemplate = (id: string) => {
    setTemplateId(id);
    // Pre-fill the name from the template so the primary action is reachable in one more click.
    // Only while the user has not typed their own — never overwrite what they wrote.
    const suggested = id === BLANK_TEMPLATE_ID ? '' : t(`createDialog.templates.${id}.name`);
    setName((current) => {
      const wasSuggested = AUTOMATION_TEMPLATE_OPTIONS.some(
        (option) => option.id !== BLANK_TEMPLATE_ID && current === t(`createDialog.templates.${option.id}.name`)
      );
      return current === '' || wasSuggested ? suggested : current;
    });
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const { data } = await createAutomation({
        variables: {
          formId,
          name: trimmed,
          triggerType,
          // The backend pins the trigger from the template, so `triggerType` above is only
          // consulted for a blank start.
          template: isBlank ? undefined : templateId,
        },
        refetchQueries: [{ query: GET_FORM_AUTOMATIONS, variables: { formId } }],
      });
      toastSuccess(t('toasts.createdTitle'), t('toasts.createdMessage', { values: { name: trimmed } }));
      resetAndClose();
      navigate(`/dashboard/form/${formId}/builder/automations/${data.createAutomation.id}`);
    } catch (error: any) {
      toastError(t('toasts.createErrorTitle'), error.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(next) : resetAndClose())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('createDialog.title')}</DialogTitle>
          <DialogDescription>{t('createDialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('createDialog.templateLabel')}</Label>
            <div className="grid gap-2 max-h-[280px] overflow-y-auto pr-1">
              {AUTOMATION_TEMPLATE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const selected = option.id === templateId;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleSelectTemplate(option.id)}
                    data-testid={`automation-template-${option.id}`}
                    className="flex items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors"
                    style={{
                      border: selected
                        ? '1px solid var(--tf-green)'
                        : '1px solid var(--tf-border-medium)',
                      backgroundColor: selected ? 'var(--tf-green-bg)' : undefined,
                    }}
                  >
                    <div className="mt-0.5 shrink-0">
                      <Icon className="h-4 w-4" style={{ color: selected ? 'var(--tf-green)' : 'var(--tf-muted)' }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-primary">
                        {t(`createDialog.templates.${option.id}.name`)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t(`createDialog.templates.${option.id}.description`)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="automation-name-input">{t('createDialog.nameLabel')}</Label>
            <Input
              id="automation-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('createDialog.namePlaceholder')}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            />
          </div>

          {/* A template already knows what starts it, so the dropdown would only be there to be
              contradicted. Blank is the one case where the choice is still the user's. */}
          {isBlank ? (
            <div className="space-y-2">
              <Label htmlFor="automation-trigger-select">{t('createDialog.triggerLabel')}</Label>
              <Select value={triggerType} onValueChange={setTriggerType}>
                <SelectTrigger id="automation-trigger-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_TRIGGER_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(`triggerTypes.${triggerTypeI18nKey(type)}`, { defaultValue: type })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t('createDialog.templateTriggerNote', {
                values: {
                  trigger: t(
                    `triggerTypes.${triggerTypeI18nKey(
                      AUTOMATION_TEMPLATE_OPTIONS.find((o) => o.id === templateId)?.triggerType ?? ''
                    )}`,
                    { defaultValue: '' }
                  ),
                },
              })}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose}>
            {t('createDialog.cancel')}
          </Button>
          <Button onClick={handleCreate} disabled={loading || !name.trim()}>
            {loading ? t('createDialog.creating') : t('createDialog.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
