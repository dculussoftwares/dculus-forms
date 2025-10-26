import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from '@dculus/ui-v2';
import { Copy, ExternalLink } from 'lucide-react';
import { useTranslate } from '../../i18n';

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  formTitle: string;
  loading: boolean;
}

interface UnpublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  formTitle: string;
  loading: boolean;
}

interface CollectResponsesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formUrl: string;
  formTitle: string;
  onCopyLink: () => void;
  onOpenForm: () => void;
}

export const DeleteDialog = ({
  open,
  onOpenChange,
  onConfirm,
  formTitle,
  loading,
}: DeleteDialogProps) => {
  const t = useTranslate();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('formDashboard.dialogs.delete.title')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('formDashboard.dialogs.delete.description', {
              formTitle,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {t('formDashboard.dialogs.delete.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={loading}
          >
            {loading
              ? t('formDashboard.dialogs.delete.deleting')
              : t('formDashboard.dialogs.delete.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export const UnpublishDialog = ({
  open,
  onOpenChange,
  onConfirm,
  formTitle,
  loading,
}: UnpublishDialogProps) => {
  const t = useTranslate();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('formDashboard.dialogs.unpublish.title')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('formDashboard.dialogs.unpublish.description', {
              formTitle,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {t('formDashboard.dialogs.unpublish.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-amber-600 text-white hover:bg-amber-700"
            disabled={loading}
          >
            {loading
              ? t('formDashboard.dialogs.unpublish.unpublishing')
              : t('formDashboard.dialogs.unpublish.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export const CollectResponsesDialog = ({
  open,
  onOpenChange,
  formUrl,
  formTitle,
  onCopyLink,
  onOpenForm,
}: CollectResponsesDialogProps) => {
  const t = useTranslate();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('formDashboard.dialogs.collectResponses.title')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('formDashboard.dialogs.collectResponses.description', {
              formTitle,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-sm text-foreground">
                {formUrl}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={onCopyLink}
              className="shrink-0"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {t('formDashboard.dialogs.collectResponses.close')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onOpenForm}
            className="gap-2 bg-primary hover:bg-primary/90"
          >
            <ExternalLink className="h-4 w-4" />
            {t('formDashboard.dialogs.collectResponses.openForm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
