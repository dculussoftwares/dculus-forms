/**
 * Signals an imminent same-tab top-level navigation that the app itself initiated and that
 * carries no data-loss risk — e.g. the automation builder's Google/Microsoft "Connect"
 * buttons, which redirect the current tab to the OAuth provider (see
 * plugins/google-sheets/ConfigForm.tsx, plugins/microsoft-sheets/ConfigForm.tsx). The
 * automation graph draft is already persisted to sessionStorage before that redirect fires
 * (see components/automations/builder/draftStorage.ts), so the navigation is safe.
 *
 * `beforeunload` guards (e.g. AutomationBuilder.tsx's unsaved-changes warning) should check
 * this flag and skip their native "leave site?" prompt when it's set — otherwise the browser
 * intercepts the OAuth redirect before the user ever reaches the provider's sign-in page.
 */
let pending = false;

export function markIntentionalNavigation(): void {
  pending = true;
}

export function isIntentionalNavigationPending(): boolean {
  return pending;
}
