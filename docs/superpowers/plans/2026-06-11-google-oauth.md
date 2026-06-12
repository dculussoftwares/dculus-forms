# Sign in with Google — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Continue with Google" OAuth to the form-app Sign In and Sign Up pages, with auto-org creation for new Google users via a dedicated `/oauth/callback` page.

**Architecture:** better-auth's built-in `socialProviders.google` handles the OAuth redirect flow. The frontend triggers `signIn.social()`, Google redirects back through the better-auth backend, then lands on a new `/oauth/callback` page that creates an org+subscription for brand-new users before navigating to the dashboard.

**Tech Stack:** better-auth (socialProviders), better-auth/client/plugins (socialProviderClient), React, Apollo Client (useMutation), react-router-dom, @dculus/utils (slugify), i18n via useTranslation

---

## File Map

| File | Action |
|------|--------|
| `apps/backend/src/lib/better-auth.ts` | Modify — add `socialProviders.google` |
| `apps/backend/src/lib/env.ts` | Modify — add `googleConfig` export |
| `apps/backend/.env.example` | Modify — document `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` |
| `apps/form-app/src/lib/auth-client.ts` | Modify — add `socialProviderClient()` |
| `apps/form-app/src/components/icons/GoogleIcon.tsx` | Create — shared inline SVG |
| `apps/form-app/src/locales/en/oauthCallback.json` | Create — English strings |
| `apps/form-app/src/locales/ta/oauthCallback.json` | Create — Tamil strings |
| `apps/form-app/src/locales/en/signIn.json` | Modify — add `google` keys |
| `apps/form-app/src/locales/ta/signIn.json` | Modify — add `google` keys |
| `apps/form-app/src/locales/en/signUp.json` | Modify — add `google` keys |
| `apps/form-app/src/locales/ta/signUp.json` | Modify — add `google` keys |
| `apps/form-app/src/locales/index.ts` | Modify — register `oauthCallback` namespace |
| `apps/form-app/src/pages/OAuthCallback.tsx` | Create — callback handler page |
| `apps/form-app/src/App.tsx` | Modify — add `/oauth/callback` route |
| `apps/form-app/src/pages/SignIn.tsx` | Modify — add Google button |
| `apps/form-app/src/pages/SignUp.tsx` | Modify — add Google button |

---

## Task 1: Backend — add Google OAuth provider

**Files:**
- Modify: `apps/backend/src/lib/env.ts`
- Modify: `apps/backend/src/lib/better-auth.ts`
- Modify: `apps/backend/.env.example`

- [ ] **Step 1: Add googleConfig to env.ts**

Open `apps/backend/src/lib/env.ts` and add this export at the bottom of the file (after `chargebeeConfig`):

```typescript
export interface GoogleConfig {
  clientId: string | undefined;
  clientSecret: string | undefined;
}

export const googleConfig: GoogleConfig = {
  clientId: optionalEnv('GOOGLE_CLIENT_ID'),
  clientSecret: optionalEnv('GOOGLE_CLIENT_SECRET'),
};
```

Using `optionalEnv` (not `requireEnv`) so the backend starts without Google credentials — the feature just won't be available until they're set.

- [ ] **Step 2: Add socialProviders.google to better-auth.ts**

Open `apps/backend/src/lib/better-auth.ts`. Add the import:

```typescript
import { googleConfig } from './env.js';
```

Then inside the `betterAuth({...})` call, add `socialProviders` as a top-level key (place it after the `session` block and before `plugins`):

```typescript
  socialProviders: {
    google: {
      clientId: googleConfig.clientId as string,
      clientSecret: googleConfig.clientSecret as string,
    },
  },
```

- [ ] **Step 3: Document env vars in .env.example**

Open `apps/backend/.env.example`. Find the `# Authentication Configuration` section and add after the `BETTER_AUTH_URL` line:

```
# Google OAuth (optional — enables "Sign in with Google")
# Create credentials at: https://console.cloud.google.com/apis/credentials
# Authorized redirect URI: https://your-domain.com/api/auth/callback/google
#                          http://localhost:4000/api/auth/callback/google (dev)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

- [ ] **Step 4: Type-check backend**

```bash
pnpm type-check
```

Expected: no new errors related to better-auth.ts or env.ts.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/lib/better-auth.ts apps/backend/src/lib/env.ts apps/backend/.env.example
git commit -m "feat: add Google OAuth provider to better-auth backend"
```

---

## Task 2: Frontend auth client — add socialProviderClient

**Files:**
- Modify: `apps/form-app/src/lib/auth-client.ts`

- [ ] **Step 1: Add socialProviderClient to imports**

Open `apps/form-app/src/lib/auth-client.ts`. The current import line is:

