import { useNavigate, useParams } from 'react-router-dom';
import { cn } from '@dculus/utils';
import { useTranslation } from '../../hooks/useTranslation';

const REDIRECT_MAP: Record<string, string> = {
  account: 'profile',
  team: 'members',
  subscription: 'billing',
};

export function SettingsNav() {
  const { section } = useParams<{ section?: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation('settings');

  const resolvedSection = section ? (REDIRECT_MAP[section] ?? section) : 'profile';

  function NavItem({ to, icon, label }: { to: string; icon: string; label: string }) {
    return (
      <button
        onClick={() => navigate(`/settings/${to}`)}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg px-3 py-[7px] text-sm transition-colors',
          resolvedSection === to
            ? 'bg-[rgba(87,84,91,0.07)] font-medium text-[#3c323e]'
            : 'text-[#655d67] hover:bg-[rgba(87,84,91,0.05)] hover:text-[#4c414e]'
        )}
      >
        <span className="w-[18px] text-center text-base leading-none">{icon}</span>
        {label}
      </button>
    );
  }

  return (
    <nav className="w-[200px] shrink-0 px-3 py-6">
      <div className="mb-2">
        <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-widest text-[#655d67]">
          {t('nav.sectionAccount')}
        </p>
        <NavItem to="profile" icon="👤" label={t('nav.profile')} />
      </div>
      <div className="my-3 border-t border-[rgba(81,76,84,0.08)]" />
      <div>
        <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-widest text-[#655d67]">
          {t('nav.sectionOrganization')}
        </p>
        <NavItem to="members" icon="👥" label={t('nav.members')} />
        <NavItem to="billing" icon="💳" label={t('nav.billing')} />
      </div>
    </nav>
  );
}
