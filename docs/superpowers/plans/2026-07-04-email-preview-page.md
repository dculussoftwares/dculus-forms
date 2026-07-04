# Email Preview Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new admin page that displays all 5 transactional email templates (OTP, Reset Password, Invitation, Magic Link, Form Published) in a tabbed interface with mobile/desktop viewport toggle.

**Architecture:** Single-page component (`EmailPreviewsPage.tsx`) that imports email template generators from the backend, defines hardcoded sample data, and renders each email in iframes. Tabs switch between email types; a toggle button switches between mobile (375px) and desktop (600px) viewport widths.

**Tech Stack:** React, TypeScript, shadcn/ui Tabs component, email generators from backend templates, i18n (useTranslation hook)

## Global Constraints

- Emails import from backend template modules (pure functions, no runtime dependencies)
- Use iframe with `srcDoc` attribute for safe HTML rendering (recommended over dangerouslySetInnerHTML)
- All UI labels and descriptions must be translated (English + Tamil)
- Follow existing admin-app patterns: use Typeform design tokens (--tf-*), shadcn/ui components, existing i18n structure
- No backend changes; no GraphQL endpoints; no database modifications

---

## File Structure

**New files:**
- `apps/admin-app/src/pages/EmailPreviewsPage.tsx` — main page component
- `apps/admin-app/src/locales/en/emailPreviews.json` — English translations
- `apps/admin-app/src/locales/ta/emailPreviews.json` — Tamil translations

**Modified files:**
- `apps/admin-app/src/App.tsx` — add `/email-previews` route
- `apps/admin-app/src/components/AdminLayout.tsx` — add nav link
- `apps/admin-app/src/locales/index.ts` — register translation files

---

## Task 1: Create Sample Data Constants

**Files:**
- Create: `apps/admin-app/src/pages/EmailPreviewsPage.tsx` (start with sample data only)

**Interfaces:**
- Produces: `OTP_SAMPLE_DATA`, `RESET_PASSWORD_SAMPLE_DATA`, `INVITATION_SAMPLE_DATA`, `MAGIC_LINK_SAMPLE_DATA`, `FORM_PUBLISHED_SAMPLE_DATA` (constant objects matching email generator input types)

- [ ] **Step 1: Create the sample data object at the top of EmailPreviewsPage.tsx**

Create the file `apps/admin-app/src/pages/EmailPreviewsPage.tsx` with this content:

```typescript
import type { OTPEmailData } from '../../../backend/src/templates/otpEmail';
import type { ResetPasswordEmailData } from '../../../backend/src/templates/resetPasswordEmail';
import type { InvitationEmailData } from '../../../backend/src/templates/invitationEmail';

/** Sample data for OTP Email variants */
const OTP_SAMPLE_DATA = {
  'sign-in': {
    otp: '123456',
    type: 'sign-in',
    expiresInMinutes: 5,
  } as OTPEmailData,
  'sign-up': {
    otp: '654321',
    type: 'sign-up',
    expiresInMinutes: 5,
  } as OTPEmailData,
  'email-verification': {
    otp: '987654',
    type: 'email-verification',
    expiresInMinutes: 5,
  } as OTPEmailData,
  'forget-password': {
    otp: '345678',
    type: 'forget-password',
    expiresInMinutes: 5,
  } as OTPEmailData,
};

/** Sample data for Reset Password Email */
const RESET_PASSWORD_SAMPLE_DATA: ResetPasswordEmailData = {
  userEmail: 'sarah.johnson@example.com',
  resetUrl: 'https://dculus.com/reset?token=xyz789abc123def456',
  expiresInHours: 1,
};

/** Sample data for Invitation Email */
const INVITATION_SAMPLE_DATA: InvitationEmailData = {
  to: 'jane.doe@acmecorp.com',
  organizationName: 'Acme Corporation',
  inviterName: 'John Smith',
  invitationUrl: 'https://dculus.com/invite/inv_123456789',
  expiresInHours: 48,
};

/** Sample data for Magic Link Email */
const MAGIC_LINK_SAMPLE_DATA = {
  url: 'https://dculus.com/auth/magic-link?token=ml_xyz789abc123def456',
  expiresInMinutes: 5,
};

/** Sample data for Form Published Email */
const FORM_PUBLISHED_SAMPLE_DATA = {
  formTitle: 'Customer Feedback Survey',
  formDescription: 'Help us improve your experience',
  formUrl: 'https://dculus.com/f/customer-feedback',
  ownerName: 'Alice Brown',
};
```

