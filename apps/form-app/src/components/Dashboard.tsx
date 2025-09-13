import {
  Card,
  CardContent,
  TypographySmall,
  TypographyMuted,
  TypographyH3,
  Button,
  Input,
} from '@dculus/ui';
import { MainLayout } from "./MainLayout";
import { FileText, Eye, Plus, Users2, Edit3, Search, X } from 'lucide-react';
import { useNavigate, Routes, Route } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { useQuery } from '@apollo/client';
import { GET_FORMS_DASHBOARD, GET_ACTIVE_ORGANIZATION } from '../graphql/queries';
import Templates from '../pages/Templates';
import FormDashboard from '../pages/FormDashboard';

export function Dashboard() {
  return (
    <Routes>
      <Route
        path="templates"
        element={
          <MainLayout title="Templates" subtitle="Browse and select a template to start a new form" breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Templates', isActive: true }
          ]}>
            <Templates />
          </MainLayout>
        }
      />
      <Route
        path="form/:formId"
        element={<FormDashboard />}
      />
      <Route
        path="*"
        element={<FormsListDashboard />}
      />
    </Routes>
  );
}

function FormsListDashboard() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const { data: orgData } = useQuery(GET_ACTIVE_ORGANIZATION);
  const { data: formsData, loading: formsLoading, error: formsError } = useQuery(GET_FORMS_DASHBOARD, {
    variables: { organizationId: orgData?.activeOrganization?.id },
    skip: !orgData?.activeOrganization?.id,
  });

  const forms = formsData?.accessibleForms || [];

  // Filter forms based on search term
  const filteredForms = useMemo(() => {
    if (!searchTerm.trim()) return forms;
    
    return forms.filter((form: any) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        form.title?.toLowerCase().includes(searchLower) ||
        form.description?.toLowerCase().includes(searchLower)
      );
    });
  }, [forms, searchTerm]);

  const clearSearch = () => {
    setSearchTerm('');
  };

  return (
    <MainLayout 
      title="My Forms" 
      subtitle="Create, manage, and analyze your forms"
      breadcrumbs={[{ label: 'Dashboard', isActive: true }]}
    >
      <div className="space-y-8">
        {/* Header with Create Form Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <TypographyH3 className="text-2xl font-bold tracking-tight">Your Forms</TypographyH3>
            <TypographyMuted className="text-muted-foreground">
              {forms.length} form{forms.length !== 1 ? 's' : ''} in your workspace
              {searchTerm && ` • ${filteredForms.length} matching search`}
            </TypographyMuted>
          </div>
          <Button 
            onClick={() => navigate('/dashboard/templates')}
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
            size="lg"
          >
            <Plus className="mr-2 h-5 w-5" />
            Create Form
          </Button>
        </div>

        {/* Search Bar */}
        {forms.length > 0 && (
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search forms by name or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-10"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSearch}
                  className="absolute right-1 top-1/2 h-7 w-7 p-0 -translate-y-1/2 hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Forms Grid */}
        {formsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="overflow-hidden animate-pulse">
                <div className="h-48 bg-muted"></div>
                <CardContent className="p-6 space-y-3">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                  <div className="flex gap-2 pt-2">
                    <div className="h-6 bg-muted rounded w-16"></div>
                    <div className="h-6 bg-muted rounded w-20"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : formsError ? (
          <div className="text-center py-12">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-8 max-w-md mx-auto">
              <div className="text-destructive font-medium mb-2">Error loading forms</div>
              <div className="text-muted-foreground text-sm">Please try refreshing the page</div>
            </div>
          </div>
        ) : filteredForms.length === 0 && !searchTerm ? (
          <div className="text-center py-20">
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-xl p-12 max-w-lg mx-auto">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
                <FileText className="w-8 h-8 text-primary" />
              </div>
              <TypographyH3 className="text-xl font-semibold mb-3">No forms yet</TypographyH3>
              <TypographyMuted className="text-muted-foreground mb-6 max-w-sm mx-auto">
                Get started by creating your first form from one of our beautiful templates
              </TypographyMuted>
              <Button 
                onClick={() => navigate('/dashboard/templates')}
                size="lg"
                className="bg-primary hover:bg-primary/90"
              >
                <Plus className="mr-2 h-5 w-5" />
                Create Your First Form
              </Button>
            </div>
          </div>
        ) : filteredForms.length === 0 && searchTerm ? (
          <div className="text-center py-20">
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-xl p-12 max-w-lg mx-auto">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Search className="w-8 h-8 text-primary" />
              </div>
              <TypographyH3 className="text-xl font-semibold mb-3">No forms found</TypographyH3>
              <TypographyMuted className="text-muted-foreground mb-6 max-w-sm mx-auto">
                No forms match your search for "{searchTerm}". Try a different search term.
              </TypographyMuted>
              <Button 
                onClick={clearSearch}
                variant="outline"
                size="lg"
              >
                <X className="mr-2 h-4 w-4" />
                Clear Search
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredForms.map((form: any) => (
              <FormCard key={form.id} form={form} onNavigate={navigate} />
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}

interface FormCardProps {
  form: any;
  onNavigate: (path: string) => void;
}

function FormCard({ form, onNavigate }: FormCardProps) {
  // Use metadata if available, otherwise fallback to defaults
  const metadata = form.metadata;
  const primaryColor = '#3b82f6';
  const backgroundColor = '#ffffff';
  
  // Use background image from metadata if available
  const backgroundImageUrl = metadata?.backgroundImageUrl || null;
  
  // Get real counts from metadata or show placeholders
  const pageCount = metadata?.pageCount ?? 0;
  const fieldCount = metadata?.fieldCount ?? 0;

  const handleCardClick = () => {
    onNavigate(`/dashboard/form/${form.id}`);
  };

  const handlePreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Navigate to form preview/viewer
    window.open(`/form/${form.id}`, '_blank');
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNavigate(`/dashboard/form/${form.id}/builder`);
  };

  return (
    <Card 
      className="group relative overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white cursor-pointer"
      onClick={handleCardClick}
    >
      {/* Form Preview Background */}
      <div className="relative h-48 overflow-hidden">
        {backgroundImageUrl ? (
          <div 
            className="w-full h-full bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
            style={{ backgroundImage: `url(${backgroundImageUrl})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </div>
        ) : (
          <div 
            className="w-full h-full bg-gradient-to-br from-slate-100 via-slate-50 to-white relative"
            style={{ 
              background: `linear-gradient(135deg, ${backgroundColor}dd 0%, ${primaryColor}22 100%)`
            }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1)_0%,transparent_50%)]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div 
                className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
                style={{ backgroundColor: primaryColor }}
              >
                <FileText className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>
        )}
        
        {/* Status Badge */}
        <div className="absolute top-4 right-4">
          <div className={`px-3 py-1 rounded-full text-xs font-medium shadow-lg ${
            form.isPublished 
              ? 'bg-green-100 text-green-700 border border-green-200' 
              : 'bg-yellow-100 text-yellow-700 border border-yellow-200'
          }`}>
            {form.isPublished ? 'Published' : 'Draft'}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="bg-white/90 hover:bg-white shadow-lg"
              onClick={handlePreview}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              className="shadow-lg"
              style={{ backgroundColor: primaryColor }}
              onClick={handleEdit}
            >
              <Edit3 className="h-4 w-4 text-white" />
            </Button>
          </div>
        </div>
      </div>

      {/* Form Details */}
      <CardContent className="p-6">
        <div className="space-y-3">
          <div>
            <TypographyH3 className="font-semibold text-lg leading-tight line-clamp-1">
              {form.title}
            </TypographyH3>
            {form.description && (
              <TypographyMuted className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {form.description}
              </TypographyMuted>
            )}
          </div>
          
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {pageCount > 0 ? `${pageCount} page${pageCount !== 1 ? 's' : ''}` : 'No pages'}
              </span>
              <span className="flex items-center gap-1">
                <Users2 className="h-3 w-3" />
                {fieldCount > 0 ? `${fieldCount} field${fieldCount !== 1 ? 's' : ''}` : 'No fields'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <TypographySmall className="text-muted-foreground">
              {new Date(form.createdAt).toLocaleDateString()}
            </TypographySmall>
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: primaryColor }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
