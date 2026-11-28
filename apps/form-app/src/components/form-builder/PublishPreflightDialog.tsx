import React from 'react';
import { CheckCircle2, CircleAlert } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@dculus/ui';
import { DEFAULT_THANK_YOU_CONTENT } from '@dculus/types';
import { useFormBuilderStore } from '../../store/useFormBuilderStore';
import { useTranslation } from '../../hooks/useTranslation';

interface PublishPreflightDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formTitle: string;
  loading: boolean;
  onConfirm: () => void;
  onStyle: () => void;
}

interface Check {
  id: 'title' | 'questions' | 'thankYou' | 'brand';
  ok: boolean;
}

/** Non-blocking checklist shown before publishing; every warning can be skipped. */
export const PublishPreflightDialog: React.FC<PublishPreflightDialogProps> = ({
  open,
  onOpenChange,
  formTitle,
  loading,
  onConfirm,
  onStyle,
}) => {
  const { t } = useTranslation('formBuilderHeader');
  const pages = useFormBuilderStore((s) => s.pages);
  const layout = useFormBuilderStore((s) => s.layout);

  const questionCount = pages.reduce((n, p) => n + p.fields.length, 0);
  const tokens = layout?.tokens;
  const checks: Check[] = [
    { id: 'title', ok: formTitle.trim().length > 0 && !/^untitled/i.test(formTitle.trim()) },
    { id: 'questions', ok: questionCount > 0 },
    {
      id: 'thankYou',
      ok: Boolean(layout?.thankYouContent) && layout?.thankYouContent !== DEFAULT_THANK_YOU_CONTENT,
    },
    { id: 'brand', ok: Boolean(tokens && Object.keys(tokens).some((k) => k !== 'version')) },
  ];
  const hasWarnings = checks.some((c) => !c.ok);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="publish-preflight-dialog">
        <DialogHeader>
          <DialogTitle>{t('preflight.title')}</DialogTitle>
          <DialogDescription>
            {hasWarnings ? t('preflight.descriptionWarnings') : t('preflight.descriptionReady')}
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2" aria-label={t('preflight.title')}>
          {checks.map((check) => (
            <li
              key={check.id}
              className="flex items-start gap-2.5 text-sm"
              data-testid={`preflight-${check.id}`}
              data-ok={check.ok}
            >
              {check.ok ? (
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-[var(--tf-green)] shrink-0" />
              ) : (
                <CircleAlert className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium">{t(`preflight.checks.${check.id}.label`)}</p>
                {!check.ok && (
                  <p className="text-xs text-muted-foreground">{t(`preflight.checks.${check.id}.hint`)}</p>
                )}
              </div>
              {check.id === 'brand' && !check.ok && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs shrink-0"
                  onClick={() => {
                    onOpenChange(false);
                    onStyle();
                  }}
                  data-testid="preflight-style-button"
                >
                  {t('preflight.styleNow')}
                </Button>
              )}
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('preflight.cancel')}
          </Button>
          <Button onClick={onConfirm} disabled={loading} data-testid="preflight-publish-button">
            {loading
              ? t('buttons.publishing')
              : hasWarnings
                ? t('preflight.publishAnyway')
                : t('buttons.publishForm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
