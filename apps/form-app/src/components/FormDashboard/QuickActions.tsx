import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Database,
  LineChart,
  Settings,
  ArrowRight,
  Plug,
} from 'lucide-react';
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
  title,
  description,
  icon: Icon,
  iconBg,
  iconColor,
  onClick,
  testId,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="group flex flex-col items-center gap-3 p-5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all duration-200 text-center w-full dark:bg-slate-900 dark:border-slate-800 dark:hover:border-slate-700"
    >
      <div className={`${iconBg} p-3 rounded-xl transition-transform duration-200 group-hover:scale-110`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0 w-full">
        <div className="flex items-center justify-center gap-1.5">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {title}
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400 opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0" />
        </div>
        <p className="text-xs text-slate-500 mt-0.5 leading-snug dark:text-slate-400">
          {description}
        </p>
      </div>
    </button>
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
      iconBg: 'bg-primary/10 dark:bg-primary/20',
      iconColor: 'text-primary dark:text-primary',
      path: `/dashboard/form/${formId}/collaborate`,
      testId: 'quick-action-collaborate',
    },
    {
      title: t('quickActions.items.responses.title'),
      description: t('quickActions.items.responses.description'),
      icon: Database,
      iconBg: 'bg-blue-50 dark:bg-blue-950',
      iconColor: 'text-blue-600 dark:text-blue-400',
      path: `/dashboard/form/${formId}/responses`,
      testId: 'quick-action-responses',
    },
    {
      title: t('quickActions.items.analytics.title'),
      description: t('quickActions.items.analytics.description'),
      icon: LineChart,
      iconBg: 'bg-purple-50 dark:bg-purple-950',
      iconColor: 'text-purple-600 dark:text-purple-400',
      path: `/dashboard/form/${formId}/analytics`,
      testId: 'quick-action-analytics',
    },
    {
      title: t('quickActions.items.plugins.title'),
      description: t('quickActions.items.plugins.description'),
      icon: Plug,
      iconBg: 'bg-orange-50 dark:bg-orange-950',
      iconColor: 'text-orange-600 dark:text-orange-400',
      path: `/dashboard/form/${formId}/plugins`,
      testId: 'quick-action-plugins',
    },
    {
      title: t('quickActions.items.settings.title'),
      description: t('quickActions.items.settings.description'),
      icon: Settings,
      iconBg: 'bg-slate-100 dark:bg-slate-800',
      iconColor: 'text-slate-600 dark:text-slate-400',
      path: `/dashboard/form/${formId}/settings`,
      testId: 'quick-action-settings',
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {t('quickActions.heading')}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
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
