import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  Button,
  Input,
  Label,
  LoadingSpinner
} from '@dculus/ui';
import { signUp, emailOtp } from '../lib/auth-client';
import { useQuery } from '@apollo/client';
import { GET_INVITATION } from '../graphql/invitations';
import { XCircle, UserPlus } from 'lucide-react';

const InviteSignUp: React.FC = () => {
  const { invitationId } = useParams<{ invitationId: string }>();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'signup' | 'verify'>('signup');
  const [otp, setOtp] = useState('');

  // Get invitation details
  const { data, loading: invitationLoading, error: invitationError } = useQuery(GET_INVITATION, {
    variables: { id: invitationId || '' },
    skip: !invitationId,
    errorPolicy: 'all'
  });

  const invitation = data?.invitation;

  if (!invitationId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-8">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <p className="text-lg text-red-700 mb-4">Invalid invitation link</p>
            <Button onClick={() => navigate('/signin')} className="w-full">
              Go to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (invitationLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-8">
            <LoadingSpinner />
            <span className="ml-2">Loading invitation...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (invitationError || !invitation) {
    const errorMessage = invitationError?.graphQLErrors?.[0]?.message || 'Failed to load invitation';
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-8">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <p className="text-lg text-red-700 mb-4">{errorMessage}</p>
            <Button onClick={() => navigate('/signin')} className="w-full">
              Go to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.name.trim()) {
      setError('Full name is required');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      // Sign up the user
      const signUpResult = await signUp.email({
        email: invitation.email,
        password: formData.password,
        name: formData.name.trim(),
        callbackURL: `/invite/accept/${invitationId}`
      });

      if (signUpResult.error) {
        throw new Error(signUpResult.error.message);
      }

      // Send verification OTP
      const otpResult = await emailOtp.sendVerificationOtp({
        email: invitation.email,
        type: 'email-verification'
      });

      if (otpResult.error) {
        throw new Error(otpResult.error.message);
      }

      setStep('verify');
    } catch (err) {
      console.error('Signup error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!otp.trim()) {
      setError('Verification code is required');
      return;
    }

    setLoading(true);

    try {
      const verifyResult = await emailOtp.verifyEmail({
        email: invitation.email,
        otp: otp.trim()
      });

      if (verifyResult.error) {
        throw new Error(verifyResult.error.message);
      }

      // Redirect to invitation acceptance page
      navigate(`/invite/accept/${invitationId}`);
    } catch (err) {
      console.error('Verification error:', err);
      setError(err instanceof Error ? err.message : 'Failed to verify email');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'verify') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">
              <div className="flex items-center justify-center mb-4">
                <UserPlus className="w-8 h-8 text-blue-600 mr-2" />
                <span>Verify Your Email</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-6">
              <p className="text-sm text-muted-foreground">
                We've sent a verification code to
              </p>
              <p className="font-medium">{invitation.email}</p>
            </div>

            <form onSubmit={handleVerifyEmail} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">Verification Code</Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className={error ? 'border-red-500' : ''}
                  disabled={loading}
                  maxLength={6}
                />
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
                  {error}
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Verifying...' : 'Verify Email'}
              </Button>

              <div className="text-center">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep('signup')}
                  className="text-sm text-muted-foreground"
                >
                  Back to Sign Up
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            <div className="flex items-center justify-center mb-4">
              <UserPlus className="w-8 h-8 text-blue-600 mr-2" />
              <span>Join {invitation.organizationName}</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-700">
              You've been invited to join <strong>{invitation.organizationName}</strong> as a{' '}
              <strong>{invitation.role === 'owner' ? 'Owner' : invitation.role === 'admin' ? 'Admin' : 'Member'}</strong>
            </p>
            <p className="text-xs text-blue-600 mt-1">
              by {invitation.inviterName}
            </p>
          </div>

          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={invitation.email}
                disabled
                className="bg-gray-50"
              />
              <p className="text-xs text-muted-foreground">
                This email was invited to the organization
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter your full name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={error ? 'border-red-500' : ''}
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password (min 8 characters)"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className={error ? 'border-red-500' : ''}
                disabled={loading}
                required
                minLength={8}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className={error ? 'border-red-500' : ''}
                disabled={loading}
                required
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Creating Account...' : 'Create Account & Join Organization'}
            </Button>

            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Already have an account?
              </p>
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate(`/invite/accept/${invitationId}`)}
                className="w-full"
              >
                Sign In Instead
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default InviteSignUp;