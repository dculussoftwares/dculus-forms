import { useState, useCallback, useRef } from 'react';
import { useMutation, useQuery, useSubscription } from '@apollo/client';
import { FieldType } from '@dculus/types';
import { toastError } from '@dculus/ui';
import { useFormBuilderStore } from '../store/useFormBuilderStore';
import {
  LIST_AI_CHAT_CONVERSATIONS,
  GET_AI_CHAT_CONVERSATION,
  CREATE_AI_CHAT_CONVERSATION,
  DELETE_AI_CHAT_CONVERSATION,
  RENAME_AI_CHAT_CONVERSATION,
  SEND_AI_CHAT_USER_MESSAGE,
  AI_CHAT_STREAM,
} from '../graphql/aiChat';

const AI_TYPE_MAP: Record<string, FieldType> = {
  text: FieldType.TEXT_INPUT_FIELD,
  textarea: FieldType.TEXT_AREA_FIELD,
  email: FieldType.EMAIL_FIELD,
  number: FieldType.NUMBER_FIELD,
  date: FieldType.DATE_FIELD,
  select: FieldType.SELECT_FIELD,
  radio: FieldType.RADIO_FIELD,
  checkbox: FieldType.CHECKBOX_FIELD,
  file: FieldType.FILE_UPLOAD_FIELD,
};

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
  const currentFormStateRef = useRef<object>({});

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
  const [sendUserMessageMutation] = useMutation(SEND_AI_CHAT_USER_MESSAGE);

  useSubscription(AI_CHAT_STREAM, {
    variables: {
      conversationId: activeConversationId!,
      organizationId,
      currentFormState: currentFormStateRef.current,
    },
    skip: !isStreaming || !activeConversationId,
    onData: ({ data }) => {
      const chunk = data.data?.aiChatStream;
      if (!chunk) return;

      if (chunk.type === 'text') {
        setStreamingMessage((prev) =>
          prev ? { ...prev, streamingText: (prev.streamingText ?? '') + (chunk.delta ?? '') } : null
        );
      }

      if (chunk.type === 'operation' && chunk.operation) {
        applyOperationToStore(chunk.operation);
        const label = buildOperationLabel(chunk.operation);
        setStreamingMessage((prev) =>
          prev
            ? { ...prev, streamingOps: [...(prev.streamingOps ?? []), { type: chunk.operation.type, label }] }
            : null
        );
      }

      if (chunk.type === 'done') {
        setIsStreaming(false);
        setStreamingMessage(null);
        refetchActiveConversation();
        refetchConversations();
      }

      if (chunk.type === 'error') {
        setIsStreaming(false);
        setStreamingMessage(null);
        const isLimit = chunk.error?.includes('token limit');
        toastError('AI Error', isLimit ? chunk.error : 'AI processing failed. Please try again.');
      }
    },
  });

  function getPageIdForField(fieldId: string): string | null {
    for (const page of store.pages) {
      const fields = (page as any).fields ?? [];
      if (fields.some((f: any) => f.id === fieldId)) return page.id;
    }
    return null;
  }

  function applyOperationToStore(op: any) {
    if (!op?.type) return;
    switch (op.type) {
      case 'ADD_FIELD': {
        const targetPageId = store.pages[0]?.id;
        if (!targetPageId) return;
        const fieldType = AI_TYPE_MAP[op.fieldType] ?? FieldType.TEXT_INPUT_FIELD;
        const isChoice = [FieldType.SELECT_FIELD, FieldType.RADIO_FIELD, FieldType.CHECKBOX_FIELD].includes(fieldType);
        const fieldData = isChoice
          ? { label: op.label, required: op.required ?? false, placeholder: op.placeholder ?? '', defaultValue: '', prefix: '', hint: '', options: op.options ?? ['Option 1', 'Option 2'] }
          : { label: op.label, required: op.required ?? false, placeholder: op.placeholder ?? '', defaultValue: '', prefix: '', hint: '' };
        store.addField(targetPageId, fieldType, fieldData);
        break;
      }
      case 'UPDATE_FIELD': {
        const pageId = getPageIdForField(op.fieldId);
        if (!pageId) return;
        store.updateField(pageId, op.fieldId, op.updates);
        break;
      }
      case 'REMOVE_FIELD': {
        const pageId = getPageIdForField(op.fieldId);
        if (!pageId) return;
        store.removeField(pageId, op.fieldId);
        break;
      }
      case 'REORDER_FIELDS': {
        const page = store.pages.find((p) => p.id === op.pageId);
        if (!page) return;
        const current = ((page as any).fields ?? []).map((f: any) => f.id) as string[];
        const desired: string[] = op.fieldIds ?? [];
        for (let i = 0; i < desired.length; i++) {
          const fromIdx = current.indexOf(desired[i]);
          if (fromIdx !== -1 && fromIdx !== i) {
            store.reorderFields(op.pageId, fromIdx, i);
            const [moved] = current.splice(fromIdx, 1);
            current.splice(i, 0, moved);
          }
        }
        break;
      }
      case 'UPDATE_LAYOUT': {
        store.updateLayout(op);
        break;
      }
    }
  }

  function buildOperationLabel(op: any): string {
    switch (op?.type) {
      case 'ADD_FIELD': return `Added "${op.label ?? 'field'}"`;
      case 'UPDATE_FIELD': return 'Updated field';
      case 'REMOVE_FIELD': return 'Removed field';
      case 'REORDER_FIELDS': return 'Reordered fields';
      case 'UPDATE_LAYOUT': return 'Updated layout';
      default: return 'Changed form';
    }
  }

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
    async (content: string, formState: object) => {
      if (!activeConversationId || isStreaming) return;
      currentFormStateRef.current = formState;

      await sendUserMessageMutation({
        variables: { conversationId: activeConversationId, organizationId, content },
      });

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
    },
    [activeConversationId, organizationId, isStreaming, sendUserMessageMutation]
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
    createConversation,
    selectConversation,
    deleteConversation,
    renameConversation,
    sendMessage,
  };
}
