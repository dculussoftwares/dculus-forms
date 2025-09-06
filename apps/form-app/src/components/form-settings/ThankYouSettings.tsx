import React from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  RichTextEditor,
} from '@dculus/ui';
import { CheckCircle, Save } from 'lucide-react';

interface ThankYouSettingsData {
  enabled: boolean;
  message: string;
}

interface ThankYouSettingsProps {
  settings: ThankYouSettingsData;
  isSaving: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  onMessageChange: (message: string) => void;
  onSave: () => void;
}

const ThankYouSettings: React.FC<ThankYouSettingsProps> = ({
  settings,
  isSaving,
  onToggleEnabled,
  onMessageChange,
  onSave,
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <CheckCircle className="mr-2 h-5 w-5" />
          Thank You Page
        </CardTitle>
        <CardDescription>
          Configure what happens after form submission
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="thank-you-enabled"
            checked={settings.enabled}
            onChange={(e) => onToggleEnabled(e.target.checked)}
            className="w-4 h-4 text-green-600 focus:ring-green-500 rounded"
          />
          <div className="space-y-1">
            <Label
              htmlFor="thank-you-enabled"
              className="text-sm font-medium cursor-pointer"
            >
              Enable Thank You Page
            </Label>
            <p className="text-sm text-gray-600">
              Show a custom thank you message after form submission
            </p>
          </div>
        </div>

        {settings.enabled && (
          <div className="space-y-4 pt-4 border-t border-gray-200">
            <div className="space-y-2">
              <Label
                htmlFor="thank-you-message"
                className="text-sm font-medium"
              >
                Thank You Message
              </Label>
              <RichTextEditor
                value={settings.message}
                onChange={onMessageChange}
                placeholder="Thank you! Your response has been submitted."
                className="w-full"
              />
              <p className="text-xs text-gray-500">
                This message will be displayed to users after they submit the
                form. You can use rich formatting including{' '}
                <strong>bold</strong>, <em>italic</em>, headings, lists, quotes,
                and links.
              </p>
            </div>
          </div>
        )}

        <div className="pt-4">
          <Button 
            onClick={onSave}
            disabled={isSaving}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Thank You Settings'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ThankYouSettings;