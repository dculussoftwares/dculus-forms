import { brandingLabels } from '../locales/branding';

interface PoweredByBadgeProps {
  embedded?: boolean;
}

/** "Powered by Dculus" pill shown on Free-plan forms; paid plans remove it. */
export function PoweredByBadge({ embedded = false }: PoweredByBadgeProps) {
  return (
    <a
      href={brandingLabels.href}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="powered-by-badge"
      className={`${embedded ? 'absolute' : 'fixed'} bottom-3 right-3 z-40 rounded-full border border-gray-200 bg-white/90 px-3 py-1 text-xs text-gray-600 shadow-sm backdrop-blur hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900/90 dark:text-gray-300 dark:hover:text-white`}
    >
      {brandingLabels.poweredBy} <span className="font-semibold">{brandingLabels.brand}</span>
    </a>
  );
}
