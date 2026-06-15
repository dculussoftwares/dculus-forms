/**
 * AI Tagger Plugin Export Columns
 *
 * Registers export columns so that AI-assigned tags appear in Excel/CSV exports.
 * The metadata key is 'ai-tagger:{pluginId}' (instance-scoped).
 */

import { PluginExportColumn, registerPluginExport } from '../core/exportRegistry.js';
import { logger } from '../../lib/logger.js';
import type { AiTaggerResult } from './types.js';
import { AI_TAGGER_PLUGIN_TYPE } from './types.js';

export const aiTaggerExportColumns: PluginExportColumn = {
  pluginType: AI_TAGGER_PLUGIN_TYPE,

  getColumns(): string[] {
    return ['AI Tags', 'AI Tags Count', 'AI Tagging Status'];
  },

  getColumnsWithConfig(_pluginConfig: Record<string, unknown>): string[] {
    return this.getColumns();
  },

  getValues(metadata: unknown): (string | number | null)[] {
    if (!metadata) {
      return [null, null, null];
    }

    const result = metadata as AiTaggerResult;

    if (!result.success) {
      return ['', 0, 'Error'];
    }

    const appliedTagIds: string[] = result.tagsApplied ?? [];

    // Use human-readable names when available (stored by handler as tagsAppliedNames),
    // falling back to raw IDs for legacy metadata that pre-dates this field.
    const appliedTagNames: string[] = result.tagsAppliedNames && result.tagsAppliedNames.length > 0
      ? result.tagsAppliedNames
      : appliedTagIds;
    const tagDisplay = appliedTagNames.join(', ');

    return [
      tagDisplay,
      appliedTagIds.length,
      result.success ? 'Tagged' : 'Skipped',
    ];
  },
};

registerPluginExport(aiTaggerExportColumns);

logger.info('AI Tagger plugin export columns registered');
