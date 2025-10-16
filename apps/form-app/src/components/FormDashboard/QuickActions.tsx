import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Database,
  LineChart,
  Settings,
  ArrowRight,
} from 'lucide-react';

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

const ActionCard: React.FC<ActionCardProps> = ({
  title,
  description,
  icon: Icon,
  iconBg,
  iconColor,
  hoverColor,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className="group relative text-left w-full rounded-2xl bg-white border border-slate-200 p-6 transition-all duration-300 hover:shadow-xl hover:scale-[1.02] hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400"
    >
      <div className="flex items-start gap-4">
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
    </button>
  );
};

export const QuickActions: React.FC<QuickActionsProps> = ({ formId }) => {
  const navigate = useNavigate();

  const actions = [
    {
      title: 'Collaborate',
      description: 'Real-time collaborative editing',
      icon: Users,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      hoverColor: 'group-hover:text-emerald-600',
      path: `/dashboard/form/${formId}/collaborate`,
    },
    {
      title: 'Responses',
      description: 'View and manage all submissions',
      icon: Database,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      hoverColor: 'group-hover:text-blue-600',
      path: `/dashboard/form/${formId}/responses`,
    },
    {
      title: 'Analytics',
      description: 'Detailed insights and reports',
      icon: LineChart,
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
      hoverColor: 'group-hover:text-purple-600',
      path: `/dashboard/form/${formId}/analytics`,
    },
    {
      title: 'Settings',
      description: 'Configure form preferences',
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
        <h2 className="text-xl font-semibold text-slate-900 mb-1">
          Quick Actions
        </h2>
        <p className="text-sm text-slate-600">
          Manage your form with powerful tools
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