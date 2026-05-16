import React from 'react';
import { CheckCircle, Globe, Mail, Shield } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface SettingsSidebarProps {
  selectedSection: string;
  onSectionChange: (section: string) => void;
}

const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  selectedSection,
  onSectionChange,
}) => {
  const { t } = useTranslation('formSettings');

  const sections: { title: string; items: SidebarItem[] }[] = [
    {
      title: t('sidebar.sections.general'),
      items: [
        { id: 'general', label: t('sidebar.settings.general'), icon: Globe },
        { id: 'thank-you', label: t('sidebar.settings.thankYou'), icon: CheckCircle },
        { id: 'submission-limits', label: t('sidebar.settings.submissionLimits'), icon: Shield },
      ],
    },
    {
      title: t('sidebar.sections.emailNotifications'),
      items: [
        { id: 'email-notifications', label: t('sidebar.settings.emailNotifications'), icon: Mail },
      ],
    },
  ];

  return (
    <nav className="space-y-6">
      {sections.map(({ title, items }) => (
        <div key={title}>
          {/* Section label — Typeform "Account" style */}
          <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#655d67' }}>
            {title}
          </p>
          <div className="space-y-0.5">
            {items.map(({ id, label }) => {
              const isActive = selectedSection === id;
              return (
                <button
                  key={id}
                  onClick={() => onSectionChange(id)}
                  data-testid={`settings-section-${id}`}
                  className="w-full flex items-center px-3 py-2 rounded-lg text-sm font-medium text-left transition-colors"
                  style={{
                    backgroundColor: isActive ? 'rgba(87,84,91,0.06)' : 'transparent',
                    color: isActive ? '#3c323e' : '#655d67',
                  }}
                  onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(87,84,91,0.04)'; (e.currentTarget as HTMLElement).style.color = '#4c414e'; } }}
                  onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#655d67'; } }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
};

export default SettingsSidebar;
