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
  RadioGroup,
  RadioGroupItem,
  Checkbox,
} from '@dculus/ui';
import { MainLayout } from '../components/MainLayout';
import { GET_FORM_BY_ID } from '../graphql/queries';
import { UPDATE_FORM, REGENERATE_SHORT_URL } from '../graphql/mutations';
import {
  Settings,
  Globe,
  Save,
  ArrowLeft,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  Monitor,
  CheckCircle,
  Calendar,
  Clock,
  Mail,
  Crown
} from 'lucide-react';
import { cn } from '@dculus/utils';

interface GeneralSetting {
  id: string;
  label: string;
  icon: React.ElementType;
}

const generalSettings: GeneralSetting[] = [
  { id: 'general', label: 'General Settings', icon: Globe },
  { id: 'thank-you', label: 'Thank You Page & Redirection', icon: CheckCircle },
];

const emailNotificationSettings = [
  { id: 'email-notifications', label: 'Email & Notifications', icon: Mail },
];

interface SettingsSidebarProps {
  selectedSection: string;
  onSectionChange: (section: string) => void;
}

const SettingsSidebar: React.FC<SettingsSidebarProps> = ({ selectedSection, onSectionChange }) => {
  const [collapsedSections] = useState<Set<string>>(new Set(['email-notifications']));

  const SidebarSection = ({ 
    settings, 
    title 
  }: { 
    settings: GeneralSetting[]; 
    title: string;
  }) => (
    <div className="mb-6">
      <h3 className="text-sm font-medium text-gray-900 mb-3">{title}</h3>
      <div className="space-y-1">
        {settings.map((setting) => {
          const isSelected = selectedSection === setting.id;
          const Icon = setting.icon;
          
          return (
            <div key={setting.id}>
              <button
                onClick={() => onSectionChange(setting.id)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors",
                  isSelected
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                <div className="flex items-center space-x-3">
                  <Icon className="w-4 h-4" />
                  <span>{setting.label}</span>
                </div>
                {setting.id !== 'general' && (
                  <ChevronDown 
                    className={cn(
                      "w-4 h-4 transition-transform",
                      collapsedSections.has(setting.id) ? "-rotate-90" : ""
                    )}
                  />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      <SidebarSection settings={generalSettings} title="General" />
      <SidebarSection settings={emailNotificationSettings} title="Email & Notifications" />
    </>
  );
};

const FormSettings: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [selectedSection, setSelectedSection] = useState('general');

  // Comprehensive settings state
  const [settings, setSettings] = useState({
    // Display Settings
    display: {
      theme: 'light',
      showProgressBar: true,
      showPageNumbers: true,
      responseValidation: 'on-submit',
      customCss: '',
      favicon: '',
    },
    // Thank You Page Settings
    thankYou: {
      mode: 'thank-you-page',
      textType: 'plain',
      message: 'Thank you! Your response has been submitted.',
      includeAnotherResponse: true,
      includePdfDownload: false,
      includeAnalytics: false,
      redirectUrl: '',
      splashMessage: '',
    },
    // Date & Time Settings
    dateTime: {
      timezone: 'America/New_York',
      dateFormat: 'MM/DD/YYYY',
      timeFormat: '12-hour',
      startDate: '',
      endDate: '',
    },
    // Form Availability Settings
    availability: {
      isActive: true,
      schedulingEnabled: false,
      startDateTime: '',
      endDateTime: '',
      maxResponses: '',
      limitResponses: false,
      closedMessage: 'This form is currently closed.',
    },
    // SMTP Settings
    smtp: {
      enabled: false,
      host: '',
      port: '587',
      username: '',
      password: '',
      encryption: 'tls',
      fromEmail: '',
      fromName: '',
    },
    // Email Notifications
    notifications: {
      submitNotification: true,
      adminEmail: '',
      responseEmail: true,
      customSubject: '',
      customMessage: '',
    },
  });

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

  // Helper function to update nested settings
  const updateSetting = (section: string, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [key]: value
      }
    }));
  };

  // Render functions for different settings sections
  const renderDisplaySettings = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Monitor className="mr-2 h-5 w-5" />
          Display Settings
        </CardTitle>
        <CardDescription>
          Configure the visual appearance and behavior of your form
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label className="text-sm font-medium mb-3 block">Form Theme</Label>
          <RadioGroup
            value={settings.display.theme}
            onValueChange={(value) => updateSetting('display', 'theme', value)}
            className="flex flex-col gap-2"
          >
            {['light', 'dark', 'auto'].map((theme) => (
              <div key={theme} className="flex items-center gap-3">
                <RadioGroupItem
                  value={theme}
                  id={`theme-${theme}`}
                />
                <Label htmlFor={`theme-${theme}`} className="text-sm capitalize cursor-pointer">
                  {theme === 'auto' ? 'Auto (System Preference)' : `${theme} Theme`}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="show-progress"
              checked={settings.display.showProgressBar}
              onChange={(e) => updateSetting('display', 'showProgressBar', e.target.checked)}
              className="w-4 h-4 text-green-600 focus:ring-green-500 rounded"
            />
            <Label htmlFor="show-progress" className="text-sm">
              Show progress bar for multi-page forms
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="show-page-numbers"
              checked={settings.display.showPageNumbers}
              onChange={(e) => updateSetting('display', 'showPageNumbers', e.target.checked)}
              className="w-4 h-4 text-green-600 focus:ring-green-500 rounded"
            />
            <Label htmlFor="show-page-numbers" className="text-sm">
              Show page numbers
            </Label>
          </div>
        </div>

        <div>
          <Label className="text-sm font-medium mb-3 block">Response Validation</Label>
          <div className="flex flex-col space-y-2">
            {[
              { value: 'on-submit', label: 'Validate on submit' },
              { value: 'real-time', label: 'Real-time validation' }
            ].map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <input
                  type="radio"
                  id={`validation-${option.value}`}
                  name="validation"
                  value={option.value}
                  checked={settings.display.responseValidation === option.value}
                  onChange={(e) => updateSetting('display', 'responseValidation', e.target.value)}
                  className="w-4 h-4 text-green-600 focus:ring-green-500"
                />
                <Label htmlFor={`validation-${option.value}`} className="text-sm">
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="custom-css" className="text-sm font-medium">Custom CSS</Label>
          <Textarea
            id="custom-css"
            value={settings.display.customCss}
            onChange={(e) => updateSetting('display', 'customCss', e.target.value)}
            placeholder="Enter custom CSS to style your form..."
            rows={4}
            className="font-mono text-sm"
          />
        </div>

        <div className="pt-4">
          <Button className="bg-green-600 hover:bg-green-700 text-white">
            Save Display Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderThankYouSettings = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <CheckCircle className="mr-2 h-5 w-5" />
          Thank You Page & Redirection
        </CardTitle>
        <CardDescription>
          Configure what happens after form submission
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <RadioGroup
          value={settings.thankYou.mode}
          onValueChange={(value) => updateSetting('thankYou', 'mode', value)}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <RadioGroupItem
                value="thank-you-page"
                id="thank-you-page"
              />
              <Label htmlFor="thank-you-page" className="text-sm font-medium cursor-pointer">
                Thank You Page
              </Label>
            </div>
            <p className="text-sm text-gray-600 ml-7">
              Customize your Thank You page message.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <RadioGroupItem
                value="redirect"
                id="redirect-to"
              />
              <Label htmlFor="redirect-to" className="text-sm font-medium flex items-center cursor-pointer">
                Redirect To
                <Crown className="w-4 h-4 ml-1 text-yellow-500" />
              </Label>
            </div>
          </div>
        </RadioGroup>

        {settings.thankYou.mode === 'thank-you-page' && (
          <div className="ml-7 space-y-4">
            <RadioGroup
              value={settings.thankYou.textType}
              onValueChange={(value) => updateSetting('thankYou', 'textType', value)}
              className="flex items-center gap-6"
            >
              {[
                { value: 'plain', label: 'Plain Text' },
                { value: 'rich', label: 'Rich Text', premium: true }
              ].map((type) => (
                <div key={type.value} className="flex items-center gap-3">
                  <RadioGroupItem
                    value={type.value}
                    id={`text-${type.value}`}
                  />
                  <Label htmlFor={`text-${type.value}`} className="text-sm flex items-center cursor-pointer">
                    {type.label}
                    {type.premium && <Crown className="w-4 h-4 ml-1 text-yellow-500" />}
                  </Label>
                </div>
              ))}
            </RadioGroup>

            <div className="space-y-2">
              <Textarea
                value={settings.thankYou.message}
                onChange={(e) => updateSetting('thankYou', 'message', e.target.value)}
                placeholder="Thank you! Your response has been submitted."
                className="min-h-[80px]"
              />
              <p className="text-xs text-gray-500">(Maximum 100 characters)</p>
            </div>

            <div className="space-y-3">
              {[
                { key: 'includeAnotherResponse', label: 'Include a link to allow respondents to add another response.' },
                { key: 'includePdfDownload', label: 'Include a link to download PDF of submitted response in the Thank You Page.' },
                { key: 'includeAnalytics', label: 'Add Google Analytics or Facebook Pixel tracking code.' }
              ].map((option) => (
                <div key={option.key} className="flex items-center gap-3">
                  <Checkbox
                    id={option.key}
                    checked={settings.thankYou[option.key as keyof typeof settings.thankYou] as boolean}
                    onCheckedChange={(checked) => updateSetting('thankYou', option.key, checked)}
                  />
                  <Label htmlFor={option.key} className="text-sm cursor-pointer">
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )}

        {settings.thankYou.mode === 'redirect' && (
          <div className="ml-7 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="redirect-url" className="text-sm font-medium">Redirect URL</Label>
              <Input
                id="redirect-url"
                value={settings.thankYou.redirectUrl}
                onChange={(e) => updateSetting('thankYou', 'redirectUrl', e.target.value)}
                placeholder="https://example.com/thank-you"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="splash-message" className="text-sm font-medium">Splash Message</Label>
              <Input
                id="splash-message"
                value={settings.thankYou.splashMessage}
                onChange={(e) => updateSetting('thankYou', 'splashMessage', e.target.value)}
                placeholder="Enter the splash message."
              />
              <p className="text-xs text-gray-500">(Maximum 100 characters)</p>
            </div>
          </div>
        )}

        <div className="pt-4">
          <Button className="bg-green-600 hover:bg-green-700 text-white">
            Save Thank You Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderDateTimeSettings = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Calendar className="mr-2 h-5 w-5" />
          Date & Time Settings
        </CardTitle>
        <CardDescription>
          Configure timezone and date/time formatting
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="timezone" className="text-sm font-medium block mb-2">Timezone</Label>
          <select
            id="timezone"
            value={settings.dateTime.timezone}
            onChange={(e) => updateSetting('dateTime', 'timezone', e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="America/New_York">Eastern Time (UTC-5)</option>
            <option value="America/Chicago">Central Time (UTC-6)</option>
            <option value="America/Denver">Mountain Time (UTC-7)</option>
            <option value="America/Los_Angeles">Pacific Time (UTC-8)</option>
            <option value="UTC">UTC (UTC+0)</option>
            <option value="Europe/London">London (UTC+0)</option>
            <option value="Europe/Paris">Paris (UTC+1)</option>
            <option value="Asia/Tokyo">Tokyo (UTC+9)</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="date-format" className="text-sm font-medium block mb-2">Date Format</Label>
            <select
              id="date-format"
              value={settings.dateTime.dateFormat}
              onChange={(e) => updateSetting('dateTime', 'dateFormat', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              <option value="MM-DD-YYYY">MM-DD-YYYY</option>
            </select>
          </div>

          <div>
            <Label htmlFor="time-format" className="text-sm font-medium block mb-2">Time Format</Label>
            <select
              id="time-format"
              value={settings.dateTime.timeFormat}
              onChange={(e) => updateSetting('dateTime', 'timeFormat', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="12-hour">12-hour (AM/PM)</option>
              <option value="24-hour">24-hour</option>
            </select>
          </div>
        </div>

        <div className="pt-4">
          <Button className="bg-green-600 hover:bg-green-700 text-white">
            Save Date & Time Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderAvailabilitySettings = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Clock className="mr-2 h-5 w-5" />
          Form Availability
        </CardTitle>
        <CardDescription>
          Control when your form is available and response limits
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="form-active"
            checked={settings.availability.isActive}
            onChange={(e) => updateSetting('availability', 'isActive', e.target.checked)}
            className="w-4 h-4 text-green-600 focus:ring-green-500 rounded"
          />
          <Label htmlFor="form-active" className="text-sm font-medium">
            Form is currently active and accepting responses
          </Label>
        </div>

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="enable-scheduling"
              checked={settings.availability.schedulingEnabled}
              onChange={(e) => updateSetting('availability', 'schedulingEnabled', e.target.checked)}
              className="w-4 h-4 text-green-600 focus:ring-green-500 rounded"
            />
            <Label htmlFor="enable-scheduling" className="text-sm font-medium">
              Enable form scheduling
            </Label>
          </div>

          {settings.availability.schedulingEnabled && (
            <div className="ml-6 grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start-datetime" className="text-sm font-medium block mb-2">Start Date & Time</Label>
                <Input
                  id="start-datetime"
                  type="datetime-local"
                  value={settings.availability.startDateTime}
                  onChange={(e) => updateSetting('availability', 'startDateTime', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="end-datetime" className="text-sm font-medium block mb-2">End Date & Time</Label>
                <Input
                  id="end-datetime"
                  type="datetime-local"
                  value={settings.availability.endDateTime}
                  onChange={(e) => updateSetting('availability', 'endDateTime', e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="limit-responses"
              checked={settings.availability.limitResponses}
              onChange={(e) => updateSetting('availability', 'limitResponses', e.target.checked)}
              className="w-4 h-4 text-green-600 focus:ring-green-500 rounded"
            />
            <Label htmlFor="limit-responses" className="text-sm font-medium">
              Limit number of responses
            </Label>
          </div>

          {settings.availability.limitResponses && (
            <div className="ml-6">
              <Label htmlFor="max-responses" className="text-sm font-medium block mb-2">Maximum Responses</Label>
              <Input
                id="max-responses"
                type="number"
                value={settings.availability.maxResponses}
                onChange={(e) => updateSetting('availability', 'maxResponses', e.target.value)}
                placeholder="Enter maximum number of responses"
                className="w-48"
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="closed-message" className="text-sm font-medium">Message when form is closed</Label>
          <Textarea
            id="closed-message"
            value={settings.availability.closedMessage}
            onChange={(e) => updateSetting('availability', 'closedMessage', e.target.value)}
            placeholder="This form is currently closed."
            rows={3}
          />
        </div>

        <div className="pt-4">
          <Button className="bg-green-600 hover:bg-green-700 text-white">
            Save Availability Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderSMTPSettings = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Mail className="mr-2 h-5 w-5" />
          SMTP Configuration
        </CardTitle>
        <CardDescription>
          Configure email server settings for form notifications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="smtp-enabled"
            checked={settings.smtp.enabled}
            onChange={(e) => updateSetting('smtp', 'enabled', e.target.checked)}
            className="w-4 h-4 text-green-600 focus:ring-green-500 rounded"
          />
          <Label htmlFor="smtp-enabled" className="text-sm font-medium">
            Enable SMTP email sending
          </Label>
        </div>

        {settings.smtp.enabled && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smtp-host" className="text-sm font-medium">SMTP Host</Label>
                <Input
                  id="smtp-host"
                  value={settings.smtp.host}
                  onChange={(e) => updateSetting('smtp', 'host', e.target.value)}
                  placeholder="smtp.gmail.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp-port" className="text-sm font-medium">Port</Label>
                <Input
                  id="smtp-port"
                  value={settings.smtp.port}
                  onChange={(e) => updateSetting('smtp', 'port', e.target.value)}
                  placeholder="587"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smtp-username" className="text-sm font-medium">Username</Label>
                <Input
                  id="smtp-username"
                  value={settings.smtp.username}
                  onChange={(e) => updateSetting('smtp', 'username', e.target.value)}
                  placeholder="your-email@gmail.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp-password" className="text-sm font-medium">Password</Label>
                <Input
                  id="smtp-password"
                  type="password"
                  value={settings.smtp.password}
                  onChange={(e) => updateSetting('smtp', 'password', e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp-encryption" className="text-sm font-medium">Encryption</Label>
              <select
                id="smtp-encryption"
                value={settings.smtp.encryption}
                onChange={(e) => updateSetting('smtp', 'encryption', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="tls">TLS</option>
                <option value="ssl">SSL</option>
                <option value="none">None</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="from-email" className="text-sm font-medium">From Email</Label>
                <Input
                  id="from-email"
                  value={settings.smtp.fromEmail}
                  onChange={(e) => updateSetting('smtp', 'fromEmail', e.target.value)}
                  placeholder="noreply@yourdomain.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="from-name" className="text-sm font-medium">From Name</Label>
                <Input
                  id="from-name"
                  value={settings.smtp.fromName}
                  onChange={(e) => updateSetting('smtp', 'fromName', e.target.value)}
                  placeholder="Your Organization"
                />
              </div>
            </div>
          </>
        )}

        <div className="pt-4 flex space-x-3">
          <Button className="bg-green-600 hover:bg-green-700 text-white">
            Save SMTP Settings
          </Button>
          {settings.smtp.enabled && (
            <Button variant="outline">
              Test Connection
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const renderCurrentSection = () => {
    switch (selectedSection) {
      case 'general':
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
              <div className="pt-4">
                <Button onClick={handleSaveChanges} disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-white">
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      case 'display':
        return renderDisplaySettings();
      case 'thank-you':
        return renderThankYouSettings();
      case 'date-time':
        return renderDateTimeSettings();
      case 'form-availability':
        return renderAvailabilitySettings();
      case 'smtp':
        return renderSMTPSettings();
      default:
        return (
          <Card>
            <CardContent className="p-12 text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {generalSettings.find(s => s.id === selectedSection)?.label || 'Settings'} Configuration
              </h3>
              <p className="text-gray-600">
                This section is coming soon. Settings for this category will be available here.
              </p>
            </CardContent>
          </Card>
        );
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
      <div className="px-4 py-8 space-y-8">
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
        </div>

        <Separator />

        {/* Settings Layout with Sidebar */}
        <div className="flex h-full min-h-[600px]">
          {/* Left Sidebar */}
          <div className="w-80 border-r border-gray-200 bg-gray-50 p-6 overflow-y-auto">
            <SettingsSidebar selectedSection={selectedSection} onSectionChange={setSelectedSection} />
          </div>

          {/* Right Content Area */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              <div className="w-full">
                {renderCurrentSection()}
              </div>
            </div>
          </div>
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

      </div>
    </MainLayout>
  );
};

export default FormSettings;