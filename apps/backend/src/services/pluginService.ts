import { generateId } from '@dculus/utils';
import { pluginRepository } from '../repositories/index.js';

/**
 * CRUD-facing plugin service (FormPlugin, PluginDelivery, PluginBackfillJob).
 * Distinct from `plugins/` (the plugin *execution* system — registry,
 * executor, event emitter, per-type handlers), which this service does not
 * touch or replace.
 */

export interface CreateFormPluginInput {
  formId: string;
  type: string;
  name: string;
  config: any;
  events: string[];
  enabled?: boolean;
}

export interface UpdateFormPluginInput {
  name?: string;
  config?: any;
  events?: string[];
  enabled?: boolean;
}

export const listPluginsByForm = async (formId: string) =>
  pluginRepository.listByForm(formId);

export const listEnabledPluginConfigsByForm = async (formId: string) =>
  pluginRepository.listEnabledByForm(formId);

export const getPluginById = async (id: string) =>
  pluginRepository.findById(id);

export const getPluginByIdWithForm = async (id: string) =>
  pluginRepository.findByIdWithForm(id);

export const createPlugin = async (input: CreateFormPluginInput) =>
  pluginRepository.create({
    data: {
      id: generateId(),
      formId: input.formId,
      type: input.type,
      name: input.name,
      config: input.config,
      events: input.events,
      enabled: input.enabled ?? true,
    },
  });

export const updatePlugin = async (id: string, input: UpdateFormPluginInput) =>
  pluginRepository.update({
    where: { id },
    data: {
      ...input,
      updatedAt: new Date(),
    },
  });

export const deletePlugin = async (id: string) =>
  pluginRepository.delete({ where: { id } });

export const listPluginDeliveries = async (pluginId: string, limit = 50) =>
  pluginRepository.listDeliveriesByPlugin(pluginId, limit);

export const getBackfillJobById = async (id: string) =>
  pluginRepository.findBackfillJobById(id);
