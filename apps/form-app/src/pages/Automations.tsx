import React, { useState } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@apollo/client/react';
import { useTranslation } from '../hooks/useTranslation';
import { Button, LoadingSpinner, EmptyState } from '@dculus/ui';
import { MainLayout } from '../components/MainLayout';
import { GET_FORM_BY_ID } from '../graphql/queries';
import { GET_FORM_AUTOMATIONS } from '../graphql/automations';
import { AlertCircle, Plus, Workflow } from 'lucide-react';
import { AutomationCard, type Automation } from '../components/automations/AutomationCard';
import { CreateAutomationDialog } from '../components/automations/CreateAutomationDialog';
import { FormPermissionProvider, type PermissionLevel } from '../contexts/FormPermissionContext';
import { useFormPermissions } from '../hooks/useFormPermissions';

const AutomationsContent: React.FC<{
  formId: string;
  automations: Automation[];
  hasResponses: boolean;
  onCreateClick: () => void;
}> = ({ automations, hasResponses, onCreateClick }) => {
  const { t } = useTranslation('automations');
  const { canEdit } = useFormPermissions();

  return (
    <div className="space-y-5 max-w-3xl mx-auto w-full">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-primary">{t('header.title')}</h1>
          <p className="text-sm mt-1 text-muted-foreground">{t('header.description')}</p>
        </div>
        {canEdit && automations.length > 0 && (
          <Button onClick={onCreateClick} data-testid="create-automation-button">
            <Plus className="mr-1.5 h-4 w-4" />
            {t('header.createButton')}
          </Button>
        )}
      </div>

      {!canEdit && (
        <p className="text-xs text-muted-foreground" data-testid="automations-readonly-notice">
          {t('readOnlyNotice')}
        </p>
      )}

      {automations.length === 0 ? (
        <EmptyState
          icon={<Workflow className="h-6 w-6" style={{ color: '#3949ab' }} />}
          title={t('emptyState.title')}
          description={t('emptyState.description')}
          action={
            canEdit ? (
              <Button onClick={onCreateClick} data-testid="create-automation-empty-button">
                <Plus className="mr-1.5 h-4 w-4" />
                {t('emptyState.createButton')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div
          className="rounded-xl bg-white dark:bg-card overflow-hidden"
          style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}
        >
          {automations.map((automation, i) => (
            <div
              key={automation.id}
              style={{ borderTop: i > 0 ? '1px solid var(--tf-border-light)' : undefined }}
            >
              <AutomationCard automation={automation} hasResponses={hasResponses} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Automations: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const { t } = useTranslation('automations');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: formData, loading: formLoading, error: formError } = useQuery(GET_FORM_BY_ID, {
    variables: { id: formId },
    skip: !formId,
  });

  const { data: automationsData, loading: automationsLoading } = useQuery(GET_FORM_AUTOMATIONS, {
    variables: { formId },
    skip: !formId,
    fetchPolicy: 'cache-and-network',
  });

  const breadcrumbs = (form?: { title: string }) => [
    { label: t('layout.breadcrumbs.dashboard'), href: '/dashboard' },
    { label: form ? form.title : t('layout.breadcrumbs.formDashboard'), href: `/dashboard/form/${formId}` },
    { label: t('layout.breadcrumbs.automations') },
  ];

  if (formLoading) {
    return (
      <MainLayout title={t('layout.title')} breadcrumbs={breadcrumbs()}>
        <div className="flex justify-center items-center min-h-96">
          <LoadingSpinner />
        </div>
      </MainLayout>
    );
  }

  if (formError || !formData?.form) {
    return (
      <MainLayout title={t('layout.title')} breadcrumbs={breadcrumbs()}>
        <EmptyState
          variant="error"
          icon={<AlertCircle className="h-6 w-6 text-destructive" />}
          title={t('errors.formNotFound.title')}
          description={t('errors.formNotFound.description')}
        />
      </MainLayout>
    );
  }

  const form = formData.form;
  const userPermission = (form.userPermission as PermissionLevel) || 'VIEWER';
  const automations: Automation[] = automationsData?.formAutomations || [];

  return (
    <MainLayout
      title={t('layout.dynamicTitle', { values: { formTitle: form.title } })}
      breadcrumbs={breadcrumbs(form)}
    >
      <FormPermissionProvider userPermission={userPermission}>
        {automationsLoading ? (
          <div className="flex justify-center items-center py-16">
            <LoadingSpinner />
          </div>
        ) : (
          <AutomationsContent
            formId={formId!}
            automations={automations}
            hasResponses={(form.responseCount ?? 0) > 0}
            onCreateClick={() => setShowCreateDialog(true)}
          />
        )}
        <CreateAutomationDialog formId={formId!} open={showCreateDialog} onOpenChange={setShowCreateDialog} />
      </FormPermissionProvider>
    </MainLayout>
  );
};

export default Automations;
