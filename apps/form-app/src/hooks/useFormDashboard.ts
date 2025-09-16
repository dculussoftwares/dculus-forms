import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { GET_FORM_BY_ID, GET_FORM_RESPONSES, GET_FORMS_DASHBOARD } from '../graphql/queries';
import { DELETE_FORM, UPDATE_FORM } from '../graphql/mutations';
import { useAppConfig } from '@/hooks';

interface DashboardStats {
  totalResponses: number;
  totalFields: number;
  averageCompletionTime: string;
  recentResponses: any[];
  responseRate: string;
  responsesToday: number;
  responsesThisWeek: number;
}

export const useFormDashboard = (formId: string | undefined) => {
  const navigate = useNavigate();
  const { organizationId } = useAppConfig();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showUnpublishDialog, setShowUnpublishDialog] = useState(false);
  const [showCollectResponsesDialog, setShowCollectResponsesDialog] = useState(false);

  const {
    data: formData,
    loading: formLoading,
    error: formError,
  } = useQuery(GET_FORM_BY_ID, {
    variables: { id: formId },
    skip: !formId,
  });

  const { data: responsesData, loading: responsesLoading } = useQuery(
    GET_FORM_RESPONSES,
    {
      variables: { formId: formId, page: 1, limit: 100 }, // Get first 100 responses for dashboard stats
      skip: !formId,
    }
  );

  const [deleteForm, { loading: deleteLoading }] = useMutation(DELETE_FORM, {
    update: (cache, { data }) => {
      if (data?.deleteForm && organizationId) {
        cache.updateQuery(
          {
            query: GET_FORMS_DASHBOARD,
            variables: { organizationId },
          },
          (existingData) => {
            if (!existingData?.forms) return existingData;
            return {
              ...existingData,
              forms: existingData.forms.filter((form: any) => form.id !== formId),
            };
          }
        );
      }
    },
    onCompleted: () => {
      navigate('/dashboard');
    },
    onError: (error) => {
      console.error('Error deleting form:', error);
    },
  });

  const [updateForm, { loading: updateLoading }] = useMutation(UPDATE_FORM, {
    onError: (error) => {
      console.error('Error updating form:', error);
    },
  });

  const dashboardStats: DashboardStats = useMemo(() => {
    if (!formData?.form || !responsesData?.responsesByForm) {
      return {
        totalResponses: 0,
        totalFields: 0,
        averageCompletionTime: '0 min',
        recentResponses: [],
        responseRate: '0%',
        responsesToday: 0,
        responsesThisWeek: 0,
      };
    }

    // Handle both old format (array) and new format (paginated response)
    const responsePagination = responsesData.responsesByForm;
    const responses = responsePagination.data || responsePagination || [];
    const totalResponses = responsePagination.total || responses.length;

    // Get real dashboard stats from the form data
    const formDashboardStats = formData.form.dashboardStats;
    const totalFields = formData.form.metadata?.fieldCount || 0;

    // Format average completion time
    const formatCompletionTime = (seconds: number | null) => {
      if (!seconds) return '0 min';
      if (seconds < 60) return `${Math.round(seconds)}s`;
      const minutes = Math.round(seconds / 60 * 10) / 10;
      return `${minutes} min`;
    };

    // Format response rate
    const formatResponseRate = (rate: number | null) => {
      if (!rate) return '0%';
      return `${Math.round(rate * 10) / 10}%`;
    };

    const recentResponses = responses
      .slice()
      .sort(
        (a: any, b: any) =>
          new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      )
      .slice(0, 5);

    return {
      totalResponses,
      totalFields,
      averageCompletionTime: formatCompletionTime(formDashboardStats?.averageCompletionTime),
      recentResponses,
      responseRate: formatResponseRate(formDashboardStats?.responseRate),
      responsesToday: formDashboardStats?.responsesToday || 0,
      responsesThisWeek: formDashboardStats?.responsesThisWeek || 0,
    };
  }, [formData, responsesData]);

  const handleDelete = () => {
    if (!formId) return;
    deleteForm({ variables: { id: formId } });
    setShowDeleteDialog(false);
  };

  const handlePublish = () => {
    if (!formId) return;
    updateForm({
      variables: {
        id: formId,
        input: { isPublished: true }
      },
      optimisticResponse: {
        updateForm: {
          ...formData?.form,
          isPublished: true
        }
      }
    });
  };

  const handleUnpublish = () => {
    if (!formId) return;
    updateForm({
      variables: {
        id: formId,
        input: { isPublished: false }
      },
      optimisticResponse: {
        updateForm: {
          ...formData?.form,
          isPublished: false
        }
      }
    });
    setShowUnpublishDialog(false);
  };

  const handleCollectResponses = () => {
    setShowCollectResponsesDialog(true);
  };

  const handleCopyLink = () => {
    const formViewerUrl = `http://localhost:5173/f/${formData?.form?.shortUrl}`;
    navigator.clipboard.writeText(formViewerUrl).then(() => {
      console.log('Link copied to clipboard');
    });
  };

  const handleOpenFormViewer = () => {
    const formViewerUrl = `http://localhost:5173/f/${formData?.form?.shortUrl}`;
    window.open(formViewerUrl, '_blank');
  };

  return {
    // Data
    form: formData?.form,
    responses: responsesData?.responsesByForm?.data || responsesData?.responsesByForm || [],
    dashboardStats,
    
    // Loading states
    formLoading,
    responsesLoading,
    deleteLoading,
    updateLoading,
    
    // Error states
    formError,
    
    // Dialog states
    showDeleteDialog,
    setShowDeleteDialog,
    showUnpublishDialog,
    setShowUnpublishDialog,
    showCollectResponsesDialog,
    setShowCollectResponsesDialog,
    
    // Handlers
    handleDelete,
    handlePublish,
    handleUnpublish,
    handleCollectResponses,
    handleCopyLink,
    handleOpenFormViewer,
  };
};