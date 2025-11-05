import { 
  FormSchema, 
  serializeFormSchema, 
  deserializeFormSchema 
} from '@dculus/types';
import { randomUUID } from 'crypto';
import { formTemplateRepository } from '../repositories/index.js';

export interface FormTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string;
  formSchema: FormSchema;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  category?: string;
  formSchema: FormSchema;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  category?: string;
  formSchema?: FormSchema;
  isActive?: boolean;
}

/**
 * Get all active templates, optionally filtered by category
 */
export const getAllTemplates = async (category?: string): Promise<FormTemplate[]> => {
  const templates = await formTemplateRepository.findMany({
    where: {
      isActive: true,
      ...(category && { category }),
    },
    orderBy: { createdAt: 'desc' },
  });

  return templates.map((template: any) => ({
    ...template,
    description: template.description || undefined,
    category: template.category || undefined,
    formSchema: deserializeFormSchema(template.formSchema),
  }));
};

/**
 * Get template by ID
 */
export const getTemplateById = async (id: string): Promise<FormTemplate | null> => {
  try {
    const template = await formTemplateRepository.findUnique({
      where: { id },
    });

    if (!template) return null;

    return {
      ...template,
      description: template.description || undefined,
      category: template.category || undefined,
      formSchema: deserializeFormSchema(template.formSchema),
    };
  } catch (error) {
    console.error('Error fetching template by ID:', error);
    return null;
  }
};

/**
 * Create a new form template
 */
export const createTemplate = async (templateData: CreateTemplateInput): Promise<FormTemplate> => {
  const newTemplate = await formTemplateRepository.create({
    data: {
      id: randomUUID(),
      name: templateData.name,
      description: templateData.description,
      category: templateData.category,
      formSchema: serializeFormSchema(templateData.formSchema) as any,
      isActive: true,
    },
  });

  return {
    ...newTemplate,
    description: newTemplate.description || undefined,
    category: newTemplate.category || undefined,
    formSchema: deserializeFormSchema(newTemplate.formSchema),
  };
};

/**
 * Update an existing template
 */
export const updateTemplate = async (
  id: string,
  templateData: UpdateTemplateInput
): Promise<FormTemplate | null> => {
  try {
    const updateData: any = {};
    
    if (templateData.name) updateData.name = templateData.name;
    if (templateData.description !== undefined) updateData.description = templateData.description;
    if (templateData.category !== undefined) updateData.category = templateData.category;
    if (templateData.formSchema) updateData.formSchema = serializeFormSchema(templateData.formSchema);
    if (templateData.isActive !== undefined) updateData.isActive = templateData.isActive;
    
    const updatedTemplate = await formTemplateRepository.update({
      where: { id },
      data: updateData,
    });

    return {
      ...updatedTemplate,
      description: updatedTemplate.description || undefined,
      category: updatedTemplate.category || undefined,
      formSchema: deserializeFormSchema(updatedTemplate.formSchema),
    };
  } catch (error) {
    console.error('Error updating template:', error);
    return null;
  }
};

/**
 * Delete a template (soft delete by setting isActive to false)
 */
export const deleteTemplate = async (id: string): Promise<boolean> => {
  try {
    await formTemplateRepository.update({
      where: { id },
      data: { isActive: false },
    });
    return true;
  } catch (error) {
    console.error('Error deleting template:', error);
    return false;
  }
};

/**
 * Hard delete a template
 */
export const hardDeleteTemplate = async (id: string): Promise<boolean> => {
  try {
    await formTemplateRepository.delete({
      where: { id },
    });
    return true;
  } catch (error) {
    console.error('Error hard deleting template:', error);
    return false;
  }
};

/**
 * Get templates by category
 */
export const getTemplatesByCategory = async (): Promise<Record<string, FormTemplate[]>> => {
  const templates = await getAllTemplates();
  
  const templatesByCategory: Record<string, FormTemplate[]> = {};
  
  templates.forEach((template) => {
    const category = template.category || 'Uncategorized';
    if (!templatesByCategory[category]) {
      templatesByCategory[category] = [];
    }
    templatesByCategory[category].push(template);
  });

  return templatesByCategory;
};

/**
 * Get template categories
 */
export const getTemplateCategories = async (): Promise<string[]> => {
  const templates = await formTemplateRepository.findMany({
    where: { isActive: true },
    select: { category: true },
    distinct: ['category'],
  });

  return templates
    .map((t: {category: string | null}) => t.category)
    .filter((category): category is string => Boolean(category))
    .sort();
};
