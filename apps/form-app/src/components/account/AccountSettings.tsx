import React, { useRef, useState, useEffect } from 'react';
import { Button, Card, Input, UserAvatar, toastSuccess, toastError } from '@dculus/ui';
import { Camera } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { updateUser } from '../../lib/auth-client';
import { uploadFileHTTP, UploadError } from '../../services/fileUploadService';
import { useTranslation } from '../../hooks/useTranslation';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ACCEPTED_MIME = 'image/jpeg,image/jpg,image/png,image/webp,image/gif';

export const AccountSettings: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation('accountSettings');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(user?.name ?? '');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);

  useEffect(() => {
    setDisplayName(user?.name ?? '');
  }, [user?.name]);

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_AVATAR_BYTES) {
      toastError(t('avatar.toast.fileTooLargeTitle'), t('avatar.toast.fileTooLargeMessage'));
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const result = await uploadFileHTTP(file, 'UserAvatar');
      await updateUser({ image: result.url });
      toastSuccess(t('avatar.toast.successTitle'), t('avatar.toast.successMessage'));
    } catch (err) {
      const msg = err instanceof UploadError ? err.message : undefined;
      toastError(t('avatar.toast.errorTitle'), msg ?? t('avatar.toast.errorMessage'));
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveName = async () => {
    const trimmed = displayName.trim();
    if (!trimmed || trimmed === user?.name) return;

    setIsSavingName(true);
    try {
      await updateUser({ name: trimmed });
      toastSuccess(t('name.toast.successTitle'), t('name.toast.successMessage'));
    } catch {
      toastError(t('name.toast.errorTitle'), t('name.toast.errorMessage'));
    } finally {
      setIsSavingName(false);
    }
  };

  return (
    <div>
      <Card className="overflow-hidden">
        {/* Profile picture row */}
        <div className="p-6">
          <div className="flex items-center gap-5">
            <div className="relative group cursor-pointer shrink-0" onClick={handleAvatarClick}>
              <UserAvatar
                name={user?.name}
                email={user?.email}
                image={user?.image}
                size="xl"
              />
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-5 w-5 text-white" strokeWidth={1.5} />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[#3c323e] truncate">{user?.name || '—'}</div>
              <div className="text-xs text-[#655d67] mt-0.5 truncate">{user?.email}</div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAvatarClick}
                disabled={isUploadingAvatar}
                className="mt-2 h-7 px-2 text-xs text-[#655d67] hover:text-[#3c323e] hover:bg-[rgba(87,84,91,0.06)] -ml-2"
              >
                <Camera className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />
                {isUploadingAvatar ? t('avatar.uploading') : t('avatar.changeButton')}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_MIME}
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-[rgba(81,76,84,0.08)]" />

        {/* Display name row */}
        <div className="p-6 space-y-3">
          <div className="text-sm font-medium text-[#3c323e]">{t('name.label')}</div>
          <div className="flex gap-3">
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('name.placeholder')}
              className="max-w-xs"
              onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
            />
            <Button
              onClick={handleSaveName}
              disabled={isSavingName || !displayName.trim() || displayName.trim() === user?.name}
            >
              {isSavingName ? t('name.saving') : t('name.saveButton')}
            </Button>
          </div>
        </div>

        <div className="border-t border-[rgba(81,76,84,0.08)]" />

        {/* Email row (read-only) */}
        <div className="p-6 space-y-3">
          <div>
            <div className="text-sm font-medium text-[#3c323e]">{t('email.label')}</div>
            <div className="text-xs text-[#655d67] mt-0.5">{t('email.hint')}</div>
          </div>
          <Input
            value={user?.email ?? ''}
            readOnly
            className="max-w-xs bg-[rgba(87,84,91,0.04)] text-[#655d67] cursor-not-allowed"
          />
        </div>
      </Card>
    </div>
  );
};
