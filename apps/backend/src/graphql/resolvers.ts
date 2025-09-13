
import { betterAuthResolvers } from './resolvers/better-auth.js';
import { formsResolvers } from './resolvers/forms.js';
import { responsesResolvers } from './resolvers/responses.js';
import { templatesResolvers } from './resolvers/templates.js';
import { fileUploadResolvers } from './resolvers/fileUpload.js';
import { formFileResolvers } from './resolvers/formFiles.js';
import { unifiedExportResolvers } from './resolvers/unifiedExport.js';
import { adminResolvers } from './resolvers/admin.js';
import { analyticsResolvers } from './resolvers/analytics.js';
import { fieldAnalyticsResolvers } from './resolvers/fieldAnalytics.js';
import { invitationResolvers } from './resolvers/invitations.js';
import { formSharingResolvers } from './resolvers/formSharing.js';
import { GraphQLJSON } from 'graphql-type-json';


export const resolvers = {
  JSON: GraphQLJSON,
  Query: {
    ...betterAuthResolvers.Query,
    ...formsResolvers.Query,
    ...responsesResolvers.Query,
    ...templatesResolvers.Query,
    ...formFileResolvers.Query,
    ...adminResolvers.Query,
    ...analyticsResolvers.Query,
    ...fieldAnalyticsResolvers.Query,
    ...invitationResolvers.Query,
    ...formSharingResolvers.Query,
  },
  Mutation: {
    ...betterAuthResolvers.Mutation,
    ...formsResolvers.Mutation,
    ...responsesResolvers.Mutation,
    ...templatesResolvers.Mutation,
    ...fileUploadResolvers.Mutation,
    ...unifiedExportResolvers.Mutation,
    ...analyticsResolvers.Mutation,
    ...fieldAnalyticsResolvers.Mutation,
    ...formSharingResolvers.Mutation,
  },
  Form: {
    ...formsResolvers.Form,
    ...formSharingResolvers.Form,
  },
  FormPermission: {
    ...formSharingResolvers.FormPermission,
  },
};
 