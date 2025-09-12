import React from "react"
import { MainLayout } from "../components/MainLayout"
import { OrganizationSettings } from "../components/organization/OrganizationSettings"

const Settings: React.FC = () => {
  return (
    <MainLayout title="Settings" subtitle="Manage your organization and preferences">
      <div className="p-8">
        <OrganizationSettings />
      </div>
    </MainLayout>
  )
}

export default Settings
