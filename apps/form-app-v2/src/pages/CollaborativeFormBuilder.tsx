import { useParams, Navigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { GET_FORM_BY_ID } from '@/graphql/queries';
import { FormBuilderContainer } from '@/components/collaborative-builder/FormBuilderContainer';
import { Skeleton } from '@dculus/ui-v2';

/**
 * Main route page for the collaborative form builder
 * Loads form data and renders the builder container
 */
export function CollaborativeFormBuilder() {
  const { formId, tab } = useParams<{ formId: string; tab?: string }>();

  // Fetch form data
  const { data, loading, error } = useQuery(GET_FORM_BY_ID, {
    variables: { id: formId },
    skip: !formId,
  });

  // Loading state
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-4 w-96">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  // Error or form not found
  if (error || !data?.form) {
    return <Navigate to="/dashboard" replace />;
  }

  return <FormBuilderContainer form={data.form} initialTab={tab} />;
}
