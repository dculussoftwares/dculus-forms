import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@dculus/ui';
import SettingsSidebar from './SettingsSidebar';
import GeneralSettings from './GeneralSettings';
import ThankYouSettings from './ThankYouSettings';
import SubmissionLimitsSettings from './SubmissionLimitsSettings';

interface FormSettingsContainerProps {
  form: any;
  settings: any;
  isSaving: boolean;
  errors: { [key: string]: string };
  currentResponseCount?: number;
  onSaveGeneralSettings: () => void;
  onRegenerateShortUrl: () => void;
  onUpdateThankYouSetting: (key: string, value: any) => void;
  onSaveThankYouSettings: () => void;
  onUpdateSubmissionLimits: (limits: any) => void;
  onSaveSubmissionLimits: () => void;
}

const FormSettingsContainer: React.FC<FormSettingsContainerProps> = ({
  form,
  settings,
  isSaving,
  errors,
  currentResponseCount = 0,
  onSaveGeneralSettings,
  onRegenerateShortUrl,
  onUpdateThankYouSetting,
  onSaveThankYouSettings,
  onUpdateSubmissionLimits,
  onSaveSubmissionLimits,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Get section from URL params, default to 'general'
  const selectedSection = searchParams.get('section') || 'general';

  // Function to handle section changes and update URL
  const handleSectionChange = (section: string) => {
    setSearchParams({ section });
  };

  const renderCurrentSection = () => {
    switch (selectedSection) {
      case 'general':
        return (
          <GeneralSettings
            form={form}
            errors={errors}
            isSaving={isSaving}
            onSave={onSaveGeneralSettings}
            onRegenerateShortUrl={onRegenerateShortUrl}
          />
        );
      
      case 'thank-you':
        return (
          <ThankYouSettings
            form={form}
            settings={settings.thankYou}
            isSaving={isSaving}
            onToggleEnabled={(enabled) => onUpdateThankYouSetting('enabled', enabled)}
            onMessageChange={(message) => onUpdateThankYouSetting('message', message)}
            onSave={onSaveThankYouSettings}
          />
        );
      
      case 'submission-limits':
        return (
          <SubmissionLimitsSettings
            settings={settings.submissionLimits || {}}
            isSaving={isSaving}
            currentResponseCount={currentResponseCount}
            onUpdateMaxResponses={(enabled, limit) => {
              onUpdateSubmissionLimits({
                ...settings.submissionLimits,
                maxResponses: enabled ? { enabled, limit } : { enabled: false }
              });
            }}
            onUpdateTimeWindow={(enabled, startDate, endDate) => {
              onUpdateSubmissionLimits({
                ...settings.submissionLimits,
                timeWindow: enabled ? { enabled, startDate, endDate } : { enabled: false }
              });
            }}
            onSave={onSaveSubmissionLimits}
          />
        );
      
      default:
        return (
          <Card>
            <CardContent className="p-12 text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Settings Configuration
              </h3>
              <p className="text-gray-600">
                This section is coming soon. Settings for this category will be
                available here.
              </p>
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <div className="flex h-full min-h-[600px]">
      {/* Left Sidebar */}
      <div className="w-80 border-r border-gray-200 bg-gray-50 p-6 overflow-y-auto">
        <SettingsSidebar
          selectedSection={selectedSection}
          onSectionChange={handleSectionChange}
        />
      </div>

      {/* Right Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          <div className="w-full">{renderCurrentSection()}</div>
        </div>
      </div>
    </div>
  );
};

export default FormSettingsContainer;