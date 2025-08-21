import React from "react"
import { MainLayout } from "../components/MainLayout"

const Settings: React.FC = () => {
  return (
    <MainLayout title="Settings" subtitle="Manage your preferences">
      <div className="p-8">
        <p className="text-muted-foreground">This is a blank settings page.</p>
      </div>
    </MainLayout>
  )
}

export default Settings