```typescript
import { emailOTPClient, magicLinkClient, organizationClient } from 'better-auth/client/plugins';
```

Change it to:

```typescript
import { emailOTPClient, magicLinkClient, organizationClient, socialProviderClient } from 'better-auth/client/plugins';
```

- [ ] **Step 2: Register the plugin**

In the same file, find the `createAuthClient` call. The `plugins` array currently reads:

```typescript
plugins: [organizationClient(), emailOTPClient(), magicLinkClient()],
```

Change it to:

```typescript
plugins: [organizationClient(), emailOTPClient(), magicLinkClient(), socialProviderClient()],
```

No other changes — `signIn.social()` becomes available automatically.

- [ ] **Step 3: Type-check**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/form-app/src/lib/auth-client.ts
git commit -m "feat: register socialProviderClient in better-auth frontend client"
```

---

## Task 3: Shared GoogleIcon component

**Files:**
- Create: `apps/form-app/src/components/icons/GoogleIcon.tsx`

- [ ] **Step 1: Create the icons directory if needed**

```bash
mkdir -p apps/form-app/src/components/icons
```

- [ ] **Step 2: Create GoogleIcon.tsx**

Create `apps/form-app/src/components/icons/GoogleIcon.tsx` with this content:

```tsx
export const GoogleIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    aria-hidden="true"
    focusable="false"
  >
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    <path fill="none" d="M0 0h48v48H0z" />
  </svg>
);
```

- [ ] **Step 3: Commit**

```bash
git add apps/form-app/src/components/icons/GoogleIcon.tsx
git commit -m "feat: add shared GoogleIcon SVG component"
```

---

## Task 4: i18n — oauthCallback locale files + google keys in signIn/signUp

**Files:**
- Create: `apps/form-app/src/locales/en/oauthCallback.json`
- Create: `apps/form-app/src/locales/ta/oauthCallback.json`
- Modify: `apps/form-app/src/locales/en/signIn.json`
- Modify: `apps/form-app/src/locales/ta/signIn.json`
- Modify: `apps/form-app/src/locales/en/signUp.json`
- Modify: `apps/form-app/src/locales/ta/signUp.json`
- Modify: `apps/form-app/src/locales/index.ts`

- [ ] **Step 1: Create en/oauthCallback.json**

```json
{
  "loading": {
    "title": "Signing you in...",
    "subtitle": "Please wait while we set up your account."
  },
  "error": {
    "title": "Sign-in failed",
    "message": "Something went wrong while signing you in with Google. Please try again.",
    "action": "Back to sign in"
  }
}
```

- [ ] **Step 2: Create ta/oauthCallback.json**

```json
{
  "loading": {
    "title": "உள்நுழைகிறோம்...",
    "subtitle": "உங்கள் கணக்கை அமைக்கும் போது காத்திருங்கள்."
  },
  "error": {
    "title": "உள்நுழைவு தோல்வியடைந்தது",
    "message": "Google மூலம் உள்நுழைவதில் பிழை ஏற்பட்டது. மீண்டும் முயற்சிக்கவும்.",
    "action": "உள்நுழைவுக்கு திரும்பு"
  }
}
```

- [ ] **Step 3: Add `google` keys to en/signIn.json**

Open `apps/form-app/src/locales/en/signIn.json`. Add this block at the top level (e.g. after `"magicLink": {...}`):

```json
"google": {
  "button": "Continue with Google",
  "divider": "or"
}
```

- [ ] **Step 4: Add `google` keys to ta/signIn.json**

Open `apps/form-app/src/locales/ta/signIn.json`. Add at the top level:

```json
"google": {
  "button": "Google மூலம் தொடரவும்",
  "divider": "அல்லது"
}
```

- [ ] **Step 5: Add `google` keys to en/signUp.json**

Open `apps/form-app/src/locales/en/signUp.json`. Add at the top level:

```json
"google": {
  "button": "Continue with Google",
  "divider": "or"
}
```

- [ ] **Step 6: Add `google` keys to ta/signUp.json**

Open `apps/form-app/src/locales/ta/signUp.json`. Add at the top level:

```json
"google": {
  "button": "Google மூலம் தொடரவும்",
  "divider": "அல்லது"
}
```

- [ ] **Step 7: Register oauthCallback namespace in index.ts**

Open `apps/form-app/src/locales/index.ts`.

Add these two imports near the bottom of the import block (after the `enMagicLinkCallback` / `taMagicLinkCallback` imports):

```typescript
import enOauthCallback from './en/oauthCallback.json';
import taOauthCallback from './ta/oauthCallback.json';
```

Add `oauthCallback: enOauthCallback` to the `enTranslations` object (after `magicLinkCallback: enMagicLinkCallback`):

```typescript
  oauthCallback: enOauthCallback,
