import type { QueryClient } from "@tanstack/react-query";

const OFFER_WORKSPACE_QUERY_SCOPE = "offer-workspace";

export const offerWorkspaceQueryKeys = {
  list: (userId: string) => [OFFER_WORKSPACE_QUERY_SCOPE, "list", userId] as const,
  detail: (userId: string, offerId: string) =>
    [OFFER_WORKSPACE_QUERY_SCOPE, "detail", userId, offerId] as const,
  organizations: (userId: string) =>
    [OFFER_WORKSPACE_QUERY_SCOPE, "organizations", userId] as const,
};

export function clearProtectedWorkspaceQueries(queryClient: QueryClient) {
  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] === OFFER_WORKSPACE_QUERY_SCOPE,
  });
}
