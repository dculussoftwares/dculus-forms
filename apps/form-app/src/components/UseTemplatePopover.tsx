import React, { useState, useEffect, useRef } from 'react';
import { useMutation } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Button,
  Input,
  Label,
  Textarea,
  Progress,
  toastError,
} from '@dculus/ui';
import { CREATE_FORM } from '../graphql/mutations';
import { useAppConfig } from '../hooks/useAppConfig';
import { useTranslation } from '../hooks/useTranslation';

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
  const { t } = useTranslation('templates');
  const defaultTitle = `${templateName} ${t('popover.defaultTitleSuffix')}`;
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    title: defaultTitle,
    description: '',
  });
  const [errors, setErrors] = useState<Partial<FormData>>({});
  
  const [progress, setProgress] = useState(0);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const navigate = useNavigate();
  const { organizationId } = useAppConfig();
  const [createForm, { loading }] = useMutation(CREATE_FORM);

  useEffect(() => {
    if (loading) {
      setProgress(0);
      progressIntervalRef.current = setInterval(() => {
        setProgress(prev => {
          if (prev >= 85) {
            clearInterval(progressIntervalRef.current!);
            return 85;
          }
          return prev + 5;
        });
      }, 120);
    } else {
      clearInterval(progressIntervalRef.current!);
      setProgress(0);
    }
    return () => clearInterval(progressIntervalRef.current!);
  }, [loading]);

  useEffect(() => {
    if (!isOpen) {
      setFormData(prev => ({
        ...prev,
        title: defaultTitle,
      }));
    }
  }, [defaultTitle, isOpen]);

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
      newErrors.title = t('popover.fields.title.error');
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    if (!organizationId) {
      setErrors({ title: t('popover.errors.organizationMissing') });
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
        // Navigate to the new Form Dashboard page
        navigate(`/dashboard/form/${data.createForm.id}`);
        setIsOpen(false);
        // Reset form data
        setFormData({
          title: defaultTitle,
          description: '',
        });
      }
    } catch (error) {
      console.error('Error creating form:', error);
      const errorMessage =
        error instanceof Error ? error.message : t('popover.errors.default');
      toastError(t('popover.errors.createTitle'), errorMessage);
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
        title: defaultTitle,
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
        {loading ? (
          <div className="py-6 flex flex-col items-center gap-5 text-center">
            <Progress value={progress} className="w-full" />
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-primary/10">
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              </div>
              <p className="font-medium text-sm text-primary">{t('popover.actions.submitting')}</p>
              <p className="text-xs text-muted-foreground">{templateName}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-primary">
                {t('popover.title')}
              </h3>
              <p className="text-sm text-foreground">
                {t('popover.subtitle', { values: { template: templateName } })}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="form-title">{t('popover.fields.title.label')}</Label>
                <Input
                  id="form-title"
                  type="text"
                  placeholder={t('popover.fields.title.placeholder')}
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className={errors.title ? 'border-destructive' : ''}
                />
                {errors.title && (
                  <p className="text-sm text-destructive">{errors.title}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="form-description">{t('popover.fields.description.label')}</Label>
                <Textarea
                  id="form-description"
                  placeholder={t('popover.fields.description.placeholder')}
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={3}
                />
                {errors.description && (
                  <p className="text-sm text-destructive">{errors.description}</p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                >
                  {t('popover.actions.cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={!organizationId}
                  className="min-w-[100px]"
                >
                  {t('popover.actions.submit')}
                </Button>
              </div>
            </form>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
