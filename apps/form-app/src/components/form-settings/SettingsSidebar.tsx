import React, { useState } from 'react';
import { CheckCircle, ChevronDown, Globe, Mail, Shield } from 'lucide-react';
import { Button } from '@dculus/ui';
import { cn } from '@dculus/utils';

interface GeneralSetting {
  id: string;
  label: string;
  icon: React.ElementType;
}

const generalSettings: GeneralSetting[] = [
  { id: 'general', label: 'General Settings', icon: Globe },
  { id: 'thank-you', label: 'Thank You Page', icon: CheckCircle },
  { id: 'submission-limits', label: 'Submission Limits', icon: Shield },
];

const emailNotificationSettings = [
  { id: 'email-notifications', label: 'Email & Notifications', icon: Mail },
];

interface SettingsSidebarProps {
  selectedSection: string;
  onSectionChange: (section: string) => void;
}

const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  selectedSection,
  onSectionChange,
}) => {
  const [collapsedSections] = useState<Set<string>>(
    new Set(['email-notifications'])
  );

  const SidebarSection = ({
    settings,
    title,
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
              <Button
                variant="ghost"
                onClick={() => onSectionChange(setting.id)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 h-auto text-sm rounded-lg',
                  isSelected
                    ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-50 hover:text-green-700'
                    : 'text-gray-700'
                )}
              >
                <div className="flex items-center space-x-3">
                  <Icon className="w-4 h-4" />
                  <span>{setting.label}</span>
                </div>
                {setting.id !== 'general' && (
                  <ChevronDown
                    className={cn(
                      'w-4 h-4 transition-transform',
                      collapsedSections.has(setting.id) ? '-rotate-90' : ''
                    )}
                  />
                )}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      <SidebarSection settings={generalSettings} title="General" />
      <SidebarSection
        settings={emailNotificationSettings}
        title="Email & Notifications"
      />
    </>
  );
};

export default SettingsSidebar;