```

Add `oauthCallback: taOauthCallback` to the `taTranslations` object (after `magicLinkCallback: taMagicLinkCallback`):

```typescript
  oauthCallback: taOauthCallback,
```

- [ ] **Step 8: Type-check**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add \
  apps/form-app/src/locales/en/oauthCallback.json \
  apps/form-app/src/locales/ta/oauthCallback.json \
  apps/form-app/src/locales/en/signIn.json \
  apps/form-app/src/locales/ta/signIn.json \
  apps/form-app/src/locales/en/signUp.json \
  apps/form-app/src/locales/ta/signUp.json \
  apps/form-app/src/locales/index.ts
git commit -m "feat: add oauthCallback locale namespace and google keys to signIn/signUp"
```

---

## Task 5: OAuthCallback page

**Files:**
- Create: `apps/form-app/src/pages/OAuthCallback.tsx`
- Modify: `apps/form-app/src/App.tsx`

- [ ] **Step 1: Create OAuthCallback.tsx**

Create `apps/form-app/src/pages/OAuthCallback.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, AlertCircle } from 'lucide-react';
import { Button } from '@dculus/ui';
import { useMutation } from '@apollo/client/react';
import { slugify } from '@dculus/utils';
import { authClient, organization } from '../lib/auth-client';
import { INITIALIZE_ORGANIZATION_SUBSCRIPTION } from '../graphql/subscription';
import { useTranslation } from '../hooks/useTranslation';

export const OAuthCallback = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('oauthCallback');
  const [error, setError] = useState(false);
  const [initializeSubscription] = useMutation(INITIALIZE_ORGANIZATION_SUBSCRIPTION);

  useEffect(() => {
    const run = async () => {
      try {
        const { data, error: sessionError } = await authClient.getSession();
        if (sessionError || !data?.session) {
          setError(true);
          return;
        }

        const user = data.user;
        const hasOrg = !!data.session.activeOrganizationId;

        if (!hasOrg) {
          const orgName = `${user.name}'s Organization`;
          const orgSlug = slugify(orgName);

          const orgResult = await authClient.organization.create({
            name: orgName,
            slug: orgSlug,
          });

          if (!orgResult.data) {
            setError(true);
            return;
          }

          try {
            await initializeSubscription({
              variables: { organizationId: orgResult.data.id },
            });
          } catch {
            // Non-fatal — subscription can be initialised later
          }

          await organization.setActive({ organizationId: orgResult.data.id });
        }

        window.location.replace('/');
      } catch {
        setError(true);
      }
    };

    run();
  }, []);

  if (error) {
    return (
      <div className="h-screen flex flex-col items-center justify-center px-6 bg-white">
        <div className="w-full max-w-sm text-center space-y-5">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
            style={{ backgroundColor: 'var(--tf-error-bg)' }}
          >
            <AlertCircle className="w-7 h-7" style={{ color: 'var(--tf-error)' }} />
          </div>
          <div>
            <h1 className="text-xl font-semibold mb-1.5 text-primary">{t('error.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('error.message')}</p>
          </div>
          <Button onClick={() => navigate('/signin')} className="w-full h-10">
            {t('error.action')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col items-center justify-center px-6 bg-white">
      <div className="w-full max-w-sm text-center space-y-5">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
          style={{ backgroundColor: 'var(--tf-dark)' }}
        >
          <FileText className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-semibold mb-1.5 text-primary">{t('loading.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('loading.subtitle')}</p>
        </div>
        <div className="flex justify-center">
          <span className="w-6 h-6 rounded-full border-2 border-muted border-t-primary animate-spin" />
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Add the route to App.tsx**

Open `apps/form-app/src/App.tsx`. Find the import for `MagicLinkCallback`:

```typescript
import { MagicLinkCallback } from './pages/MagicLinkCallback';
```

Add directly below it:

```typescript
import { OAuthCallback } from './pages/OAuthCallback';
```

Then find the route for magic-link:

```tsx
<Route path="/magic-link/verify" element={<MagicLinkCallback />} />
```

Add directly below it:

```tsx
<Route path="/oauth/callback" element={<OAuthCallback />} />
```

- [ ] **Step 3: Type-check**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/form-app/src/pages/OAuthCallback.tsx apps/form-app/src/App.tsx
git commit -m "feat: add OAuthCallback page with org auto-creation for new Google users"
```

---

## Task 6: Google button on SignIn page

**Files:**
- Modify: `apps/form-app/src/pages/SignIn.tsx`

- [ ] **Step 1: Add GoogleIcon import**

Open `apps/form-app/src/pages/SignIn.tsx`. Find the existing imports at the top. Add:

```typescript
import { GoogleIcon } from '../components/icons/GoogleIcon';
```

Also add `signIn` to the imports from `auth-client` if it is not already destructured — it already is: `import { signIn, emailOtp } from '../lib/auth-client';` — so no change needed there.

- [ ] **Step 2: Add the Google button and divider**

In `SignIn.tsx`, find this comment and the `<div>` that follows it:

```tsx
<div className="flex rounded-xl p-1 mb-6" style={{ backgroundColor: 'var(--tf-border-light)', border: '1px solid var(--tf-border-light)' }}>
```

Insert the following **directly after** the closing `</div>` of the tabs segment (i.e., after the `</div>` that closes the tabs wrapper, before the `{authMode === 'password' && (` block):

```tsx
{/* Google sign-in */}
<button
  type="button"
  onClick={() => signIn.social({ provider: 'google', callbackURL: '/oauth/callback' })}
  className="w-full h-10 flex items-center justify-center gap-2 text-xs font-medium rounded-lg border border-border bg-white text-foreground hover:shadow-sm transition-all mb-4"
>
  <GoogleIcon size={16} />
  {t('google.button')}
</button>

{/* Divider */}
<div className="flex items-center gap-2 mb-5">
  <div className="flex-1 h-px bg-border" />
  <span className="text-xs text-muted-foreground">{t('google.divider')}</span>
  <div className="flex-1 h-px bg-border" />
</div>
```

- [ ] **Step 3: Type-check**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/form-app/src/pages/SignIn.tsx
git commit -m "feat: add Continue with Google button to SignIn page"
```

---

## Task 7: Google button on SignUp page

**Files:**
- Modify: `apps/form-app/src/pages/SignUp.tsx`

- [ ] **Step 1: Add GoogleIcon import**

Open `apps/form-app/src/pages/SignUp.tsx`. Add:

```typescript
import { GoogleIcon } from '../components/icons/GoogleIcon';
```

Also import `signIn` from auth-client — it is already imported: `import { authClient, signUp, emailOtp, signIn, organization } from '../lib/auth-client';` — no change needed.

- [ ] **Step 2: Add the Google button and divider**

In `SignUp.tsx`, find the JSX that starts the form step. Look for this block (near the `<form` element in the `step === 'form'` branch):

```tsx
<Field id="name" label={t('form.fields.name.label')} error={errors.name}>
```

Insert the following **directly before** that `<Field` line (so it appears above the name/email/password fields):

```tsx
{/* Google sign-up */}
<button
  type="button"
  onClick={() => signIn.social({ provider: 'google', callbackURL: '/oauth/callback' })}
  className="w-full h-10 flex items-center justify-center gap-2 text-xs font-medium rounded-lg border border-border bg-white text-foreground hover:shadow-sm transition-all mb-4"
>
  <GoogleIcon size={16} />
  {t('google.button')}
</button>

{/* Divider */}
<div className="flex items-center gap-2 mb-5">
  <div className="flex-1 h-px bg-border" />
  <span className="text-xs text-muted-foreground">{t('google.divider')}</span>
  <div className="flex-1 h-px bg-border" />
</div>
```

- [ ] **Step 3: Type-check**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 4: Build check**

```bash
pnpm build
```

Expected: all packages build without errors.

- [ ] **Step 5: Commit**

```bash
git add apps/form-app/src/pages/SignUp.tsx
git commit -m "feat: add Continue with Google button to SignUp page"
```

---

## Task 8: Manual verification checklist

Before marking this feature done, verify these flows manually (requires real `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` in `apps/backend/.env`):

- [ ] **New user via Sign In page** — click "Continue with Google", complete Google flow, lands on dashboard with a new org named `"[Name]'s Organization"`.
- [ ] **New user via Sign Up page** — same flow from SignUp page, same result.
- [ ] **Returning user** — sign in again with the same Google account, lands directly on dashboard, no duplicate org created.
- [ ] **Error state** — temporarily break the callback URL (e.g. set `callbackURL: '/oauth/bad'`), confirm the error screen shows with "Back to sign in" button.
- [ ] **Tamil locale** — switch locale to Tamil, verify the Google button label reads `Google மூலம் தொடரவும்`.
- [ ] **Type-check passes** — `pnpm type-check` exits 0.
- [ ] **Build passes** — `pnpm build` exits 0.

> **Note:** Register the following redirect URIs in Google Cloud Console before testing:
> - Dev: `http://localhost:4000/api/auth/callback/google`
> - Prod: `https://your-domain.com/api/auth/callback/google`
