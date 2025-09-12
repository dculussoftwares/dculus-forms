import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, CardContent, CardHeader, CardTitle, LoadingSpinner } from '@dculus/ui';
import { organization, useSession } from '../lib/auth-client';
import { CheckCircle, XCircle, UserPlus, Building } from 'lucide-react';

const AcceptInvitation: React.FC = () => {
  const { invitationId } = useParams<{ invitationId: string }>();
  const navigate = useNavigate();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<any>(null);
  const [accepting, setAccepting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    const loadInvitation = async () => {
      if (!invitationId) {
        setResult({ success: false, message: 'Invalid invitation link' });
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await organization.getInvitation({
          query: { id: invitationId }
        });

        if (error) {
          throw new Error(error.message);
        }

        if (!data) {
          throw new Error('Invitation not found');
        }

        setInvitation(data);
      } catch (err) {
        console.error('Failed to load invitation:', err);
        setResult({
          success: false,
          message: err instanceof Error ? err.message : 'Failed to load invitation'
        });
      } finally {
        setLoading(false);
      }
    };

    loadInvitation();
  }, [invitationId]);

  const handleAccept = async () => {
    if (!invitationId) return;

    setAccepting(true);
    try {
      const { error } = await organization.acceptInvitation({
        invitationId,
      });

      if (error) {
        throw new Error(error.message);
      }

      setResult({
        success: true,
        message: 'Invitation accepted successfully! Redirecting to dashboard...'
      });

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (err) {
      console.error('Failed to accept invitation:', err);
      setResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to accept invitation'
      });
    } finally {
      setAccepting(false);
    }
  };

  const handleSignIn = () => {
    navigate('/signin', { state: { returnUrl: `/invite/accept/${invitationId}` } });
  };

  const handleSignUp = () => {
    navigate('/signup', { state: { returnUrl: `/invite/accept/${invitationId}` } });
  };

  if (loading) {
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

  if (result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-8">
            {result.success ? (
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            ) : (
              <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            )}
            <p className={`text-lg ${result.success ? 'text-green-700' : 'text-red-700'}`}>
              {result.message}
            </p>
            {!result.success && (
              <div className="mt-4 space-y-2">
                <Button onClick={() => navigate('/dashboard')} variant="outline" className="w-full">
                  Go to Dashboard
                </Button>
                <Button onClick={() => window.location.reload()} variant="ghost" className="w-full">
                  Try Again
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-8">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <p className="text-lg text-red-700 mb-4">
              Invitation not found or expired
            </p>
            <Button onClick={() => navigate('/dashboard')} className="w-full">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if user is authenticated
  if (!session?.user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">
              <div className="flex items-center justify-center mb-4">
                <Building className="w-8 h-8 text-blue-600 mr-2" />
                <span>Join {invitation.organizationName}</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center text-muted-foreground">
              <p>You've been invited to join <strong>{invitation.organizationName}</strong></p>
              <p>as a <strong>{invitation.role === 'owner' ? 'Owner' : invitation.role === 'admin' ? 'Admin' : 'Member'}</strong></p>
              <p className="text-sm mt-2">by {invitation.inviterName}</p>
            </div>
            
            <div className="space-y-2">
              <p className="text-center font-medium">Please sign in to accept this invitation</p>
              <Button onClick={handleSignIn} className="w-full">
                Sign In
              </Button>
              <Button onClick={handleSignUp} variant="outline" className="w-full">
                Create Account
              </Button>
            </div>

            <div className="text-center">
              <Button 
                variant="ghost" 
                onClick={() => navigate('/invite/reject/' + invitationId)} 
                className="text-red-600 hover:text-red-700"
              >
                Decline Invitation
              </Button>
            </div>
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
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-lg">Welcome, <strong>{session.user.name}</strong>!</p>
            <p className="text-muted-foreground">
              You've been invited to join <strong>{invitation.organizationName}</strong>
            </p>
            <p className="text-muted-foreground">
              as a <strong>{invitation.role === 'owner' ? 'Owner' : invitation.role === 'admin' ? 'Admin' : 'Member'}</strong>
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Invited by {invitation.inviterName}
            </p>
          </div>

          <div className="space-y-2">
            <Button 
              onClick={handleAccept} 
              disabled={accepting} 
              className="w-full"
            >
              {accepting ? 'Accepting...' : 'Accept Invitation'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate('/invite/reject/' + invitationId)}
              disabled={accepting}
              className="w-full"
            >
              Decline
            </Button>
          </div>

          <div className="text-center">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/dashboard')}
              className="text-muted-foreground"
            >
              Go to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AcceptInvitation;