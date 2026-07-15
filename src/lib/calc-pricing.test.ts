import { describe, expect, it } from "vitest";
import {
  buildCalcBenchmarkRows,
  buildCalcPricingUrl,
  compareClientPriceToCalc,
  normalizeCalcPricingResponse,
} from "./calc-pricing";

const sampleCalcResponse = {
  hits: {
    total: { value: 5, relation: "eq" },
    hits: [
      {
        _source: {
          labor_category: "Technical Writer/Editor II",
          current_price: 89.78,
          vendor_name: "BCT PARTNERS LLC",
          idv_piid: "GS10F0299U",
          sin: "541611",
          schedule: "MAS",
          education_level: "Bachelors",
          min_years_experience: 4,
          worksite: "Customer_Facility",
          contract_end: "2028-07-21",
        },
      },
      {
        _source: {
          labor_category: "Technical Writer/Editor II",
          current_price: 138.97,
          vendor_name: "DKW COMMUNICATIONS INC",
          idv_piid: "47QTCA23D00E7",
          sin: "541611",
          schedule: "MAS",
          education_level: "Bachelors",
          min_years_experience: 4,
          worksite: "Customer_Facility",
          contract_end: "2028-09-19",
        },
      },
    ],
  },
  aggregations: {
    wage_stats: {
      count: 5,
      min: 89.77999877929688,
      max: 145.64999389648438,
      avg: 122.497998046875,
    },
    median_price: {
      values: {
        "50.0": 138.97,
      },
    },
  },
};

describe("CALC pricing helpers", () => {
  it("builds the GSA CALC ceiling rates URL for a selected SIN and LCAT", () => {
    const url = buildCalcPricingUrl({
      laborCategory: "Technical Writer/Editor II",
      sin: "541611",
      pageSize: 20,
    });

    expect(url.origin).toBe("https://buy.gsa.gov");
    expect(url.pathname).toBe("/pricing/api/v3/search/ceilingrates/");
    expect(url.searchParams.get("search")).toBe("labor_category:Technical Writer/Editor II");
    expect(url.searchParams.get("page")).toBe("1");
    expect(url.searchParams.get("page_size")).toBe("20");
    expect(url.searchParams.get("ordering")).toBe("current_price");
    expect(url.searchParams.get("sort")).toBe("asc");
    expect(url.searchParams.getAll("filter")).toContain("sin:541611");
  });

  it("normalizes CALC hits and statistics into benchmark records", () => {
    const normalized = normalizeCalcPricingResponse({
      laborCategory: "Technical Writer/Editor II",
      clientRate: "$125.00",
      response: sampleCalcResponse,
    });

    expect(normalized).toMatchObject({
      laborCategory: "Technical Writer/Editor II",
      clientRate: 125,
      count: 5,
      min: 89.78,
      average: 122.5,
      median: 138.97,
      max: 145.65,
    });
    expect(normalized.comparables[0]).toMatchObject({
      laborCategory: "Technical Writer/Editor II",
      price: 89.78,
      contractor: "BCT PARTNERS LLC",
      contractNumber: "GS10F0299U",
      sin: "541611",
    });
  });

  it("compares client pricing to CALC median pricing", () => {
    expect(compareClientPriceToCalc({ clientRate: 125, calcMedian: 138.97 })).toEqual({
      posture: "below_market",
      delta: -13.97,
      deltaPercent: -10.05,
    });

    expect(compareClientPriceToCalc({ clientRate: 160, calcMedian: 138.97 })).toEqual({
      posture: "above_market",
      delta: 21.03,
      deltaPercent: 15.13,
    });
  });

  it("builds market validation rows from the Squared Compass sample price list", () => {
    const rows = buildCalcBenchmarkRows({
      sin: "541611",
      lcats: [
        { title: "Business Analyst I", rate: "$100.00", unit: "Hourly", sin: "541611" },
        { title: "Technical Writer/Editor II", rate: "$125.00", unit: "Hourly", sin: "541611" },
      ],
      benchmarks: [
        {
          laborCategory: "Business Analyst I",
          clientRate: 100,
          count: 0,
          comparables: [],
          sourceUrl: "https://buy.gsa.gov/pricing/qr/mas",
        },
        normalizeCalcPricingResponse({
          laborCategory: "Technical Writer/Editor II",
          clientRate: "$125.00",
          response: sampleCalcResponse,
        }),
      ],
    });

    expect(rows).toEqual([
      expect.objectContaining({
        sin: "541611",
        clientLcat: "Business Analyst I",
        laborCategory: "Business Analyst I",
        clientPrice: "$100.00",
        netPrice: "",
        pricingPosition: "no_calc_match",
        needsReview: true,
      }),
      expect.objectContaining({
        sin: "541611",
        clientLcat: "Technical Writer/Editor II",
        laborCategory: "Technical Writer/Editor II",
        clientPrice: "$125.00",
        netPrice: "$89.78",
        calcMedian: "$138.97",
        calcRange: "$89.78 - $145.65",
        pricingPosition: "below_market",
        contractor: "BCT PARTNERS LLC",
      }),
    ]);
  });
});
