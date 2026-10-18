import '@apollo/client';

declare module '@apollo/client' {
  // Force "classic" signature style so existing <TData, TVariables> type arguments
  // continue to work. Modern signatures require full type inference and reject
  // explicit generic arguments.
  interface TypeOverrides {
    signatureStyle: 'classic';
  }

  namespace ApolloClient {
    namespace DeclareDefaultOptions {
      // Affects client.watchQuery() and React hooks (useQuery, useSuspenseQuery, etc.)
      interface WatchQuery {
        errorPolicy: 'all';
      }
      // Affects client.query()
      interface Query {
        errorPolicy: 'all';
      }
      // Affects client.mutate()
      interface Mutate {
        errorPolicy: 'all';
      }
    }
  }
}
