import React from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Building2, User } from "lucide-react"
import { MainLayout } from "../components/MainLayout"
import { OrganizationSettings } from "../components/organization/OrganizationSettings"
import { AccountSettings } from "../components/account/AccountSettings"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dculus/ui"
import { useTranslation } from "../hooks/useTranslation"

const ORG_TABS = new Set(["team", "subscription"])

const Settings: React.FC = () => {
  const { tab } = useParams<{ tab?: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation('settings')

  const isOrgTab = tab !== undefined && ORG_TABS.has(tab)
  const activeTab = isOrgTab ? "organization" : "account"

  const handleTabChange = (value: string) => {
    if (value === "account") {
      navigate("/settings/account")
    } else {
      navigate("/settings/team")
    }
  }

  return (
    <MainLayout title={t('page.title')} subtitle={t('page.subtitle')}>
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="account" className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" strokeWidth={1.5} />
            {t('tabs.account')}
          </TabsTrigger>
          <TabsTrigger value="organization" className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" strokeWidth={1.5} />
            {t('tabs.organization')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="mt-6">
          <AccountSettings />
        </TabsContent>

        <TabsContent value="organization" className="mt-6">
          <OrganizationSettings initialTab={isOrgTab ? tab : undefined} />
        </TabsContent>
      </Tabs>
    </MainLayout>
  )
}

export default Settings
