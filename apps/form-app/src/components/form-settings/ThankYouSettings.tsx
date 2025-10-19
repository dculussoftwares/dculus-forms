import React, { useMemo } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Checkbox,
} from '@dculus/ui';
import { CheckCircle, Save } from 'lucide-react';
import { deserializeFormSchema, FillableFormField } from '@dculus/types';

// Use RichTextEditor which is LexicalRichTextEditor exported from @dculus/ui
import { RichTextEditor } from '@dculus/ui';

interface ThankYouSettingsData {
  enabled: boolean;
  message: string;
}

interface ThankYouSettingsProps {
  settings: ThankYouSettingsData;
  isSaving: boolean;
  form: any; // Form object containing formSchema
  onToggleEnabled: (enabled: boolean) => void;
  onMessageChange: (message: string) => void;
  onSave: () => void;
}

// Utility function to extract mention fields from form schema
const extractMentionFields = (form: any) => {
  if (!form?.formSchema) return [];

  try {
    const schema = deserializeFormSchema(form.formSchema);
    const mentionFields: { fieldId: string; label: string }[] = [];

    for (const page of schema.pages) {
      for (const field of page.fields) {
        if (field instanceof FillableFormField && field.label) {
          mentionFields.push({
            fieldId: field.id,
            label: field.label
          });
        }
      }
    }

    return mentionFields;
  } catch (error) {
    console.error('Error extracting mention fields:', error);
    return [];
  }
};

const ThankYouSettings: React.FC<ThankYouSettingsProps> = ({
  settings,
  isSaving,
  form,
  onToggleEnabled,
  onMessageChange,
  onSave,
}) => {
  // Extract mention fields from the form schema
  const mentionFields = useMemo(() => extractMentionFields(form), [form]);

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
          <Checkbox
            id="thank-you-enabled"
            checked={settings.enabled}
            onCheckedChange={onToggleEnabled}
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
                mentionFields={mentionFields}
              />
              <p className="text-xs text-gray-500">
                This message will be displayed to users after they submit the
                form. You can use rich formatting including{' '}
                <strong>bold</strong>, <em>italic</em>, headings, lists, quotes,
                and links.
                {mentionFields.length > 0 ? (
                  <>
                    {' '}Type <strong>@</strong> to mention form fields ({mentionFields.length} available) and reference user responses.
                  </>
                ) : (
                  <>
                    {' '}Add some fields to your form to enable @ mentions for personalizing messages.
                  </>
                )}
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