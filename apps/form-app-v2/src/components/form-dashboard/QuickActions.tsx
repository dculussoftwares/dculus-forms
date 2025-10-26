import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Database,
  LineChart,
  Plug,
  Settings,
  Users,
} from 'lucide-react';
import { useTranslate } from '../../i18n';

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
}

const ActionCard = ({
  title,
  description,
  icon: Icon,
  iconBg,
  iconColor,
  hoverColor,
  onClick,
}: ActionCardProps) => {
  return (
    <button
      onClick={onClick}
      className="group relative w-full rounded-2xl border border-border/70 bg-card p-6 text-left transition-all duration-300 hover:scale-[1.02] hover:border-primary/40 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
    >
      <div className="flex items-start gap-4">
        <div
          className={`${iconBg} rounded-xl p-3 transition-all duration-300 group-hover:scale-110`}
        >
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-base font-semibold">{title}</h3>
            <ArrowRight
              className={`h-4 w-4 text-muted-foreground transition-all duration-300 group-hover:translate-x-1 ${hoverColor}`}
            />
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </button>
  );
};

export const QuickActions = ({ formId }: QuickActionsProps) => {
  const t = useTranslate();
  const navigate = useNavigate();

  const actions = [
    {
      title: t('formDashboard.quickActions.collaborate.title'),
      description: t('formDashboard.quickActions.collaborate.description'),
      icon: Users,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      hoverColor: 'group-hover:text-emerald-600',
      path: `/dashboard/form/${formId}/collaborate`,
    },
    {
      title: t('formDashboard.quickActions.responses.title'),
      description: t('formDashboard.quickActions.responses.description'),
      icon: Database,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      hoverColor: 'group-hover:text-blue-600',
      path: `/dashboard/form/${formId}/responses`,
    },
    {
      title: t('formDashboard.quickActions.analytics.title'),
      description: t('formDashboard.quickActions.analytics.description'),
      icon: LineChart,
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
      hoverColor: 'group-hover:text-purple-600',
      path: `/dashboard/form/${formId}/analytics`,
    },
    {
      title: t('formDashboard.quickActions.plugins.title'),
      description: t('formDashboard.quickActions.plugins.description'),
      icon: Plug,
      iconBg: 'bg-orange-50',
      iconColor: 'text-orange-600',
      hoverColor: 'group-hover:text-orange-600',
      path: `/dashboard/form/${formId}/plugins`,
    },
    {
      title: t('formDashboard.quickActions.settings.title'),
      description: t('formDashboard.quickActions.settings.description'),
      icon: Settings,
      iconBg: 'bg-slate-50',
      iconColor: 'text-slate-600',
      hoverColor: 'group-hover:text-slate-600',
      path: `/dashboard/form/${formId}/settings`,
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="mb-1 text-xl font-semibold">
          {t('formDashboard.quickActions.sectionTitle')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('formDashboard.quickActions.sectionDescription')}
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
          />
        ))}
      </div>
    </div>
  );
};
