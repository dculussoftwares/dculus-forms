import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { 
  Button, 
  Input, 
  Label, 
  Textarea,
  Popover,
  PopoverContent,
  PopoverTrigger,
  TypographyH3,
  TypographySmall,
  toastError
} from '@dculus/ui';
import { Plus, Loader2 } from 'lucide-react';
import { CREATE_FORM } from '../graphql/mutations';
import { useNavigate } from 'react-router-dom';
import { useAppConfig } from '@/hooks';
import { useTranslation } from '../hooks/useTranslation';

interface CreateFormData {
  title: string;
  description: string;
}

interface CreateFormPopoverProps {
  onFormCreated?: () => void;
}

export const CreateFormPopover: React.FC<CreateFormPopoverProps> = ({ onFormCreated }) => {
  const navigate = useNavigate();
  const { t } = useTranslation('createFormPopover');
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<CreateFormData>({
    title: '',
    description: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { organizationId } = useAppConfig();
  const [createForm, { loading: isCreating }] = useMutation(CREATE_FORM, {
    onCompleted: (data) => {
      setIsOpen(false);
      setFormData({ title: '', description: '' });
      setErrors({});
      onFormCreated?.();
      // Navigate to form builder with the new form ID
      navigate(`/forms/${data.createForm.id}/edit`);
    },
    onError: (error) => {
      setErrors({ submit: error.message });
      toastError(t('error.title'), error.message);
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = t('validation.titleRequired');
    }

    if (!organizationId) {
      newErrors.submit = t('validation.organizationError');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await createForm({
        variables: {
          input: {
            title: formData.title.trim(),
            description: formData.description.trim() || undefined,
            formSchema: {
              pages: [{
                id: `page-${Date.now()}`,
                title: t('defaultPageTitle'),
                fields: [], // Start with empty fields
                order: 1
              }],
              layout: {
                theme: 'LIGHT',
                primaryColor: '#3b82f6',
                backgroundColor: '#ffffff',
                textColor: '#000000',
                spacing: 'NORMAL'
              },
              isShuffleEnabled: false
            },
            isPublished: false,
            organizationId: organizationId,
          },
        },
      });
    } catch (error) {
      console.error('Error creating form:', error);
      // Additional error is already handled by mutation onError callback
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Reset form when closing
      setFormData({ title: '', description: '' });
      setErrors({});
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button className="w-full justify-start">
          <Plus className="mr-2 h-4 w-4" />
          {t('triggerButton')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96" align="start">
        <div className="space-y-4">
          <div className="space-y-2">
            <TypographyH3>{t('title')}</TypographyH3>
            <TypographySmall className="text-muted-foreground">
              {t('subtitle')}
            </TypographySmall>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="form-title">{t('form.titleLabel')}</Label>
              <Input
                id="form-title"
                name="title"
                placeholder={t('form.titlePlaceholder')}
                value={formData.title}
                onChange={handleInputChange}
                className={errors.title ? 'border-red-500' : ''}
                disabled={isCreating}
              />
              {errors.title && (
                <TypographySmall className="text-red-500">
                  {errors.title}
                </TypographySmall>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="form-description">{t('form.descriptionLabel')}</Label>
              <Textarea
                id="form-description"
                name="description"
                placeholder={t('form.descriptionPlaceholder')}
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                disabled={isCreating}
              />
            </div>

            {errors.submit && (
              <TypographySmall className="text-red-500">
                {errors.submit}
              </TypographySmall>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                size="sm"
                disabled={isCreating}
                className="flex-1"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('buttons.creating')}
                  </>
                ) : (
                  t('buttons.create')
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(false)}
                disabled={isCreating}
              >
                {t('buttons.cancel')}
              </Button>
            </div>
          </form>
        </div>
      </PopoverContent>
    </Popover>
  );
};
