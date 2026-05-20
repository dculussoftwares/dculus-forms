# API Permission Reference

Complete permission map for all GraphQL operations and REST endpoints.  
Reflects the state after the Phase 1–4 security audit fixes.

---

## Permission Model

Three layers must all pass. A request is rejected if any layer fails.

### Layer 1 — System Role (`User.role`)

| Role | Description |
|------|-------------|
| `user` | Default. Can own orgs, build forms, manage responses within their permitted scope. |
| `admin` | Platform administrator. Can manage templates, view all orgs, manage users. |
| `superAdmin` | Unrestricted platform access. Everything `admin` can do plus destructive operations. |

### Layer 2 — Org Membership Role (`Member.role`)

| Role | Description |
|------|-------------|
| `member` | Can access forms shared with them per `FormPermission` or org-wide sharing. |
| `owner` | Full control over the org, its members, invitations, and all forms. |

### Layer 3 — Form Permission (`FormPermission.permission`)

| Permission | Level | Description |
|------------|-------|-------------|
| `OWNER` | 3 | Edit schema, settings, plugins, delete form, view/export all responses. Implicitly held by `form.createdById`. |
| `EDITOR` | 2 | Edit schema, view/manage responses. Cannot delete or change sharing settings. |
| `VIEWER` | 1 | Read-only access to form and responses. |
| `NO_ACCESS` | 0 | Explicitly blocked, even when org-wide sharing would otherwise grant access. |

Permission checks are hierarchical: a guard requiring `VIEWER` is satisfied by `VIEWER`, `EDITOR`, or `OWNER`.

### Form Sharing Scopes

| Scope | Who gets access |
|-------|----------------|
| `PRIVATE` | Only users with an explicit `FormPermission` row. |
| `SPECIFIC_MEMBERS` | Selected org members granted access individually. |
| `ALL_ORG_MEMBERS` | All org members receive `form.defaultPermission` unless overridden by an explicit row or `NO_ACCESS`. |

### Guard Helper Functions

| Helper | Behaviour |
|--------|-----------|
| `requireAuth(context.auth)` | Throws `AUTHENTICATION_REQUIRED` if no valid session. |
| `requireOrganizationMembership(context.auth, orgId)` | Throws `FORBIDDEN` if the user is not a member of `orgId`. Internally calls `requireAuth`. |
| `checkFormAccess(userId, formId, minPermission)` | Verifies org membership, then evaluates explicit permissions and sharing scope. Returns `{ hasAccess, permission, form }`. Throws `FORM_NOT_FOUND` if the form does not exist. |
| `requireAdminRole(context)` | Checks `user.role === 'admin' \| 'superAdmin'`. |
| `requireOrganizationRole(context, orgId, role)` | Checks `member.role` inside a specific org. |

---

## GraphQL Operations

### `resolvers/admin.ts` — Platform Administration

All operations require **`admin` or `superAdmin`** system role.

| Operation | Type | Guard |
|-----------|------|-------|
| `adminOrganizations` | Query | `requireAdminRole` |
| `adminOrganization(id)` | Query | `requireAdminRole` |
| `adminOrganizationById(id)` | Query | `requireAdminRole` |
| `adminStats` | Query | `requireAdminRole` |
| `adminUsers` | Query | `requireAdminRole` |
| `adminUserById(id)` | Query | `requireAdminRole` |

---

### `resolvers/analytics.ts` — Form Analytics

| Operation | Type | Guard | Notes |
|-----------|------|-------|-------|
| `trackFormView` | Mutation | **PUBLIC** | Validates `form.isPublished`. Emits subscription usage event. |
| `updateFormStartTime` | Mutation | **PUBLIC** | Validates `form.isPublished`. |
| `trackFormSubmission` | Mutation | **PUBLIC** | Validates form & response existence. |
| `formAnalytics(formId)` | Query | `requireOrganizationMembership` | Looks up form's `organizationId` from DB — not trusted from args. |
| `formSubmissionAnalytics(formId)` | Query | `requireOrganizationMembership` | Same as above. |

