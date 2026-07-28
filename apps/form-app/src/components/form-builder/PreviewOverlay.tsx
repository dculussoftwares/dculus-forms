import React from 'react';
import { Dialog, DialogContent, DialogTitle } from '@dculus/ui';
import { useTranslation } from '../../hooks/useTranslation';
import { PreviewTab } from './tabs';

interface PreviewOverlayProps {
  formId?: string;
  isOpen: boolean;
  onClose: () => void;
}

// Full-screen overlay reusing PreviewTab as-is (renderer + mobile-CSS + test-submit flow
// untouched). Opened via the ▶ Preview header button, Cmd/Ctrl+P, and the `?preview=1`
// deep link. See epic #226 / ticket #227.
export const PreviewOverlay: React.FC<PreviewOverlayProps> = ({ formId, isOpen, onClose }) => {
  const { t } = useTranslation('formBuilderHeader');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-none w-screen h-screen inset-0 top-0 left-0 translate-x-0 translate-y-0 rounded-none border-0 p-0 gap-0 flex flex-col"
        data-testid="preview-overlay"
      >
        <div
          className="flex items-center px-4 h-11 shrink-0"
          style={{ borderBottom: '1px solid var(--tf-border-medium)' }}
        >
          <DialogTitle className="text-sm font-semibold leading-none tracking-normal">{t('buttons.preview')}</DialogTitle>
        </div>
        <div className="flex-1 overflow-hidden">
          <PreviewTab formId={formId} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PreviewOverlay;
