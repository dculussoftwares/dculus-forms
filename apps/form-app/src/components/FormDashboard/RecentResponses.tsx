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

  return (
    <Card className="lg:col-span-4">
      <CardHeader>
        <CardTitle className="flex items-center">
          <CheckCircle className="mr-2 h-5 w-5" />
          Form Structure
        </CardTitle>
        <CardDescription>Overview of your form pages and fields</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-100 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-blue-600" />
          </div>
          <TypographyH3 className="text-lg font-semibold mb-2">
            Form structure is now collaborative
          </TypographyH3>
          <TypographyP className="text-muted-foreground mb-4">
            Form pages and fields are managed through real-time collaboration.
            Use the form builder to edit your form structure.
          </TypographyP>
          <Button
            onClick={() => navigate(`/dashboard/form/${formId}/builder`)}
            className="bg-primary hover:bg-primary/90"
          >
            Open Form Builder
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
  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Activity className="mr-2 h-5 w-5" />
          Recent Responses
        </CardTitle>
        <CardDescription>Latest form submissions</CardDescription>
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
                    Response #{totalResponses - index}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(response.submittedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <FileText className="mx-auto h-12 w-12 text-gray-300" />
            <TypographyP className="mt-2 text-sm text-muted-foreground">
              No responses yet
            </TypographyP>
          </div>
        )}
      </CardContent>
    </Card>
  );
};