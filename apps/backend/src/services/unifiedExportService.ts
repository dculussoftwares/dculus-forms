import * as XLSX from 'xlsx';
import { FormResponse, FormSchema, FillableFormField, FieldType } from '@dculus/types';

export type ExportFormat = 'excel' | 'csv';

export interface UnifiedExportData {
  formTitle: string;
  responses: FormResponse[];
  formSchema: FormSchema;
  format: ExportFormat;
}

export interface ExportResult {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

// Helper function to format values based on field type
const formatFieldValue = (value: any, fieldType?: FieldType, format: ExportFormat = 'excel'): string => {
  if (value === null || value === undefined) return '';

  // Handle arrays (checkboxes, multi-select)
  if (Array.isArray(value)) {
    return format === 'csv' ? value.join('; ') : value.join(', ');
  }

  // Convert to string
  let stringValue = String(value);
  
  // Handle specific field types
  if (fieldType) {
    switch (fieldType) {
      case FieldType.DATE_FIELD:
        const timestamp = typeof value === 'string' ? parseInt(value, 10) : value;
        const date = new Date(timestamp);
        stringValue = isNaN(date.getTime()) ? 'Invalid date' : date.toLocaleDateString();
        break;
      default:
        // Use the string value as is
        break;
    }
  }

  // CSV-specific escaping
  if (format === 'csv') {
    if (stringValue.includes('"') || stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('\r')) {
      stringValue = '"' + stringValue.replace(/"/g, '""') + '"';
    }
  }

  return stringValue;
};

// Helper function to escape CSV field names
const escapeCsvFieldName = (fieldName: string): string => {
  if (fieldName.includes('"') || fieldName.includes(',') || fieldName.includes('\n') || fieldName.includes('\r')) {
    return '"' + fieldName.replace(/"/g, '""') + '"';
  }
  return fieldName;
};

// Extract field information from responses or schema
const extractFieldInfo = (formSchema: FormSchema, responses: FormResponse[]): { fieldInfo: Record<string, string>, orderedFieldIds: string[] } => {
  let fieldInfo: Record<string, string> = {};
  let orderedFieldIds: string[] = [];

  if (formSchema.pages.length === 0 && responses.length > 0) {
    console.log('Unified Export - Form schema is empty, extracting field info from response data...');
    
    // Get all unique field IDs from all responses
    const allFieldIds = new Set<string>();
    responses.forEach(response => {
      Object.keys(response.data).forEach(fieldId => {
        allFieldIds.add(fieldId);
      });
    });
    
    // Convert to array and sort for consistent column order
    orderedFieldIds = Array.from(allFieldIds).sort();
    
    // Create a mapping of field ID to a human-readable label
    orderedFieldIds.forEach(fieldId => {
      let label = fieldId;
      if (fieldId.includes('field-')) {
        const parts = fieldId.split('-');
        if (parts.length > 2) {
          label = `Field ${parts[2]}`;
        } else {
          label = `Field ${fieldId.slice(0, 8)}`;
        }
      } else if (fieldId.length > 20) {
        label = `Field ${fieldId.slice(0, 8)}`;
      }
      fieldInfo[fieldId] = label;
    });
    
    console.log('Unified Export - Extracted field info:', Object.keys(fieldInfo).length, 'fields');
  } else {
    // Extract field info from form schema
    formSchema.pages.forEach(page => {
      page.fields.forEach(field => {
        if (field.type && field.id && 'label' in field && (field as any).label) {
          fieldInfo[field.id] = (field as any).label;
          orderedFieldIds.push(field.id);
        }
      });
    });
  }

  return { fieldInfo, orderedFieldIds };
};

// Generate CSV content
const generateCsvContent = (data: UnifiedExportData): string => {
  const { formTitle, responses, formSchema } = data;
  const { fieldInfo, orderedFieldIds } = extractFieldInfo(formSchema, responses);

  // Build CSV header
  const headers = ['Response ID', 'Submitted At'];
  orderedFieldIds.forEach(fieldId => {
    headers.push(escapeCsvFieldName(fieldInfo[fieldId]));
  });
  
  // Start CSV content with header row
  let csvContent = headers.join(',') + '\n';

  // Add data rows
  responses.forEach(response => {
    const row: string[] = [];
    
    // Add basic fields
    row.push(escapeCsvFieldName(response.id));
    row.push(escapeCsvFieldName(new Date(
      typeof response.submittedAt === 'string' 
        ? parseInt(response.submittedAt, 10) 
        : response.submittedAt
    ).toLocaleString('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })));

    // Add form field data in consistent order
    orderedFieldIds.forEach(fieldId => {
      const value = response.data[fieldId];
      
      // Find field type if available from schema
      let fieldType: FieldType | undefined;
      if (formSchema.pages.length > 0) {
        for (const page of formSchema.pages) {
          const field = page.fields.find(f => f.id === fieldId);
          if (field) {
            fieldType = field.type;
            break;
          }
        }
      }
      
      row.push(formatFieldValue(value, fieldType, 'csv'));
    });

    csvContent += row.join(',') + '\n';
  });

  console.log(`Unified Export - Generated CSV with ${responses.length} rows and ${headers.length} columns`);
  return csvContent;
};

// Generate Excel content
const generateExcelContent = (data: UnifiedExportData): Buffer => {
  const { formTitle, responses, formSchema } = data;
  const { fieldInfo, orderedFieldIds } = extractFieldInfo(formSchema, responses);

  // Prepare data for Excel export
  const excelData = responses.map((response: FormResponse) => {
    const row: any = {
      'Response ID': response.id,
      'Submitted At': new Date(
        typeof response.submittedAt === 'string' 
          ? parseInt(response.submittedAt, 10) 
          : response.submittedAt
      ).toLocaleString('en-US', {
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }),
    };

    // Add form field data in consistent order
    orderedFieldIds.forEach(fieldId => {
      const value = response.data[fieldId];
      
      // Find field type if available from schema
      let fieldType: FieldType | undefined;
      if (formSchema.pages.length > 0) {
        for (const page of formSchema.pages) {
          const field = page.fields.find(f => f.id === fieldId);
          if (field) {
            fieldType = field.type;
            break;
          }
        }
      }
      
      row[fieldInfo[fieldId]] = formatFieldValue(value, fieldType, 'excel') || '';
    });

    return row;
  });

  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(excelData);

  // Auto-size columns based on content
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  const colWidths: any[] = [];
  
  for (let C = range.s.c; C <= range.e.c; ++C) {
    let maxWidth = 10; // minimum width
    for (let R = range.s.r; R <= range.e.r; ++R) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = worksheet[cellAddress];
      if (cell && cell.v) {
        const cellValue = String(cell.v);
        maxWidth = Math.max(maxWidth, Math.min(cellValue.length + 2, 50)); // max width 50
      }
    }
    colWidths[C] = { wch: maxWidth };
  }
  worksheet['!cols'] = colWidths;

  // Add the worksheet to the workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Responses');

  // Generate buffer
  const buffer = XLSX.write(workbook, { 
    type: 'buffer', 
    bookType: 'xlsx',
    compression: true
  });

  console.log(`Unified Export - Generated Excel with ${responses.length} rows and ${orderedFieldIds.length + 2} columns`);
  return Buffer.from(buffer);
};

/**
 * Generate export file (Excel or CSV) from form responses
 */
export async function generateExportFile(data: UnifiedExportData): Promise<ExportResult> {
  const { formTitle, format } = data;

  console.log(`Unified Export - Generating ${format.toUpperCase()} export for form: ${formTitle}`);
  console.log(`Unified Export - Form schema pages: ${data.formSchema.pages.length}`);
  console.log(`Unified Export - Total responses: ${data.responses.length}`);

  let buffer: Buffer;
  let filename: string;
  let contentType: string;

  if (format === 'excel') {
    buffer = generateExcelContent(data);
    filename = generateExcelFilename(formTitle);
    contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  } else {
    const csvContent = generateCsvContent(data);
    buffer = Buffer.from(csvContent, 'utf-8');
    filename = generateCsvFilename(formTitle);
    contentType = 'text/csv';
  }

  console.log(`Unified Export - Generated ${format.toUpperCase()} file, size: ${buffer.length} bytes`);

  return {
    buffer,
    filename,
    contentType
  };
}

/**
 * Generate filename for Excel export
 */
export function generateExcelFilename(formTitle: string): string {
  const sanitizedTitle = formTitle.replace(/[^a-zA-Z0-9]/g, '_');
  const timestamp = new Date().toISOString().split('T')[0];
  return `${sanitizedTitle}_responses_${timestamp}.xlsx`;
}

/**
 * Generate filename for CSV export
 */
export function generateCsvFilename(formTitle: string): string {
  const sanitizedTitle = formTitle.replace(/[^a-zA-Z0-9]/g, '_');
  const timestamp = new Date().toISOString().split('T')[0];
  return `${sanitizedTitle}_responses_${timestamp}.csv`;
}