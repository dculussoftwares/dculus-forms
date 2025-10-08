import { useQuery, useMutation, ApolloError } from '@apollo/client';
import { useApolloClient } from '@apollo/client';
import {
  GET_RESPONSE_EDIT_HISTORY,
  UPDATE_RESPONSE_WITH_TRACKING
} from '../graphql/queries';
import {
  ResponseEditHistory,
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
  isLoadingHistory: boolean;

  // Error states
  historyError: ApolloError | undefined;

  // Mutations
  updateResponseWithTracking: (input: UpdateResponseInput) => Promise<void>;

  // Loading states
  isUpdating: boolean;

  // Actions
  refetchHistory: () => void;
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
      include: ['GetResponseEditHistory']
    });
  };

  return {
    // Data
    editHistory: historyData?.responseEditHistory || [],
    isLoadingHistory,

    // Error states
    historyError,

    // Mutations
    updateResponseWithTracking,

    // Loading states
    isUpdating,

    // Actions
    refetchHistory,
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