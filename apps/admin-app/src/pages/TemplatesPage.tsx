import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useTranslation } from '../hooks/useTranslation';
import { Button, Card, LoadingSpinner } from '@dculus/ui';
import { FileText, Plus, Edit2, Trash2, Eye } from 'lucide-react';
import { GET_TEMPLATES, DELETE_TEMPLATE } from '../graphql/templates';
import TemplateModal from '../components/templates/TemplateModal';

interface Template {
  id: string;
  name: string;
  description?: string;
  category?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function TemplatesPage() {
  const { t } = useTranslation('templates');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');

  const { data, loading, error, refetch } = useQuery(GET_TEMPLATES);
  const [deleteTemplate] = useMutation(DELETE_TEMPLATE);

  const templates: Template[] = data?.templates || [];

  const handleCreateTemplate = () => {
    setSelectedTemplate(null);
    setModalMode('create');
    setIsModalOpen(true);
  };

  const handleEditTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleViewTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setModalMode('view');
    setIsModalOpen(true);
  };

  const handleDeleteTemplate = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      try {
        await deleteTemplate({ variables: { id } });
        refetch();
      } catch (error) {
        console.error('Error deleting template:', error);
        alert('Failed to delete template');
      }
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedTemplate(null);
    refetch(); // Refresh templates after modal close
  };

  if (error) {
    return (
      <div className="min-h-64 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-medium text-gray-900 mb-2">Unable to load templates</h2>
          <p className="text-sm text-gray-500 mb-4">
            {error.message || 'Please check your connection and try again.'}
          </p>
          <Button onClick={() => refetch()}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('pageTitle', { defaultValue: 'Templates' })}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {t('pageSubtitle', {
              defaultValue: 'Manage form templates for your organization',
            })}
          </p>
        </div>
        <Button onClick={handleCreateTemplate}>
          <Plus className="h-4 w-4 mr-2" />
          {t('createTemplate', { defaultValue: 'Create Template' })}
        </Button>
      </div>

      {/* Templates Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : templates.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No templates yet</h3>
            <p className="text-sm text-gray-500 mb-4">
              {t('emptyState.description', {
                defaultValue: 'Create your first template to get started',
              })}
            </p>
            <Button onClick={handleCreateTemplate}>
              <Plus className="h-4 w-4 mr-2" />
              {t('createTemplate', { defaultValue: 'Create Template' })}
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {templates.map((template) => (
                  <tr key={template.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileText className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {template.name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {template.category || 'Uncategorized'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {template.description || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        template.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {template.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(template.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewTemplate(template)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditTemplate(template)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteTemplate(template.id, template.name)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Template Modal */}
      <TemplateModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        mode={modalMode}
        template={selectedTemplate}
      />
    </div>
  );
}
