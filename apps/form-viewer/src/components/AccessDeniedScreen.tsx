import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription } from '@dculus/ui';
import { signOut } from '../lib/auth-client';

interface AccessDeniedScreenProps {
  signedInEmail?: string | null;
  allowedDomains?: string[] | null;
  onSwitchAccount: () => void;
}

export default function AccessDeniedScreen({ signedInEmail, allowedDomains, onSwitchAccount }: AccessDeniedScreenProps) {
  const domainHint = allowedDomains?.length
    ? `Only responses from ${allowedDomains.map(d => `@${d}`).join(', ')} are accepted.`
    : 'Your email is not allowed to respond to this form.';

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>You can't respond to this form</CardTitle>
          <CardDescription>
            {signedInEmail ? `You're signed in as ${signedInEmail}. ` : ''}
            {domainHint}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            variant="outline"
            onClick={async () => {
              // Clearing the local bearer token alone isn't enough — better-auth
              // also sets a session cookie on sign-in (independent of the bearer
              // plugin), and that cookie alone is enough to re-authenticate the
              // next request. signOut() does a real server round-trip that
              // invalidates the session and clears the cookie too.
              await signOut();
              onSwitchAccount();
            }}
          >
            Sign in with a different account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
