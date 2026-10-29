import { describe, expect, it } from 'vitest';
import { isFileTypeAllowed } from '../index';

describe('isFileTypeAllowed', () => {
  it('allows everything when no restriction is set', () => {
    expect(isFileTypeAllowed('image/png', [])).toBe(true);
  });

  it('matches exact types', () => {
    expect(isFileTypeAllowed('application/pdf', ['application/pdf'])).toBe(true);
    expect(isFileTypeAllowed('text/plain', ['application/pdf'])).toBe(false);
  });

  it('matches wildcard groups', () => {
    expect(isFileTypeAllowed('image/png', ['image/*'])).toBe(true);
    expect(isFileTypeAllowed('video/mp4', ['image/*'])).toBe(false);
  });

  it('is case-insensitive and does not match a bare prefix', () => {
    expect(isFileTypeAllowed('IMAGE/PNG', ['image/*'])).toBe(true);
    expect(isFileTypeAllowed('imagex/png', ['image/*'])).toBe(false);
  });

  it('rejects files with an unknown (empty) type when restricted', () => {
    expect(isFileTypeAllowed('', ['image/*'])).toBe(false);
  });
});
