import { prisma } from '../lib/prisma.js';
import { 
  Form as IForm, 
  FormSchema, 
  FormPage, 
  FormField, 
  FormLayout,
  ThemeType,
  SpacingType,
  LayoutCode,
  PageModeType
} from '@dculus/types';
import { initializeHocuspocusDocument } from './hocuspocus.js';
import { generateShortUrl } from '@dculus/utils';

export interface Form extends Omit<IForm, 'formSchema'> {
  formSchema: any; // JsonValue from Prisma
  settings?: any; // JsonValue from Prisma - includes thankYou settings
}

export type { FormSchema, FormPage, FormField, FormLayout, ThemeType, SpacingType };

const generateUniqueShortUrl = async (): Promise<string> => {
  let shortUrl: string;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!isUnique && attempts < maxAttempts) {
    shortUrl = await generateShortUrl(8); // Generate 8-character short URL
    
    // Check if this short URL already exists
    const existingForm = await prisma.form.findUnique({
      where: { shortUrl },
    });
    
    if (!existingForm) {
      isUnique = true;
      return shortUrl;
    }
    
    attempts++;
  }
  
  // If we couldn't generate a unique short URL after max attempts, use a longer one
  return await generateShortUrl(12);
};

export const getAllForms = async (organizationId?: string): Promise<Form[]> => {
  const forms = await prisma.form.findMany({
    where: organizationId ? { organizationId } : {},
    orderBy: { createdAt: 'desc' },
    include: {
      organization: true,
      createdBy: true,
    },
  });
  
  return forms.map((form: any) => ({
    ...form,
    description: form.description || undefined,
  }));
};

export const getFormById = async (id: string): Promise<Form | null> => {
  try {
    const form = await prisma.form.findUnique({
      where: { id },
      include: {
        organization: true,
        createdBy: true,
      },
    });
    
    if (!form) return null;
    
    return {
      ...form,
      description: form.description || undefined,
    };
  } catch (error) {
    console.error('Error fetching form by ID:', error);
    return null;
  }
};

export const getFormByShortUrl = async (shortUrl: string): Promise<Form | null> => {
  try {
    const form = await prisma.form.findUnique({
      where: { shortUrl },
      include: {
        organization: true,
        createdBy: true,
      },
    });
    
    if (!form) return null;
    
    return {
      ...form,
      description: form.description || undefined,
    };
  } catch (error) {
    console.error('Error fetching form by short URL:', error);
    return null;
  }
};

export const createForm = async (
  formData: Omit<Form, 'createdAt' | 'updatedAt' | 'formSchema'>, 
  templateFormSchema?: FormSchema
): Promise<Form> => {
  // Create a default form schema if no template is provided
  const defaultFormSchema: FormSchema = {
    pages: [],
    layout: {
      theme: ThemeType.LIGHT,
      textColor: '#000000',
      spacing: SpacingType.NORMAL,
      code: 'L1' as LayoutCode,
      content: '',
      customBackGroundColor: '#ffffff',
      customCTAButtonName: 'Submit',
      backgroundImageKey: '',
      pageMode: PageModeType.MULTIPAGE
    },
    isShuffleEnabled: false
  };
  
  // Generate unique short URL
  const shortUrl = await generateUniqueShortUrl();
  
  // Create form without formSchema field in database
  const newForm = await prisma.form.create({
    data: {
      id: formData.id,
      title: formData.title,
      description: formData.description,
      shortUrl,
      formSchema: {}, // Store empty object as placeholder
      isPublished: formData.isPublished || false,
      organizationId: formData.organizationId,
      createdById: formData.createdById,
    },
    include: {
      organization: true,
      createdBy: true,
    },
  });
  
  const result = {
    ...newForm,
    description: newForm.description || undefined,
  };

  // Initialize Hocuspocus document for collaborative editing
  const schemaToInitialize = templateFormSchema || defaultFormSchema;
  console.log(`🔄 Initializing Hocuspocus document for form: ${result.id}`);
  
  try {
    await initializeHocuspocusDocument(result.id, schemaToInitialize);
    console.log(`✅ Hocuspocus document initialized successfully for form: ${result.id}`);
  } catch (error) {
    console.error(`❌ Failed to initialize Hocuspocus document for form ${result.id}:`, error);
    console.warn(`⚠️ Form ${result.id} created but collaboration initialization failed`);
  }

  return result;
};

export const updateForm = async (id: string, formData: Partial<Omit<Form, 'id' | 'createdAt' | 'updatedAt' | 'organizationId' | 'createdById' | 'shortUrl'>>): Promise<Form | null> => {
  try {
    const updateData: any = {};
    
    if (formData.title) updateData.title = formData.title;
    if (formData.description !== undefined) updateData.description = formData.description;
    if (formData.isPublished !== undefined) updateData.isPublished = formData.isPublished;
    if (formData.settings !== undefined) updateData.settings = formData.settings;
    
    const updatedForm = await prisma.form.update({
      where: { id },
      data: updateData,
      include: {
        organization: true,
        createdBy: true,
      },
    });
    
    return {
      ...updatedForm,
      description: updatedForm.description || undefined,
    };
  } catch (error) {
    console.error('Error updating form:', error);
    throw error; // Re-throw to let GraphQL handle the error message
  }
};

export const regenerateShortUrl = async (id: string): Promise<Form | null> => {
  try {
    // Generate a new unique short URL
    const newShortUrl = await generateUniqueShortUrl();
    
    const updatedForm = await prisma.form.update({
      where: { id },
      data: { shortUrl: newShortUrl },
      include: {
        organization: true,
        createdBy: true,
      },
    });
    
    return {
      ...updatedForm,
      description: updatedForm.description || undefined,
    };
  } catch (error) {
    console.error('Error regenerating short URL:', error);
    throw error;
  }
};

export const deleteForm = async (id: string): Promise<boolean> => {
  try {
    await prisma.form.delete({
      where: { id },
    });
    return true;
  } catch (error) {
    console.error('Error deleting form:', error);
    return false;
  }
};
