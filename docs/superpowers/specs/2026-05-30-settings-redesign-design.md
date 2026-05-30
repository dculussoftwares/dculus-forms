# Settings Page Redesign

**Date:** 2026-05-30
**Status:** Approved
**Scope:** Frontend only — full redesign of `/settings/*` routes

---

## Goal

Replace the double-nested tab structure (Account → Organization → Team/Subscription) with a Typeform-inspired grouped left sidebar navigation. Merge the isolated Account and Team tabs into a unified settings shell with three dedicated sections: **Profile**, **Members**, and **Billing & Plans**.

---

## Design Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Navigation structure | Grouped left sidebar (Account → Profile; Organization → Members, Billing & Plans) |
| Billing content layout | Slim plan header + usage card + inline plan comparison strip |
| Usage chart | Hidden by default; expand via "View daily trends ▾" toggle |
| Design language | Typeform token palette (already applied globally) |

---

## Visual Design

### Color tokens (already in codebase)
- Page bg: `#f7f7f8`
- Card bg: `#fff` with `border: 1px solid rgba(81,76,84,0.12)`, `border-radius: 10px`
- Primary text: `#3c323e`
- Muted text: `#655d67`
- Section label: 11px, uppercase, `#655d67`, `letter-spacing: 0.06em`
- Active nav item: `background: rgba(87,84,91,0.07)`, `color: #3c323e`, `font-weight: 500`
- CTA green: `#177767`
- Primary dark button: `#3c323e`

### Buttons (h-8, rounded-lg — already standardised)
- **Primary:** bg `#3c323e`, white text
- **CTA/Upgrade:** bg `#177767`, white text
- **Ghost:** `rgba(255,255,255,0.8)` bg, `rgba(81,76,84,0.15)` border, `#655d67` text

---

## Architecture

### Routing

Current: `/settings/:tab?` → one page with nested tabs

New — same route pattern, new tab values:

| URL | Section rendered |
|---|---|
| `/settings/profile` | ProfileSettings |
| `/settings/members` | MembersSettings |
| `/settings/billing` | BillingSettings |
| `/settings` (no tab) | redirects to `/settings/profile` |

Existing URLs `/settings/account`, `/settings/team`, `/settings/subscription` → redirect to new equivalents to avoid broken links.

### File map

| Action | Path | Responsibility |
|---|---|---|
| Rewrite | `apps/form-app/src/pages/Settings.tsx` | Shell: left sidebar nav + content area routing |
| Create | `apps/form-app/src/components/settings/SettingsNav.tsx` | Left sidebar nav with grouped sections |
| Create | `apps/form-app/src/components/settings/ProfileSettings.tsx` | Profile section (was AccountSettings) |
| Create | `apps/form-app/src/components/settings/MembersSettings.tsx` | Members section (extracted from OrganizationSettings) |
| Create | `apps/form-app/src/components/settings/BillingSettings.tsx` | Billing section (replaces SubscriptionDashboard) |
| Keep | `apps/form-app/src/components/subscription/UsageChart.tsx` | Used inside BillingSettings (collapsible) |
| Keep | `apps/form-app/src/components/subscription/UpgradeModal.tsx` | Used from BillingSettings for checkout |
| Keep | `apps/form-app/src/components/organization/InvitationsList.tsx` | Used inside MembersSettings |
| Keep | `apps/form-app/src/components/organization/InviteUserDialog.tsx` | Used inside MembersSettings |
| Keep | `apps/form-app/src/components/organization/MembersList.tsx` | Used inside MembersSettings |
| Keep | `apps/form-app/src/components/account/AccountSettings.tsx` | Keep as-is; ProfileSettings supersedes it (delete after migration) |
| Keep | `apps/form-app/src/components/subscription/AITokenUsageCard.tsx` | Logic reused inside BillingSettings inline |
| Update | `apps/form-app/src/locales/en/settings.json` | Add new nav/section keys |
| Update | `apps/form-app/src/locales/ta/settings.json` | Tamil equivalents |

The old `OrganizationSettings.tsx`, `AccountSettings.tsx`, `SubscriptionDashboard.tsx` are **not deleted immediately** — they stay until the new components are wired up and verified, then removed in a cleanup commit.

---

## Section Designs

### Settings shell (`Settings.tsx` + `SettingsNav.tsx`)

Layout: `flex-row` — left sidebar `200px` + flex-1 content area.

**SettingsNav** renders:
```
[section label] Account
  Profile

[divider]

[section label] Organization
  Members
  Billing & Plans
```

Active item: `background: rgba(87,84,91,0.07)`, `font-weight: 500`, `color: #3c323e`.
Nav items have an emoji/icon prefix (👤 Profile, 👥 Members, 💳 Billing & Plans).

URL-to-active mapping: `useParams` on `/settings/:section`, match to nav items.

Tab legend: `profile` | `members` | `billing`. Default (no tab): navigate to `profile`.

Redirect map (backwards compat):
- `account` → `profile`
- `team` → `members`
- `subscription` → `billing`

---

### ProfileSettings

**Card: Personal information**
- Avatar (60px circle) — click to upload, same logic as existing `AccountSettings`; shows camera icon overlay on hover
- Display name field (editable)
- Email field (read-only, with hint "Email cannot be changed here")
- Save / Cancel buttons

**Danger zone block** (red border, `rgba(220,38,38,0.02)` bg):
- "Leave organization" — same confirmation dialog as current OrganizationSettings

Data: uses `useAuth()` hook + `updateUser()` mutation (same as existing AccountSettings).

---

### MembersSettings

**Page header row:** "Members" title + subtitle left; "＋ Invite member" button right.

