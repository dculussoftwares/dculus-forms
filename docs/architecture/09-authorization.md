# Who Can Do What

There are two authorization systems in this product, and conflating them is the
most common way to reason about it wrongly.

**Builder-side** answers "can this signed-in team member open, edit, or share
this form?" It layers a system role, an org membership, and a per-form
permission.

**Respondent-side** answers "may this person fill this form in?" It has nothing
to do with roles or memberships — it's a per-form setting about identity and
email domains.

A form can be wide open to the public while being invisible to most of the
organization that owns it. Those are different questions with different answers.

## At a glance

| | |
|---|---|
| **Entry point** | `apps/backend/src/services/formSharingService.ts:47` — `checkFormAccess` |
| **Trigger** | Every resolver that touches a form; the Hocuspocus WebSocket upgrade |
| **Execution** | Synchronous, one query per check |
| **Outcome** | `{ hasAccess, permission, form }` |
| **Fails loudly?** | Yes — resolvers throw `NO_ACCESS`, and the WebSocket refuses the connection |

## The layers

```
  BUILDER SIDE — can a team member work on this form?

    ┌──────────────────────────────────────────────┐
    │ 1. System role      User.role                │
    │      user | admin | superAdmin               │
    │      (admin-app access; not form access)     │
    ├──────────────────────────────────────────────┤
    │ 2. Org membership   Member.role              │
    │      member | owner                          │
    │      ← checked FIRST, even for form owners   │
    ├──────────────────────────────────────────────┤
    │ 3. Form permission  FormPermission           │
    │      NO_ACCESS(0) VIEWER(1) EDITOR(2) OWNER(3)│
    │      + sharing scope as the fallback         │
    └──────────────────────────────────────────────┘

  RESPONDENT SIDE — may this person submit?

    ┌──────────────────────────────────────────────┐
    │ resolveAccessStatus                          │
    │    OPEN | SIGN_IN_REQUIRED | DOMAIN_REJECTED │
    │                                              │
    │  accessControl.enabled     → restricts who   │
    │  collectRespondentEmail    → identifies who  │
    └──────────────────────────────────────────────┘
```

## Walkthrough

### `checkFormAccess`, in resolution order

The order is the design. Each step either returns or falls through:

**1. Organization membership — first, deliberately.**

```ts
// 🔒 SECURITY: Check organization membership FIRST (before owner check)
// This ensures even form owners must be organization members to access forms
```

Someone removed from the organization loses access to forms they created. If the
ownership check ran first, a removed member would keep full access to their own
forms forever. Non-members return `NO_ACCESS` immediately.

**2. Form ownership.** `form.createdById === userId` → `OWNER`. Only reachable
once membership has passed.

**3. Explicit `FormPermission` row.** If one exists for this user and form, it
decides — compared against the required level through the hierarchy below.
Notably an explicit `NO_ACCESS` row **wins over** a permissive sharing scope,
which is how you exclude one person from an otherwise org-wide form.

**4. Sharing scope fallback.** Only `ALL_ORG_MEMBERS` grants anything here, using
the form's `defaultPermission`.

**5. Otherwise `NO_ACCESS`.**

### The permission hierarchy

Numeric, so comparisons are a `>=`:

| Permission | Rank |
|---|---|
| `NO_ACCESS` | 0 |
| `VIEWER` | 1 |
| `EDITOR` | 2 |
| `OWNER` | 3 |

An unknown string falls back to `0` rather than throwing — a permission value the
code doesn't recognise denies rather than grants.

### The three sharing scopes

| Scope | Who gets in |
|---|---|
| `PRIVATE` | Only explicit `FormPermission` rows |
| `SPECIFIC_MEMBERS` | Only explicit `FormPermission` rows |
| `ALL_ORG_MEMBERS` | Every org member, at `defaultPermission` |

`PRIVATE` and `SPECIFIC_MEMBERS` resolve **identically** in `checkFormAccess` —
both fall through step 4 to `NO_ACCESS` and depend entirely on explicit grants.
The difference between them is presentational: which sharing UI the form shows.
Security-wise they are the same scope.

### Where the checks are enforced

There is no automatic guard. Every resolver states its own:

```ts
requireAuth(context.auth);
await requireOrganizationMembership(context.auth, organizationId);
const access = await checkFormAccess(userId, formId, PermissionLevel.EDITOR);
```

`createBetterAuthContext` *populates* `context.auth` for every request, including
anonymous ones — it doesn't enforce anything. A resolver with no checks is a
public resolver, and it compiles.

The same `checkFormAccess` runs on the Hocuspocus WebSocket upgrade, so
collaboration isn't a side door into a form you can't otherwise open.

### The respondent side

Completely separate code, in `lib/accessControlEnforcement.ts`, and it works on
two independent settings:

- **`accessControl.enabled`** restricts *who may respond*, optionally to an email
  domain allowlist.
- **`collectRespondentEmail`** restricts nobody. It requires sign-in purely so the
  response carries a verified email for the response table and exports.

Either one means "we need an identity", which the code calls `requiresIdentity`.

Two functions, deliberately:

| Function | Returns | Used by |
|---|---|---|
| `resolveAccessStatus` | `OPEN` / `SIGN_IN_REQUIRED` / `DOMAIN_REJECTED` — never throws | `formByShortUrl` field resolvers, to decide what *data* to return |
| `enforceAccessControlForSubmission` | throws | `submitResponse` — the actual boundary |

