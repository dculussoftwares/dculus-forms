import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import {
  Button,
  Card,
  CardContent,
  Input,
  LoadingSpinner,
  Badge,
} from '@dculus/ui';
import { MainLayout } from '../components/MainLayout';
import { GET_FORM_BY_ID } from '../graphql/queries';
import {
  AlertCircle,
  ArrowLeft,
  Search,
  Star,
  TrendingUp,
  Zap,
  Mail,
  MessageSquare,
  FileText,
  Webhook,
  Globe,
  Palette,
} from 'lucide-react';

const FormPlugins: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const {
    data: formData,
    loading: formLoading,
    error: formError,
  } = useQuery(GET_FORM_BY_ID, {
    variables: { id: formId },
    skip: !formId,
  });

  const categories = [
    { id: 'all', name: 'All integrations', icon: Globe, count: 7 },
    { id: 'popular', name: 'Most popular', icon: TrendingUp, count: 3 },
    { id: 'email', name: 'Email', icon: Mail, count: 1 },
    { id: 'productivity', name: 'Productivity', icon: FileText, count: 2 },
    { id: 'communication', name: 'Communication', icon: MessageSquare, count: 2 },
    { id: 'automation', name: 'Automation', icon: Zap, count: 1 },
    { id: 'webhooks', name: 'Webhooks & API', icon: Webhook, count: 1 },
  ];

  const integrations = [
    // Popular
    { name: 'Email', description: 'Send automated email notifications for form submissions', category: 'popular', logo: '📧', color: 'bg-blue-100', popular: true },
    { name: 'Google Sheets', description: 'Sync responses to Google Sheets automatically', category: 'popular', logo: '📊', color: 'bg-green-100', popular: true },
    { name: 'WhatsApp', description: 'Send form notifications via WhatsApp', category: 'popular', logo: '💬', color: 'bg-green-100', popular: true },

    // Email
    { name: 'Email', description: 'Send automated email notifications for form submissions', category: 'email', logo: '📧', color: 'bg-blue-100' },

    // Productivity
    { name: 'Google Sheets', description: 'Sync responses to Google Sheets automatically', category: 'productivity', logo: '📊', color: 'bg-green-100' },
    { name: 'Microsoft Excel', description: 'Export and sync data to Microsoft Excel', category: 'productivity', logo: '📈', color: 'bg-green-100' },

    // Communication
    { name: 'WhatsApp', description: 'Send form notifications via WhatsApp', category: 'communication', logo: '💬', color: 'bg-green-100' },
    { name: 'Telegram', description: 'Instant messaging notifications via Telegram', category: 'communication', logo: '✈️', color: 'bg-blue-100' },

    // Automation
    { name: 'n8n', description: 'Open-source workflow automation', category: 'automation', logo: '🤖', color: 'bg-pink-100' },

    // Webhooks & API
    { name: 'Custom Webhooks', description: 'Send data to any URL endpoint', category: 'webhooks', logo: '🔗', color: 'bg-gray-100' },
  ];

  const filteredIntegrations = integrations.filter((integration) => {
    const matchesCategory = selectedCategory === 'all' || integration.category === selectedCategory;
    const matchesSearch = integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         integration.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const popularIntegrations = integrations.filter(i => i.popular);

  if (formLoading) {
    return (
      <MainLayout
        title="Connect"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Form Dashboard', href: `/dashboard/form/${formId}` },
          { label: 'Connect', href: `/dashboard/form/${formId}/plugins` },
        ]}
      >
        <div className="flex justify-center items-center min-h-96">
          <LoadingSpinner />
        </div>
      </MainLayout>
    );
  }

  if (formError || !formData?.form) {
    return (
      <MainLayout
        title="Connect"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Connect', href: `/dashboard/form/${formId}/plugins` },
        ]}
      >
        <div className="max-w-4xl mx-auto px-4 py-12">
          <Card className="p-8 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Form Not Found</h3>
            <p className="text-slate-600">
              The form you're looking for doesn't exist or you don't have
              permission to view it.
            </p>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const form = formData.form;

  return (
    <MainLayout
      title={`${form.title} - Connect`}
      breadcrumbs={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: form.title, href: `/dashboard/form/${formId}` },
        { label: 'Connect', href: `/dashboard/form/${formId}/plugins` },
      ]}
    >
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/dashboard/form/${formId}`)}
                  className="mb-3 -ml-2"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back to Dashboard
                </Button>
                <h1 className="text-3xl font-bold text-slate-900 mb-2">
                  Connect
                </h1>
                <p className="text-slate-600 text-lg">
                  Extend your forms with powerful integrations
                </p>
              </div>
              <Button variant="outline" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                API Documentation
              </Button>
            </div>

            {/* Search Bar */}
            <div className="relative max-w-xl">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search integrations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 text-base"
              />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex gap-8">
            {/* Sidebar */}
            <aside className="w-64 flex-shrink-0">
              <div className="sticky top-8 space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-3">
                  Categories
                </p>
                {categories.map((category) => {
                  const Icon = category.icon;
                  const isActive = selectedCategory === category.id;
                  return (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-4 w-4" />
                        <span>{category.name}</span>
                      </div>
                      <span className={`text-xs ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                        {category.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            {/* Integration Cards */}
            <main className="flex-1">
              {/* Coming Soon Notice */}
              <div className="mb-8 bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="bg-indigo-100 p-3 rounded-lg">
                    <Palette className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-900 mb-1">
                      Coming Soon
                    </h3>
                    <p className="text-slate-700 text-sm mb-3">
                      We're building a powerful integration ecosystem. These integrations are planned
                      for our upcoming releases. Star your favorites to get notified when they launch!
                    </p>
                    <div className="flex gap-2">
                      <Badge variant="secondary" className="bg-white">
                        Q2 2025
                      </Badge>
                      <Badge variant="secondary" className="bg-white">
                        7 Integrations
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Most Popular */}
              {selectedCategory === 'all' && !searchQuery && (
                <div className="mb-10">
                  <div className="flex items-center gap-2 mb-4">
                    <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                    <h2 className="text-xl font-semibold text-slate-900">
                      Most popular
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {popularIntegrations.map((integration) => (
                      <Card
                        key={integration.name}
                        className="group hover:shadow-lg transition-all duration-200 cursor-pointer border-slate-200 hover:border-slate-300"
                      >
                        <CardContent className="p-5">
                          <div className="flex items-start gap-4">
                            <div className={`${integration.color} w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0`}>
                              {integration.logo}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-slate-900 mb-1 group-hover:text-slate-700">
                                {integration.name}
                              </h3>
                              <p className="text-sm text-slate-600 line-clamp-2">
                                {integration.description}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* All Integrations */}
              <div>
                {selectedCategory !== 'all' && (
                  <h2 className="text-xl font-semibold text-slate-900 mb-4">
                    {categories.find(c => c.id === selectedCategory)?.name}
                  </h2>
                )}
                {filteredIntegrations.length === 0 ? (
                  <Card className="p-12 text-center">
                    <Search className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-slate-900 mb-1">
                      No integrations found
                    </h3>
                    <p className="text-slate-600">
                      Try adjusting your search or browse different categories
                    </p>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredIntegrations.map((integration) => (
                      <Card
                        key={integration.name}
                        className="group hover:shadow-lg transition-all duration-200 cursor-pointer border-slate-200 hover:border-slate-300"
                      >
                        <CardContent className="p-5">
                          <div className="flex items-start gap-4">
                            <div className={`${integration.color} w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0`}>
                              {integration.logo}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <h3 className="font-semibold text-slate-900 group-hover:text-slate-700">
                                  {integration.name}
                                </h3>
                                {integration.popular && (
                                  <Star className="h-4 w-4 text-amber-500 fill-amber-500 flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-sm text-slate-600 line-clamp-2">
                                {integration.description}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer CTA */}
              <Card className="mt-10 bg-slate-900 text-white border-0">
                <CardContent className="p-8 text-center">
                  <h3 className="text-xl font-semibold mb-2">
                    Want your app listed here?
                  </h3>
                  <p className="text-slate-300 mb-6 max-w-2xl mx-auto">
                    Join our integration ecosystem and reach thousands of users.
                    Build custom integrations using our API or request a native integration.
                  </p>
                  <div className="flex gap-3 justify-center">
                    <Button variant="secondary" size="lg">
                      Partner with us
                    </Button>
                    <Button variant="outline" size="lg" className="bg-transparent border-white text-white hover:bg-white/10">
                      Request integration
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </main>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default FormPlugins;
