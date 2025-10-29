import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button, Input, Label, Card, CardContent, CardDescription, CardHeader, CardTitle, TypographyH2, TypographyP, TypographySmall, OTPInput } from "@dculus/ui";
import { emailOtp, signIn } from "../lib/auth-client";
import { ArrowLeft, Mail, Timer } from "lucide-react";
import { useTranslation } from "../hooks/useTranslation";

export const SignInOTP = () => {
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [otp, setOtp] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const { t } = useTranslation('signInOtp');

  // Initialize email from URL params
  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
      setStep('otp');
    }
  }, [searchParams]);

  // Countdown timer for resend
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const validateEmail = useCallback((emailValue: string) => {
    if (!emailValue.trim()) {
      return t('form.email.errors.required');
    }
    if (!/\S+@\S+\.\S+/.test(emailValue)) {
      return t('form.email.errors.invalid');
    }
    return null;
  }, [t]);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const emailError = validateEmail(email);
    if (emailError) {
      setErrors({ email: emailError });
      return;
    }

    setIsLoading(true);
    setErrors({});
    
    try {
      const response = await emailOtp.sendVerificationOtp({
        email: email.trim(),
        type: 'sign-in',
      });

      if (response.error) {
        setErrors({ 
          submit: response.error.message || t('messages.sendOtpFailed') 
        });
      } else {
        setStep('otp');
        setCountdown(60); // 1 minute countdown
        setOtp(''); // Clear any existing OTP
      }
    } catch (error) {
      console.error("Send OTP error:", error);
      setErrors({ 
        submit: t('messages.unexpectedError') 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (otp.length !== 6) {
      setErrors({ otp: t('form.otp.errors.incomplete') });
      return;
    }

    setIsLoading(true);
    setErrors({});
    
    try {
      const response = await signIn.emailOtp({
        email: email.trim(),
        otp: otp.trim(),
      });

      if (response.error) {
        setErrors({ 
          otp: response.error.message || t('form.otp.errors.invalid') 
        });
      } else {
        // Successful signin, redirect to dashboard
        navigate("/");
      }
    } catch (error) {
      console.error("Verify OTP error:", error);
      setErrors({ 
        otp: t('messages.unexpectedError') 
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
        email: email.trim(),
        type: 'sign-in',
      });

      if (response.error) {
        setErrors({ 
          submit: response.error.message || t('messages.resendOtpFailed') 
        });
      } else {
        setCountdown(60);
        setOtp('');
      }
    } catch (error) {
      console.error("Resend OTP error:", error);
      setErrors({ 
        submit: t('messages.resendOtpGenericFailed') 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setStep('email');
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
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px]">
          <div className="flex flex-col space-y-2 text-center">
            <TypographyH2>
              {step === 'email' ? t('steps.email.title') : t('steps.otp.title')}
            </TypographyH2>
            <TypographySmall className="text-muted-foreground">
              {step === 'email' 
                ? t('steps.email.subtitle')
                : t('steps.otp.subtitle', { values: { email } })
              }
            </TypographySmall>
          </div>
          
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl flex items-center gap-2">
                {step === 'otp' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBackToEmail}
                    className="p-1 h-auto"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                )}
                <Mail className="w-5 h-5" />
                {step === 'email' ? t('steps.email.cardTitle') : t('steps.otp.cardTitle')}
              </CardTitle>
              <CardDescription>
                {step === 'email' 
                  ? t('steps.email.cardDescription')
                  : t('steps.otp.cardDescription')
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {step === 'email' ? (
                <form onSubmit={handleSendOTP} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">{t('form.email.label')}</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder={t('form.email.placeholder')}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errors.email) {
                          setErrors(prev => ({ ...prev, email: "" }));
                        }
                      }}
                      disabled={isLoading}
                      className={errors.email ? "border-red-500" : ""}
                    />
                    {errors.email && (
                      <TypographySmall className="text-red-500">{errors.email}</TypographySmall>
                    )}
                  </div>

                  {errors.submit && (
                    <TypographySmall className="text-red-500 text-center">
                      {errors.submit}
                    </TypographySmall>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? t('steps.email.action.loading') : t('steps.email.action.idle')}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOTP} className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-center block">{t('steps.otp.otpLabel')}</Label>
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
                          {t('steps.otp.countdown', { values: { seconds: countdown } })}
                        </TypographySmall>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={handleResendOTP}
                          disabled={isLoading}
                          className="text-sm"
                        >
                          {t('steps.otp.resend')}
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
                    {isLoading ? t('steps.otp.action.loading') : t('steps.otp.action.idle')}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <TypographySmall className="text-center">
            {t('links.passwordSignInPrompt')}{" "}
            <Link
              to="/signin"
              className="underline underline-offset-4 hover:text-primary"
            >
              {t('links.passwordSignIn')}
            </Link>
          </TypographySmall>
          
          <TypographySmall className="text-center">
            {t('links.signUpPrompt')}{" "}
            <Link
              to="/signup"
              className="underline underline-offset-4 hover:text-primary"
            >
              {t('links.signUp')}
            </Link>
          </TypographySmall>
        </div>
      </div>
    </div>
  );
};
