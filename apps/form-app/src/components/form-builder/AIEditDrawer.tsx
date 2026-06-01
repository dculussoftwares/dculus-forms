// apps/form-app/src/components/form-builder/AIEditDrawer.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Sparkles, Send, Plus, Trash2, ChevronDown, X, Undo2 } from 'lucide-react';
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
import { useAIChat } from '../../hooks/useAIChat';
import type { FormEditAgentUIMessage, FormEditToolPart } from '../../lib/aiAgentTypes';
import { MUTATION_TOOL_NAMES } from '../../lib/aiAgentTypes';
import MutationToolPart from './tool-parts/MutationToolPart';
import ListFieldsToolPart from './tool-parts/ListFieldsToolPart';
import GetFieldToolPart from './tool-parts/GetFieldToolPart';

interface AIEditDrawerProps {
  formId: string;
  organizationId: string;
  isOpen: boolean;
  onClose: () => void;
}

function UserBubble({ message }: { message: FormEditAgentUIMessage }) {
  const textPart = message.parts.find((p) => p.type === 'text') as { type: 'text'; text: string } | undefined;
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
        {textPart?.text ?? (message as any).content}
      </div>
    </div>
  );
}

function TextBubble({ text, isStreaming }: { text: string; isStreaming?: boolean }) {
  if (!text) return null;
  return (
    <div className="rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-sm leading-relaxed text-foreground">
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="ml-4 list-disc space-y-0.5 my-1">{children}</ul>,
          ol: ({ children }) => <ol className="ml-4 list-decimal space-y-0.5 my-1">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          code: ({ children }) => <code className="rounded bg-foreground/10 px-1 py-0.5 font-mono text-xs">{children}</code>,
        }}
      >
        {text}
      </ReactMarkdown>
      {isStreaming && (
        <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-foreground/50 align-text-bottom" />
      )}
    </div>
  );
}

function toolStatusLabel(part: FormEditToolPart, t: (key: string) => string): string {
  const toolName = part.type.replace('tool-', '');
  const key = `toolStatus.${toolName}`;
  const label = t(key);
  return label !== key ? label : t('toolStatus.default');
}

