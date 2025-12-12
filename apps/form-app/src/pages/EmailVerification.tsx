import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useMutation, useApolloClient } from '@apollo/client';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  OTPInput,
  TypographyH2,
  TypographyP,
  TypographySmall,
} from '@dculus/ui';
import { slugify } from '@dculus/utils';
import { emailOtp, signIn, authClient, organization } from '../lib/auth-client';
import { ArrowLeft, Mail, Timer } from 'lucide-react';
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

  // GraphQL mutation for initializing organization subscription
  const [initializeSubscription] = useMutation(INITIALIZE_ORGANIZATION_SUBSCRIPTION);

  const state = location.state as LocationState | null;
  const stateEmail = state?.email || '';
  const statePassword = state?.password || '';
  const fromSignIn = state?.fromSignIn || false;

  // Try to get pending signup data from sessionStorage
  const pendingSignupData: PendingSignupData | null = (() => {
    const stored = sessionStorage.getItem('pendingSignupData');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  })();

  // Use pending signup data if available, otherwise fall back to state
  const email = pendingSignupData?.email || stateEmail;
  const password = pendingSignupData?.password || statePassword;
  const organizationName = pendingSignupData?.organizationName || '';

  // Check for pending invitation
  const pendingInvitationId = typeof window !== 'undefined' ? sessionStorage.getItem('pendingInvitationId') : null;

  // Redirect to signin if no email provided
  useEffect(() => {
    if (!email) {
      navigate('/signin');
    }
  }, [email, navigate]);

  // Countdown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

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
        email,
        otp: otp.trim(),
      });

      if (verifyResponse.error) {
        setErrors({
          otp: verifyResponse.error.message || t('messages.otpInvalid'),
        });
        return;
      }

      // Sign in the user
      if (password) {
        const signInResponse = await signIn.email({
          email,
          password,
        });

        if (signInResponse.error) {
          // Email verified but sign-in failed
          setErrors({
            otp: t('messages.signInFailed'),
          });
          return;
        }
      }

      // Check if there's a pending invitation to accept
      if (pendingInvitationId) {
        try {
          await organization.acceptInvitation({
            invitationId: pendingInvitationId,
          });
          
          // Clear the pending invitation and signup data
          sessionStorage.removeItem('pendingInvitationId');
          sessionStorage.removeItem('pendingSignupData');
          
          // Navigate to dashboard
          navigate('/');
          return;
        } catch (invitationError) {
          console.error('Error accepting invitation:', invitationError);
          // Continue with normal organization creation if invitation acceptance fails
        }
      }

      // Create the organization if we have organization name (new signup flow)
      if (organizationName && !pendingInvitationId) {
        try {
          const organizationSlug = slugify(organizationName);
          const orgResult = await authClient.organization.create({
            name: organizationName,
            slug: organizationSlug,
          });

          // Initialize free subscription for the new organization
          if (orgResult?.data?.id) {
            try {
              console.log('[EmailVerification] Initializing subscription for organization:', orgResult.data.id);
              const subscriptionResult = await initializeSubscription({
                variables: { organizationId: orgResult.data.id },
              });

              if (subscriptionResult.data?.initializeOrganizationSubscription?.success) {
                console.log('[EmailVerification] ✅ Subscription initialized successfully');
              } else {
                console.error('[EmailVerification] ⚠️ Subscription initialization failed:', subscriptionResult.data?.initializeOrganizationSubscription?.message);
              }
            } catch (subscriptionError) {
              // Log error but don't block flow
              console.error('[EmailVerification] ⚠️ Error initializing subscription:', subscriptionError);
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
              console.error('[EmailVerification] Error setting active organization:', sessionError);
            }
          }
        } catch (orgError) {
          console.error('[EmailVerification] Error creating organization:', orgError);
          // Organization might already exist if user had partially completed before
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
        email,
        type: 'email-verification',
      });

      if (response.error) {
        setErrors({
          submit: response.error.message || t('messages.resendFailed'),
        });
      } else {
        setCountdown(60);
        setOtp('');
      }
    } catch (error) {
      console.error('Resend OTP error:', error);
      setErrors({
        submit: t('messages.resendFailed'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!email) {
    return null;
  }

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
            <TypographyH2>{t('meta.heading')}</TypographyH2>
            <TypographySmall className="text-muted-foreground">
              {t('meta.subheading', { values: { email } })}
            </TypographySmall>
          </div>

          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl flex items-center gap-2">
                <Link to="/signin">
                  <Button variant="ghost" size="sm" className="p-1 h-auto">
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                </Link>
                <Mail className="w-5 h-5" />
                {t('card.title')}
              </CardTitle>
              <CardDescription>{t('card.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleVerifyOTP} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-center block">{t('form.otpLabel')}</Label>
                    <OTPInput
                      value={otp}
                      onChange={(value) => {
                        setOtp(value);
                        if (errors.otp) {
                          setErrors((prev) => ({ ...prev, otp: '' }));
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
                        {t('form.countdown', { values: { seconds: countdown } })}
                      </TypographySmall>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleResendOTP}
                        disabled={isLoading}
                        className="text-sm"
                      >
                        {t('form.resend')}
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
                  {isLoading ? t('form.actions.submitting') : t('form.actions.submit')}
                </Button>
              </form>
            </CardContent>
          </Card>

          <TypographySmall className="text-center">
            {fromSignIn ? t('links.backToSignIn') : t('links.backToSignUp')}{' '}
            <Link
              to={fromSignIn ? '/signin' : '/signup'}
              className="underline underline-offset-4 hover:text-primary"
            >
              {fromSignIn ? t('links.signIn') : t('links.signUp')}
            </Link>
          </TypographySmall>
        </div>
      </div>
    </div>
  );
};
