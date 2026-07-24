/**
 * Automation Builder Store
 *
 * Standalone zustand store for the automation canvas (#197) — deliberately separate
 * from useFormBuilderStore (see automationBuilderSlice.ts for why).
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { createAutomationBuilderSlice, type AutomationBuilderState } from './slices/automationBuilderSlice';

export const useAutomationBuilderStore = create<AutomationBuilderState>()(
  devtools((set, get) => createAutomationBuilderSlice(set, get), { name: 'automation-builder-store' })
);