function AssistantMessage({
  message,
  isStreaming,
  onUndo: _onUndo,
  canUndo: _canUndo,
}: {
  message: FormEditAgentUIMessage;
  isStreaming: boolean;
  onUndo?: () => void;
  canUndo?: boolean;
}) {
  const { t } = useTranslation('aiEditDrawer');
  const textParts = message.parts.filter((p) => p.type === 'text') as { type: 'text'; text: string }[];
  const combinedText = textParts.map((p) => p.text).join('');

  // Find any tool part currently in-flight (not yet output-available)
  const inFlightPart = isStreaming
    ? (message.parts as FormEditToolPart[]).find(
        (p) => p.type.startsWith('tool-') && (p as any).state !== 'output-available'
      )
    : undefined;

  return (
    <div className="flex justify-start">
      <div className="flex max-w-[90%] items-start gap-2">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-3 w-3 text-primary" />
        </div>
        <div className="space-y-1.5">
          {combinedText && <TextBubble text={combinedText} isStreaming={isStreaming && !inFlightPart} />}
          {inFlightPart && (
            <StatusIndicator text={toolStatusLabel(inFlightPart, t)} />
          )}
          {!inFlightPart && !combinedText && isStreaming && <StatusIndicator />}
          <div className="flex flex-wrap gap-1.5">
            {message.parts.map((part, i) => {
              if (part.type === 'tool-listFields') return <ListFieldsToolPart key={i} part={part as any} />;
              if (part.type === 'tool-getField') return <GetFieldToolPart key={i} part={part as any} />;
              if (MUTATION_TOOL_NAMES.has(part.type.slice(5))) return <MutationToolPart key={i} part={part as any} />;
              return null;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusIndicator({ text }: { text?: string }) {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-3 w-3 text-primary" />
        </div>
        {text ? (
          <div className="rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-xs italic text-muted-foreground">
            {text}
          </div>
        ) : (
          <div className="flex gap-1 rounded-2xl rounded-tl-sm bg-muted px-3 py-2.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const QUICK_CHIP_PROMPTS = {
  analyseForm: `Please analyse this form. Use listFields to read all pages and fields first, then give structured feedback on: (1) field order and logical flow, (2) missing fields for this type of form, (3) unclear or confusing labels, (4) fields that should be required but aren't. Be concise and actionable.`,
  listAllFields: `List all fields across every page of this form.`,
  makeAllRequired: `Make every field on every page required.`,
} as const;

function QuickChips({
  onChipClick,
  disabled,
}: {
  onChipClick: (prompt: string) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation('aiEditDrawer');
  const chips = [
    { key: 'analyseForm' as const, icon: true },
    { key: 'listAllFields' as const, icon: false },
    { key: 'makeAllRequired' as const, icon: false },
  ];
  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {chips.map(({ key, icon }) => (
        <button
          key={key}
          onClick={() => onChipClick(QUICK_CHIP_PROMPTS[key])}
          disabled={disabled}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground',
            'transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground',
            'disabled:cursor-not-allowed disabled:opacity-40'
          )}
        >
          {icon && <Sparkles className="h-3 w-3" />}
          {t(`chips.${key}`)}
        </button>
      ))}
    </div>
  );
}

const AIEditDrawer: React.FC<AIEditDrawerProps> = ({
  formId,
  organizationId,
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation('aiEditDrawer');
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    conversations,
    conversationsLoading,
    activeConversationId,
    activeConversation,
    activeConvLoading,
    messages,
    isStreaming,
    canUndo,
    undo,
    cancel,
    createConversation,
    selectConversation,
    deleteConversation,
    sendMessage,
  } = useAIChat({ formId, organizationId });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!isOpen || conversationsLoading) return;
    if (conversations.length === 0) {
      createConversation();
    } else if (!activeConversationId && conversations.length > 0) {
      selectConversation(conversations[0].id);
    }
  }, [isOpen, conversationsLoading, conversations.length]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming || !activeConversationId) return;
    setInput('');
    sendMessage(trimmed);
  }, [input, isStreaming, activeConversationId, sendMessage]);

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

  const typedMessages = messages as unknown as FormEditAgentUIMessage[];
  const lastMsg = typedMessages[typedMessages.length - 1];
  // Show the global status indicator only when streaming but no assistant message exists yet
  const showStatusIndicator =
    isStreaming &&
    (!lastMsg || lastMsg.role !== 'assistant');

  return (
    <div className="flex h-full w-[380px] shrink-0 flex-col border-l border-border bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="flex-1 text-sm font-semibold">{t('title')}</span>

        {canUndo && (
          <button
            onClick={undo}
            title={t('undoTitle')}
            className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <Undo2 className="h-3.5 w-3.5" />
            {t('undo')}
          </button>
        )}

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
            <DropdownMenuItem
              className="gap-2 text-xs"
              onClick={() => createConversation()}
            >
              <Plus className="h-3.5 w-3.5" />
              {t('newChat')}
            </DropdownMenuItem>
            {conversations.length > 0 && <DropdownMenuSeparator />}
            {conversations.map((conv: { id: string; title: string }) => (
              <DropdownMenuItem
                key={conv.id}
                className={cn(
                  'group text-xs',
                  conv.id === activeConversationId && 'bg-accent'
                )}
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

        <button
          onClick={onClose}
          aria-label={t('closeAriaLabel')}
          className="ml-1 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {(conversationsLoading || activeConvLoading) && typedMessages.length === 0 && (
          <div className="flex items-center justify-center pt-8">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40" style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
          </div>
        )}
        {typedMessages.length === 0 && !isStreaming && !conversationsLoading && !activeConvLoading && (
          <p className="px-4 pt-8 text-center text-xs text-muted-foreground">
            {t('emptyState')}
          </p>
        )}
        {typedMessages.map((msg) =>
          msg.role === 'user' ? (
            <UserBubble key={msg.id} message={msg} />
          ) : (
            <AssistantMessage
              key={msg.id}
              message={msg}
              isStreaming={isStreaming && msg === lastMsg}
              onUndo={undefined}
              canUndo={false}
            />
          )
        )}
        {showStatusIndicator && <StatusIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        {!isStreaming && activeConversationId && (
          <QuickChips
            onChipClick={(prompt) => sendMessage(prompt)}
            disabled={isStreaming}
          />
        )}
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
          {isStreaming ? (
            <button
              onClick={cancel}
              aria-label={t('cancel')}
              className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() || !activeConversationId}
              aria-label={t('send')}
              className={cn(
                'mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                'bg-primary text-primary-foreground',
                'transition-colors hover:bg-primary/90',
                'disabled:cursor-not-allowed disabled:opacity-40'
              )}
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIEditDrawer;
