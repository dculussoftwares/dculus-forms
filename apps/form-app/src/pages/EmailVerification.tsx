import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useMutation, useApolloClient } from '@apollo/client';
import { OTPInput } from '@dculus/ui';
import { slugify } from '@dculus/utils';
import { emailOtp, signIn, authClient, organization } from '../lib/auth-client';
import { ArrowLeft, FileText, Mail, Timer } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { INITIALIZE_ORGANIZATION_SUBSCRIPTION } from '../graphql/subscription';

interface LocationState {
  email?: string;
  password?: string;
  fromSignIn?: boolean;
}

interface PendingSignupData {
  email: string;
  password: string;
  organizationName: string;
}

export const EmailVerification = () => {
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const location = useLocation();
  const apolloClient = useApolloClient();
  const { t } = useTranslation('emailVerification');

  const [initializeSubscription] = useMutation(INITIALIZE_ORGANIZATION_SUBSCRIPTION);

  const state = location.state as LocationState | null;
  const stateEmail = state?.email || '';
  const statePassword = state?.password || '';
  const fromSignIn = state?.fromSignIn || false;

  const pendingSignupData: PendingSignupData | null = (() => {
    const stored = sessionStorage.getItem('pendingSignupData');
    if (stored) { try { return JSON.parse(stored); } catch { return null; } }
    return null;
  })();

  const email = pendingSignupData?.email || stateEmail;
  const password = pendingSignupData?.password || statePassword;
  const organizationName = pendingSignupData?.organizationName || '';
  const pendingInvitationId = typeof window !== 'undefined' ? sessionStorage.getItem('pendingInvitationId') : null;

  useEffect(() => { if (!email) navigate('/signin'); }, [email, navigate]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) { setErrors({ otp: t('messages.otpIncomplete') }); return; }
    setIsLoading(true);
    setErrors({});
    try {
      const verifyResponse = await emailOtp.verifyEmail({ email, otp: otp.trim() });
      if (verifyResponse.error) { setErrors({ otp: verifyResponse.error.message || t('messages.otpInvalid') }); return; }

      if (password) {
        const signInResponse = await signIn.email({ email, password });
        if (signInResponse.error) { setErrors({ otp: t('messages.signInFailed') }); return; }
      }

      if (pendingInvitationId) {
        try {
          await organization.acceptInvitation({ invitationId: pendingInvitationId });
          sessionStorage.removeItem('pendingInvitationId');
          navigate('/');
          return;
        } catch { /* continue with org creation */ }
      }

      if (!pendingInvitationId && organizationName) {
        const orgSlug = slugify(organizationName);
        const orgResult = await authClient.organization.create({ name: organizationName, slug: orgSlug });
        if (orgResult?.data?.id) {
          try {
            await initializeSubscription({ variables: { organizationId: orgResult.data.id } });
          } catch { /* non-fatal */ }
          try {
            await organization.setActive({ organizationId: orgResult.data.id });
            await authClient.getSession();
            await apolloClient.refetchQueries({ include: ['ActiveOrganization'] });
          } catch { /* non-fatal */ }
        }
      }

      sessionStorage.removeItem('pendingSignupData');
      navigate('/');
    } catch {
      setErrors({ otp: t('messages.unexpectedError') });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;
    setIsLoading(true);
    setErrors({});
    try {
      const response = await emailOtp.sendVerificationOtp({ email, type: 'email-verification' });
      if (response.error) {
        setErrors({ submit: response.error.message || t('messages.resendFailed') });
      } else {
        setCountdown(60);
        setOtp('');
      }
    } catch {
      setErrors({ submit: t('messages.resendFailed') });
    } finally {
      setIsLoading(false);
    }
  };

  if (!email) return null;

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Left dark panel */}
      <div className="hidden lg:flex lg:flex-col lg:w-[480px] xl:w-[560px] shrink-0 p-10 justify-between" style={{ backgroundColor: '#2a222b' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#3c323e' }}>
            <FileText className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-semibold text-lg">{t('hero.productName')}</span>
        </div>
        <div className="space-y-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
            <Mail className="w-6 h-6" style={{ color: 'rgba(255,255,255,0.70)' }} />
          </div>
          <h2 className="text-white text-3xl font-light leading-tight">{t('hero.tagline')}</h2>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>{t('hero.attribution')}</p>
        </div>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>© {new Date().getFullYear()} Dculus Forms</p>
      </div>

      {/* Right white panel */}
      <div className="flex-1 flex flex-col overflow-y-auto bg-white">
        <div className="flex items-center justify-end px-8 py-5" style={{ borderBottom: '1px solid rgba(81,76,84,0.08)' }}>
          <span className="text-sm" style={{ color: '#655d67' }}>
            {fromSignIn ? t('links.backToSignIn') : t('links.backToSignUp')}{' '}
            <Link to={fromSignIn ? '/signin' : '/signup'} className="font-medium" style={{ color: '#3c323e' }}>
              {fromSignIn ? t('links.signIn') : t('links.signUp')}
            </Link>
          </span>
        </div>

        <div className="flex-1 flex items-center justify-center px-8 py-12">
          <div className="w-full max-w-sm">
            <button
              onClick={() => navigate(fromSignIn ? '/signin' : '/signup')}
              className="flex items-center gap-1.5 text-xs mb-6 transition-colors"
              style={{ color: '#655d67' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#3c323e'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#655d67'}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {fromSignIn ? t('links.signIn') : t('links.signUp')}
            </button>

            <div className="mb-7">
              <h1 className="text-2xl font-semibold mb-1.5" style={{ color: '#3c323e' }}>{t('meta.heading')}</h1>
              <p className="text-sm" style={{ color: '#655d67' }}>{t('meta.subheading', { values: { email } })}</p>
            </div>

            <form onSubmit={handleVerifyOTP} className="space-y-5">
              <div>
                <label className="text-xs font-medium block mb-3 text-center" style={{ color: '#4c414e' }}>
                  {t('form.otpLabel')}
                </label>
                <OTPInput
                  value={otp}
                  onChange={(value) => { setOtp(value); if (errors.otp) setErrors(prev => ({ ...prev, otp: '' })); }}
                  disabled={isLoading}
                  hasError={!!errors.otp}
                />
                {errors.otp && (
                  <p className="text-xs mt-2 text-center" style={{ color: '#ce5d55' }}>{errors.otp}</p>
                )}
              </div>

              <div className="text-center">
                {countdown > 0 ? (
                  <span className="text-xs flex items-center justify-center gap-1.5" style={{ color: '#655d67' }}>
                    <Timer className="w-3.5 h-3.5" />
                    {t('form.countdown', { values: { seconds: countdown } })}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={isLoading}
                    className="text-xs font-medium transition-colors"
                    style={{ color: '#3c323e' }}
                  >
                    {t('form.resend')}
                  </button>
                )}
              </div>

              {errors.submit && (
                <p className="text-xs text-center py-2 px-3 rounded-lg" style={{ backgroundColor: 'rgba(206,93,85,0.06)', color: '#ce5d55', border: '1px solid rgba(206,93,85,0.14)' }}>
                  {errors.submit}
                </p>
              )}

              <button
                type="submit"
                disabled={isLoading || otp.length !== 6}
                className="w-full h-10 rounded-lg text-sm font-medium text-white transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#3c323e' }}
                onMouseEnter={e => { if (!isLoading && otp.length === 6) (e.currentTarget as HTMLElement).style.backgroundColor = '#2e2530'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#3c323e'; }}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    {t('form.actions.submitting')}
                  </span>
                ) : t('form.actions.submit')}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
