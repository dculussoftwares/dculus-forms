import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { Card, Button, toastError } from '@dculus/ui';
import { Puzzle } from 'lucide-react';
import { GET_AVAILABLE_ADDONS, CREATE_ADDON_CHECKOUT_SESSION } from '../../graphql/subscription';
import { useTranslation } from '../../hooks/useTranslation';

interface AddonsCardProps {
  planId: string;
  status: string;
  canManageBilling: boolean;
}

type Meter = 'views' | 'submissions' | 'emails' | 'aiCredits';
const METERS: Meter[] = ['views', 'submissions', 'emails', 'aiCredits'];

// Same host guard as the plan checkout: only ever navigate to Chargebee's hosted pages.
function safeRedirect(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    if (parsed.protocol !== 'https:' || (host !== 'chargebee.com' && !host.endsWith('.chargebee.com'))) {
      return false;
    }
    window.location.href = url;
    return true;
  } catch {
    return false;
  }
}

/**
 * Extra capacity (add-ons) on top of a paid plan. Add-ons are defined in Chargebee and
 * priced per unit; the server picks the price matching the subscription's currency and
 * billing period. Not offered on free/enterprise plans or while billing isn't in good standing.
 */
export function AddonsCard({ planId, status, canManageBilling }: AddonsCardProps) {
  const { t } = useTranslation('addons');
  const eligible = planId !== 'free' && planId !== 'enterprise' && status === 'active';
  const { data } = useQuery(GET_AVAILABLE_ADDONS, { skip: !eligible });
  const [buy, { loading }] = useMutation(CREATE_ADDON_CHECKOUT_SESSION);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);

  const addons: any[] = data?.availableAddons ?? [];
  if (!eligible || addons.length === 0) return null;

  const handleBuy = async (addonId: string) => {
    setPendingId(addonId);
    try {
      const { data: result } = await buy({ variables: { addonId, quantity: quantities[addonId] ?? 1 } });
      const url = result?.createAddonCheckoutSession?.url;
      if (!url || !safeRedirect(url)) toastError(t('error'), '');
    } catch (error: any) {
      toastError(t('error'), error.message);
    } finally {
      setPendingId(null);
    }
  };

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="bg-blue-50 p-3 rounded-xl">
          <Puzzle className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h3 className="text-base font-semibold">{t('title')}</h3>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      <div className="space-y-3">
        {addons.map((addon) => {
          const price = addon.unitPrice;
          const quantity = quantities[addon.id] ?? 1;
          return (
            <div key={addon.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
              <div>
                <p className="text-sm font-medium">{addon.name}</p>
                {METERS.filter((m) => addon.grants?.[m] != null).map((m) => (
                  <p key={m} className="text-xs text-muted-foreground">
                    {t('grant', {
                      values: { count: addon.grants[m].toLocaleString('en-US'), meter: t(`meters.${m}`) },
                    })}
                  </p>
                ))}
                <p className="mt-1 text-xs">
                  {price
                    ? t('perUnit', {
                        values: {
                          price: `${price.currency === 'INR' ? '₹' : '$'}${price.amount.toLocaleString('en-US')}`,
                          period: t(price.period === 'year' ? 'year' : 'month'),
                        },
                      })
                    : t('unavailable')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground" htmlFor={`qty-${addon.id}`}>
                  {t('quantity')}
                </label>
                <input
                  id={`qty-${addon.id}`}
                  type="number"
                  min={1}
                  max={1000}
                  step={1}
                  value={quantity}
                  onChange={(e) =>
                    setQuantities((q) => ({
                      ...q,
                      [addon.id]: Math.max(1, Math.min(1000, Math.floor(Number(e.target.value) || 1))),
                    }))
                  }
                  className="w-20 rounded border px-2 py-1 text-sm"
                />
                <Button
                  size="sm"
                  disabled={!canManageBilling || !price || loading}
                  onClick={() => handleBuy(addon.id)}
                >
                  {loading && pendingId === addon.id ? t('redirecting') : t('buy')}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
