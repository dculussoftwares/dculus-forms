const MAX_EMAIL_LENGTH = 254;

// One address only: no whitespace, list separators, display-name/quoting
// characters or control characters (CR/LF header injection).
// eslint-disable-next-line no-control-regex -- control characters are rejected on purpose
const SINGLE_EMAIL_PATTERN = /^[^\s@,;:<>"'()[\]\\\u0000-\u001f]+@[^\s@,;:<>"'()[\]\\\u0000-\u001f]+\.[^\s@,;:<>"'()[\]\\\u0000-\u001f]{2,}$/;

/** True only for a single, plain email address (never a list or a "Name <addr>" form). */
export const isSingleEmailAddress = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length <= MAX_EMAIL_LENGTH &&
  SINGLE_EMAIL_PATTERN.test(value);
