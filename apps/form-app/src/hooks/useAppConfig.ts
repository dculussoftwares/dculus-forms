import { useState, useEffect } from 'react';

interface AppConfig {
  organizationId: string | null;
}

export const useAppConfig = (): AppConfig => {
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    // Get organization ID from localStorage
    const orgId = localStorage.getItem('organization_id');
    setOrganizationId(orgId || null);

    // Listen for storage changes to update the organization ID
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'organization_id') {
        setOrganizationId(e.newValue || null);
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Also listen for custom events when localStorage is updated from the same tab
    const handleCustomStorageChange = (e: CustomEvent) => {
      if (e.detail.key === 'organization_id') {
        setOrganizationId(e.detail.value || null);
      }
    };

    window.addEventListener('localStorageChange', handleCustomStorageChange as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('localStorageChange', handleCustomStorageChange as EventListener);
    };
  }, []);

  return {
    organizationId,
  };
};
