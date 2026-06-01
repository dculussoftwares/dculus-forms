# AI Token Reduction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut AI chat token consumption by 60–84% through a compact system prompt schema format and a 20-message history cap.

**Architecture:** Two independent changes — `buildSystemPrompt` in `aiChat.ts` replaces a pretty-printed JSON block with a single compact line per page; `loadConversationMessages` in `aiChatService.ts` adds `take: 20` with `orderBy: desc` + reverse to cap history. No new files, no new abstractions.

**Tech Stack:** Node.js, Express, Prisma, Vitest.

---

## File Map

| File | Change |
|---|---|
| `apps/backend/src/routes/aiChat.ts` | Replace `schemaContext` JSON block with compact format |
| `apps/backend/src/services/aiChatService.ts` | Add `MAX_HISTORY_MESSAGES = 20`, `take` + `desc` + `reverse()` |
| `apps/backend/src/services/__tests__/aiChatService.test.ts` | Add history cap test |
| `apps/backend/src/routes/__tests__/aiChat.test.ts` | Add compact schema format test |

---

### Task 1: Compact system prompt schema

**Files:**
- Modify: `apps/backend/src/routes/aiChat.ts:88–98`
- Test: `apps/backend/src/routes/__tests__/aiChat.test.ts`

- [ ] **Step 1: Write the failing test**

In `apps/backend/src/routes/__tests__/aiChat.test.ts`, add a new describe block after the existing ones. `buildSystemPrompt` is not currently exported — export it first (Step 3), then this test will pass.

```ts
import { buildSystemPrompt } from '../aiChat.js';

describe('buildSystemPrompt', () => {
  it('emits compact schema line instead of JSON block', () => {
    const schema = {
      pages: [
        { id: 'p1', title: 'Personal Info', fields: [{}, {}, {}, {}, {}] },
        { id: 'p2', title: 'Contact',       fields: [{}, {}, {}, {}, {}, {}, {}, {}] },
      ],
    };
    const prompt = buildSystemPrompt(undefined, schema);
    // compact format present
    expect(prompt).toMatch(/p1:"Personal Info"\(5f,id:p1\)/);
    expect(prompt).toMatch(/p2:"Contact"\(8f,id:p2\)/);
    // old JSON format absent
    expect(prompt).not.toContain('"pageNumber"');
    expect(prompt).not.toContain('JSON');
  });

  it('handles pages with no title using fallback', () => {
    const schema = { pages: [{ id: 'p9', title: null, fields: [] }] };
    const prompt = buildSystemPrompt(undefined, schema);
    expect(prompt).toMatch(/p1:"Page 1"\(0f,id:p9\)/);
  });

  it('returns empty schema context when form has no pages', () => {
    const prompt = buildSystemPrompt(undefined, { pages: [] });
    expect(prompt).not.toContain('Form structure');
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd /Users/natheeshkumarrangasamy/Desktop/DculusApps/dculus-forms && pnpm test:unit --reporter=verbose 2>&1 | grep -A4 'buildSystemPrompt'
```

Expected: `buildSystemPrompt is not a function` (not yet exported).

- [ ] **Step 3: Export `buildSystemPrompt` and replace the schema block**

In `apps/backend/src/routes/aiChat.ts`, make two changes:

**a) Export the function** — change line 82 from:
```ts
function buildSystemPrompt(
```
to:
```ts
export function buildSystemPrompt(
```

**b) Replace the `schemaContext` block** — replace lines 88–98:
```ts
  const totalPages = schema.pages.length;
  const schemaContext = totalPages > 0
    ? `\nCurrent form has ${totalPages} page${totalPages !== 1 ? 's' : ''}. Structure:\n${JSON.stringify(
        schema.pages.map((p: any, i: number) => ({
          pageNumber: i + 1,
          id: p.id,
          title: p.title ?? `Page ${i + 1}`,
          fieldCount: (p.fields ?? []).length,
        })),
        null, 2
      )}`
    : '';
```

