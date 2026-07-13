import { describe, expect, it } from "vitest";
import { buildComplianceRows, buildRegistrationItems, buildSinRows } from "./workspace-board-state";

describe("source-driven workspace panel rows", () => {
  it("does not show registration rows before intake data exists", () => {
    expect(
      buildRegistrationItems({
        legalName: "",
        uei: "",
        cageCode: "",
        samStatus: "",
        samExpires: "",
      }),
    ).toEqual([]);
  });

  it("does not show default SIN recommendations before SINs are selected", () => {
    expect(buildSinRows([])).toEqual([]);
  });

  it("does not show compliance rows before documents have activity", () => {
    expect(buildComplianceRows({})).toEqual([]);
  });
});
