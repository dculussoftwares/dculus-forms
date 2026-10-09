import { describe, expect, it } from 'vitest';
import { contentDisposition } from '../contentDisposition.js';

describe('contentDisposition', () => {
  it('keeps plain ASCII names readable', () => {
    expect(contentDisposition('attachment', 'report 2026.pdf')).toBe(
      `attachment; filename="report 2026.pdf"; filename*=UTF-8''report%202026.pdf`
    );
  });

  it('adds an RFC 5987 UTF-8 name and a safe ASCII fallback', () => {
    expect(contentDisposition('inline', 'விண்ணப்பம் "v2".pdf')).toBe(
      `inline; filename="${'_'.repeat(10)} _v2_.pdf"; filename*=UTF-8''%E0%AE%B5%E0%AE%BF%E0%AE%A3%E0%AF%8D%E0%AE%A3%E0%AE%AA%E0%AF%8D%E0%AE%AA%E0%AE%AE%E0%AF%8D%20%22v2%22.pdf`
    );
  });

  it('percent-encodes characters encodeURIComponent leaves alone', () => {
    expect(contentDisposition('attachment', "it's (1)*.txt")).toContain(`filename*=UTF-8''it%27s%20%281%29%2A.txt`);
  });
});
