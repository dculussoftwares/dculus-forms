import { useCallback, useEffect, useState } from 'react';
import { FieldType } from '@dculus/types';

/**
 * localStorage-backed pin/recent state for the Field Library, shared between the
 * rail's trigger (mega-panel) and the docked column mounted separately in
 * PageBuilderTab. Follows the same `storage` + same-tab `localStorageChange`
 * custom-event pattern as useAppConfig.ts so both mounts stay in sync without
 * prop drilling.
 */

const PINNED_KEY = 'dculus.fieldLibrary.pinned';
const RECENT_KEY = 'dculus.fieldLibrary.recent';
const RECENT_LIMIT = 3;
const STORAGE_EVENT = 'localStorageChange';

const readBoolean = (key: string): boolean => {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
};

const readRecentList = (): FieldType[] => {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FieldType[]) : [];
  } catch {
    return [];
  }
};

const writeStorage = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
    window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: { key, value } }));
  } catch {
    // Ignore write failures (e.g. private browsing storage quota)
  }
};

export const setFieldLibraryPinned = (pinned: boolean): void => {
  writeStorage(PINNED_KEY, String(pinned));
};

/** Records a field type as used; call from every add path (click and drag). */
export const recordRecentFieldType = (fieldType: FieldType): void => {
  const next = [fieldType, ...readRecentList().filter((type) => type !== fieldType)].slice(
    0,
    RECENT_LIMIT
  );
  writeStorage(RECENT_KEY, JSON.stringify(next));
};

const useStorageSync = <T,>(key: string, read: () => T): T => {
  const [value, setValue] = useState<T>(read);

  useEffect(() => {
    setValue(read());

    const handleStorage = (e: StorageEvent) => {
      if (e.key === key) setValue(read());
    };
    const handleCustom = (e: Event) => {
      const detail = (e as CustomEvent<{ key: string }>).detail;
      if (detail?.key === key) setValue(read());
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(STORAGE_EVENT, handleCustom);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(STORAGE_EVENT, handleCustom);
    };
  }, [key]);

  return value;
};

export const useFieldLibraryPinned = (): [boolean, (pinned: boolean) => void] => {
  const pinned = useStorageSync(PINNED_KEY, () => readBoolean(PINNED_KEY));
  const setPinned = useCallback((next: boolean) => setFieldLibraryPinned(next), []);
  return [pinned, setPinned];
};

export const useRecentFieldTypes = (): FieldType[] =>
  useStorageSync(RECENT_KEY, readRecentList);