The non-throwing variant exists so the viewer can render a sign-in gate instead of
an error page, while the throwing one guarantees a direct GraphQL call can't skip
it.

### better-auth configuration

Sessions last 7 days with cookie caching. Plugins in use: `bearer`, `organization`,
`admin`, `emailOTP`, `magicLink`, `oneTimeToken`, `haveIBeenPwned`.

Organization limits: **1 org per user** (100 in the test environment, so tests can
exercise multi-org paths), 100 members per organization.

## Invariants & design decisions

- **Organization membership is checked before ownership.** Reversing these lets a
  removed member keep access to forms they created.
- **An explicit `NO_ACCESS` beats a permissive scope.** Step 3 returns before
  step 4 is reached — that's the exclusion mechanism.
- **Unknown permission strings deny.** `?? 0` in the hierarchy lookup.
- **Every resolver declares its own checks.** Verbose on purpose: a missing check
  is visible in review, a missing exemption from an implicit guard is not.
- **The WebSocket uses the same function as GraphQL.** Not a parallel
  implementation that can drift.
- **Builder-side and respondent-side never mix.** A respondent's org membership is
  irrelevant to whether they may submit, and vice versa.
- **`permission` is a `String`, not a Prisma enum.** There's a `TODO(P3-05)` to
  migrate it once existing data is validated. Until then nothing at the database
  level constrains the value.

## Shared surfaces

What this exposes:

| Exported surface | Consumed by | Contract they rely on | Breaks them if… |
|---|---|---|---|
| `checkFormAccess` | Every form resolver, `hocuspocus.ts`, `formService` | `{ hasAccess, permission, form }`; throws only `FORM_NOT_FOUND` | It starts throwing on denial instead of returning `hasAccess: false` |
| `PermissionLevel` / `SharingScope` | Backend and all three frontends | String values match the database column | A value is renamed without a data migration |
| `requireAuth` / `requireOrganizationMembership` | Every resolver | Throw on failure, return on success | They start returning booleans |
| `resolveAccessStatus` | `formByShortUrl` field resolvers | Never throws | It gains a throwing path |
| `enforceAccessControlForSubmission` | `submitResponse` | Throws on denial | It becomes advisory |
| `BetterAuthContext` | Every resolver, WebSocket auth | `{ user, session, isAuthenticated }` | Fields renamed |

What this depends on:

| Depends on | Owned by | Why |
|---|---|---|
| better-auth `organization` plugin | `lib/better-auth.ts` | `Member` rows and org roles |
| better-auth `admin` plugin | `lib/better-auth.ts` | `User.role` for admin-app |
| `formRepository.findByIdWithAccessContext` | Repositories | Loads the form with members and permissions in one query |

## Data touched

| Model | Access |
|---|---|
| `User` (`role`) | R |
| `Member` (`role`) | R |
| `FormPermission` | RW |
| `Form` (`sharingScope`, `defaultPermission`, `settings.accessControl`) | R |

## Failure & retry behavior

| Situation | What happens |
|---|---|
| Form doesn't exist | Throws `FORM_NOT_FOUND` — note this leaks existence to any signed-in user |
| Not an org member | `{ hasAccess: false, permission: NO_ACCESS }`; the caller decides whether to throw |
| Insufficient level | Same shape; resolvers convert it to a `NO_ACCESS` error |
| WebSocket auth fails | Connection refused; the builder shows disconnected |
| Respondent fails access control | `submitResponse` throws; the viewer renders a gate |

## Configuration

| Setting | Where | Effect |
|---|---|---|
| `sharingScope` | Per form | `PRIVATE` / `SPECIFIC_MEMBERS` / `ALL_ORG_MEMBERS` |
| `defaultPermission` | Per form | Level granted under `ALL_ORG_MEMBERS` |
| `settings.accessControl.enabled` + `allowedDomains` | Per form | Respondent-side restriction |
| `settings.collectRespondentEmail` | Per form | Requires sign-in without restricting |
| `organizationLimit` = 1 (100 in test) | `lib/better-auth.ts` | Orgs per user |
| `membershipLimit` = 100 | `lib/better-auth.ts` | Members per org |
| Session `expiresIn` = 7 days | `lib/better-auth.ts` | Session lifetime |

## Related pages

- [The Life of a Submission](./01-submission-lifecycle.md) — the respondent-side
  gate in its real context, including why it re-runs server-side.
- [Real-Time Collaboration](./07-realtime-collaboration.md) — the WebSocket
  upgrade calling the same `checkFormAccess`.
- [Request Anatomy](./03-request-anatomy.md) — where `context.auth` comes from and
  why enforcement is the resolver's job.

## Gotchas

- **`PRIVATE` and `SPECIFIC_MEMBERS` are the same thing to the permission check.**
  If you're debugging why switching between them changed nothing, that's why.
- **`checkFormAccess` throws for a missing form but returns for a denied one.**
  Two different shapes from one function; callers must handle both.
- **`FORM_NOT_FOUND` is thrown before any permission check**, so a signed-in user
  can distinguish "doesn't exist" from "no access". Deliberate today, worth
  knowing if that ever matters.
- **`User.role` is not form access.** `admin` and `superAdmin` gate the admin app.
  They do not grant access to another organization's forms through this function.
- **Form owners are not permanent.** Leave the organization and step 1 denies you
  before ownership is ever considered.
