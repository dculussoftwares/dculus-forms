import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { GET_FORM_BY_ID } from '../graphql/queries';
import { DELETE_FORM, UPDATE_FORM } from '../graphql/mutations';
import { useAppConfig } from '@/hooks';
import { getFormViewerUrl } from '@/lib/config';

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
  const [showPublishAnimation, setShowPublishAnimation] = useState(false);

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
      if (!data?.deleteForm || !organizationId || !formId) {
        return;
      }

      cache.modify({
        fields: {
          forms(existing = {}, options: any) {
            const args = options?.args as { category?: string; organizationId?: string; limit?: number } | undefined;
            const readField = options?.readField as (<T>(fieldName: string, from: any) => T) | undefined;
            const category = args?.category;

            if (
              !existing ||
              !existing.forms ||
              !Array.isArray(existing.forms) ||
              !args ||
              args.organizationId !== organizationId ||
              !category ||
              !['OWNER', 'ALL'].includes(category)
            ) {
              return existing;
            }

            const filteredForms = existing.forms.filter((formRef: any) => {
              const cachedId = readField ? readField('id', formRef) : formRef?.id;
              return cachedId !== formId;
            });

            if (filteredForms.length === existing.forms.length) {
              return existing;
            }

            const baseTotalCount =
              existing.totalCount ?? filteredForms.length + 1;
            const nextTotalCount = Math.max(0, baseTotalCount - 1);
            const limit = existing.limit ?? args?.limit ?? 1;
            const page = existing.page ?? 1;
            const nextTotalPages =
              nextTotalCount === 0
                ? 0
                : Math.ceil(nextTotalCount / Math.max(limit, 1));

            return {
              ...existing,
              forms: filteredForms,
              totalCount: nextTotalCount,
              totalPages: nextTotalPages,
              hasNextPage: page < nextTotalPages,
              hasPreviousPage: page > 1,
            };
          },
        },
      });
    },
    onCompleted: () => {
      navigate('/dashboard');
    },
    onError: (error) => {
      console.error('Error deleting form:', error);
    },
  });

  const [updateForm, { loading: updateLoading }] = useMutation(UPDATE_FORM, {
    onCompleted: (data) => {
      // Show celebration animation when form is published
      if (data?.updateForm?.isPublished) {
        setShowPublishAnimation(true);
      }
    },
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
      totalResponses: formData.form.responseCount || 0,
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
      }
    });
  };

  const handleUnpublish = () => {
    if (!formId) return;
    updateForm({
      variables: {
        id: formId,
        input: { isPublished: false }
      }
    });
    setShowUnpublishDialog(false);
  };

  const handleCollectResponses = () => {
    setShowCollectResponsesDialog(true);
  };

  const handleCopyLink = () => {
    const formViewerUrl = getFormViewerUrl(formData?.form?.shortUrl);
    navigator.clipboard.writeText(formViewerUrl).then(() => {
      console.log('Link copied to clipboard');
    });
  };

  const handleOpenFormViewer = () => {
    const formViewerUrl = getFormViewerUrl(formData?.form?.shortUrl);
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
    showPublishAnimation,
    setShowPublishAnimation,

    // Handlers
    handleDelete,
    handlePublish,
    handleUnpublish,
    handleCollectResponses,
    handleCopyLink,
    handleOpenFormViewer,
  };
};
