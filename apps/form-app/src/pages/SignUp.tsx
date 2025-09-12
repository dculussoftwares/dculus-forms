import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
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
} from '@dculus/ui';
import { slugify } from '@dculus/utils';
import { authClient, signUp, emailOtp, signIn, organization } from '../lib/auth-client';
import { OTPInput } from '../components/OTPInput';
import { ArrowLeft, Mail, Timer } from 'lucide-react';

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
      newErrors.name = 'Full name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords don't match";
    }

    // Organization name is only required if not joining via invitation
    if (!pendingInvitationId && !formData.organizationName.trim()) {
      newErrors.organizationName = 'Organization name is required';
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
          submit: signUpResponse.error.message || 'Failed to create account',
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
          submit: otpResponse.error.message || 'Failed to send verification code',
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
        submit: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (otp.length !== 6) {
      setErrors({ otp: 'Please enter the complete 6-digit code' });
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
          otp: verifyResponse.error.message || 'Invalid or expired code',
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
          otp: 'Verification successful, but sign-in failed. Please sign in manually.',
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
              message: 'Welcome! You have successfully joined the organization.' 
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
        await authClient.organization.create({
          name: formData.organizationName,
          slug: organizationSlug,
          keepCurrentActiveOrganization: false,
        });
      }

      // Navigate to dashboard
      navigate('/');
    } catch (error) {
      console.error('OTP verification error:', error);
      setErrors({
        otp: 'An unexpected error occurred. Please try again.',
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
          submit: response.error.message || 'Failed to resend verification code' 
        });
      } else {
        setCountdown(60);
        setOtp('');
      }
    } catch (error) {
      console.error('Resend OTP error:', error);
      setErrors({ 
        submit: 'Failed to resend verification code. Please try again.' 
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
          Dculus Forms
        </div>
        <div className="relative z-20 mt-auto">
          <div className="mt-6 border-l-2 pl-6 italic">
            <TypographyP>
              &ldquo;Build beautiful forms collaboratively with your team.
              Create, share, and analyze responses all in one place.&rdquo;
            </TypographyP>
            <footer className="text-sm">Team Dculus</footer>
          </div>
        </div>
      </div>
      <div className="lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <div className="flex flex-col space-y-2 text-center">
            <TypographyH2>
              {step === 'form' 
                ? (pendingInvitationId ? 'Complete your invitation' : 'Create an account')
                : 'Verify your email'
              }
            </TypographyH2>
            <TypographySmall className="text-muted-foreground">
              {step === 'form' 
                ? (pendingInvitationId 
                    ? 'Create your account to join the organization'
                    : 'Enter your details below to create your account'
                  )
                : `We sent a 6-digit verification code to ${formData.email}`
              }
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
                {step === 'form' ? 'Get started' : 'Enter verification code'}
              </CardTitle>
              <CardDescription>
                {step === 'form'
                  ? 'Create your account and organization to start building forms'
                  : 'Enter the 6-digit code we sent to verify your email address'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {step === 'form' ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      placeholder="John Doe"
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
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="john@example.com"
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
                        Email address is pre-filled from your invitation
                      </TypographySmall>
                    )}
                  </div>

                  {/* Only show organization name field if not joining via invitation */}
                  {!pendingInvitationId && (
                    <div className="space-y-2">
                      <Label htmlFor="organizationName">Organization Name</Label>
                      <Input
                        id="organizationName"
                        name="organizationName"
                        type="text"
                        placeholder="Acme Inc."
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
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="••••••••"
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
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      placeholder="••••••••"
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
                    {isLoading ? 'Creating account...' : 'Create account'}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOTP} className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-center block">Verification Code</Label>
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
                          Resend code in {countdown}s
                        </TypographySmall>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={handleResendOTP}
                          disabled={isLoading}
                          className="text-sm"
                        >
                          Didn't receive the code? Resend
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
                    {isLoading ? 'Verifying...' : 'Complete Sign Up'}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <TypographySmall className="text-center">
            Already have an account?{' '}
            <Link
              to="/signin"
              className="underline underline-offset-4 hover:text-primary"
            >
              Sign in
            </Link>
          </TypographySmall>
        </div>
      </div>
    </div>
  );
};
