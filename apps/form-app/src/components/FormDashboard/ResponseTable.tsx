import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  TypographyTable,
  TypographyTableHead,
  TypographyTableRow,
  TypographyTableCell,
} from '@dculus/ui';
import { useTranslation } from '../../hooks/useTranslation';

interface Response {
  id: string;
  submittedAt: string;
}

interface ResponseTableProps {
  responses: Response[];
  totalResponses: number;
}

export const ResponseTable: React.FC<ResponseTableProps> = ({
  responses,
  totalResponses,
}) => {
  const { t, locale } = useTranslation('formDashboard');

  if (totalResponses === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('responseTable.title')}</CardTitle>
        <CardDescription>{t('responseTable.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <TypographyTable>
          <thead>
            <TypographyTableRow>
              <TypographyTableHead>{t('responseTable.headers.responseId')}</TypographyTableHead>
              <TypographyTableHead>{t('responseTable.headers.submitted')}</TypographyTableHead>
              <TypographyTableHead>{t('responseTable.headers.status')}</TypographyTableHead>
              <TypographyTableHead>{t('responseTable.headers.actions')}</TypographyTableHead>
            </TypographyTableRow>
          </thead>
          <tbody>
            {responses.slice(0, 10).map((response: Response, index: number) => (
              <TypographyTableRow key={response.id}>
                <TypographyTableCell className="font-medium">
                  #{index + 1}
                </TypographyTableCell>
                <TypographyTableCell>
                  {new Date(response.submittedAt).toLocaleString(locale)}
                </TypographyTableCell>
                <TypographyTableCell>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {t('responseTable.status.completed')}
                  </span>
                </TypographyTableCell>
                <TypographyTableCell>
                  <Button variant="ghost" size="sm">
                    {t('responseTable.actions.viewDetails')}
                  </Button>
                </TypographyTableCell>
              </TypographyTableRow>
            ))}
          </tbody>
        </TypographyTable>
        {responses.length > 10 && (
          <div className="mt-4 text-center">
            <Button variant="outline">
              {t('responseTable.actions.viewAllResponses', { values: { total: totalResponses } })}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};