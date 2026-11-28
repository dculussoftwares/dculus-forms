import { create } from 'zustand';
import type { FormDesignTokens } from '@dculus/types';

/**
 * Transient, local-only brand preview (preset hover, colour dragging, before/after).
 * Never persisted or synced to Y.js; the canvas reads it instead of `layout.tokens` while active.
 */
interface BrandPreviewState {
  active: boolean;
  /** Tokens to show while active; undefined shows the form unbranded. */
  tokens: FormDesignTokens | undefined;
  setPreview: (tokens: FormDesignTokens | undefined) => void;
  clearPreview: () => void;
}

export const useBrandPreviewStore = create<BrandPreviewState>()((set) => ({
  active: false,
  tokens: undefined,
  setPreview: (tokens) => set({ active: true, tokens }),
  clearPreview: () => set({ active: false, tokens: undefined }),
}));

/** Tokens the canvas should render: the transient preview when active, otherwise the saved ones. */
export const useEffectiveTokens = (saved: FormDesignTokens | undefined): FormDesignTokens | undefined => {
  const active = useBrandPreviewStore((s) => s.active);
  const tokens = useBrandPreviewStore((s) => s.tokens);
  return active ? tokens : saved;
};
