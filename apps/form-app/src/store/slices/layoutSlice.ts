/**
 * Layout Slice
 *
 * Manages form layout and theming configuration.
 * Depends on: collaborationSlice (for YJS persistence)
 */

import * as Y from 'yjs';
import { LayoutSlice, SliceCreator } from '../types/store.types';
import { FormLayout, ThemeType, SpacingType, LayoutCode, PageModeType } from '@dculus/types';

/**
 * Default layout configuration
 */
const DEFAULT_LAYOUT: FormLayout = {
  theme: ThemeType.LIGHT,
  textColor: '#1f2937',
  spacing: SpacingType.NORMAL,
  code: 'L1' as LayoutCode,
  content: '',
  customBackGroundColor: '#ffffff',
  customCTAButtonName: 'Submit',
  backgroundImageKey: '',
  pageMode: PageModeType.MULTIPAGE,
  isCustomBackgroundColorEnabled: false,
};

/**
 * Create the layout slice
 *
 * This slice manages layout and theming state, including:
 * - Theme (light/dark/auto)
 * - Colors and spacing
 * - Layout code and background
 * - Page mode (single/multi-page)
 * - Field shuffling
 */
export const createLayoutSlice: SliceCreator<LayoutSlice> = (set, get) => {
  return {
    // Initial state
    layout: DEFAULT_LAYOUT,
    isShuffleEnabled: false,

    /**
     * Update layout configuration
     *
     * Updates local state and persists to YJS document if connected.
     */
    updateLayout: (layoutUpdates: Partial<FormLayout>) => {
      const { layout } = get();

      const updatedLayout: FormLayout = {
        ...layout,
        ...layoutUpdates,
      };

      // Update local state
      set({ layout: updatedLayout });

      // Persist to YJS document if connected
      const { _getYDoc, _isYJSReady } = get() as any;
      const ydoc = _getYDoc();
      const isReady = _isYJSReady();

      if (ydoc && isReady) {
        const formSchemaMap = ydoc.getMap('formSchema');
        let layoutMap = formSchemaMap.get('layout') as Y.Map<any>;

        if (!layoutMap) {
          layoutMap = new Y.Map();
          formSchemaMap.set('layout', layoutMap);
        }

        // Update only the changed properties in YJS
        Object.entries(layoutUpdates).forEach(([key, value]) => {
          if (value !== undefined) {
            layoutMap.set(key, value);
          }
        });
      }
    },

    /**
     * Internal helper: Get default layout
     */
    _getDefaultLayout: () => DEFAULT_LAYOUT,
  };
};
