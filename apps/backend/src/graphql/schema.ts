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
  }

  type Member {
    id: ID!
    user: User!
    organization: Organization!
    role: String!
    createdAt: String!
    updatedAt: String!
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

  type FormSettings {
    thankYou: ThankYouSettings
    submissionLimits: SubmissionLimitsSettings
  }

  # Form Types
  type Form {
    id: ID!
    title: String!
    description: String
    shortUrl: String!
    formSchema: JSON
    settings: FormSettings
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
    lastUpdated: String!
  }

  type FormDashboardStats {
    averageCompletionTime: Float # Average completion time in seconds
    responseRate: Float # Response rate as percentage (0-100)
    responsesToday: Int!
    responsesThisWeek: Int!
    responsesThisMonth: Int!
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
    MY_FORMS
    SHARED_WITH_ME
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

  type FormResponse {
    id: ID!
    formId: ID!
    data: JSON!
    submittedAt: String!
    thankYouMessage: String!
    showCustomThankYou: Boolean!
    hasBeenEdited: Boolean!
    totalEdits: Int!
    lastEditedAt: String
    lastEditedBy: User
    editHistory: [ResponseEditHistory!]!
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

  type PaginatedForms {
    data: [Form!]!
    total: Int!
    page: Int!
    limit: Int!
    totalPages: Int!
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
    templateId: ID!
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

  input FormSettingsInput {
    thankYou: ThankYouSettingsInput
    submissionLimits: SubmissionLimitsSettingsInput
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
    mongoDbSize: String!
    mongoCollectionCount: Int!
  }

  # Analytics Types
  type FormAnalytics {
    totalViews: Int!
    uniqueSessions: Int!
    topCountries: [CountryStats!]!
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

  type CountryStats {
    code: String
    name: String!
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

  type AllFieldsAnalytics {
    formId: ID!
    totalResponses: Int!
    fields: [FieldAnalytics!]!
  }

  type FieldAnalyticsCacheStats {
    totalEntries: Int!
    expiredEntries: Int!
    totalMemoryUsage: Int!
    memoryUsageFormatted: String!
    hitRatio: Int!
  }

  type CacheInvalidationResponse {
    success: Boolean!
    message: String!
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
    STARTS_WITH
    ENDS_WITH
    IS_EMPTY
    IS_NOT_EMPTY
    GREATER_THAN
    LESS_THAN
    BETWEEN
    IN
    NOT_IN
    DATE_EQUALS
    DATE_BETWEEN
    DATE_BEFORE
    DATE_AFTER
  }

  input DateRangeInput {
    from: String
    to: String
  }

  input NumberRangeInput {
    min: Float
    max: Float
  }

  input ResponseFilterInput {
    fieldId: String!
    operator: FilterOperator!
    value: String
    values: [String!]
    dateRange: DateRangeInput
    numberRange: NumberRangeInput
  }

  # Plugin Types
  type PluginConfig {
    id: ID!
    formId: ID!
    pluginId: String!
    pluginVersion: String!
    enabled: Boolean!
    config: JSON!
    triggerEvents: [String!]!
    createdById: ID!
    createdAt: String!
    updatedAt: String!
  }

  type PluginExecutionLog {
    id: ID!
    pluginConfigId: ID!
    jobId: ID
    event: String!
    status: String!
    executedAt: String!
    executionTime: Int!
    errorMessage: String
    errorStack: String
    inputData: JSON
    outputData: JSON
  }

  input CreateFormPluginInput {
    formId: ID!
    pluginId: String!
    config: JSON!
    triggerEvents: [String!]!
  }

  input UpdateFormPluginInput {
    id: ID!
    config: JSON!
    triggerEvents: [String!]
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
    responsesByForm(formId: ID!, page: Int = 1, limit: Int = 10, sortBy: String = "submittedAt", sortOrder: String = "desc", filters: [ResponseFilterInput!]): PaginatedResponses!

    # Response Edit Tracking Queries
    responseEditHistory(responseId: ID!): [ResponseEditHistory!]!

    # Form Sharing Queries
    formPermissions(formId: ID!): [FormPermission!]!
    formsWithCategory(organizationId: ID!, category: FormCategory!): [Form!]!
    organizationMembers(organizationId: ID!): [User!]!

    # Template Queries
    templates(category: String): [FormTemplate!]!
    template(id: ID!): FormTemplate
    templatesByCategory: [TemplatesByCategory!]!
    templateCategories: [String!]!

    # Form File Queries
    getFormFiles(formId: ID!, type: String): [FormFile!]!

    # Admin Queries
    adminOrganizations(limit: Int, offset: Int): AdminOrganizationsResult!
    adminOrganization(id: ID!): AdminOrganization!
    adminStats: AdminStats!

    # Analytics Queries
    formAnalytics(formId: ID!, timeRange: TimeRangeInput): FormAnalytics!
    formSubmissionAnalytics(formId: ID!, timeRange: TimeRangeInput): FormSubmissionAnalytics!

    # Field Analytics Queries
    fieldAnalytics(formId: ID!, fieldId: ID!): FieldAnalytics!
    allFieldsAnalytics(formId: ID!): AllFieldsAnalytics!
    fieldAnalyticsCacheStats: FieldAnalyticsCacheStats!

    # Plugin Queries
    formPlugins(formId: ID!): [PluginConfig!]!
    formPlugin(id: ID!): PluginConfig
    pluginExecutionLogs(pluginConfigId: ID!, limit: Int): [PluginExecutionLog!]!

  }

  type Mutation {
    # Auth Mutations
    createOrganization(name: String!): Organization
    setActiveOrganization(organizationId: ID!): Organization
    
    
    # Form Mutations
    createForm(input: CreateFormInput!): Form!
    updateForm(id: ID!, input: UpdateFormInput!): Form!
    deleteForm(id: ID!): Boolean!
    regenerateShortUrl(id: ID!): Form!
    submitResponse(input: SubmitResponseInput!): FormResponse!
    updateResponse(input: UpdateResponseInput!): FormResponse!
    deleteResponse(id: ID!): Boolean!

    # Form Sharing Mutations
    shareForm(input: ShareFormInput!): FormSharingSettings!
    updateFormPermission(input: UpdateFormPermissionInput!): FormPermission!
    removeFormAccess(formId: ID!, userId: ID!): Boolean!

    # Template Mutations
    createTemplate(input: CreateTemplateInput!): FormTemplate!
    updateTemplate(id: ID!, input: UpdateTemplateInput!): FormTemplate!
    deleteTemplate(id: ID!): Boolean!
    createFormFromTemplate(templateId: ID!, organizationId: ID!, title: String!): Form!

    # File Upload Mutations
    uploadFile(input: UploadFileInput!): FileUploadResponse!
    deleteFile(key: String!): Boolean!

    # Export Mutations
    generateFormResponseReport(formId: ID!, format: ExportFormat!, filters: [ResponseFilterInput!]): ExportResult!

    # Analytics Mutations
    trackFormView(input: TrackFormViewInput!): TrackFormViewResponse!
    updateFormStartTime(input: UpdateFormStartTimeInput!): TrackFormViewResponse!
    trackFormSubmission(input: TrackFormSubmissionInput!): TrackFormViewResponse!
    
    # Field Analytics Cache Mutations
    invalidateFieldAnalyticsCache(formId: ID!): CacheInvalidationResponse!

    # Plugin Mutations
    createFormPlugin(input: CreateFormPluginInput!): PluginConfig!
    updateFormPlugin(input: UpdateFormPluginInput!): PluginConfig!
    toggleFormPlugin(id: ID!, enabled: Boolean!): PluginConfig!
    deleteFormPlugin(id: ID!): Boolean!

  }

  scalar Upload
`; 