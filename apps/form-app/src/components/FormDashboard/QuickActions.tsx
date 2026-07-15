import React from 'react';
import { useNavigate } from 'react-router';
import { PencilLine, Database, LineChart, Settings, ArrowRight, Plug, FileText } from 'lucide-react';
import AIIcon from '../icons/AIIcon';
import { Button } from '@dculus/ui';
import { useTranslation } from '../../hooks/useTranslation';

interface QuickActionsProps {
  formId: string;
  isFormEmpty?: boolean;
}

interface ActionCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  onClick: () => void;
  testId?: string;
  highlight?: boolean;
  badge?: string;
}

const ActionCard: React.FC<ActionCardProps> = ({
  title, description, icon: Icon, iconBg, iconColor, onClick, testId, highlight, badge,
}) => {
  return (
    <Button
      variant="ghost"
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="group flex flex-col items-center gap-3 p-5 rounded-xl bg-white dark:bg-card text-center w-full transition-all duration-200 h-auto relative"
      style={{
        border: highlight
          ? '1.5px solid rgba(59,130,246,0.35)'
          : '1px solid var(--tf-border-medium)',
        boxShadow: highlight
          ? '0 1px 8px rgba(59,130,246,0.10)'
          : '0 1px 4px var(--tf-overlay)',
      }}
    >
      {badge && (
        <span
          className="absolute top-2.5 right-2.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold leading-none"
          style={{ backgroundColor: 'rgba(59,130,246,0.12)', color: 'rgb(37,99,235)' }}
        >
          <AIIcon className="w-2.5 h-2.5" />
          {badge}
        </span>
      )}

      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-105"
        style={{ backgroundColor: iconBg }}
      >
        <Icon className="w-5 h-5" style={{ color: iconColor }} />
      </div>

      <div className="flex-1 min-w-0 w-full">
        <div className="flex items-center justify-center gap-1">
          <span className={`text-sm font-medium ${highlight ? 'text-blue-600 dark:text-blue-400' : 'text-primary'}`}>
            {title}
          </span>
          <ArrowRight
            className="w-3.5 h-3.5 opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 text-muted-foreground"
          />
        </div>
        <p className="text-xs mt-0.5 leading-snug text-muted-foreground line-clamp-2">
          {description}
        </p>
      </div>
    </Button>
  );
};

export const QuickActions: React.FC<QuickActionsProps> = ({ formId, isFormEmpty }) => {
  const navigate = useNavigate();
  const { t } = useTranslation('formDashboard');

  const actions = [
    {
      title: t('quickActions.items.collaborate.title'),
      description: t('quickActions.items.collaborate.description'),
      icon: PencilLine,
      iconBg: 'rgba(59,130,246,0.12)',
      iconColor: 'rgb(37,99,235)',
      path: `/dashboard/form/${formId}/builder`,
      testId: 'quick-action-builder',
      highlight: true,
      badge: isFormEmpty ? t('quickActions.startHereBadge') : undefined,
    },
    {
      title: t('quickActions.items.responses.title'),
      description: t('quickActions.items.responses.description'),
      icon: Database,
      iconBg: 'var(--tf-icon-teal)',    // teal — Typeform clock/time icon color
      iconColor: 'var(--tf-green)',
      path: `/dashboard/form/${formId}/responses`,
      testId: 'quick-action-responses',
    },
    {
      title: t('quickActions.items.analytics.title'),
      description: t('quickActions.items.analytics.description'),
      icon: LineChart,
      iconBg: 'var(--tf-icon-lavender)',    // lavender — Typeform rating icon color
      iconColor: '#5c2e6b',
      path: `/dashboard/form/${formId}/analytics`,
      testId: 'quick-action-analytics',
    },
    {
      title: t('quickActions.items.plugins.title'),
      description: t('quickActions.items.plugins.description'),
      icon: Plug,
      iconBg: '#fbe19d',    // yellow — Typeform number-field icon color
      iconColor: '#8b6a18',
      path: `/dashboard/form/${formId}/integrations`,
      testId: 'quick-action-integrations',
    },
    {
      title: t('quickActions.items.pdfTemplates.title'),
      description: t('quickActions.items.pdfTemplates.description'),
      icon: FileText,
      iconBg: 'rgba(220,38,38,0.08)',    // soft red — PDF association
      iconColor: 'rgb(185,28,28)',
      path: `/dashboard/form/${formId}/pdf-templates`,
      testId: 'quick-action-pdf-templates',
    },
    {
      title: t('quickActions.items.settings.title'),
      description: t('quickActions.items.settings.description'),
      icon: Settings,
      iconBg: '#c4e3ba',    // green — Typeform opinion-scale icon color
      iconColor: '#2d6236',
      path: `/dashboard/form/${formId}/settings`,
      testId: 'quick-action-settings',
    },
  ];

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-primary">
          {t('quickActions.heading')}
        </h2>
        <p className="text-xs mt-0.5 text-muted-foreground">
          {t('quickActions.description')}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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
            highlight={'highlight' in action ? action.highlight : undefined}
            badge={'badge' in action ? action.badge : undefined}
          />
        ))}
      </div>
    </div>
  );
};
