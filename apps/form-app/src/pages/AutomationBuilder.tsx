import React from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery } from '@apollo/client/react';
import { useTranslation } from '../hooks/useTranslation';
import { Button, LoadingSpinner, EmptyState } from '@dculus/ui';
import { MainLayout } from '../components/MainLayout';
import { GET_FORM_BY_ID } from '../graphql/queries';
import { GET_AUTOMATION } from '../graphql/automations';
import { AlertCircle, ArrowLeft, Workflow } from 'lucide-react';

/**
 * Builder shell placeholder — the React Flow canvas (#197) fills this in.
 * Confirms the automation exists and is reachable, then hands off to the
 * as-yet-unbuilt visual editor.
 */
const AutomationBuilder: React.FC = () => {
  const { formId, automationId } = useParams<{ formId: string; automationId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation('automations');

  const { data: formData, loading: formLoading } = useQuery(GET_FORM_BY_ID, {
    variables: { id: formId },
    skip: !formId,
  });

  const { data: automationData, loading: automationLoading, error: automationError } = useQuery(GET_AUTOMATION, {
    variables: { id: automationId },
    skip: !automationId,
  });

  const form = formData?.form;
  const automation = automationData?.automation;

  const breadcrumbs = [
    { label: t('layout.breadcrumbs.dashboard'), href: '/dashboard' },
    { label: form ? form.title : t('layout.breadcrumbs.formDashboard'), href: `/dashboard/form/${formId}` },
    { label: t('layout.breadcrumbs.automations'), href: `/dashboard/form/${formId}/automations` },
    { label: automation ? automation.name : t('layout.breadcrumbs.builder') },
  ];

  if (formLoading || automationLoading) {
    return (
      <MainLayout title={t('builder.title')} breadcrumbs={breadcrumbs}>
        <div className="flex justify-center items-center min-h-96">
          <LoadingSpinner />
        </div>
      </MainLayout>
    );
  }

  if (automationError || !automation) {
    return (
      <MainLayout title={t('builder.title')} breadcrumbs={breadcrumbs}>
        <EmptyState
          variant="error"
          icon={<AlertCircle className="h-6 w-6 text-destructive" />}
          title={t('errors.automationNotFound.title')}
          description={t('errors.automationNotFound.description')}
        />
      </MainLayout>
    );
  }

  return (
    <MainLayout title={automation.name} breadcrumbs={breadcrumbs}>
      <div className="max-w-3xl mx-auto w-full">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 gap-1.5 text-muted-foreground"
          onClick={() => navigate(`/dashboard/form/${formId}/automations`)}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('builder.backButton')}
        </Button>
        <EmptyState
          icon={<Workflow className="h-6 w-6" style={{ color: '#3949ab' }} />}
          title={automation.name}
          description={t('builder.comingSoon')}
        />
      </div>
    </MainLayout>
  );
};

export default AutomationBuilder;
