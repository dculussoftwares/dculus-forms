import { useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription, Input, Label, OTPInput } from '@dculus/ui';
import { GoogleIcon } from './icons/GoogleIcon';
import { authClient } from '../lib/auth-client';
import { getApiBaseUrl } from '../lib/config';

interface SignInGateProps {
  formTitle: string;
  allowedDomains?: string[] | null;
  onSignedIn: () => void;
}

type Step = 'choose' | 'otp-sent';

export default function SignInGate({ formTitle, allowedDomains, onSignedIn }: SignInGateProps) {
  const [step, setStep] = useState<Step>('choose');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const domainHint = allowedDomains?.length
    ? `Sign in with an email ending in ${allowedDomains.map(d => `@${d}`).join(', ')}.`
    : null;

  const handleGoogleSignIn = () => {
    setError(null);
    sessionStorage.setItem('redirectAfterAuth', window.location.pathname + window.location.search);
    const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
    authClient.signIn.social({
      provider: 'google',
      callbackURL: `${getApiBaseUrl()}/respondent-oauth-callback?returnTo=${returnTo}`,
    });
  };

  const emailDomainLooksAllowed = (candidateEmail: string): boolean => {
    if (!allowedDomains?.length) return true;
    const domain = candidateEmail.split('@')[1]?.toLowerCase();
    return !!domain && allowedDomains.some(d => d.toLowerCase() === domain);
  };

  const handleSendCode = async () => {
    setError(null);
    if (!email.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    // Client-side check only — a fast, no-network rejection for an obviously
    // wrong domain. The real enforcement happens server-side on submit.
    if (!emailDomainLooksAllowed(email)) {
      setError(domainHint || 'This email domain is not allowed to respond to this form.');
      return;
    }

    setIsSubmitting(true);
    const { error: sendError } = await authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' });
    setIsSubmitting(false);

    if (sendError) {
      setError(sendError.message || 'Could not send a sign-in code. Please try again.');
      return;
    }
    setStep('otp-sent');
  };

  const handleVerifyCode = async () => {
    setError(null);
    if (otp.length !== 6) {
      setError('Enter the 6-digit code.');
      return;
    }

    setIsSubmitting(true);
    const { error: verifyError } = await authClient.signIn.emailOtp({ email, otp });
    setIsSubmitting(false);

    if (verifyError) {
      setError('That code is incorrect or has expired. Please request a new one.');
      return;
    }
    onSignedIn();
  };

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in to continue</CardTitle>
          <CardDescription>
            "{formTitle}" requires sign-in before you can respond.
            {domainHint ? ` ${domainHint}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 'choose' && (
            <>
              <Button variant="outline" className="w-full gap-2" onClick={handleGoogleSignIn} disabled={isSubmitting}>
                <GoogleIcon size={16} />
                Continue with Google
              </Button>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="flex-1 border-t" />
                <span>or continue with email</span>
                <div className="flex-1 border-t" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="respondent-email">Email</Label>
                <Input
                  id="respondent-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  disabled={isSubmitting}
                />
              </div>
              <Button className="w-full" onClick={handleSendCode} disabled={isSubmitting}>
                {isSubmitting ? 'Sending code…' : 'Send sign-in code'}
              </Button>
            </>
          )}

          {step === 'otp-sent' && (
            <>
              <p className="text-sm text-muted-foreground">
                We sent a 6-digit code to <strong>{email}</strong>.
              </p>
              <OTPInput length={6} value={otp} onChange={setOtp} hasError={!!error} />
              <Button className="w-full" onClick={handleVerifyCode} disabled={isSubmitting}>
                {isSubmitting ? 'Verifying…' : 'Verify code'}
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                disabled={isSubmitting}
                onClick={() => {
                  setStep('choose');
                  setOtp('');
                  setError(null);
                }}
              >
                Use a different email
              </Button>
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
