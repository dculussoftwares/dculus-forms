import { prisma } from '../lib/prisma.js';
import { FormSchema, deserializeFormSchema } from '@dculus/types';
import { generateId } from '@dculus/utils';

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

    if (formSchema?.pages) {
      for (const page of formSchema.pages) {
        if (page?.fields) {
          for (const field of page.fields) {
            if (field?.id) {
              metadata[field.id] = {
                label: (field as any).label || field.id,
                type: field.type || 'unknown'
              };
            }
          }
        }
      }
    }

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
    await prisma.responseEditHistory.create({
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
      prisma.responseFieldChange.create({
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
   * Creates a snapshot of response data
   */
  static async createSnapshot(
    responseId: string,
    data: Record<string, any>,
    snapshotType: 'EDIT' | 'MANUAL' | 'SCHEDULED' = 'EDIT',
    createdById?: string
  ): Promise<void> {
    await prisma.responseSnapshot.create({
      data: {
        id: generateId(),
        responseId,
        snapshotData: data,
        snapshotType,
        createdById
      }
    });
  }

  /**
   * Gets edit history for a response
   */
  static async getEditHistory(responseId: string) {
    return await prisma.responseEditHistory.findMany({
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
   * Gets snapshots for a response
   */
  static async getSnapshots(responseId: string) {
    return await prisma.responseSnapshot.findMany({
      where: {
        responseId,
        isRestorable: true
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        }
      },
      orderBy: { snapshotAt: 'desc' }
    });
  }

  /**
   * Restores response data from a snapshot
   */
  static async restoreFromSnapshot(
    responseId: string,
    snapshotId: string,
    restoredById: string
  ): Promise<Record<string, any>> {
    const snapshot = await prisma.responseSnapshot.findFirst({
      where: {
        id: snapshotId,
        responseId,
        isRestorable: true
      }
    });

    if (!snapshot) {
      throw new Error('Snapshot not found or not restorable');
    }

    const snapshotData = snapshot.snapshotData as Record<string, any>;

    // Update the response with snapshot data
    await prisma.response.update({
      where: { id: responseId },
      data: { data: snapshotData }
    });

    // Create a new snapshot of the restoration
    await this.createSnapshot(responseId, snapshotData, 'MANUAL', restoredById);

    return snapshotData;
  }

  /**
   * Gets response with form schema for change detection
   */
  static async getResponseWithFormSchema(responseId: string) {
    const response = await prisma.response.findUnique({
      where: { id: responseId },
      include: {
        form: {
          select: {
            formSchema: true
          }
        }
      }
    });

    if (!response) {
      throw new Error('Response not found');
    }

    const formSchema = deserializeFormSchema(response.form.formSchema);

    return {
      response,
      formSchema
    };
  }
}