> **Note:** `formAnalytics` and `formSubmissionAnalytics` check org membership but not explicit form-level permission. A user with `NO_ACCESS` on a form who is still an org member can read its aggregate analytics.

---

### `resolvers/better-auth.ts` — Authentication & Session

| Operation | Type | Guard | Notes |
|-----------|------|-------|-------|
| `me` | Query | `requireAuth` | |
| `activeOrganization` | Query | `requireAuth` + `requireOrganizationMembership` | Org ID read from session, not args. |
| `createOrganization(input)` | Mutation | `requireAuth` | Enforces single-org limit per user (100 in test env). |
| `setActiveOrganization(orgId)` | Mutation | `requireOrganizationMembership` | Internally calls `requireAuth`. |

---

### `resolvers/fieldAnalytics.ts` — Per-Field Response Analytics

| Operation | Type | Guard |
|-----------|------|-------|
| `fieldAnalytics(formId, fieldId)` | Query | `requireAuth` + `checkFormAccess(VIEWER)` |
| `allFieldsAnalytics(formId)` | Query | `requireAuth` + `checkFormAccess(VIEWER)` |

Uses the comprehensive `checkFormAccess` from `formSharing.ts` (respects `NO_ACCESS` and all sharing scopes).

---

### `resolvers/fileUpload.ts` — File Upload & Download

| Operation | Type | Guard | Notes |
|-----------|------|-------|-------|
| `getResponseFileDownloadUrl(key)` | Query | `requireAuth` + `checkFormAccess(VIEWER)` | Extracts `formId` from key via regex; prevents path traversal. |
| `uploadFile` — `FormTemplate` | Mutation | `requireAdminRole` | |
| `uploadFile` — `FormBackground` | Mutation | `requireAuth` + `checkFormAccess(EDITOR)` | |
| `uploadFile` — `UserAvatar` | Mutation | `requireAuth` | User-owned automatically. |
| `uploadFile` — `OrganizationLogo` | Mutation | `requireAuth` + `requireOrganizationMembership` | |
| `uploadFile` — `FormResponse` | Mutation | `requireAuth` | Any authenticated user may upload response files. |
| `deleteFile(key)` | Mutation | `requireAuth` + if form-associated: `checkFormAccess(EDITOR)` | Non-form files (avatar, logo) only require auth. |

---

### `resolvers/formFiles.ts` — Form Asset Files

| Operation | Type | Guard |
|-----------|------|-------|
| `getFormFiles(formId, type)` | Query | `requireAuth` + `checkFormAccess(VIEWER)` |

---

### `resolvers/forms.ts` — Form CRUD

| Operation | Type | Guard | Notes |
|-----------|------|-------|-------|
| `form(id)` | Query | `requireAuth` + `checkFormAccess(VIEWER)` | |
| `formByShortUrl(shortUrl)` | Query | **PUBLIC** | Validates `isPublished`. Checks subscription limits, max responses, and time window. |
| `createForm(input)` | Mutation | `requireOrganizationMembership` | |
| `updateForm(id, input)` | Mutation | `requireAuth` + dynamic permission | Title/description/settings → `EDITOR`. Published state/shortUrl changes → `OWNER`. |
| `deleteForm(id)` | Mutation | `requireAuth` + `checkFormAccess(OWNER)` | |
| `regenerateShortUrl(id)` | Mutation | `requireAuth` + `checkFormAccess(OWNER)` | |
| `duplicateForm(id)` | Mutation | `requireAuth` + `checkFormAccess(EDITOR)` | Requires EDITOR on the source form. |

---

### `resolvers/formSharing.ts` — Sharing & Permissions