- [ ] **Step 2: Verify types are correct by checking backend template files**

Run:
```bash
grep -n "export.*interface.*EmailData" apps/backend/src/templates/{otpEmail,resetPasswordEmail,invitationEmail}.ts
```

Expected: You should see the type definitions. The types you used in Step 1 should match.

- [ ] **Step 3: Commit sample data**

```bash
git add apps/admin-app/src/pages/EmailPreviewsPage.tsx
git commit -m "feat(admin): add email preview page with sample data constants"
```

---

## Task 2: Import Email Generators and Create Component Shell

**Files:**
- Modify: `apps/admin-app/src/pages/EmailPreviewsPage.tsx`

**Interfaces:**
- Consumes: Sample data constants from Task 1
- Produces: `EmailPreviewsPage` component (exported as default) with:
  - `useState` for viewport mode ('mobile' | 'desktop')
  - `useState` for active tab
  - Imports of all 5 email generators

- [ ] **Step 1: Add imports for email generators and React hooks**

At the top of `apps/admin-app/src/pages/EmailPreviewsPage.tsx`, add:

```typescript
import { useState } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@dculus/ui';
import { Mail } from 'lucide-react';

// Import email generators from backend
import { generateOTPEmailHtml } from '../../../backend/src/templates/otpEmail';
import { generateResetPasswordEmailHtml } from '../../../backend/src/templates/resetPasswordEmail';
import { generateInvitationEmailHtml } from '../../../backend/src/templates/invitationEmail';
import { generateMagicLinkEmailHtml } from '../../../backend/src/templates/magicLinkEmail';
import { generateFormPublishedHtml } from '../../../backend/src/templates/formPublishedEmail';
```

- [ ] **Step 2: Create the component shell**

Add the component function after the sample data constants:

```typescript
type ViewportMode = 'mobile' | 'desktop';

export default function EmailPreviewsPage() {
  const { t } = useTranslation('emailPreviews');
  const [viewportMode, setViewportMode] = useState<ViewportMode>('desktop');
  const [activeTab, setActiveTab] = useState('otp');

  const iframeWidth = viewportMode === 'mobile' ? '375px' : '600px';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-primary">{t('pageTitle')}</h1>
          <p className="text-xs mt-0.5 text-muted-foreground">{t('pageSubtitle')}</p>
        </div>
        <button
          onClick={() => setViewportMode(viewportMode === 'mobile' ? 'desktop' : 'mobile')}
          className="px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            backgroundColor: 'var(--tf-tab-bg)',
            color: 'var(--tf-text)',
          }}
        >
          {viewportMode === 'mobile' ? t('viewportToggle.desktop') : t('viewportToggle.mobile')}
        </button>
      </div>

      {/* Tabs */}
      <div className="rounded-xl bg-white p-5" style={{ border: '1px solid var(--tf-border-medium)' }}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5 gap-1">
            <TabsTrigger value="otp">{t('tabs.otp')}</TabsTrigger>
            <TabsTrigger value="resetPassword">{t('tabs.resetPassword')}</TabsTrigger>
            <TabsTrigger value="invitation">{t('tabs.invitation')}</TabsTrigger>
            <TabsTrigger value="magicLink">{t('tabs.magicLink')}</TabsTrigger>
            <TabsTrigger value="formPublished">{t('tabs.formPublished')}</TabsTrigger>
          </TabsList>

          {/* Tab contents will be added in next task */}
          <TabsContent value="otp" className="mt-4" />
          <TabsContent value="resetPassword" className="mt-4" />
          <TabsContent value="invitation" className="mt-4" />
          <TabsContent value="magicLink" className="mt-4" />
          <TabsContent value="formPublished" className="mt-4" />
        </Tabs>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run the dev server to check for import errors**

```bash
cd apps/admin-app
pnpm dev
```

Navigate to the admin app (http://localhost:3002). You should see no TypeScript errors in the console. The page won't render yet (no route added), so that's OK.

- [ ] **Step 4: Commit component shell**

```bash
git add apps/admin-app/src/pages/EmailPreviewsPage.tsx
git commit -m "feat(admin): add email previews page component shell with tabs and viewport toggle"
```

---

## Task 3: Render Email Content in Tabs

**Files:**
- Modify: `apps/admin-app/src/pages/EmailPreviewsPage.tsx`

**Interfaces:**
- Consumes: Email generators imported in Task 2, sample data from Task 1
- Produces: Five `TabsContent` tabs with iframe rendering of each email type

- [ ] **Step 1: Create an EmailPreview subcomponent for iframe rendering**

Add this helper component before the main `EmailPreviewsPage` function:

```typescript
interface EmailPreviewProps {
  html: string;
  iframeWidth: string;
}

