import React from 'react';
import { Navigate, useLocation, useParams } from 'react-router';

interface AutomationRedirectProps {
  kind: 'list' | 'builder' | 'runs';
}

/**
 * Old standalone automations routes (/dashboard/form/:formId/automations/*) redirect to
 * their new nested-under-builder equivalents (/dashboard/form/:formId/builder/automations/*).
 * See epic #226, ticket #233.
 */
const AutomationRedirect: React.FC<AutomationRedirectProps> = ({ kind }) => {
  const { formId, automationId } = useParams<{ formId: string; automationId?: string }>();
  const location = useLocation();

  const target =
    kind === 'list'
      ? `/dashboard/form/${formId}/builder/automations`
      : kind === 'builder'
        ? `/dashboard/form/${formId}/builder/automations/${automationId}`
        : `/dashboard/form/${formId}/builder/automations/${automationId}/runs`;

  return <Navigate to={`${target}${location.search}`} replace />;
};

export default AutomationRedirect;
