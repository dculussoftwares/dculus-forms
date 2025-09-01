import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { Button, LoadingSpinner } from '@dculus/ui';
import { X, FileText, Layout, Code } from 'lucide-react';
import { CREATE_TEMPLATE, UPDATE_TEMPLATE, GET_TEMPLATE, GET_TEMPLATE_CATEGORIES } from '../../graphql/templates';

// Sample data templates
const SAMPLE_FORM_SCHEMA = {
  "pages": [
    {
      "id": "sample-page-1",
      "title": "Sample Page",
      "order": 1,
      "fields": [
        {
          "id": "field-1",
          "type": "text_input",
          "label": "Full Name",
          "placeholder": "Enter your name",
          "hint": "Please provide your full name",
          "validation": { "required": true }
        },
        {
          "id": "field-2",
          "type": "email",
          "label": "Email Address", 
          "placeholder": "your@email.com",
          "hint": "We'll use this to contact you",
          "validation": { "required": true }
        },
        {
          "id": "field-3",
          "type": "textarea",
          "label": "Message",
          "placeholder": "Type your message here...",
          "hint": "Please provide details",
          "validation": { "required": false }
        }
      ]
    }
  ],
  "isShuffleEnabled": false
};

const SAMPLE_LAYOUT = {
  "theme": "light",
  "textColor": "#333333",
  "spacing": "normal", 
  "code": "L1",
  "content": "<h1><strong>Sample Template</strong></h1><p>This is a sample template form. Customize this content to match your needs.</p>",
  "customBackGroundColor": "#ffffff",
  "backgroundImageKey": "",
  "pageMode": "multipage"
};

interface Template {
  id: string;
  name: string;
  description?: string;
  category?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  formSchema?: any;
}

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit' | 'view';
  template: Template | null;
}

interface TemplateFormData {
  name: string;
  description: string;
  category: string;
  formSchema: string; // JSON string for editing
  layout: string;     // JSON string for editing
}

