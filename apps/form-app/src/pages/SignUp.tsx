import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useApolloClient } from '@apollo/client/react';
import { Button, Input, Label, OTPInput } from '@dculus/ui';
import { FileText } from 'lucide-react';
import { slugify } from '@dculus/utils';
import { authClient, signUp, emailOtp, signIn, organization } from '../lib/auth-client';
import { ArrowLeft, Timer } from 'lucide-react';
import { GoogleIcon } from '../components/icons/GoogleIcon';
import { INITIALIZE_ORGANIZATION_SUBSCRIPTION } from '../graphql/subscription';
import { useTranslation } from '../hooks/useTranslation';

const Field = ({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) => (
  <div>
    <Label htmlFor={id} className="text-xs font-medium block mb-1.5 text-foreground">{label}</Label>
    {children}
    {error && <p className="text-xs mt-1 text-destructive">{error}</p>}
  </div>
);

export const SignUp = () => {
  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [isLoading, setIsLoading] = useState(false);
  const [otp, setOtp] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    organizationName: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const location = useLocation();
  const apolloClient = useApolloClient();
  const { t } = useTranslation('signUp');

  // GraphQL mutation for initializing organization subscription
  const [initializeSubscription] = useMutation(INITIALIZE_ORGANIZATION_SUBSCRIPTION);

  // Check for invitation context
  const invitationEmail = location.state?.email;
  const pendingInvitationId = typeof window !== 'undefined' ? sessionStorage.getItem('pendingInvitationId') : null;
  
  // Prefill email if coming from invitation
  useEffect(() => {
    if (invitationEmail) {
      setFormData(prev => ({ ...prev, email: invitationEmail }));
    }
  }, [invitationEmail]);

  // Countdown timer for resend OTP
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = t('form.fields.name.errors.required');
    }

    if (!formData.email.trim()) {
      newErrors.email = t('form.fields.email.errors.required');
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = t('form.fields.email.errors.invalid');
    }

    if (!formData.password) {
      newErrors.password = t('form.fields.password.errors.required');
    } else if (formData.password.length < 8) {
      newErrors.password = t('form.fields.password.errors.length');
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = t('form.fields.confirmPassword.errors.mismatch');
    }

    // Organization name is only required if not joining via invitation
    if (!pendingInvitationId && !formData.organizationName.trim()) {
      newErrors.organizationName = t('form.fields.organizationName.errors.required');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      // First, create the user account without email verification
      const signUpResponse = await signUp.email({
        email: formData.email,
        password: formData.password,
        name: formData.name,
      });

      if (signUpResponse.error) {
        const errorCode = (signUpResponse.error as any)?.code;
        if (errorCode === 'PASSWORD_COMPROMISED') {
          setErrors({ password: t('messages.passwordCompromised') });
        } else {
          setErrors({ submit: signUpResponse.error.message || t('messages.submitFailed') });
        }
        return;
      }

      // Send OTP for email verification
      const otpResponse = await emailOtp.sendVerificationOtp({
        email: formData.email,
        type: 'email-verification',
      });

      if (otpResponse.error) {
        setErrors({
          submit: otpResponse.error.message || t('messages.sendOtpFailed'),
        });
        return;
      }

      // Store only non-sensitive signup data for recovery if user exits OTP page
      sessionStorage.setItem('pendingSignupData', JSON.stringify({
        email: formData.email,
        organizationName: formData.organizationName,
      }));

      // Move to OTP verification step
      setStep('verify');
      setCountdown(60);
      setOtp('');
    } catch (error) {
      console.error('Signup error:', error);
      setErrors({
        submit: t('messages.unexpectedError'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (otp.length !== 6) {
      setErrors({ otp: t('messages.otpIncomplete') });
      return;
    }

    setIsLoading(true);
    setErrors({});
    
    try {
      // Verify the OTP
      const verifyResponse = await emailOtp.verifyEmail({
        email: formData.email,
        otp: otp.trim(),
      });

      if (verifyResponse.error) {
        setErrors({
          otp: verifyResponse.error.message || t('messages.otpInvalid'),
        });
        return;
      }

      // Sign in the user
      const signInResponse = await signIn.email({
        email: formData.email,
        password: formData.password,
      });

      if (signInResponse.error) {
        setErrors({
          otp: t('messages.signInFailed'),
        });
        return;
      }

      // Check if there's a pending invitation to accept
      if (pendingInvitationId) {
        try {
          await organization.acceptInvitation({
            invitationId: pendingInvitationId,
          });
          
          // Clear the pending invitation
          sessionStorage.removeItem('pendingInvitationId');
          
          // Navigate to dashboard with success message
          navigate('/', { 
            state: { 
              message: t('messages.joinSuccess') 
            } 
          });
          return;
        } catch (invitationError) {
          console.error('Error accepting invitation:', invitationError);
          // Continue with normal organization creation if invitation acceptance fails
        }
      }

      // Create the organization if not accepting an invitation
      if (!pendingInvitationId) {
        const organizationSlug = slugify(formData.organizationName);
        const orgResult = await authClient.organization.create({
          name: formData.organizationName,
          slug: organizationSlug,
        });

        // Initialize free subscription for the new organization
        if (orgResult?.data?.id) {
          try {
            const subscriptionResult = await initializeSubscription({
              variables: { organizationId: orgResult.data.id },
            });

            if (!subscriptionResult.data?.initializeOrganizationSubscription?.success) {
              console.error('[SignUp] ⚠️ Subscription initialization failed:', subscriptionResult.data?.initializeOrganizationSubscription?.message);
            }
          } catch (subscriptionError) {
            // Log error but don't block signup flow
            console.error('[SignUp] ⚠️ Error initializing subscription:', subscriptionError);
          }

          // Set active organization and refresh session
          try {
            await organization.setActive({
              organizationId: orgResult.data.id,
            });
            await authClient.getSession();
            
            // Refetch Apollo queries to ensure activeOrganization is up to date
            await apolloClient.refetchQueries({
              include: ['ActiveOrganization'],
            });
          } catch (sessionError) {
            console.error('[SignUp] Error setting active organization:', sessionError);
          }
        }
      }

      // Clear the pending signup data
      sessionStorage.removeItem('pendingSignupData');

      // Navigate to dashboard
      navigate('/');
    } catch (error) {
      console.error('OTP verification error:', error);
      setErrors({
        otp: t('messages.unexpectedError'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;
    
    setIsLoading(true);
    setErrors({});
    
    try {
      const response = await emailOtp.sendVerificationOtp({
        email: formData.email,
        type: 'email-verification',
      });

      if (response.error) {
        setErrors({ 
          submit: response.error.message || t('messages.resendGenericFailed') 
        });
      } else {
        setCountdown(60);
        setOtp('');
      }
    } catch (error) {
      console.error('Resend OTP error:', error);
      setErrors({ 
        submit: t('messages.resendFailed') 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToForm = () => {
    setStep('form');
    setOtp('');
    setErrors({});
    setCountdown(0);
  };
  const heading =
    step === 'form'
      ? pendingInvitationId
        ? t('headings.formInvitation')
        : t('headings.form')
      : t('headings.verify');

  const description =
    step === 'form'
      ? pendingInvitationId
        ? t('descriptions.formInvitation')
        : t('descriptions.form')
      : t('descriptions.verify', { values: { email: formData.email } });



  return (
    <div className="h-screen flex overflow-hidden">
      {/* ── Left: dark aubergine brand panel ── */}
      <div className="hidden lg:flex lg:flex-col lg:w-[480px] xl:w-[560px] shrink-0 p-10 justify-between" style={{ backgroundColor: 'var(--tf-darkest)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--tf-dark)' }}>
            <FileText className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-semibold text-lg">{t('hero.productName')}</span>
        </div>
        <div className="space-y-4">
          <h2 className="text-white text-3xl font-light leading-tight">{t('hero.tagline')}</h2>
          <p className="text-sm text-[rgba(255,255,255,0.55)]">{t('hero.attribution')}</p>
        </div>
        <p className="text-xs text-[rgba(255,255,255,0.35)]">© {new Date().getFullYear()} Dculus Forms</p>
      </div>

      {/* ── Right: clean white panel ── */}
      <div className="flex-1 flex flex-col overflow-y-auto bg-white">
        {/* Top nav */}
        <div className="flex items-center justify-end px-8 py-5" style={{ borderBottom: '1px solid var(--tf-border-light)' }}>
          <span className="text-sm text-muted-foreground">
            {t('links.signInPrompt')}{' '}
            <Link to="/signin" className="font-medium hover:underline text-primary">
              {t('links.signIn')}
            </Link>
          </span>
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center px-8 py-10">
          <div className="w-full max-w-sm">

            {/* Back button (verify step) */}
            {step === 'verify' && (
              <Button variant="ghost" size="sm" onClick={handleBackToForm} className="flex items-center gap-1.5 text-xs mb-6 h-7 px-2 text-muted-foreground hover:text-primary">
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </Button>
            )}

            <div className="mb-7">
              <h1 className="text-2xl font-semibold mb-1.5 text-primary">{heading}</h1>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>

            {step === 'form' ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Google sign-up */}
                <button
                  type="button"
                  onClick={() => {
                    const from = (location.state as { from?: { pathname?: string } })?.from?.pathname;
                    if (from && from !== '/') sessionStorage.setItem('redirectAfterAuth', from);
                    signIn.social({ provider: 'google', callbackURL: '/oauth/callback' });
                  }}
                  className="w-full h-10 flex items-center justify-center gap-2 text-xs font-medium rounded-lg border border-border bg-white text-foreground hover:shadow-sm transition-all mb-4"
                >
                  <GoogleIcon size={16} />
                  {t('google.button')}
                </button>

                {/* Divider */}
                <div className="flex items-center gap-2 mb-5">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">{t('google.divider')}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <Field id="name" label={t('form.fields.name.label')} error={errors.name}>
                  <Input id="name" name="name" type="text" placeholder={t('form.fields.name.placeholder')} value={formData.name} onChange={handleInputChange} disabled={isLoading} className={errors.name ? 'border-destructive' : ''} />
                </Field>

                <Field id="email" label={t('form.fields.email.label')} error={errors.email}>
                  <Input id="email" name="email" type="email" placeholder={t('form.fields.email.placeholder')} value={formData.email} onChange={handleInputChange} disabled={isLoading || !!pendingInvitationId} className={errors.email ? 'border-destructive' : ''} />
                  {pendingInvitationId && <p className="text-xs mt-1 text-muted-foreground">{t('form.fields.email.invitationNotice')}</p>}
                </Field>

                {!pendingInvitationId && (
                  <Field id="organizationName" label={t('form.fields.organizationName.label')} error={errors.organizationName}>
                    <Input id="organizationName" name="organizationName" type="text" placeholder={t('form.fields.organizationName.placeholder')} value={formData.organizationName} onChange={handleInputChange} disabled={isLoading} className={errors.organizationName ? 'border-destructive' : ''} />
                  </Field>
                )}

                <Field id="password" label={t('form.fields.password.label')} error={errors.password}>
                  <Input id="password" name="password" type="password" placeholder={t('form.fields.password.placeholder')} value={formData.password} onChange={handleInputChange} disabled={isLoading} className={errors.password ? 'border-destructive' : ''} />
                </Field>

                <Field id="confirmPassword" label={t('form.fields.confirmPassword.label')} error={errors.confirmPassword}>
                  <Input id="confirmPassword" name="confirmPassword" type="password" placeholder={t('form.fields.confirmPassword.placeholder')} value={formData.confirmPassword} onChange={handleInputChange} disabled={isLoading} className={errors.confirmPassword ? 'border-destructive' : ''} />
                </Field>

                {errors.submit && (
                  <p className="text-xs text-center py-2 px-3 rounded-lg" style={{ backgroundColor: 'var(--tf-error-bg)', color: 'var(--tf-error)', border: '1px solid var(--tf-error-bg-md)' }}>
                    {errors.submit}
                  </p>
                )}

                <Button type="submit" disabled={isLoading} className="w-full h-10 mt-2">
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      {t('form.actions.submitting')}
                    </span>
                  ) : t('form.actions.submit')}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOTP} className="space-y-5">
                <div>
                  <Label className="text-xs font-medium block mb-3 text-center text-foreground">
                    {t('verify.otpLabel')}
                  </Label>
                  <OTPInput value={otp} onChange={(value) => { setOtp(value); if (errors.otp) setErrors(prev => ({ ...prev, otp: '' })); }} disabled={isLoading} hasError={!!errors.otp} />
                  {errors.otp && <p className="text-xs mt-2 text-center text-destructive">{errors.otp}</p>}
                </div>

                <div className="text-center">
                  {countdown > 0 ? (
                    <span className="text-xs flex items-center justify-center gap-1.5 text-muted-foreground">
                      <Timer className="w-3.5 h-3.5" />
                      {t('verify.countdown', { values: { seconds: countdown } })}
                    </span>
                  ) : (
                    <Button type="button" variant="ghost" size="sm" onClick={handleResendOTP} disabled={isLoading} className="text-xs font-medium h-7 px-2 text-primary">
                      {t('verify.resend')}
                    </Button>
                  )}
                </div>

                {errors.submit && (
                  <p className="text-xs text-center py-2 px-3 rounded-lg" style={{ backgroundColor: 'var(--tf-error-bg)', color: 'var(--tf-error)', border: '1px solid var(--tf-error-bg-md)' }}>
                    {errors.submit}
                  </p>
                )}

                <Button type="submit" disabled={isLoading || otp.length !== 6} className="w-full h-10">
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      {t('verify.actions.submitting')}
                    </span>
                  ) : t('verify.actions.submit')}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
