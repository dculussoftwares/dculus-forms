/**
 * Magic-byte detection for the upload types the platform serves from its own
 * domain. The client-declared Content-Type and filename extension are never
 * trusted on their own: the stored type and extension come from the bytes.
 */

export interface DetectedFileType {
  mimeType: string;
  extension: string;
}

const startsWith = (buffer: Buffer, bytes: number[], offset = 0): boolean =>
  buffer.length >= offset + bytes.length && bytes.every((byte, i) => buffer[offset + i] === byte);

const asciiAt = (buffer: Buffer, text: string, offset: number): boolean =>
  buffer.length >= offset + text.length && buffer.toString('latin1', offset, offset + text.length) === text;

export function detectFileType(buffer: Buffer): DetectedFileType | null {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return { mimeType: 'image/jpeg', extension: '.jpg' };
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mimeType: 'image/png', extension: '.png' };
  }
  if (asciiAt(buffer, 'GIF87a', 0) || asciiAt(buffer, 'GIF89a', 0)) {
    return { mimeType: 'image/gif', extension: '.gif' };
  }
  if (asciiAt(buffer, 'RIFF', 0) && asciiAt(buffer, 'WEBP', 8)) {
    return { mimeType: 'image/webp', extension: '.webp' };
  }
  if (buffer.subarray(0, 1024).includes('%PDF-', 0, 'latin1')) {
    return { mimeType: 'application/pdf', extension: '.pdf' };
  }
  if (startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3])) return { mimeType: 'video/webm', extension: '.webm' };
  if (asciiAt(buffer, 'ftyp', 4)) return { mimeType: 'video/mp4', extension: '.mp4' };
  return null;
}

const normalizeMime = (mimeType: string): string => (mimeType === 'image/jpg' ? 'image/jpeg' : mimeType);

export const mimeTypesMatch = (declared: string, detected: string): boolean =>
  normalizeMime(declared) === normalizeMime(detected);
