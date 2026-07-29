/**
 * True when `target` is a text-entry surface (input/textarea/contenteditable —
 * covers the rich text editor). Global keyboard shortcuts (tab switches, `/`,
 * Cmd+K, Cmd+P, …) must no-op while the user is typing into one of these.
 */
export const isTypingTarget = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || Boolean(el.isContentEditable);
};
