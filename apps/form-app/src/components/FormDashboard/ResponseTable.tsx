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
  if (totalResponses === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Response Overview</CardTitle>
        <CardDescription>Detailed view of all form responses</CardDescription>
      </CardHeader>
      <CardContent>
        <TypographyTable>
          <thead>
            <TypographyTableRow>
              <TypographyTableHead>Response ID</TypographyTableHead>
              <TypographyTableHead>Submitted</TypographyTableHead>
              <TypographyTableHead>Status</TypographyTableHead>
              <TypographyTableHead>Actions</TypographyTableHead>
            </TypographyTableRow>
          </thead>
          <tbody>
            {responses.slice(0, 10).map((response: Response, index: number) => (
              <TypographyTableRow key={response.id}>
                <TypographyTableCell className="font-medium">
                  #{index + 1}
                </TypographyTableCell>
                <TypographyTableCell>
                  {new Date(response.submittedAt).toLocaleString()}
                </TypographyTableCell>
                <TypographyTableCell>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Completed
                  </span>
                </TypographyTableCell>
                <TypographyTableCell>
                  <Button variant="ghost" size="sm">
                    View Details
                  </Button>
                </TypographyTableCell>
              </TypographyTableRow>
            ))}
          </tbody>
        </TypographyTable>
        {responses.length > 10 && (
          <div className="mt-4 text-center">
            <Button variant="outline">
              View All Responses ({totalResponses})
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};