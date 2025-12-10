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
  hoverColor: string;
  onClick: () => void;
  testId?: string;
}

const ActionCard: React.FC<ActionCardProps> = ({
  title,
  description,
  icon: Icon,
  iconBg,
  iconColor,
  hoverColor,
  onClick,
  testId,
}) => {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      data-testid={testId}
      className="group relative text-left w-full h-auto rounded-2xl bg-white border-slate-200 p-6 transition-all duration-300 hover:shadow-xl hover:scale-[1.02] hover:border-slate-300 justify-start"
    >
      <div className="flex items-start gap-4 w-full">
        <div className={`${iconBg} p-3 rounded-xl transition-all duration-300 group-hover:scale-110`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-semibold text-slate-900">
              {title}
            </h3>
            <ArrowRight className={`w-4 h-4 text-slate-400 transition-all duration-300 group-hover:translate-x-1 ${hoverColor}`} />
          </div>
          <p className="text-sm text-slate-600">
            {description}
          </p>
        </div>
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
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      hoverColor: 'group-hover:text-emerald-600',
      path: `/dashboard/form/${formId}/collaborate`,
      testId: 'quick-action-collaborate',
    },
    {
      title: t('quickActions.items.responses.title'),
      description: t('quickActions.items.responses.description'),
      icon: Database,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      hoverColor: 'group-hover:text-blue-600',
      path: `/dashboard/form/${formId}/responses`,
      testId: 'quick-action-responses',
    },
    {
      title: t('quickActions.items.analytics.title'),
      description: t('quickActions.items.analytics.description'),
      icon: LineChart,
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
      hoverColor: 'group-hover:text-purple-600',
      path: `/dashboard/form/${formId}/analytics`,
      testId: 'quick-action-analytics',
    },
    {
      title: t('quickActions.items.plugins.title'),
      description: t('quickActions.items.plugins.description'),
      icon: Plug,
      iconBg: 'bg-orange-50',
      iconColor: 'text-orange-600',
      hoverColor: 'group-hover:text-orange-600',
      path: `/dashboard/form/${formId}/plugins`,
      testId: 'quick-action-plugins',
    },
    {
      title: t('quickActions.items.settings.title'),
      description: t('quickActions.items.settings.description'),
      icon: Settings,
      iconBg: 'bg-slate-50',
      iconColor: 'text-slate-600',
      hoverColor: 'group-hover:text-slate-600',
      path: `/dashboard/form/${formId}/settings`,
      testId: 'quick-action-settings',
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-1">
          {t('quickActions.heading')}
        </h2>
        <p className="text-sm text-slate-600">
          {t('quickActions.description')}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {actions.map((action) => (
          <ActionCard
            key={action.title}
            title={action.title}
            description={action.description}
            icon={action.icon}
            iconBg={action.iconBg}
            iconColor={action.iconColor}
            hoverColor={action.hoverColor}
            onClick={() => navigate(action.path)}
            testId={action.testId}
          />
        ))}
      </div>
    </div>
  );

};
