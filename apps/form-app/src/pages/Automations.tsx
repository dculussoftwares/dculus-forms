import React, { useState } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@apollo/client/react';
import { useTranslation } from '../hooks/useTranslation';
import { Button, LoadingSpinner, EmptyState } from '@dculus/ui';
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

  if (formLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <LoadingSpinner fullScreen={false} />
      </div>
    );
  }

  if (formError || !formData?.form) {
    return (
      <div className="h-full overflow-y-auto p-8">
        <EmptyState
          variant="error"
          icon={<AlertCircle className="h-6 w-6 text-destructive" />}
          title={t('errors.formNotFound.title')}
          description={t('errors.formNotFound.description')}
        />
      </div>
    );
  }

  const form = formData.form;
  const userPermission = (form.userPermission as PermissionLevel) || 'VIEWER';
  const automations: Automation[] = automationsData?.formAutomations || [];

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-950 px-4 py-8">
      <FormPermissionProvider userPermission={userPermission}>
        {automationsLoading ? (
          <div className="flex justify-center items-center py-16">
            <LoadingSpinner fullScreen={false} />
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
    </div>
  );
};

export default Automations;
