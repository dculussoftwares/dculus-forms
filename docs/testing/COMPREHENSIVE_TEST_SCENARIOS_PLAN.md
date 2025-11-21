# Comprehensive Integration Test Scenarios Plan

## Executive Summary

This document outlines a comprehensive testing plan for the dculus-forms application covering all GraphQL mutations, queries, and business scenarios. The plan is designed to achieve 80%+ code coverage through systematic integration testing.

## Business Understanding

**dculus-forms** is a multi-tenant form builder SaaS application with the following core capabilities:

- **Form Creation & Management**: Collaborative form building with real-time editing (YJS/Hocuspocus)
- **Response Collection**: Form submissions with analytics tracking
- **Multi-tenancy**: Organization-based isolation with role-based access control
- **Plugin System**: Extensible event-driven architecture (webhooks, emails, quiz auto-grading)
- **Analytics**: Form view/submission tracking with detailed field-level analytics
- **Permissions**: Granular sharing permissions (OWNER, EDITOR, VIEWER)
- **Admin Dashboard**: System-wide administration for admins and super admins
- **Templates**: Reusable form templates with background image support

---

## Test Coverage Matrix

### GraphQL API Coverage

| Resolver File | Queries | Mutations | Test Priority |
|--------------|---------|-----------|---------------|
| forms.ts | 2 | 5 | 🔥 CRITICAL |
| responses.ts | 4 | 3 | 🔥 CRITICAL |
| formSharing.ts | 3 | 3 | 🔥 CRITICAL |
| plugins.ts | 3 | 4 | 🔥 CRITICAL |
| analytics.ts | 2 | 3 | 🟡 HIGH |
| fieldAnalytics.ts | 2 | 0 | 🟡 HIGH |
| templates.ts | 4 | 3 | 🟡 HIGH |
| admin.ts | 5 | 0 | 🟡 MEDIUM |
| invitations.ts | 1 | 0 | 🟡 MEDIUM |
| fileUpload.ts | - | - | 🟢 LOW |
| unifiedExport.ts | - | - | 🟢 LOW |

**Total Coverage Required:**
- **26 Queries** across 9 resolvers
- **21 Mutations** across 6 resolvers
- **47 Total GraphQL Operations** to test

---

## Phase-by-Phase Test Scenarios

### Phase 1: Authentication & Organization Management ✅ COMPLETED

#### 1.1 Account Creation (6 scenarios) ✅
- ✅ Successful account creation with valid credentials
- ✅ Invalid email format validation
- ✅ Weak password validation
- ✅ Duplicate email detection
- ✅ Missing required fields validation
- ✅ Special characters in name handling

#### 1.2 Organization Management
**Status**: ⏳ PLANNED

**Scenarios:**
1. **Create organization as authenticated user**
   - User creates first organization → becomes owner
   - User creates second organization (up to limit)
   - Verify organization slug generation

2. **Organization member management**
   - Invite user to organization
   - Accept invitation and join organization
   - Change member role (member → owner, owner → member)
   - Remove member from organization

3. **Organization access control**
   - Switch active organization in session
   - Verify data isolation between organizations
   - Attempt to access another organization's data (should fail)

---

### Phase 2: Form Operations & Management 🔥 CRITICAL

#### 2.1 Form CRUD Operations (`forms.ts`)

**Queries:**
- `form(id: String!)`
- `formByShortUrl(shortUrl: String!)`

**Mutations:**
- `createForm`
- `updateForm`
- `deleteForm`
- `regenerateShortUrl`
- `duplicateForm`

**Test Scenarios (15 scenarios):**

1. **Create form from template**
   - User creates form from "Contact Form" template
   - Verify form schema matches template
   - Verify background image is copied (not shared with template)
   - Verify form is not published by default
   - Verify shortUrl is generated
   - Verify YJS collaborative document is initialized

2. **Create form with custom schema**
   - Create form with 3 pages and 10 fields
   - Verify all field types are supported
   - Verify field validation rules are preserved

3. **Query form by ID**
   - Owner queries their form → success
   - Editor queries shared form → success
   - Viewer queries shared form → success
   - Non-member queries form → access denied

4. **Query form by shortUrl (public access)**
   - Published form → returns form data
   - Unpublished form → error "Form is not published"
   - Form with submission limit reached → error "maximum response limit"
   - Form outside time window → error "not yet open" or "submission period has ended"

5. **Update form title and description**
   - Owner updates → success
   - Editor updates → success
   - Viewer updates → access denied (needs EDITOR)

