// apps/form-app/src/components/form-builder/tool-parts/PluginProposalCard.tsx
import React, { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { Button, toastSuccess, toastError } from '@dculus/ui';
import { useFormBuilderStore } from '../../../store/useFormBuilderStore';
import { useTranslation } from '@/hooks';
import type { PluginProposal } from '@/store/types/store.types.ts';
import {
  CREATE_FORM_PLUGIN,
  UPDATE_FORM_PLUGIN,
  DELETE_FORM_PLUGIN,
  GET_FORM_PLUGINS,
} from '../../../graphql/plugins';

/**
 * Confirmation card for AI integration (plugin) proposals. Mirrors DestructiveActionCard,
 * but Accept applies the change via the plugin GraphQL mutations rather than the Y.js store —
 * plugins are Postgres rows, and createFormPlugin/updateFormPlugin/deleteFormPlugin enforce
 * OWNER access server-side as the final gate.
 */
const PluginProposalCard: React.FC = () => {
  const { t } = useTranslation('aiEditDrawer');
  const store = useFormBuilderStore();
  const { pendingPluginProposals, acceptPluginProposal, dismissPluginProposal } = store;
  const [busyId, setBusyId] = useState<string | null>(null);

  const formId = (store as any).formId as string | undefined;
  const refetch = { refetchQueries: [{ query: GET_FORM_PLUGINS, variables: { formId } }] };
  const [createPlugin] = useMutation(CREATE_FORM_PLUGIN, refetch);
  const [updatePlugin] = useMutation(UPDATE_FORM_PLUGIN, refetch);
  const [deletePlugin] = useMutation(DELETE_FORM_PLUGIN, refetch);

  if (pendingPluginProposals.length === 0) return null;

  const handleConfirm = async (proposal: PluginProposal) => {
    if (!formId && proposal.kind === 'create') return;
    setBusyId(proposal.id);
    try {
      if (proposal.kind === 'create') {
        await createPlugin({
          variables: {
            input: {
              formId,
              type: proposal.pluginType,
              name: proposal.name,
              config: proposal.config,
              events: proposal.events,
              enabled: true,
            },
          },
        });
      } else if (proposal.kind === 'update') {
        await updatePlugin({ variables: { id: proposal.pluginId, input: proposal.updates } });
      } else {
        await deletePlugin({ variables: { id: proposal.pluginId } });
      }
      acceptPluginProposal(proposal.id);
      toastSuccess(t('pluginProposal.appliedTitle'), t(`pluginProposal.applied.${proposal.kind}`, { values: { name: proposal.name } }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toastError(t('pluginProposal.failedTitle'), message);
    } finally {
      setBusyId(null);
    }
  };

  const renderConfig = (proposal: PluginProposal) => {
    if (proposal.kind === 'update') {
      return (
        <ul className="mt-1 space-y-0.5 text-xs text-indigo-800">
          {proposal.updates.name !== undefined && (
            <li>• {t('pluginProposal.renameTo', { values: { name: proposal.updates.name } })}</li>
          )}
          {proposal.updates.enabled !== undefined && (
            <li>• {proposal.updates.enabled ? t('pluginProposal.willEnable') : t('pluginProposal.willDisable')}</li>
          )}
        </ul>
      );
    }
    if (proposal.kind === 'delete') return null;

    const config = proposal.config ?? {};
    const lines: string[] = [];
    if (proposal.pluginType === 'webhook') {
      if (config.url) lines.push(`${t('pluginProposal.config.url')}: ${String(config.url)}`);
      // Never render the secret itself — mask it.
      if (config.secret) lines.push(`${t('pluginProposal.config.secret')}: ••••••••`);
    } else if (proposal.pluginType === 'email') {
      if (config.recipientEmail) lines.push(`${t('pluginProposal.config.recipient')}: ${String(config.recipientEmail)}`);
      if (config.recipientFieldLabel || config.recipientFieldId) {
        lines.push(`${t('pluginProposal.config.recipientField')}: ${String(config.recipientFieldLabel ?? config.recipientFieldId)}`);
      }
      if (config.sendToSubmitter) lines.push(t('pluginProposal.config.sendToSubmitter'));
      if (config.subject) lines.push(`${t('pluginProposal.config.subject')}: ${String(config.subject)}`);
    } else if (proposal.pluginType === 'quiz-grading') {
      const count = Array.isArray(config.quizFields) ? config.quizFields.length : 0;
      lines.push(t('pluginProposal.config.quizFields', { values: { count } }));
      if (config.passThreshold !== undefined) {
        lines.push(`${t('pluginProposal.config.passThreshold')}: ${String(config.passThreshold)}%`);
      }
    }
    if (lines.length === 0) return null;
    return (
      <ul className="mt-1 space-y-0.5 text-xs text-indigo-800">
        {lines.map((line, i) => (
          <li key={i} className="break-all">• {line}</li>
        ))}
      </ul>
    );
  };

  return (
    <div className="mt-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm" data-testid="plugin-proposal-card">
      <p className="mb-2 font-medium text-indigo-800">⚡ {t('pluginProposal.title')}</p>
      <div className="space-y-2">
        {pendingPluginProposals.map((proposal) => (
          <div key={proposal.id} className="rounded border border-indigo-100 bg-white p-2" data-testid={`plugin-proposal-${proposal.id}`}>
            <p className="text-xs font-medium text-indigo-950">
              {t(`pluginProposal.${proposal.kind}Title`, {
                values: { name: proposal.name, type: t(`pluginProposal.types.${proposal.pluginType}`) },
              })}
            </p>
            {renderConfig(proposal)}
            {proposal.rationale && (
              <p className="mt-1 text-xs text-indigo-700">{proposal.rationale}</p>
            )}
            <div className="mt-2 flex justify-end gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs"
                disabled={busyId === proposal.id}
                onClick={() => dismissPluginProposal(proposal.id)}
              >
                {t('pluginProposal.dismiss')}
              </Button>
              <Button
                size="sm"
                className="h-6 px-2 text-xs"
                disabled={busyId === proposal.id}
                onClick={() => handleConfirm(proposal)}
                data-testid={`plugin-proposal-confirm-${proposal.id}`}
              >
                {t(proposal.kind === 'delete' ? 'pluginProposal.confirmDelete' : 'pluginProposal.confirm')}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PluginProposalCard;
