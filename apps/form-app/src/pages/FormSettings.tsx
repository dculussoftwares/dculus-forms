import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import {
  TypographyH1,
  TypographyH3,
  TypographyP,
  TypographyMuted,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Separator,
  LoadingSpinner,
  Input,
  Label,
  Textarea,
} from '@dculus/ui';
import { MainLayout } from '../components/MainLayout';
import { GET_FORM_BY_ID } from '../graphql/queries';
import { UPDATE_FORM, REGENERATE_SHORT_URL } from '../graphql/mutations';
import {
  Settings,
  Shield,
  Globe,
  Webhook,
  Save,
  ArrowLeft,
  Bell,
  Users,
  Link,
  Database,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

const FormSettings: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const {
    data: formData,
    loading: formLoading,
    error: formError,
    refetch,
  } = useQuery(GET_FORM_BY_ID, {
    variables: { id: formId },
    skip: !formId,
  });

  const [updateForm] = useMutation(UPDATE_FORM, {
    onCompleted: () => {
      setIsSaving(false);
      setErrors({});
      // Could add toast notification here
      refetch();
    },
    onError: (error) => {
      setIsSaving(false);
      setErrors({ general: error.message });
    },
  });

  const [regenerateShortUrl] = useMutation(REGENERATE_SHORT_URL, {
    onCompleted: () => {
      setIsSaving(false);
      setErrors({});
      refetch();
    },
    onError: (error) => {
      setIsSaving(false);
      setErrors({ general: error.message });
    },
  });

  const handleSaveChanges = async () => {
    if (!formId) return;
    
    setIsSaving(true);
    setErrors({});

    // Get form values
    const titleInput = document.getElementById('form-title') as HTMLInputElement;
    const descriptionInput = document.getElementById('form-description') as HTMLTextAreaElement;
    
    const title = titleInput?.value.trim();
    const description = descriptionInput?.value.trim();

    // Basic validation
    if (!title) {
      setErrors({ title: 'Form title is required' });
      setIsSaving(false);
      return;
    }

    try {
      await updateForm({
        variables: {
          id: formId,
          input: {
            title,
            description,
          },
        },
      });
    } catch (error) {
      // Error handled by onError callback
    }
  };

  const handleRegenerateShortUrl = async () => {
    if (!formId) return;
    
    setIsSaving(true);
    setErrors({});

    try {
      await regenerateShortUrl({
        variables: {
          id: formId,
        },
      });
    } catch (error) {
      // Error handled by onError callback
    }
  };

  if (formLoading) {
    return (
      <MainLayout
        title="Form Settings"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Form Dashboard', href: `/dashboard/form/${formId}` },
          { label: 'Settings', href: `/dashboard/form/${formId}/settings` },
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
        title="Form Settings"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Form Settings', href: `/dashboard/form/${formId}/settings` },
        ]}
      >
        <div className="max-w-4xl mx-auto px-4 py-12">
          <Card className="p-8 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <TypographyH3 className="mb-2">Form Not Found</TypographyH3>
            <TypographyP className="text-slate-600">
              The form you're looking for doesn't exist or you don't have
              permission to view it.
            </TypographyP>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const form = formData.form;

  return (
    <MainLayout
      title={`${form.title} - Settings`}
      breadcrumbs={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: form.title, href: `/dashboard/form/${formId}` },
        { label: 'Settings', href: `/dashboard/form/${formId}/settings` },
      ]}
    >
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Header Section */}
        <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/dashboard/form/${formId}`)}
                className="mr-2"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Dashboard
              </Button>
            </div>
            <TypographyH1 className="mb-2 flex items-center">
              <Settings className="mr-3 h-8 w-8" />
              Form Settings
            </TypographyH1>
            <TypographyP className="text-slate-600">
              Configure settings and preferences for "{form.title}"
            </TypographyP>
          </div>
          <div className="flex space-x-3">
            <Button variant="outline" size="sm" disabled={isSaving}>
              Reset to Defaults
            </Button>
            <Button size="sm" onClick={handleSaveChanges} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>

        <Separator />

        {/* Settings Grid */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* General Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Globe className="mr-2 h-5 w-5" />
                General Settings
              </CardTitle>
              <CardDescription>
                Basic form information and display settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="form-title">Form Title</Label>
                <Input
                  id="form-title"
                  defaultValue={form.title}
                  placeholder="Enter form title"
                  className={errors.title ? 'border-red-500' : ''}
                />
                {errors.title && (
                  <p className="text-xs text-red-500">{errors.title}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="form-description">Description</Label>
                <Textarea
                  id="form-description"
                  defaultValue={form.description || ''}
                  placeholder="Enter form description"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="form-short-url">Short URL</Label>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-slate-500">forms.dculus.com/</span>
                  <Input
                    id="form-short-url"
                    value={form.shortUrl}
                    readOnly
                    className="flex-1 bg-slate-50 cursor-default"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRegenerateShortUrl}
                    disabled={isSaving}
                    title="Generate new short URL"
                  >
                    <RefreshCw className={`h-4 w-4 ${isSaving ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                <TypographyMuted className="text-xs">
                  Short URL is automatically generated. Click the refresh button to generate a new one.
                </TypographyMuted>
              </div>
              <div className="space-y-2">
                <Label htmlFor="form-status">Publication Status</Label>
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      form.isPublished ? 'bg-green-500' : 'bg-yellow-500'
                    }`}
                  />
                  <span className="text-sm">
                    {form.isPublished ? 'Published' : 'Draft'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submission Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Database className="mr-2 h-5 w-5" />
                Submission Settings
              </CardTitle>
              <CardDescription>
                Control how responses are collected and processed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Allow Multiple Submissions</Label>
                  <TypographyMuted className="text-xs">
                    Users can submit the form multiple times
                  </TypographyMuted>
                </div>
                <div className="w-12 h-6 bg-gray-200 rounded-full relative cursor-pointer">
                  <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 left-0.5 shadow-sm"></div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Require Authentication</Label>
                  <TypographyMuted className="text-xs">
                    Users must sign in to submit
                  </TypographyMuted>
                </div>
                <div className="w-12 h-6 bg-blue-500 rounded-full relative cursor-pointer">
                  <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 right-0.5 shadow-sm"></div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="submission-limit">Response Limit</Label>
                <Input
                  id="submission-limit"
                  type="number"
                  placeholder="Unlimited"
                  defaultValue=""
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="submission-deadline">Submission Deadline</Label>
                <Input
                  id="submission-deadline"
                  type="datetime-local"
                  defaultValue=""
                />
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bell className="mr-2 h-5 w-5" />
                Notifications
              </CardTitle>
              <CardDescription>
                Configure email notifications and alerts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">New Response Notifications</Label>
                  <TypographyMuted className="text-xs">
                    Get notified when someone submits the form
                  </TypographyMuted>
                </div>
                <div className="w-12 h-6 bg-blue-500 rounded-full relative cursor-pointer">
                  <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 right-0.5 shadow-sm"></div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Daily Summary</Label>
                  <TypographyMuted className="text-xs">
                    Receive daily summary of form activity
                  </TypographyMuted>
                </div>
                <div className="w-12 h-6 bg-gray-200 rounded-full relative cursor-pointer">
                  <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 left-0.5 shadow-sm"></div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notification-email">Notification Email</Label>
                <Input
                  id="notification-email"
                  type="email"
                  placeholder="your-email@example.com"
                  defaultValue=""
                />
              </div>
            </CardContent>
          </Card>

          {/* Access Control */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="mr-2 h-5 w-5" />
                Access Control
              </CardTitle>
              <CardDescription>
                Manage who can view and submit your form
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Form Visibility</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input type="radio" name="visibility" defaultChecked />
                    <Label className="text-sm">Public - Anyone with the link</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input type="radio" name="visibility" />
                    <Label className="text-sm">Private - Only invited users</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input type="radio" name="visibility" />
                    <Label className="text-sm">Organization - Only team members</Label>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="access-password">Access Password (Optional)</Label>
                <Input
                  id="access-password"
                  type="password"
                  placeholder="Enter password"
                />
              </div>
              <div className="space-y-2">
                <Label>Invited Users</Label>
                <div className="flex space-x-2">
                  <Input placeholder="Add email address" />
                  <Button size="sm">
                    <Users className="h-4 w-4 mr-1" />
                    Invite
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Integrations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Webhook className="mr-2 h-5 w-5" />
                Integrations
              </CardTitle>
              <CardDescription>
                Connect your form to external services and webhooks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="webhook-url">Webhook URL</Label>
                <div className="flex space-x-2">
                  <Input
                    id="webhook-url"
                    placeholder="https://your-site.com/webhook"
                  />
                  <Button variant="outline" size="sm">
                    Test
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Send to Google Sheets</Label>
                  <TypographyMuted className="text-xs">
                    Automatically export responses to spreadsheet
                  </TypographyMuted>
                </div>
                <Button variant="outline" size="sm">
                  <Link className="h-4 w-4 mr-1" />
                  Connect
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Zapier Integration</Label>
                  <TypographyMuted className="text-xs">
                    Trigger Zapier workflows on new submissions
                  </TypographyMuted>
                </div>
                <Button variant="outline" size="sm">
                  <Link className="h-4 w-4 mr-1" />
                  Setup
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Advanced Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="mr-2 h-5 w-5" />
                Advanced Settings
              </CardTitle>
              <CardDescription>
                Additional form behavior and customization options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Shuffle Questions</Label>
                  <TypographyMuted className="text-xs">
                    Randomize the order of form fields
                  </TypographyMuted>
                </div>
                <div className="w-12 h-6 bg-gray-200 rounded-full relative cursor-pointer">
                  <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 left-0.5 shadow-sm"></div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Progress Bar</Label>
                  <TypographyMuted className="text-xs">
                    Show completion progress to users
                  </TypographyMuted>
                </div>
                <div className="w-12 h-6 bg-blue-500 rounded-full relative cursor-pointer">
                  <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 right-0.5 shadow-sm"></div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="custom-css">Custom CSS</Label>
                <Textarea
                  id="custom-css"
                  placeholder="/* Add custom styles here */"
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="redirect-url">Redirect After Submission</Label>
                <Input
                  id="redirect-url"
                  placeholder="https://your-site.com/thank-you"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Error Display */}
        {errors.general && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <p className="text-sm text-red-700">{errors.general}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Save Actions */}
        <div className="flex justify-between items-center pt-6 border-t">
          <TypographyMuted className="text-xs">
            Changes are saved manually • Click "Save Changes" to apply updates
          </TypographyMuted>
          <div className="flex space-x-3">
            <Button variant="outline" disabled={isSaving}>
              Cancel Changes
            </Button>
            <Button onClick={handleSaveChanges} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save All Changes'}
            </Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default FormSettings;