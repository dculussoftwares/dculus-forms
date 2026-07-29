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

  const [createAutomation, { loading }] = useMutation(CREATE_AUTOMATION);

  const resetAndClose = () => {
    setName('');
    setTriggerType(SUPPORTED_TRIGGER_TYPES[0]);
    onOpenChange(false);
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const { data } = await createAutomation({
        variables: { formId, name: trimmed, triggerType },
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('createDialog.title')}</DialogTitle>
          <DialogDescription>{t('createDialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
