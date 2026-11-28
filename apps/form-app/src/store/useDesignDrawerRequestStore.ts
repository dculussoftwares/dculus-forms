import { create } from 'zustand';

/**
 * Lets chrome outside PageBuilderTab (e.g. the header brand chip, the publish
 * pre-flight) ask the Content tab to open the Design drawer on Brand & style.
 * The request survives a tab switch because PageBuilderTab consumes it on mount.
 */
interface DesignDrawerRequestState {
  pendingSource: string | null;
  requestBrand: (source: string) => void;
  consume: () => void;
}

export const useDesignDrawerRequestStore = create<DesignDrawerRequestState>()((set) => ({
  pendingSource: null,
  requestBrand: (source) => set({ pendingSource: source }),
  consume: () => set({ pendingSource: null }),
}));
