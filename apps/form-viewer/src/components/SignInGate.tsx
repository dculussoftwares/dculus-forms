import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@dculus/ui';
import SignInOptions from './SignInOptions';

interface SignInGateProps {
  formTitle: string;
  allowedDomains?: string[] | null;
  onSignedIn: () => void;
}

export default function SignInGate({ formTitle, allowedDomains, onSignedIn }: SignInGateProps) {
  const domainHint = allowedDomains?.length
    ? `Sign in with an email ending in ${allowedDomains.map(d => `@${d}`).join(', ')}.`
    : null;

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
        <CardContent>
          <SignInOptions allowedDomains={allowedDomains} onSignedIn={onSignedIn} />
        </CardContent>
      </Card>
    </div>
  );
}