6. **Update form - publish/unpublish**
   - Owner publishes form → isPublished = true
   - Editor attempts to publish → access denied (needs OWNER)
   - Owner unpublishes form → isPublished = false

7. **Update form settings (submission limits)**
   - Set max responses limit (e.g., 100)
   - Set time window (startDate, endDate)
   - Enable custom thank you message with @ mentions

8. **Update form - change organizationId (should fail)**
   - Attempt to move form to different organization → error

9. **Update form - change createdById (should fail)**
   - Attempt to change ownership via update → error

10. **Duplicate form with responses**
    - Form has 50 responses
    - Editor duplicates form
    - New form has same schema
    - New form has 0 responses
    - New form gets new shortUrl
    - Background images are copied

11. **Regenerate short URL**
    - Owner regenerates URL → new shortUrl generated
    - Editor attempts to regenerate → access denied (needs OWNER)
    - Old shortUrl no longer works

12. **Delete form**
    - Owner deletes form with 100 responses
    - Verify all responses are deleted (cascade)
    - Verify YJS document is deleted
    - Verify form files are deleted
    - Editor attempts to delete → access denied (needs OWNER)

13. **Form metadata resolver**
    - Query form metadata (pageCount, fieldCount, backgroundImageUrl)
    - Verify CDN URLs are constructed correctly

14. **Form schema from YJS**
    - Query form with collaborative edits
    - Verify formSchema returns latest YJS state
    - Verify schema matches Hocuspocus document

15. **Form dashboard stats**
    - Query dashboardStats field
    - Verify responsesToday, responsesThisWeek, responsesThisMonth
    - Verify averageCompletionTime calculation
    - Verify responseRate calculation (responses / views)

---

#### 2.2 Form Sharing & Permissions (`formSharing.ts`)

**Queries:**
- `formPermissions(formId: String!)`
- `forms(organizationId: String!, category: String!, page: Int, limit: Int, filters: FiltersInput)`
- `organizationMembers(organizationId: String!)`

**Mutations:**
- `shareForm`
- `updateFormPermission`
- `removeFormAccess`

**Test Scenarios (12 scenarios):**

1. **Share form with specific users (SPECIFIC_MEMBERS scope)**
   - Owner shares form with user1 (VIEWER)
   - Owner shares form with user2 (EDITOR)
   - Verify permissions are created in database
   - user1 can view, cannot edit
   - user2 can view and edit, cannot delete

2. **Share form with all organization members (ALL_ORG_MEMBERS scope)**
   - Owner sets scope to ALL_ORG_MEMBERS with VIEWER as default
   - All members can view the form
   - Members cannot edit (need explicit permission)

3. **Update permission level**
   - Change user1 from VIEWER to EDITOR
   - Verify user1 can now edit
   - Change user2 from EDITOR to VIEWER
   - Verify user2 can no longer edit

4. **Remove form access**
   - Owner removes user1's access
   - Verify user1 can no longer view form
   - Attempt to remove owner's access → error "Cannot remove access from form owner"

5. **Share form with user outside organization (should fail)**
   - Attempt to grant permission to non-member → error

6. **Query formPermissions**
   - Owner queries → sees all permissions
   - Editor queries → sees all permissions
   - Viewer queries → access denied (needs EDITOR)

7. **Query forms by category (OWNER)**
   - Query category=OWNER → returns only forms created by user
   - Verify pagination works (page=1, limit=10)
   - Verify search filter works (title/description contains)

8. **Query forms by category (SHARED)**
   - Query category=SHARED → returns forms shared with user (not created by)
   - Verify explicit permissions included
   - Verify ALL_ORG_MEMBERS forms included

9. **Query forms by category (ALL)**
   - Query category=ALL → returns OWNER + SHARED
   - Verify pagination and search work

10. **Query organizationMembers**
    - Member queries → returns all organization members
    - Non-member queries → access denied
    - Verify members are sorted by name

11. **Permission level checks**
    - VIEWER tries to edit → denied
    - VIEWER tries to delete → denied
    - VIEWER tries to configure plugins → denied
    - EDITOR tries to delete → denied
    - EDITOR tries to publish → denied
    - OWNER can do everything

12. **Form category field resolver**
    - Form created by user → category = "OWNER"
    - Form shared with user → category = "SHARED"

---

### Phase 3: Response Collection & Management 🔥 CRITICAL

#### 3.1 Response Operations (`responses.ts`)

**Queries:**
- `responses(organizationId: String!)`
- `response(id: String!)`
- `responsesByForm(formId: String!, page: Int, limit: Int, sortBy: String, sortOrder: String, filters: [FilterInput])`
- `responseEditHistory(responseId: String!)`