export default function TemplateModal({ isOpen, onClose, mode, template }: TemplateModalProps) {
  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    description: '',
    category: '',
    formSchema: JSON.stringify(SAMPLE_FORM_SCHEMA, null, 2),
    layout: JSON.stringify(SAMPLE_LAYOUT, null, 2),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'basic' | 'schema' | 'layout'>('basic');

  const { data: categoriesData } = useQuery(GET_TEMPLATE_CATEGORIES);
  const { data: templateData, loading: templateLoading } = useQuery(GET_TEMPLATE, {
    variables: { id: template?.id },
    skip: !template?.id || mode === 'create',
  });

  const [createTemplate, { loading: creating }] = useMutation(CREATE_TEMPLATE);
  const [updateTemplate, { loading: updating }] = useMutation(UPDATE_TEMPLATE);

  const categories = categoriesData?.templateCategories || [];
  const isLoading = creating || updating || templateLoading;
  const isReadOnly = mode === 'view';

  // Reset form when modal opens/closes or template changes
  useEffect(() => {
    if (isOpen) {
      if (mode === 'create') {
        setFormData({ 
          name: '', 
          description: '', 
          category: '',
          formSchema: JSON.stringify(SAMPLE_FORM_SCHEMA, null, 2),
          layout: JSON.stringify(SAMPLE_LAYOUT, null, 2),
        });
      } else if (template) {
        setFormData({
          name: template.name || '',
          description: template.description || '',
          category: template.category || '',
          formSchema: template.formSchema ? JSON.stringify(template.formSchema, null, 2) : JSON.stringify(SAMPLE_FORM_SCHEMA, null, 2),
          layout: template.formSchema?.layout ? JSON.stringify(template.formSchema.layout, null, 2) : JSON.stringify(SAMPLE_LAYOUT, null, 2),
        });
      }
      setErrors({});
      setActiveTab('basic');
    }
  }, [isOpen, mode, template]);

  // Update form data when detailed template data loads
  useEffect(() => {
    if (templateData?.template && mode !== 'create') {
      const fullTemplate = templateData.template;
      setFormData({
        name: fullTemplate.name || '',
        description: fullTemplate.description || '',
        category: fullTemplate.category || '',
        formSchema: fullTemplate.formSchema ? JSON.stringify(fullTemplate.formSchema, null, 2) : JSON.stringify(SAMPLE_FORM_SCHEMA, null, 2),
        layout: fullTemplate.formSchema?.layout ? JSON.stringify(fullTemplate.formSchema.layout, null, 2) : JSON.stringify(SAMPLE_LAYOUT, null, 2),
      });
    }
  }, [templateData, mode]);

  const handleInputChange = (field: keyof TemplateFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateJSON = (jsonString: string, fieldName: string): boolean => {
    try {
      JSON.parse(jsonString);
      return true;
    } catch (error) {
      setErrors(prev => ({ 
        ...prev, 
        [fieldName]: `Invalid JSON: ${error instanceof Error ? error.message : 'Syntax error'}` 
      }));
      return false;
    }
  };

  const formatJSON = (field: 'formSchema' | 'layout') => {
    try {
      const parsed = JSON.parse(formData[field]);
      const formatted = JSON.stringify(parsed, null, 2);
      setFormData(prev => ({ ...prev, [field]: formatted }));
    } catch (error) {
      // JSON is invalid, don't format
    }
  };

  const resetToSample = (field: 'formSchema' | 'layout') => {
    const sampleData = field === 'formSchema' ? SAMPLE_FORM_SCHEMA : SAMPLE_LAYOUT;
    setFormData(prev => ({ ...prev, [field]: JSON.stringify(sampleData, null, 2) }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Template name is required';
    }

    // Validate JSON fields
    if (!validateJSON(formData.formSchema, 'formSchema')) {
      return false; // Error already set in validateJSON
    }

    if (!validateJSON(formData.layout, 'layout')) {
      return false; // Error already set in validateJSON
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isReadOnly) return;

    if (!validateForm()) return;

    try {
      // Parse JSON data
      const parsedFormSchema = JSON.parse(formData.formSchema);
      const parsedLayout = JSON.parse(formData.layout);

      // Combine formSchema with layout
      const completeFormSchema = {
        ...parsedFormSchema,
        layout: parsedLayout
      };

      const input = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        category: formData.category.trim() || null,
        formSchema: completeFormSchema,
      };

      if (mode === 'create') {
        await createTemplate({ variables: { input } });
      } else if (mode === 'edit' && template) {
        await updateTemplate({ 
          variables: { 
            id: template.id, 
            input
          } 
        });
      }

      onClose();
    } catch (error) {
      console.error('Error saving template:', error);
      setErrors({ submit: 'Failed to save template. Please try again.' });
    }
  };

  const getModalTitle = () => {
    switch (mode) {
      case 'create': return 'Create New Template';
      case 'edit': return 'Edit Template';
      case 'view': return 'View Template';
      default: return 'Template';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50" 
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {getModalTitle()}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tabs */}
        {(mode === 'create' || mode === 'edit' || mode === 'view') && (
          <div className="border-b">
            <nav className="flex space-x-8 px-6">
              {[
                { id: 'basic', label: 'Basic Info', icon: FileText },
                { id: 'schema', label: 'Form Schema', icon: Code },
                { id: 'layout', label: 'Layout', icon: Layout },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          {templateLoading && mode !== 'create' ? (
            <div className="py-8 flex items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info Tab */}
              {activeTab === 'basic' && (
                <div className="space-y-4">
                  {/* Template Name */}
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                      Template Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      disabled={isReadOnly}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        isReadOnly ? 'bg-gray-50' : ''
                      } ${errors.name ? 'border-red-500' : ''}`}
                      placeholder="Enter template name"
                    />
                    {errors.name && (
                      <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                    )}
                  </div>

                  {/* Category */}
                  <div>
                    <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    {isReadOnly ? (
                      <input
                        type="text"
                        value={formData.category || 'Uncategorized'}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                      />
                    ) : (
                      <select
                        id="category"
                        value={formData.category}
                        onChange={(e) => handleInputChange('category', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select a category</option>
                        {categories.map((cat: string) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      disabled={isReadOnly}
                      rows={3}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        isReadOnly ? 'bg-gray-50' : ''
                      }`}
                      placeholder="Enter template description"
                    />
                  </div>

                  {/* Status for view mode */}
                  {isReadOnly && template && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Status
                      </label>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        template.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {template.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Form Schema Tab */}
              {activeTab === 'schema' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label htmlFor="formSchema" className="block text-sm font-medium text-gray-700">
                        Form Schema (JSON) {!isReadOnly && '*'}
                      </label>
                      {!isReadOnly && (
                        <div className="flex space-x-2">
                          <button
                            type="button"
                            onClick={() => formatJSON('formSchema')}
                            className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                          >
                            Format
                          </button>
                          <button
                            type="button"
                            onClick={() => resetToSample('formSchema')}
                            className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded"
                          >
                            Reset to Sample
                          </button>
                        </div>
                      )}
                    </div>
                    <textarea
                      id="formSchema"
                      value={formData.formSchema}
                      onChange={(e) => handleInputChange('formSchema', e.target.value)}
                      disabled={isReadOnly}
                      rows={20}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm ${
                        isReadOnly ? 'bg-gray-50' : ''
                      } ${errors.formSchema ? 'border-red-500' : ''}`}
                      placeholder={isReadOnly ? '' : "Enter form schema JSON..."}
                    />
                    {errors.formSchema && (
                      <p className="mt-1 text-sm text-red-600">{errors.formSchema}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      {isReadOnly ? 'View the pages and fields structure of this template.' : 'Define the pages and fields structure for your template form.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Layout Tab */}
              {activeTab === 'layout' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label htmlFor="layout" className="block text-sm font-medium text-gray-700">
                        Layout Configuration (JSON) {!isReadOnly && '*'}
                      </label>
                      {!isReadOnly && (
                        <div className="flex space-x-2">
                          <button
                            type="button"
                            onClick={() => formatJSON('layout')}
                            className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                          >
                            Format
                          </button>
                          <button
                            type="button"
                            onClick={() => resetToSample('layout')}
                            className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded"
                          >
                            Reset to Sample
                          </button>
                        </div>
                      )}
                    </div>
                    <textarea
                      id="layout"
                      value={formData.layout}
                      onChange={(e) => handleInputChange('layout', e.target.value)}
                      disabled={isReadOnly}
                      rows={15}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm ${
                        isReadOnly ? 'bg-gray-50' : ''
                      } ${errors.layout ? 'border-red-500' : ''}`}
                      placeholder={isReadOnly ? '' : "Enter layout configuration JSON..."}
                    />
                    {errors.layout && (
                      <p className="mt-1 text-sm text-red-600">{errors.layout}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      {isReadOnly ? 'View the theme, spacing, colors, and layout settings of this template.' : 'Configure theme, spacing, colors, and layout settings for your template.'}
                    </p>
                  </div>
                </div>
              )}

            {errors.submit && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                {errors.submit}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
              >
                {isReadOnly ? 'Close' : 'Cancel'}
              </Button>
              {!isReadOnly && (
                <Button
                  type="submit"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <LoadingSpinner className="mr-2 h-4 w-4" />
                      {mode === 'create' ? 'Creating...' : 'Saving...'}
                    </>
                  ) : (
                    mode === 'create' ? 'Create Template' : 'Save Changes'
                  )}
                </Button>
              )}
            </div>
          </form>
        )}
        </div>
      </div>
    </div>
  );
}