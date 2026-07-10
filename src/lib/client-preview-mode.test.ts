import { describe, expect, it } from "vitest";
import {
  canUseClientPreview,
  getAdminViewModeForPath,
  getAdminViewModeTarget,
} from "./client-preview-mode";

describe("client preview mode", () => {
  it("allows only admins to use client preview switching", () => {
    expect(canUseClientPreview("admin")).toBe(true);
    expect(canUseClientPreview("client")).toBe(false);
    expect(canUseClientPreview(null)).toBe(false);
    expect(canUseClientPreview(undefined)).toBe(false);
  });

  it("routes mode switches to the correct shell", () => {
    expect(getAdminViewModeTarget("admin")).toBe("/");
    expect(getAdminViewModeTarget("client-preview")).toBe("/client");
  });

  it("derives admin mode from non-client paths", () => {
    expect(getAdminViewModeForPath("/")).toBe("admin");
    expect(getAdminViewModeForPath("/intake")).toBe("admin");
  });

  it("derives client preview mode from client paths", () => {
    expect(getAdminViewModeForPath("/client")).toBe("client-preview");
    expect(getAdminViewModeForPath("/client/documents")).toBe("client-preview");
  });
});
