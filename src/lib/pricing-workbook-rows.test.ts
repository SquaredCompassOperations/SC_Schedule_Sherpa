import { describe, expect, it } from "vitest";
import { buildPricingRowsFromAutomation, derivePricingKeywords } from "./pricing-workbook-rows";
import type { AutomationState } from "./automation-store";

const baseAutomation: AutomationState = {
  selectedSins: [
    {
      code: "54151S",
      title: "Information Technology Professional Services",
      confidence: 96,
      rationale: "Best website match.",
    },
  ],
  selectedLcats: [],
  priceListLcats: [],
  priceListSource: null,
  priceListExtractedAt: null,
  marketRows: [],
  marketRunAt: null,
  pricingTemplate: null,
  pricingRows: [],
  pricingSavedAt: null,
  pricingKeyTerms: "",
};

describe("pricing workbook row sync", () => {
  it("preserves saved workbook rows until the user chooses to resync", () => {
    const rows = buildPricingRowsFromAutomation({
      ...baseAutomation,
      pricingRows: [
        {
          sin: "541611",
          title: "Saved Consultant",
          description: "Already reviewed manual workbook row.",
          keywords: "consulting",
          minimumEducation: "Bachelors",
          minimumYearsExperience: "7",
          unitOfMeasure: "Hour",
          price: "180.00",
        },
      ],
      priceListLcats: [
        {
          title: "New Extracted Consultant",
          rate: "$145.50",
          unit: "Hour",
        },
      ],
    });

    expect(rows).toEqual([
      {
        sin: "541611",
        title: "Saved Consultant",
        description: "Already reviewed manual workbook row.",
        keywords: "consulting",
        minimumEducation: "Bachelors",
        minimumYearsExperience: "7",
        unitOfMeasure: "Hour",
        price: "180.00",
        scaLaborCategory: "",
        wageDeterminationTable: "",
      },
    ]);
  });

  it("builds workbook rows from uploaded price list LCATs before manual rows", () => {
    const rows = buildPricingRowsFromAutomation({
      ...baseAutomation,
      priceListLcats: [
        {
          title: "Senior Technical Writer",
          rate: "$145.50",
          unit: "Hour",
          sin: "54151S",
        },
      ],
    });

    expect(rows).toEqual([
      {
        sin: "54151S",
        title: "Senior Technical Writer",
        description: "",
        keywords: "",
        minimumEducation: "Bachelors",
        minimumYearsExperience: "5",
        unitOfMeasure: "Hour",
        price: "145.50",
        scaLaborCategory: "",
        wageDeterminationTable: "",
      },
    ]);
  });

  it("uses matching selected LCAT rationale as the workbook description", () => {
    const rows = buildPricingRowsFromAutomation({
      ...baseAutomation,
      selectedLcats: [
        {
          code: "30210",
          title: "Senior Technical Writer",
          family: "Technical Writing",
          rationale: "Senior Technical Writer creates user guides and compliance documentation.",
        },
      ],
      priceListLcats: [
        {
          title: "Senior Technical Writer",
          rate: "$145.50",
          unit: "Hour",
        },
      ],
    });

    expect(rows[0]).toMatchObject({
      sin: "54151S",
      title: "Senior Technical Writer",
      description: "Senior Technical Writer creates user guides and compliance documentation.",
      price: "145.50",
    });
    expect(rows[0].keywords).toContain("Senior Technical Writer");
  });

  it("derives up to five catalog keywords from descriptions", () => {
    expect(
      derivePricingKeywords(
        "Cloud Migration Architect leads FedRAMP migration, Zero Trust planning, Kubernetes modernization, and DevSecOps automation.",
      ).split(", "),
    ).toEqual(["Cloud Migration Architect", "Zero Trust", "Kubernetes", "DevSecOps", "FedRAMP"]);
  });
});
