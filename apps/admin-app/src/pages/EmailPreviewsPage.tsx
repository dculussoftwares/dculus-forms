import type { OTPEmailData } from '../../../backend/src/templates/otpEmail';
import type { ResetPasswordEmailData } from '../../../backend/src/templates/resetPasswordEmail';
import type { InvitationEmailData } from '../../../backend/src/templates/invitationEmail';
import type { MagicLinkEmailData } from '../../../backend/src/templates/magicLinkEmail';
import type { FormPublishedEmailData } from '../../../backend/src/services/emailService';

import { useState } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@dculus/ui';

// Import email generators from backend (used in Task 3)
import { generateOTPEmailHtml } from '../../../backend/src/templates/otpEmail';
import { generateResetPasswordEmailHtml } from '../../../backend/src/templates/resetPasswordEmail';
import { generateInvitationEmailHtml } from '../../../backend/src/templates/invitationEmail';
import { generateMagicLinkEmailHtml } from '../../../backend/src/templates/magicLinkEmail';
import { generateFormPublishedHtml } from '../../../backend/src/templates/formPublishedEmail';

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

type ViewportMode = 'mobile' | 'desktop';

interface EmailPreviewProps {
  html: string;
  iframeWidth: string;
}

function EmailPreview({ html, iframeWidth }: EmailPreviewProps) {
  return (
    <div className="flex justify-center p-6">
      <iframe
        srcDoc={html}
        title="Email Preview"
        style={{
          width: iframeWidth,
          height: '600px',
          border: 'none',
          borderRadius: '8px',
          boxShadow: '0 2px 8px var(--tf-overlay)',
        }}
        sandbox="allow-same-origin"
      />
    </div>
  );
}

export default function EmailPreviewsPage() {
  const { t } = useTranslation('emailPreviews');
  const [viewportMode, setViewportMode] = useState<ViewportMode>('desktop');
  const [activeTab, setActiveTab] = useState('otp');

  const iframeWidth = viewportMode === 'mobile' ? '375px' : '600px';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-primary">{t('pageTitle')}</h1>
          <p className="text-xs mt-0.5 text-muted-foreground">{t('pageSubtitle')}</p>
        </div>
        <button
          onClick={() => setViewportMode(viewportMode === 'mobile' ? 'desktop' : 'mobile')}
          className="px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            backgroundColor: 'var(--tf-tab-bg)',
            color: 'var(--tf-text)',
          }}
        >
          {viewportMode === 'mobile' ? t('viewportToggle.desktop') : t('viewportToggle.mobile')}
        </button>
      </div>

      {/* Tabs */}
      <div className="rounded-xl bg-white p-5" style={{ border: '1px solid var(--tf-border-medium)' }}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5 gap-1">
            <TabsTrigger value="otp">{t('tabs.otp')}</TabsTrigger>
            <TabsTrigger value="resetPassword">{t('tabs.resetPassword')}</TabsTrigger>
            <TabsTrigger value="invitation">{t('tabs.invitation')}</TabsTrigger>
            <TabsTrigger value="magicLink">{t('tabs.magicLink')}</TabsTrigger>
            <TabsTrigger value="formPublished">{t('tabs.formPublished')}</TabsTrigger>
          </TabsList>

          {/* Tab contents */}
          <TabsContent value="otp" className="mt-4 space-y-4">
            {Object.entries(OTP_SAMPLE_DATA).map(([variant, data]) => (
              <div key={variant} className="border-t pt-4 first:border-t-0 first:pt-0">
                <h3 className="text-sm font-medium text-primary mb-3">{t(`otpVariants.${variant.replace(/-/g, '')}`)}</h3>
                <EmailPreview html={generateOTPEmailHtml(data)} iframeWidth={iframeWidth} />
              </div>
            ))}
          </TabsContent>
          <TabsContent value="resetPassword" className="mt-4">
            <EmailPreview html={generateResetPasswordEmailHtml(RESET_PASSWORD_SAMPLE_DATA)} iframeWidth={iframeWidth} />
          </TabsContent>
          <TabsContent value="invitation" className="mt-4">
            <EmailPreview html={generateInvitationEmailHtml(INVITATION_SAMPLE_DATA)} iframeWidth={iframeWidth} />
          </TabsContent>
          <TabsContent value="magicLink" className="mt-4">
            <EmailPreview html={generateMagicLinkEmailHtml(MAGIC_LINK_SAMPLE_DATA)} iframeWidth={iframeWidth} />
          </TabsContent>
          <TabsContent value="formPublished" className="mt-4">
            <EmailPreview html={generateFormPublishedHtml(FORM_PUBLISHED_SAMPLE_DATA)} iframeWidth={iframeWidth} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
