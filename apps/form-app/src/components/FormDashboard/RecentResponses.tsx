import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TypographyH3,
  TypographyP,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
} from '@dculus/ui';
import {
  Activity,
  Users,
  FileText,
  CheckCircle,
} from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

interface Response {
  id: string;
  submittedAt: string;
}

interface RecentResponsesProps {
  responses: Response[];
  totalResponses: number;
}

interface FormStructureProps {
  formId: string;
}

export const FormStructure: React.FC<FormStructureProps> = ({ formId }) => {
  const navigate = useNavigate();
  const { t } = useTranslation('formDashboard');

  return (
    <Card className="lg:col-span-4">
      <CardHeader>
        <CardTitle className="flex items-center">
          <CheckCircle className="mr-2 h-5 w-5" />
          {t('formStructure.title')}
        </CardTitle>
        <CardDescription>{t('formStructure.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-100 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-blue-600" />
          </div>
          <TypographyH3 className="text-lg font-semibold mb-2">
            {t('formStructure.collaborative.title')}
          </TypographyH3>
          <TypographyP className="text-muted-foreground mb-4">
            {t('formStructure.collaborative.description')}
          </TypographyP>
          <Button
            onClick={() => navigate(`/dashboard/form/${formId}/builder`)}
            className="bg-primary hover:bg-primary/90"
          >
            {t('formStructure.collaborative.action')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export const RecentResponses: React.FC<RecentResponsesProps> = ({
  responses,
  totalResponses,
}) => {
  const { t, locale } = useTranslation('formDashboard');

  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Activity className="mr-2 h-5 w-5" />
          {t('recentResponses.title')}
        </CardTitle>
        <CardDescription>{t('recentResponses.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {responses.length > 0 ? (
          <div className="space-y-4">
            {responses.map((response: Response, index: number) => (
              <div key={response.id} className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <Users className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {t('recentResponses.response', { values: { number: totalResponses - index } })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(response.submittedAt).toLocaleString(locale)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <FileText className="mx-auto h-12 w-12 text-gray-300" />
            <TypographyP className="mt-2 text-sm text-muted-foreground">
              {t('recentResponses.noResponses')}
            </TypographyP>
          </div>
        )}
      </CardContent>
    </Card>
  );
};