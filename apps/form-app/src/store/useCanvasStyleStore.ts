import { create } from 'zustand';

export type CanvasStyleTarget = 'title' | 'input' | 'surface';

/** Which canvas element currently has its click-to-style popover open (at most one). */
interface CanvasStyleState {
  target: CanvasStyleTarget | null;
  toggle: (target: CanvasStyleTarget) => void;
  close: () => void;
}

export const useCanvasStyleStore = create<CanvasStyleState>()((set) => ({
  target: null,
  toggle: (target) => set((s) => ({ target: s.target === target ? null : target })),
  close: () => set({ target: null }),
}));
