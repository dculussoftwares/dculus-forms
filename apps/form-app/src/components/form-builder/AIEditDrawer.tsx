// apps/form-app/src/components/form-builder/AIEditDrawer.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Send,
  Plus,
  Trash2,
  ChevronDown,
  X,
  Undo2,
  Wand2,
  ShieldCheck,
  ScanSearch,
  LayoutDashboard,
  Layers,
  Shuffle,
  Asterisk,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
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

const CHIP_ICONS: Record<string, React.ComponentType<any>> = {
  Wand2,
  ShieldCheck,
  ScanSearch,
  LayoutDashboard,
  Layers,
  Shuffle,
  Asterisk,
};

function ChipIcon({ name, className }: { name: string; className?: string }) {
  const IconComponent = CHIP_ICONS[name];
  if (!IconComponent) return null;
  return <IconComponent className={className} size={13} />;
}

function UserBubble({ message }: { message: FormEditAgentUIMessage }) {
  const textPart = message.parts.find((p) => p.type === 'text') as { type: 'text'; text: string } | undefined;
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-sm text-primary-foreground shadow-sm">
        {textPart?.text ?? (message as any).content}
      </div>
    </div>
  );
}

function TextBubble({ text, isStreaming }: { text: string; isStreaming?: boolean }) {
  if (!text) return null;
  return (
    <div className="rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-sm leading-relaxed text-foreground shadow-sm">
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-primary">{children}</strong>,
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

/**
 * Phase 3.3: Streaming timeline tracking.
 * Provides a clean, vertical step timeline of tool invocations currently running or completed.
 */
function StreamingTimeline({ parts }: { parts: FormEditToolPart[] }) {
  const { t } = useTranslation('aiEditDrawer');

  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-border/80 bg-background/40 backdrop-blur-sm shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-border/60 bg-muted/20 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        <Loader2 className="h-3 w-3 animate-spin text-primary" />
        {t('timeline.executingPlan') ?? 'Executing operations'}
      </div>
      <div className="divide-y divide-border/30 px-3 py-1">
        {parts.map((part, i) => {
          const key = (part as any).toolCallId ?? `${part.type}-${i}`;
          const state = (part as any).state as string;
          const isDone = state === 'output-available';

          return (
            <div key={key} className="flex items-start gap-2.5 py-1.5 text-xs">
              <div className="relative mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                {isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <span className="h-2 w-2 animate-ping rounded-full bg-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn('font-medium transition-colors', isDone ? 'text-muted-foreground line-through' : 'text-foreground')}>
                    {toolStatusLabel(part, t)}
                  </span>
                  {isDone && (
                    <span className="text-[9px] text-green-600 font-semibold uppercase tracking-wider bg-green-50 px-1 rounded border border-green-200">
                      OK
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
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

  const toolParts = message.parts.filter((p) => p.type.startsWith('tool-')) as FormEditToolPart[];

  // Find any tool part currently in-flight
  const inFlightPart = isStreaming
    ? toolParts.find((p) => (p as any).state !== 'output-available')
    : undefined;

  return (
    <div className="flex justify-start">
      <div className="flex max-w-[90%] items-start gap-2">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <GradientSparkles size={12} />
        </div>
        <div className="space-y-1.5 flex-1 min-w-0">
          {combinedText && <TextBubble text={combinedText} isStreaming={isStreaming && !inFlightPart} />}

          {/* Phase 3.3: Rich timeline during streaming execution */}
          {isStreaming && toolParts.length > 0 && (
            <StreamingTimeline parts={toolParts} />
          )}

          {/* Simple fallback spinner if streaming has no tool parts yet */}
          {isStreaming && toolParts.length === 0 && !combinedText && (
            <StatusIndicator />
          )}

          {/* Only render individual tool chips when execution is completed */}
          {!isStreaming && toolParts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {message.parts.map((part, i) => {
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
                if (part.type.startsWith('tool-')) return <MutationToolPart key={key} part={part as any} />;
                return null;
              })}
            </div>
          )}

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
          <div className="rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-xs italic text-muted-foreground shadow-sm">
            {text}
          </div>
        ) : (
          <div className="flex gap-1 rounded-2xl rounded-tl-sm bg-muted px-3 py-2.5 shadow-sm">
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
            {chips.map((chip) => {
              // Phase 3.2: premium styles per chip category
              const catStyles: Record<string, string> = {
                add: 'border-emerald-200 bg-emerald-50/30 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-400 dark:hover:bg-emerald-950/40',
                edit: 'border-blue-200 bg-blue-50/30 text-blue-700 hover:bg-blue-50 hover:border-blue-300 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-400 dark:hover:bg-blue-950/40',
                structure: 'border-indigo-200 bg-indigo-50/30 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 dark:border-indigo-900/50 dark:bg-indigo-950/20 dark:text-indigo-400 dark:hover:bg-indigo-950/40',
                style: 'border-amber-200 bg-amber-50/30 text-amber-700 hover:bg-amber-50 hover:border-amber-300 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-400 dark:hover:bg-amber-950/40',
                ai: 'border-purple-200 bg-purple-50/30 text-purple-700 hover:bg-purple-50 hover:border-purple-300 dark:border-purple-900/50 dark:bg-purple-950/20 dark:text-purple-400 dark:hover:bg-purple-950/40',
              };

              const styleClass = catStyles[chip.category] || 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground';

              return (
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
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all shadow-sm',
                    styleClass,
                    'disabled:cursor-not-allowed disabled:opacity-40'
                  )}
                >
                  {chip.icon ? (
                    <ChipIcon name={chip.icon} className="shrink-0" />
                  ) : (
                    <GradientSparkles size={11} className="shrink-0" />
                  )}
                  {chip.label}
                </button>
              );
            })}
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
