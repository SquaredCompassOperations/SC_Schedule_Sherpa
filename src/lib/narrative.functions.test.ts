import { describe, expect, it } from "vitest";
import { NARRATIVE_PROMPTS } from "./narrative.functions";

describe("narrative prompts", () => {
  it("includes the agent authorization letter narrative kind", () => {
    expect(NARRATIVE_PROMPTS["agent-authorization-letter"]).toContain("Agent Authorization Letter");
  });
});
