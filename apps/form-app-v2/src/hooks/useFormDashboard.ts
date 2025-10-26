import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client';
import { toast } from '@dculus/ui-v2';
import { GET_FORM_BY_ID, GET_MY_FORMS_WITH_CATEGORY } from '../graphql/queries';
import { DELETE_FORM, UPDATE_FORM } from '../graphql/mutations';
import { useAuth } from '../contexts/AuthContext';
import { useTranslate } from '../i18n';
import { getFormViewerUrl } from '../lib/config';

interface DashboardStats {
  totalResponses: number;
  totalFields: number;
  averageCompletionTime: string;
  responseRate: string;
  responsesToday: number;
  responsesThisWeek: number;
}

interface Form {
  id: string;
  title: string;
  description?: string;
  shortUrl: string;
  isPublished: boolean;
  responseCount: number;
  createdAt: string;
  updatedAt: string;
  organization?: {
    id: string;
    name: string;
    slug: string;
  };
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
  metadata?: {
    pageCount?: number | null;
    fieldCount?: number | null;
    lastUpdated?: string | null;
    backgroundImageUrl?: string | null;
    backgroundImageKey?: string | null;
  };
  dashboardStats?: {
    averageCompletionTime: number | null;
    responseRate: number | null;
    responsesToday: number;
    responsesThisWeek: number;
    responsesThisMonth: number;
  };
}

export const useFormDashboard = (formId: string | undefined) => {
  const t = useTranslate();
  const navigate = useNavigate();
  const { activeOrganization } = useAuth();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showUnpublishDialog, setShowUnpublishDialog] = useState(false);
  const [showCollectResponsesDialog, setShowCollectResponsesDialog] =
    useState(false);

  const {
    data: formData,
    loading: formLoading,
    error: formError,
  } = useQuery<{ form: Form }>(GET_FORM_BY_ID, {
    variables: { id: formId },
    skip: !formId,
  });

  const [deleteForm, { loading: deleteLoading }] = useMutation(DELETE_FORM, {
    update: (cache, { data }) => {
      if (data?.deleteForm && activeOrganization?.id) {
        cache.updateQuery(
          {
            query: GET_MY_FORMS_WITH_CATEGORY,
            variables: { organizationId: activeOrganization.id },
          },
          (existingData) => {
            if (!existingData?.formsWithCategory) return existingData;
            return {
              ...existingData,
              formsWithCategory: {
                ...existingData.formsWithCategory,
                forms: existingData.formsWithCategory.forms.filter(
                  (form: Form) => form.id !== formId
                ),
              },
            };
          }
        );
      }
    },
    onCompleted: () => {
      toast(t('formDashboard.toast.deleteSuccess.title'), {
        description: t('formDashboard.toast.deleteSuccess.description'),
      });
      navigate('/dashboard');
    },
    onError: (error) => {
      toast(t('formDashboard.toast.deleteError.title'), {
        description: error.message || t('formDashboard.toast.deleteError.descriptionFallback'),
      });
    },
  });

  const [updateForm, { loading: updateLoading }] = useMutation(UPDATE_FORM, {
    onCompleted: (data) => {
      if (data?.updateForm?.isPublished) {
        toast(t('formDashboard.toast.publishSuccess.title'), {
          description: t('formDashboard.toast.publishSuccess.description'),
        });
      } else {
        toast(t('formDashboard.toast.unpublishSuccess.title'), {
          description: t('formDashboard.toast.unpublishSuccess.description'),
        });
      }
    },
    onError: (error) => {
      toast(t('formDashboard.toast.updateError.title'), {
        description: error.message || t('formDashboard.toast.updateError.descriptionFallback'),
      });
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

    const formDashboardStats = formData.form.dashboardStats;
    const totalFields = formData.form.metadata?.fieldCount || 0;

    // Format average completion time
    const formatCompletionTime = (seconds: number | null) => {
      if (!seconds) return '0 min';
      if (seconds < 60) return `${Math.round(seconds)}s`;
      const minutes = Math.round((seconds / 60) * 10) / 10;
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
      averageCompletionTime: formatCompletionTime(
        formDashboardStats?.averageCompletionTime || null
      ),
      responseRate: formatResponseRate(
        formDashboardStats?.responseRate || null
      ),
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
        input: { isPublished: true },
      },
      optimisticResponse: {
        updateForm: {
          ...formData?.form,
          isPublished: true,
          __typename: 'Form',
        },
      },
    });
  };

  const handleUnpublish = () => {
    if (!formId) return;
    updateForm({
      variables: {
        id: formId,
        input: { isPublished: false },
      },
      optimisticResponse: {
        updateForm: {
          ...formData?.form,
          isPublished: false,
          __typename: 'Form',
        },
      },
    });
    setShowUnpublishDialog(false);
  };

  const handleCollectResponses = () => {
    setShowCollectResponsesDialog(true);
  };

  const handleCopyLink = () => {
    if (!formData?.form?.shortUrl) return;
    const formViewerUrl = getFormViewerUrl(formData.form.shortUrl);
    navigator.clipboard.writeText(formViewerUrl).then(() => {
      toast(t('formDashboard.toast.copySuccess.title'), {
        description: t('formDashboard.toast.copySuccess.description'),
      });
    });
  };

  const handleOpenFormViewer = () => {
    if (!formData?.form?.shortUrl) return;
    const formViewerUrl = getFormViewerUrl(formData.form.shortUrl);
    window.open(formViewerUrl, '_blank', 'noopener,noreferrer');
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
