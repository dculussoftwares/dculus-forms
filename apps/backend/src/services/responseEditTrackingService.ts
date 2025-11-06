import { FormSchema, deserializeFormSchema, ThemeType, SpacingType, PageModeType } from '@dculus/types';
import { generateId } from '@dculus/utils';
import { responseRepository } from '../repositories/index.js';
import { logger } from '../lib/logger.js';

export interface FieldChange {
  fieldId: string;
  fieldLabel: string;
  fieldType: string;
  previousValue: any;
  newValue: any;
  changeType: 'ADD' | 'UPDATE' | 'DELETE';
  valueChangeSize?: number;
}

export interface EditContext {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  editType?: 'MANUAL' | 'SYSTEM' | 'BULK';
  editReason?: string;
}

/**
 * Service for tracking response edits with field-level change detection
 */
export class ResponseEditTrackingService {

  /**
   * Detects changes between old and new response data
   */
  static detectChanges(
    oldData: Record<string, any>,
    newData: Record<string, any>,
    formSchema: FormSchema
  ): FieldChange[] {
    const changes: FieldChange[] = [];

    // Create field metadata lookup from form schema
    const fieldMetadata = this.createFieldMetadataMap(formSchema);

    // Get all unique field IDs from both old and new data
    const allFieldIds = new Set([
      ...Object.keys(oldData || {}),
      ...Object.keys(newData || {})
    ]);

    for (const fieldId of allFieldIds) {
      const oldValue = oldData?.[fieldId];
      const newValue = newData?.[fieldId];
      const fieldInfo = fieldMetadata[fieldId];

      // Skip if values are equivalent
      if (this.areValuesEquivalent(oldValue, newValue)) {
        continue;
      }

      // Determine change type
      let changeType: 'ADD' | 'UPDATE' | 'DELETE';
      if (oldValue === undefined || oldValue === null || oldValue === '') {
        changeType = 'ADD';
      } else if (newValue === undefined || newValue === null || newValue === '') {
        changeType = 'DELETE';
      } else {
        changeType = 'UPDATE';
      }

      // Calculate value change size for text fields
      const valueChangeSize = this.calculateValueChangeSize(oldValue, newValue, fieldInfo?.type);

      changes.push({
        fieldId,
        fieldLabel: fieldInfo?.label || fieldId,
        fieldType: fieldInfo?.type || 'unknown',
        previousValue: oldValue,
        newValue: newValue,
        changeType,
        valueChangeSize
      });
    }

    return changes;
  }

  /**
   * Creates a metadata map for all fields in the form schema
   */
  private static createFieldMetadataMap(formSchema: FormSchema): Record<string, { label: string; type: string }> {
    const metadata: Record<string, { label: string; type: string }> = {};

    logger.info('Creating field metadata map from form schema');
    logger.info('Form schema structure:', JSON.stringify(formSchema, null, 2).substring(0, 500));

    if (formSchema?.pages) {
      logger.info(`Processing ${formSchema.pages.length} pages`);

      for (const page of formSchema.pages) {
        if (page?.fields) {
          logger.info(`Processing ${page.fields.length} fields from page "${page.title}"`);

          for (const field of page.fields) {
            if (field?.id) {
              // Debug: log the raw field object
              logger.info(`Raw field object keys:`, Object.keys(field));
              logger.info(`Field data:`, JSON.stringify(field, null, 2).substring(0, 300));

              // Extract label - check multiple possible properties
              let label = field.id; // Default fallback

              // Try different ways to access the label
              if ('label' in field && (field as any).label) {
                label = (field as any).label;
              }

              // Extract type - handle both string types and FieldType enum values
              let fieldType = 'unknown';
              if (field.type) {
                // Convert FieldType enum to string if needed
                fieldType = typeof field.type === 'string' ? field.type : String(field.type);
              } else if ((field as any).__type) {
                // Check for __type property (might be used in serialization)
                fieldType = (field as any).__type;
              }

              metadata[field.id] = {
                label,
                type: fieldType
              };

              logger.info(`✓ Field metadata: id=${field.id}, label=${label}, type=${fieldType}`);
            }
          }
        }
      }
    } else {
      logger.error('Form schema has no pages!');
    }

    logger.info('Final metadata map:', JSON.stringify(metadata, null, 2));
    return metadata;
  }

  /**
   * Checks if two values are equivalent (handles arrays, objects, and primitives)
   */
  private static areValuesEquivalent(value1: any, value2: any): boolean {
    // Handle null/undefined/empty string equivalence
    const isEmptyValue = (val: any) => val === null || val === undefined || val === '';
    if (isEmptyValue(value1) && isEmptyValue(value2)) {
      return true;
    }

    // Handle array comparison
    if (Array.isArray(value1) && Array.isArray(value2)) {
      if (value1.length !== value2.length) return false;
      return value1.every((item, index) => this.areValuesEquivalent(item, value2[index]));
    }

    // Handle object comparison
    if (typeof value1 === 'object' && typeof value2 === 'object' && value1 !== null && value2 !== null) {
      const keys1 = Object.keys(value1);
      const keys2 = Object.keys(value2);
      if (keys1.length !== keys2.length) return false;
      return keys1.every(key => this.areValuesEquivalent(value1[key], value2[key]));
    }

    // Handle string comparison (trim whitespace)
    if (typeof value1 === 'string' && typeof value2 === 'string') {
      return value1.trim() === value2.trim();
    }

    // Primitive comparison
    return value1 === value2;
  }

