import React, { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { uploadFileHTTP } from '../../../../services/fileUploadService';

interface BackgroundImageUploadProps {
  formId: string;
  onUploadSuccess: () => void;
}

export const BackgroundImageUpload: React.FC<BackgroundImageUploadProps> = ({
  formId,
  onUploadSuccess
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      await uploadFileHTTP(file, 'FormBackground', formId);
      onUploadSuccess();
    } catch (error) {
      console.error('Error uploading file:', error);
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
      <button
        onClick={handleClick}
        disabled={loading}
        className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-purple-400 dark:hover:border-purple-500 transition-colors bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
      >
        <div className="flex flex-col items-center space-y-2">
          {loading ? (
            <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Plus className="w-6 h-6 text-gray-500 dark:text-gray-400" />
          )}
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {loading ? 'Uploading...' : 'Upload Image'}
          </span>
        </div>
      </button>
      
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