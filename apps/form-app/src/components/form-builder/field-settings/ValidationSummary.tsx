import React, { useRef } from 'react';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { useLocale } from '../../../hooks/useLocale';
import { flattenErrors } from '../../../utils/formErrors';
import {
  ErrorCollapse,
  findSettingLabel,
  goToSetting,
  usePresence,
  useSettledValue,
} from './errorReveal';

interface SummaryItem {
  path: string;
  message: string;
}

interface ValidationSummaryProps {
  errors: Record<string, any>;
}

/**
 * Helper function to translate messages that might be translation keys
 */
const useMessageTranslator = () => {
  const { messages } = useLocale();
  
  return (message: string): string => {
    // Check if the message is a translation key (format: namespace:path.to.key)
    if (message.includes(':')) {
      const [namespace, ...keyParts] = message.split(':');
      const key = keyParts.join(':');
      
      // Manually resolve the translation
      const segments = [namespace, ...key.split('.')].filter(Boolean);
      const result = segments.reduce<any>((current, segment) => {
        if (typeof current === 'object' && current !== null) {
          return current[segment];
        }
        return undefined;
      }, messages);
      
      return typeof result === 'string' ? result : message;
    }
    
    return message;
  };
};

/**
 * Sticky banner pinned to the bottom of the settings scroll area.
 * Render it last in the form (unconditionally) so appearing never pushes the
 * settings being edited; each issue scrolls smoothly to and focuses its setting.
 */
export const ValidationSummary: React.FC<ValidationSummaryProps> = ({ errors }) => {
  const { t } = useTranslation('validationSummary');
  const translateMessage = useMessageTranslator();
  const anchorRef = useRef<HTMLDivElement>(null);

  const items: SummaryItem[] = Object.entries(flattenErrors(errors))
    .map(([path, error]) => ({
      path,
      message: error?.message || (typeof error === 'string' ? error : ''),
    }))
    .filter((item) => Boolean(item.message))
    .map((item) => ({ ...item, message: translateMessage(item.message) }));

  const signature = items.length
    ? items.map((item) => `${item.path}=${item.message}`).join('|')
    : null;
  const settledItems = useSettledValue(items, signature);
  const { mounted, visible } = usePresence(Boolean(settledItems));
  // Keep the last list on screen while the banner collapses away.
  const lastItemsRef = useRef<SummaryItem[]>([]);
  if (settledItems) lastItemsRef.current = settledItems;

  const root = anchorRef.current?.closest('form') ?? null;
  const shownItems = lastItemsRef.current;

  return (
    <div ref={anchorRef} className="sticky bottom-3 z-10 !mt-0">
      {mounted && shownItems.length > 0 && (
        <ErrorCollapse visible={visible}>
          <div className="mt-6 rounded-lg bg-white dark:bg-gray-900 shadow-lg">
            <div
              data-testid="validation-error-summary"
              className="p-3 bg-[var(--tf-error-bg)] dark:bg-red-900/20 border border-[var(--tf-error-bg-lg)] dark:border-red-800 rounded-lg"
            >
              <div className="flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-destructive dark:text-red-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-destructive dark:text-red-200 mb-1">
                    {t('title')}
                  </h4>
                  <ul className="max-h-32 overflow-y-auto text-sm text-red-700 dark:text-red-300">
                    {shownItems.map((item) => {
                      const label = root ? findSettingLabel(root, item.path) : null;
                      return (
                        <li key={item.path}>
                          <button
                            type="button"
                            onClick={() => goToSetting(anchorRef.current?.closest('form'), item.path)}
                            className="group flex w-full items-start gap-1 rounded px-1 py-0.5 text-left hover:bg-[var(--tf-error-bg-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
                          >
                            <span className="flex-1">
                              {label && <strong className="font-medium">{label}: </strong>}
                              {item.message}
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 opacity-50 group-hover:opacity-100" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </ErrorCollapse>
      )}
    </div>
  );
};