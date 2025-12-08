// Dependencies
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { nanoid, customAlphabet } from "nanoid";

// Use nanoid for secure ID generation
export const generateId = (): string => {
  return nanoid();
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
  // Trim leading/trailing whitespace
  str = str.trim();
  // Convert to lowercase
  str = str.toLowerCase();
  // Remove non-alphanumeric characters (keeping spaces and hyphens)
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if ((char >= 'a' && char <= 'z') || (char >= '0' && char <= '9') || char === ' ' || char === '-') {
      result += char;
    }
  }
  // Replace spaces with hyphens and collapse consecutive hyphens
  let finalResult = '';
  let lastWasHyphen = false;
  for (let i = 0; i < result.length; i++) {
    const char = result[i];
    if (char === ' ' || char === '-') {
      if (!lastWasHyphen) {
        finalResult += '-';
        lastWasHyphen = true;
      }
    } else {
      finalResult += char;
      lastWasHyphen = false;
    }
  }
  // Remove leading/trailing hyphens
  return finalResult.replace(/^-+|-+$/g, '');
}

// Use nanoid with custom alphabet for secure random string generation
const alphanumericNanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789');

export function generateRandomString(length: number): string {
  return alphanumericNanoid(length);
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

  // Safe HTML tag removal without polynomial regex (avoids ReDoS)
  // Use split-based approach that processes tags linearly
  let plainText = '';
  let inTag = false;

  for (let i = 0; i < html.length; i++) {
    const char = html[i];
    if (char === '<') {
      inTag = true;
    } else if (char === '>') {
      inTag = false;
    } else if (!inTag) {
      plainText += char;
    }
  }

  plainText = plainText.trim();

  // Decode common HTML entities
  // IMPORTANT: Decode &amp; LAST to avoid double-unescaping issues
  // (e.g., &amp;lt; -> &lt; -> <)
  const decodedText = plainText
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');

  // Truncate with ellipsis if needed
  if (decodedText.length <= maxLength) {
    return decodedText;
  }

  return decodedText.substring(0, maxLength - 3).trim() + '...';
}

/**
 * Utility function for merging CSS classes with Tailwind support
 * Combines clsx for conditional classes with tailwind-merge for proper Tailwind deduplication
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}


// Re-export constants
export * from './constants.js';

// Re-export mention substitution utilities
export * from './mentionSubstitution.js';

// Re-export field type utilities
export * from './fieldTypeUtils.js';

// Re-export field value formatters
export * from './fieldValueFormatters.js';