function EmailPreview({ html, iframeWidth }: EmailPreviewProps) {
  return (
    <div className="flex justify-center p-6">
      <iframe
        srcDoc={html}
        title="Email Preview"
        style={{
          width: iframeWidth,
          height: '600px',
          border: 'none',
          borderRadius: '8px',
          boxShadow: '0 2px 8px var(--tf-overlay)',
        }}
        sandbox={{ allow: ['same-origin'] }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Generate HTML for OTP variants and update the OTP tab**

Inside the `EmailPreviewsPage` component, after the `Tabs` declaration, replace the empty OTP `TabsContent` with:

```typescript
<TabsContent value="otp" className="mt-4 space-y-4">
  {Object.entries(OTP_SAMPLE_DATA).map(([variant, data]) => (
    <div key={variant} className="border-t pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-medium text-primary mb-3">{t(`otpVariants.${variant.replace('-', '')}`)}</h3>
      <EmailPreview html={generateOTPEmailHtml(data)} iframeWidth={iframeWidth} />
    </div>
  ))}
</TabsContent>
```

**Note:** The translation key path assumes keys like `otpVariants.signin`, `otpVariants.signup`, etc. We'll verify/adjust these in the translation file task.

- [ ] **Step 3: Render Reset Password Email tab**

Replace the empty resetPassword `TabsContent` with:

```typescript
<TabsContent value="resetPassword" className="mt-4">
  <EmailPreview html={generateResetPasswordEmailHtml(RESET_PASSWORD_SAMPLE_DATA)} iframeWidth={iframeWidth} />
</TabsContent>
```

- [ ] **Step 4: Render Invitation Email tab**

Replace the empty invitation `TabsContent` with:

```typescript
<TabsContent value="invitation" className="mt-4">
  <EmailPreview html={generateInvitationEmailHtml(INVITATION_SAMPLE_DATA)} iframeWidth={iframeWidth} />
</TabsContent>
```

- [ ] **Step 5: Render Magic Link Email tab**

Replace the empty magicLink `TabsContent` with:

```typescript
<TabsContent value="magicLink" className="mt-4">
  <EmailPreview html={generateMagicLinkEmailHtml(MAGIC_LINK_SAMPLE_DATA)} iframeWidth={iframeWidth} />
</TabsContent>
```

- [ ] **Step 6: Render Form Published Email tab**

Replace the empty formPublished `TabsContent` with:

```typescript
<TabsContent value="formPublished" className="mt-4">
  <EmailPreview html={generateFormPublishedHtml(FORM_PUBLISHED_SAMPLE_DATA)} iframeWidth={iframeWidth} />
</TabsContent>
```

- [ ] **Step 7: Verify the component has no syntax errors**

```bash
cd apps/admin-app
pnpm type-check
```

Expected: No TypeScript errors.

- [ ] **Step 8: Commit email rendering**

```bash
git add apps/admin-app/src/pages/EmailPreviewsPage.tsx
git commit -m "feat(admin): render all 5 email templates in tabs with responsive iframe sizing"
```

---

## Task 4: Add Route and Navigation

**Files:**
- Modify: `apps/admin-app/src/App.tsx`
- Modify: `apps/admin-app/src/components/AdminLayout.tsx`

**Interfaces:**
- Consumes: `EmailPreviewsPage` component from Task 3
- Produces: Route `/email-previews` registered and nav link added

- [ ] **Step 1: Import EmailPreviewsPage in App.tsx and add route**

Open `apps/admin-app/src/App.tsx` and add the import near the top with other page imports:

```typescript
import EmailPreviewsPage from './pages/EmailPreviewsPage';
```

Then add the route inside the `<Routes>` component, after the templates route:

```typescript
<Route path="/email-previews" element={<EmailPreviewsPage />} />
```

Full example of the Routes section after changes:

```typescript
<Routes>
  <Route path="/" element={<Navigate to="/dashboard" replace />} />
  <Route path="/dashboard" element={<DashboardPage />} />
  <Route path="/organizations" element={<OrganizationsPage />} />
  <Route path="/organizations/:orgId" element={<OrganizationDetailPage />} />
  <Route path="/users" element={<UsersPage />} />
  <Route path="/users/:userId" element={<UserDetailPage />} />
  <Route path="/templates" element={<TemplatesPage />} />
  <Route path="/email-previews" element={<EmailPreviewsPage />} />
  <Route path="*" element={<Navigate to="/dashboard" replace />} />
</Routes>
```

- [ ] **Step 2: Verify the route is correct**

```bash
grep -A 12 "<Routes>" apps/admin-app/src/App.tsx
```

Expected: The `/email-previews` route appears before the catch-all `*` route.

- [ ] **Step 3: Add navigation link to AdminLayout.tsx**

Open `apps/admin-app/src/components/AdminLayout.tsx` and import the Mail icon at the top:

```typescript
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  LogOut,
  Shield,
  Mail,
} from 'lucide-react';
```

Then find the `navigation` array (around line 25) and add the email previews link after templates:

```typescript
const navigation = [
  { name: t('navigation.dashboard'),     href: '/dashboard',     icon: LayoutDashboard },
  { name: t('navigation.organizations'), href: '/organizations', icon: Building2 },
  { name: t('navigation.users'),         href: '/users',         icon: Users },
  { name: t('navigation.templates'),     href: '/templates',     icon: FileText },
  { name: t('navigation.emailPreviews'), href: '/email-previews', icon: Mail },
];
```

- [ ] **Step 4: Verify the navigation renders**

Start the dev server:

```bash
cd apps/admin-app
pnpm dev
```

Navigate to http://localhost:3002. You should see "Email Previews" link in the sidebar (if you're logged in as admin). The label will show the default value or translation key until we add translations.

- [ ] **Step 5: Commit route and navigation changes**

```bash
git add apps/admin-app/src/App.tsx apps/admin-app/src/components/AdminLayout.tsx
git commit -m "feat(admin): add email previews route and navigation link"
```

---

## Task 5: Create Translation Files (English)

**Files:**
- Create: `apps/admin-app/src/locales/en/emailPreviews.json`

**Interfaces:**
- Produces: English translation object with all keys matching the i18n keys used in EmailPreviewsPage.tsx

- [ ] **Step 1: Create English translation file**

Create the file `apps/admin-app/src/locales/en/emailPreviews.json`:

```json
{
  "pageTitle": "Email Previews",
  "pageSubtitle": "Preview all transactional email templates",
  "viewportToggle": {
    "mobile": "📱 Mobile",
    "desktop": "🖥️ Desktop"
  },
  "tabs": {
    "otp": "OTP Email",
    "resetPassword": "Reset Password",
    "invitation": "Invitation",
    "magicLink": "Magic Link",
    "formPublished": "Form Published"
  },
  "otpVariants": {
    "signin": "Sign-in",
    "signup": "Sign-up",
    "emailverification": "Email Verification",
    "forgetpassword": "Forgot Password"
  }
}
```

**Note:** OTP variant keys are `signin`, `signup`, `emailverification`, `forgetpassword` (no hyphens) because the component code converts hyphens to empty strings in Task 3. Verify this matches your component code.

- [ ] **Step 2: Verify the JSON is valid**

```bash
node -e "console.log(JSON.stringify(require('./apps/admin-app/src/locales/en/emailPreviews.json'), null, 2))"
```

Expected: No error; valid JSON output.

- [ ] **Step 3: Commit English translations**

```bash
git add apps/admin-app/src/locales/en/emailPreviews.json
git commit -m "feat(i18n): add English translations for email previews page"
```

---

## Task 6: Create Translation Files (Tamil) and Register Both

**Files:**
- Create: `apps/admin-app/src/locales/ta/emailPreviews.json`
- Modify: `apps/admin-app/src/locales/index.ts`

**Interfaces:**
- Consumes: English translations from Task 5
- Produces: Tamil translation file and registered translation bundles in locales/index.ts

- [ ] **Step 1: Create Tamil translation file**

Create the file `apps/admin-app/src/locales/ta/emailPreviews.json`:

```json
{
  "pageTitle": "மின்னஞ்சல் முன்னோட்டங்கள்",
  "pageSubtitle": "அனைத்து பரிவர்த்தன மின்னஞ்சல் முறைமைகளின் முன்னோட்டம்",
  "viewportToggle": {
    "mobile": "📱 மொபைல்",
    "desktop": "🖥️ கணினி"
  },
  "tabs": {
    "otp": "OTP மின்னஞ்சல்",
    "resetPassword": "கடவுச்சொல் மீட்டமைப்பு",
    "invitation": "அழைப்பு",
    "magicLink": "மந்திர இணைப்பு",
    "formPublished": "படிவம் வெளியிடப்பட்டது"
  },
  "otpVariants": {
    "signin": "உள்நுழைகை",
    "signup": "பதிவு செய்க",
    "emailverification": "மின்னஞ்சல் சரிபார்ப்பு",
    "forgetpassword": "கடவுச்சொல்லை மறந்துவிட்டேன்"
  }
}
```

- [ ] **Step 2: Verify Tamil JSON is valid**

```bash
node -e "console.log(JSON.stringify(require('./apps/admin-app/src/locales/ta/emailPreviews.json'), null, 2))"
```

Expected: No error; valid JSON output.

- [ ] **Step 3: Check current locales/index.ts structure**

```bash
head -50 apps/admin-app/src/locales/index.ts
```

Expected: You'll see imports and registration of locale files. Look for a pattern like:
```typescript
import enLayout from './en/layout.json';
import taLayout from './ta/layout.json';
// ...
const enTranslations = { ..., layout: enLayout, ... };
const taTranslations = { ..., layout: taLayout, ... };
```

- [ ] **Step 4: Add imports to locales/index.ts**

Open `apps/admin-app/src/locales/index.ts` and add these imports near the top with the other imports:

```typescript
import enEmailPreviews from './en/emailPreviews.json';
import taEmailPreviews from './ta/emailPreviews.json';
```

- [ ] **Step 5: Register translations in enTranslations and taTranslations objects**

Find the `enTranslations` and `taTranslations` object definitions in `locales/index.ts`. Add the new translations:

For `enTranslations`, add:
```typescript
  emailPreviews: enEmailPreviews,
```

For `taTranslations`, add:
```typescript
  emailPreviews: taEmailPreviews,
```

Example of what it should look like:
```typescript
const enTranslations = {
  layout: enLayout,
  templates: enTemplates,
  // ... other translations ...
  emailPreviews: enEmailPreviews,
};

const taTranslations = {
  layout: taLayout,
  templates: taTemplates,
  // ... other translations ...
  emailPreviews: taEmailPreviews,
};
```

- [ ] **Step 6: Verify the locales/index.ts exports correctly**

```bash
cd apps/admin-app
pnpm type-check
```

Expected: No TypeScript errors related to locales.

- [ ] **Step 7: Also register the navigation translation key in admin layout locale files**

The AdminLayout uses `t('navigation.emailPreviews')`, so we need to add this key to the layout translation files.

Open `apps/admin-app/src/locales/en/layout.json` and add:
```json
"emailPreviews": "Email Previews"
```

Open `apps/admin-app/src/locales/ta/layout.json` and add:
```json
"emailPreviews": "மின்னஞ்சல் முன்னோட்டங்கள்"
```

- [ ] **Step 8: Commit translation files and registrations**

```bash
git add apps/admin-app/src/locales/en/emailPreviews.json apps/admin-app/src/locales/ta/emailPreviews.json apps/admin-app/src/locales/en/layout.json apps/admin-app/src/locales/ta/layout.json apps/admin-app/src/locales/index.ts
git commit -m "feat(i18n): add English and Tamil translations for email previews page and sidebar link"
```

---

## Task 7: Manual Testing & Verification

**Files:**
- No new files; testing only

**Interfaces:**
- Consumes: All components and translations from previous tasks

- [ ] **Step 1: Start the admin-app dev server**

```bash
cd apps/admin-app
pnpm dev
```

Expected: App starts on http://localhost:3002 with no console errors.

- [ ] **Step 2: Log in as admin**

Navigate to http://localhost:3002. Log in with admin credentials (set via `ADMIN_EMAIL` and `ADMIN_PASSWORD` env vars).

Expected: You're redirected to the dashboard.

- [ ] **Step 3: Navigate to Email Previews page**

Click "Email Previews" in the sidebar or navigate directly to http://localhost:3002/email-previews.

Expected:
- Page loads with title "Email Previews" and subtitle "Preview all transactional email templates"
- 5 tabs visible: OTP Email, Reset Password, Invitation, Magic Link, Form Published
- Active tab is OTP Email
- 4 sub-sections visible under OTP: Sign-in, Sign-up, Email Verification, Forgot Password

- [ ] **Step 4: Verify OTP email rendering**

Look at the OTP tab. Each of the 4 variants should display an email in an iframe.

Expected:
- Each email has the Dculus Forms header (aubergine band at top)
- White content area with heading, subtitle, and body
- Footer with support links
- OTP code displayed in monospace font (e.g., "123456")
- Info box showing expiry notice

- [ ] **Step 5: Test the other tabs**

Click each tab and verify the email renders:
- **Reset Password:** Contains reset link, user email, expiry time
- **Invitation:** Contains org name, inviter name, invitation URL
- **Magic Link:** Contains magic link URL, expiry time
- **Form Published:** Contains form title, description, form URL, owner name

Expected: All emails render correctly with no broken styles or missing content.

- [ ] **Step 6: Test viewport toggle button**

In the page header, click the viewport toggle button (should show "📱 Mobile" initially).

Expected:
- Button text changes to "🖥️ Desktop"
- Email iframes shrink to ~375px width (mobile size)
- Email is still readable and responsive
- Click again; button shows "📱 Mobile" and iframes return to 600px

- [ ] **Step 7: Test translations (switch language)**

If your admin-app has a language switcher, switch to Tamil.

Expected:
- Page title changes to "மின்னஞ்சல் முன்னோட்டங்கள்"
- Tab labels are in Tamil: "OTP மின்னஞ்சல்", "கடவுச்சொல் மீட்டமைப்பு", etc.
- Sidebar nav shows "மின்னஞ்சல் முன்னோட்டங்கள்"
- All labels are Tamil (translations applied)

- [ ] **Step 8: Check browser console for errors**

Open DevTools (F12). Go to the Console tab.

Expected: No errors, warnings, or security issues.

- [ ] **Step 9: Check responsive design on mobile viewport**

Open DevTools. Toggle device toolbar (Ctrl+Shift+M). Set viewport to iPhone 12 (375x812).

Expected:
- Sidebar is hidden or collapsed (existing admin-app behavior)
- Email preview is visible and readable at mobile size
- Viewport toggle still works (can switch modes)
- No horizontal scrolling needed

- [ ] **Step 10: Verify no broken imports**

In DevTools Console, check that there are no "module not found" or "Cannot find module" errors for imports from the backend.

Expected: All imports from `../../../backend/src/templates/` resolve correctly.

---

## Task 8: Full Feature Test & Fix Issues

**Files:**
- Any files with bugs discovered in Task 7

**Interfaces:**
- Consumes: Results from Task 7 testing
- Produces: Bug fixes (if any) and final working feature

- [ ] **Step 1: Review test results from Task 7**

If all steps in Task 7 passed with no issues, proceed to Step 3.

If any step failed, note the issue:
- If email doesn't render → check email generator imports and sample data
- If translations are missing → check locales/index.ts registration
- If button doesn't work → check useState and onClick handler
- If route 404 → check App.tsx route definition

- [ ] **Step 2: Fix any identified issues**

For each failed test, trace the problem:
1. Check the specific error message in console
2. Identify the file/function causing the issue
3. Fix the bug
4. Re-test the specific step

Add a git commit for each fix:
```bash
git add <fixed files>
git commit -m "fix(admin): <description of fix>"
```

- [ ] **Step 3: Run linter and type checker**

```bash
cd apps/admin-app
pnpm lint
pnpm type-check
```

Expected: No linting errors or TypeScript errors.

- [ ] **Step 4: Full manual test pass**

Repeat the manual tests from Task 7 (Steps 1-10) one final time to ensure everything works end-to-end.

Expected: All steps pass without issues.

- [ ] **Step 5: Document any caveats or known issues**

If there are any edge cases or limitations (e.g., certain email clients render differently), document them. Otherwise, skip this step.

- [ ] **Step 6: Final commit (if fixes were made)**

If you made any fixes in Step 2, run:

```bash
git log --oneline -10
```

Expected: You see the original implementation commits plus any fix commits.

---

## Success Criteria Checklist

Use this checklist to verify the feature is complete:

- [ ] ✅ All 5 email templates visible in tabbed interface
- [ ] ✅ OTP email shows 4 variants (Sign-in, Sign-up, Email Verification, Forgot Password)
- [ ] ✅ Mobile/desktop viewport toggle works (button changes width from 600px to 375px)
- [ ] ✅ Responsive layout works (sidebar visible on desktop, content adjusts on mobile)
- [ ] ✅ Translations in English and Tamil (sidebar link + page labels)
- [ ] ✅ No console errors or broken email rendering
- [ ] ✅ HTML is rendered safely in iframes (no XSS risk)
- [ ] ✅ Page accessible only to authenticated admin users (same auth as other admin pages)
- [ ] ✅ Linter and type checker pass (pnpm lint, pnpm type-check)
- [ ] ✅ All code follows existing admin-app patterns (design tokens, component usage, i18n)

---

## Rollback Plan

If critical issues are discovered:

```bash
# Revert to before email preview feature
git revert <first-email-preview-commit>..HEAD
```

Or reset to a known good state:

```bash
git reset --hard origin/main
```

(Only use if you haven't pushed yet and need a clean slate.)
