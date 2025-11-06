import { vi } from 'vitest';

export const mockEmailService = {
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
  sendFormPublishedEmail: vi.fn().mockResolvedValue(true),
  sendOTPEmail: vi.fn().mockResolvedValue(true),
  sendInvitationEmail: vi.fn().mockResolvedValue(true),
};
