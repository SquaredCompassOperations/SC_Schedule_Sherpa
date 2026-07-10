import { describe, expect, it } from "vitest";
import type { IntakeState } from "./intake-store";
import { calculateIntakeReadinessComposite, isIntakeReadyForCompletion } from "./intake-readiness";

const completeIntake = (): IntakeState => ({
  corporate: {
    uei: "ABC123456789",
    cageCode: "1A2B3",
    orgType: "Limited Liability Company",
    parentUei: "",
    legalName: "Squared Compass LLC",
    dba: "",
    ein: "12-3456789",
    businessTypes: "Small Business",
    samStatus: "Active",
    samExpires: "2027-07-10",
    website: "https://example.com",
    naicsPrimary: "541611",
    entityStartDate: "2020-01-01",
    yearsInBusiness: "6",
  },
  companyAddress: {
    street1: "123 Main St",
    street2: "",
    city: "Houston",
    state: "TX",
    zip: "77002",
    country: "United States",
  },
  mailingSame: true,
  mailingAddress: {
    street1: "",
    street2: "",
    city: "",
    state: "",
    zip: "",
    country: "United States",
  },
  negotiators: [
    {
      name: "Riley Lee",
      title: "President",
      phoneUs: "555-0100",
      phoneIntl: "",
      email: "riley@example.com",
      faxUs: "",
      faxIntl: "",
      authorizedToSign: true,
    },
  ],
  documents: {
    compensationPlan: { filename: "comp.pdf", size: 1, uploadedAt: 1 },
    uotPolicy: { filename: "uot.pdf", size: 1, uploadedAt: 1 },
    corporatePriceList: { filename: "prices.pdf", size: 1, uploadedAt: 1 },
    pnlYear1: { filename: "pnl-1.pdf", size: 1, uploadedAt: 1 },
    pnlYear2: { filename: "pnl-2.pdf", size: 1, uploadedAt: 1 },
    balanceYear1: { filename: "balance-1.pdf", size: 1, uploadedAt: 1 },
    balanceYear2: { filename: "balance-2.pdf", size: 1, uploadedAt: 1 },
  },
  pastPerformance: [
    {
      id: "pp-1",
      category: "Case Study",
      filename: "case-study.pdf",
      size: 1,
      uploadedAt: 1,
    },
    {
      id: "pp-2",
      category: "Reference",
      filename: "reference.pdf",
      size: 1,
      uploadedAt: 1,
    },
  ],
  sbaCerts: [],
  sbaScannedAt: null,
  clientSubmittedAt: null,
});

describe("intake readiness scoring", () => {
  it("marks a complete intake as ready for completion", () => {
    const intake = completeIntake();

    expect(calculateIntakeReadinessComposite(intake)).toBe(100);
    expect(isIntakeReadyForCompletion(intake)).toBe(true);
  });

  it("does not mark intake ready when the composite is below 90", () => {
    const intake = completeIntake();
    intake.documents = {};
    intake.pastPerformance = [];

    expect(calculateIntakeReadinessComposite(intake)).toBeLessThan(90);
    expect(isIntakeReadyForCompletion(intake)).toBe(false);
  });

  it("treats an exact 90 composite as ready for completion", () => {
    const intake = completeIntake();
    intake.negotiators = [
      {
        ...intake.negotiators[0],
        phoneUs: "",
        phoneIntl: "",
      },
    ];

    expect(calculateIntakeReadinessComposite(intake)).toBe(90);
    expect(isIntakeReadyForCompletion(intake)).toBe(true);
  });
});
