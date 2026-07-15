import { describe, expect, it } from "vitest";
import { parsePriceListLcatsFromText } from "./price-list-parser";

describe("price list parser", () => {
  it("extracts LCAT rows from the Squared Compass commercial price list text", () => {
    const rows = parsePriceListLcatsFromText(`
COMMERCIAL PRICE LIST
Hourly Service Pricing
SIN Labor Category UOM Price
541611 Business Analyst I Hourly $100.00
541611 Business Analyst II Hourly $125.00
541611 Project Manager I Hourly $125.00
541611 Project Manager II Hourly $160.00
541611 Technical Writer/Editor I Hourly $90.00
541611 Technical Writer/Editor II Hourly $125.00
`);

    expect(rows).toEqual([
      { sin: "541611", title: "Business Analyst I", unit: "Hourly", rate: "$100.00" },
      { sin: "541611", title: "Business Analyst II", unit: "Hourly", rate: "$125.00" },
      { sin: "541611", title: "Project Manager I", unit: "Hourly", rate: "$125.00" },
      { sin: "541611", title: "Project Manager II", unit: "Hourly", rate: "$160.00" },
      { sin: "541611", title: "Technical Writer/Editor I", unit: "Hourly", rate: "$90.00" },
      { sin: "541611", title: "Technical Writer/Editor II", unit: "Hourly", rate: "$125.00" },
    ]);
  });

  it("extracts rows from CSV-style price lists", () => {
    expect(
      parsePriceListLcatsFromText(`
SIN,Labor Category,UOM,Price
541611,Program Manager II,Hour,$150.00
541611,Technical Writer II,Hour,$125.00
`),
    ).toEqual([
      { sin: "541611", title: "Program Manager II", unit: "Hour", rate: "$150.00" },
      { sin: "541611", title: "Technical Writer II", unit: "Hour", rate: "$125.00" },
    ]);
  });
});
