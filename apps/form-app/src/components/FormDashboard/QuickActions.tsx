import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TypographyH3,
  TypographyP,
  Card,
  CardContent,
  Button,
} from '@dculus/ui';
import {
  Users,
  Database,
  LineChart,
  Puzzle,
  Settings,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface QuickActionsProps {
  formId: string;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ formId }) => {
  const navigate = useNavigate();

  const actions = [
    {
      title: 'Collaborate',
      description: 'Real-time collaborative editing',
      icon: Users,
      color: 'green',
      path: `/dashboard/form/${formId}/collaborate`,
    },
    {
      title: 'Responses',
      description: 'View and manage all submissions',
      icon: Database,
      color: 'orange',
      path: `/dashboard/form/${formId}/responses`,
    },
    {
      title: 'Analytics',
      description: 'Detailed insights and reports',
      icon: LineChart,
      color: 'teal',
      path: `/dashboard/form/${formId}/analytics`,
    },
    {
      title: 'Plugins',
      description: 'Extend with integrations',
      icon: Puzzle,
      color: 'purple',
      path: `/dashboard/form/${formId}/plugins`,
    },
    {
      title: 'Settings',
      description: 'Configure form preferences',
      icon: Settings,
      color: 'slate',
      path: `/dashboard/form/${formId}/settings`,
    },
  ];

  const getColorClasses = (color: string) => {
    const colorMap = {
      green: {
        card: 'border-green-200 dark:border-green-700',
        icon: 'bg-green-100 dark:bg-green-900 group-hover:bg-green-200 dark:group-hover:bg-green-800',
        iconText: 'text-green-600 dark:text-green-400',
        button: 'group-hover:bg-green-600 group-hover:text-white',
      },
      orange: {
        card: 'border-orange-200 dark:border-orange-700',
        icon: 'bg-orange-100 dark:bg-orange-900 group-hover:bg-orange-200 dark:group-hover:bg-orange-800',
        iconText: 'text-orange-600 dark:text-orange-400',
        button: 'group-hover:bg-orange-600 group-hover:text-white',
      },
      teal: {
        card: 'border-teal-200 dark:border-teal-700',
        icon: 'bg-teal-100 dark:bg-teal-900 group-hover:bg-teal-200 dark:group-hover:bg-teal-800',
        iconText: 'text-teal-600 dark:text-teal-400',
        button: 'group-hover:bg-teal-600 group-hover:text-white',
      },
      purple: {
        card: 'border-purple-200 dark:border-purple-700',
        icon: 'bg-purple-100 dark:bg-purple-900 group-hover:bg-purple-200 dark:group-hover:bg-purple-800',
        iconText: 'text-purple-600 dark:text-purple-400',
        button: 'group-hover:bg-purple-600 group-hover:text-white',
      },
      slate: {
        card: 'border-slate-200 dark:border-slate-700',
        icon: 'bg-slate-100 dark:bg-slate-900 group-hover:bg-slate-200 dark:group-hover:bg-slate-800',
        iconText: 'text-slate-600 dark:text-slate-400',
        button: 'group-hover:bg-slate-600 group-hover:text-white',
      },
    };
    return colorMap[color as keyof typeof colorMap];
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-xl p-6 border border-blue-100 dark:border-blue-800">
      <div className="flex items-center justify-between mb-6">
        <div>
          <TypographyH3 className="flex items-center text-blue-900 dark:text-blue-100">
            <Sparkles className="mr-2 h-5 w-5 text-blue-600" />
            Quick Actions
          </TypographyH3>
          <TypographyP className="text-blue-700 dark:text-blue-300 mt-1">
            Enhance your form with powerful tools and customizations
          </TypographyP>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        {actions.map((action) => {
          const Icon = action.icon;
          const colorClasses = getColorClasses(action.color);

          return (
            <Card
              key={action.title}
              className={`group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 ${colorClasses.card} bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm`}
            >
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className={`p-3 rounded-lg transition-colors ${colorClasses.icon}`}>
                    <Icon className={`h-6 w-6 ${colorClasses.iconText}`} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      {action.title}
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                      {action.description}
                    </p>
                    <Button
                      className={`w-full transition-colors ${colorClasses.button}`}
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(action.path)}
                    >
                      {action.title === 'Collaborate' && 'Start Collaborating'}
                      {action.title === 'Responses' && 'View Responses'}
                      {action.title === 'Analytics' && 'View Analytics'}
                      {action.title === 'Plugins' && 'Browse Plugins'}
                      {action.title === 'Settings' && 'Open Settings'}
                      <ArrowRight className="ml-1 h-3 w-3 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};