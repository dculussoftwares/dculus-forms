import React, { useState } from 'react';
import { Copy, Trash2 } from 'lucide-react';
import { FormPage } from '@dculus/types';
import { Button, Input, Label, ScrollArea, Switch } from '@dculus/ui';
import { useFormBuilderStore } from '../../../store/useFormBuilderStore';
import { useFormPermissions } from '../../../hooks/useFormPermissions';
import { useTranslation } from '../../../hooks/useTranslation';
import { ConfirmationDialog } from '../ConfirmationDialog';

interface PageSettingsPanelProps {
  page: FormPage;
  isConnected: boolean;
}

/**
 * PageSettingsPanel — right-panel contents when a page (not a field within it)
 * is selected: title, duplicate, delete. Same store actions the journey rail's
 * hover controls already use — this panel just gives them a permanent home
 * that doesn't require hovering. Permission-gated like the rail.
 */
export const PageSettingsPanel: React.FC<PageSettingsPanelProps> = ({ page, isConnected }) => {
  const { t } = useTranslation('pageBuilderTab');
  const { t: tPage } = useTranslation('draggablePageItem');
  const permissions = useFormPermissions();

  const updatePageTitle = useFormBuilderStore((state) => state.updatePageTitle);
  const updatePageShowName = useFormBuilderStore((state) => state.updatePageShowName);
  const duplicatePage = useFormBuilderStore((state) => state.duplicatePage);
  const removePage = useFormBuilderStore((state) => state.removePage);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const canEditTitle = permissions.canEditFields() && isConnected;

  return (
    <ScrollArea className="min-h-0 flex-1" data-testid="page-settings-panel">
      <div className="p-4">
        <h3 className="text-sm font-semibold text-primary dark:text-white mb-4">
          {t('pagePane.title')}
        </h3>

        <div className="pb-4 border-b border-[var(--tf-border-medium)] dark:border-gray-700">
          <div className="space-y-2">
            <Label className="block text-sm font-medium text-foreground dark:text-gray-300">
              {t('pagePane.titleLabel')}
            </Label>
            <Input
              type="text"
              value={page.title}
              onChange={(e) => canEditTitle && updatePageTitle(page.id, e.target.value)}
              placeholder={t('pagePane.titlePlaceholder')}
              disabled={!canEditTitle}
              data-testid="page-settings-title-input"
            />
          </div>

          <div className="flex items-center justify-between gap-2 mt-4">
            <Label
              htmlFor="page-settings-show-name"
              className="text-sm font-medium text-foreground dark:text-gray-300 cursor-pointer"
            >
              {t('pagePane.showPageNameLabel')}
            </Label>
            <Switch
              id="page-settings-show-name"
              checked={page.showPageName !== false}
              disabled={!canEditTitle}
              onCheckedChange={(checked) => updatePageShowName(page.id, checked)}
              data-testid="page-settings-show-name-toggle"
            />
          </div>
        </div>

        {!permissions.isReadOnly && (
          <div className="pt-4 flex flex-col gap-2">
            {permissions.canAddPages() && (
              <Button
                variant="outline"
                onClick={() => duplicatePage(page.id)}
                disabled={!isConnected}
                data-testid="page-settings-duplicate"
                className="w-full justify-center gap-2"
              >
                <Copy className="w-4 h-4" />
                {t('pagePane.duplicateButton')}
              </Button>
            )}
            {permissions.canDeletePages() && (
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(true)}
                disabled={!isConnected}
                data-testid="page-settings-delete"
                className="w-full justify-center gap-2 text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
                {t('pagePane.deleteButton')}
              </Button>
            )}
          </div>
        )}
      </div>

      <ConfirmationDialog
        isOpen={showDeleteDialog}
        title={tPage('deleteDialog.title')}
        message={tPage('deleteDialog.message', { values: { pageTitle: page.title } })}
        confirmLabel={tPage('deleteDialog.confirmLabel')}
        cancelLabel={tPage('deleteDialog.cancelLabel')}
        variant="destructive"
        onConfirm={() => {
          removePage(page.id);
          setShowDeleteDialog(false);
        }}
        onCancel={() => setShowDeleteDialog(false)}
      />
    </ScrollArea>
  );
};

export default PageSettingsPanel;
