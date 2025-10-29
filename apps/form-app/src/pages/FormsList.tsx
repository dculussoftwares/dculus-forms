import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, TypographyH1, TypographyH2, TypographyLarge, TypographySmall } from '@dculus/ui';
import { GET_MY_FORMS_WITH_CATEGORY, GET_SHARED_FORMS_WITH_CATEGORY } from '../graphql/queries';
import { useAppConfig } from '@/hooks';
import { useTranslation } from '../hooks/useTranslation';

const FormsList: React.FC = () => {
  const navigate = useNavigate();
  const { organizationId } = useAppConfig();
  const { t } = useTranslation('formsList');
  const { loading: myFormsLoading, error: myFormsError, data: myFormsData } = useQuery(GET_MY_FORMS_WITH_CATEGORY, {
    variables: { organizationId },
    skip: !organizationId
  });

  const { loading: sharedFormsLoading, error: sharedFormsError, data: sharedFormsData } = useQuery(GET_SHARED_FORMS_WITH_CATEGORY, {
    variables: { organizationId },
    skip: !organizationId
  });

  const loading = myFormsLoading || sharedFormsLoading;
  const error = myFormsError || sharedFormsError;

  // Combine all forms
  const allForms = [
    ...(myFormsData?.formsWithCategory || []),
    ...(sharedFormsData?.formsWithCategory || [])
  ];

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <TypographyLarge className="text-muted-foreground">{t('loading')}</TypographyLarge>
    </div>
  );
  
  if (error) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <TypographyLarge className="text-destructive">
        {t('error', { values: { error: error.message } })}
      </TypographyLarge>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <TypographyH1>{t('header.title')}</TypographyH1>
        <Button onClick={() => navigate('/forms/new')}>
          {t('header.create')}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {allForms.map((form: any) => (
          <Card key={form.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-xl">{form.title}</CardTitle>
              {form.description && (
                <CardDescription>{form.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <TypographySmall className="text-muted-foreground">
                {t('card.managed')}
              </TypographySmall>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate(`/dashboard/form/${form.id}`)}
              >
                {t('card.buttons.dashboard')}
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate(`/forms/${form.id}`)}
              >
                {t('card.buttons.view')}
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate(`/forms/${form.id}/edit`)}
              >
                {t('card.buttons.edit')}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {allForms.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <TypographyH2 className="mb-4">{t('empty.title')}</TypographyH2>
            <Button onClick={() => navigate('/forms/new')}>
              {t('empty.action')}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FormsList; 
