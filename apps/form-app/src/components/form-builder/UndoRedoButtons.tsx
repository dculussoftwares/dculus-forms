import React, { useEffect, useState, useCallback } from 'react';
import { Undo2, Redo2 } from 'lucide-react';
import { useFormBuilderStore } from '../../store/useFormBuilderStore';

interface UndoRedoButtonsProps {
  className?: string;
}

/**
 * Undo/Redo buttons with keyboard shortcuts (Ctrl+Z, Ctrl+Y)
 * Only undoes/redoes the current user's changes
 */
export const UndoRedoButtons: React.FC<UndoRedoButtonsProps> = ({
  className = '',
}) => {
  const { undo, redo, canUndo, canRedo, isConnected } = useFormBuilderStore();
  const [undoAvailable, setUndoAvailable] = useState(false);
  const [redoAvailable, setRedoAvailable] = useState(false);

  // Update availability state periodically
  useEffect(() => {
    if (!isConnected) {
      setUndoAvailable(false);
      setRedoAvailable(false);
      return;
    }

    const updateAvailability = () => {
      setUndoAvailable(canUndo());
      setRedoAvailable(canRedo());
    };

    updateAvailability();
    const interval = setInterval(updateAvailability, 500);
    return () => clearInterval(interval);
  }, [isConnected, canUndo, canRedo]);

  // Handle undo
  const handleUndo = useCallback(() => {
    if (canUndo()) {
      undo();
      setUndoAvailable(canUndo());
      setRedoAvailable(canRedo());
    }
  }, [undo, canUndo, canRedo]);

  // Handle redo
  const handleRedo = useCallback(() => {
    if (canRedo()) {
      redo();
      setUndoAvailable(canUndo());
      setRedoAvailable(canRedo());
    }
  }, [redo, canUndo, canRedo]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z or Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Ctrl+Y or Cmd+Y or Ctrl+Shift+Z for redo
      if (
        ((e.ctrlKey || e.metaKey) && e.key === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')
      ) {
        e.preventDefault();
        handleRedo();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  if (!isConnected) return null;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button
        onClick={handleUndo}
        disabled={!undoAvailable}
        className={`p-2 rounded-lg transition-all duration-200 ${
          undoAvailable
            ? 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
            : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
        }`}
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
      >
        <Undo2 className="w-5 h-5" />
      </button>
      <button
        onClick={handleRedo}
        disabled={!redoAvailable}
        className={`p-2 rounded-lg transition-all duration-200 ${
          redoAvailable
            ? 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
            : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
        }`}
        title="Redo (Ctrl+Y)"
        aria-label="Redo"
      >
        <Redo2 className="w-5 h-5" />
      </button>
    </div>
  );
};

export default UndoRedoButtons;
