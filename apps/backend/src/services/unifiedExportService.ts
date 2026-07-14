import ExcelJS from 'exceljs';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { FormResponse, FormSchema, FieldType } from '@dculus/types';
import {
  getPluginTypesWithData,
  getPluginExport,
  pluginTypeFromMetadataKey,
} from '../plugins/core/exportRegistry.js';

import '../plugins/quiz/index.js';
import { logger } from '../lib/logger.js';

export type ExportFormat = 'excel' | 'csv';

export interface UnifiedExportData {
  formTitle: string;
  responses: FormResponse[];
  formSchema: FormSchema;
  format: ExportFormat;
  /**
   * Optional map of plugin type → plugin config JSON.  When supplied, the
   * export service passes each plugin's stored config to
   * `getColumnsWithConfig()` so plugins can honour user-configured column
   * names (e.g. the quiz plugin's `columnName` setting).
   */
  pluginConfigs?: Record<string, Record<string, any>>;
  /**
   * Only forms that actually capture respondent identity (accessControl or
   * collectRespondentEmail enabled) get a "Respondent Email" column — most
   * forms are anonymous and `response.respondentEmail` is always null there.
   */
  includeRespondentEmail?: boolean;
}

export interface ExportResult {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

// Helper function to format values based on field type
const formatFieldValue = (
  value: any,
  fieldType?: FieldType,
  format: ExportFormat = 'excel'
): string => {
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
      case FieldType.DATE_FIELD: {
        const str = String(value ?? '');
        if (!str) { stringValue = ''; break; }
        // YYYY-MM-DD string — parse as local date to avoid UTC day shift
        if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
          const [y, m, d] = str.substring(0, 10).split('-').map(Number);
          const date = new Date(y, m - 1, d);
          stringValue = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        } else {
          // Legacy: epoch-ms numeric string
          const timestamp = parseInt(str, 10);
          const date = new Date(timestamp);
          stringValue = isNaN(date.getTime()) ? str : date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        }
        break;
      }
      case FieldType.FILE_UPLOAD_FIELD: {
        // Values are arrays of R2 keys — export as comma-separated filenames
        if (Array.isArray(value)) {
          stringValue = value
            .map((key: string) => String(key).split('/').pop() || key)
            .join(format === 'csv' ? '; ' : ', ');
        }
        break;
      }
      case FieldType.PHONE_NUMBER_FIELD: {
        // Values are stored as a plain E.164 string — export in spaced
        // international format; fall back to the raw value if unparseable.
        const parsed = parsePhoneNumberFromString(stringValue);
        if (parsed) stringValue = parsed.formatInternational();
        break;
      }
      default:
        // Use the string value as is
        break;
    }
  }

  // CSV-specific escaping
  if (format === 'csv') {
    if (
      stringValue.includes('"') ||
      stringValue.includes(',') ||
      stringValue.includes('\n') ||
      stringValue.includes('\r')
    ) {
      stringValue = '"' + stringValue.replace(/"/g, '""') + '"';
    }
  }

  return stringValue;
};

