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

  # Form Settings Types
  type ThankYouSettings {
    enabled: Boolean!
    message: String!
  }

  type FormSettings {
    thankYou: ThankYouSettings
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
    createdAt: String!
    updatedAt: String!
    metadata: FormMetadata
  }

  type FormMetadata {
    pageCount: Int!
    fieldCount: Int!
    backgroundImageKey: String
    backgroundImageUrl: String
    lastUpdated: String!
  }

  type FormResponse {
    id: ID!
    formId: ID!
    data: JSON!
    submittedAt: String!
    thankYouMessage: String!
    showCustomThankYou: Boolean!
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

  input FormSettingsInput {
    thankYou: ThankYouSettingsInput
  }

  input UpdateFormInput {
    title: String
    description: String
    settings: FormSettingsInput
    isPublished: Boolean
  }

  input SubmitResponseInput {
    formId: ID!
    data: JSON!
  }

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

  type Query {
    # Auth Queries
    me: User
    myOrganizations: [Organization!]!
    activeOrganization: Organization
    
    # Form Queries
    forms(organizationId: ID!): [Form!]!
    form(id: ID!): Form
    formByShortUrl(shortUrl: String!): Form
    responses(organizationId: ID!): [FormResponse!]!
    response(id: ID!): FormResponse
    responsesByForm(formId: ID!, page: Int = 1, limit: Int = 10, sortBy: String = "submittedAt", sortOrder: String = "desc"): PaginatedResponses!

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
    deleteResponse(id: ID!): Boolean!

    # Template Mutations
    createTemplate(input: CreateTemplateInput!): FormTemplate!
    updateTemplate(id: ID!, input: UpdateTemplateInput!): FormTemplate!
    deleteTemplate(id: ID!): Boolean!
    createFormFromTemplate(templateId: ID!, organizationId: ID!, title: String!): Form!

    # File Upload Mutations
    uploadFile(input: UploadFileInput!): FileUploadResponse!
    deleteFile(key: String!): Boolean!

    # Export Mutations
    generateFormResponseReport(formId: ID!, format: ExportFormat!): ExportResult!

  }

  scalar Upload
`; 