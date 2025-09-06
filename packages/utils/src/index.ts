// nanoid will be dynamically imported when needed

export const generateId = (): string => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

export const createApiResponse = <T>(
  success: boolean,
  data?: T,
  error?: string,
  message?: string
) => {
  return {
    success,
    data,
    error,
    message,
  };
};

export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const formatDate = (date: Date): string => {
  return date.toISOString();
};

export const parseDate = (dateString: string): Date => {
  return new Date(dateString);
};

export function slugify(str: string): string {
  str = str.replace(/^\s+|\s+$/g, ''); // trim leading/trailing white space
  str = str.toLowerCase(); // convert string to lowercase
  str = str.replace(/[^a-z0-9 -]/g, '') // remove any non-alphanumeric characters
           .replace(/\s+/g, '-') // replace spaces with hyphens
           .replace(/-+/g, '-'); // remove consecutive hyphens
  return str;
}

export function generateRandomString(length: number): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

export async function generateShortUrl(length: number = 8): Promise<string> {
  // Use nanoid v5 with custom alphabet (alphanumeric only, no special characters)
  // This ensures URL-safe characters and better randomness
  try {
    // Dynamic import for ESM nanoid v5
    const { customAlphabet } = await import('nanoid');
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const generateId = customAlphabet(alphabet, Math.min(length, 12)); // Limit to max 12 chars
    return generateId();
  } catch (error) {
    // Fallback to original implementation if nanoid fails
    console.warn('nanoid failed, using fallback:', error);
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < Math.min(length, 12); i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }
}

/**
 * Frontend-only utility to construct full CDN URL from S3 key
 * Pass the CDN endpoint from your environment variables
 */
export function getImageUrl(s3Key: string, cdnEndpoint: string): string {
  if (!s3Key || !cdnEndpoint) {
    return '';
  }
  
  // Remove leading slash if present
  const cleanKey = s3Key.startsWith('/') ? s3Key.slice(1) : s3Key;
  
  // Ensure endpoint doesn't end with slash
  const cleanEndpoint = cdnEndpoint.endsWith('/') ? cdnEndpoint.slice(0, -1) : cdnEndpoint;
  
  return `${cleanEndpoint}/${cleanKey}`;
}

/**
 * Strips HTML tags from text and truncates with ellipsis
 * @param html - HTML string to process
 * @param maxLength - Maximum length before truncation (default: 50)
 * @returns Plain text with ellipsis if truncated
 */
export function stripHtmlAndTruncate(html: string, maxLength: number = 50): string {
  if (!html) return '';
  
  // Strip HTML tags using regex
  const plainText = html.replace(/<[^>]*>/g, '').trim();
  
  // Decode common HTML entities
  const decodedText = plainText
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  
  // Truncate with ellipsis if needed
  if (decodedText.length <= maxLength) {
    return decodedText;
  }
  
  return decodedText.substring(0, maxLength - 3).trim() + '...';
}

/**
 * Utility function for merging CSS classes with Tailwind support
 * Similar to clsx but with tailwind-merge integration
 */
export function cn(...classes: (string | undefined | null | boolean)[]): string {
  // Filter out falsy values and join with spaces
  return classes.filter(Boolean).join(' ');
}


// Re-export constants
export * from './constants.js';

// Re-export mention substitution utilities
export * from './mentionSubstitution.js';