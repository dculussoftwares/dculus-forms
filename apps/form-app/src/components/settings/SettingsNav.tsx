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

  const navItems = [
    { to: 'profile', label: t('nav.profile') },
    { to: 'members', label: t('nav.members') },
    { to: 'billing', label: t('nav.billing') },
  ];

  return (
    <>
      {/* Mobile: horizontal scrollable tab bar */}
      <nav className="sm:hidden flex overflow-x-auto border-b border-[rgba(81,76,84,0.08)] mb-4 -mx-4 px-4 shrink-0">
        {navItems.map(({ to, label }) => {
          const isActive = resolvedSection === to;
          return (
            <button
              key={to}
              onClick={() => navigate(`/settings/${to}`)}
              className={cn(
                'relative whitespace-nowrap px-3 py-2.5 text-sm font-medium shrink-0 transition-colors',
                isActive
                  ? 'text-[#3c323e]'
                  : 'text-[#655d67] hover:text-[#4c414e]'
              )}
            >
              {label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#3c323e] rounded-t-full" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Desktop: vertical sidebar */}
      <nav className="hidden sm:block w-[220px] shrink-0 px-4 py-6">
        <p className="mb-1 px-3 text-sm font-medium text-[#3c323e]">
          {t('nav.sectionAccount')}
        </p>
        <NavItem to="profile" label={t('nav.profile')} resolvedSection={resolvedSection} navigate={navigate} />

        <div className="my-4 border-t border-[rgba(81,76,84,0.08)]" />

        <p className="mb-1 px-3 text-sm font-medium text-[#3c323e]">
          {t('nav.sectionOrganization')}
        </p>
        <NavItem to="members" label={t('nav.members')} resolvedSection={resolvedSection} navigate={navigate} />
        <NavItem to="billing" label={t('nav.billing')} resolvedSection={resolvedSection} navigate={navigate} />
      </nav>
    </>
  );
}

function NavItem({
  to,
  label,
  resolvedSection,
  navigate,
}: {
  to: string;
  label: string;
  resolvedSection: string;
  navigate: (path: string) => void;
}) {
  const isActive = resolvedSection === to;
  return (
    <button
      onClick={() => navigate(`/settings/${to}`)}
      className={cn(
        'flex w-full items-center rounded-lg px-3 py-2 text-sm transition-colors text-left',
        isActive
          ? 'bg-[rgba(87,84,91,0.06)] text-[#3c323e]'
          : 'text-[#655d67] hover:bg-[rgba(87,84,91,0.04)] hover:text-[#4c414e]'
      )}
    >
      {label}
    </button>
  );
}
