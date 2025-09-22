import { useQuery, useMutation, ApolloError } from '@apollo/client';
import { useApolloClient } from '@apollo/client';
import {
  GET_RESPONSE_EDIT_HISTORY,
  GET_RESPONSE_SNAPSHOTS,
  RESTORE_RESPONSE,
  CREATE_RESPONSE_SNAPSHOT,
  UPDATE_RESPONSE_WITH_TRACKING
} from '../graphql/queries';
import {
  ResponseEditHistory,
  ResponseSnapshot,
  RestoreResponseInput,
  CreateSnapshotInput,
  UpdateResponseInput
} from '@dculus/types';
import { toastSuccess, toastError } from '@dculus/ui';

interface UseResponseEditHistoryProps {
  responseId: string;
  enabled?: boolean;
}

interface UseResponseEditHistoryReturn {
  // Data
  editHistory: ResponseEditHistory[];
  snapshots: ResponseSnapshot[];
  isLoadingHistory: boolean;
  isLoadingSnapshots: boolean;

  // Error states
  historyError: ApolloError | undefined;
  snapshotsError: ApolloError | undefined;

  // Mutations
  restoreResponse: (input: RestoreResponseInput) => Promise<void>;
  createSnapshot: (input: CreateSnapshotInput) => Promise<void>;
  updateResponseWithTracking: (input: UpdateResponseInput) => Promise<void>;

  // Loading states
  isRestoring: boolean;
  isCreatingSnapshot: boolean;
  isUpdating: boolean;

  // Actions
  refetchHistory: () => void;
  refetchSnapshots: () => void;
  invalidateHistory: () => void;
}

export const useResponseEditHistory = ({
  responseId,
  enabled = true
}: UseResponseEditHistoryProps): UseResponseEditHistoryReturn => {
  const apolloClient = useApolloClient();

  // Fetch edit history
  const {
    data: historyData,
    loading: isLoadingHistory,
    error: historyError,
    refetch: refetchHistory
  } = useQuery(GET_RESPONSE_EDIT_HISTORY, {
    variables: { responseId },
    skip: !enabled || !responseId,
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true,
    onError: (error) => {
      console.error('Failed to fetch edit history:', error);
      toastError(
        'Failed to load edit history',
        'Please try refreshing the page'
      );
    }
  });

  // Fetch snapshots
  const {
    data: snapshotsData,
    loading: isLoadingSnapshots,
    error: snapshotsError,
    refetch: refetchSnapshots
  } = useQuery(GET_RESPONSE_SNAPSHOTS, {
    variables: { responseId },
    skip: !enabled || !responseId,
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true,
    onError: (error) => {
      console.error('Failed to fetch snapshots:', error);
      toastError(
        'Failed to load snapshots',
        'Some restore functionality may be limited'
      );
    }
  });

  // Restore response mutation
  const [restoreResponseMutation, { loading: isRestoring }] = useMutation(
    RESTORE_RESPONSE,
    {
      onCompleted: () => {
        toastSuccess(
          'Response restored successfully',
          'The response has been restored to the selected version'
        );

        // Refetch queries
        apolloClient.refetchQueries({
          include: ['GetResponseEditHistory', 'GetResponseSnapshots', 'GetResponseWithEditInfo']
        });

        // Refetch to get latest data
        refetchHistory();
        refetchSnapshots();
      },
      onError: (error) => {
        console.error('Failed to restore response:', error);
        toastError(
          'Failed to restore response',
          error.message || 'An unexpected error occurred'
        );
      }
    }
  );

  // Create snapshot mutation
  const [createSnapshotMutation, { loading: isCreatingSnapshot }] = useMutation(
    CREATE_RESPONSE_SNAPSHOT,
    {
      onCompleted: () => {
        toastSuccess(
          'Snapshot created successfully',
          'A new restore point has been saved'
        );

        // Refetch snapshots to show the new one
        refetchSnapshots();
      },
      onError: (error) => {
        console.error('Failed to create snapshot:', error);
        toastError(
          'Failed to create snapshot',
          error.message || 'Please try again'
        );
      }
    }
  );

  // Update response with tracking mutation
  const [updateResponseMutation, { loading: isUpdating }] = useMutation(
    UPDATE_RESPONSE_WITH_TRACKING,
    {
      onCompleted: () => {
        toastSuccess(
          'Response updated successfully',
          'Changes have been saved and tracked'
        );

        // Refetch edit history to show the new edit
        refetchHistory();

        // Also refetch the main response query
        apolloClient.refetchQueries({
          include: ['GetResponseWithEditInfo']
        });
      },
      onError: (error) => {
        console.error('Failed to update response:', error);
        toastError(
          'Failed to update response',
          error.message || 'Please try again'
        );
      }
    }
  );

  // Action functions
  const restoreResponse = async (input: RestoreResponseInput) => {
    try {
      await restoreResponseMutation({
        variables: { input }
      });
    } catch (error) {
      // Error is handled in the mutation's onError callback
      throw error;
    }
  };

  const createSnapshot = async (input: CreateSnapshotInput) => {
    try {
      await createSnapshotMutation({
        variables: { input }
      });
    } catch (error) {
      // Error is handled in the mutation's onError callback
      throw error;
    }
  };

  const updateResponseWithTracking = async (input: UpdateResponseInput) => {
    try {
      await updateResponseMutation({
        variables: { input }
      });
    } catch (error) {
      // Error is handled in the mutation's onError callback
      throw error;
    }
  };

  const invalidateHistory = () => {
    apolloClient.refetchQueries({
      include: ['GetResponseEditHistory', 'GetResponseSnapshots']
    });
  };

  return {
    // Data
    editHistory: historyData?.responseEditHistory || [],
    snapshots: snapshotsData?.responseSnapshots || [],
    isLoadingHistory,
    isLoadingSnapshots,

    // Error states
    historyError,
    snapshotsError,

    // Mutations
    restoreResponse,
    createSnapshot,
    updateResponseWithTracking,

    // Loading states
    isRestoring,
    isCreatingSnapshot,
    isUpdating,

    // Actions
    refetchHistory,
    refetchSnapshots,
    invalidateHistory
  };
};

// Additional hook for quick edit info without full history
interface UseResponseEditInfoProps {
  responseId: string;
  enabled?: boolean;
}

interface ResponseEditInfo {
  hasBeenEdited: boolean;
  lastEditedAt: string | null;
  totalEdits: number;
  recentEdits: ResponseEditHistory[];
}

interface UseResponseEditInfoReturn {
  editInfo: ResponseEditInfo | null;
  isLoading: boolean;
  error: ApolloError | undefined;
  refetch: () => void;
}

export const useResponseEditInfo = ({
  responseId,
  enabled = true
}: UseResponseEditInfoProps): UseResponseEditInfoReturn => {
  const {
    data,
    loading: isLoading,
    error,
    refetch
  } = useQuery(GET_RESPONSE_EDIT_HISTORY, {
    variables: { responseId },
    skip: !enabled || !responseId,
    errorPolicy: 'all'
  });

  const editHistory = data?.responseEditHistory || [];

  const editInfo: ResponseEditInfo | null = editHistory.length > 0 ? {
    hasBeenEdited: editHistory.length > 0,
    lastEditedAt: editHistory[0]?.editedAt || null,
    totalEdits: editHistory.length,
    recentEdits: editHistory.slice(0, 3) // Last 3 edits
  } : {
    hasBeenEdited: false,
    lastEditedAt: null,
    totalEdits: 0,
    recentEdits: []
  };

  return {
    editInfo,
    isLoading,
    error,
    refetch
  };
};