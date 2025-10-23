import React from "react"
import { useParams } from "react-router-dom"
import { MainLayout } from "../components/MainLayout"
import { OrganizationSettings } from "../components/organization/OrganizationSettings"

const Settings: React.FC = () => {
  const { tab } = useParams<{ tab?: string }>()

  return (
    <MainLayout title="Settings" subtitle="Manage your organization and preferences">
      <div className="p-8">
        <OrganizationSettings initialTab={tab} />
      </div>
    </MainLayout>
  )
}

export default Settings
