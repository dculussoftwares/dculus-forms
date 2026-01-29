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
import { generateShortUrl, generateId } from '@dculus/utils';
import { sendFormPublishedNotification } from './emailService.js';
import { checkFormAccess, PermissionLevel } from '../graphql/resolvers/formSharing.js';
import { randomUUID } from 'crypto';
import { getFormSchemaFromHocuspocus } from './hocuspocus.js';
import { copyFileForForm } from './fileUploadService.js';
import { formRepository } from '../repositories/index.js';
import { logger } from '../lib/logger.js';

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
    const existingForm = await formRepository.findByShortUrl(shortUrl);

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
  const forms = await formRepository.listByOrganization(organizationId);

  return forms.map((form: any) => ({
    ...form,
    description: form.description || undefined,
  }));
};

export const getFormById = async (id: string): Promise<Form | null> => {
  try {
    const form = await formRepository.findById(id);

    if (!form) return null;

    return {
      ...form,
      description: form.description || undefined,
    };
  } catch (error) {
    logger.error('Error fetching form by ID:', error);
    return null;
  }
};

export const getFormByShortUrl = async (shortUrl: string): Promise<Form | null> => {
  try {
    const form = await formRepository.findByShortUrl(shortUrl);

    if (!form) return null;

    return {
      ...form,
      description: form.description || undefined,
    };
  } catch (error) {
    logger.error('Error fetching form by short URL:', error);
    return null;
  }
};

export const createForm = async (
  formData: Omit<Form, 'createdAt' | 'updatedAt' | 'formSchema'>,
  templateFormSchema?: FormSchema
): Promise<Form> => {
  const normalizedSettings = (() => {
    if (formData.settings === undefined || formData.settings === null) {
      return undefined;
    }
    if (typeof formData.settings === 'string') {
      try {
        return JSON.parse(formData.settings);
      } catch (error) {
        logger.warn(`⚠️ Failed to parse form settings for form ${formData.id ?? 'new'}`, error);
        return formData.settings;
      }
    }
    return formData.settings;
  })();

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
      pageMode: PageModeType.MULTIPAGE,
      isCustomBackgroundColorEnabled: false
    },
    isShuffleEnabled: false
  };

  // Generate unique short URL
  const shortUrl = await generateUniqueShortUrl();

  // Create form without formSchema field in database
  const newForm = await formRepository.createForm({
    id: formData.id,
    title: formData.title,
    description: formData.description,
    shortUrl,
    formSchema: {}, // Store empty object as placeholder
    isPublished: formData.isPublished || false,
    organizationId: formData.organizationId,
    createdById: formData.createdById,
    settings: normalizedSettings,
  });

  const result = {
    ...newForm,
    description: newForm.description || undefined,
  };

  // Create OWNER permission for the form creator
  try {
    await formRepository.createOwnerPermission({
      id: randomUUID(),
      formId: result.id,
      userId: formData.createdById,
      permission: 'OWNER',
      grantedById: formData.createdById, // Self-granted
    });
    logger.info(`✅ Created OWNER permission for form creator: ${result.id}`);
  } catch (error) {
    logger.error(`❌ Failed to create OWNER permission for form ${result.id}:`, error);
  }

  // Initialize Hocuspocus document for collaborative editing
  const schemaToInitialize = templateFormSchema || defaultFormSchema;
  logger.info(`🔄 Initializing Hocuspocus document for form: ${result.id}`);

  try {
    await initializeHocuspocusDocument(result.id, schemaToInitialize);
    logger.info(`✅ Hocuspocus document initialized successfully for form: ${result.id}`);
  } catch (error) {
    logger.error(`❌ Failed to initialize Hocuspocus document for form ${result.id}:`, error);
    logger.warn(`⚠️ Form ${result.id} created but collaboration initialization failed`);
  }

  return result;
};

export const duplicateForm = async (formId: string, userId: string): Promise<Form> => {
  const existingForm = await formRepository.findById(formId);

  if (!existingForm) {
    throw new Error('Form not found');
  }

  // Retrieve the latest schema from Hocuspocus
  const existingSchema = await getFormSchemaFromHocuspocus(formId);
  const schemaClone = existingSchema ? JSON.parse(JSON.stringify(existingSchema)) : undefined;

  const newFormId = generateId();

  // If form has background image, copy it for the new form
  if (schemaClone?.layout?.backgroundImageKey) {
    try {
      const copiedFile = await copyFileForForm(schemaClone.layout.backgroundImageKey, newFormId);
      schemaClone.layout.backgroundImageKey = copiedFile.key;

      await formRepository.createFormAsset({
        id: randomUUID(),
        key: copiedFile.key,
        type: 'FormBackground',
        formId: newFormId,
        originalName: copiedFile.originalName,
        url: copiedFile.url,
        size: copiedFile.size,
        mimeType: copiedFile.mimeType,
      });
    } catch (error) {
      logger.error(`❌ Failed to copy background image for duplicated form ${formId}:`, error);
      if (schemaClone?.layout) {
        schemaClone.layout.backgroundImageKey = '';
      }
    }
  }

  const duplicateTitle = existingForm.title
    ? `${existingForm.title} (Copy)`
    : 'Untitled Form (Copy)';

  const newForm = await createForm(
    {
      id: newFormId,
      title: duplicateTitle,
      description: existingForm.description || undefined,
      shortUrl: '',
      isPublished: false,
      organizationId: existingForm.organizationId,
      createdById: userId,
      settings: existingForm.settings || undefined,
    },
    schemaClone
  );

  return {
    ...newForm,
    description: newForm.description || undefined,
    settings: existingForm.settings || undefined,
  };
};

