import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { cn } from '@dculus/utils';

/** Grace period so transient mid-typing states (e.g. "1" on the way to "100") never flash an error. */
export const ERROR_REVEAL_DELAY_MS = 500;
export const ERROR_TRANSITION_MS = 200;

/** Marks the wrapper of a single setting (label + control + error) as one scroll/focus target. */
export const SETTINGS_FIELD_ATTR = 'data-settings-field';

const FOCUSABLE_SELECTOR =
  'input:not([disabled]), textarea:not([disabled]), button:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function scrollableAncestorOf(element: Element): HTMLElement | null {
  let node = element.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

// scrollIntoView also scrolls overflow:hidden ancestors, shifting the builder layout under the top bar.
export function scrollToElement(element: Element, block: ScrollLogicalPosition) {
  const container = scrollableAncestorOf(element);
  if (!container) return;
  const containerRect = container.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  const offsetTop = elementRect.top - containerRect.top;
  const offsetBottom = elementRect.bottom - containerRect.bottom;

  let delta: number;
  if (block === 'center') {
    delta = offsetTop - (container.clientHeight - elementRect.height) / 2;
  } else if (block === 'start') {
    delta = offsetTop;
  } else if (block === 'end') {
    delta = offsetBottom;
  } else if (offsetTop < 0) {
    delta = offsetTop;
  } else if (offsetBottom > 0) {
    delta = Math.min(offsetBottom, offsetTop);
  } else {
    return;
  }
  container.scrollTo({
    top: container.scrollTop + delta,
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
  });
}

const settingGroupOf = (element: Element) =>
  element.closest(`[${SETTINGS_FIELD_ATTR}]`) ?? element;

/** Keeps the setting the user is editing in view when something around it changes size. */
export function revealFocusedSetting(root: Element | null | undefined) {
  const active = document.activeElement;
  if (!root || !active || active === document.body || !root.contains(active)) return;
  scrollToElement(settingGroupOf(active), 'nearest');
}

/** Resolves an RHF error path (e.g. `validation.minLength`, `options.2`) to its control, walking up to parents. */
export function findSettingElement(root: Element, path: string): Element | null {
  let current = path;
  while (current) {
    const match =
      root.querySelector(`[id="field-${current}"]`) ??
      root.querySelector(`[name="${current}"]`) ??
      root.querySelector(`[data-field-path="${current}"]`);
    if (match) return match;
    const lastDot = current.lastIndexOf('.');
    current = lastDot === -1 ? '' : current.slice(0, lastDot);
  }
  return null;
}

/** Human label for a setting: its <label for>, aria-label, or the first label in its setting wrapper. */
export function findSettingLabel(root: Element, path: string): string | null {
  const explicit =
    root.querySelector(`label[for="field-${path}"]`)?.textContent ??
    root.querySelector(`[id="field-${path}"]`)?.getAttribute('aria-label');
  if (explicit?.trim()) return explicit.trim();
  const target = findSettingElement(root, path);
  const grouped = target && settingGroupOf(target).querySelector('label')?.textContent;
  return grouped?.trim() || null;
}

export function goToSetting(root: Element | null | undefined, path: string) {
  if (!root) return;
  const target = findSettingElement(root, path);
  if (!target) return;
  scrollToElement(settingGroupOf(target), 'center');
  const focusable = target.matches(FOCUSABLE_SELECTOR)
    ? target
    : target.querySelector(FOCUSABLE_SELECTOR);
  (focusable as HTMLElement | null)?.focus({ preventScroll: true });
}

/**
 * Holds back a newly appearing value until it has been stable for `delayMs`.
 * Clearing is immediate, and once shown, changes apply immediately.
 */
export function useSettledValue<T>(
  value: T | null,
  key: string | null,
  delayMs = ERROR_REVEAL_DELAY_MS
): T | null {
  const [settled, setSettled] = useState<T | null>(null);
  const settledRef = useRef(settled);
  settledRef.current = settled;
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (key === null) {
      setSettled(null);
      return;
    }
    if (settledRef.current !== null) {
      setSettled(valueRef.current);
      return;
    }
    const timer = setTimeout(() => setSettled(valueRef.current), delayMs);
    return () => clearTimeout(timer);
  }, [key, delayMs]);

  return key === null ? null : settled;
}

/** Keeps content mounted through its exit transition. `visible` flips a frame after mount so the enter animates. */
export function usePresence(show: boolean, durationMs = ERROR_TRANSITION_MS) {
  const [mounted, setMounted] = useState(show);
  const [visible, setVisible] = useState(show);

  useEffect(() => {
    if (show) {
      setMounted(true);
      let frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(frame);
    }
    setVisible(false);
    const timer = setTimeout(() => setMounted(false), durationMs);
    return () => clearTimeout(timer);
  }, [show, durationMs]);

  return { mounted: mounted || show, visible: visible && show };
}

interface ErrorCollapseProps {
  visible: boolean;
  className?: string;
  children: React.ReactNode;
}

/** Animates height + opacity so content below slides instead of jumping. */
export const ErrorCollapse = forwardRef<HTMLDivElement, ErrorCollapseProps>(
  ({ visible, className, children }, ref) => (
    <div
      ref={ref}
      aria-hidden={!visible}
      className={cn(
        'grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none',
        visible ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        className
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  )
);
ErrorCollapse.displayName = 'ErrorCollapse';
