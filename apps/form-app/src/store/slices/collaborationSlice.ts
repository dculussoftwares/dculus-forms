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

  // Reconnection state — kept outside Zustand so it doesn't trigger re-renders
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 5;
  const BASE_RECONNECT_DELAY_MS = 2_000;

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
   * Callback when connection state changes.
   * On disconnect, schedules an exponential-backoff reconnect attempt.
   */
  const connectionCallback = (isConnected: boolean) => {
    set({ isConnected });

    if (isConnected) {
      // Successful (re)connection — reset backoff counter
      reconnectAttempts = 0;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      return;
    }

    // Disconnected — attempt to reconnect unless we've exceeded the limit
    const { formId } = get() as any;
    if (!formId || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;

    const delay = BASE_RECONNECT_DELAY_MS * 2 ** reconnectAttempts;
    reconnectAttempts += 1;
    console.warn(
      `[Collaboration] Disconnected. Reconnect attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`
    );

    reconnectTimer = setTimeout(async () => {
      reconnectTimer = null;
      try {
        if (collaborationManager) {
          await collaborationManager.initialize(formId);
        }
      } catch (err) {
        console.error('[Collaboration] Reconnect attempt failed:', err);
      }
    }, delay);
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
      // Cancel any pending reconnect before tearing down
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // prevent further auto-reconnect

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
