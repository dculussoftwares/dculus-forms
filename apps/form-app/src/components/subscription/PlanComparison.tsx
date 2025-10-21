import { Card, Badge } from '@dculus/ui';
import { Check, X, Eye, FileText, Zap, Shield } from 'lucide-react';

interface PlanComparisonProps {
  currentPlan: string;
}

export const PlanComparison = ({ currentPlan }: PlanComparisonProps) => {
  const plans = [
    {
      id: 'free',
      name: 'Free',
      features: {
        views: '10,000 / month',
        submissions: '1,000 / month',
        forms: 'Unlimited',
        collaboration: true,
        analytics: 'Basic',
        support: 'Community',
        customDomain: false,
        apiAccess: false,
      },
    },
    {
      id: 'starter',
      name: 'Starter',
      features: {
        views: 'Unlimited',
        submissions: '10,000 / month',
        forms: 'Unlimited',
        collaboration: true,
        analytics: 'Advanced',
        support: 'Email',
        customDomain: true,
        apiAccess: true,
      },
    },
    {
      id: 'advanced',
      name: 'Advanced',
      features: {
        views: 'Unlimited',
        submissions: '100,000 / month',
        forms: 'Unlimited',
        collaboration: true,
        analytics: 'Advanced + Export',
        support: 'Priority',
        customDomain: true,
        apiAccess: true,
      },
    },
  ];

  const featureRows = [
    { key: 'views', label: 'Form Views', icon: Eye },
    { key: 'submissions', label: 'Form Submissions', icon: FileText },
    { key: 'forms', label: 'Forms', icon: Zap },
    { key: 'collaboration', label: 'Real-time Collaboration', icon: Users },
    { key: 'analytics', label: 'Analytics', icon: BarChart3 },
    { key: 'support', label: 'Support', icon: HelpCircle },
    { key: 'customDomain', label: 'Custom Domain', icon: Globe },
    { key: 'apiAccess', label: 'API Access', icon: Shield },
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
        <h3 className="text-lg font-semibold mb-1">Plan Comparison</h3>
        <p className="text-sm text-gray-500">
          Compare features across all available plans
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-3 px-4 font-medium text-gray-600">
                Feature
              </th>
              {plans.map((plan) => (
                <th key={plan.id} className="text-center py-3 px-4">
                  <div className="flex flex-col items-center gap-2">
                    <span className="font-semibold text-base">{plan.name}</span>
                    {currentPlan === plan.id && (
                      <Badge className="bg-blue-100 text-blue-800 text-xs">
                        Current Plan
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
              All plans include:
            </p>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>• Unlimited forms and collaborators</li>
              <li>• Real-time collaborative editing</li>
              <li>• Form analytics and insights</li>
              <li>• Plugin system (webhooks, email, quiz grading)</li>
              <li>• Response management and editing</li>
            </ul>
          </div>
        </div>
      </div>
    </Card>
  );
};

// Import icons that weren't already imported
import { Users, BarChart3, HelpCircle, Globe } from 'lucide-react';
