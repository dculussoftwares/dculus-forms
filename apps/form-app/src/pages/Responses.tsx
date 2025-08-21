import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  LoadingSpinner,
  Separator,
  TypographyH3,
  TypographyP,
} from '@dculus/ui';
import { MainLayout } from '../components/MainLayout';
import { GET_FORM_BY_ID } from '../graphql/queries';
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Calendar,
  Database,
  Download,
  Filter,
  PieChart,
  Table,
  UserCheck,
  Users,
} from 'lucide-react';

const Responses: React.FC = () => {
  const { formId, id } = useParams<{ formId?: string; id?: string }>();
  const navigate = useNavigate();

  // Use formId if available, otherwise fall back to id for backward compatibility
  const actualFormId = formId || id;

  const {
    data: formData,
    loading: formLoading,
    error: formError,
  } = useQuery(GET_FORM_BY_ID, {
    variables: { id: actualFormId },
    skip: !actualFormId,
  });

  // Mock responses count for stats - replace with actual GraphQL query later
  const mockResponsesCount = 3;

  if (formLoading) {
    return (
      <MainLayout
        title="Responses"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Form Dashboard', href: `/dashboard/form/${actualFormId}` },
          {
            label: 'Responses',
            href: `/dashboard/form/${actualFormId}/responses`,
          },
        ]}
      >
        <div className="flex justify-center items-center min-h-96">
          <LoadingSpinner />
        </div>
      </MainLayout>
    );
  }

  if (formError || !formData?.form) {
    return (
      <MainLayout
        title="Responses"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Form Dashboard', href: `/dashboard/form/${actualFormId}` },
          {
            label: 'Responses',
            href: `/dashboard/form/${actualFormId}/responses`,
          },
        ]}
      >
        <div className="max-w-4xl mx-auto px-4 py-12">
          <Card className="p-8 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h3 className="mb-2 text-xl font-semibold">Form Not Found</h3>
            <p className="text-slate-600">
              The form you're looking for doesn't exist or you don't have
              permission to view it.
            </p>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const form = formData.form;

  return (
    <MainLayout
      title={`${form.title} - Responses`}
      breadcrumbs={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: form.title, href: `/dashboard/form/${actualFormId}` },
        {
          label: 'Responses',
          href: `/dashboard/form/${actualFormId}/responses`,
        },
      ]}
    >
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/dashboard/form/${actualFormId}`)}
              className="text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid gap-6 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Responses
              </CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockResponsesCount}</div>
              <p className="text-xs text-muted-foreground">+2 from last week</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Completion Rate
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">85%</div>
              <p className="text-xs text-muted-foreground">
                +5% from last week
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Avg. Completion Time
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">2.5 min</div>
              <p className="text-xs text-muted-foreground">
                -0.3 min from last week
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Unique Respondents
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockResponsesCount}</div>
              <p className="text-xs text-muted-foreground">+1 from last week</p>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Response Viewing Options */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-xl p-6 border border-blue-100 dark:border-blue-800">
          <div className="flex items-center justify-between mb-6">
            <div>
              <TypographyH3 className="flex items-center text-blue-900 dark:text-blue-100">
                <Database className="mr-2 h-5 w-5 text-blue-600" />
                Response Views
              </TypographyH3>
              <TypographyP className="text-blue-700 dark:text-blue-300 mt-1">
                Choose how you want to view and analyze your form responses
              </TypographyP>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {/* Table View Card */}
            <Card
              className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer border-blue-200 dark:border-blue-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm"
              onClick={() => navigate(`/dashboard/form/${actualFormId}/responses/table`)}
            >
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="p-3 rounded-lg transition-colors bg-blue-100 dark:bg-blue-900 group-hover:bg-blue-200 dark:group-hover:bg-blue-800">
                    <Table className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      Table View
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                      View responses in a structured table format with search
                      and filtering
                    </p>
                    <Button
                      className="w-full transition-colors group-hover:bg-blue-600 group-hover:text-white"
                      variant="outline"
                      size="sm"
                    >
                      View Table
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Analytics View Card */}
            <Card
              className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer border-green-200 dark:border-green-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm"
              onClick={() => navigate(`/dashboard/form/${actualFormId}/responses/analytics`)}
            >
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="p-3 rounded-lg transition-colors bg-green-100 dark:bg-green-900 group-hover:bg-green-200 dark:group-hover:bg-green-800">
                    <PieChart className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      Response Analytics
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                      View charts, trends, and insights about your form
                      submissions
                    </p>
                    <Button
                      className="w-full transition-colors group-hover:bg-green-600 group-hover:text-white"
                      variant="outline"
                      size="sm"
                    >
                      View Analytics
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Individual Responses Card */}
            <Card
              className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer border-purple-200 dark:border-purple-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm"
              onClick={() => navigate(`/dashboard/form/${actualFormId}/responses/individual`)}
            >
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="p-3 rounded-lg transition-colors bg-purple-100 dark:bg-purple-900 group-hover:bg-purple-200 dark:group-hover:bg-purple-800">
                    <UserCheck className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      Individual Responses
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                      View detailed cards for each response with all field data
                    </p>
                    <Button
                      className="w-full transition-colors group-hover:bg-purple-600 group-hover:text-white"
                      variant="outline"
                      size="sm"
                    >
                      View Individual
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

      </div>
    </MainLayout>
  );
};

export default Responses;