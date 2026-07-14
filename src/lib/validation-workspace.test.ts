import { describe, expect, it } from "vitest";
import { recommendedSelectedCodes, selectSinCandidatesForSave } from "./validation-workspace";

const candidates = [
  {
    code: "54151S",
    title: "Information Technology Professional Services",
    confidence: 96,
    rationale: "Website highlights application development and IT modernization.",
    source: "https://www.gsaelibrary.gsa.gov/",
  },
  {
    code: "541611",
    title: "Management and Financial Consulting",
    confidence: 74,
    rationale: "Website includes advisory and operational consulting.",
    source: "GSA MAS knowledge",
  },
  {
    code: "541330ENG",
    title: "Engineering Services",
    confidence: 51,
    rationale: "Weak engineering signal.",
    source: "GSA MAS knowledge",
  },
];

describe("validation workspace SIN scan helpers", () => {
  it("preselects high-confidence candidates from the website SIN scan", () => {
    expect(recommendedSelectedCodes(candidates)).toEqual(["54151S", "541611"]);
  });

  it("maps selected SIN scan candidates into saved automation SINs", () => {
    expect(selectSinCandidatesForSave(candidates, ["541611"])).toEqual([
      {
        code: "541611",
        title: "Management and Financial Consulting",
        confidence: 74,
        rationale: "Website includes advisory and operational consulting.",
      },
    ]);
  });
});