**Mutations:**
- `submitResponse`
- `updateResponse`
- `deleteResponse`

**Test Scenarios (18 scenarios):**

1. **Submit response to published form**
   - Form is published
   - Submit response with all field types populated
   - Verify response is saved
   - Verify analytics tracking is triggered
   - Verify plugin events are emitted (form.submitted)
   - Verify subscription events are emitted (usage tracking)
   - Verify custom thank you message with @ mentions

2. **Submit response - required field validation**
   - Submit response missing required field → error

3. **Submit response to unpublished form (should fail)**
   - Form is not published
   - Submit response → error "Form is not published"

4. **Submit response - submission limit exceeded**
   - Form has maxResponses = 10
   - 10 responses already exist
   - Submit 11th response → error "maximum response limit"

5. **Submit response - outside time window**
   - Form has startDate in future
   - Submit response → error "not yet open for submissions"
   - Form has endDate in past
   - Submit response → error "submission period has ended"

6. **Submit response - subscription limit exceeded**
   - Organization subscription plan allows 100 submissions/month
   - 100 submissions already made
   - Submit 101st response → error "submission limit exceeded for subscription plan"

7. **Submit response with analytics tracking**
   - Include sessionId, userAgent, timezone, language, completionTimeSeconds
   - Verify FormSubmissionAnalytics record created
   - Verify IP geolocation parsed correctly
   - Verify browser/OS detection works

8. **Query responses by organizationId**
   - Member queries → returns all responses for organization forms
   - Non-member queries → access denied

9. **Query response by ID**
   - Form owner queries → success
   - Organization member queries → success
   - Non-member queries → error

10. **Query responsesByForm with pagination**
    - Form has 1000 responses
    - Query page=1, limit=100 → returns first 100
    - Verify totalCount = 1000
    - Verify hasNextPage = true

11. **Query responsesByForm with sorting**
    - sortBy="submittedAt", sortOrder="desc" → newest first
    - sortBy="submittedAt", sortOrder="asc" → oldest first

12. **Query responsesByForm with filters**
    - Filter by field value (e.g., field_email contains "@gmail.com")
    - Filter by date range (submittedAt between)
    - Verify filtering works correctly

13. **Update response (edit existing)**
    - Owner edits response data
    - Provide editReason: "Correcting typo"
    - Verify ResponseEdit record created with field-level changes
    - Verify IP address and userAgent captured
    - Verify previous values are preserved

14. **Update response - permission check**
    - Non-member attempts to edit → access denied
    - Member not in organization attempts to edit → access denied

15. **Delete response**
    - Owner deletes response → success
    - Editor attempts to delete → access denied (needs OWNER)
    - Verify response is deleted from database

16. **Query response edit history**
    - Response has been edited 3 times
    - Query editHistory → returns all 3 edits with field-level changes
    - Verify editedBy user information is included
    - Verify editReason is included

17. **Response field resolvers (edit tracking)**
    - hasBeenEdited → true if edited, false if not
    - totalEdits → count of edits
    - lastEditedAt → timestamp of most recent edit
    - lastEditedBy → user who made last edit

18. **Response metadata (quiz grading)**
    - Submit response to quiz form
    - Quiz auto-grading plugin executes
    - Query response.metadata → includes quiz-grading results
    - Verify quizScore, totalMarks, percentage, result (PASS/FAIL)

---

### Phase 4: Plugin System 🔥 CRITICAL

#### 4.1 Plugin Operations (`plugins.ts`)

**Queries:**
- `formPlugins(formId: String!)`
- `formPlugin(id: String!)`
- `pluginDeliveries(pluginId: String!, limit: Int)`

**Mutations:**
- `createFormPlugin`
- `updateFormPlugin`
- `deleteFormPlugin`
- `testFormPlugin`

**Test Scenarios (20 scenarios):**

1. **Create webhook plugin**
   - Editor creates webhook plugin
   - Config: { url: "https://example.com/webhook", headers: {...} }
   - Events: ["form.submitted"]
   - enabled: true
   - Verify plugin is created

2. **Create email plugin**
   - Owner creates email plugin
   - Config: { recipient: "@email", subject: "...", body: "..." }
   - Events: ["form.submitted"]
   - Verify @ mention field reference works

3. **Create quiz auto-grading plugin**
   - Owner creates quiz-grading plugin
   - Config: { questions: [{fieldId, correctAnswer, marks}], passThreshold: 60 }
   - Verify plugin is created

4. **Create plugin - permission check**
   - Viewer attempts to create plugin → access denied (needs EDITOR)

