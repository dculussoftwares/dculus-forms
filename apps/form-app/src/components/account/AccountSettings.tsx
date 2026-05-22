import React, { useRef, useState, useEffect } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  UserAvatar,
  toastSuccess,
  toastError,
} from '@dculus/ui';
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
    <div className="space-y-6 max-w-xl">
      {/* Avatar card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('avatar.heading')}</CardTitle>
          <CardDescription>{t('avatar.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
              <UserAvatar
                name={user?.name}
                email={user?.email}
                image={user?.image}
                size="xl"
              />
              <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-5 w-5 text-white" strokeWidth={1.5} />
              </div>
            </div>
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAvatarClick}
                disabled={isUploadingAvatar}
              >
                <Camera className="h-4 w-4 mr-2" strokeWidth={1.5} />
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
        </CardContent>
      </Card>

      {/* Name card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('name.label')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('name.placeholder')}
              className="max-w-xs"
              onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
            />
            <Button onClick={handleSaveName} disabled={isSavingName || !displayName.trim() || displayName.trim() === user?.name}>
              {isSavingName ? t('name.saving') : t('name.saveButton')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email card (read-only) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('email.label')}</CardTitle>
          <CardDescription>{t('email.hint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Input value={user?.email ?? ''} readOnly className="max-w-xs bg-muted cursor-not-allowed" />
        </CardContent>
      </Card>
    </div>
  );
};