With:
```ts
  const totalPages = schema.pages.length;
  const schemaContext = totalPages > 0
    ? `\nForm structure: ${schema.pages
        .map((p: any, i: number) =>
          `p${i + 1}:"${p.title ?? `Page ${i + 1}`}"(${(p.fields ?? []).length}f,id:${p.id})`
        )
        .join(' | ')}`
    : '';
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/natheeshkumarrangasamy/Desktop/DculusApps/dculus-forms && pnpm test:unit --reporter=verbose 2>&1 | grep -A4 'buildSystemPrompt'
```

Expected: 3 passing tests under `buildSystemPrompt`.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/routes/aiChat.ts apps/backend/src/routes/__tests__/aiChat.test.ts
git commit -m "perf(ai): compact system prompt schema — ~80% fewer tokens per message"
```

---

### Task 2: History cap at 20 messages

**Files:**
- Modify: `apps/backend/src/services/aiChatService.ts:61–68`
- Test: `apps/backend/src/services/__tests__/aiChatService.test.ts`

- [ ] **Step 1: Write the failing test**

In `apps/backend/src/services/__tests__/aiChatService.test.ts`, add after the existing `describe` blocks:

```ts
describe('loadConversationMessages', () => {
  it('returns at most 20 messages in ascending order', async () => {
    // Seed 25 messages ordered desc (as Prisma will return them with orderBy: desc)
    const fakeMessages = Array.from({ length: 25 }, (_, i) => ({
      data: { id: `msg-${i}`, role: 'user', content: `message ${i}`, parts: [] },
    }));
    // Prisma returns desc: newest first (index 0 = msg-24, index 19 = msg-5)
    (prisma.aIChatMessage.findMany as any).mockResolvedValue(fakeMessages.slice(0, 20));

    const result = await loadConversationMessages('conv_1');

    expect(prisma.aIChatMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
    );
    expect(result).toHaveLength(20);
    // First element should be msg-0 (oldest of the 20 returned), reversed from desc
    expect((result[0] as any).id).toBe('msg-0');
    expect((result[19] as any).id).toBe('msg-19');
  });

  it('returns all messages when fewer than 20 exist', async () => {
    const fakeMessages = [
      { data: { id: 'msg-0', role: 'user', content: 'hi', parts: [] } },
      { data: { id: 'msg-1', role: 'assistant', content: 'hello', parts: [] } },
    ];
    (prisma.aIChatMessage.findMany as any).mockResolvedValue(fakeMessages);

    const result = await loadConversationMessages('conv_1');
    expect(result).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd /Users/natheeshkumarrangasamy/Desktop/DculusApps/dculus-forms && pnpm test:unit --reporter=verbose 2>&1 | grep -A6 'loadConversationMessages'
```

Expected: the `orderBy: { createdAt: 'desc' }` assertion fails (current code uses `asc` with no `take`).

- [ ] **Step 3: Implement the history cap**

In `apps/backend/src/services/aiChatService.ts`, replace the `loadConversationMessages` function (lines 61–68):

```ts
const MAX_HISTORY_MESSAGES = 20;

export async function loadConversationMessages(conversationId: string): Promise<UIMessage[]> {
  const messages = await prisma.aIChatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: MAX_HISTORY_MESSAGES,
    select: { data: true },
  });
  return messages.reverse().map((m) => m.data as unknown as UIMessage);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/natheeshkumarrangasamy/Desktop/DculusApps/dculus-forms && pnpm test:unit --reporter=verbose 2>&1 | grep -A6 'loadConversationMessages'
```

Expected: both tests pass.

- [ ] **Step 5: Run full test suite**

```bash
cd /Users/natheeshkumarrangasamy/Desktop/DculusApps/dculus-forms && pnpm test:unit 2>&1 | tail -8
```

Expected: same pass count as before (only the 4 pre-existing `formSharing.test.ts` failures).

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/services/aiChatService.ts apps/backend/src/services/__tests__/aiChatService.test.ts
git commit -m "perf(ai): cap conversation history at 20 messages to bound long-conversation token cost"
```
