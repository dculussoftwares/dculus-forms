import React, { useState } from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@dculus/ui';
import { Folder, Loader2, Lock, X } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';

interface DestinationFolderFieldProps {
  provider: 'google' | 'microsoft';
  folder?: { id: string; name: string };
  /** The file already exists, so its folder can no longer change. */
  locked: boolean;
  pickerAvailable: boolean;
  onPick: () => Promise<void>;
  onClear: () => void;
}

export const DestinationFolderField: React.FC<DestinationFolderFieldProps> = ({
  provider,
  folder,
  locked,
  pickerAvailable,
  onPick,
  onClear,
}) => {
  const { t } = useTranslation('pluginDestination');
  const [isPicking, setIsPicking] = useState(false);

  if (!locked && !pickerAvailable) return null;

  const handlePick = async () => {
    setIsPicking(true);
    try {
      await onPick();
    } finally {
      setIsPicking(false);
    }
  };

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
            <span className="text-sm truncate">{folder?.name ?? t(`root.${provider}` as const)}</span>
            {locked && <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label={t('locked')} />}
          </div>
          {!locked && (
            <div className="flex items-center gap-1 shrink-0">
              <Button type="button" variant="outline" size="sm" onClick={handlePick} disabled={isPicking}>
                {isPicking && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                {folder ? t('change') : t('choose')}
              </Button>
              {folder && (
                <Button type="button" variant="ghost" size="sm" onClick={onClear} aria-label={t('clear')}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