export const updateForm = async (id: string, formData: Partial<Omit<Form, 'id' | 'createdAt' | 'updatedAt' | 'organizationId' | 'createdById' | 'shortUrl'>>, userId?: string): Promise<Form | null> => {
  try {
    // First, get the current form state to check if it's being published
    const currentForm = await formRepository.findById(id);

    if (!currentForm) {
      throw new Error('Form not found');
    }

    // If userId is provided, validate permissions at service layer
    if (userId) {
      // Analyze formData to determine required permission level
      const hasProp = (prop: string) =>
        Object.prototype.hasOwnProperty.call(formData, prop);
      const hasLayoutChanges =
        ['title', 'description', 'settings'].some(hasProp);
      const hasCriticalChanges = hasProp('isPublished');

      // Determine required permission level based on update type
      let requiredPermission: string = PermissionLevel.EDITOR;

      if (hasCriticalChanges) {
        // Critical changes like publishing require OWNER
        requiredPermission = PermissionLevel.OWNER;
      } else if (hasLayoutChanges) {
        // Layout and content changes require EDITOR
        requiredPermission = PermissionLevel.EDITOR;
      }

      // Check if user has required access level
      const accessCheck = await checkFormAccess(userId, id, requiredPermission as any);
      if (!accessCheck.hasAccess) {
        const permissionName = requiredPermission === 'OWNER' ? 'owner' : 'editor';
        throw new Error(`Access denied: ${permissionName} permissions required for this type of update`);
      }

      logger.info(`✅ Permission validated for user ${userId} on form ${id}: ${requiredPermission}`);
    }

    const updateData: any = {};

    if (formData.title) updateData.title = formData.title;
    if (formData.description !== undefined) updateData.description = formData.description;
    if (formData.isPublished !== undefined) updateData.isPublished = formData.isPublished;
    if (formData.settings !== undefined) updateData.settings = formData.settings;

    const updatedForm = await formRepository.updateForm(id, updateData);

    // Check if form is being published (changed from false to true)
    const isBeingPublished = !currentForm.isPublished && formData.isPublished === true;

    if (isBeingPublished) {
      try {
        // Send email notification to form owner
        const formUrl = `${process.env.FORM_VIEWER_URL || 'http://localhost:5173'}/form/${updatedForm.shortUrl}`;

        await sendFormPublishedNotification({
          formTitle: updatedForm.title,
          formDescription: updatedForm.description || undefined,
          formUrl,
          ownerName: updatedForm.createdBy.name || updatedForm.createdBy.email,
        }, updatedForm.createdBy.email);

        logger.info(`Form published notification sent to: ${updatedForm.createdBy.email}`);
      } catch (emailError) {
        // Log email error but don't fail the form update
        logger.error('Failed to send form published notification:', emailError);
      }
    }

    return {
      ...updatedForm,
      description: updatedForm.description || undefined,
    };
  } catch (error) {
    logger.error('Error updating form:', error);
    throw error; // Re-throw to let GraphQL handle the error message
  }
};

export const regenerateShortUrl = async (id: string): Promise<Form | null> => {
  try {
    // Generate a new unique short URL
    const newShortUrl = await generateUniqueShortUrl();

    const updatedForm = await formRepository.updateForm(id, { shortUrl: newShortUrl });

    return {
      ...updatedForm,
      description: updatedForm.description || undefined,
    };
  } catch (error) {
    logger.error('Error regenerating short URL:', error);
    throw error;
  }
};

export const deleteForm = async (id: string, userId?: string): Promise<boolean> => {
  try {
    // If userId is provided, validate permissions at service layer
    if (userId) {
      // Check if user has OWNER access to delete this form
      const accessCheck = await checkFormAccess(userId, id, PermissionLevel.OWNER);
      if (!accessCheck.hasAccess) {
        throw new Error('Access denied: Only the form owner can delete this form');
      }

      logger.info(`✅ Permission validated for user ${userId} to delete form ${id}: OWNER`);
    }

    await formRepository.deleteForm(id);
    return true;
  } catch (error) {
    logger.error('Error deleting form:', error);
    return false;
  }
};
