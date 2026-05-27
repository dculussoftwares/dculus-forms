// apps/form-app/src/hooks/useAIChat.ts
import { useState, useCallback } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { toastError } from '@dculus/ui';
import { useFormBuilderStore } from '../store/useFormBuilderStore';
import {
  LIST_AI_CHAT_CONVERSATIONS,
  GET_AI_CHAT_CONVERSATION,
  CREATE_AI_CHAT_CONVERSATION,
  DELETE_AI_CHAT_CONVERSATION,
  RENAME_AI_CHAT_CONVERSATION,
} from '../graphql/aiChat';
import { useAIStream } from './useAIStream';
import { useYjsUndoManager } from './useYjsUndoManager';
import { applyAIOp } from '../lib/applyAIOp';

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  operations?: object[] | null;
  createdAt: string;
  isStreaming?: boolean;
  streamingText?: string;
  streamingOps?: { type: string; label: string }[];
}

export function buildOpLabel(op: Record<string, unknown>): string {
  switch (op?.type) {
    case 'ADD_FIELD': return `Added "${(op.label as string) ?? 'field'}"`;
    case 'UPDATE_FIELD': return 'Updated field';
    case 'REMOVE_FIELD': return 'Removed field';
    case 'REORDER_FIELDS': return 'Reordered fields';
    case 'UPDATE_LAYOUT': return 'Updated layout';
    default: return 'Changed form';
  }
}

export function useAIChat({
  formId,
  organizationId,
}: {
  formId: string;
  organizationId: string;
}) {
  const store = useFormBuilderStore();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<AIChatMessage | null>(null);

  const { canUndo, beginBatch, clearBatch, undo } = useYjsUndoManager();

  const { data: conversationsData, refetch: refetchConversations } = useQuery(
    LIST_AI_CHAT_CONVERSATIONS,
    { variables: { formId, organizationId }, skip: !formId }
  );

  const { data: activeConvData, refetch: refetchActiveConversation } = useQuery(
    GET_AI_CHAT_CONVERSATION,
    {
      variables: { id: activeConversationId!, organizationId },
      skip: !activeConversationId,
    }
  );

  const [createConvMutation] = useMutation(CREATE_AI_CHAT_CONVERSATION);
  const [deleteConvMutation] = useMutation(DELETE_AI_CHAT_CONVERSATION);
  const [renameConvMutation] = useMutation(RENAME_AI_CHAT_CONVERSATION);

  const { isStreaming: streamActive, sendMessage: streamSend, cancel: cancelStream } = useAIStream(
    organizationId,
    {
      onTextDelta: (delta) => {
        setStreamingMessage((prev) =>
          prev ? { ...prev, streamingText: (prev.streamingText ?? '') + delta } : null
        );
      },
      onOperation: (op) => {
        applyAIOp(op, store);
        const label = buildOpLabel(op as Record<string, unknown>);
        setStreamingMessage((prev) =>
          prev
            ? { ...prev, streamingOps: [...(prev.streamingOps ?? []), { type: (op as any).type, label }] }
            : null
        );
      },
      onDone: (_messageId) => {
        setIsStreaming(false);
        setStreamingMessage(null);
        refetchActiveConversation();
        refetchConversations();
      },
      onError: (error) => {
        setIsStreaming(false);
        setStreamingMessage(null);
        const isLimit = error.includes('token limit');
        toastError('AI Error', isLimit ? error : 'AI processing failed. Please try again.');
      },
    }
  );

  const cancel = useCallback(() => {
    cancelStream();
    setIsStreaming(false);
    setStreamingMessage(null);
  }, [cancelStream]);

  const createConversation = useCallback(async () => {
    const { data } = await createConvMutation({ variables: { formId, organizationId } });
    const conv = data?.createAIChatConversation;
    if (conv) {
      setActiveConversationId(conv.id);
      refetchConversations();
    }
    return conv ?? null;
  }, [formId, organizationId, createConvMutation, refetchConversations]);

  const selectConversation = useCallback((id: string) => {
    setIsStreaming(false);
    setStreamingMessage(null);
    setActiveConversationId(id);
  }, []);

  const deleteConversation = useCallback(
    async (id: string) => {
      await deleteConvMutation({ variables: { id, organizationId } });
      if (id === activeConversationId) setActiveConversationId(null);
      refetchConversations();
    },
    [organizationId, activeConversationId, deleteConvMutation, refetchConversations]
  );

  const renameConversation = useCallback(
    async (id: string, title: string) => {
      await renameConvMutation({ variables: { id, organizationId, title } });
      refetchConversations();
      if (id === activeConversationId) refetchActiveConversation();
    },
    [organizationId, activeConversationId, renameConvMutation, refetchConversations, refetchActiveConversation]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (!activeConversationId || streamActive) return;
      clearBatch();
      beginBatch();
      // Use the page the user is currently viewing; fall back to first page
      const currentPageId: string | undefined =
        (store as any).selectedPageId ?? (store.pages as any[])[0]?.id;

      setStreamingMessage({
        id: 'streaming',
        role: 'assistant',
        content: '',
        streamingText: '',
        streamingOps: [],
        isStreaming: true,
        createdAt: new Date().toISOString(),
      });
      setIsStreaming(true);

      await streamSend(activeConversationId, content, currentPageId);
    },
    [activeConversationId, streamActive, clearBatch, beginBatch, store.pages, streamSend]
  );

  const conversations = conversationsData?.listAIChatConversations ?? [];
  const activeConversation = activeConvData?.getAIChatConversation ?? null;
  const messages: AIChatMessage[] = [
    ...(activeConversation?.messages ?? []),
    ...(streamingMessage ? [streamingMessage] : []),
  ];

  return {
    conversations,
    activeConversationId,
    activeConversation,
    messages,
    isStreaming,
    canUndo,
    undo,
    cancel,
    createConversation,
    selectConversation,
    deleteConversation,
    renameConversation,
    sendMessage,
  };
}
