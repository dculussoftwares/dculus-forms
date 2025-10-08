import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { format } from 'date-fns';
import { GET_FORM_BY_ID, GET_RESPONSE_BY_ID } from '../graphql/queries';
import { useResponseEditHistory } from '../hooks/useResponseEditHistory';
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
  AlertCircle
} from 'lucide-react';
import { EditHistoryTimeline } from '../components/response-history/EditHistoryTimeline';

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

  // Fetch edit history
  const {
    editHistory,
    isLoadingHistory,
    historyError
  } = useResponseEditHistory({
    responseId: responseId!,
    enabled: !!responseId
  });

  const form = formData?.form;
  const response = responseData?.response;
  const isLoading = formLoading || responseLoading || isLoadingHistory;

  const handleViewSnapshot = (editId: string) => {
    // Could open a modal or navigate to a detailed view in the future
    console.log('View snapshot for edit:', editId);
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
      {historyError && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load edit history. Some functionality may be limited.
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
          isLoading={isLoadingHistory}
        />
      </div>
    </div>
  );
};