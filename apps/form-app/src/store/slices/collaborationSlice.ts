/**
 * Collaboration Slice
 *
 * Manages YJS document lifecycle, WebSocket connection state, and real-time collaboration.
 * This slice has no dependencies on other slices.
 */

import { CollaborationSlice, SliceCreator } from '../types/store.types';
import { CollaborationManager } from '../collaboration/CollaborationManager';
import { FormPage, FormLayout, ConditionalRule } from '@dculus/types';

/**
 * Create the collaboration slice
 *
 * This slice manages the YJS document and collaboration state.
 * A singleton CollaborationManager instance handles the actual YJS operations.
 */
export const createCollaborationSlice: SliceCreator<CollaborationSlice> = (set, get) => {
  // Singleton CollaborationManager instance (persists across slice calls)
  let collaborationManager: CollaborationManager | null = null;

  // Disconnect watchdog — kept outside Zustand so it doesn't trigger re-renders.
  // HocuspocusProvider already reconnects indefinitely on its own (infinite
  // retries with jittered exponential backoff, dead-connection detection via
  // its internal ping timeout, and a queue that holds outgoing updates while
  // offline). We must NOT tear down the YDoc/provider ourselves on a bare
  // `disconnect` event — that would destroy that queue and any not-yet-sent
  // local edits, and fight the SDK's own recovery. We only surface a "still
  // reconnecting" banner if a disconnect drags on, purely for user feedback.
  let disconnectWatchdog: ReturnType<typeof setTimeout> | null = null;
  const PROLONGED_DISCONNECT_MS = 45_000;

  // P2-17: Dirty flag — set to true whenever the YJS doc receives an update
  // so disconnectCollaboration can attempt a final sync before teardown.
  let isDirty = false;

  /**
   * Callback when YJS document updates
   * Updates pages, layout, isShuffleEnabled, and conditions in the store
   */
  const updateCallback = (
    pages: FormPage[],
    layout?: FormLayout,
    isShuffleEnabled?: boolean,
    conditions?: ConditionalRule[]
  ) => {
    // P2-17: Mark document dirty on every incoming update
    isDirty = true;

    const updates: any = { pages };

    if (layout) {
      updates.layout = layout;
    }

    if (isShuffleEnabled !== undefined) {
      updates.isShuffleEnabled = Boolean(isShuffleEnabled);
    }

    if (conditions !== undefined) {
      updates.conditions = conditions;
    }

    set(updates);
  };

  /**
   * Callback when connection state changes.
   * The underlying HocuspocusProvider already reconnects on its own — we
   * just track how long we've been disconnected to surface a banner if it
   * drags on, without ever touching the YDoc/provider ourselves.
   */
  const connectionCallback = (isConnected: boolean) => {
    set({ isConnected });

    if (disconnectWatchdog) {
      clearTimeout(disconnectWatchdog);
      disconnectWatchdog = null;
    }

    if (isConnected) {
      set({ isCollaborationFailed: false });
      return;
    }

    // Disconnected — the provider is already retrying in the background.
    // Only warn the user if it hasn't recovered after a while.
    disconnectWatchdog = setTimeout(() => {
      disconnectWatchdog = null;
      set({ isCollaborationFailed: true });
    }, PROLONGED_DISCONNECT_MS);
  };

  /**
   * Callback when loading state changes.
   */
  const loadingCallback = (isLoading: boolean) => {
    set({ isLoading });
  };

  return {
    // Initial state
    isConnected: false,
    isLoading: true,
    isCollaborationFailed: false,
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
     *
     * P2-17: If the document is dirty and the provider is still connected,
     * give Hocuspocus a brief window (up to 500 ms) to flush pending awareness
     * updates before tearing down the WebSocket.
     */
    disconnectCollaboration: () => {
      // Cancel the pending "prolonged disconnect" watchdog before tearing down
      if (disconnectWatchdog) {
        clearTimeout(disconnectWatchdog);
        disconnectWatchdog = null;
      }

      // P2-17: Attempt to flush pending changes before disconnecting.
      // Hocuspocus syncs over WebSocket automatically on every ydoc update, so the
      // dirty flag simply tells us whether we should give the provider a moment to
      // finish any in-flight sync before we destroy the connection.
      const shouldFlush = isDirty && collaborationManager?.isConnected();
      isDirty = false; // reset flag regardless

      const teardown = () => {
        if (collaborationManager) {
          collaborationManager.disconnect();
          collaborationManager = null;
        }

        set({
          isConnected: false,
          isLoading: false,
          isCollaborationFailed: false,
          formId: null,
          ydoc: null,
          provider: null,
          observerCleanups: [],
          pages: [],
          conditions: [],
          selectedPageId: null,
          selectedFieldId: null,
        });
      };

      if (shouldFlush) {
        // Give the WebSocket provider a short window to flush pending messages.
        // We do not await because disconnectCollaboration is synchronous by design.
        setTimeout(teardown, 300);
      } else {
        teardown();
      }
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
