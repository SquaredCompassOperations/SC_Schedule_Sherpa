import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import {
  clearProtectedWorkspaceQueries,
  offerWorkspaceQueryKeys,
} from "./offer-workspace-query";

describe("offer workspace query cache", () => {
  it("scopes workspace keys to the authenticated user", () => {
    expect(offerWorkspaceQueryKeys.list("user-a")).not.toEqual(
      offerWorkspaceQueryKeys.list("user-b"),
    );
  });

  it("removes protected workspace data while preserving unrelated cached data", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(offerWorkspaceQueryKeys.list("user-a"), ["Acme"]);
    queryClient.setQueryData(offerWorkspaceQueryKeys.detail("user-a", "offer-1"), { id: "offer-1" });
    queryClient.setQueryData(["public-settings"], { theme: "system" });

    clearProtectedWorkspaceQueries(queryClient);

    expect(queryClient.getQueryData(offerWorkspaceQueryKeys.list("user-a"))).toBeUndefined();
    expect(queryClient.getQueryData(offerWorkspaceQueryKeys.detail("user-a", "offer-1"))).toBeUndefined();
    expect(queryClient.getQueryData(["public-settings"])).toEqual({ theme: "system" });
  });
});