  /**
   * Calculates the size of change for text-based fields
   */
  private static calculateValueChangeSize(oldValue: any, newValue: any, fieldType?: string): number | undefined {
    if (!fieldType || !['text_input_field', 'text_area_field', 'email_field'].includes(fieldType)) {
      return undefined;
    }

    const oldStr = String(oldValue || '');
    const newStr = String(newValue || '');

    // Simple character difference calculation
    return Math.abs(newStr.length - oldStr.length);
  }

  /**
   * Creates a human-readable summary of changes
   */
  static createChangesSummary(changes: FieldChange[]): string {
    if (changes.length === 0) return 'No changes';

    const summary: string[] = [];

    const addChanges = changes.filter(c => c.changeType === 'ADD');
    const updateChanges = changes.filter(c => c.changeType === 'UPDATE');
    const deleteChanges = changes.filter(c => c.changeType === 'DELETE');

    if (addChanges.length > 0) {
      summary.push(`Added ${addChanges.length} field${addChanges.length > 1 ? 's' : ''}`);
    }

    if (updateChanges.length > 0) {
      summary.push(`Updated ${updateChanges.length} field${updateChanges.length > 1 ? 's' : ''}`);
    }

    if (deleteChanges.length > 0) {
      summary.push(`Removed ${deleteChanges.length} field${deleteChanges.length > 1 ? 's' : ''}`);
    }

    return summary.join(', ');
  }

  /**
   * Records edit history with field-level changes
   */
  static async recordEdit(
    responseId: string,
    oldData: Record<string, any>,
    newData: Record<string, any>,
    formSchema: FormSchema,
    editContext: EditContext
  ): Promise<void> {
    const changes = this.detectChanges(oldData, newData, formSchema);

    if (changes.length === 0) {
      // No changes detected, skip recording
      return;
    }

    const editHistoryId = generateId();
    const changesSummary = this.createChangesSummary(changes);

    // Create edit history record
    await responseRepository.createEditHistory({
      data: {
        id: editHistoryId,
        responseId,
        editedById: editContext.userId,
        editType: editContext.editType || 'MANUAL',
        editReason: editContext.editReason,
        ipAddress: editContext.ipAddress,
        userAgent: editContext.userAgent,
        totalChanges: changes.length,
        changesSummary
      }
    });

    // Create field change records
    const fieldChangePromises = changes.map(change =>
      responseRepository.createFieldChange({
        data: {
          id: generateId(),
          editHistoryId,
          fieldId: change.fieldId,
          fieldLabel: change.fieldLabel,
          fieldType: change.fieldType,
          previousValue: change.previousValue,
          newValue: change.newValue,
          changeType: change.changeType,
          valueChangeSize: change.valueChangeSize
        }
      })
    );

    await Promise.all(fieldChangePromises);
  }

  /**
   * Gets edit history for a response
   */
  static async getEditHistory(responseId: string) {
    return await responseRepository.findEditHistory({
      where: { responseId },
      include: {
        editedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        },
        fieldChanges: {
          orderBy: { fieldId: 'asc' }
        }
      },
      orderBy: { editedAt: 'desc' }
    });
  }

  /**
   * Gets response with form schema for change detection
   */
  static async getResponseWithFormSchema(responseId: string) {
    const response = await responseRepository.findUnique({
      where: { id: responseId },
      include: {
        form: {
          select: {
            id: true,
            formSchema: true
          }
        }
      }
    });

    if (!response) {
      throw new Error('Response not found');
    }

    // Try to get form schema from YJS first (primary source of truth for collaborative editing)
    let formSchema: FormSchema;
    try {
      // Import Hocuspocus service
      const { getFormSchemaFromHocuspocus } = await import('./hocuspocus.js');

      // Attempt to get schema from YJS/Hocuspocus
      const yjsSchemaData = await getFormSchemaFromHocuspocus(response.form.id);

      if (yjsSchemaData && yjsSchemaData.pages && yjsSchemaData.pages.length > 0) {
        logger.info(`Using form schema from YJS for form ${response.form.id}`);
        // Deserialize the YJS schema data
        formSchema = deserializeFormSchema(yjsSchemaData);
      } else {
        throw new Error('YJS schema empty or invalid');
      }
    } catch (yjsError) {
      logger.warn(`Failed to get schema from YJS for form ${response.form.id}, falling back to database:`, yjsError);

      // Fallback to database schema
      if (response.form.formSchema && JSON.stringify(response.form.formSchema) !== '{}') {
        formSchema = deserializeFormSchema(response.form.formSchema);
        logger.info(`Using form schema from database for form ${response.form.id}`);
      } else {
        logger.error(`No valid form schema found for form ${response.form.id}`);
        // Return empty schema with proper structure to prevent crashes
        formSchema = {
          pages: [],
          layout: {
            theme: ThemeType.LIGHT,
            textColor: '#000000',
            spacing: SpacingType.NORMAL,
            code: 'L1' as const,
            content: '',
            customBackGroundColor: '#ffffff',
            backgroundImageKey: '',
            pageMode: PageModeType.MULTIPAGE
          },
          isShuffleEnabled: false
        };
      }
    }

    return {
      response,
      formSchema
    };
  }
}