5. **Create plugin - invalid events**
   - Attempt to create plugin with event "invalid.event"
   - Error: "Invalid event types"

6. **Query formPlugins**
   - Form has 3 plugins (webhook, email, quiz)
   - Viewer queries → returns all 3 plugins
   - Non-member queries → access denied

7. **Query formPlugin by ID**
   - Editor queries → returns plugin details
   - Non-member queries → access denied

8. **Update plugin config**
   - Update webhook URL
   - Update email recipient
   - Update quiz correct answers
   - Verify updatedAt timestamp changes

9. **Update plugin enabled status**
   - Disable plugin (enabled: false)
   - Plugin no longer executes on events
   - Re-enable plugin (enabled: true)

10. **Update plugin - permission check**
    - Viewer attempts to update → access denied (needs EDITOR)

11. **Delete plugin**
    - Editor deletes plugin
    - Verify plugin is deleted
    - Verify associated deliveries are cascade deleted

12. **Delete plugin - permission check**
    - Viewer attempts to delete → access denied (needs EDITOR)

13. **Test plugin (webhook)**
    - Editor triggers testFormPlugin
    - Verify "plugin.test" event is emitted
    - Verify webhook is delivered with test payload
    - Query pluginDeliveries → verify test delivery record

14. **Test plugin (email)**
    - Trigger testFormPlugin for email
    - Verify email is sent (check mock SMTP server)
    - Verify delivery status is "sent"

15. **Webhook plugin execution on form submission**
    - Form has webhook plugin
    - Submit response
    - Verify webhook HTTP POST is sent
    - Verify payload includes formId, responseId, submittedAt, data
    - Verify response.metadata includes webhook delivery status

16. **Webhook plugin retry on failure**
    - Webhook endpoint returns 500 error
    - Verify plugin retries 3 times with exponential backoff
    - Verify delivery status is "failed" after max retries

17. **Email plugin execution with @ mentions**
    - Form has email field with id "field_email"
    - Email plugin recipient: "@field_email"
    - Submit response with email = "user@example.com"
    - Verify email is sent to user@example.com

18. **Quiz auto-grading plugin execution**
    - Quiz has 5 questions, 10 total marks, 60% pass threshold
    - Submit response with 4/5 correct (8/10 marks = 80%)
    - Verify response.metadata contains quiz-grading results
    - Verify result = "PASS"
    - Submit response with 2/5 correct (4/10 marks = 40%)
    - Verify result = "FAIL"

19. **Multiple plugins execute in sequence**
    - Form has webhook + email + quiz plugins
    - Submit response
    - Verify all 3 plugins execute
    - Verify each plugin's metadata is in response.metadata

20. **Query plugin deliveries**
    - Plugin has executed 10 times
    - Query pluginDeliveries(limit: 5) → returns last 5 deliveries
    - Verify delivery records include: deliveredAt, status, payload, response

---

### Phase 5: Analytics System 🟡 HIGH

#### 5.1 Form Analytics (`analytics.ts`)

**Queries:**
- `formAnalytics(formId: String!, timeRange: TimeRangeInput)`
- `formSubmissionAnalytics(formId: String!, timeRange: TimeRangeInput)`

**Mutations:**
- `trackFormView`
- `updateFormStartTime`
- `trackFormSubmission`

**Test Scenarios (12 scenarios):**

1. **Track form view (anonymous)**
   - Form is published
   - Track view with sessionId, userAgent, timezone, language
   - Verify FormViewAnalytics record created
   - Verify IP geolocation parsing (countryCode, regionCode, city)
   - Verify browser/OS detection (Chrome, Windows, etc.)
   - Verify subscription event emitted for usage tracking

2. **Track form view - unpublished form (should fail)**
   - Form is not published
   - Attempt to track view → error "Form is not published"

3. **Track form view - session deduplication**
   - Same sessionId views form 3 times
   - Verify uniqueSessions = 1 in analytics

4. **Update form start time**
   - User opens form at T1, starts filling at T2
   - updateFormStartTime with startedAt = T2
   - Used for accurate completion time calculation

5. **Track form submission**
   - Include completionTimeSeconds (time to fill form)
   - Verify FormSubmissionAnalytics record created
   - Verify analytics includes all browser/geo data

6. **Query formAnalytics - basic stats**
   - Form has 1000 views, 200 submissions, 150 unique sessions
   - Query formAnalytics
   - Verify totalViews = 1000
   - Verify uniqueSessions = 150
   - Verify response rate = 20%

