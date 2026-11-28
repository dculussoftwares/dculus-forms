import { create } from 'zustand';

export type CanvasStyleTarget = 'title' | 'input' | 'surface';

/**
 * Which canvas element currently has its click-to-style popover open (at most one).
 * `instanceId` tells apart several elements of the same target kind (one input per field).
 */
interface CanvasStyleState {
  target: CanvasStyleTarget | null;
  instanceId: string | null;
  toggle: (target: CanvasStyleTarget, instanceId?: string) => void;
  close: () => void;
}

export const useCanvasStyleStore = create<CanvasStyleState>()((set) => ({
  target: null,
  instanceId: null,
  toggle: (target, instanceId) =>
    set((s) =>
      s.target === target && s.instanceId === (instanceId ?? null)
        ? { target: null, instanceId: null }
        : { target, instanceId: instanceId ?? null }
    ),
  close: () => set({ target: null, instanceId: null }),
}));
