/**
 * Keys starting with `__` are an internal channel (`__digest*`, `__isTest`) the automation engine
 * uses to pass trusted values to action handlers alongside respondent data. Field ids never start
 * with `__`, so any such key arriving in an answer payload is an attempt to forge that channel
 * (e.g. a fake `__digestResponses` list that makes the email handler mail attacker-chosen
 * recipients) and is dropped before the data reaches events, triggers or storage.
 */
export const RESERVED_KEY_PREFIX = '__';

export const isReservedKey = (key: string): boolean => key.startsWith(RESERVED_KEY_PREFIX);

export const stripReservedKeys = <T>(data: T): T => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
  return Object.fromEntries(Object.entries(data).filter(([key]) => !isReservedKey(key))) as T;
};
