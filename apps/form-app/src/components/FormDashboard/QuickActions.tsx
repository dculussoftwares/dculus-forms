import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Database, LineChart, Settings, ArrowRight, Plug } from 'lucide-react';
import { Button } from '@dculus/ui';
import { useTranslation } from '../../hooks/useTranslation';

interface QuickActionsProps {
  formId: string;
}

interface ActionCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  onClick: () => void;
  testId?: string;
}

const ActionCard: React.FC<ActionCardProps> = ({
  title, description, icon: Icon, iconBg, iconColor, onClick, testId,
}) => {
  return (
    <Button
      variant="ghost"
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="group flex flex-col items-center gap-3 p-5 rounded-xl bg-white dark:bg-card text-center w-full transition-all duration-200 h-auto"
      style={{
        border: '1px solid rgba(81,76,84,0.10)',
        boxShadow: '0 1px 4px rgba(60,50,62,0.06)',
      }}
    >
      {/* Typeform field-icon style */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-105"
        style={{ backgroundColor: iconBg }}
      >
        <Icon className="w-5 h-5" style={{ color: iconColor }} />
      </div>

      <div className="flex-1 min-w-0 w-full">
        <div className="flex items-center justify-center gap-1">
          <span className="text-sm font-medium text-[#3c323e]">
            {title}
          </span>
          <ArrowRight
            className="w-3.5 h-3.5 opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 text-[#655d67]"
          />
        </div>
        <p className="text-xs mt-0.5 leading-snug text-[#655d67]">
          {description}
        </p>
      </div>
    </Button>
  );
};

export const QuickActions: React.FC<QuickActionsProps> = ({ formId }) => {
  const navigate = useNavigate();
  const { t } = useTranslation('formDashboard');

  const actions = [
    {
      title: t('quickActions.items.collaborate.title'),
      description: t('quickActions.items.collaborate.description'),
      icon: Users,
      iconBg: '#f8cdd8',    // salmon — Typeform address/location icon color
      iconColor: '#3c323e',
      path: `/dashboard/form/${formId}/collaborate`,
      testId: 'quick-action-collaborate',
    },
    {
      title: t('quickActions.items.responses.title'),
      description: t('quickActions.items.responses.description'),
      icon: Database,
      iconBg: '#f4faf8',    // teal — Typeform clock/time icon color
      iconColor: '#177767',
      path: `/dashboard/form/${formId}/responses`,
      testId: 'quick-action-responses',
    },
    {
      title: t('quickActions.items.analytics.title'),
      description: t('quickActions.items.analytics.description'),
      icon: LineChart,
      iconBg: '#ddd6fa',    // lavender — Typeform rating icon color
      iconColor: '#5c2e6b',
      path: `/dashboard/form/${formId}/analytics`,
      testId: 'quick-action-analytics',
    },
    {
      title: t('quickActions.items.plugins.title'),
      description: t('quickActions.items.plugins.description'),
      icon: Plug,
      iconBg: '#dedcde',    // neutral gray — Typeform generic icon color
      iconColor: '#4c414e',
      path: `/dashboard/form/${formId}/plugins`,
      testId: 'quick-action-plugins',
    },
    {
      title: t('quickActions.items.settings.title'),
      description: t('quickActions.items.settings.description'),
      icon: Settings,
      iconBg: 'rgba(81,76,84,0.07)',
      iconColor: '#655d67',
      path: `/dashboard/form/${formId}/settings`,
      testId: 'quick-action-settings',
    },
  ];

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-[#3c323e]">
          {t('quickActions.heading')}
        </h2>
        <p className="text-xs mt-0.5 text-[#655d67]">
          {t('quickActions.description')}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {actions.map((action) => (
          <ActionCard
            key={action.title}
            title={action.title}
            description={action.description}
            icon={action.icon}
            iconBg={action.iconBg}
            iconColor={action.iconColor}
            onClick={() => navigate(action.path)}
            testId={action.testId}
          />
        ))}
      </div>
    </div>
  );
};
