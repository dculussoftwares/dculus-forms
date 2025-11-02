import { Card, Badge } from '@dculus/ui';
import { Check, X, Eye, FileText, Zap, Shield } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

interface PlanComparisonProps {
  currentPlan: string;
}

export const PlanComparison = ({ currentPlan }: PlanComparisonProps) => {
  const { t } = useTranslation('planComparison');
  
  const plans = [
    {
      id: 'free',
      name: t('plans.free.name'),
      features: {
        views: t('plans.free.features.views'),
        submissions: t('plans.free.features.submissions'),
        forms: t('plans.free.features.forms'),
        collaboration: true,
        analytics: t('plans.free.features.analytics'),
        support: t('plans.free.features.support'),
        customDomain: false,
        apiAccess: false,
      },
    },
    {
      id: 'starter',
      name: t('plans.starter.name'),
      features: {
        views: t('plans.starter.features.views'),
        submissions: t('plans.starter.features.submissions'),
        forms: t('plans.starter.features.forms'),
        collaboration: true,
        analytics: t('plans.starter.features.analytics'),
        support: t('plans.starter.features.support'),
        customDomain: true,
        apiAccess: true,
      },
    },
    {
      id: 'advanced',
      name: t('plans.advanced.name'),
      features: {
        views: t('plans.advanced.features.views'),
        submissions: t('plans.advanced.features.submissions'),
        forms: t('plans.advanced.features.forms'),
        collaboration: true,
        analytics: t('plans.advanced.features.analytics'),
        support: t('plans.advanced.features.support'),
        customDomain: true,
        apiAccess: true,
      },
    },
  ];

  const featureRows = [
    { key: 'views', label: t('features.formViews'), icon: Eye },
    { key: 'submissions', label: t('features.formSubmissions'), icon: FileText },
    { key: 'forms', label: t('features.forms'), icon: Zap },
    { key: 'collaboration', label: t('features.collaboration'), icon: Users },
    { key: 'analytics', label: t('features.analytics'), icon: BarChart3 },
    { key: 'support', label: t('features.support'), icon: HelpCircle },
    { key: 'customDomain', label: t('features.customDomain'), icon: Globe },
    { key: 'apiAccess', label: t('features.apiAccess'), icon: Shield },
  ];

  const renderFeatureValue = (value: string | boolean | number) => {
    if (typeof value === 'boolean') {
      return value ? (
        <Check className="h-5 w-5 text-green-600 mx-auto" />
      ) : (
        <X className="h-5 w-5 text-gray-300 mx-auto" />
      );
    }
    return <span className="text-sm">{value}</span>;
  };

  return (
    <Card className="p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-1">{t('title')}</h3>
        <p className="text-sm text-gray-500">
          {t('subtitle')}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-3 px-4 font-medium text-gray-600">
                {t('table.feature')}
              </th>
              {plans.map((plan) => (
                <th key={plan.id} className="text-center py-3 px-4">
                  <div className="flex flex-col items-center gap-2">
                    <span className="font-semibold text-base">{plan.name}</span>
                    {currentPlan === plan.id && (
                      <Badge className="bg-blue-100 text-blue-800 text-xs">
                        {t('table.currentPlan')}
                      </Badge>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {featureRows.map((row, index) => {
              const Icon = row.icon;
              return (
                <tr
                  key={row.key}
                  className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                  }`}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-sm">{row.label}</span>
                    </div>
                  </td>
                  {plans.map((plan) => (
                    <td
                      key={`${plan.id}-${row.key}`}
                      className="py-3 px-4 text-center"
                    >
                      {renderFeatureValue(
                        plan.features[row.key as keyof typeof plan.features]
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
              {t('allPlansInclude.title')}
            </p>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>{t('allPlansInclude.items.unlimitedForms')}</li>
              <li>{t('allPlansInclude.items.realtimeEditing')}</li>
              <li>{t('allPlansInclude.items.analytics')}</li>
              <li>{t('allPlansInclude.items.plugins')}</li>
              <li>{t('allPlansInclude.items.responseManagement')}</li>
            </ul>
          </div>
        </div>
      </div>
    </Card>
  );
};

// Import icons that weren't already imported
import { Users, BarChart3, HelpCircle, Globe } from 'lucide-react';
