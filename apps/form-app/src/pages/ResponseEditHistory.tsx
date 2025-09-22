import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { format } from 'date-fns';
import { GET_FORM_BY_ID, GET_RESPONSE_BY_ID } from '../graphql/queries';
import { useResponseEditHistory } from '../hooks/useResponseEditHistory';
import { SnapshotType } from '@dculus/types';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Alert,
  AlertDescription,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@dculus/ui';
import {
  ArrowLeft,
  History,
  Edit3,
  Clock,
  User,
  RotateCcw,
  Camera,
  AlertCircle
} from 'lucide-react';
import { EditHistoryTimeline } from '../components/response-history/EditHistoryTimeline';
import { RestoreDialog } from '../components/response-history/RestoreDialog';

// Helper function to safely format dates
const safeFormatDate = (dateString: string | null | undefined, formatString: string, fallback = 'Unknown date'): string => {
  if (!dateString) return fallback;
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? fallback : format(date, formatString);
};

export const ResponseEditHistory: React.FC = () => {
  const { formId, responseId } = useParams<{
    formId: string;
    responseId: string;
  }>();
  const navigate = useNavigate();

  // const [selectedEditId, setSelectedEditId] = useState<string | null>(null);

  // Fetch form data
  const { data: formData, loading: formLoading } = useQuery(GET_FORM_BY_ID, {
    variables: { id: formId },
    skip: !formId
  });

  // Fetch response data
  const { data: responseData, loading: responseLoading } = useQuery(GET_RESPONSE_BY_ID, {
    variables: { id: responseId },
    skip: !responseId
  });

  // Fetch edit history and snapshots
  const {
    editHistory,
    snapshots,
    isLoadingHistory,
    // isLoadingSnapshots,
    historyError,
    snapshotsError,
    restoreResponse,
    createSnapshot,
    isRestoring,
    isCreatingSnapshot
    // refetchHistory,
    // refetchSnapshots
  } = useResponseEditHistory({
    responseId: responseId!,
    enabled: !!responseId
  });

  const form = formData?.form;
  const response = responseData?.response;
  const isLoading = formLoading || responseLoading || isLoadingHistory;

  const handleViewSnapshot = (editId: string) => {
    // setSelectedEditId(editId);
    // Could open a modal or navigate to a detailed view
    console.log('View snapshot for edit:', editId);
  };

  const handleRestoreFromEdit = async (editId: string) => {
    // Find the snapshot associated with this edit
    const edit = editHistory.find(e => e.id === editId);
    if (!edit || !responseId) return;

    // For now, we'll use the most recent snapshot
    // In a more sophisticated implementation, we could track which snapshot
    // corresponds to each edit
    const relevantSnapshot = snapshots.find(s => s.snapshotType === SnapshotType.EDIT);
    if (!relevantSnapshot) {
      alert('No snapshot available for restoration');
      return;
    }

    try {
      await restoreResponse({
        responseId,
        snapshotId: relevantSnapshot.id,
        restoreReason: `Restored from edit by ${edit.editedBy.name} on ${safeFormatDate(edit.editedAt, 'MMM dd, yyyy', 'unknown date')}`
      });
    } catch (error) {
      console.error('Failed to restore:', error);
    }
  };

  const handleCreateManualSnapshot = async () => {
    if (!responseId) return;

    try {
      await createSnapshot({
        responseId,
        snapshotType: SnapshotType.MANUAL,
        reason: 'Manual snapshot created from edit history view'
      });
    } catch (error) {
      console.error('Failed to create snapshot:', error);
    }
  };

  const handleGoToEdit = () => {
    if (formId && responseId) {
      navigate(`/dashboard/form/${formId}/responses/${responseId}/edit`);
    }
  };

  const handleGoToTable = () => {
    if (formId) {
      navigate(`/dashboard/form/${formId}/responses/table`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 space-y-6 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!form || !response) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <Alert className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Response or form not found. Please check the URL and try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header */}
      <div className="space-y-4">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                onClick={() => navigate('/dashboard')}
                className="cursor-pointer"
              >
                Dashboard
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink
                onClick={() => navigate(`/dashboard/form/${formId}`)}
                className="cursor-pointer"
              >
                {form.title}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink
                onClick={handleGoToTable}
                className="cursor-pointer"
              >
                Responses
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Edit History</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGoToTable}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Responses
              </Button>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
              <History className="h-6 w-6" />
              <span>Response Edit History</span>
            </h1>
            <p className="text-gray-600">
              View all changes made to this response over time
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              onClick={handleCreateManualSnapshot}
              disabled={isCreatingSnapshot}
            >
              <Camera className="h-4 w-4 mr-2" />
              {isCreatingSnapshot ? 'Creating...' : 'Create Snapshot'}
            </Button>

            <RestoreDialog
              snapshots={snapshots}
              responseId={responseId!}
              onRestore={restoreResponse}
              trigger={
                <Button variant="outline">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restore Response
                </Button>
              }
              isLoading={isRestoring}
            />

            <Button onClick={handleGoToEdit}>
              <Edit3 className="h-4 w-4 mr-2" />
              Edit Response
            </Button>
          </div>
        </div>
      </div>

      {/* Response Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Response Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-500">Response ID:</span>
              <div className="font-mono text-xs text-gray-700 mt-1">
                {responseId}
              </div>
            </div>
            <div>
              <span className="font-medium text-gray-500">Submitted:</span>
              <div className="text-gray-700 mt-1">
                {safeFormatDate(response.submittedAt, 'MMM dd, yyyy \'at\' h:mm a')}
              </div>
            </div>
            <div>
              <span className="font-medium text-gray-500">Total Edits:</span>
              <div className="text-gray-700 mt-1">
                <Badge variant="outline" className="bg-blue-50 text-blue-700">
                  {editHistory.length} edit{editHistory.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error States */}
      {(historyError || snapshotsError) && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {historyError ? 'Failed to load edit history. ' : ''}
            {snapshotsError ? 'Failed to load snapshots. ' : ''}
            Some functionality may be limited.
          </AlertDescription>
        </Alert>
      )}

      {/* Edit History Timeline */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Edit Timeline ({editHistory.length} {editHistory.length === 1 ? 'edit' : 'edits'})
          </h2>

          {editHistory.length > 0 && (
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Clock className="h-4 w-4" />
              <span>
                Last edited {safeFormatDate(editHistory[0].editedAt, 'MMM dd, yyyy', 'unknown date')}
              </span>
            </div>
          )}
        </div>

        <EditHistoryTimeline
          editHistory={editHistory}
          onViewSnapshot={handleViewSnapshot}
          onRestoreFromEdit={handleRestoreFromEdit}
          isLoading={isLoadingHistory}
        />
      </div>

      {/* Snapshots Info */}
      {snapshots.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center space-x-2">
              <Camera className="h-5 w-5" />
              <span>Available Snapshots ({snapshots.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {snapshots.slice(0, 5).map((snapshot) => (
                <div key={snapshot.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                  <div className="flex items-center space-x-3">
                    <Badge className={
                      snapshot.snapshotType === SnapshotType.MANUAL
                        ? 'bg-green-100 text-green-800'
                        : snapshot.snapshotType === SnapshotType.EDIT
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-purple-100 text-purple-800'
                    }>
                      {snapshot.snapshotType}
                    </Badge>
                    <div className="text-sm">
                      <div className="font-medium">
                        {safeFormatDate(snapshot.snapshotAt, 'MMM dd, yyyy \'at\' h:mm a')}
                      </div>
                      {snapshot.createdBy && (
                        <div className="text-gray-600 flex items-center space-x-1">
                          <User className="h-3 w-3" />
                          <span>{snapshot.createdBy.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {snapshot.isRestorable ? 'Restorable' : 'View only'}
                  </div>
                </div>
              ))}

              {snapshots.length > 5 && (
                <div className="text-center pt-2">
                  <span className="text-sm text-gray-500">
                    ...and {snapshots.length - 5} more snapshots
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};