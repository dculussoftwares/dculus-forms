import React from 'react';
import { Button } from '@dculus/ui';
import { RotateCcw, Save, AlertCircle } from 'lucide-react';

interface FieldSettingsFooterProps {
  isDirty: boolean;
  isValid: boolean;
  isConnected: boolean;
  isSaving: boolean;
  errors: Record<string, any>;
  onReset: () => void;
  onCancel: () => void;
  onSave: () => void;
}

export const FieldSettingsFooter: React.FC<FieldSettingsFooterProps> = ({
  isDirty,
  isValid,
  isConnected,
  isSaving,
  errors,
  onReset,
  onCancel,
  onSave
}) => {
  return (
    <div 
      data-testid="field-settings-footer"
      className={`flex-shrink-0 border-t p-4 space-y-4 transition-all duration-200 ${
        isDirty 
          ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800 shadow-lg' 
          : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
      }`}>
      {/* Form Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
            disabled={!isDirty || !isConnected}
            className="text-gray-500 hover:text-gray-700"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Reset
          </Button>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={!isDirty || !isConnected}
          >
            Cancel
          </Button>
          <div className="relative group">
            <Button
              type="button"
              size="sm"
              onClick={onSave}
              disabled={!isDirty || !isValid || !isConnected || isSaving}
              className={`transition-all duration-200 ${
                isDirty 
                  ? 'bg-orange-600 hover:bg-orange-700 ring-2 ring-orange-200 dark:ring-orange-800 scale-105' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-1" />
                  Save
                </>
              )}
            </Button>
            {/* Tooltip for disabled save button */}
            {isDirty && !isValid && Object.keys(errors).length > 0 && (
              <div className="absolute bottom-full right-0 mb-2 p-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                <div className="flex items-center space-x-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>Fix validation errors to save</span>
                </div>
                <div className="absolute top-full right-3 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Connection Status */}
      {!isConnected && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
          <p className="text-xs text-yellow-800 dark:text-yellow-300">
            Changes are disabled while offline
          </p>
        </div>
      )}

      {/* Keyboard shortcuts hint */}
      <div className={`text-xs pt-2 border-t transition-colors duration-200 ${
        isDirty 
          ? 'text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800' 
          : 'text-gray-500 dark:text-gray-400 border-gray-100 dark:border-gray-800'
      }`}>
        <div className="flex items-center justify-between">
          <span className={isDirty ? 'font-medium' : ''}>
            {isDirty ? 'Save your changes:' : 'Keyboard shortcuts:'}
          </span>
          <div className="flex items-center space-x-4">
            <span className={isDirty ? 'font-medium animate-pulse' : ''}>⌘/Ctrl + S to save</span>
            <span>Esc to cancel</span>
          </div>
        </div>
      </div>
    </div>
  );
};