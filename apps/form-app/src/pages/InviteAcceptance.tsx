import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Alert, AlertDescription } from '@dculus/ui';
import { Users, Mail, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuthContext } from '../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { parseDate, isDateExpired } from '../utils/dateHelpers';
import { authClient, organization } from '../lib/auth-client';
import { useQuery } from '@apollo/client';
import { GET_INVITATION_PUBLIC } from '../graphql/queries';
import { useTranslation } from '../hooks/useTranslation';

const InviteAcceptance: React.FC = () => {
  const { invitationId } = useParams<{ invitationId: string }>();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuthContext();
  const [error, setError] = useState<string | null>(null);
  const [acceptLoading, setAcceptLoading] = useState(false);
  const { t } = useTranslation('inviteAcceptance');

  // Fetch invitation details using GraphQL (public endpoint)
  const { 
    data: invitationData, 
    loading: invitationLoading, 
    error: invitationError 
  } = useQuery(GET_INVITATION_PUBLIC, {
    variables: { id: invitationId || '' },
    skip: !invitationId,
    errorPolicy: 'all',
  });

  const invitation = invitationData?.getInvitationPublic;
  const isExpired = invitation && isDateExpired(invitation.expiresAt);

  // Handle accepting invitation
  const handleAcceptInvitation = async () => {
    if (!invitationId) return;
    
    setAcceptLoading(true);
    setError(null);
    
    try {
      await organization.acceptInvitation({
        invitationId,
      });
      
      // Redirect to dashboard or organization page
      navigate('/dashboard', { 
        replace: true,
        state: { 
          message: t('messages.joinSuccess', {
            values: {
              organization: invitation?.organization?.name ?? t('fallbacks.organization'),
            },
          }),
        }
      });
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      setError(error.message || t('messages.acceptFailed'));
    } finally {
      setAcceptLoading(false);
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
        <Card className="w-full max-w-md" aria-busy="true">
          <CardContent className="flex items-center justify-center p-8">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
              aria-label={t('loading.spinnerLabel')}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error states
  if (invitationError || (!invitationLoading && !invitation)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              {t('errors.invalid.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {invitationError?.message || t('errors.invalid.description')}
              </AlertDescription>
            </Alert>
            <Button 
              className="w-full mt-4" 
              onClick={() => navigate('/signin')}
            >
              {t('buttons.goToSignIn')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Expired invitation
  if (isExpired) {
    const timeAgo = formatDistanceToNow(parseDate(invitation.expiresAt), { addSuffix: true });
    const inviterName = invitation.inviter?.name ?? t('fallbacks.inviter');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              {t('errors.expired.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t('errors.expired.description', {
                  values: {
                    timeAgo,
                    inviter: inviterName,
                  },
                })}
              </AlertDescription>
            </Alert>
            <Button 
              className="w-full mt-4" 
              onClick={() => navigate('/signin')}
            >
              {t('buttons.goToSignIn')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User not authenticated - show sign up option
  if (!user) {
    const organizationName = invitation.organization?.name;
    const inviterName = invitation.inviter?.name;
    const roleLabel =
      invitation.role === 'owner'
        ? t('guestView.details.roleOwner')
        : t('guestView.details.roleMember');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>
              {organizationName
                ? t('guestView.title', { values: { organization: organizationName } })
                : t('guestView.titleFallback')}
            </CardTitle>
            <CardDescription>
              {inviterName
                ? t('guestView.description', { values: { inviter: inviterName } })
                : t('guestView.descriptionFallback')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium">{t('guestView.details.title')}</div>
                  <div className="text-sm text-muted-foreground">
                    {t('guestView.details.email', { values: { email: invitation.email } })}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {roleLabel}
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
                {t('buttons.createAccountAndJoin')}
              </Button>
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => navigate('/signin', { 
                  state: { redirectUrl: `/invite/${invitationId}` } 
                })}
              >
                {t('buttons.alreadyHaveAccount')}
              </Button>
            </div>

            <div className="text-xs text-muted-foreground text-center">
              {t('guestView.footer')}
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
              {t('errors.mismatch.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t('errors.mismatch.description', {
                  values: {
                    invitedEmail: invitation.email,
                    currentEmail: user.email ?? '',
                  },
                })}
              </AlertDescription>
            </Alert>
            <div className="space-y-2 mt-4">
              <Button 
                className="w-full" 
                onClick={handleSignOut}
              >
                {t('buttons.signOutAndCreate')}
              </Button>
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => navigate('/dashboard')}
              >
                {t('buttons.goToDashboard')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User authenticated and email matches - show accept invitation option
  const organizationName = invitation.organization?.name;
  const inviterName = invitation.inviter?.name;
  const roleLabel =
    invitation.role === 'owner'
      ? t('authenticatedView.summary.roleOwner')
      : t('authenticatedView.summary.roleMember');
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle>
            {organizationName
              ? t('authenticatedView.title', { values: { organization: organizationName } })
              : t('authenticatedView.titleFallback')}
          </CardTitle>
          <CardDescription>
            {inviterName
              ? t('authenticatedView.description', { values: { inviter: inviterName } })
              : t('authenticatedView.descriptionFallback')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t('authenticatedView.summary.organization')}
                </span>
                <span className="font-medium">
                  {organizationName ?? t('fallbacks.organization')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t('authenticatedView.summary.role')}
                </span>
                <span className="font-medium">{roleLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t('authenticatedView.summary.invitedBy')}
                </span>
                <span className="font-medium">
                  {inviterName ?? t('fallbacks.inviterShort')}
                </span>
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
                  {t('buttons.acceptInvitationLoading')}
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {t('buttons.acceptInvitation')}
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => navigate('/dashboard')}
            >
              {t('buttons.maybeLater')}
            </Button>
          </div>

          <div className="text-xs text-muted-foreground text-center">
            {t('authenticatedView.footer')}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InviteAcceptance;
