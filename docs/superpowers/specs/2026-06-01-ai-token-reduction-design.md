# AI Token Reduction

**Date:** 2026-06-01  
**Status:** Approved  

---

## Problem

Token consumption in the AI builder chat is high enough to exhaust monthly quotas. Two independent causes:

1. **Per-message overhead** — `buildSystemPrompt` serializes the full form schema as pretty-printed JSON on every request. A 10-page form sends ~400 tokens of schema context per message — 4,000 wasted tokens over a 10-message conversation.

2. **Unbounded history** — `loadConversationMessages` fetches every saved message with no limit. A 30-message conversation sends all 30 turns to the model on message 31, and the cost grows linearly with conversation length.

---

## Solution

Two surgical changes. No new concepts, no new files.

---

## Change 1: Compact system prompt schema

**File:** `apps/backend/src/routes/aiChat.ts`  
**Function:** `buildSystemPrompt`

Replace the `JSON.stringify` block with a single compact line per page.

**Before** (~180 tokens for 3 pages, scales linearly):
```
Current form has 3 pages. Structure:
[
  { "pageNumber": 1, "id": "page-abc123", "title": "Personal Info", "fieldCount": 5 },
  { "pageNumber": 2, "id": "page-def456", "title": "Contact", "fieldCount": 8 },
  { "pageNumber": 3, "id": "page-ghi789", "title": "Submit", "fieldCount": 3 }
]
```

**After** (~35 tokens for 3 pages):
```
Form structure: p1:"Personal Info"(5f,id:page-abc123) | p2:"Contact"(8f,id:page-def456) | p3:"Submit"(3f,id:page-ghi789)
```

**Code:**
```ts
const schemaContext = totalPages > 0
  ? `\nForm structure: ${schema.pages
      .map((p: any, i: number) =>
        `p${i + 1}:"${p.title ?? `Page ${i + 1}`}"(${(p.fields ?? []).length}f,id:${p.id})`
      )
      .join(' | ')}`
  : '';
```

The AI retains everything it needs:
- Page numbers (`p1`, `p2`) for user-facing references ("page 2")
- Page IDs (`id:page-abc123`) for tool calls
- Page titles for disambiguation
- Field counts to decide whether `listFields` is worth calling

**Estimated saving:** ~80% reduction in schema tokens per message. On a 10-message conversation with a 10-page form: ~15,000 tokens saved.

---

## Change 2: History cap at 20 messages

**File:** `apps/backend/src/services/aiChatService.ts`  
**Function:** `loadConversationMessages`

Add `take: 20, orderBy: desc` to the Prisma query, then reverse the result.

**Before:**
```ts
const messages = await prisma.aIChatMessage.findMany({
  where: { conversationId },
  orderBy: { createdAt: 'asc' },
  select: { data: true },
});
return messages.map((m) => m.data as unknown as UIMessage);
```

**After:**
```ts
const MAX_HISTORY_MESSAGES = 20;

const messages = await prisma.aIChatMessage.findMany({
  where: { conversationId },
  orderBy: { createdAt: 'desc' },
  take: MAX_HISTORY_MESSAGES,
  select: { data: true },
});
return messages.reverse().map((m) => m.data as unknown as UIMessage);
```

**Why 20:** Ten user + ten assistant turns covers the realistic working window for any single form-editing session. Earlier turns are rarely referenced — form state already lives in the Y.js store, so the AI doesn't need the old text turn that said "add an email field" 15 turns ago.

**Combined effect with existing `pruneMessages`:** `pruneMessages` strips tool call artifacts from those 20 messages. The effective history cost becomes a hard ceiling of ~2,500 tokens regardless of conversation length.

---

## Combined Estimated Savings

| Scenario | Before | After | Reduction |
|---|---|---|---|
| Short conversation (5 msgs), 3-page form | ~3,000 tokens | ~1,500 tokens | ~50% |
| Medium conversation (10 msgs), 5-page form | ~8,000 tokens | ~2,500 tokens | ~70% |
| Long conversation (30 msgs), 10-page form | ~25,000 tokens | ~4,000 tokens | ~84% |

---

## Testing

- **`aiChatService.test.ts`:** Add test — seed 25 messages, assert `loadConversationMessages` returns exactly 20, in ascending order (oldest first).
- **`aiChat.test.ts` or `aiFormEditTools.test.ts`:** Add test for `buildSystemPrompt` output — assert the compact line contains page ID, title, and field count; assert no `JSON.stringify` artifact (no `{` or `"pageNumber"`).

---

## Files Changed

| File | Change |
|---|---|
| `apps/backend/src/routes/aiChat.ts` | Replace `schemaContext` JSON block with compact single-line format |
| `apps/backend/src/services/aiChatService.ts` | Add `MAX_HISTORY_MESSAGES = 20`, `take` + `desc` + `reverse()` |
| `apps/backend/src/services/__tests__/aiChatService.test.ts` | Add history cap test |
| `apps/backend/src/routes/__tests__/aiChat.test.ts` | Add compact schema format test |
