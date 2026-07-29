import { renderHook, act } from '@testing-library/react';
import { FieldType } from '@dculus/types';
import {
  recordRecentFieldType,
  setFieldLibraryPinned,
  useFieldLibraryPinned,
  useRecentFieldTypes,
} from '../fieldLibraryStorage';

describe('fieldLibraryStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('useFieldLibraryPinned', () => {
    it('defaults to unpinned when nothing is stored', () => {
      const { result } = renderHook(() => useFieldLibraryPinned());
      expect(result.current[0]).toBe(false);
    });

    it('persists pin state to localStorage and reflects it back', () => {
      const { result } = renderHook(() => useFieldLibraryPinned());

      act(() => result.current[1](true));

      expect(localStorage.getItem('dculus.fieldLibrary.pinned')).toBe('true');
      expect(result.current[0]).toBe(true);
    });

    it('syncs pin state across independently-mounted hook instances', () => {
      const rail = renderHook(() => useFieldLibraryPinned());
      const docked = renderHook(() => useFieldLibraryPinned());

      act(() => rail.result.current[1](true));

      expect(docked.result.current[0]).toBe(true);

      act(() => docked.result.current[1](false));

      expect(rail.result.current[0]).toBe(false);
    });

    it('setFieldLibraryPinned (non-hook helper) is picked up by mounted hooks', () => {
      const { result } = renderHook(() => useFieldLibraryPinned());

      act(() => setFieldLibraryPinned(true));

      expect(result.current[0]).toBe(true);
    });
  });

  describe('recent field types', () => {
    it('starts empty', () => {
      const { result } = renderHook(() => useRecentFieldTypes());
      expect(result.current).toEqual([]);
    });

    it('records the most recently used type first', () => {
      const { result } = renderHook(() => useRecentFieldTypes());

      act(() => recordRecentFieldType(FieldType.TEXT_INPUT_FIELD));
      act(() => recordRecentFieldType(FieldType.EMAIL_FIELD));

      expect(result.current).toEqual([FieldType.EMAIL_FIELD, FieldType.TEXT_INPUT_FIELD]);
    });

    it('de-duplicates by moving a re-used type back to the front', () => {
      const { result } = renderHook(() => useRecentFieldTypes());

      act(() => recordRecentFieldType(FieldType.TEXT_INPUT_FIELD));
      act(() => recordRecentFieldType(FieldType.EMAIL_FIELD));
      act(() => recordRecentFieldType(FieldType.TEXT_INPUT_FIELD));

      expect(result.current).toEqual([FieldType.TEXT_INPUT_FIELD, FieldType.EMAIL_FIELD]);
    });

    it('caps the list at the 3 most recent types', () => {
      const { result } = renderHook(() => useRecentFieldTypes());

      act(() => recordRecentFieldType(FieldType.TEXT_INPUT_FIELD));
      act(() => recordRecentFieldType(FieldType.EMAIL_FIELD));
      act(() => recordRecentFieldType(FieldType.NUMBER_FIELD));
      act(() => recordRecentFieldType(FieldType.DATE_FIELD));

      expect(result.current).toEqual([
        FieldType.DATE_FIELD,
        FieldType.NUMBER_FIELD,
        FieldType.EMAIL_FIELD,
      ]);
    });
  });
});
