/**
 * Utility functions for substituting field ID mentions with actual user response values
 * in rich text content (typically for thank you messages)
 */

/**
 * Substitutes field ID mentions in HTML content with actual user response values
 *
 * @param html - HTML content containing mentions like <span data-beautiful-mention="true" data-value="field-id">@field-id</span> or simple placeholders like {{field-id}}
 * @param responses - User responses as key-value pairs where key is field ID and value is the response
 * @param fieldLabels - Optional mapping of field IDs to human-readable labels for fallback display
 * @returns HTML with mentions replaced by actual values
 *
 * @example
 * ```typescript
 * const html = '<p>Dear <span data-beautiful-mention="true" data-value="first-name">@first-name</span>,</p>';
 * const responses = { 'first-name': 'John' };
 * const result = substituteMentions(html, responses);
 * // Result: '<p>Dear John,</p>'
 *
 * // Also supports simple placeholders:
 * const template = 'Hello {{name}}! Welcome to {{company}}.';
 * const data = { name: 'John', company: 'Acme Corp' };
 * const result2 = substituteMentions(template, data);
 * // Result: 'Hello John! Welcome to Acme Corp.'
 * ```
 */
export function substituteMentions(
  html: string,
  responses: Record<string, any>,
  fieldLabels?: Record<string, string>
): string {
  if (!html) return html;

  let result = html;

  // First, handle simple placeholder substitution {{field-id}}
  const placeholderRegex = /\{\{([^}]+)\}\}/g;
  result = result.replace(placeholderRegex, (match, fieldId) => {
    const responseValue = responses[fieldId];

    if (responseValue !== undefined && responseValue !== null && responseValue !== '') {
      // Convert response value to string and escape HTML special characters
      const valueStr = String(responseValue);
      return escapeHtml(valueStr);
    }

    // Fallback: try to show field label if available
    if (fieldLabels && fieldLabels[fieldId]) {
      const labelFallback = `[${fieldLabels[fieldId]}]`;
      return escapeHtml(labelFallback);
    }

    // Final fallback: show field ID in brackets
    const fieldIdFallback = `[${fieldId}]`;
    return escapeHtml(fieldIdFallback);
  });

  // Then, handle HTML mention spans - supports both formats:
  // 1. Original: <span data-beautiful-mention="true" data-value="FIELD_ID">content</span>
  // 2. Lexical: <span data-lexical-beautiful-mention="true" data-lexical-beautiful-mention-value="FIELD_ID">content</span>
  const mentionRegex = /<span[^>]+data-(?:lexical-)?beautiful-mention="true"[^>]+data-(?:lexical-beautiful-mention-)?value="([^"]+)"[^>]*>([^<]*)<\/span>/gi;

  result = result.replace(mentionRegex, (match, fieldId, originalContent) => {
    // Get the actual response value for this field ID
    const responseValue = responses[fieldId];

    if (responseValue !== undefined && responseValue !== null && responseValue !== '') {
      // Convert response value to string and escape HTML special characters
      const valueStr = String(responseValue);
      const escapedValue = escapeHtml(valueStr);
      return escapedValue;
    }

    // Fallback: try to show field label if available
    if (fieldLabels && fieldLabels[fieldId]) {
      const labelFallback = `[${fieldLabels[fieldId]}]`;
      return escapeHtml(labelFallback);
    }

    // Final fallback: show field ID in brackets
    const fieldIdFallback = `[${fieldId}]`;
    return escapeHtml(fieldIdFallback);
  });

  return result;
}

/**
 * Extracts field IDs from mention HTML content
 * 
 * @param html - HTML content containing mentions
 * @returns Array of unique field IDs found in the content
 */
export function extractMentionFieldIds(html: string): string[] {
  if (!html) return [];

  const mentionRegex = /<span[^>]+data-(?:lexical-)?beautiful-mention="true"[^>]+data-(?:lexical-beautiful-mention-)?value="([^"]+)"[^>]*>/gi;
  const fieldIds: string[] = [];
  let match;

  while ((match = mentionRegex.exec(html)) !== null) {
    const fieldId = match[1];
    if (fieldId && !fieldIds.includes(fieldId)) {
      fieldIds.push(fieldId);
    }
  }

  return fieldIds;
}

/**
 * Escapes HTML special characters to prevent XSS attacks
 * 
 * @param text - Text to escape
 * @returns Escaped text safe for HTML insertion
 */
function escapeHtml(text: string): string {
  if (!text) return text;
  
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  
  return text.replace(/[&<>"']/g, (match) => htmlEscapes[match] || match);
}

/**
 * Creates a field labels mapping from form schema
 * Helper function to extract field IDs and labels from deserialized form schema
 * 
 * @param formSchema - Deserialized form schema object
 * @returns Mapping of field IDs to labels
 */
export function createFieldLabelsMap(formSchema: any): Record<string, string> {
  const fieldLabels: Record<string, string> = {};
  
  if (!formSchema?.pages) return fieldLabels;
  
  for (const page of formSchema.pages) {
    if (!page?.fields) continue;
    
    for (const field of page.fields) {
      if (field?.id && field?.label) {
        fieldLabels[field.id] = field.label;
      }
    }
  }
  
  return fieldLabels;
}