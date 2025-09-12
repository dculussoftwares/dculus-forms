import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Alert, AlertDescription } from '@dculus/ui';
import { Users, Mail, AlertCircle, CheckCircle } from 'lucide-react';
import { GET_INVITATION, ACCEPT_INVITATION } from '../graphql/invitations';
import { useAuthContext } from '../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { parseDate, isDateExpired } from '../utils/dateHelpers';
import { authClient } from '../lib/auth-client';

const InviteAcceptance: React.FC = () => {
  const { invitationId } = useParams<{ invitationId: string }>();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuthContext();
  const [error, setError] = useState<string | null>(null);

  const {
    data: invitationData,
    loading: invitationLoading,
    error: invitationError,
  } = useQuery(GET_INVITATION, {
    variables: { id: invitationId! },
    skip: !invitationId,
  });

  const [acceptInvitation, { loading: acceptLoading }] = useMutation(ACCEPT_INVITATION, {
    onCompleted: () => {
      // Redirect to dashboard or organization page
      navigate('/dashboard', { 
        replace: true,
        state: { 
          message: `Welcome to ${invitationData.invitation.organization.name}! You have successfully joined the organization.` 
        }
      });
    },
    onError: (error) => {
      setError(error.message);
    },
  });

  const invitation = invitationData?.invitation;
  const isExpired = invitation && isDateExpired(invitation.expiresAt);

  // Handle accepting invitation
  const handleAcceptInvitation = async () => {
    if (!invitationId) return;
    
    try {
      await acceptInvitation({
        variables: { invitationId },
      });
    } catch (error) {
      console.error('Error accepting invitation:', error);
    }
  };

  // Handle sign up redirection
  const handleSignUp = () => {
    // Store invitation ID in session storage for after signup
    if (invitationId) {
      sessionStorage.setItem('pendingInvitationId', invitationId);
    }
    navigate('/signup', { 
      state: { 
        email: invitation?.email,
        redirectUrl: `/invite/${invitationId}`
      } 
    });
  };

  // Handle sign out
  const handleSignOut = async () => {
    try {
      await authClient.signOut();
      // After sign out, redirect to signup with invitation context
      handleSignUp();
    } catch (error) {
      console.error('Error signing out:', error);
      // Still redirect to signup even if signout fails
      handleSignUp();
    }
  };

  // Loading states
  if (authLoading || invitationLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center p-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error states
  if (invitationError || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Invalid Invitation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This invitation link is invalid or has been removed. Please contact the organization administrator for a new invitation.
              </AlertDescription>
            </Alert>
            <Button 
              className="w-full mt-4" 
              onClick={() => navigate('/signin')}
            >
              Go to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Expired invitation
  if (isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Invitation Expired
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This invitation expired {formatDistanceToNow(parseDate(invitation.expiresAt), { addSuffix: true })}. 
                Please contact {invitation.inviter.name} for a new invitation.
              </AlertDescription>
            </Alert>
            <Button 
              className="w-full mt-4" 
              onClick={() => navigate('/signin')}
            >
              Go to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User not authenticated - show sign up option
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>You're Invited to Join {invitation.organization.name}</CardTitle>
            <CardDescription>
              {invitation.inviter.name} has invited you to collaborate on forms and manage responses together.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium">Invitation Details</div>
                  <div className="text-sm text-muted-foreground">
                    Invited to: {invitation.email}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Role: {invitation.role === 'companyOwner' ? 'Organization Owner' : 'Team Member'}
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-3">
              <Button 
                className="w-full" 
                onClick={handleSignUp}
                size="lg"
              >
                Create Account & Join Organization
              </Button>
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => navigate('/signin', { 
                  state: { redirectUrl: `/invite/${invitationId}` } 
                })}
              >
                I Already Have an Account
              </Button>
            </div>

            <div className="text-xs text-muted-foreground text-center">
              By creating an account, you'll be able to collaborate on forms, manage responses, and work with your team on Dculus Forms.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User authenticated but email doesn't match
  if (user.email !== invitation.email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Email Mismatch
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This invitation was sent to {invitation.email}, but you're signed in as {user.email}. 
                Please sign out and create an account with the invited email address.
              </AlertDescription>
            </Alert>
            <div className="space-y-2 mt-4">
              <Button 
                className="w-full" 
                onClick={handleSignOut}
              >
                Sign Out & Create New Account
              </Button>
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => navigate('/dashboard')}
              >
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User authenticated and email matches - show accept invitation option
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle>Welcome to {invitation.organization.name}!</CardTitle>
          <CardDescription>
            You've been invited by {invitation.inviter.name} to join their organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Organization</span>
                <span className="font-medium">{invitation.organization.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Your Role</span>
                <span className="font-medium">
                  {invitation.role === 'companyOwner' ? 'Organization Owner' : 'Team Member'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Invited By</span>
                <span className="font-medium">{invitation.inviter.name}</span>
              </div>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            <Button 
              className="w-full" 
              onClick={handleAcceptInvitation}
              disabled={acceptLoading}
              size="lg"
            >
              {acceptLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                  Joining Organization...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Accept Invitation & Join
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => navigate('/dashboard')}
            >
              Maybe Later
            </Button>
          </div>

          <div className="text-xs text-muted-foreground text-center">
            By accepting this invitation, you'll gain access to collaborate on forms and manage responses with your team.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InviteAcceptance;