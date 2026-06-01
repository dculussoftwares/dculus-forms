import { useEffect, useRef, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { useFormBuilderStore } from '../store/useFormBuilderStore';

export function useYjsUndoManager() {
  const ydoc = useFormBuilderStore((state) => state.ydoc);
  const undoManagerRef = useRef<Y.UndoManager | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  useEffect(() => {
    if (!ydoc) {
      undoManagerRef.current = null;
      setCanUndo(false);
      return;
    }

    const formSchemaMap = ydoc.getMap('formSchema');
    const manager = new Y.UndoManager([formSchemaMap], {
      captureTimeout: 60_000, // group all changes within 60 s into one undo step
    });

    manager.on('stack-item-added', () => setCanUndo(manager.undoStack.length > 0));
    manager.on('stack-item-popped', () => setCanUndo(manager.undoStack.length > 0));

    undoManagerRef.current = manager;

    return () => {
      manager.destroy();
      undoManagerRef.current = null;
      setCanUndo(false);
    };
  }, [ydoc]);

  // Call before first AI op in a session — breaks the current capture group
  // so AI changes land in their own undo step separate from the user's prior edits.
  const beginBatch = useCallback(() => {
    undoManagerRef.current?.stopCapturing();
  }, []);

  // Call before the next user message to clear the undo state for the new session.
  const clearBatch = useCallback(() => {
    undoManagerRef.current?.clear();
    setCanUndo(false);
  }, []);

  const undo = useCallback(() => {
    undoManagerRef.current?.undo();
    setCanUndo((undoManagerRef.current?.undoStack.length ?? 0) > 0);
  }, []);

  const getUndoStackDepth = useCallback(
    () => undoManagerRef.current?.undoStack.length ?? 0,
    []
  );

  return { canUndo, beginBatch, clearBatch, undo, getUndoStackDepth };
}
