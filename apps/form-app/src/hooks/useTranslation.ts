import { useCallback } from 'react';
import { useLocale } from '../contexts/LocaleContext';
import type { Namespace } from '../locales';

type TranslateOptions = {
  defaultValue?: string;
};

type TranslationNode = Record<string, unknown> | string;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const splitKey = (key: string) => key.split('.').filter(Boolean);

const resolveMessage = (node: TranslationNode, segments: string[]): unknown => {
  return segments.reduce<unknown>((current, segment) => {
    if (!isRecord(current)) {
      return undefined;
    }

    return current[segment];
  }, node);
};

export function useTranslation(namespace?: Namespace) {
  const { messages, locale } = useLocale();

  const translate = useCallback(
    (key: string, options: TranslateOptions = {}) => {
      const segments = namespace ? [namespace as string, ...splitKey(key)] : splitKey(key);
      const result = resolveMessage(messages, segments);

      if (typeof result === 'string') {
        return result;
      }

      return options.defaultValue ?? key;
    },
    [messages, namespace],
  );

  return { t: translate, locale };
}
