import React from "react"
import { useParams } from "react-router-dom"
import { MainLayout } from "../components/MainLayout"
import { OrganizationSettings } from "../components/organization/OrganizationSettings"
import { useTranslation } from "../hooks/useTranslation"

const Settings: React.FC = () => {
  const { tab } = useParams<{ tab?: string }>()
  const { t } = useTranslation('settings')

  return (
    <MainLayout title={t('page.title')} subtitle={t('page.subtitle')}>
      <OrganizationSettings initialTab={tab} />
    </MainLayout>
  )
}

export default Settings
