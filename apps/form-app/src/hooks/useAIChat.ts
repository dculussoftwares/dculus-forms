// apps/form-app/src/hooks/useAIChat.ts
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
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
import { applyAIOp } from '../lib/applyAIOp';
import { useYjsUndoManager } from './useYjsUndoManager';
import { MUTATION_TOOL_NAMES, type FormEditAgentUIMessage } from '../lib/aiAgentTypes';

const API_URL = import.meta.env.VITE_API_URL as string;

export function buildOpLabel(op: Record<string, unknown>): string {
  switch (op?.type) {
    case 'ADD_FIELD': return `Added "${(op.label as string) ?? 'field'}"`;
    case 'UPDATE_FIELDS': {
      const count = Array.isArray(op.fieldIds) ? (op.fieldIds as unknown[]).length : 0;
      return count > 1 ? `Updated ${count} fields` : 'Updated field';
    }
    case 'REMOVE_FIELDS': {
      const count = Array.isArray(op.fieldIds) ? (op.fieldIds as unknown[]).length : 0;
      return count > 1 ? `Removed ${count} fields` : 'Removed field';
    }
    case 'RELOCATE_FIELD': return op.mode === 'copy' ? 'Copied field' : 'Moved field';
    case 'REORDER': return op.scope === 'pages' ? 'Reordered pages' : 'Reordered fields';
    case 'UPDATE_LAYOUT': return 'Updated layout';
    case 'RENAME_PAGE': return `Renamed page "${(op.newTitle as string) ?? 'page'}"`;
    case 'ADD_PAGE': return `Added page "${(op.title as string) ?? 'page'}"`;
    case 'REMOVE_PAGE': return 'Removed page';
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
  const { canUndo, beginBatch, clearBatch, undo, getUndoStackDepth } = useYjsUndoManager();
  const appliedToolCallIds = useRef(new Set<string>());
  const undoDepthBeforeRef = useRef<number>(0);
  const messageUndoDepths = useRef(new Map<string, number>());
  const currentPageIdRef = useRef<string | undefined>(undefined);

  // ── Conversation management (Apollo) ─────────────────────────────────────
  const { data: conversationsData, loading: conversationsLoading, refetch: refetchConversations } = useQuery(
    LIST_AI_CHAT_CONVERSATIONS,
    { variables: { formId, organizationId }, skip: !formId }
  );

  const { data: activeConvData, loading: activeConvLoading } = useQuery(GET_AI_CHAT_CONVERSATION, {
    variables: { id: activeConversationId!, organizationId },
    skip: !activeConversationId,
  });

  const [createConvMutation] = useMutation(CREATE_AI_CHAT_CONVERSATION);
  const [deleteConvMutation] = useMutation(DELETE_AI_CHAT_CONVERSATION);
  const [renameConvMutation] = useMutation(RENAME_AI_CHAT_CONVERSATION);

  // ── Build initialMessages from Apollo conversation data ───────────────────
  const apolloMessages = activeConvData?.getAIChatConversation?.messages;
  const initialMessages = useMemo<FormEditAgentUIMessage[]>(
    () => (apolloMessages ?? []).map((m: { data: unknown }) => m.data as FormEditAgentUIMessage),
    [apolloMessages]
  );

  // ── useChat — streaming + message state ───────────────────────────────────
  // Keep a ref so the transport closure always reads the latest page ID at send-time
  currentPageIdRef.current = (store as any).selectedPageId ?? (store.pages as any[])[0]?.id;

  const transport = useMemo(
    () => new DefaultChatTransport({
      api: `${API_URL}/api/ai/chat`,
      credentials: 'include',
      prepareSendMessagesRequest: ({ messages: allMsgs }) => ({
        body: {
          message: allMsgs[allMsgs.length - 1],
          conversationId: activeConversationId,
          organizationId,
          currentPageId: currentPageIdRef.current,
        },
      }),
    }),
    [activeConversationId, organizationId]
  );

  // Only activate useChat with a real conversation ID once Apollo has loaded the
  // conversation's messages. This prevents useChat seeding with [] and never
  // picking up the historical messages that arrive afterwards.
  const chatConversationId =
    activeConversationId && !activeConvLoading ? activeConversationId : null;

  const { messages: rawMessages, sendMessage, status, stop } = useChat({
    id: chatConversationId ?? '__no_conversation__',
    messages: initialMessages as any,
    transport,
    onError: (error) => {
      const msg = error.message ?? String(error);
      const isLimit = msg.includes('token limit');
      toastError('AI Error', isLimit ? msg : 'AI processing failed. Please try again.');
    },
  });

  const messages = rawMessages as unknown as FormEditAgentUIMessage[];

  // ── Apply mutation ops to Y.js store as tool results arrive ──────────────
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant') return;

    let mutationApplied = false;
    for (const part of last.parts ?? []) {
      if (
        part.type.startsWith('tool-') &&
        MUTATION_TOOL_NAMES.has(part.type.slice(5)) &&
        (part as any).state === 'output-available' &&
        !appliedToolCallIds.current.has((part as any).toolCallId)
      ) {
        appliedToolCallIds.current.add((part as any).toolCallId);
        applyAIOp((part as any).output, store, formId);
        mutationApplied = true;
      }
    }

    if (mutationApplied && last?.id) {
      const depth = getUndoStackDepth() - undoDepthBeforeRef.current;
      if (depth > 0) messageUndoDepths.current.set(last.id, depth);
    }

    // Handle propose-validation parts separately (not a mutation, sets pending state)
    for (const part of last.parts ?? []) {
      if (
        part.type === 'tool-proposeValidation' &&
        (part as any).state === 'output-available' &&
        !appliedToolCallIds.current.has((part as any).toolCallId)
      ) {
        appliedToolCallIds.current.add((part as any).toolCallId);
        applyAIOp((part as any).output, store, formId);
      }
    }
  }, [messages]);

  // Clear applied tool call IDs and undo depth map when conversation switches
  useEffect(() => {
    appliedToolCallIds.current.clear();
    messageUndoDepths.current.clear();
  }, [activeConversationId]);

  // ── Conversation CRUD ─────────────────────────────────────────────────────
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
    },
    [organizationId, renameConvMutation, refetchConversations]
  );

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!activeConversationId || status !== 'ready') return;
      clearBatch();
      undoDepthBeforeRef.current = getUndoStackDepth(); // always 0 after clear = correct baseline
      beginBatch();
      sendMessage({ text: content });
    },
    [activeConversationId, status, clearBatch, beginBatch, sendMessage, getUndoStackDepth]
  );

  const conversations = conversationsData?.listAIChatConversations ?? [];
  const activeConversation = activeConvData?.getAIChatConversation ?? null;
  const isStreaming = status !== 'ready';

  const lastMutatingMessageId = Array.from(messageUndoDepths.current.keys()).at(-1) ?? null;

  const undoMessage = useCallback(
    (messageId: string) => {
      const depth = messageUndoDepths.current.get(messageId) ?? 0;
      for (let i = 0; i < depth; i++) undo();
      messageUndoDepths.current.delete(messageId);
    },
    [undo]
  );

  return {
    conversations,
    conversationsLoading,
    activeConversationId,
    activeConversation,
    activeConvLoading,
    messages,
    isStreaming,
    status,
    canUndo,
    undo,
    cancel: stop,
    createConversation,
    selectConversation,
    deleteConversation,
    renameConversation,
    sendMessage: handleSendMessage,
    lastMutatingMessageId,
    undoMessage,
  };
}
