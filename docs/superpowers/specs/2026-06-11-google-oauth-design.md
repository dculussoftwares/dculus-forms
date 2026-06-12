# Sign in with Google — Design Spec

**Date:** 2026-06-11  
**Scope:** form-app only (not admin-app)  
**Auth library:** better-auth (existing)

---

## Overview

Add "Continue with Google" OAuth sign-in to the form-app's Sign In and Sign Up pages. New Google users get an auto-created organization named `"[Name]'s Organization"` on the callback page. Existing Google users land directly on the dashboard.

---

## Architecture

### Backend

- Add `socialProviders.google` to `apps/backend/src/lib/better-auth.ts` using `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` env vars.
- Add both vars to `apps/backend/src/lib/env.ts` validation and `apps/backend/.env.example`.
- No Prisma schema changes — better-auth's existing `account` table stores social provider tokens.

### Frontend auth client

- Add `socialProviderClient()` from `better-auth/client/plugins` to the plugins array in `apps/form-app/src/lib/auth-client.ts`.

### OAuth callback page

**New file:** `apps/form-app/src/pages/OAuthCallback.tsx`

Follows the `MagicLinkCallback.tsx` pattern:

1. On mount: call `authClient.getSession()` to confirm session and capture bearer token into sessionStorage.
2. Check `authClient.organization.getActiveMember()` to detect org membership.
3. **New user (no org):**
   - Create org: `authClient.organization.create({ name: "${user.name}'s Organization", slug: slugify(...) })`
   - Call `initializeSubscription` GraphQL mutation (same as `SignUp.tsx`)
   - Set active org via `organization.setActive()`
4. Navigate via `window.location.replace('/')` (full reload so `useSession` reinitialises).
5. Loading spinner while processing; error state with "Back to sign in" button on failure.

**Route:** add `<Route path="/oauth/callback" element={<OAuthCallback />} />` as a public route in `App.tsx`.

### UI changes

**`SignIn.tsx`** — Google button between auth mode tabs and the password/magic-link form.

**`SignUp.tsx`** — Google button below the heading, above the name/email/password fields.

Both call: `signIn.social({ provider: 'google', callbackURL: '/oauth/callback' })`

**`GoogleIcon.tsx`** — shared inline SVG component at `apps/form-app/src/components/icons/GoogleIcon.tsx`. Reused in both pages.

**Styling:** `w-full h-10 flex items-center justify-center gap-2 text-xs font-medium rounded-[8px] border border-border bg-white text-foreground hover:shadow-sm transition-all` — matches existing design tokens.

**Divider:** `flex items-center gap-2` with `flex-1 h-px bg-border` lines and `text-xs text-muted-foreground` "or" label.

### i18n

New keys added to existing namespaces (`signIn`, `signUp`) in both `en` and `ta`:
```json
"google": {
  "button": "Continue with Google",
  "divider": "or"
}
```

New namespace `oauthCallback` (en + ta) with keys: `loading.title`, `loading.subtitle`, `error.title`, `error.message`, `error.action`.

---

## New user flow

```
Click "Continue with Google"
  → signIn.social({ provider: 'google', callbackURL: '/oauth/callback' })
  → redirect to Google
  → Google redirects to better-auth backend /api/auth/callback/google
  → better-auth redirects to /oauth/callback
  → OAuthCallback: getSession() → no org → create org → initSubscription → setActive → /
```

## Returning user flow

```
Click "Continue with Google"
  → same redirect chain
  → OAuthCallback: getSession() → org exists → window.location.replace('/')
```

---

## Files changed

| File | Change |
|------|--------|
| `apps/backend/src/lib/better-auth.ts` | Add `socialProviders.google` |
| `apps/backend/src/lib/env.ts` | Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| `apps/backend/.env.example` | Document new env vars |
| `apps/form-app/src/lib/auth-client.ts` | Add `socialProviderClient()` |
| `apps/form-app/src/pages/OAuthCallback.tsx` | New file |
| `apps/form-app/src/App.tsx` | Add `/oauth/callback` route |
| `apps/form-app/src/pages/SignIn.tsx` | Add Google button |
| `apps/form-app/src/pages/SignUp.tsx` | Add Google button |
| `apps/form-app/src/components/icons/GoogleIcon.tsx` | New shared icon |
| `apps/form-app/src/locales/en/signIn.json` | Add `google` keys |
| `apps/form-app/src/locales/ta/signIn.json` | Add `google` keys |
| `apps/form-app/src/locales/en/signUp.json` | Add `google` keys |
| `apps/form-app/src/locales/ta/signUp.json` | Add `google` keys |
| `apps/form-app/src/locales/en/oauthCallback.json` | New file |
| `apps/form-app/src/locales/ta/oauthCallback.json` | New file |
| `apps/form-app/src/locales/index.ts` | Register `oauthCallback` namespace |

---

## Environment variables required

```
# Google OAuth (Google Cloud Console → APIs & Services → Credentials)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Authorized redirect URI to register in Google Cloud Console:
```
http://localhost:4000/api/auth/callback/google   (dev)
https://your-domain.com/api/auth/callback/google (prod)
```
