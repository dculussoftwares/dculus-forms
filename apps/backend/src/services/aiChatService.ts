import { generateText, getToolName, isToolUIPart } from 'ai';
import type { UIMessage } from 'ai';
import { aiChatRepository } from '../repositories/aiChatRepository.js';
import { getFastModel } from '../lib/ai.js';
import { logger } from '../lib/logger.js';

/**
 * Maximum number of persisted messages to load into context per turn.
 * Reduced from 10 → 6 (Phase 1.3): We summarise older turns instead of
 * carrying them verbatim, so 6 recent messages is sufficient context.
 */
const MAX_HISTORY_MESSAGES = 6;

/**
 * Summarise history when the conversation has grown beyond this many user
 * turns. Below this threshold we don't bother — the cost saving is minimal
 * and the summary itself adds a small latency hit.
 */
const SUMMARISE_AFTER_USER_TURNS = 4;

export const MAX_TOOL_RESULT_CHARS = 8_000;

/**
 * Cap oversized tool outputs (e.g. listFields on a large form) before they are persisted or
 * replayed to the model. Operates on AI SDK v5+ tool parts (`tool-<name>` with
 * `state: 'output-available'` and an `output` payload).
 */
export function truncateToolResults(messages: UIMessage[]): UIMessage[] {
  return messages.map((msg) => {
    // Messages persisted by older SDK versions may carry `content` instead of `parts`.
    if (msg.role !== 'assistant' || !msg.parts?.some(isToolUIPart)) return msg;
    const parts = msg.parts.map((part) => {
      if (!isToolUIPart(part) || part.state !== 'output-available') return part;
      const serialized = typeof part.output === 'string' ? part.output : JSON.stringify(part.output);
      if (serialized.length <= MAX_TOOL_RESULT_CHARS) return part;
      return { ...part, output: `${serialized.slice(0, MAX_TOOL_RESULT_CHARS)}\n...[truncated]` };
    });
    return { ...msg, parts };
  });
}

export async function createConversation(
  formId: string,
  organizationId: string,
  userId: string
) {
  return aiChatRepository.createConversation({
    formId, organizationId, userId, title: 'New conversation',
  });
}

export async function listConversations(
  formId: string,
  organizationId: string,
  userId: string
) {
  const conversations = await aiChatRepository.listConversationsByForm(
    formId, organizationId, userId
  );

  return conversations.map((c) => ({
    ...c,
    messageCount: c._count.messages,
    messages: [],
  }));
}

export async function getConversation(id: string, userId: string) {
  const conv = await aiChatRepository.findConversationById(id, userId);
  if (!conv) return null;
  return { ...conv, messageCount: conv._count.messages };
}

/** Ownership lookup without loading the message history — used on every chat turn. */
export async function findOwnedConversation(id: string, userId: string) {
  return aiChatRepository.findConversationByUser(id, userId);
}

export async function deleteConversation(id: string, userId: string) {
  const conv = await aiChatRepository.findConversationByUser(id, userId);
  if (!conv) return false;
  await aiChatRepository.deleteConversation(id);
  return true;
}

export async function renameConversation(id: string, userId: string, title: string) {
  const conv = await aiChatRepository.findConversationByUser(id, userId);
  if (!conv) return null;
  const safeTitle = title.trim().slice(0, 100) || 'Untitled conversation';
  return aiChatRepository.updateConversation(id, { title: safeTitle });
}

export async function loadConversationMessages(conversationId: string): Promise<UIMessage[]> {
  const messages = await aiChatRepository.listRecentMessages(conversationId, MAX_HISTORY_MESSAGES);
  return messages.reverse().map((m) => m.data as unknown as UIMessage);
}

/**
 * Strip tool call payloads from messages that are older than the most recent 2
 * turns. Tool inputs/outputs are often large (full schema snapshots, long field
 * lists), and the model doesn’t need them verbatim — recent tool results are
 * what matter for continuity.
 *
 * Leaves a compact annotation so the model still understands what tools ran:
 *   "[used tools: addField, updateFields]"
 */
