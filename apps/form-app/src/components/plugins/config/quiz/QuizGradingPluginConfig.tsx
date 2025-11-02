import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Checkbox,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Alert,
  AlertDescription,
} from '@dculus/ui';
import { GraduationCap, AlertCircle } from 'lucide-react';
import type { Form } from '@dculus/types';
import { deserializeFormSchema, SelectField, RadioField } from '@dculus/types';
import { useTranslation } from '../../../../hooks/useTranslation';

interface QuizGradingPluginConfigProps {
  form: Form;
  initialData?: any;
  mode: 'create' | 'edit';
  isSaving: boolean;
  onSave: (data: any) => void;
  onCancel: () => void;
}

interface QuizFieldConfigState {
  fieldId: string;
  correctAnswer: string;
  marks: number;
  included: boolean;
}

interface SelectionFieldInfo {
  id: string;
  label: string;
  type: 'SelectField' | 'RadioField';
  options: string[];
}

// Extract SelectField and RadioField from form schema
function extractSelectionFields(form: Form): SelectionFieldInfo[] {
  const formSchema = deserializeFormSchema(form.formSchema);
  const selectionFields: SelectionFieldInfo[] = [];

  for (const page of formSchema.pages) {
    for (const field of page.fields) {
      if (field instanceof SelectField || field instanceof RadioField) {
        selectionFields.push({
          id: field.id,
          label: field.label || 'Unlabeled Field',
          type: field instanceof SelectField ? 'SelectField' : 'RadioField',
          options: field.options || [],
        });
      }
    }
  }

  return selectionFields;
}

export const QuizGradingPluginConfig: React.FC<QuizGradingPluginConfigProps> = ({
  form,
  initialData,
  mode,
  isSaving,
  onSave,
  onCancel,
}) => {
  const { t } = useTranslation('quizGradingPluginConfig');
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      name: initialData?.name || '',
      passThreshold: initialData?.config?.passThreshold || 60,
    },
  });

  // Extract selection fields from form
  const selectionFields = useMemo(() => extractSelectionFields(form), [form]);

  // Initialize quiz field configurations
  const [quizFields, setQuizFields] = useState<Record<string, QuizFieldConfigState>>(() => {
    const initial: Record<string, QuizFieldConfigState> = {};

    if (initialData?.config?.quizFields) {
      // Edit mode: populate from existing config
      for (const qf of initialData.config.quizFields) {
        initial[qf.fieldId] = {
          fieldId: qf.fieldId,
          correctAnswer: qf.correctAnswer,
          marks: qf.marks,
          included: true,
        };
      }
    }

    // Initialize all fields (create mode or fields not in config)
    for (const field of selectionFields) {
      if (!initial[field.id]) {
        initial[field.id] = {
          fieldId: field.id,
          correctAnswer: '',
          marks: 1,
          included: false,
        };
      }
    }

    return initial;
  });

  // Toggle field inclusion
  const toggleQuizField = (fieldId: string) => {
    setQuizFields(prev => ({
      ...prev,
      [fieldId]: {
        ...prev[fieldId],
        included: !prev[fieldId].included,
      },
    }));
  };

  // Update correct answer
  const updateCorrectAnswer = (fieldId: string, correctAnswer: string) => {
    setQuizFields(prev => ({
      ...prev,
      [fieldId]: {
        ...prev[fieldId],
        correctAnswer,
      },
    }));
  };

  // Update marks
  const updateMarks = (fieldId: string, marks: number) => {
    setQuizFields(prev => ({
      ...prev,
      [fieldId]: {
        ...prev[fieldId],
        marks,
      },
    }));
  };

  const onSubmit = (data: any) => {
    // Validate at least one field is included
    const includedFields = Object.values(quizFields).filter(qf => qf.included);
    if (includedFields.length === 0) {
      alert('Please include at least one field in the quiz');
      return;
    }

    // Validate all included fields have correct answer and marks
    for (const qf of includedFields) {
      if (!qf.correctAnswer) {
        alert(`Please select a correct answer for all included fields`);
        return;
      }
      if (qf.marks <= 0) {
        alert(`Please set marks > 0 for all included fields`);
        return;
      }
    }

    // Build plugin config with field labels
    const pluginData = {
      type: 'quiz-grading',
      name: data.name,
      config: {
        quizFields: includedFields.map(qf => {
          // Find the field in selectionFields to get its label
          const field = selectionFields.find(f => f.id === qf.fieldId);
          return {
            fieldId: qf.fieldId,
            fieldLabel: field?.label || 'Unknown Field',
            correctAnswer: qf.correctAnswer,
            marks: qf.marks,
          };
        }),
        passThreshold: data.passThreshold,
      },
      events: ['form.submitted'],
    };

    onSave(pluginData);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <GraduationCap className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>{t('title')}</CardTitle>
                <CardDescription>
                  {t('description')}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Basic Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t('basicSettings.title')}</CardTitle>
            <CardDescription>
              {t('basicSettings.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('basicSettings.pluginName')}</Label>
              <Input
                id="name"
                placeholder={t('basicSettings.pluginNamePlaceholder')}
                {...register('name', { required: true })}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{t('basicSettings.pluginNameRequired')}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="passThreshold">{t('basicSettings.passThreshold')}</Label>
              <Input
                id="passThreshold"
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="60"
                {...register('passThreshold', {
                  required: true,
                  min: 0,
                  max: 100,
                })}
              />
              {errors.passThreshold && (
                <p className="text-sm text-destructive">{t('basicSettings.passThresholdError')}</p>
              )}
              <p className="text-sm text-muted-foreground">
                {t('basicSettings.passThresholdHelp')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Quiz Questions */}
        <Card>
          <CardHeader>
            <CardTitle>{t('quizQuestions.title')}</CardTitle>
            <CardDescription>
              Select fields to include in quiz and configure correct answers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectionFields.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No selection fields (Dropdown or Radio) found in this form. Please add selection fields to create a quiz.
                </AlertDescription>
              </Alert>
            ) : (
              selectionFields.map((field) => {
                const qf = quizFields[field.id];
                return (
                  <div key={field.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={`include-${field.id}`}
                        checked={qf.included}
                        onCheckedChange={() => toggleQuizField(field.id)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Label htmlFor={`include-${field.id}`} className="font-medium cursor-pointer">
                            {field.label}
                          </Label>
                          <Badge variant="outline" className="text-xs">
                            {field.type === 'SelectField' ? 'Dropdown' : 'Radio'}
                          </Badge>
                        </div>

                        {qf.included && (
                          <div className="mt-3 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label htmlFor={`correct-${field.id}`}>Correct Answer *</Label>
                                <Select
                                  value={qf.correctAnswer}
                                  onValueChange={(value) => updateCorrectAnswer(field.id, value)}
                                >
                                  <SelectTrigger id={`correct-${field.id}`}>
                                    <SelectValue placeholder="Select correct answer" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {field.options.map((option) => (
                                      <SelectItem key={option} value={option}>
                                        {option}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor={`marks-${field.id}`}>Marks *</Label>
                                <Input
                                  id={`marks-${field.id}`}
                                  type="number"
                                  min="0.5"
                                  step="0.5"
                                  value={qf.marks}
                                  onChange={(e) => updateMarks(field.id, parseFloat(e.target.value) || 1)}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving || selectionFields.length === 0}>
            {isSaving ? 'Saving...' : mode === 'create' ? 'Create Plugin' : 'Update Plugin'}
          </Button>
        </div>
      </form>
    </div>
  );
};
