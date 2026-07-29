import { useMutation } from '@apollo/client/react';
import { useNavigate } from 'react-router';
import { toastSuccess, toastError } from '@dculus/ui';
import { TEST_AUTOMATION } from '../graphql/automations';
import { useTranslation } from './useTranslation';

/**
 * Shared testAutomation flow (mutation + toast + navigate-to-live-run) used by the
 * automations list card, the builder header, and the runs page's own Test button.
 */
export function useTestAutomation(formId: string, automationId: string) {
  const { t } = useTranslation('automations');
  const navigate = useNavigate();
  const [testAutomation, { loading: isTesting }] = useMutation(TEST_AUTOMATION);

  const runTest = async (onStarted?: (runId: string) => void) => {
    try {
      const result = await testAutomation({ variables: { id: automationId } });
      if (result.error) throw result.error;
      const newRun = result.data?.testAutomation;
      toastSuccess(t('runs.toasts.testTriggeredTitle'), t('runs.toasts.testTriggeredMessage'));
      if (onStarted && newRun?.id) {
        onStarted(newRun.id);
      } else {
        navigate(`/dashboard/form/${formId}/builder/automations/${automationId}/runs${newRun?.id ? `?runId=${newRun.id}` : ''}`);
      }
    } catch (error: any) {
      toastError(t('runs.toasts.testErrorTitle'), error.message);
    }
  };

  return { runTest, isTesting };
}
