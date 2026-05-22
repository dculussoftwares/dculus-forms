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
import { useTranslation } from '../../hooks/useTranslation';
import type { ConfigFormProps } from '../core/registry';

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

function extractSelectionFields(form: Form): SelectionFieldInfo[] {
  const schema = deserializeFormSchema(form.formSchema);
  const fields: SelectionFieldInfo[] = [];
  for (const page of schema.pages) {
    for (const field of page.fields) {
      if (field instanceof SelectField || field instanceof RadioField) {
        fields.push({
          id: field.id,
          label: field.label || 'Unlabeled Field',
          type: field instanceof SelectField ? 'SelectField' : 'RadioField',
          options: field.options || [],
        });
      }
    }
  }
  return fields;
}

export const QuizConfigForm: React.FC<ConfigFormProps> = ({
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
      columnName: initialData?.config?.columnName || '',
    },
  });

  const selectionFields = useMemo(
    () => (form ? extractSelectionFields(form as Form) : []),
    [form]
  );

  const [quizFields, setQuizFields] = useState<Record<string, QuizFieldConfigState>>(() => {
    const initial: Record<string, QuizFieldConfigState> = {};
    if (initialData?.config?.quizFields) {
      for (const qf of initialData.config.quizFields) {
        initial[qf.fieldId] = { fieldId: qf.fieldId, correctAnswer: qf.correctAnswer, marks: qf.marks, included: true };
      }
    }
    for (const field of selectionFields) {
      if (!initial[field.id]) {
        initial[field.id] = { fieldId: field.id, correctAnswer: '', marks: 1, included: false };
      }
    }
    return initial;
  });

  const toggleQuizField = (fieldId: string) =>
    setQuizFields((prev) => ({ ...prev, [fieldId]: { ...prev[fieldId], included: !prev[fieldId].included } }));

  const updateCorrectAnswer = (fieldId: string, correctAnswer: string) =>
    setQuizFields((prev) => ({ ...prev, [fieldId]: { ...prev[fieldId], correctAnswer } }));

  const updateMarks = (fieldId: string, marks: number) =>
    setQuizFields((prev) => ({ ...prev, [fieldId]: { ...prev[fieldId], marks } }));

  const onSubmit = (data: any) => {
    const includedFields = Object.values(quizFields).filter((qf) => qf.included);
    if (includedFields.length === 0) { alert(t('validation.noFieldsIncluded')); return; }
    for (const qf of includedFields) {
      if (!qf.correctAnswer) { alert(t('validation.missingCorrectAnswer')); return; }
      if (qf.marks <= 0) { alert(t('validation.invalidMarks')); return; }
    }
    onSave({
      type: 'quiz-grading',
      name: data.name,
      config: {
        quizFields: includedFields.map((qf) => ({
          fieldId: qf.fieldId,
          fieldLabel: selectionFields.find((f) => f.id === qf.fieldId)?.label || 'Unknown Field',
          correctAnswer: qf.correctAnswer,
          marks: qf.marks,
        })),
        passThreshold: data.passThreshold,
        columnName: data.columnName?.trim() || undefined,
      },
      events: ['form.submitted'],
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <GraduationCap className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>{t('title')}</CardTitle>
                <CardDescription>{t('description')}</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('basicSettings.title')}</CardTitle>
            <CardDescription>{t('basicSettings.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('basicSettings.pluginName')}</Label>
              <Input
                id="name"
                placeholder={t('basicSettings.pluginNamePlaceholder')}
                {...register('name', { required: true })}
              />
              {errors.name && <p className="text-sm text-destructive">{t('basicSettings.pluginNameRequired')}</p>}
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
                {...register('passThreshold', { required: true, min: 0, max: 100 })}
              />
              {errors.passThreshold && <p className="text-sm text-destructive">{t('basicSettings.passThresholdError')}</p>}
              <p className="text-sm text-muted-foreground">{t('basicSettings.passThresholdHelp')}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="columnName">{t('basicSettings.columnName')}</Label>
              <Input
                id="columnName"
                type="text"
                placeholder={t('basicSettings.columnNamePlaceholder')}
                {...register('columnName')}
              />
              <p className="text-sm text-muted-foreground">{t('basicSettings.columnNameHelp')}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('quizQuestions.title')}</CardTitle>
            <CardDescription>{t('quizQuestions.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectionFields.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{t('emptyState.noSelectionFields')}</AlertDescription>
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
                            {field.type === 'SelectField'
                              ? t('quizQuestions.fieldTypes.dropdown')
                              : t('quizQuestions.fieldTypes.radio')}
                          </Badge>
                        </div>
                        {qf.included && (
                          <div className="mt-3 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label htmlFor={`correct-${field.id}`}>{t('quizQuestions.correctAnswer')}</Label>
                                <Select
                                  value={qf.correctAnswer}
                                  onValueChange={(value) => updateCorrectAnswer(field.id, value)}
                                >
                                  <SelectTrigger id={`correct-${field.id}`}>
                                    <SelectValue placeholder={t('quizQuestions.selectCorrectAnswer')} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {field.options.map((option) => (
                                      <SelectItem key={option} value={option}>{option}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`marks-${field.id}`}>{t('quizQuestions.marks')}</Label>
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

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
            {t('actions.cancel')}
          </Button>
          <Button type="submit" disabled={isSaving || selectionFields.length === 0}>
            {isSaving
              ? t('actions.saving')
              : mode === 'create'
              ? t('actions.create')
              : t('actions.update')}
          </Button>
        </div>
      </form>
    </div>
  );
};
