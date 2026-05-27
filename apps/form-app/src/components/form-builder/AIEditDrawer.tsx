import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Send, Loader2, Plus, Trash2, ChevronDown } from 'lucide-react';
import { cn } from '@dculus/utils';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@dculus/ui';
import { useTranslation } from '../../hooks/useTranslation';
import { useAIChat, type AIChatMessage } from '../../hooks/useAIChat';
import { useFormBuilderStore } from '../../store/useFormBuilderStore';

interface AIEditDrawerProps {
  formId: string;
  organizationId: string;
  isOpen: boolean;
  onClose: () => void;
}

function UserBubble({ message }: { message: AIChatMessage }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
        {message.content}
      </div>
    </div>
  );
}

function OperationChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
      {label}
    </span>
  );
}

function buildOpLabel(op: Record<string, unknown>): string {
  switch (op?.type) {
    case 'ADD_FIELD': return `Added "${(op.label as string) ?? 'field'}"`;
    case 'UPDATE_FIELD': return 'Updated field';
    case 'REMOVE_FIELD': return 'Removed field';
    case 'REORDER_FIELDS': return 'Reordered fields';
    case 'UPDATE_LAYOUT': return 'Updated layout';
    default: return 'Changed form';
  }
}

function AssistantBubble({ message }: { message: AIChatMessage }) {
  const displayText = message.isStreaming ? message.streamingText : message.content;
  const ops = message.isStreaming ? message.streamingOps : undefined;
  const savedOps = !message.isStreaming && message.operations ? (message.operations as Record<string, unknown>[]) : null;

  return (
    <div className="flex justify-start">
      <div className="flex max-w-[90%] items-start gap-2">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-3 w-3 text-primary" />
        </div>
        <div className="space-y-1.5">
          {displayText && (
            <div className="rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-sm leading-relaxed text-foreground">
              {displayText}
              {message.isStreaming && (
                <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-foreground/50 align-text-bottom" />
              )}
            </div>
          )}
          {ops && ops.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {ops.map((op, i) => (
                <OperationChip key={i} label={op.label} />
              ))}
            </div>
          )}
          {savedOps && savedOps.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {savedOps.map((op, i) => (
                <OperationChip key={i} label={buildOpLabel(op)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-3 w-3 text-primary" />
        </div>
        <div className="flex gap-1 rounded-2xl rounded-tl-sm bg-muted px-3 py-2.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const AIEditDrawer: React.FC<AIEditDrawerProps> = ({ formId, organizationId, isOpen, onClose: _onClose }) => {
  const { t } = useTranslation('aiEditDrawer');
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const store = useFormBuilderStore();

  const {
    conversations,
    activeConversationId,
    activeConversation,
    messages,
    isStreaming,
    createConversation,
    selectConversation,
    deleteConversation,
    sendMessage,
  } = useAIChat({ formId, organizationId });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!isOpen) return;
    if (conversations.length === 0) {
      createConversation();
    } else if (!activeConversationId && conversations.length > 0) {
      selectConversation(conversations[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, conversations.length]);

  const getFormState = useCallback(() => {
    try {
      const pages = store.pages.map((page) => ({
        id: page.id,
        fields: ((page as unknown as { fields?: { id: string; type: string; label: string; required: boolean }[] }).fields ?? []).map((f) => ({
          id: f.id,
          type: f.type,
          label: f.label,
          required: f.required,
        })),
      }));
      return { pages };
    } catch {
      return { pages: [] };
    }
  }, [store.pages]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming || !activeConversationId) return;
    setInput('');
    sendMessage(trimmed, getFormState());
  }, [input, isStreaming, activeConversationId, sendMessage, getFormState]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  if (!isOpen) return null;

  return (
    <div className="flex h-full w-[380px] shrink-0 flex-col border-l border-border bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="flex-1 text-sm font-semibold">{t('title')}</span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 max-w-[140px] gap-1 px-2 text-xs">
              <span className="truncate">
                {activeConversation?.title ?? t('newChat')}
              </span>
              <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem className="gap-2 text-xs" onClick={() => createConversation()}>
              <Plus className="h-3.5 w-3.5" />
              {t('newChat')}
            </DropdownMenuItem>
            {conversations.length > 0 && <DropdownMenuSeparator />}
            {conversations.map((conv: { id: string; title: string }) => (
              <DropdownMenuItem
                key={conv.id}
                className={cn('group text-xs', conv.id === activeConversationId && 'bg-accent')}
                onClick={() => selectConversation(conv.id)}
              >
                <span className="flex-1 truncate">{conv.title}</span>
                <button
                  className="ml-2 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conv.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.length === 0 && !isStreaming && (
          <p className="px-4 pt-8 text-center text-xs text-muted-foreground">
            {t('emptyState')}
          </p>
        )}
        {messages.map((msg) =>
          msg.role === 'user' ? (
            <UserBubble key={msg.id} message={msg} />
          ) : (
            <AssistantBubble key={msg.id} message={msg} />
          )
        )}
        {isStreaming && !messages.some((m) => m.isStreaming) && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        <div
          className={cn(
            'flex items-end gap-2 rounded-xl border border-border bg-background px-3 py-2 shadow-sm',
            'transition-all duration-150 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20'
          )}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('inputPlaceholder')}
            disabled={isStreaming || !activeConversationId}
            rows={1}
            className={cn(
              'flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground',
              'max-h-28 overflow-y-auto py-1 leading-5',
              'disabled:opacity-50'
            )}
            style={{ minHeight: '24px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming || !activeConversationId}
            aria-label={t('send')}
            className={cn(
              'mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
              'bg-primary text-primary-foreground',
              'transition-colors hover:bg-primary/90',
              'disabled:cursor-not-allowed disabled:opacity-40'
            )}
          >
            {isStreaming ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIEditDrawer;
