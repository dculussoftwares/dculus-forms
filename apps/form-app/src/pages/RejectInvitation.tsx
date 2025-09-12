import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, CardContent, CardHeader, CardTitle, LoadingSpinner } from '@dculus/ui';
import { organization } from '../lib/auth-client';
import { useQuery } from '@apollo/client';
import { GET_INVITATION } from '../graphql/invitations';
import { CheckCircle, XCircle, UserX, AlertTriangle } from 'lucide-react';

const RejectInvitation: React.FC = () => {
  const { invitationId } = useParams<{ invitationId: string }>();
  const navigate = useNavigate();
  const [rejecting, setRejecting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // Use GraphQL query to fetch invitation details (no auth required)
  const { data, loading, error } = useQuery(GET_INVITATION, {
    variables: { id: invitationId || '' },
    skip: !invitationId,
    errorPolicy: 'all'
  });

  const invitation = data?.invitation;

  // Handle invalid invitation ID
  if (!invitationId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-8">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <p className="text-lg text-red-700 mb-4">Invalid invitation link</p>
            <Button onClick={() => navigate('/dashboard')} className="w-full">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle GraphQL errors
  if (error && !loading) {
    const errorMessage = error.graphQLErrors?.[0]?.message || error.message || 'Failed to load invitation';
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-8">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <p className="text-lg text-red-700 mb-4">{errorMessage}</p>
            <div className="space-y-2">
              <Button onClick={() => navigate('/dashboard')} variant="outline" className="w-full">
                Go to Dashboard
              </Button>
              <Button onClick={() => window.location.reload()} variant="ghost" className="w-full">
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleReject = async () => {
    if (!invitationId) return;

    setRejecting(true);
    try {
      const { error } = await organization.rejectInvitation({
        invitationId,
      });

      if (error) {
        throw new Error(error.message);
      }

      setResult({
        success: true,
        message: 'Invitation declined successfully.'
      });
    } catch (err) {
      console.error('Failed to reject invitation:', err);
      setResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to decline invitation'
      });
    } finally {
      setRejecting(false);
    }
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
            <h2 className="text-xl font-semibold mb-2">
              {result.success ? 'Invitation Declined' : 'Error'}
            </h2>
            <p className={`text-lg ${result.success ? 'text-green-700' : 'text-red-700'}`}>
              {result.message}
            </p>
            <div className="mt-4">
              <Button onClick={() => navigate('/dashboard')} variant="outline" className="w-full">
                Go to Dashboard
              </Button>
            </div>
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

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            <div className="flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-orange-600 mr-2" />
              <span>Decline Invitation</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-lg mb-2">
              Are you sure you want to decline this invitation?
            </p>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p><strong>Organization:</strong> {invitation.organizationName}</p>
              <p><strong>Role:</strong> {invitation.role === 'owner' ? 'Owner' : invitation.role === 'admin' ? 'Admin' : 'Member'}</p>
              <p><strong>Invited by:</strong> {invitation.inviterName}</p>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              You can always ask for a new invitation later if you change your mind.
            </p>
          </div>

          <div className="space-y-2">
            <Button 
              onClick={handleReject} 
              disabled={rejecting} 
              variant="destructive"
              className="w-full"
            >
              <UserX className="w-4 h-4 mr-2" />
              {rejecting ? 'Declining...' : 'Yes, Decline Invitation'}
            </Button>
            <Button 
              onClick={() => navigate(`/invite/accept/${invitationId}`)}
              disabled={rejecting}
              className="w-full"
            >
              No, Accept Invitation
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

export default RejectInvitation;