**Card: Organization name** (owners only)
- Single field + Save inline button; uses `organization.update()` mutation.

**Card: Members** (with count badge)
- Each row: avatar circle (initials), name, email, role badge (Owner in green, Member in muted)
- Row height ~52px, `border-bottom: 1px solid rgba(81,76,84,0.06)`
- Uses existing `MembersList` component or its internals

**Card: Pending invitations** (with count badge)
- Rows show email, sent date, Resend / Cancel actions
- Empty state: "No pending invitations" centred text
- Uses existing `InvitationsList` component

Data: uses `refetchOrganization()` from AuthContext + existing invitation mutations (same as OrganizationSettings).

---

### BillingSettings

Three stacked sections, no page-level scrolling clutter:

**1. Plan header card**
```
[Plan name — 20px bold]  [Active badge]        [Manage billing ↗]  [Upgrade Plan]
Billing period: 29 May – 29 Jun 2026 · 31 days remaining
```
- "Manage billing ↗" → ghost button → opens Chargebee portal (same `CREATE_PORTAL_SESSION` mutation + `safeOpen` URL validation)
- "Upgrade Plan" → CTA green button → opens `UpgradeModal`
- Show `past_due` alert banner above this card when `status === 'past_due'`

**2. Usage card**
```
[section label] USAGE THIS PERIOD

[tile: Form Views]    [tile: Submissions]    [tile: AI Tokens]
  0 / 10,000            0 / 1,000             3,168 / 50,000
  [progress bar]        [progress bar]        [amber bar]
  0.0%                  0.0%                  6.3% · resets 31 May

────────────────────────────────
  View daily trends ▾            ← collapsed by default
[area chart — expands inline]   ← shown when toggled
```

Progress bar colours: `bg-primary` (normal) → `bg-orange-500` (≥80%) → `bg-red-500` (≥100%).
AI token bar is always amber (`bg-amber-500`) → orange/red at same thresholds.

Limit-exceeded state: alert banner above usage card (same red banner as current SubscriptionDashboard).

Chart: `<UsageChart>` wrapped in a `useState(showChart)` toggle. Initially hidden. Clicking "View daily trends ▾" sets `showChart = true`; arrow rotates 180°.

Data: `GET_SUBSCRIPTION` (views, submissions, period) + `GET_AI_TOKEN_USAGE` (ai tokens) — same queries as existing components.

**3. Plans section**
```
[section label] PLANS

┌──────────────────┬──────────────────┬──────────────────┐
│  Free             │  Starter          │  Advanced         │
│  $0 / month       │  from $X / mo     │  from $X / mo     │
│  10k views        │  Unlimited views  │  Unlimited views  │
│  1k submissions   │  10k submissions  │  100k submissions │
│  50k AI tokens    │  500k AI tokens   │  5M AI tokens     │
│  [Current plan]   │  [Upgrade →]      │  [Upgrade →]      │
└──────────────────┴──────────────────┴──────────────────┘
```

- Three-column inline strip, no modal needed for comparison
- "Upgrade →" links open `UpgradeModal` (same component, pre-selecting that plan)
- Current plan column has `background: rgba(87,84,91,0.03)` and "Current plan" green badge
- Plan data from `GET_AVAILABLE_PLANS` query (same as UpgradeModal)

---

## Locale keys to add (`settings.json`)

```json
"nav": {
  "sectionAccount": "Account",
  "sectionOrganization": "Organization",
  "profile": "Profile",
  "members": "Members",
  "billing": "Billing & Plans"
},
"profile": {
  "title": "Profile",
  "subtitle": "Update your personal details and avatar",
  "sectionPersonal": "Personal information",
  "fieldName": "Display name",
  "fieldEmail": "Email address",
  "emailHint": "Email cannot be changed here",
  "saveChanges": "Save changes",
  "cancel": "Cancel",
  "dangerTitle": "Leave organization",
  "dangerDesc": "You will lose access to all forms and data in this organization.",
  "leaveButton": "Leave organization"
},
"members": {
  "title": "Members",
  "subtitle": "Manage team access to your organization",
  "inviteButton": "Invite member",
  "orgNameLabel": "Organization name",
  "orgNameSave": "Save",
  "membersCard": "Members",
  "invitationsCard": "Pending invitations",
  "noInvitations": "No pending invitations"
},
"billing": {
  "title": "Billing & Plans",
  "subtitle": "Manage your subscription, usage, and plan",
  "manageBilling": "Manage billing",
  "upgradePlan": "Upgrade Plan",
  "billingPeriod": "Billing period: {{start}} – {{end}} · {{days}} days remaining",
  "sectionUsage": "Usage this period",
  "viewTrends": "View daily trends",
  "hideTrends": "Hide daily trends",
  "sectionPlans": "Plans",
  "currentPlan": "Current plan",
  "upgradeArrow": "Upgrade →",
  "perMonth": "from {{price}} / month",
  "free": "Free"
}
```

Tamil equivalents to be added to `ta/settings.json` for each key above.

---

## Error handling

- `GET_SUBSCRIPTION` fails → show existing "No subscription found" empty state
- `GET_AI_TOKEN_USAGE` fails → AI tokens tile renders `– / –` with no progress bar (silent)
- `GET_AVAILABLE_PLANS` fails → Plans strip shows skeleton placeholders
- Org name update fails → toast error (same pattern as existing)
- Leave org fails → toast error + dialog stays open

---

## Out of scope

- Password change / security settings
- Notification preferences
- API keys / developer settings
- Org switching UI (existing sidebar handles this)
- Admin-only settings pages
