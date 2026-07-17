import { describe, expect, it } from "vitest";
import { buildInteractAckKey } from "./pricing-workbook.helpers";

describe("pricing workbook helpers", () => {
  it("builds a stable interact acknowledgement key", () => {
    expect(buildInteractAckKey("31")).toBe("pricing-workbook-interact-ack:31");
    expect(buildInteractAckKey(null)).toBe("pricing-workbook-interact-ack:unknown");
  });
});
