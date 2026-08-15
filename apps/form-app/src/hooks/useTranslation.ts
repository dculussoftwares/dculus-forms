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
      let result = resolveMessage(messages, segments);

      const count = options.values?.count;
      if (typeof result !== 'string' && typeof count === 'number' && segments.length > 0) {
        const pluralRule = new Intl.PluralRules(locale).select(count);
        const pluralSegments = segments.slice(0, -1).concat(`${segments[segments.length - 1]}_${pluralRule}`);
        result = resolveMessage(messages, pluralSegments);

        if (typeof result !== 'string' && pluralRule !== 'other') {
          const otherSegments = segments.slice(0, -1).concat(`${segments[segments.length - 1]}_other`);
          result = resolveMessage(messages, otherSegments);
        }
      }

      if (typeof result === 'string') {
        return formatMessage(result, options.values);
      }

      if (options.defaultValue) {
        return formatMessage(options.defaultValue, options.values);
      }

      return key;
    },
    [messages, namespace, locale],
  );

  return { t: translate, locale };
}
