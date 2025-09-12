import React from "react"
import { useQuery } from '@apollo/client'
import { MainLayout } from "../components/MainLayout"
import { MembersTable } from "../components/MembersTable"
import { useAuth } from "../contexts/AuthContext"
import { GET_ACTIVE_ORGANIZATION } from '../graphql/queries'
import { LoadingSpinner } from '@dculus/ui'

const Settings: React.FC = () => {
  const { user } = useAuth()
  const { data: orgData, loading: orgLoading } = useQuery(GET_ACTIVE_ORGANIZATION)

  if (orgLoading) {
    return (
      <MainLayout title="Settings" subtitle="Manage your organization">
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner />
          <span className="ml-2">Loading...</span>
        </div>
      </MainLayout>
    )
  }

  if (!orgData?.activeOrganization) {
    return (
      <MainLayout title="Settings" subtitle="Manage your organization">
        <div className="p-8">
          <p className="text-muted-foreground">No active organization found.</p>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout title="Settings" subtitle="Manage your organization">
      <div className="p-8 space-y-6">
        <MembersTable
          organizationId={orgData.activeOrganization.id}
          organizationName={orgData.activeOrganization.name}
          currentUserId={user?.id || ''}
        />
      </div>
    </MainLayout>
  )
}

export default Settings
