import React from 'react';
import { useSearchParams } from 'react-router';
import SettingsSidebar from './SettingsSidebar';
import GeneralSettings from './GeneralSettings';
import ThankYouSettings from './ThankYouSettings';
import SubmissionLimitsSettings from './SubmissionLimitsSettings';
import ResponseCopySettings from './ResponseCopySettings';

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
  onUpdateResponseCopySetting: (key: string, value: any) => void;
  onSaveResponseCopySettings: () => void;
}

const FormSettingsContainer: React.FC<FormSettingsContainerProps> = ({
  form, settings, isSaving, errors, currentResponseCount = 0,
  onSaveGeneralSettings, onRegenerateShortUrl, onUpdateThankYouSetting,
  onSaveThankYouSettings, onUpdateSubmissionLimits, onSaveSubmissionLimits,
  onUpdateResponseCopySetting, onSaveResponseCopySettings,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedSection = searchParams.get('section') || 'general';
  const handleSectionChange = (section: string) => setSearchParams({ section });

  const renderCurrentSection = () => {
    switch (selectedSection) {
      case 'general':
        return (
          <GeneralSettings
            form={form} errors={errors} isSaving={isSaving}
            onSave={onSaveGeneralSettings} onRegenerateShortUrl={onRegenerateShortUrl}
          />
        );
      case 'thank-you':
        return (
          <ThankYouSettings
            form={form} settings={settings.thankYou} isSaving={isSaving}
            onToggleEnabled={(enabled) => onUpdateThankYouSetting('enabled', enabled)}
            onMessageChange={(message) => onUpdateThankYouSetting('message', message)}
            onSave={onSaveThankYouSettings}
          />
        );
      case 'submission-limits':
        return (
          <SubmissionLimitsSettings
            settings={settings.submissionLimits || {}} isSaving={isSaving}
            currentResponseCount={currentResponseCount}
            onUpdateMaxResponses={(enabled, limit) => onUpdateSubmissionLimits({ ...settings.submissionLimits, maxResponses: enabled ? { enabled, limit } : { enabled: false } })}
            onUpdateTimeWindow={(enabled, startDate, endDate) => onUpdateSubmissionLimits({ ...settings.submissionLimits, timeWindow: enabled ? { enabled, startDate, endDate } : { enabled: false } })}
            onSave={onSaveSubmissionLimits}
          />
        );
      case 'response-copy':
        return (
          <ResponseCopySettings
            form={form} settings={settings.responseCopy} isSaving={isSaving}
            onUpdateSetting={onUpdateResponseCopySetting}
            onSave={onSaveResponseCopySettings}
          />
        );
      default:
        // Unknown section — fall back to general settings rather than a placeholder
        return (
          <GeneralSettings
            form={form} errors={errors} isSaving={isSaving}
            onSave={onSaveGeneralSettings} onRegenerateShortUrl={onRegenerateShortUrl}
          />
        );
    }
  };

  return (
    /* Typeform two-column layout: left nav + right content */
    <div className="flex min-h-[600px] rounded-xl overflow-hidden bg-white" style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}>
      {/* Left sidebar — Typeform settings nav */}
      <div className="w-56 shrink-0 p-5 overflow-y-auto" style={{ borderRight: '1px solid var(--tf-border-medium)', backgroundColor: '#faf9fb' }}>
        <SettingsSidebar selectedSection={selectedSection} onSectionChange={handleSectionChange} />
      </div>

      {/* Right content */}
      <div className="flex-1 overflow-y-auto p-6">
        {renderCurrentSection()}
      </div>
    </div>
  );
};

export default FormSettingsContainer;