// Helper function to escape CSV field names
const escapeCsvFieldName = (fieldName: string): string => {
  if (
    fieldName.includes('"') ||
    fieldName.includes(',') ||
    fieldName.includes('\n') ||
    fieldName.includes('\r')
  ) {
    return '"' + fieldName.replace(/"/g, '""') + '"';
  }
  return fieldName;
};

// Extract field information from responses or schema
const extractFieldInfo = (
  formSchema: FormSchema,
  responses: FormResponse[]
): { fieldInfo: Record<string, string>; orderedFieldIds: string[] } => {
  const fieldInfo: Record<string, string> = {};
  let orderedFieldIds: string[] = [];

  if (formSchema.pages.length === 0 && responses.length > 0) {
    logger.info(
      'Unified Export - Form schema is empty, extracting field info from response data...'
    );

    // Get all unique field IDs from all responses
    const allFieldIds = new Set<string>();
    responses.forEach((response) => {
      Object.keys(response.data).forEach((fieldId) => {
        allFieldIds.add(fieldId);
      });
    });

    // Convert to array and sort for consistent column order
    orderedFieldIds = Array.from(allFieldIds).sort();

    // Create a mapping of field ID to a human-readable label
    orderedFieldIds.forEach((fieldId) => {
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

    logger.info(
      'Unified Export - Extracted field info:',
      Object.keys(fieldInfo).length,
      'fields'
    );
  } else {
    // Active and soft-deleted fields from schema
    formSchema.pages.forEach((page) => {
      page.fields.forEach((field) => {
        if (field.type && field.id && 'label' in field && (field as any).label) {
          const label = (field as any).label;
          fieldInfo[field.id] = field.deleted
            ? `${label} (deleted)`
            : label;
          orderedFieldIds.push(field.id);
        }
      });
    });

    // Orphan field IDs: in response data but not in schema at all
    const knownIds = new Set(orderedFieldIds);
    const orphanIds = new Set<string>();
    responses.forEach((response) => {
      Object.keys(response.data).forEach((id) => {
        if (!knownIds.has(id)) orphanIds.add(id);
      });
    });
    orphanIds.forEach((id) => {
      fieldInfo[id] = 'Unknown field (deleted)';
      orderedFieldIds.push(id);
    });
  }

  return { fieldInfo, orderedFieldIds };
};

// Generate CSV content
const generateCsvContent = (data: UnifiedExportData): string => {
  const { responses, formSchema, pluginConfigs = {}, includeRespondentEmail } = data;
  const { fieldInfo, orderedFieldIds } = extractFieldInfo(
    formSchema,
    responses
  );

  // Get plugin types that have data in any response
  const activePluginTypes = getPluginTypesWithData(responses);

  // Build CSV header
  const headers = ['Response ID', 'Submitted At', 'Tags'];
  if (includeRespondentEmail) headers.push('Respondent Email');

  // Add plugin columns — use getColumnsWithConfig when available and config is present
  // activePluginTypes is now a list of metadata keys (e.g. 'quiz-grading:pluginId')
  activePluginTypes.forEach((metadataKey) => {
    const pluginType = pluginTypeFromMetadataKey(metadataKey);
    const pluginExport = getPluginExport(pluginType);
    if (pluginExport) {
      const config = pluginConfigs[metadataKey];
      const pluginColumns =
        config && pluginExport.getColumnsWithConfig
          ? pluginExport.getColumnsWithConfig(config)
          : pluginExport.getColumns();
      pluginColumns.forEach((col) => headers.push(escapeCsvFieldName(col)));
    }
  });

  // Add form field columns
  orderedFieldIds.forEach((fieldId) => {
    headers.push(escapeCsvFieldName(fieldInfo[fieldId]));
  });

  // P1-11: Accumulate rows in an array and join once at the end.
  // The previous pattern used string concatenation inside a loop which
  // caused O(n²) memory allocation behaviour at large response counts
  // because every `csvContent += ...` copies the entire accumulated string.
  const rows: string[] = [headers.join(',')];

  // Add data rows
  responses.forEach((response) => {
    const row: string[] = [];

    // Add basic fields
    row.push(escapeCsvFieldName(response.id));
    row.push(
      escapeCsvFieldName(
        new Date(
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
          hour12: false,
        })
      )
    );
    row.push(escapeCsvFieldName((response.tags ?? []).map((t) => t.name).join(', ')));
    if (includeRespondentEmail) row.push(escapeCsvFieldName(response.respondentEmail || ''));

    // Add plugin data
    activePluginTypes.forEach((metadataKey) => {
      const pluginType = pluginTypeFromMetadataKey(metadataKey);
      const pluginExport = getPluginExport(pluginType);
      if (pluginExport) {
        const pluginMetadata = response.metadata?.[metadataKey];
        const values = pluginExport.getValues(pluginMetadata);
        values.forEach((value) => {
          row.push(
            escapeCsvFieldName(
              value !== null && value !== undefined ? String(value) : ''
            )
          );
        });
      }
    });

    // Add form field data in consistent order
    orderedFieldIds.forEach((fieldId) => {
      const value = response.data[fieldId];

      // Find field type if available from schema
      let fieldType: FieldType | undefined;
      if (formSchema.pages.length > 0) {
        for (const page of formSchema.pages) {
          const field = page.fields.find((f) => f.id === fieldId);
          if (field) {
            fieldType = field.type;
            break;
          }
        }
      }

      row.push(formatFieldValue(value, fieldType, 'csv'));
    });

    rows.push(row.join(','));
  });

  // Calculate plugin column count for logging
  const pluginColumnCount = activePluginTypes.reduce((count, metadataKey) => {
    const pluginExport = getPluginExport(pluginTypeFromMetadataKey(metadataKey));
    if (!pluginExport) return count;
    const config = pluginConfigs[metadataKey];
    const cols =
      config && pluginExport.getColumnsWithConfig
        ? pluginExport.getColumnsWithConfig(config)
        : pluginExport.getColumns();
    return count + cols.length;
  }, 0);

  logger.info(
    `Unified Export - Generated CSV with ${responses.length} rows and ${headers.length} columns (${pluginColumnCount} plugin columns)`
  );
  return rows.join('\n');
};

// Generate Excel content using exceljs
const generateExcelContent = async (
  data: UnifiedExportData
): Promise<Buffer> => {
  const { responses, formSchema, pluginConfigs = {}, includeRespondentEmail } = data;
  const { fieldInfo, orderedFieldIds } = extractFieldInfo(
    formSchema,
    responses
  );

  // Get plugin types that have data in any response
  const activePluginTypes = getPluginTypesWithData(responses);

  // Create workbook and worksheet
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Responses');

  // Build headers
  const headers = ['Response ID', 'Submitted At', 'Tags'];
  if (includeRespondentEmail) headers.push('Respondent Email');

  // Add plugin columns to headers — use getColumnsWithConfig when available and config is present
  activePluginTypes.forEach((metadataKey) => {
    const pluginType = pluginTypeFromMetadataKey(metadataKey);
    const pluginExport = getPluginExport(pluginType);
    if (pluginExport) {
      const config = pluginConfigs[metadataKey];
      const cols =
        config && pluginExport.getColumnsWithConfig
          ? pluginExport.getColumnsWithConfig(config)
          : pluginExport.getColumns();
      headers.push(...cols);
    }
  });

  // Add form field columns
  orderedFieldIds.forEach((fieldId) => {
    headers.push(fieldInfo[fieldId]);
  });

  // Add header row with styling
  const headerRow = worksheet.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
  });

  // Add data rows
  responses.forEach((response: FormResponse) => {
    const rowData: any[] = [];

    // Add basic fields
    rowData.push(response.id);
    rowData.push(
      new Date(
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
        hour12: false,
      })
    );
    rowData.push((response.tags ?? []).map((t) => t.name).join(', '));
    if (includeRespondentEmail) rowData.push(response.respondentEmail || '');

    // Add plugin data
    activePluginTypes.forEach((metadataKey) => {
      const pluginType = pluginTypeFromMetadataKey(metadataKey);
      const pluginExport = getPluginExport(pluginType);
      if (pluginExport) {
        const pluginMetadata = response.metadata?.[metadataKey];
        const values = pluginExport.getValues(pluginMetadata);
        values.forEach((value) => {
          rowData.push(
            value !== null && value !== undefined ? String(value) : ''
          );
        });
      }
    });

    // Add form field data in consistent order
    orderedFieldIds.forEach((fieldId) => {
      const value = response.data[fieldId];

      // Find field type if available from schema
      let fieldType: FieldType | undefined;
      if (formSchema.pages.length > 0) {
        for (const page of formSchema.pages) {
          const field = page.fields.find((f) => f.id === fieldId);
          if (field) {
            fieldType = field.type;
            break;
          }
        }
      }

      rowData.push(formatFieldValue(value, fieldType, 'excel') || '');
    });

    worksheet.addRow(rowData);
  });

  // Auto-size columns based on content
  worksheet.columns.forEach((column, _index) => {
    let maxWidth = 10; // minimum width
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const cellValue = cell.value?.toString() || '';
      maxWidth = Math.max(maxWidth, Math.min(cellValue.length + 2, 50)); // max width 50
    });
    column.width = maxWidth;
  });

  // Calculate total columns (basic + plugin + form fields)
  const pluginColumnCount = activePluginTypes.reduce((count, metadataKey) => {
    const pluginExport = getPluginExport(pluginTypeFromMetadataKey(metadataKey));
    if (!pluginExport) return count;
    const config = pluginConfigs[metadataKey];
    const cols =
      config && pluginExport.getColumnsWithConfig
        ? pluginExport.getColumnsWithConfig(config)
        : pluginExport.getColumns();
    return count + cols.length;
  }, 0);
  const totalColumns = 3 + pluginColumnCount + orderedFieldIds.length; // 3 for Response ID + Submitted At + Tags

  logger.info(
    `Unified Export - Generated Excel with ${responses.length} rows and ${totalColumns} columns (${pluginColumnCount} plugin columns)`
  );

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};

/**
 * Generate export file (Excel or CSV) from form responses
 */
export async function generateExportFile(
  data: UnifiedExportData
): Promise<ExportResult> {
  const { formTitle, format } = data;

  logger.info(
    `Unified Export - Generating ${format.toUpperCase()} export for form: ${formTitle}`
  );
  logger.info(
    `Unified Export - Form schema pages: ${data.formSchema.pages.length}`
  );
  logger.info(`Unified Export - Total responses: ${data.responses.length}`);

  let buffer: Buffer;
  let filename: string;
  let contentType: string;

  if (format === 'excel') {
    buffer = await generateExcelContent(data);
    filename = generateExcelFilename(formTitle);
    contentType =
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  } else {
    const csvContent = generateCsvContent(data);
    buffer = Buffer.from(csvContent, 'utf-8');
    filename = generateCsvFilename(formTitle);
    contentType = 'text/csv';
  }

  logger.info(
    `Unified Export - Generated ${format.toUpperCase()} file, size: ${buffer.length} bytes`
  );

  return {
    buffer,
    filename,
    contentType,
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