7. **Query formAnalytics - top countries**
   - Views from USA (500), Canada (300), UK (200)
   - Verify topCountries array
   - Verify ISO 3-letter codes (USA, CAN, GBR)
   - Verify percentages calculated correctly

8. **Query formAnalytics - top operating systems**
   - Views from Windows (600), macOS (300), Linux (100)
   - Verify topOperatingSystems array with counts and percentages

9. **Query formAnalytics - top browsers**
   - Views from Chrome (700), Firefox (200), Safari (100)
   - Verify topBrowsers array with counts and percentages

10. **Query formAnalytics with time range**
    - timeRange: { start: "2024-01-01", end: "2024-01-31" }
    - Verify only analytics within date range are included

11. **Query formSubmissionAnalytics**
    - Verify totalSubmissions count
    - Verify averageCompletionTime calculation
    - Verify geographic distribution of submissions
    - Verify submission trends over time

12. **Analytics permission check**
    - Member queries analytics → success
    - Non-member queries analytics → access denied

---

#### 5.2 Field-Level Analytics (`fieldAnalytics.ts`)

**Queries:**
- `fieldAnalytics(formId: String!, fieldId: String!)`
- `allFieldsAnalytics(formId: String!)`

**Test Scenarios (14 scenarios):**

1. **Text field analytics**
   - Field has 100 text responses
   - Verify averageLength, minLength, maxLength
   - Verify wordCloud (word frequency)
   - Verify lengthDistribution (bucketed by length)
   - Verify commonPhrases (2-3 word phrases)
   - Verify recentResponses (last 10)

2. **Number field analytics**
   - Field has 100 numeric responses
   - Verify min, max, average, median, standardDeviation
   - Verify distribution (histogram buckets)
   - Verify percentiles (25th, 50th, 75th)
   - Verify trend (increasing/decreasing/stable)

3. **Select field analytics (single)**
   - Field has options: ["Option A", "Option B", "Option C"]
   - 50 responses: 30 chose A, 15 chose B, 5 chose C
   - Verify options array with counts and percentages
   - Verify topOption = "Option A"
   - Verify responseDistribution

4. **Radio field analytics**
   - Similar to select field
   - Verify single-choice analytics

