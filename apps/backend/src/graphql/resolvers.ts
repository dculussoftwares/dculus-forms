import { betterAuthResolvers } from './resolvers/better-auth.js';
import { formsResolvers } from './resolvers/forms.js';
import { extendedResponsesResolvers } from './resolvers/responses.js';
import { templatesResolvers } from './resolvers/templates.js';
import { fileUploadResolvers } from './resolvers/fileUpload.js';
import { formFileResolvers } from './resolvers/formFiles.js';
import { unifiedExportResolvers } from './resolvers/unifiedExport.js';
import { adminResolvers } from './resolvers/admin.js';
import { analyticsResolvers } from './resolvers/analytics.js';
import { fieldAnalyticsResolvers } from './resolvers/fieldAnalytics.js';
import { invitationResolvers } from './resolvers/invitations.js';
import { formSharingResolvers } from './resolvers/formSharing.js';
import { pluginsResolvers } from './resolvers/plugins.js';
import { subscriptionResolvers } from './resolvers/subscriptions.js';
import { tagResolvers } from './resolvers/tags.js';
import { aiResolvers } from './resolvers/ai.js';
import { aiChatResolvers } from './resolvers/aiChat.js';
import { GraphQLJSON } from 'graphql-type-json';

export const resolvers = {
  JSON: GraphQLJSON,
  User: {
    ...betterAuthResolvers.User,
  },
  Organization: {
    ...subscriptionResolvers.Organization,
  },
  FormTemplate: {
    createdAt: (parent: { createdAt: Date | string }) =>
      parent.createdAt instanceof Date ? parent.createdAt.toISOString() : parent.createdAt,
    updatedAt: (parent: { updatedAt: Date | string }) =>
      parent.updatedAt instanceof Date ? parent.updatedAt.toISOString() : parent.updatedAt,
  },
  Query: {
    ...aiChatResolvers.Query,
    ...aiResolvers.Query,
    ...betterAuthResolvers.Query,
    ...formsResolvers.Query,
    ...extendedResponsesResolvers.Query,
    ...templatesResolvers.Query,
    ...fileUploadResolvers.Query,
    ...formFileResolvers.Query,
    ...adminResolvers.Query,
    ...analyticsResolvers.Query,
    ...fieldAnalyticsResolvers.Query,
    ...invitationResolvers.Query,
    ...formSharingResolvers.Query,
    ...pluginsResolvers.Query,
    ...subscriptionResolvers.Query,
    ...tagResolvers.Query,
  },
  Mutation: {
    ...aiChatResolvers.Mutation,
    ...aiResolvers.Mutation,
    ...betterAuthResolvers.Mutation,
    ...formsResolvers.Mutation,
    ...extendedResponsesResolvers.Mutation,
    ...templatesResolvers.Mutation,
    ...fileUploadResolvers.Mutation,
    ...unifiedExportResolvers.Mutation,
    ...analyticsResolvers.Mutation,
    ...fieldAnalyticsResolvers.Mutation,
    ...formSharingResolvers.Mutation,
    ...pluginsResolvers.Mutation,
    ...subscriptionResolvers.Mutation,
    ...tagResolvers.Mutation,
    ...adminResolvers.Mutation,
  },
  Form: {
    ...formsResolvers.Form,
    ...formSharingResolvers.Form,
  },
  FormResponse: {
    ...extendedResponsesResolvers.FormResponse,
    ...tagResolvers.FormResponse,
  },
  FormPermission: {
    ...formSharingResolvers.FormPermission,
  },
  FormPlugin: {
    ...pluginsResolvers.FormPlugin,
  },
  PluginDelivery: {
    ...pluginsResolvers.PluginDelivery,
  },
  PlanSubscription: {
    ...subscriptionResolvers.Subscription,
  },
};
