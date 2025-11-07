import { Request } from 'express';

type ResolverContext = {
  req?: Request;
};

export const debugResolvers = {
  Query: {
    debugRequestHeaders: (_parent: unknown, _args: unknown, context: ResolverContext) => {
      const headers = context.req?.headers ?? {};

      // Normalize header values so the UI receives simple strings
      return Object.entries(headers).reduce<Record<string, string>>((acc, [key, value]) => {
        if (Array.isArray(value)) {
          acc[key] = value.join(', ');
        } else if (typeof value === 'string') {
          acc[key] = value;
        } else if (typeof value === 'undefined') {
          acc[key] = '';
        } else {
          acc[key] = String(value);
        }
        return acc;
      }, {});
    },
  },
};
