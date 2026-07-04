import type { OTPEmailData } from '../../../backend/src/templates/otpEmail';
import type { ResetPasswordEmailData } from '../../../backend/src/templates/resetPasswordEmail';
import type { InvitationEmailData } from '../../../backend/src/templates/invitationEmail';
import type { MagicLinkEmailData } from '../../../backend/src/templates/magicLinkEmail';
import type { FormPublishedEmailData } from '../../../backend/src/services/emailService';

/** Sample data for OTP Email variants */
export const OTP_SAMPLE_DATA = {
  'sign-in': {
    otp: '123456',
    type: 'sign-in',
    expiresInMinutes: 5,
  } as OTPEmailData,
  'sign-up': {
    otp: '654321',
    type: 'sign-up',
    expiresInMinutes: 5,
  } as OTPEmailData,
  'email-verification': {
    otp: '987654',
    type: 'email-verification',
    expiresInMinutes: 5,
  } as OTPEmailData,
  'forget-password': {
    otp: '345678',
    type: 'forget-password',
    expiresInMinutes: 5,
  } as OTPEmailData,
};

/** Sample data for Reset Password Email */
export const RESET_PASSWORD_SAMPLE_DATA: ResetPasswordEmailData = {
  userEmail: 'sarah.johnson@example.com',
  resetUrl: 'https://dculus.com/reset?token=xyz789abc123def456',
  expiresInHours: 1,
};

/** Sample data for Invitation Email */
export const INVITATION_SAMPLE_DATA: InvitationEmailData = {
  to: 'jane.doe@acmecorp.com',
  organizationName: 'Acme Corporation',
  inviterName: 'John Smith',
  invitationUrl: 'https://dculus.com/invite/inv_123456789',
  expiresInHours: 48,
};

/** Sample data for Magic Link Email */
export const MAGIC_LINK_SAMPLE_DATA: MagicLinkEmailData = {
  url: 'https://dculus.com/auth/magic-link?token=ml_xyz789abc123def456',
  expiresInMinutes: 5,
};

/** Sample data for Form Published Email */
export const FORM_PUBLISHED_SAMPLE_DATA: FormPublishedEmailData = {
  formTitle: 'Customer Feedback Survey',
  formDescription: 'Help us improve your experience',
  formUrl: 'https://dculus.com/f/customer-feedback',
  ownerName: 'Alice Brown',
};

export default function EmailPreviewsPage() {
  return null;
}
