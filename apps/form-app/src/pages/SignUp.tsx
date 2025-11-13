import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useMutation } from '@apollo/client';
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  TypographyH2,
  TypographyP,
  TypographySmall,
  OTPInput,
} from '@dculus/ui';
import { slugify } from '@dculus/utils';
import { authClient, signUp, emailOtp, signIn, organization } from '../lib/auth-client';
import { ArrowLeft, Mail, Timer } from 'lucide-react';
import { INITIALIZE_ORGANIZATION_SUBSCRIPTION } from '../graphql/subscription';
import { useTranslation } from '../hooks/useTranslation';

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
        setErrors({
          submit: signUpResponse.error.message || t('messages.submitFailed'),
        });
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
            console.log('[SignUp] Initializing subscription for organization:', orgResult.data.id);
            const subscriptionResult = await initializeSubscription({
              variables: { organizationId: orgResult.data.id },
            });

            if (subscriptionResult.data?.initializeOrganizationSubscription?.success) {
              console.log('[SignUp] ✅ Subscription initialized successfully');
            } else {
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
          } catch (sessionError) {
            console.error('[SignUp] Error setting active organization:', sessionError);
          }
        }
      }

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
    <div className="container relative h-screen flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-2 lg:px-0">
      <div className="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-600 to-blue-600" />
        <div className="relative z-20 flex items-center text-lg font-medium">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-2 h-6 w-6"
          >
            <path d="m8 3 4 8 5-5v11H6V6l2-3z" />
            <path d="M2 3h6" />
            <path d="M6 3v5" />
          </svg>
          {t('hero.productName')}
        </div>
        <div className="relative z-20 mt-auto">
          <div className="mt-6 border-l-2 pl-6 italic">
            <TypographyP>
              &ldquo;{t('hero.tagline')}&rdquo;
            </TypographyP>
            <footer className="text-sm">{t('hero.attribution')}</footer>
          </div>
        </div>
      </div>
      <div className="lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <div className="flex flex-col space-y-2 text-center">
            <TypographyH2>{heading}</TypographyH2>
            <TypographySmall className="text-muted-foreground">
              {description}
            </TypographySmall>
          </div>

          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl flex items-center gap-2">
                {step === 'verify' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBackToForm}
                    className="p-1 h-auto"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                )}
                <Mail className="w-5 h-5" />
                {step === 'form' ? t('card.title.form') : t('card.title.verify')}
              </CardTitle>
              <CardDescription>
                {step === 'form'
                  ? t('card.description.form')
                  : t('card.description.verify')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {step === 'form' ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">{t('form.fields.name.label')}</Label>
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      placeholder={t('form.fields.name.placeholder')}
                      value={formData.name}
                      onChange={handleInputChange}
                      disabled={isLoading}
                      className={errors.name ? 'border-red-500' : ''}
                    />
                    {errors.name && (
                      <TypographySmall className="text-red-500">
                        {errors.name}
                      </TypographySmall>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">{t('form.fields.email.label')}</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder={t('form.fields.email.placeholder')}
                      value={formData.email}
                      onChange={handleInputChange}
                      disabled={isLoading || !!pendingInvitationId}
                      className={errors.email ? 'border-red-500' : ''}
                    />
                    {errors.email && (
                      <TypographySmall className="text-red-500">
                        {errors.email}
                      </TypographySmall>
                    )}
                    {pendingInvitationId && (
                      <TypographySmall className="text-muted-foreground">
                        {t('form.fields.email.invitationNotice')}
                      </TypographySmall>
                    )}
                  </div>

                  {/* Only show organization name field if not joining via invitation */}
                  {!pendingInvitationId && (
                    <div className="space-y-2">
                      <Label htmlFor="organizationName">{t('form.fields.organizationName.label')}</Label>
                      <Input
                        id="organizationName"
                        name="organizationName"
                        type="text"
                        placeholder={t('form.fields.organizationName.placeholder')}
                        value={formData.organizationName}
                        onChange={handleInputChange}
                        disabled={isLoading}
                        className={errors.organizationName ? 'border-red-500' : ''}
                      />
                      {errors.organizationName && (
                        <TypographySmall className="text-red-500">
                          {errors.organizationName}
                        </TypographySmall>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="password">{t('form.fields.password.label')}</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder={t('form.fields.password.placeholder')}
                      value={formData.password}
                      onChange={handleInputChange}
                      disabled={isLoading}
                      className={errors.password ? 'border-red-500' : ''}
                    />
                    {errors.password && (
                      <TypographySmall className="text-red-500">
                        {errors.password}
                      </TypographySmall>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">{t('form.fields.confirmPassword.label')}</Label>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      placeholder={t('form.fields.confirmPassword.placeholder')}
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      disabled={isLoading}
                      className={errors.confirmPassword ? 'border-red-500' : ''}
                    />
                    {errors.confirmPassword && (
                      <TypographySmall className="text-red-500">
                        {errors.confirmPassword}
                      </TypographySmall>
                    )}
                  </div>

                  {errors.submit && (
                    <TypographySmall className="text-red-500 text-center">
                      {errors.submit}
                    </TypographySmall>
                  )}

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? t('form.actions.submitting') : t('form.actions.submit')}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOTP} className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-center block">{t('verify.otpLabel')}</Label>
                      <OTPInput
                        value={otp}
                        onChange={(value) => {
                          setOtp(value);
                          if (errors.otp) {
                            setErrors(prev => ({ ...prev, otp: "" }));
                          }
                        }}
                        disabled={isLoading}
                        hasError={!!errors.otp}
                      />
                      {errors.otp && (
                        <TypographySmall className="text-red-500 text-center">
                          {errors.otp}
                        </TypographySmall>
                      )}
                    </div>

                    <div className="text-center">
                      {countdown > 0 ? (
                        <TypographySmall className="text-muted-foreground flex items-center justify-center gap-2">
                          <Timer className="w-4 h-4" />
                          {t('verify.countdown', { values: { seconds: countdown } })}
                        </TypographySmall>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={handleResendOTP}
                          disabled={isLoading}
                          className="text-sm"
                        >
                          {t('verify.resend')}
                        </Button>
                      )}
                    </div>
                  </div>

                  {errors.submit && (
                    <TypographySmall className="text-red-500 text-center">
                      {errors.submit}
                    </TypographySmall>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading || otp.length !== 6}
                  >
                    {isLoading ? t('verify.actions.submitting') : t('verify.actions.submit')}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <TypographySmall className="text-center">
            {t('links.signInPrompt')}{' '}
            <Link
              to="/signin"
              className="underline underline-offset-4 hover:text-primary"
            >
              {t('links.signIn')}
            </Link>
          </TypographySmall>
        </div>
      </div>
    </div>
  );
};
