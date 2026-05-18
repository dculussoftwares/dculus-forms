import React from 'react';
import { useSearchParams } from 'react-router-dom';
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
  form, settings, isSaving, errors, currentResponseCount = 0,
  onSaveGeneralSettings, onRegenerateShortUrl, onUpdateThankYouSetting,
  onSaveThankYouSettings, onUpdateSubmissionLimits, onSaveSubmissionLimits,
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
      default:
        return (
          <div className="rounded-xl p-10 text-center bg-white" style={{ border: '1px solid rgba(81,76,84,0.10)' }}>
            <h3 className="text-sm font-medium mb-1 text-[#3c323e]">Settings Configuration</h3>
            <p className="text-xs text-[#655d67]">This section is coming soon.</p>
          </div>
        );
    }
  };

  return (
    /* Typeform two-column layout: left nav + right content */
    <div className="flex min-h-[600px] rounded-xl overflow-hidden bg-white" style={{ border: '1px solid rgba(81,76,84,0.10)', boxShadow: '0 1px 4px rgba(60,50,62,0.06)' }}>
      {/* Left sidebar — Typeform settings nav */}
      <div className="w-56 shrink-0 p-5 overflow-y-auto" style={{ borderRight: '1px solid rgba(81,76,84,0.10)', backgroundColor: '#faf9fb' }}>
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
