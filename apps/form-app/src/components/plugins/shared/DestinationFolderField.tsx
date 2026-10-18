import React, { useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@dculus/ui';
import { Folder, FolderPlus, Loader2, Lock, X } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';

interface DestinationFolderFieldProps {
  provider: 'google' | 'microsoft';
  folder?: { id: string; name: string };
  /** The file already exists, so its folder can no longer change. */
  locked: boolean;
  pickerAvailable: boolean;
  onPick: () => Promise<void>;
  onClear: () => void;
  /** Creates a folder inside the current choice (or the root) and selects it. Resolves true on success so the dialog can close. */
  onCreate?: (name: string) => Promise<boolean>;
}

export const DestinationFolderField: React.FC<DestinationFolderFieldProps> = ({
  provider,
  folder,
  locked,
  pickerAvailable,
  onPick,
  onClear,
  onCreate,
}) => {
  const { t } = useTranslation('pluginDestination');
  const [isPicking, setIsPicking] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  if (!locked && !pickerAvailable && !onCreate) return null;

  const handlePick = async () => {
    setIsPicking(true);
    try {
      await onPick();
    } finally {
      setIsPicking(false);
    }
  };

  const closeCreate = () => {
    if (isCreating) return;
    setIsCreateOpen(false);
    setNewFolderName('');
  };

  const handleCreate = async () => {
    const name = newFolderName.trim();
    if (!name || !onCreate) return;
    setIsCreating(true);
    try {
      if (await onCreate(name)) {
        setIsCreateOpen(false);
        setNewFolderName('');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const parentName = folder?.name ?? t(`root.${provider}` as const);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('title')}</CardTitle>
        <CardDescription>{locked ? t('lockedHint') : t(`hint.${provider}` as const)}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <div className="flex items-center gap-2 min-w-0">
            <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-sm truncate">{parentName}</span>
            {locked && <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label={t('locked')} />}
          </div>
          {!locked && (
            <div className="flex items-center gap-1 shrink-0">
              {pickerAvailable && (
                <Button type="button" variant="outline" size="sm" onClick={handlePick} disabled={isPicking}>
                  {isPicking && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                  {folder ? t('change') : t('choose')}
                </Button>
              )}
              {onCreate && (
                <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateOpen(true)}>
                  <FolderPlus className="h-3.5 w-3.5 mr-1.5" />
                  {t('create.button')}
                </Button>
              )}
              {folder && (
                <Button type="button" variant="ghost" size="sm" onClick={onClear} aria-label={t('clear')}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>

      {onCreate && (
        <Dialog open={isCreateOpen} onOpenChange={(open) => (open ? setIsCreateOpen(true) : closeCreate())}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('create.title')}</DialogTitle>
              <DialogDescription>{t('create.description', { values: { parent: parentName } })}</DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleCreate();
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="new-folder-name">{t('create.nameLabel')}</Label>
                <Input
                  id="new-folder-name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder={t('create.namePlaceholder')}
                  maxLength={200}
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeCreate} disabled={isCreating}>
                  {t('create.cancel')}
                </Button>
                <Button type="submit" disabled={isCreating || !newFolderName.trim()}>
                  {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {t('create.submit')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
};