| Operation | Type | Guard | Notes |
|-----------|------|-------|-------|
| `forms(orgId, category)` | Query | `requireOrganizationMembership` | Returns only forms the user owns or has explicit/org-wide access to. |
| `formPermissions(formId)` | Query | `requireAuth` + `checkFormAccess(EDITOR)` | |
| `organizationMembers(orgId)` | Query | `requireOrganizationMembership` | |
| `shareForm(input)` | Mutation | `requireAuth` + `checkFormAccess(OWNER)` | Changes sharing scope and per-user permissions. OWNER only. |
| `updateFormPermission(input)` | Mutation | `requireAuth` + `checkFormAccess(OWNER)` | Cannot change the form creator's permission. |
| `removeFormAccess(formId, userId)` | Mutation | `requireAuth` + `checkFormAccess(OWNER)` | Cannot remove the form creator's access. |

---

### `resolvers/invitations.ts` — Org Invitations

| Operation | Type | Guard | Notes |
|-----------|------|-------|-------|
| `getInvitationPublic(id)` | Query | **PUBLIC** | Token-based; validates format, expiry, and status. Returns only non-sensitive fields. |

> Invitation sending and revoking are handled by better-auth's organisation plugin (org `owner` role required).

---

### `resolvers/plugins.ts` — Form Plugins (Webhooks, Email, Quiz)

| Operation | Type | Guard | Notes |
|-----------|------|-------|-------|
| `formPlugins(formId)` | Query | `requireAuth` + `checkFormAccess(VIEWER)` | |
| `formPlugin(id)` | Query | `requireAuth` + `checkFormAccess(VIEWER)` | Looks up form from plugin. |
| `pluginDeliveries(pluginId, limit)` | Query | `requireAuth` + `checkFormAccess(VIEWER)` | |
| `createFormPlugin(input)` | Mutation | `requireAuth` + `checkFormAccess(OWNER)` | Plugins can send data to external URLs — OWNER only. |
| `updateFormPlugin(id, input)` | Mutation | `requireAuth` + `checkFormAccess(OWNER)` | |
| `deleteFormPlugin(id)` | Mutation | `requireAuth` + `checkFormAccess(OWNER)` | |
| `testFormPlugin(id)` | Mutation | `requireAuth` + `checkFormAccess(OWNER)` | Triggers a live outbound event. |

---

### `resolvers/responses.ts` — Form Responses

| Operation | Type | Guard | Notes |
|-----------|------|-------|-------|
| `responses(orgId)` | Query | `requireOrganizationMembership` | Scoped to forms the user can access (creator or VIEWER+). Does **not** return forms where user has `NO_ACCESS`. |
| `response(id)` | Query | `requireAuth` + `checkFormAccess(VIEWER)` | |
| `responsesByForm(formId, …)` | Query | `requireAuth` + `requireOrganizationMembership` + `checkFormAccess(VIEWER)` | Supports pagination, sorting, and filtering. |
| `responseEditHistory(responseId)` | Query | `requireAuth` + `requireOrganizationMembership` + `checkFormAccess(VIEWER)` | |
| `submitResponse(input)` | Mutation | **PUBLIC** | Validates `isPublished`, subscription limits, max responses, and time window. |
| `updateResponse(input)` | Mutation | `requireAuth` + `requireOrganizationMembership` + `checkFormAccess(EDITOR)` | Records field-level diff via `ResponseEditTrackingService`. |
| `deleteResponse(id)` | Mutation | `requireAuth` + `checkFormAccess(OWNER)` | |

---

### `resolvers/subscriptions.ts` — Billing & Subscription

| Operation | Type | Guard | Notes |
|-----------|------|-------|-------|
| `availablePlans` | Query | **PUBLIC** | Pricing page data. |
| `createCheckoutSession(itemPriceId)` | Mutation | `requireAuth` + `requireOrganizationMembership` | Validates `itemPriceId` format. |
| `createPortalSession` | Mutation | `requireAuth` + `requireOrganizationMembership` | |
| `initializeOrganizationSubscription(orgId)` | Mutation | `requireAuth` + `requireOrganizationMembership` + `member.role === 'owner'` | Org owner only. |

