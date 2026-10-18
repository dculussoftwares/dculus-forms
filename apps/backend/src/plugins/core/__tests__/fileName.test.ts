import { describe, it, expect } from 'vitest';
import { normalizeFileName, toOneDriveFileName } from '../fileName.js';

describe('normalizeFileName', () => {
  it('collapses whitespace, trims and caps the length', () => {
    expect(normalizeFileName('  Sales   Leads ')).toBe('Sales Leads');
    expect(normalizeFileName('a'.repeat(300))).toHaveLength(200);
  });

  it('returns an empty string for anything that is not a string', () => {
    expect(normalizeFileName(undefined)).toBe('');
    expect(normalizeFileName(42)).toBe('');
  });
});

describe('toOneDriveFileName', () => {
  it('replaces characters OneDrive rejects and strips trailing dots', () => {
    expect(toOneDriveFileName('Q1: Sales/Leads?..')).toBe('Q1- Sales-Leads-');
  });
});
