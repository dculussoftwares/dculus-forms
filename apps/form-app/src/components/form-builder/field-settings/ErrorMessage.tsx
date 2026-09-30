import React, { useEffect, useRef } from 'react';
import { AlertCircle } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { ErrorMessageProps } from './types';
import {
  ERROR_TRANSITION_MS,
  ErrorCollapse,
  SETTINGS_FIELD_ATTR,
  revealFocusedSetting,
  usePresence,
  useSettledValue,
} from './errorReveal';

const TranslatedText: React.FC<{ namespace: string; translationKey: string }> = ({
  namespace,
  translationKey,
}) => {
  const { t } = useTranslation(namespace as any);
  return <>{t(translationKey)}</>;
};

/** Renders a message, resolving `namespace:path.to.key` translation keys. */
const ErrorText: React.FC<{ message: string }> = ({ message }) => {
  if (message.includes(':')) {
    const [namespace, translationKey] = message.split(':', 2);
    return <TranslatedText namespace={namespace} translationKey={translationKey} />;
  }
  return <>{message}</>;
};

/**
 * Inline validation error for a single setting.
 * Waits for typing to settle before appearing and expands smoothly so the
 * settings below slide down instead of jumping.
 */
export const ErrorMessage: React.FC<ErrorMessageProps> = ({ error }) => {
  const rawMessage = typeof error === 'string' ? error : error?.message || null;
  const message = useSettledValue(rawMessage, rawMessage);
  const { mounted, visible } = usePresence(Boolean(message));
  const containerRef = useRef<HTMLDivElement>(null);
  // Keep the last text on screen while the error collapses away.
  const lastMessageRef = useRef(message);
  if (message) lastMessageRef.current = message;

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      const container = containerRef.current;
      // Only follow the error if the user is editing this setting, never yank the view elsewhere.
      revealFocusedSetting(
        container?.closest(`[${SETTINGS_FIELD_ATTR}]`) ?? container?.parentElement
      );
    }, ERROR_TRANSITION_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!mounted || !lastMessageRef.current) return null;

  return (
    <ErrorCollapse ref={containerRef} visible={visible} className="!mt-0">
      <div className="flex items-center space-x-1 text-destructive dark:text-red-400 text-xs mt-2 p-2 bg-[var(--tf-error-bg)] dark:bg-red-900/20 border border-[var(--tf-error-bg-lg)] dark:border-red-800 rounded-lg">
        <AlertCircle className="w-3 h-3 flex-shrink-0" />
        <span className="font-medium">
          <ErrorText message={lastMessageRef.current} />
        </span>
      </div>
    </ErrorCollapse>
  );
};
