
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
import { GraphQLJSON } from 'graphql-type-json';


export const resolvers = {
  JSON: GraphQLJSON,
  User: {
    ...betterAuthResolvers.User,
  },
  Query: {
    ...betterAuthResolvers.Query,
    ...formsResolvers.Query,
    ...extendedResponsesResolvers.Query,
    ...templatesResolvers.Query,
    ...formFileResolvers.Query,
    ...adminResolvers.Query,
    ...analyticsResolvers.Query,
    ...fieldAnalyticsResolvers.Query,
    ...invitationResolvers.Query,
    ...formSharingResolvers.Query,
    ...pluginsResolvers.Query,
  },
  Mutation: {
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
  },
  Form: {
    ...formsResolvers.Form,
    ...formSharingResolvers.Form,
  },
  FormResponse: {
    ...extendedResponsesResolvers.FormResponse,
  },
  FormPermission: {
    ...formSharingResolvers.FormPermission,
  },
};
 