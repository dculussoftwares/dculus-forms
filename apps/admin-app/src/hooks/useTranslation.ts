import { useCallback } from 'react';
import { useLocale } from './useLocale';
import type { Namespace } from '../locales';

type TranslateValues = Record<string, string | number>;

type TranslateOptions = {
  defaultValue?: string;
  values?: TranslateValues;
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

const formatMessage = (template: string, values?: TranslateValues) => {
  if (!values) {
    return template;
  }

  return Object.entries(values).reduce((output, [token, value]) => {
    const pattern = new RegExp(`{{\\s*${token}\\s*}}`, 'g');
    return output.replace(pattern, String(value));
  }, template);
};

export function useTranslation(namespace?: Namespace) {
  const { messages, locale } = useLocale();

  const translate = useCallback(
    (key: string, options: TranslateOptions = {}) => {
      const segments = namespace ? [namespace as string, ...splitKey(key)] : splitKey(key);
      const result = resolveMessage(messages, segments);

      if (typeof result === 'string') {
        return formatMessage(result, options.values);
      }

      if (options.defaultValue) {
        return formatMessage(options.defaultValue, options.values);
      }

      return key;
    },
    [messages, namespace],
  );

  return { t: translate, locale };
}
