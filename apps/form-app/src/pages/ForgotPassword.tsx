import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button, Input, Label } from "@dculus/ui";
import { forgetPassword, authClient } from "../lib/auth-client";
import { CheckCircle, FileText, KeyRound } from "lucide-react";
import { useTranslation } from "../hooks/useTranslation";

export const ForgotPassword = () => {
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const [token, setToken] = useState('');
  const navigate = useNavigate();
  const { t } = useTranslation('forgotPassword');

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (tokenParam) { setToken(tokenParam); setStep('reset'); }
  }, [searchParams]);

  const validateEmail = useCallback((v: string) => {
    if (!v.trim()) return t('form.email.errors.required');
    if (!/\S+@\S+\.\S+/.test(v)) return t('form.email.errors.invalid');
    return null;
  }, [t]);

  const validatePassword = useCallback((p: string) => {
    if (!p) return t('form.newPassword.errors.required');
    if (p.length < 8) return t('form.newPassword.errors.length');
    return null;
  }, [t]);

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailError = validateEmail(email);
    if (emailError) { setErrors({ email: emailError }); return; }
    setIsLoading(true);
    setErrors({});
    try {
      const forgetPasswordFn = typeof forgetPassword === 'function'
        ? forgetPassword
        : (forgetPassword as any)?.emailOtp || ((_opts: any) => Promise.resolve({ error: { message: 'Password reset not supported' } }));
      const response = await forgetPasswordFn({ email: email.trim(), redirectTo: `${window.location.origin}/forgot-password` });
      if (response.error) {
        setErrors({ submit: response.error.message || t('messages.resetEmailFailed') });
      } else {
        setSent(true);
      }
    } catch {
      setErrors({ submit: t('messages.unexpectedError') });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const passwordError = validatePassword(newPassword);
    if (passwordError) { setErrors({ password: passwordError }); return; }
    if (newPassword !== confirmPassword) { setErrors({ confirmPassword: t('form.confirmPassword.errors.mismatch') }); return; }
    if (!token) { setErrors({ submit: t('messages.invalidToken') }); return; }
    setIsLoading(true);
    setErrors({});
    try {
      const response = await authClient.resetPassword({ newPassword, token });
      if (response.error) {
        setErrors({ submit: response.error.message || t('messages.resetFailed') });
      } else {
        navigate('/signin?message=password-reset-success');
      }
    } catch {
      setErrors({ submit: t('messages.unexpectedError') });
    } finally {
      setIsLoading(false);
    }
  };

  /* Left panel icon */
  const LeftIcon = step === 'reset' ? CheckCircle : KeyRound;

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Left dark panel */}
      <div className="hidden lg:flex lg:flex-col lg:w-[480px] xl:w-[560px] shrink-0 p-10 justify-between" style={{ backgroundColor: 'var(--tf-darkest)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--tf-dark)' }}>
            <FileText className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-semibold text-lg">{t('hero.productName')}</span>
        </div>
        <div className="space-y-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--tf-white-overlay)' }}>
            <LeftIcon className="w-6 h-6 text-[rgba(255,255,255,0.70)]" />
          </div>
          <h2 className="text-white text-3xl font-light leading-tight">{t('hero.tagline')}</h2>
          <p className="text-sm text-[rgba(255,255,255,0.55)]">{t('hero.attribution')}</p>
        </div>
        <p className="text-xs text-[rgba(255,255,255,0.35)]">© {new Date().getFullYear()} Dculus Forms</p>
      </div>

      {/* Right white panel */}
      <div className="flex-1 flex flex-col overflow-y-auto bg-white">
        <div className="flex items-center justify-end px-8 py-5" style={{ borderBottom: '1px solid var(--tf-border-light)' }}>
          <span className="text-sm text-muted-foreground">
            {t('links.signInPrompt')}{' '}
            <Link to="/signin" className="font-medium hover:underline text-primary">
              {t('links.signIn')}
            </Link>
          </span>
        </div>

        <div className="flex-1 flex items-center justify-center px-8 py-12">
          <div className="w-full max-w-sm">
            <div className="mb-8">
              <h1 className="text-2xl font-semibold mb-1.5 text-primary">
                {step === 'reset' ? t('steps.reset.title') : t('steps.email.title')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {step === 'reset' ? t('steps.reset.subtitle') : t('steps.email.subtitle')}
              </p>
            </div>

            {/* Email sent success state */}
            {sent && step === 'email' ? (
              <div className="p-5 rounded-xl text-center" style={{ backgroundColor: 'var(--tf-icon-teal)', border: '1px solid var(--tf-green-bg-md)' }}>
                <CheckCircle className="w-8 h-8 mx-auto mb-3 text-[var(--tf-green)]" />
                <p className="text-sm font-medium mb-1 text-primary">{t('messages.resetEmailSentTitle')}</p>
                <p className="text-xs text-muted-foreground">{t('messages.resetEmailSent', { values: { email } })}</p>
              </div>
            ) : step === 'email' ? (
              <form onSubmit={handleSendResetEmail} className="space-y-4">
                <div>
                  <Label htmlFor="email" className="text-xs font-medium block mb-1.5 text-foreground">
                    {t('form.email.label')}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t('form.email.placeholder')}
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors(prev => ({ ...prev, email: '' })); }}
                    disabled={isLoading}
                    className={errors.email ? 'border-destructive focus-visible:border-destructive' : ''}
                  />
                  {errors.email && <p className="text-xs mt-1 text-destructive">{errors.email}</p>}
                </div>
                {errors.submit && (
                  <p className="text-xs py-2 px-3 rounded-lg" style={{ backgroundColor: 'var(--tf-error-bg)', color: 'var(--tf-error)', border: '1px solid var(--tf-error-bg-md)' }}>
                    {errors.submit}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-10"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      {t('steps.email.action.loading')}
                    </span>
                  ) : t('steps.email.action.idle')}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <Label htmlFor="newPassword" className="text-xs font-medium block mb-1.5 text-foreground">
                    {t('form.newPassword.label')}
                  </Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder={t('form.newPassword.placeholder')}
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); if (errors.password) setErrors(prev => ({ ...prev, password: '' })); }}
                    disabled={isLoading}
                    className={errors.password ? 'border-destructive focus-visible:border-destructive' : ''}
                  />
                  {errors.password && <p className="text-xs mt-1 text-destructive">{errors.password}</p>}
                </div>
                <div>
                  <Label htmlFor="confirmPassword" className="text-xs font-medium block mb-1.5 text-foreground">
                    {t('form.confirmPassword.label')}
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder={t('form.confirmPassword.placeholder')}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); if (errors.confirmPassword) setErrors(prev => ({ ...prev, confirmPassword: '' })); }}
                    disabled={isLoading}
                    className={errors.confirmPassword ? 'border-destructive focus-visible:border-destructive' : ''}
                  />
                  {errors.confirmPassword && <p className="text-xs mt-1 text-destructive">{errors.confirmPassword}</p>}
                </div>
                {errors.submit && (
                  <p className="text-xs py-2 px-3 rounded-lg" style={{ backgroundColor: 'var(--tf-error-bg)', color: 'var(--tf-error)', border: '1px solid var(--tf-error-bg-md)' }}>
                    {errors.submit}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-10"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      {t('steps.reset.action.loading')}
                    </span>
                  ) : t('steps.reset.action.idle')}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
