import React from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
  TypographyMuted,
} from '@dculus/ui';
import { Globe, RefreshCw, Save } from 'lucide-react';

interface GeneralSettingsProps {
  form: any;
  errors: { [key: string]: string };
  isSaving: boolean;
  onSave: () => void;
  onRegenerateShortUrl: () => void;
}

const GeneralSettings: React.FC<GeneralSettingsProps> = ({
  form,
  errors,
  isSaving,
  onSave,
  onRegenerateShortUrl,
}) => {
  return (
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
            <span className="text-sm text-slate-500">
              forms.dculus.com/
            </span>
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
              onClick={onRegenerateShortUrl}
              disabled={isSaving}
              title="Generate new short URL"
            >
              <RefreshCw
                className={`h-4 w-4 ${isSaving ? 'animate-spin' : ''}`}
              />
            </Button>
          </div>
          <TypographyMuted className="text-xs">
            Short URL is automatically generated. Click the refresh button
            to generate a new one.
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
        <div className="pt-4">
          <Button
            onClick={onSave}
            disabled={isSaving}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default GeneralSettings;