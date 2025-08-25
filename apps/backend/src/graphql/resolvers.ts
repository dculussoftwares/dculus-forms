
import { betterAuthResolvers } from './resolvers/better-auth';
import { formsResolvers } from './resolvers/forms';
import { responsesResolvers } from './resolvers/responses';
import { templatesResolvers } from './resolvers/templates';
import { fileUploadResolvers } from './resolvers/fileUpload';
import { formFileResolvers } from './resolvers/formFiles';
import { unifiedExportResolvers } from './resolvers/unifiedExport';
import { GraphQLJSON } from 'graphql-type-json';


export const resolvers = {
  JSON: GraphQLJSON,
  Query: {
    ...betterAuthResolvers.Query,
    ...formsResolvers.Query,
    ...responsesResolvers.Query,
    ...templatesResolvers.Query,
    ...formFileResolvers.Query,
  },
  Mutation: {
    ...betterAuthResolvers.Mutation,
    ...formsResolvers.Mutation,
    ...responsesResolvers.Mutation,
    ...templatesResolvers.Mutation,
    ...fileUploadResolvers.Mutation,
    ...unifiedExportResolvers.Mutation,
  },
  Form: {
    ...formsResolvers.Form,
  },
};
 