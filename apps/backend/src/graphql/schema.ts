import { gql } from 'graphql-tag';

export const typeDefs = gql`
  # Custom Scalars
  scalar JSON

  # Authentication Types
  type User {
    id: ID!
    name: String!
    email: String!
    emailVerified: Boolean!
    image: String
    createdAt: String!
    updatedAt: String!
    organizations: [Organization!]!
  }

  type Organization {
    id: ID!
    name: String!
    slug: String!
    logo: String
    createdAt: String!
    updatedAt: String!
    members: [Member!]!
    subscription: PlanSubscription
  }

  type Member {
    id: ID!
    user: User!
    organization: Organization!
    role: String!
    createdAt: String!
    updatedAt: String!
  }

  # Subscription Types
  type PlanSubscription {
    id: ID!
    organizationId: ID!
    chargebeeCustomerId: String!
    chargebeeSubscriptionId: String
    planId: String!
    status: SubscriptionStatus!
    viewsUsed: Int!
    submissionsUsed: Int!
    viewsLimit: Int
    submissionsLimit: Int
    currentPeriodStart: String!
    currentPeriodEnd: String!
    createdAt: String!
    updatedAt: String!
    organization: Organization!
    usage: SubscriptionUsage!
    # True only while a PAID enterprise deal is set but the customer has never
    # completed Chargebee checkout — status is 'past_due' and the org is
    # blocked. The form-app pricing/subscription UI uses this (rather than just
    # status === past_due, which is ambiguous with ordinary dunning on an
    # already-active enterprise org) to decide whether to show a "complete
    # payment" checkout link or the normal billing-portal "manage billing" flow.
    enterprisePendingActivation: Boolean!
  }

  type SubscriptionUsage {
    views: UsageInfo!
    submissions: UsageInfo!
  }

  type UsageInfo {
    used: Int!
    limit: Int
    unlimited: Boolean!
    percentage: Float
    exceeded: Boolean!
  }

  enum SubscriptionStatus {
    active
    cancelled
    expired
    past_due
  }

  # Invitation Types
  type Invitation {
    id: ID!
    email: String!
    role: String!
    status: String!
    expiresAt: String!
    createdAt: String!
    organization: Organization
    inviter: User
  }

  # Form Settings Types
  type ThankYouSettings {
    enabled: Boolean!
    message: String!
  }

  type MaxResponsesSettings {
    enabled: Boolean!
    limit: Int!
  }

  type TimeWindowSettings {
    enabled: Boolean!
    startDate: String
    endDate: String
  }

  type SubmissionLimitsSettings {
    maxResponses: MaxResponsesSettings
    timeWindow: TimeWindowSettings
  }

  type ResponseCopySettings {
    enabled: Boolean!
    mode: String!
    emailFieldId: String
    pdfTemplateId: String
    subject: String
  }

  type AccessControlSettings {
    enabled: Boolean!
    requireSignIn: Boolean!
    allowedDomains: [String!]
  }

  type FormSettings {
    thankYou: ThankYouSettings
    submissionLimits: SubmissionLimitsSettings
    responseCopy: ResponseCopySettings
    accessControl: AccessControlSettings
    collectRespondentEmail: Boolean
  }

  # Whether the current requester can see the form's real content.
  # OPEN: no access control, or access control satisfied.
  # SIGN_IN_REQUIRED: access control enabled and the requester isn't signed in.
  # DOMAIN_REJECTED: signed in, but the verified email's domain isn't allowed.
  enum FormAccessStatus {
    OPEN
    SIGN_IN_REQUIRED
    DOMAIN_REJECTED
  }

  # Form Types
  type Form {
    id: ID!
    title: String!
    description: String
    shortUrl: String!
    formSchema: JSON
    formSchemaPublic: JSON
    settings: FormSettings
    accessStatus: FormAccessStatus!
    isPublished: Boolean!
    organization: Organization!
    createdBy: User!
    responseCount: Int!
    sharingScope: SharingScope!
    defaultPermission: PermissionLevel!
    permissions: [FormPermission!]!
    userPermission: PermissionLevel
    category: FormCategory
    createdAt: String!
    updatedAt: String!
    metadata: FormMetadata
    dashboardStats: FormDashboardStats
  }

  type FormMetadata {
    pageCount: Int!
    fieldCount: Int!
    backgroundImageKey: String
    backgroundImageUrl: String
    backgroundVideoKey: String
    backgroundVideoUrl: String
    backgroundDominantColor: String
    lastUpdated: String!
  }

  type FormDashboardStats {
    averageCompletionTime: Float # Average completion time in seconds
    responseRate: Float # Response rate as percentage (0-100)
    responsesToday: Int!
    responsesThisWeek: Int!
    responsesThisMonth: Int!
    trendResponsesToday: Float # % change today vs yesterday; null = no data
    trendThisWeek: Float # % change this week vs last week; null = no data
    trendResponseRate: Float # pp delta (rateThisWeek - rateLastWeek); unlike the other trend fields this is percentage POINTS not percent change; null = <10 views in either window
  }

  # Form Sharing Types
  enum SharingScope {
    PRIVATE
    SPECIFIC_MEMBERS
    ALL_ORG_MEMBERS
  }

  enum PermissionLevel {
    OWNER
    EDITOR
    VIEWER
    NO_ACCESS
  }

  enum FormCategory {
    OWNER
    SHARED
    ALL
  }

  type FormPermission {
    id: ID!
    formId: ID!
    userId: ID!
    user: User!
    permission: PermissionLevel!
    grantedBy: User!
    grantedAt: String!
    updatedAt: String!
  }

  type FormSharingSettings {
    sharingScope: SharingScope!
    defaultPermission: PermissionLevel!
    permissions: [FormPermission!]!
  }

  type ResponseTag {
    id: ID!
    formId: ID!
    name: String!
    color: String!
    createdAt: String!
  }

  type FormResponse {
    id: ID!
    formId: ID!
    data: JSON!
    metadata: JSON
    respondentEmail: String
    submittedAt: String!
    thankYouMessage: String!
    showCustomThankYou: Boolean!
    hasBeenEdited: Boolean!
    totalEdits: Int!
    lastEditedAt: String
    lastEditedBy: User
    editHistory: [ResponseEditHistory!]!
    tags: [ResponseTag!]!
  }

  # Response Edit Tracking Types

  type ResponseEditHistory {
    id: ID!
    responseId: ID!
    editedBy: User!
    editedAt: String!
    editType: EditType!
    editReason: String
    ipAddress: String
    userAgent: String
    totalChanges: Int!
    changesSummary: String
    fieldChanges: [ResponseFieldChange!]!
  }

  type ResponseFieldChange {
    id: ID!
    fieldId: ID!
    fieldLabel: String!
    fieldType: String!
    previousValue: JSON
    newValue: JSON
    changeType: ChangeType!
    valueChangeSize: Int
  }

  enum EditType {
    MANUAL
    SYSTEM
    BULK
  }

  enum ChangeType {
    ADD
    UPDATE
    DELETE
  }

  # Template Types
  type FormTemplate {
    id: ID!
    name: String!
    description: String
    category: String
    formSchema: JSON!
    isActive: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type TemplatesByCategory {
    category: String!
    templates: [FormTemplate!]!
  }

  type PaginatedResponses {
    data: [FormResponse!]!
    total: Int!
    page: Int!
    limit: Int!
    totalPages: Int!
  }

  # Export Types
  enum ExportFormat {
    EXCEL
    CSV
  }

  type ExportResult {
    downloadUrl: String!
    expiresAt: String!
    filename: String!
    format: ExportFormat!
  }

  # Input Types
  input CreateOrganizationInput {
    name: String!
    slug: String!
  }

  input CreateFormInput {
    templateId: ID
    formSchema: JSON
    title: String!
    description: String
    organizationId: ID!
  }

  input ThankYouSettingsInput {
    enabled: Boolean!
    message: String!
  }

  input MaxResponsesSettingsInput {
    enabled: Boolean!
    limit: Int!
  }

  input TimeWindowSettingsInput {
    enabled: Boolean!
    startDate: String
    endDate: String
  }

  input SubmissionLimitsSettingsInput {
    maxResponses: MaxResponsesSettingsInput
    timeWindow: TimeWindowSettingsInput
  }

  input ResponseCopySettingsInput {
    enabled: Boolean!
    mode: String!
    emailFieldId: String
    pdfTemplateId: String
    subject: String
  }

  input AccessControlSettingsInput {
    enabled: Boolean!
    requireSignIn: Boolean!
    allowedDomains: [String!]
  }

  input FormSettingsInput {
    thankYou: ThankYouSettingsInput
    submissionLimits: SubmissionLimitsSettingsInput
    responseCopy: ResponseCopySettingsInput
    accessControl: AccessControlSettingsInput
    collectRespondentEmail: Boolean
  }

  input UpdateFormInput {
    title: String
    description: String
    settings: FormSettingsInput
    isPublished: Boolean
  }

  # Form Sharing Input Types
  input ShareFormInput {
    formId: ID!
    sharingScope: SharingScope!
    defaultPermission: PermissionLevel
    userPermissions: [UserPermissionInput!]
  }

  input UserPermissionInput {
    userId: ID!
    permission: PermissionLevel!
  }

  input UpdateFormPermissionInput {
    formId: ID!
    userId: ID!
    permission: PermissionLevel!
  }

  input SubmitResponseInput {
    formId: ID!
    data: JSON!
    # Analytics tracking data (optional for backward compatibility)
    sessionId: String
    userAgent: String
    timezone: String
    language: String
    completionTimeSeconds: Int # Time taken to complete form in seconds
    isPreview: Boolean
    sendResponseCopy: Boolean # Respondent opted in to receive a copy of their answers by email
  }

  input UpdateResponseInput {
    responseId: ID!
    data: JSON!
    editReason: String
  }

  # Response Edit Tracking Input Types

  # Template Input Types
  input CreateTemplateInput {
    name: String!
    description: String
    category: String
    formSchema: JSON!
  }

  input UpdateTemplateInput {
    name: String
    description: String
    category: String
    formSchema: JSON
    isActive: Boolean
  }

  # File Upload Types
  type FileUploadResponse {
    key: String!
    type: String!
    url: String!
    originalName: String!
    size: Int!
    mimeType: String!
  }

  input UploadFileInput {
    file: Upload!
    type: String!
    formId: ID
    organizationId: ID
  }

  # Form File Types
  type FormFile {
    id: ID!
    key: String!
    type: String!
    formId: ID!
    originalName: String!
    url: String!
    size: Int!
    mimeType: String!
    createdAt: String!
    updatedAt: String!
  }

  # Admin Types
  type AdminOrganization {
    id: ID!
    name: String!
    slug: String!
    logo: String
    createdAt: String!
    updatedAt: String!
    memberCount: Int!
    formCount: Int!
    members: [Member!]!
    forms: [Form!]!
    planId: String
    subscriptionStatus: String
    submissionsUsed: Int
    submissionsLimit: Int
  }

  type AdminOrganizationsResult {
    organizations: [AdminOrganization!]!
    total: Int!
    hasMore: Boolean!
  }

  type AdminStats {
    organizationCount: Int!
    userCount: Int!
    formCount: Int!
    responseCount: Int!
    storageUsed: String!
    fileCount: Int!
    postgresDbSize: String!
    postgresTableCount: Int!
    freePlanCount: Int!
    starterPlanCount: Int!
    advancedPlanCount: Int!
    orgsNearLimit: [OrgNearLimit!]!
  }

  type OrgNearLimit {
    orgId: String!
    orgName: String!
    submissionsUsed: Int!
    submissionsLimit: Int!
    usagePercent: Int!
  }

  # Admin Users Types
  type AdminUsersResponse {
    users: [AdminUserDetail!]!
    totalCount: Int!
    currentPage: Int!
    totalPages: Int!
  }

  type AdminUserDetail {
    id: ID!
    name: String!
    email: String!
    emailVerified: Boolean!
    image: String
    createdAt: String!
    updatedAt: String!
    organizations: [UserOrganizationMembership!]!
  }

  type UserOrganizationMembership {
    organizationId: ID!
    organizationName: String!
    organizationSlug: String
    role: String!
    createdAt: String!
  }

  type AdminOrganizationDetail {
    id: ID!
    name: String!
    slug: String
    logo: String
    createdAt: String!
    members: [OrganizationMember!]!
    stats: OrganizationStats!
    subscription: OrgSubscription
  }

  type OrganizationMember {
    userId: ID!
    userName: String!
    userEmail: String!
    userImage: String
    role: String!
    createdAt: String!
  }

  type OrganizationStats {
    totalForms: Int!
    totalResponses: Int!
  }

  type OrgSubscription {
    planId: String!
    status: String!
    viewsUsed: Int!
    submissionsUsed: Int!
    aiCreditsUsed: Float!
    viewsLimit: Int
    submissionsLimit: Int
    aiCreditsLimit: Int
    currentPeriodStart: String!
    currentPeriodEnd: String!
    chargebeeCustomerId: String!
    chargebeeSubscriptionId: String
  }

  type SystemHealthItem {
    label: String!
    status: String!
    latencyMs: Int
    detail: String
  }

  # Analytics Types
  type FormAnalytics {
    totalViews: Int!
    uniqueSessions: Int!
    topCountries: [CountryStats!]!
    topRegions: [RegionStats!]!
    topCities: [CityStats!]!
    topOperatingSystems: [OSStats!]!
    topBrowsers: [BrowserStats!]!
    viewsOverTime: [ViewsOverTimeData!]!
  }

  type ViewsOverTimeData {
    date: String!
    views: Int!
    sessions: Int!
  }

  type FormSubmissionAnalytics {
    totalSubmissions: Int!
    uniqueSessions: Int!
    averageCompletionTime: Float # Average completion time in seconds
    completionTimePercentiles: CompletionTimePercentiles
    topCountries: [CountryStats!]!
    topRegions: [RegionStats!]!
    topCities: [CityStats!]!
    topOperatingSystems: [OSStats!]!
    topBrowsers: [BrowserStats!]!
    submissionsOverTime: [SubmissionsOverTimeData!]!
    completionTimeDistribution: [CompletionTimeRange!]!
  }

  type SubmissionsOverTimeData {
    date: String!
    submissions: Int!
    sessions: Int!
  }

  type CompletionTimePercentiles {
    p50: Float # Median completion time in seconds
    p75: Float # 75th percentile in seconds
    p90: Float # 90th percentile in seconds
    p95: Float # 95th percentile in seconds
  }

  type CompletionTimeRange {
    label: String! # e.g., "0-30 seconds", "1-2 minutes"
    minSeconds: Int!
    maxSeconds: Int
    count: Int!
    percentage: Float!
  }

  type OrgDailyUsageDay {
    date: String!
    views: Int!
    submissions: Int!
  }

  type CountryStats {
    code: String
    name: String!
    count: Int!
    percentage: Float!
  }

  type RegionStats {
    name: String!
    code: String
    countryCode: String
    count: Int!
    percentage: Float!
  }

  type CityStats {
    name: String!
    region: String
    countryCode: String
    count: Int!
    percentage: Float!
  }

  # Field Analytics Types
  type FieldAnalytics {
    fieldId: ID!
    fieldType: String!
    fieldLabel: String!
    totalResponses: Int!
    responseRate: Float!
    lastUpdated: String!

    # Text field analytics
    textAnalytics: TextFieldAnalytics

    # Number field analytics
    numberAnalytics: NumberFieldAnalytics

    # Selection field analytics (Select/Radio)
    selectionAnalytics: SelectionFieldAnalytics

    # Checkbox field analytics
    checkboxAnalytics: CheckboxFieldAnalytics

    # Date field analytics
    dateAnalytics: DateFieldAnalytics

    # Email field analytics
    emailAnalytics: EmailFieldAnalytics

    # File upload field analytics
    fileUploadAnalytics: FileUploadFieldAnalytics
  }

  type TextFieldAnalytics {
    averageLength: Float!
    minLength: Int!
    maxLength: Int!
    wordCloud: [WordCloudEntry!]!
    lengthDistribution: [LengthDistribution!]!
    commonPhrases: [PhraseEntry!]!
    recentResponses: [TextResponse!]!
  }

  type WordCloudEntry {
    word: String!
    count: Int!
    weight: Float!
  }

  type LengthDistribution {
    range: String!
    count: Int!
  }

  type PhraseEntry {
    phrase: String!
    count: Int!
  }

  type TextResponse {
    value: String!
    submittedAt: String!
    responseId: ID!
  }

  type NumberFieldAnalytics {
    min: Float!
    max: Float!
    average: Float!
    median: Float!
    standardDeviation: Float!
    distribution: [NumberDistribution!]!
    trend: [NumberTrend!]!
    percentiles: NumberPercentiles!
  }

  type NumberDistribution {
    range: String!
    count: Int!
    percentage: Float!
  }

  type NumberTrend {
    date: String!
    average: Float!
    count: Int!
  }

  type NumberPercentiles {
    p25: Float!
    p50: Float!
    p75: Float!
    p90: Float!
    p95: Float!
  }

  type SelectionFieldAnalytics {
    options: [OptionStats!]!
    trend: [SelectionTrend!]!
    topOption: String!
    responseDistribution: String!
  }

  type OptionStats {
    option: String!
    count: Int!
    percentage: Float!
  }

  type SelectionTrend {
    date: String!
    options: [OptionCount!]!
  }

  type OptionCount {
    option: String!
    count: Int!
  }

  type CheckboxFieldAnalytics {
    individualOptions: [OptionStats!]!
    combinations: [CombinationStats!]!
    averageSelections: Float!
    selectionDistribution: [SelectionCountDistribution!]!
    correlations: [OptionCorrelation!]!
  }

  type CombinationStats {
    combination: [String!]!
    count: Int!
    percentage: Float!
  }

  type SelectionCountDistribution {
    selectionCount: Int!
    responseCount: Int!
    percentage: Float!
  }

  type OptionCorrelation {
    option1: String!
    option2: String!
    correlation: Float!
  }

  type DateFieldAnalytics {
    earliestDate: String!
    latestDate: String!
    mostCommonDate: String!
    dateDistribution: [DateDistribution!]!
    weekdayDistribution: [WeekdayDistribution!]!
    monthlyDistribution: [MonthlyDistribution!]!
    seasonalPatterns: [SeasonalPattern!]!
  }

  type DateDistribution {
    date: String!
    count: Int!
  }

  type WeekdayDistribution {
    weekday: String!
    count: Int!
    percentage: Float!
  }

  type MonthlyDistribution {
    month: String!
    count: Int!
    percentage: Float!
  }

  type SeasonalPattern {
    season: String!
    count: Int!
    percentage: Float!
  }

  type EmailFieldAnalytics {
    validEmails: Int!
    invalidEmails: Int!
    validationRate: Float!
    domains: [DomainStats!]!
    topLevelDomains: [TLDStats!]!
    corporateVsPersonal: CorporatePersonalBreakdown!
    popularProviders: [ProviderStats!]!
  }

  type DomainStats {
    domain: String!
    count: Int!
    percentage: Float!
  }

  type TLDStats {
    tld: String!
    count: Int!
    percentage: Float!
  }

  type CorporatePersonalBreakdown {
    corporate: Int!
    personal: Int!
    unknown: Int!
  }

  type ProviderStats {
    provider: String!
    count: Int!
    percentage: Float!
  }

  type FileUploadFieldAnalytics {
    totalFilesUploaded: Int!
    averageFilesPerResponse: Float!
    extensionDistribution: [FileExtensionStats!]!
    responsesWithFiles: Int!
    responsesWithoutFiles: Int!
  }

  type FileExtensionStats {
    extension: String!
    count: Int!
    percentage: Float!
  }

  type AllFieldsAnalytics {
    formId: ID!
    totalResponses: Int!
    fields: [FieldAnalytics!]!
  }

  type OSStats {
    name: String!
    count: Int!
    percentage: Float!
  }

  type BrowserStats {
    name: String!
    count: Int!
    percentage: Float!
  }

  # PDF Template Types (issue #87)
  type PdfTemplate {
    id: ID!
    formId: ID!
    name: String!
    template: JSON!
    fileKey: String
    fileName: String
    pageCount: Int!
    basePdfUrl: String
    createdAt: String!
    updatedAt: String!
  }

  type GeneratedPdfResult {
    downloadUrl: String!
    expiresAt: String!
    filename: String!
  }

  input CreatePdfTemplateInput {
    formId: ID!
    name: String!
    template: JSON!
    fileKey: String
    fileName: String
  }

  input UpdatePdfTemplateInput {
    name: String
    template: JSON
  }

  # PDF Generator Types — saved template+filter combos for bulk/repeatable
  # PDF generation from responses (existing and future), run in the background.
  type PdfGenerator {
    id: ID!
    formId: ID!
    templateId: ID!
    name: String!
    columnName: String
    filenameFieldId: String
    filters: JSON!
    filterLogic: FilterLogic!
    autoRunOnSubmit: Boolean!
    enabled: Boolean!
    createdAt: String!
    updatedAt: String!
    template: PdfTemplate
    latestRun: PdfGenerationRun
    matchingResponseCount: Int!
  }

  type PdfGenerationRun {
    id: ID!
    generatorId: ID!
    trigger: String!
    status: String!
    totalCount: Int!
    processedCount: Int!
    succeededCount: Int!
    failedCount: Int!
    errorMessage: String
    startedAt: String!
    completedAt: String
  }

  type PdfGenerationResult {
    id: ID!
    generatorId: ID!
    responseId: ID!
    status: String!
    filename: String
    errorMessage: String
    generatedAt: String!
    downloadUrl: String
  }

  input CreatePdfGeneratorInput {
    formId: ID!
    templateId: ID!
    name: String!
    columnName: String
    filenameFieldId: String
    filters: [ResponseFilterInput!]!
    filterLogic: FilterLogic = AND
    autoRunOnSubmit: Boolean = false
  }

  input UpdatePdfGeneratorInput {
    templateId: ID
    name: String
    columnName: String
    filenameFieldId: String
    filters: [ResponseFilterInput!]
    filterLogic: FilterLogic
    autoRunOnSubmit: Boolean
    enabled: Boolean
  }

  # Plugin System Types
  type FormPlugin {
    id: ID!
    formId: ID!
    type: String!
    name: String!
    enabled: Boolean!
    config: JSON!
    events: [String!]!
    createdAt: String!
    updatedAt: String!
  }

  type PluginDelivery {
    id: ID!
    pluginId: ID!
    eventType: String!
    status: String!
    payload: JSON!
    response: JSON
    errorMessage: String
    deliveredAt: String!
  }

  type PluginBackfillJob {
    id: ID!
    pluginId: ID!
    formId: ID!
    status: String!
    totalCount: Int!
    processedCount: Int!
    succeededCount: Int!
    failedCount: Int!
    errorMessage: String
    startedAt: String!
    completedAt: String
  }

  type PluginMutationResponse {
    success: Boolean!
    message: String!
  }

  type TrackFormViewResponse {
    success: Boolean!
  }

  # Analytics Input Types
  input TrackFormViewInput {
    formId: ID!
    sessionId: String!
    userAgent: String!
    timezone: String
    language: String
  }

  input UpdateFormStartTimeInput {
    formId: ID!
    sessionId: String!
    startedAt: String! # ISO 8601 timestamp when user started interacting with form
  }

  input TrackFormSubmissionInput {
    formId: ID!
    responseId: ID!
    sessionId: String!
    userAgent: String!
    timezone: String
    language: String
    completionTimeSeconds: Int # Time taken to complete form in seconds
  }

  input TimeRangeInput {
    start: String!
    end: String!
  }

  # Response Filter Types
  enum FilterOperator {
    EQUALS
    NOT_EQUALS
    CONTAINS
    NOT_CONTAINS
    CONTAINS_ALL
    STARTS_WITH
    ENDS_WITH
    IS_EMPTY
    IS_NOT_EMPTY
    GREATER_THAN
    GREATER_THAN_OR_EQUAL
    LESS_THAN
    LESS_THAN_OR_EQUAL
    BETWEEN
    IN
    NOT_IN
    DATE_EQUALS
    DATE_BETWEEN
    DATE_BEFORE
    DATE_AFTER
    DATE_TODAY
    DATE_LAST_N_DAYS
  }

  input DateRangeInput {
    from: String
    to: String
  }

  input NumberRangeInput {
    min: Float
    max: Float
  }

  enum FilterLogic {
    AND
    OR
  }

  input ResponseFilterInput {
    fieldId: String!
    operator: FilterOperator!
    value: String
    values: [String!]
    dateRange: DateRangeInput
    numberRange: NumberRangeInput
  }

  # Pagination Input Types
  input FormsFilterInput {
    search: String
  }

  # Paginated Forms Response
  type PaginatedForms {
    forms: [Form!]!
    totalCount: Int!
    page: Int!
    limit: Int!
    totalPages: Int!
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
  }

  # Plugin System Input Types
  input CreateFormPluginInput {
    formId: ID!
    type: String!
    name: String!
    config: JSON!
    events: [String!]!
    enabled: Boolean
  }

  input UpdateFormPluginInput {
    name: String
    config: JSON
    events: [String!]
    enabled: Boolean
  }

  type Query {
    # Auth Queries
    me: User
    activeOrganization: Organization

    # Public Queries (no auth required)
    getInvitationPublic(id: ID!): Invitation

    # Form Queries
    form(id: ID!): Form
    formByShortUrl(shortUrl: String!): Form
    responses(organizationId: ID!): [FormResponse!]!
    response(id: ID!): FormResponse
    responsesByForm(
      formId: ID!
      page: Int = 1
      limit: Int = 10
      sortBy: String = "submittedAt"
      sortOrder: String = "desc"
      filters: [ResponseFilterInput!]
      filterLogic: FilterLogic = AND
    ): PaginatedResponses!

    # Response Edit Tracking Queries
    responseEditHistory(responseId: ID!): [ResponseEditHistory!]!

    # Response Tag Queries
    formTags(formId: ID!): [ResponseTag!]!

    # Form Sharing Queries
    formPermissions(formId: ID!): [FormPermission!]!
    forms(
      organizationId: ID!
      category: FormCategory!
      page: Int = 1
      limit: Int = 10
      filters: FormsFilterInput
    ): PaginatedForms!
    organizationMembers(organizationId: ID!): [User!]!

    # Template Queries
    templates(category: String): [FormTemplate!]!
    template(id: ID!): FormTemplate
    templatesByCategory: [TemplatesByCategory!]!
    templateCategories: [String!]!

    # Form File Queries
    getFormFiles(formId: ID!, type: String): [FormFile!]!

    # Response File Download (pre-signed URL for private bucket objects)
    getResponseFileDownloadUrl(key: String!): String!

    # Admin Queries
    adminOrganizations(limit: Int, offset: Int, search: String): AdminOrganizationsResult!
    adminOrganization(id: ID!): AdminOrganization!
    adminStats: AdminStats!
    adminUsers(page: Int, limit: Int, search: String): AdminUsersResponse!
    adminUserById(id: String!): AdminUserDetail!
    adminOrganizationById(id: String!): AdminOrganizationDetail!
    adminSystemHealth: [SystemHealthItem!]!
    adminPlans: [AdminPlan!]!

    # Analytics Queries
    formAnalytics(formId: ID!, timeRange: TimeRangeInput): FormAnalytics!
    formSubmissionAnalytics(
      formId: ID!
      timeRange: TimeRangeInput
    ): FormSubmissionAnalytics!
    orgDailyUsage(organizationId: ID!, periodStart: String!, periodEnd: String!): [OrgDailyUsageDay!]!

    # Field Analytics Queries
    fieldAnalytics(formId: ID!, fieldId: ID!): FieldAnalytics!
    allFieldsAnalytics(formId: ID!): AllFieldsAnalytics!

    # Plugin Queries
    formPlugins(formId: ID!): [FormPlugin!]!
    formPlugin(id: ID!): FormPlugin
    pluginDeliveries(pluginId: ID!, limit: Int): [PluginDelivery!]!
    pluginBackfillStatus(pluginId: ID!): PluginBackfillJob

    # PDF Template Queries
    pdfTemplates(formId: ID!): [PdfTemplate!]!
    pdfTemplate(id: ID!): PdfTemplate

    # PDF Generator Queries
    pdfGenerators(formId: ID!): [PdfGenerator!]!
    pdfGenerator(id: ID!): PdfGenerator
    pdfGenerationRunStatus(generatorId: ID!): PdfGenerationRun
    pdfGenerationResult(generatorId: ID!, responseId: ID!): PdfGenerationResult
    pdfGenerationResults(generatorId: ID!): [PdfGenerationResult!]!
    previewPdfGeneratorMatchCount(formId: ID!, filters: [ResponseFilterInput!], filterLogic: FilterLogic = AND): Int!

    # Subscription Queries
    availablePlans: [AvailablePlan!]!

    # AI Queries
    aiTokenUsage(organizationId: ID!): AITokenUsage!
    listAIChatConversations(formId: ID!, organizationId: ID!): [AIChatConversation!]!
    getAIChatConversation(id: ID!, organizationId: ID!): AIChatConversation!
  }

  # Subscription Mutation Response Types
  type CheckoutSessionResponse {
    url: String!
    hostedPageId: String!
  }

  type PortalSessionResponse {
    url: String!
  }

  type SubscriptionInitResult {
    success: Boolean!
    subscription: PlanSubscription
    message: String
  }

  # Result of the post-checkout fallback sync (see syncCheckoutSession).
  # synced=true means the hosted page had already succeeded and Postgres was
  # updated immediately; synced=false means checkout hasn't completed yet
  # (still 'created'/'requested') or was cancelled — callers should keep
  # relying on webhook-driven polling in that case.
  type SyncCheckoutSessionResult {
    synced: Boolean!
    subscription: PlanSubscription
  }

  type PlanPrice {
    id: String!
    currency: String!
    amount: Int!
    period: String!
  }

  type PlanFeatures {
    views: Int
    submissions: Int
  }

  type AvailablePlan {
    id: String!
    name: String!
    description: String
    prices: [PlanPrice!]!
    features: PlanFeatures!
  }

  # Admin plan catalog types — full Chargebee catalog view (includes hidden,
  # archived, and enterprise plans). Prices are in the smallest currency unit
  # (cents/paise); null limits mean unlimited.
  type AdminPlanPrice {
    id: String!
    currency: String!
    period: String!
    priceInSmallestUnit: Int!
    status: String!
  }

  type AdminPlanLimits {
    views: Int
    submissions: Int
    aiCredits: Int
  }

  type AdminPlan {
    id: String!
    name: String!
    description: String
    status: String!
    visibleOnPricingPage: Boolean!
    prices: [AdminPlanPrice!]!
    limits: AdminPlanLimits!
    subscriberCount: Int!
  }

  input AdminPlanPriceInput {
    currency: String!
    period: String!
    priceInSmallestUnit: Int!
  }

  input AdminPlanLimitsInput {
    views: Int
    submissions: Int
    aiCredits: Int
  }

  input AdminCreatePlanInput {
    id: String!
    name: String!
    description: String
    prices: [AdminPlanPriceInput!]!
    limits: AdminPlanLimitsInput!
    visibleOnPricingPage: Boolean
  }

  input AdminUpdatePlanInput {
    id: String!
    name: String
    description: String
    prices: [AdminPlanPriceInput!]
    limits: AdminPlanLimitsInput
    visibleOnPricingPage: Boolean
  }

  # Result of setting an enterprise deal. Paid deals return a Chargebee checkout
  # URL and leave the org disabled (past_due) until the customer pays; $0 deals
  # activate immediately with no checkout.
  type EnterprisePlanResult {
    requiresPayment: Boolean!
    checkoutUrl: String
  }

  type Mutation {
    # Auth Mutations
    createOrganization(name: String!): Organization
    setActiveOrganization(organizationId: ID!): Organization
    setAccountPassword(password: String!): Boolean!

    # Subscription Mutations
    createCheckoutSession(itemPriceId: String!): CheckoutSessionResponse!
    createPortalSession: PortalSessionResponse!
    initializeOrganizationSubscription(
      organizationId: ID!
    ): SubscriptionInitResult!
    # Regenerates a fresh Chargebee checkout hosted page for the active org's
    # pending (unpaid) Enterprise deal — lets the org owner complete payment
    # themselves instead of relying solely on the admin-shared/emailed link.
    # Only valid while Subscription.enterprisePendingActivation is true.
    completeEnterprisePayment: CheckoutSessionResponse!
    # Fallback sync called from /subscription/success on redirect. Chargebee
    # appends ?id=<hostedPageId>&state=... to redirect_url — this retrieves
    # that hosted page and, if it succeeded, syncs Postgres immediately
    # instead of waiting on webhook delivery (which can be delayed, or in
    # local dev, unreachable entirely).
    syncCheckoutSession(hostedPageId: String!): SyncCheckoutSessionResult!

    # Form Mutations
    createForm(input: CreateFormInput!): Form!
    updateForm(id: ID!, input: UpdateFormInput!): Form!
    deleteForm(id: ID!): Boolean!
    regenerateShortUrl(id: ID!): Form!
    duplicateForm(id: ID!): Form!
    submitResponse(input: SubmitResponseInput!): FormResponse!
    updateResponse(input: UpdateResponseInput!): FormResponse!
    deleteResponse(id: ID!): Boolean!
    deleteResponses(formId: ID!, ids: [ID!]!): Boolean!
    deletePreviewResponses(formId: ID!): Int!
    generateFakeResponses(formId: ID!, count: Int!): Int!
    deleteAiGeneratedResponses(formId: ID!): Int!

    # Response Tag Mutations
    createTag(formId: ID!, name: String!, color: String): ResponseTag!
    deleteTag(id: ID!, formId: ID!): Boolean!
    addTagToResponse(responseId: ID!, tagId: ID!): Boolean!
    removeTagFromResponse(responseId: ID!, tagId: ID!): Boolean!

    # Form Sharing Mutations
    shareForm(input: ShareFormInput!): FormSharingSettings!
    updateFormPermission(input: UpdateFormPermissionInput!): FormPermission!
    removeFormAccess(formId: ID!, userId: ID!): Boolean!

    # Template Mutations
    createTemplate(input: CreateTemplateInput!): FormTemplate!
    updateTemplate(id: ID!, input: UpdateTemplateInput!): FormTemplate!
    deleteTemplate(id: ID!): Boolean!
    createFormFromTemplate(
      templateId: ID!
      organizationId: ID!
      title: String!
    ): Form!

    # File Upload Mutations
    uploadFile(input: UploadFileInput!): FileUploadResponse!
    deleteFile(key: String!): Boolean!

    # Export Mutations
    generateFormResponseReport(
      formId: ID!
      format: ExportFormat!
      filters: [ResponseFilterInput!]
      filterLogic: FilterLogic = AND
      ids: [ID!]
    ): ExportResult!

    # Analytics Mutations
    trackFormView(input: TrackFormViewInput!): TrackFormViewResponse!
    updateFormStartTime(
      input: UpdateFormStartTimeInput!
    ): TrackFormViewResponse!
    trackFormSubmission(
      input: TrackFormSubmissionInput!
    ): TrackFormViewResponse!

    # Plugin Mutations
    createFormPlugin(input: CreateFormPluginInput!): FormPlugin!
    updateFormPlugin(id: ID!, input: UpdateFormPluginInput!): FormPlugin!
    deleteFormPlugin(id: ID!): PluginMutationResponse!
    testFormPlugin(id: ID!): PluginMutationResponse!
    startPluginBackfill(pluginId: ID!): PluginBackfillJob!
    cancelPluginBackfill(jobId: ID!): PluginBackfillJob!

    # PDF Template Mutations
    createPdfTemplate(input: CreatePdfTemplateInput!): PdfTemplate!
    updatePdfTemplate(id: ID!, input: UpdatePdfTemplateInput!): PdfTemplate!
    deletePdfTemplate(id: ID!): Boolean!
    generatePdfFromResponse(templateId: ID!, responseId: ID!): GeneratedPdfResult!
    previewPdfTemplate(templateId: ID!, template: JSON, responseId: ID, aiSampleData: Boolean = false): GeneratedPdfResult!

    # PDF Generator Mutations
    createPdfGenerator(input: CreatePdfGeneratorInput!): PdfGenerator!
    updatePdfGenerator(id: ID!, input: UpdatePdfGeneratorInput!): PdfGenerator!
    deletePdfGenerator(id: ID!): Boolean!
    startPdfGenerationRun(generatorId: ID!): PdfGenerationRun!
    cancelPdfGenerationRun(runId: ID!): PdfGenerationRun!
    generatePdfFromGenerator(generatorId: ID!, responseId: ID!): GeneratedPdfResult!
    downloadPdfGenerationResultsZip(generatorId: ID!): GeneratedPdfResult!

    # AI Mutations
    generateFormWithAI(
      prompt: String!
      organizationId: ID!
      mode: AIFormMode = standard
    ): AIGeneratedForm!
    createAIChatConversation(formId: ID!, organizationId: ID!): AIChatConversation!
    deleteAIChatConversation(id: ID!, organizationId: ID!): Boolean!
    renameAIChatConversation(id: ID!, organizationId: ID!, title: String!): AIChatConversation!

    # Admin Mutations
    adminCreatePlan(input: AdminCreatePlanInput!): AdminPlan!
    adminUpdatePlan(input: AdminUpdatePlanInput!): AdminPlan!
    adminArchivePlan(planId: String!): Boolean!
    adminUnarchivePlan(planId: String!): Boolean!
    adminAssignPlan(orgId: ID!, planId: String!): Boolean!
    adminSetEnterprisePlan(
      orgId: ID!
      currency: String!
      period: String!
      priceInSmallestUnit: Int!
      viewsLimit: Int
      submissionsLimit: Int
      aiCreditsLimit: Int
    ): EnterprisePlanResult!
    adminResetUsage(orgId: ID!): Boolean!
    adminCancelSubscription(orgId: ID!): Boolean!
    adminReactivateSubscription(orgId: ID!): Boolean!
  }

  # AI Types
  enum AIFormMode {
    quick
    standard
    professional
  }

  type AIFieldOption {
    value: String!
    label: String!
  }

  type AIGeneratedField {
    type: String!
    label: String!
    placeholder: String
    required: Boolean!
    options: [AIFieldOption!]
  }

  type AIGeneratedLayout {
    content: String!
    customCTAButtonName: String!
  }

  type AIGeneratedForm {
    suggestedTitle: String!
    fields: [AIGeneratedField!]!
    tokensUsed: Int!
    layout: AIGeneratedLayout
  }

  type AITokenUsage {
    used: Int!
    limit: Int!
    resetAt: String!
    creditsUsed: Float!
    creditsLimit: Int!
  }


  # AI Chat Types
  type AIChatConversation {
    id: ID!
    formId: ID!
    title: String!
    messageCount: Int!
    createdAt: String!
    updatedAt: String!
    messages: [AIChatMessage!]!
  }

  type AIChatMessage {
    id: ID!
    conversationId: ID!
    role: String!
    content: String!
    data: JSON!
    tokensUsed: Int!
    createdAt: String!
  }

  scalar Upload
`;

