import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Button,
  Input,
  Label,
  Textarea,
  LoadingSpinner,
  toastSuccess,
  toastError,
} from '@dculus/ui';
import { CREATE_FORM } from '../graphql/mutations';
import { useAppConfig } from '../hooks/useAppConfig';

interface UseTemplatePopoverProps {
  templateId: string;
  templateName: string;
  children: React.ReactNode;
}

interface FormData {
  title: string;
  description: string;
}

export const UseTemplatePopover: React.FC<UseTemplatePopoverProps> = ({
  templateId,
  templateName,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    title: `${templateName} Copy`,
    description: '',
  });
  const [errors, setErrors] = useState<Partial<FormData>>({});
  
  const navigate = useNavigate();
  const { organizationId } = useAppConfig();
  const [createForm, { loading }] = useMutation(CREATE_FORM);

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Form title is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    if (!organizationId) {
      setErrors({ title: 'Organization not found. Please refresh and try again.' });
      return;
    }

    try {
      const { data } = await createForm({
        variables: {
          input: {
            templateId,
            title: formData.title.trim(),
            description: formData.description.trim() || undefined,
            organizationId,
          },
        },
      });

      if (data?.createForm) {
        toastSuccess('Form created successfully', `"${data.createForm.title}" is ready for editing`);
        // Navigate to the new Form Dashboard page
        navigate(`/dashboard/form/${data.createForm.id}`);
        setIsOpen(false);
        // Reset form data
        setFormData({
          title: `${templateName} Copy`,
          description: '',
        });
      }
    } catch (error) {
      console.error('Error creating form:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create form. Please try again.';
      toastError('Failed to create form from template', errorMessage);
      setErrors({ 
        title: errorMessage
      });
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Reset form when closing
      setFormData({
        title: `${templateName} Copy`,
        description: '',
      });
      setErrors({});
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-96" align="center">
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-slate-900">
              Create Form from Template
            </h3>
            <p className="text-sm text-slate-600">
              Create a new form based on "{templateName}" template.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="form-title">Form Title *</Label>
              <Input
                id="form-title"
                type="text"
                placeholder="Enter form title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className={errors.title ? 'border-red-500' : ''}
                disabled={loading}
              />
              {errors.title && (
                <p className="text-sm text-red-500">{errors.title}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="form-description">Description (optional)</Label>
              <Textarea
                id="form-description"
                placeholder="Enter form description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
                disabled={loading}
              />
              {errors.description && (
                <p className="text-sm text-red-500">{errors.description}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || !organizationId}
                className="min-w-[100px]"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <LoadingSpinner />
                    <span>Creating...</span>
                  </div>
                ) : (
                  'Create Form'
                )}
              </Button>
            </div>
          </form>
        </div>
      </PopoverContent>
    </Popover>
  );
};
