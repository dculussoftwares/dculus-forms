import type { PluginConfig } from '../core/types.js';

export interface AiTaggerTagConfig {
  tagId: string;
  name: string;
  color: string;
  definition: string;
}

export interface AiTaggerPluginConfig extends PluginConfig {
  type: 'ai-tagger';
  tags: AiTaggerTagConfig[];
}

export const AI_TAGGER_PLUGIN_TYPE = 'ai-tagger' as const;

export const aiTaggerMetadataKey = (pluginId: string) => `ai-tagger:${pluginId}`;

export interface AiTaggerResult {
  success: boolean;
  /** Tag IDs that were assigned to the response. */
  tagsApplied: string[];
  /** Human-readable tag names that were assigned (parallel array to tagsApplied). */
  tagsAppliedNames?: string[];
  tagsConsidered: number;
  tokensUsed: number;
  taggedAt?: string;
  error?: string;
}