---

### `resolvers/templates.ts` — Form Templates

| Operation | Type | Guard | Notes |
|-----------|------|-------|-------|
| `templates(category)` | Query | `requireAuthentication` | Any authenticated user can browse. |
| `template(id)` | Query | `requireAuthentication` | |
| `templatesByCategory` | Query | `requireAuthentication` | |
| `templateCategories` | Query | `requireAuthentication` | |
| `createTemplate(input)` | Mutation | `requireSystemLevelRole` (`admin`/`superAdmin`) | |
| `updateTemplate(id, input)` | Mutation | `requireSystemLevelRole` | |
| `deleteTemplate(id)` | Mutation | `requireSystemLevelRole` | |
| `createFormFromTemplate(templateId, orgId, title)` | Mutation | `requireAuthentication` + `requireOrganizationMembership` | |

---

### `resolvers/unifiedExport.ts` — Excel / CSV Export

| Operation | Type | Guard | Notes |
|-----------|------|-------|-------|
| `generateFormResponseReport(formId, format, filters)` | Mutation | `requireAuth` + `checkFormAccess(EDITOR)` | Max 50,000 rows. VIEWER cannot bulk-export PII. |

---

## REST Endpoints

### `POST /upload` — File Upload

Authentication and authorisation vary by `type` parameter.

| `type` value | Auth Required | Additional Check |
|--------------|---------------|-----------------|
| `FormTemplate` | Yes | `user.role === 'admin' \| 'superAdmin'` |
| `FormBackground` | Yes | `form.createdById === userId` OR explicit `EDITOR`/`OWNER` permission OR `member.role === 'owner'` |
| `UserAvatar` | Yes | None — associated to calling user automatically |
| `OrganizationLogo` | Yes | Org membership check |
| `FormResponse` | Conditional | Unauthenticated allowed only if `form.isPublished`. Authenticated bypass: form creator OR `EDITOR`/`OWNER` permission OR `member.role === 'owner'`. |

Upload type values are validated against a strict allowlist (`FormTemplate`, `FormBackground`, `UserAvatar`, `OrganizationLogo`, `FormResponse`). Unknown types are rejected with `400`.

---

### `POST /webhooks/chargebee` — Chargebee Billing Webhooks

| Check | Behaviour |
|-------|-----------|
| `CHARGEBEE_WEBHOOK_PASSWORD` not set | **Fail-closed** — rejects all requests with `401`. |
| Invalid or missing `Authorization` header | `401 Unauthorized` |
| Valid Basic Auth password | `200` — event is processed |

Uses `crypto.timingSafeEqual` for constant-time password comparison (prevents timing attacks).

---

### `GET /health` — Health Check

Public. No authentication required.

---

### `GET /debug` — Debug Info

Public. No authentication required. Should be disabled or protected in production.

---

### `/api/auth/*` — Better-Auth Handlers

Managed by the `better-auth` library. Routes include sign-in, sign-up, email OTP, password reset, and organisation management. Auth plugin enforces role checks (org `owner` required for invite/remove member operations).

---

## Quick Reference Matrix

| What you want to do | Minimum requirement |
|---------------------|---------------------|
| View a published form | **PUBLIC** |
| Submit a response | **PUBLIC** |
| View form analytics (aggregate) | Org member |
| View field analytics | Org member + VIEWER on form |
| View responses | Org member + VIEWER on form |
| Edit a response | Org member + EDITOR on form |
| Export responses (Excel/CSV) | EDITOR on form |
| Edit form schema | EDITOR on form |
| Manage plugins | OWNER on form |
| Change sharing settings | OWNER on form |
| Delete a response | OWNER on form |
| Delete a form | OWNER on form |
| Manage org members / invites | Org `owner` role |
| Manage billing subscription | Org `owner` role |
| Manage templates | `admin` or `superAdmin` system role |
| View platform admin data | `admin` or `superAdmin` system role |
