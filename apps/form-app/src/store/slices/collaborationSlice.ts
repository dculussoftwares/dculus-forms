/**
 * Collaboration Slice
 *
 * Manages YJS document lifecycle, WebSocket connection state, and real-time collaboration.
 * This slice has no dependencies on other slices.
 */

import { CollaborationSlice, SliceCreator } from '../types/store.types';
import { CollaborationManager } from '../collaboration/CollaborationManager';
import { FormPage, FormLayout } from '@dculus/types';

/**
 * Create the collaboration slice
 *
 * This slice manages the YJS document and collaboration state.
 * A singleton CollaborationManager instance handles the actual YJS operations.
 */
export const createCollaborationSlice: SliceCreator<CollaborationSlice> = (set, get) => {
  // Singleton CollaborationManager instance (persists across slice calls)
  let collaborationManager: CollaborationManager | null = null;

  /**
   * Callback when YJS document updates
   * Updates pages, layout, and isShuffleEnabled in the store
   */
  const updateCallback = (pages: FormPage[], layout?: FormLayout, isShuffleEnabled?: boolean) => {
    const updates: any = { pages };

    if (layout) {
      updates.layout = layout;
    }

    if (isShuffleEnabled !== undefined) {
      updates.isShuffleEnabled = Boolean(isShuffleEnabled);
    }

    set(updates);
  };

  /**
   * Callback when connection state changes
   */
  const connectionCallback = (isConnected: boolean) => {
    set({ isConnected });
  };

  /**
   * Callback when loading state changes
   */
  const loadingCallback = (isLoading: boolean) => {
    set({ isLoading });
  };

  return {
    // Initial state
    isConnected: false,
    isLoading: true,
    formId: null,
    ydoc: null,
    provider: null,
    observerCleanups: [],

    /**
     * Initialize collaboration for a form
     *
     * Creates a new CollaborationManager instance and connects to the YJS document.
     */
    initializeCollaboration: async (formId: string) => {
      console.log('🔧 Initializing collaboration for form:', formId);

      if (!collaborationManager) {
        collaborationManager = new CollaborationManager(
          updateCallback,
          connectionCallback,
          loadingCallback
        );
      }

      await collaborationManager.initialize(formId);

      set({
        formId,
        ydoc: collaborationManager.getYDoc(),
        provider: null, // Provider is managed internally by CollaborationManager
      });
    },

    /**
     * Disconnect collaboration and cleanup resources
     */
    disconnectCollaboration: () => {
      if (collaborationManager) {
        collaborationManager.disconnect();
        collaborationManager = null;
      }

      set({
        isConnected: false,
        isLoading: false,
        formId: null,
        ydoc: null,
        provider: null,
        observerCleanups: [],
        pages: [],
        selectedPageId: null,
        selectedFieldId: null,
      });
    },

    /**
     * Set connection state
     */
    setConnectionState: (isConnected: boolean) => set({ isConnected }),

    /**
     * Set loading state
     */
    setLoadingState: (isLoading: boolean) => set({ isLoading }),

    /**
     * Internal helper: Get YJS document
     * Used by other slices to access the YJS document
     */
    _getYDoc: () => {
      return get().ydoc;
    },

    /**
     * Internal helper: Check if YJS is ready for operations
     * Used by other slices to verify they can perform YJS mutations
     */
    _isYJSReady: () => {
      const { ydoc, isConnected } = get();
      return !!ydoc && isConnected;
    },
  };
};
