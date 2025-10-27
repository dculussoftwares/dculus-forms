import { Card, CardHeader, CardTitle, CardDescription } from '@dculus/ui-v2';
import { Settings, Mail, Lock, Download, Webhook } from 'lucide-react';

const PLANNED_FEATURES = [
  {
    icon: Settings,
    title: 'Form Submission Settings',
    description: 'Configure submission limits, time windows, and redirect URLs',
  },
  {
    icon: Mail,
    title: 'Email Notifications',
    description: 'Set up email alerts for form submissions and responses',
  },
  {
    icon: Lock,
    title: 'Access Permissions',
    description: 'Advanced permission management and access control',
  },
  {
    icon: Download,
    title: 'Export Options',
    description: 'Export form responses to CSV, Excel, or JSON',
  },
  {
    icon: Webhook,
    title: 'Integrations',
    description: 'Connect to webhooks, Zapier, and third-party services',
  },
];

/**
 * Settings Tab - Form configuration
 * Placeholder for future settings features
 */
export function SettingsTab() {
  return (
    <div className="h-full overflow-auto p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Settings</h2>
          <p className="text-muted-foreground mt-2">
            Advanced form configuration options coming soon.
          </p>
        </div>

        <div className="grid gap-4">
          {PLANNED_FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-base">
                        {feature.title}
                      </CardTitle>
                      <CardDescription>{feature.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
