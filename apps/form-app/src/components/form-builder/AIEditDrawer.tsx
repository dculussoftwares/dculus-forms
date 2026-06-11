// apps/form-app/src/components/form-builder/AIEditDrawer.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Plus, Trash2, ChevronDown, X, Undo2 } from 'lucide-react';
import { GradientSparkles } from './GradientSparkles.js';
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
import { useAIChips } from '../../hooks/useAIChips';
import type { FormEditAgentUIMessage, FormEditToolPart } from '../../lib/aiAgentTypes';
import MutationToolPart from './tool-parts/MutationToolPart';
import ListFieldsToolPart from './tool-parts/ListFieldsToolPart';
import GetFieldToolPart from './tool-parts/GetFieldToolPart';
import ChangeSummaryCard from './tool-parts/ChangeSummaryCard';
import ValidationSuggestionCard from './tool-parts/ValidationSuggestionCard';
import DestructiveActionCard from './tool-parts/DestructiveActionCard';
import AITokenMeter from './AITokenMeter';

interface AIEditDrawerProps {
  formId: string;
  organizationId: string;
  isOpen: boolean;
  onClose: () => void;
  initialMessage?: string;
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
  onUndo,
  canUndo,
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
          <GradientSparkles size={12} />
        </div>
        <div className="space-y-1.5">
          {combinedText && <TextBubble text={combinedText} isStreaming={isStreaming && !inFlightPart} />}
          {inFlightPart && (
            <StatusIndicator text={toolStatusLabel(inFlightPart, t)} />
          )}
          {!inFlightPart && !combinedText && isStreaming && <StatusIndicator />}
          <div className="flex flex-wrap gap-1.5">
            {message.parts.map((part, i) => {
              // Stable key: toolCallId is unique per tool invocation; fall back to type+index
              // for non-tool parts so index shifts during streaming don't produce duplicate keys.
              const key = (part as any).toolCallId ?? `${part.type}-${i}`;
              if (part.type === 'tool-listFields') return <ListFieldsToolPart key={key} part={part as any} />;
              if (part.type === 'tool-getField') return <GetFieldToolPart key={key} part={part as any} />;
              if (part.type === 'tool-proposeValidation') {
                if ((part as any).state !== 'output-available') return null;
                return (
                  <span key={key} className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                    ✦ {t('validation.title')}
                  </span>
                );
              }
              // Destructive proposals render as an "awaiting confirmation" chip, not a done pill —
              // the actual delete/convert happens only when the user confirms in DestructiveActionCard.
              if (
                part.type === 'tool-removeFields' ||
                part.type === 'tool-removePage' ||
                part.type === 'tool-proposeFieldTypeChange'
              ) {
                if ((part as any).state !== 'output-available') return null;
                return (
                  <span key={key} className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-700">
                    ⚠ {t('destructive.awaitingConfirmation')}
                  </span>
                );
              }
              // Route any other tool-* part (including legacy mutation parts from
              // old conversations) to MutationToolPart for back-compat rendering.
              if (part.type.startsWith('tool-')) return <MutationToolPart key={key} part={part as any} />;
              return null;
            })}
          </div>
          {!isStreaming && (
            <ChangeSummaryCard
              message={message}
              onUndo={onUndo}
              canUndo={canUndo}
            />
          )}
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
          <GradientSparkles size={12} />
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


const AIEditDrawer: React.FC<AIEditDrawerProps> = ({
  formId,
  organizationId,
  isOpen,
  onClose,
  initialMessage,
}) => {
  const { t } = useTranslation('aiEditDrawer');
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chips = useAIChips();

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
    lastMutatingMessageId,
    undoMessage,
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

  const initialMessageSentRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      initialMessageSentRef.current = false;
      return;
    }
    if (!initialMessage || initialMessageSentRef.current) return;
    if (!activeConversationId || isStreaming) return;
    initialMessageSentRef.current = true;
    sendMessage(initialMessage);
  }, [isOpen, initialMessage, activeConversationId, isStreaming, sendMessage]);

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
        <GradientSparkles size={16} />
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
        {typedMessages.map((msg, i) => {
          // Persisted messages can have a null/undefined id (older saves didn't set one).
          // Falling back to the index keeps keys unique so React doesn't drop colliding
          // children — which previously blanked the chat when several ids were null.
          const key = msg.id ?? `msg-${i}`;
          return msg.role === 'user' ? (
            <UserBubble key={key} message={msg} />
          ) : (
            <AssistantMessage
              key={key}
              message={msg}
              isStreaming={isStreaming && msg === lastMsg}
              onUndo={() => undoMessage(msg.id)}
              canUndo={msg.id === lastMutatingMessageId && !isStreaming}
            />
          );
        })}
        {showStatusIndicator && <StatusIndicator />}
        <ValidationSuggestionCard />
        <DestructiveActionCard />
        <div ref={messagesEndRef} />
      </div>

      <AITokenMeter organizationId={organizationId} />

      {/* Input */}
      <div className="border-t border-border p-3">
        {!isStreaming && activeConversationId && chips.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <button
                key={chip.key}
                onClick={() => {
                  if (chip.key === 'remixForm') {
                    setInput(chip.prompt);
                  } else {
                    sendMessage(chip.prompt);
                  }
                }}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground',
                  'transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground',
                  'disabled:cursor-not-allowed disabled:opacity-40'
                )}
              >
                {['analyseForm', 'generateFields', 'suggestValidation', 'remixForm'].includes(chip.key) && (
                  <GradientSparkles size={12} />
                )}
                {chip.label}
              </button>
            ))}
          </div>
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
