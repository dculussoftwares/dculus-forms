import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { GET_FORM_BY_ID, GET_MY_FORMS_WITH_CATEGORY } from '../graphql/queries';
import { DELETE_FORM, UPDATE_FORM } from '../graphql/mutations';
import { useAppConfig } from '@/hooks';

interface DashboardStats {
  totalResponses: number;
  totalFields: number;
  averageCompletionTime: string;
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


  const [deleteForm, { loading: deleteLoading }] = useMutation(DELETE_FORM, {
    update: (cache, { data }) => {
      if (data?.deleteForm && organizationId) {
        cache.updateQuery(
          {
            query: GET_MY_FORMS_WITH_CATEGORY,
            variables: { organizationId },
          },
          (existingData) => {
            if (!existingData?.formsWithCategory) return existingData;
            return {
              ...existingData,
              formsWithCategory: existingData.formsWithCategory.filter((form: any) => form.id !== formId),
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
    if (!formData?.form) {
      return {
        totalResponses: 0,
        totalFields: 0,
        averageCompletionTime: '0 min',
        responseRate: '0%',
        responsesToday: 0,
        responsesThisWeek: 0,
      };
    }

    // Get dashboard stats from the form data
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

    return {
      totalResponses: formDashboardStats?.totalResponses || 0,
      totalFields,
      averageCompletionTime: formatCompletionTime(formDashboardStats?.averageCompletionTime),
      responseRate: formatResponseRate(formDashboardStats?.responseRate),
      responsesToday: formDashboardStats?.responsesToday || 0,
      responsesThisWeek: formDashboardStats?.responsesThisWeek || 0,
    };
  }, [formData]);

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
    dashboardStats,

    // Loading states
    formLoading,
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