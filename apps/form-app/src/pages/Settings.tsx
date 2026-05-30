import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '../components/MainLayout';
import { SettingsNav } from '../components/settings/SettingsNav';
import { ProfileSettings } from '../components/settings/ProfileSettings';
import { MembersSettings } from '../components/settings/MembersSettings';
import { BillingSettings } from '../components/settings/BillingSettings';
import { useTranslation } from '../hooks/useTranslation';

const REDIRECT_MAP: Record<string, string> = {
  account: 'profile',
  team: 'members',
  subscription: 'billing',
};

const VALID_SECTIONS = new Set(['profile', 'members', 'billing']);

const Settings: React.FC = () => {
  const { section } = useParams<{ section?: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation('settings');

  useEffect(() => {
    if (!section) {
      navigate('/settings/profile', { replace: true });
      return;
    }
    const redirect = REDIRECT_MAP[section];
    if (redirect) {
      navigate(`/settings/${redirect}`, { replace: true });
    }
  }, [section, navigate]);

  const resolvedSection = section
    ? (REDIRECT_MAP[section] ?? section)
    : 'profile';

  return (
    <MainLayout title={t('page.title')} subtitle={t('page.subtitle')}>
      <div className="flex min-h-0 flex-1 -mx-4 sm:-mx-6">
        <SettingsNav />
        <div className="flex-1 overflow-y-auto py-1 pr-4 sm:pr-6">
          {resolvedSection === 'profile' && <ProfileSettings />}
          {resolvedSection === 'members' && <MembersSettings />}
          {resolvedSection === 'billing' && <BillingSettings />}
          {!VALID_SECTIONS.has(resolvedSection) && <ProfileSettings />}
        </div>
      </div>
    </MainLayout>
  );
};

export default Settings;