5. **Checkbox field analytics (multiple selection)**
   - Field has options: ["Red", "Green", "Blue"]
   - Verify individualOptions (each option's selection count)
   - Verify combinations (which options are selected together)
   - Verify averageSelections (avg number of options selected)
   - Verify correlations (option pairs frequently selected together)

6. **Date field analytics**
   - Field has 100 date responses
   - Verify earliestDate, latestDate, mostCommonDate
   - Verify weekdayDistribution (Mon-Sun counts)
   - Verify monthlyDistribution (Jan-Dec counts)
   - Verify seasonalPatterns (Winter/Spring/Summer/Fall)

7. **Email field analytics**
   - Field has 100 email responses
   - 95 valid, 5 invalid
   - Verify validationRate = 95%
   - Verify domains array (gmail.com: 40, yahoo.com: 20, ...)
   - Verify topLevelDomains (.com: 80, .org: 15, ...)
   - Verify corporateVsPersonal split
   - Verify popularProviders (Gmail, Yahoo, Outlook)

8. **Field analytics - unsupported field type**
   - Query analytics for FileUploadField
   - Error: "Analytics not supported for field type"

9. **Field analytics - field not found**
   - Query analytics for non-existent fieldId
   - Error: "Field not found"

10. **Field analytics - permission check**
    - Member queries → success
    - Non-member queries → access denied

11. **Field analytics - get from YJS document**
    - Form schema is in collaborative document
    - Field is in YJS state
    - Verify field info is retrieved from Hocuspocus
    - Fallback to database if YJS not available

12. **Query allFieldsAnalytics**
    - Form has 10 fields
    - Query allFieldsAnalytics
    - Verify analytics for all fields returned
    - Verify summary stats (totalResponses per field)

13. **Field analytics response rate**
    - Form has 100 submissions
    - Field has 80 responses (20 skipped optional field)
    - Verify responseRate = 80%

14. **Field analytics trend detection**
    - Number field shows increasing trend over time
    - Verify trend = "increasing"
    - Select field shows option preference shift
    - Verify trend data

---

### Phase 6: Templates System 🟡 HIGH

#### 6.1 Template Operations (`templates.ts`)

**Queries:**
- `templates(category: String)`
- `template(id: String!)`
- `templatesByCategory`
- `templateCategories`

**Mutations:**
- `createTemplate` (admin only)
- `updateTemplate` (admin only)
- `deleteTemplate` (admin only)
- `createFormFromTemplate`

**Test Scenarios (10 scenarios):**

1. **Query all templates**
   - Any authenticated user can query
   - Returns all active templates
   - Verify template structure (name, description, category, formSchema)

2. **Query templates by category**
   - Query category="Contact" → returns contact form templates
   - Query category="Survey" → returns survey templates

3. **Query template by ID**
   - Authenticated user queries specific template
   - Returns template details including formSchema

4. **Query templates by category (grouped)**
   - Query templatesByCategory
   - Returns array of { category, templates[] }
   - Verify all categories are included

5. **Query template categories**
   - Returns list of available categories
   - e.g., ["Contact", "Survey", "Registration", "Feedback"]

6. **Create template (admin only)**
   - Admin creates new template
   - Provide name, description, category, formSchema
   - Verify template is created
   - Non-admin attempts → access denied

7. **Update template (admin only)**
   - Admin updates template name, description, category
   - Admin updates formSchema
   - Admin toggles isActive
   - Non-admin attempts → access denied

8. **Delete template (admin only)**
   - Admin deletes template
   - Verify template is deleted
   - Non-admin attempts → access denied

9. **Create form from template**
   - User creates form from template
   - Verify user is member of target organization
   - Verify form schema matches template
   - Verify background image is copied (unique key per form)
   - Verify FormFile record created for background
   - Verify YJS document initialized

10. **Create form from template - background image handling**
    - Template has background image in "templateDirectory"
    - Form creation copies image to "forms/{orgId}/{formId}/"
    - Verify backgroundImageKey updated in form schema
    - Verify template image is not modified

---

### Phase 7: Admin Operations 🟡 MEDIUM

#### 7.1 Admin Queries (`admin.ts`)

**Queries:**
- `adminOrganizations(limit: Int, offset: Int)`
- `adminOrganization(id: String!)`
- `adminStats`
- `adminUsers(page: Int, limit: Int, search: String)`
- `adminUserById(id: String!)`
- `adminOrganizationById(id: String!)`

**Test Scenarios (12 scenarios):**

1. **Admin organizations list**
   - Admin queries adminOrganizations
   - Returns organizations with member and form counts
   - Verify pagination (limit, offset)
   - Verify total count and hasMore flag
   - Non-admin attempts → access denied

2. **Admin organization details**
   - Admin queries adminOrganization(id)
   - Returns detailed organization info
   - Includes members array with user details
   - Includes forms array
   - Verify memberCount and formCount

3. **Admin system statistics**
   - Admin queries adminStats
   - Verify organizationCount, userCount, formCount, responseCount
   - Verify S3 storage stats (storageUsed, fileCount)
   - Verify MongoDB stats (mongoDbSize, mongoCollectionCount)

4. **Admin users list with pagination**
   - Admin queries adminUsers(page=1, limit=20)
   - Returns users with organization membership
   - Verify pagination metadata (totalCount, currentPage, totalPages)

5. **Admin users search**
   - Admin queries adminUsers(search="john")
   - Returns users with name or email containing "john"
   - Case-insensitive search

6. **Admin user details by ID**
   - Admin queries adminUserById(id)
   - Returns user with all organization memberships
   - Includes role for each organization

7. **Admin organization details by ID**
   - Admin queries adminOrganizationById(id)
   - Returns detailed org info with members and stats
   - Includes totalForms and totalResponses

8. **Admin role validation (admin)**
   - User with role="admin" can access admin queries
   - Verify all admin operations work

9. **Admin role validation (superAdmin)**
   - User with role="superAdmin" can access admin queries
   - Same permissions as admin

10. **Admin role validation (user)**
    - User with role="user" attempts admin query
    - Error: "Admin privileges required"

11. **Cross-organization data access (admin)**
    - Admin can view forms from any organization
    - Admin can view responses from any organization
    - Admin cannot edit/delete (read-only access)

12. **Storage statistics calculation**
    - Verify S3 storage calculation includes all files
    - Verify byte formatting (B, KB, MB, GB, TB)
    - Verify MongoDB collection count is accurate

---

### Phase 8: Real-Time Collaboration (YJS/Hocuspocus) 🟢 LOW

#### 8.1 Collaborative Editing

**Test Scenarios (8 scenarios):**

1. **Two users connect to same form**
   - User1 and User2 connect to collaborative document
   - Verify awareness shows 2 connected users

2. **Concurrent field addition**
   - User1 adds TextInputField to page 1
   - User2 adds EmailField to page 1 simultaneously
   - Verify both fields are added without conflict
   - Verify CRDT conflict resolution

3. **Concurrent field edits (different fields)**
   - User1 edits field1 label
   - User2 edits field2 label simultaneously
   - Verify both edits succeed
   - Verify document consistency

4. **Field deletion synchronization**
   - User1 deletes field3
   - Verify User2 sees deletion within 1 second

5. **Page reordering synchronization**
   - User1 reorders pages [1,2,3] → [3,1,2]
   - Verify User2 sees new order

6. **Layout changes propagation**
   - User1 changes theme to "dark"
   - Verify User2 sees theme change

7. **Document persistence to MongoDB**
   - User makes changes and disconnects
   - New user connects 5 minutes later
   - Verify changes are persisted and loaded

8. **WebSocket authentication**
   - Connect with valid bearer token → success
   - Connect with invalid token → connection rejected

---

### Phase 9: Security & Edge Cases 🔥 CRITICAL

#### 9.1 Permission Enforcement

**Test Scenarios (15 scenarios):**

1. **VIEWER cannot edit form**
   - VIEWER attempts updateForm → access denied

2. **VIEWER cannot delete form**
   - VIEWER attempts deleteForm → access denied

3. **VIEWER cannot configure plugins**
   - VIEWER attempts createFormPlugin → access denied

4. **EDITOR can edit but not delete**
   - EDITOR updateForm → success
   - EDITOR deleteForm → access denied

5. **EDITOR cannot publish form**
   - EDITOR attempts updateForm(isPublished: true) → access denied

6. **OWNER can perform all actions**
   - Verify all mutations work for OWNER

7. **Non-organization member cannot access form**
   - User from different organization queries form → access denied

8. **Cannot share form with user outside organization**
   - Attempt to grant permission to non-member → error

9. **Cannot change form ownership through update**
   - Attempt updateForm(createdById: "other") → error

10. **Cannot transfer form to different organization**
    - Attempt updateForm(organizationId: "other") → error

11. **Organization data isolation**
    - User in Org A cannot see forms from Org B
    - User in Org A cannot see responses from Org B

12. **Admin read-only access**
    - Admin can view cross-org data
    - Admin cannot modify data from other orgs

13. **Form IDs are UUIDs (not sequential)**
    - Create 10 forms
    - Verify all IDs are UUIDs
    - Verify IDs are not predictable

14. **Short URLs don't expose form IDs**
    - Published form gets short URL (8-12 chars)
    - Short URL does not contain form ID
    - Short URL is random

15. **Error messages don't leak data**
    - Query non-existent form → "Form not found" (not "Invalid UUID")
    - Query form without access → "Form not found" (not "Permission denied")

---

#### 9.2 Data Validation & Edge Cases

**Test Scenarios (10 scenarios):**

1. **Invalid GraphQL query syntax**
   - Send malformed query → GraphQL validation error

2. **Missing required mutation fields**
   - createForm without title → error

3. **Type validation errors**
   - Provide string where number expected → type error

4. **Submission limit edge case**
   - maxResponses = 10, currentCount = 9
   - Submit 2 responses concurrently
   - Only 1 should succeed (race condition handling)

5. **Time window edge case**
   - Form opens at midnight (00:00:00)
   - Submit response at 23:59:59 (before opening) → error
   - Submit response at 00:00:01 (after opening) → success

6. **Large form schema**
   - Create form with 50 fields across 10 pages
   - Verify schema size is reasonable (<1MB)
   - Verify form loads and saves correctly

7. **Pagination boundary**
   - 1000 responses, limit=100
   - Query page=10 (last page)
   - Verify hasNextPage = false

8. **Analytics with no data**
   - Query analytics for form with 0 views
   - Verify graceful handling (empty arrays, 0 counts)

9. **Plugin execution failure doesn't block submission**
   - Webhook plugin times out
   - Verify response still saved
   - Verify error logged but not thrown

10. **Database connection failure simulation**
    - Simulate DB connection loss
    - Verify graceful error handling
    - Verify appropriate error message to user

---

### Phase 10: Performance & Load Testing 🟢 LOW

**Test Scenarios (8 scenarios):**

1. **Form with 50+ fields**
   - Create and load form with 50 fields
   - Verify load time < 2 seconds

2. **1000+ response submissions**
   - Submit 1000 responses via API
   - Verify submission rate > 50/second

3. **Pagination with 10,000 responses**
   - Query responses with pagination
   - Verify first page loads < 1 second

4. **Analytics aggregation with large dataset**
   - Form has 50,000 view analytics records
   - Query formAnalytics
   - Verify query completes < 3 seconds

5. **Bulk delete 100 forms**
   - Delete 100 forms
   - Verify operation completes < 10 seconds

6. **Concurrent form submissions**
   - 10 users submit simultaneously
   - Verify all submissions succeed

7. **Concurrent plugin executions**
   - 5 plugins execute on same response
   - Verify all plugins execute without blocking

8. **Database transaction isolation**
   - Concurrent updates to same form
   - Verify optimistic locking works

---

## Test Execution Summary

### Total Test Scenarios

| Phase | Scenario Count | Priority | Status |
|-------|----------------|----------|---------|
| Phase 1: Auth & Org | 6 | 🔥 CRITICAL | ✅ DONE |
| Phase 2: Forms | 15 | 🔥 CRITICAL | ⏳ PLANNED |
| Phase 2: Sharing | 12 | 🔥 CRITICAL | ⏳ PLANNED |
| Phase 3: Responses | 18 | 🔥 CRITICAL | ⏳ PLANNED |
| Phase 4: Plugins | 20 | 🔥 CRITICAL | ⏳ PLANNED |
| Phase 5: Analytics | 12 | 🟡 HIGH | ⏳ PLANNED |
| Phase 5: Field Analytics | 14 | 🟡 HIGH | ⏳ PLANNED |
| Phase 6: Templates | 10 | 🟡 HIGH | ⏳ PLANNED |
| Phase 7: Admin | 12 | 🟡 MEDIUM | ⏳ PLANNED |
| Phase 8: Collaboration | 8 | 🟢 LOW | ⏳ PLANNED |
| Phase 9: Security | 25 | 🔥 CRITICAL | ⏳ PLANNED |
| Phase 10: Performance | 8 | 🟢 LOW | ⏳ PLANNED |
| **TOTAL** | **160** | - | - |

### Coverage Goals

- **GraphQL Resolvers**: 90%+ line coverage
- **Services**: 85%+ line coverage
- **Plugin System**: 90%+ line coverage
- **Overall Backend**: 80%+ line coverage

### Implementation Approach

1. **Iterative Development**: Implement one phase at a time
2. **Feature Files**: Create `.feature` files with Gherkin scenarios
3. **Step Definitions**: Write step definitions using existing test utilities
4. **Validation**: Run tests and ensure all pass before moving to next phase
5. **Documentation**: Update test plan with completion status

### Priority Order

1. 🔥 **Phase 1**: Auth & Org (DONE)
2. 🔥 **Phase 3**: Responses (submission flow is critical)
3. 🔥 **Phase 2**: Forms & Sharing
4. 🔥 **Phase 4**: Plugins
5. 🔥 **Phase 9**: Security
6. 🟡 **Phase 5**: Analytics
7. 🟡 **Phase 6**: Templates
8. 🟡 **Phase 7**: Admin
9. 🟢 **Phase 8**: Collaboration
10. 🟢 **Phase 10**: Performance

### Test Tags Strategy

```gherkin
@Integration @Critical @Forms @Smoke
@Integration @Security @Permissions
@Integration @Plugins @Webhook
@Integration @Analytics @FieldAnalytics
@Integration @Admin
@Integration @Performance @Slow
```

### Expected Timeline

- **Phase 1**: ✅ Completed (5 days)
- **Phases 2-4**: 8-10 days (critical path)
- **Phases 5-7**: 5-7 days (high priority)
- **Phases 8-10**: 4-5 days (lower priority)
- **Total Estimate**: 22-27 days (4.5-5.5 weeks)

---

## Next Steps

1. **Immediate Next Phase**: Start with Phase 3 (Response Submissions)
2. **Create Feature File**: `test/integration/features/response-submissions.feature`
3. **Implement Step Definitions**: `test/integration/step-definitions/response-submissions.steps.ts`
4. **Add Test Utilities**: Extend `response-test-utils.ts` as needed
5. **Run and Validate**: Ensure all scenarios pass
6. **Update Progress**: Mark Phase 3 as complete and move to Phase 2

---

## Conclusion

This comprehensive test plan covers **160 integration test scenarios** across **47 GraphQL operations** (26 queries, 21 mutations). By following this plan systematically, we will achieve:

- ✅ Complete coverage of all GraphQL resolvers
- ✅ End-to-end validation of critical user journeys
- ✅ Security and permission enforcement validation
- ✅ Plugin system validation
- ✅ Analytics accuracy validation
- ✅ Performance and scalability validation
- ✅ 80%+ code coverage target

The test suite will provide confidence in the stability, security, and functionality of the dculus-forms platform.
