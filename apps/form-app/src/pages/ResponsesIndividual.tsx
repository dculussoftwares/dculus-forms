import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

const ResponsesIndividual: React.FC = () => {
  const { formId, id } = useParams<{ formId?: string; id?: string }>();
  const actualFormId = formId || id;

  // This page was scaffolding with hardcoded mock data. Redirect to the real Responses page.
  return <Navigate to={`/dashboard/form/${actualFormId}/responses`} replace />;
};

export default ResponsesIndividual;
