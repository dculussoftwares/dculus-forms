export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export const DEFAULT_PAGINATION = {
  PAGE: 1,
  LIMIT: 10,
} as const;

export const VALIDATION_MESSAGES = {
  REQUIRED: 'This field is required',
  EMAIL: 'Please enter a valid email address',
  MIN_LENGTH: 'Minimum length is {min} characters',
  MAX_LENGTH: 'Maximum length is {max} characters',
  PATTERN: 'Please enter a valid value',
} as const;

// Image upload configuration
export const IMAGE_CONFIG = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
} as const;

// Dculus brand color palette — use these instead of hardcoding hex values
export const DCULUS_COLORS = {
  text: {
    primary:   '#3c323e',
    secondary: '#655d67',
  },
  bg: {
    page:    '#f7f7f8',
    subtle:  'rgba(81,76,84,0.06)',
    hover:   'rgba(87,84,91,0.04)',
    active:  'rgba(87,84,91,0.06)',
    border:  'rgba(81,76,84,0.10)',
  },
  status: {
    errorBg:   'rgba(206,93,85,0.08)',
    errorText: '#ce5d55',
    warningBg: '#fbe19d',
    warningText: '#8b6a18',
  },
} as const;

// File upload limits
export const FILE_UPLOAD = {
  MAX_SIZE_BYTES: 50 * 1024 * 1024, // 50 MB
  SUBMISSION_TIMEOUT_MS: 30_000,
} as const;

// Renderer mode enum
export enum RendererMode {
  PREVIEW = 'PREVIEW',
  BUILDER = 'BUILDER',
  SUBMISSION = 'SUBMISSION',
  EDIT = 'EDIT',
}
