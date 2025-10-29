import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button, Input, Label, Card, CardContent, CardDescription, CardHeader, CardTitle, TypographyH2, TypographyP, TypographySmall } from "@dculus/ui";
import { forgetPassword, authClient } from "../lib/auth-client";
import { CheckCircle, KeyRound } from "lucide-react";
import { useTranslation } from "../hooks/useTranslation";

export const ForgotPassword = () => {
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [token, setToken] = useState('');
  const navigate = useNavigate();
  const { t } = useTranslation('forgotPassword');

  // Check for reset token in URL
  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (tokenParam) {
      setToken(tokenParam);
      setStep('reset');
    }
  }, [searchParams]);

  const validateEmail = useCallback((emailValue: string) => {
    if (!emailValue.trim()) {
      return t('form.email.errors.required');
    }
    if (!/\S+@\S+\.\S+/.test(emailValue)) {
      return t('form.email.errors.invalid');
    }
    return null;
  }, [t]);

  const validatePassword = useCallback((password: string) => {
    if (!password) {
      return t('form.newPassword.errors.required');
    }
    if (password.length < 8) {
      return t('form.newPassword.errors.length');
    }
    return null;
  }, [t]);

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const emailError = validateEmail(email);
    if (emailError) {
      setErrors({ email: emailError });
      return;
    }

    setIsLoading(true);
    setErrors({});
    
    try {
      const response = await forgetPassword({
        email: email.trim(),
        redirectTo: `${window.location.origin}/forgot-password`,
      });

      if (response.error) {
        setErrors({ 
          submit: response.error.message || t('messages.resetEmailFailed') 
        });
      } else {
        // Show success message
        setStep('email');
        setErrors({});
        // You could also show a success state here
        alert(t('messages.resetEmailSuccess'));
      }
    } catch (error) {
      console.error("Send reset email error:", error);
      setErrors({ 
        submit: t('messages.unexpectedError') 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setErrors({ password: passwordError });
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrors({ confirmPassword: t('form.confirmPassword.errors.mismatch') });
      return;
    }

    if (!token) {
      setErrors({ submit: t('messages.invalidToken') });
      return;
    }

    setIsLoading(true);
    setErrors({});
    
    try {
      const response = await authClient.resetPassword({
        newPassword,
        token,
      });

      if (response.error) {
        setErrors({ 
          submit: response.error.message || t('messages.resetFailed') 
        });
      } else {
        // Password reset successful, redirect to sign-in
        navigate('/signin?message=password-reset-success');
      }
    } catch (error) {
      console.error("Reset password error:", error);
      setErrors({ 
        submit: t('messages.unexpectedError') 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStepInfo = () => {
    if (step === 'reset') {
      return {
        title: t('steps.reset.title'),
        subtitle: t('steps.reset.subtitle'),
        cardTitle: t('steps.reset.cardTitle'),
        cardDescription: t('steps.reset.cardDescription'),
        icon: <CheckCircle className="w-5 h-5" />
      };
    }
    
    return {
      title: t('steps.email.title'),
      subtitle: t('steps.email.subtitle'),
      cardTitle: t('steps.email.cardTitle'),
      cardDescription: t('steps.email.cardDescription'),
      icon: <KeyRound className="w-5 h-5" />
    };
  };

  const stepInfo = getStepInfo();

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
            <TypographyH2>{stepInfo.title}</TypographyH2>
            <TypographySmall className="text-muted-foreground">
              {stepInfo.subtitle}
            </TypographySmall>
          </div>
          
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl flex items-center gap-2">
                {stepInfo.icon}
                {stepInfo.cardTitle}
              </CardTitle>
              <CardDescription>
                {stepInfo.cardDescription}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {step === 'email' && (
                <form onSubmit={handleSendResetEmail} className="space-y-4">
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
              )}

              {step === 'reset' && (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">{t('form.newPassword.label')}</Label>
                    <Input
                      id="newPassword"
                      name="newPassword"
                      type="password"
                      placeholder={t('form.newPassword.placeholder')}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (errors.password) {
                          setErrors(prev => ({ ...prev, password: "" }));
                        }
                      }}
                      disabled={isLoading}
                      className={errors.password ? "border-red-500" : ""}
                    />
                    {errors.password && (
                      <TypographySmall className="text-red-500">{errors.password}</TypographySmall>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">{t('form.confirmPassword.label')}</Label>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      placeholder={t('form.confirmPassword.placeholder')}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (errors.confirmPassword) {
                          setErrors(prev => ({ ...prev, confirmPassword: "" }));
                        }
                      }}
                      disabled={isLoading}
                      className={errors.confirmPassword ? "border-red-500" : ""}
                    />
                    {errors.confirmPassword && (
                      <TypographySmall className="text-red-500">{errors.confirmPassword}</TypographySmall>
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
                    {isLoading ? t('steps.reset.action.loading') : t('steps.reset.action.idle')}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <TypographySmall className="text-center">
            {t('links.signInPrompt')}{" "}
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
