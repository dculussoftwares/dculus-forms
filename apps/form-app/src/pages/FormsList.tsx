import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, TypographyH1, TypographyH2, TypographyLarge, TypographySmall } from '@dculus/ui';
import { GET_FORMS } from '../graphql/queries';
import { useAppConfig } from '@/hooks';

const FormsList: React.FC = () => {
  const navigate = useNavigate();
  const { organizationId } = useAppConfig();
  const { loading, error, data } = useQuery(GET_FORMS, {
    variables: { organizationId },
    skip: !organizationId
  });

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <TypographyLarge className="text-muted-foreground">Loading forms...</TypographyLarge>
    </div>
  );
  
  if (error) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <TypographyLarge className="text-destructive">Error loading forms: {error.message}</TypographyLarge>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <TypographyH1>Forms</TypographyH1>
        <Button onClick={() => navigate('/forms/new')}>
          + Create Form
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {data?.forms?.map((form: any) => (
          <Card key={form.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-xl">{form.title}</CardTitle>
              {form.description && (
                <CardDescription>{form.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <TypographySmall className="text-muted-foreground">
                Form fields managed via collaboration
              </TypographySmall>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate(`/dashboard/form/${form.id}`)}
              >
                � Dashboard
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate(`/forms/${form.id}`)}
              >
                👁 View
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate(`/forms/${form.id}/edit`)}
              >
                ✏️ Edit
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {data?.forms?.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <TypographyH2 className="mb-4">No forms created yet</TypographyH2>
            <Button onClick={() => navigate('/forms/new')}>
              + Create Your First Form
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FormsList; 