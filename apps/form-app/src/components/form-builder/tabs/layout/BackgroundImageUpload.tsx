import React, { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, toastError, toastSuccess } from '@dculus/ui';
import { uploadFileHTTP, UploadError } from '../../../../services/fileUploadService';
import { useTranslation } from '../../../../hooks';

interface BackgroundImageUploadProps {
  formId: string;
  onUploadSuccess: () => void;
}

export const BackgroundImageUpload: React.FC<BackgroundImageUploadProps> = ({
  formId,
  onUploadSuccess
}) => {
  const { t } = useTranslation('backgroundImage');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      await uploadFileHTTP(file, 'FormBackground', formId);
      toastSuccess(t('upload.success'));
      onUploadSuccess();
    } catch (error) {
      if (error instanceof UploadError) {
        if (error.code === 'FILE_TOO_LARGE') {
          toastError(t('upload.errors.fileTooLarge.title'), t('upload.errors.fileTooLarge.message'));
        } else if (error.code === 'EDITOR_ACCESS_REQUIRED') {
          toastError(t('upload.errors.accessDenied.title'), t('upload.errors.accessDenied.message'));
        } else {
          toastError(t('upload.errors.failed.title'), t('upload.errors.failed.message'));
        }
      } else {
        toastError(t('upload.errors.failed.title'), t('upload.errors.failed.message'));
      }
    } finally {
      setLoading(false);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        onClick={handleClick}
        disabled={loading}
        className="w-full p-4 h-auto border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-500 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <div className="flex flex-col items-center space-y-2">
          {loading ? (
            <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Plus className="w-6 h-6 text-gray-500 dark:text-gray-400" />
          )}
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {loading ? t('upload.uploading') : t('upload.uploadImage')}
          </span>
        </div>
      </Button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
};