export function pruneToolCallsFromHistory(messages: UIMessage[]): UIMessage[] {
  if (messages.length <= 4) return messages; // too few to bother pruning

  // Keep the last 4 messages (2 turns) verbatim; prune everything before.
  const cutoff = messages.length - 4;

  return messages.map((msg, i) => {
    if (i >= cutoff || msg.role !== 'assistant') return msg;

    const toolParts = (msg.parts ?? []).filter(isToolUIPart);
    if (toolParts.length === 0) return msg;

    // Replace the tool parts with a single text note so the model still knows what ran.
    const toolNames = [...new Set(toolParts.map(getToolName))];
    const textParts = msg.parts.filter((p) => p.type === 'text');
    return {
      ...msg,
      parts: [...textParts, { type: 'text' as const, text: `[used tools: ${toolNames.join(', ')}]` }],
    };
  });
}

/**
 * When the conversation is long enough, generate a compact summary of the
 * older half using gpt-5.4-nano. Inject the summary as a synthetic user
 * message at the start of the context so the model retains the overall
 * conversation intent without carrying every old message verbatim.
 *
 * Returns the (possibly summarised) message list. Never mutates the input.
 * Safe to call on every turn — returns unchanged messages if the threshold
 * is not met.
 */
export async function summarizeHistoryIfNeeded(
  messages: UIMessage[]
): Promise<UIMessage[]> {
  const userTurns = messages.filter((m) => m.role === 'user').length;
  if (userTurns <= SUMMARISE_AFTER_USER_TURNS) return messages;

  // Split: summarise the older half, keep the recent half verbatim.
  const splitAt = Math.floor(messages.length / 2);
  const older = messages.slice(0, splitAt);
  const recent = messages.slice(splitAt);

  // Extract text content from older messages for summarisation input.
  const olderText = older
    .map((m) => {
      const textPart = (m.parts as any[])?.find((p: any) => p.type === 'text');
      const text = textPart?.text ?? (m as any).content ?? '';
      return `${m.role === 'user' ? 'User' : 'AI'}: ${text.slice(0, 400)}`;
    })
    .filter(Boolean)
    .join('\n');

  if (!olderText.trim()) return messages;

  try {
    const { text: summary } = await generateText({
      model: getFastModel(), // use nano — cheap, fast, good enough for summary
      prompt: `Summarise this form-editing conversation in 2-3 sentences (actions taken, what changed):\n\n${olderText}`,
    });

    const summaryMsg: UIMessage = {
      id: `history-summary-${Date.now()}`,
      role: 'user',
      parts: [{
        type: 'text',
        text: `[Earlier conversation summary: ${summary.trim()}]`,
      }],
    };

    return [summaryMsg, ...recent];
  } catch (err) {
    // Non-fatal — if summarisation fails, fall back to full history.
    logger.warn({ err }, 'History summarisation failed — using full history');
    return messages;
  }
}

export async function saveConversationMessages(
  conversationId: string,
  messages: UIMessage[],
  tokensUsed: number
): Promise<void> {
  // Messages arrive in correct order (user turn first, then assistant). Persisting them with
  // Promise.all gave every row of the batch an identical createdAt (Postgres now() = the
  // transaction start time), so `orderBy createdAt asc` on reload was non-deterministic and could
  // render the bubbles out of order. Stamp each message with a createdAt staggered by its index so
  // the saved order is preserved deterministically. Base is captured once so a batch is monotonic
  // and strictly after any earlier batch.
  const base = Date.now();
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const isLast = i === messages.length - 1;
    const textPart = (msg.parts as any[])?.find((p: any) => p.type === 'text');
    const textContent = textPart?.text ?? (msg as any).content ?? '';
    await aiChatRepository.createConversationMessage({
      conversationId,
      role: msg.role,
      content: textContent,
      data: msg as any,
      tokensUsed: isLast && msg.role === 'assistant' ? tokensUsed : 0,
      createdAt: new Date(base + i),
    });
  }
  await aiChatRepository.touchConversation(conversationId);
}

// Fire-and-forget: generates a short title from the first user message
export function autoGenerateTitle(conversationId: string, firstMessage: string): void {
  generateText({
    model: getFastModel(),
    prompt: `Generate a short title (max 7 words, no quotes) for a form editing conversation that starts with: "${firstMessage.slice(0, 200)}"`,
  })
    .then(async ({ text }) => {
      try {
        const title = text.trim().slice(0, 60);
        await aiChatRepository.updateConversation(conversationId, { title });
      } catch (err) {
        logger.warn({ err, conversationId }, 'Failed to save auto-generated title');
      }
    })
    .catch((err) => logger.warn({ err, conversationId }, 'Failed to auto-generate conversation title'));
}
