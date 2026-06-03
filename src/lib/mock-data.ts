export const CLIENT = {
  name: "Advantix Systems LLC",
  uei: "Z9L8H2M7K4P1",
  cage: "8K2P7",
  ein: "47-3920184",
  naicsPrimary: "541512",
  solicitation: "47QSMD20R0001",
  schedule: "GSA Schedule MAS / IT",
  refresh: "Refresh 18",
  poc: "Jordan Daniels",
  employees: 84,
  socioeconomic: "SDVOSB",
  fasId: "Pending Link",
  samExpires: "2025-04-12",
  readiness: 88.4,
};

export type ModuleStatus = "complete" | "in_progress" | "blocked" | "not_started";

export const MODULES = [
  { slug: "/status", label: "Overview", status: "in_progress" as ModuleStatus, group: "Status" },
  { slug: "/status/milestones", label: "Milestones", status: "in_progress" as ModuleStatus, group: "Status" },
  { slug: "/status/open-items", label: "Open Items", status: "in_progress" as ModuleStatus, group: "Status" },
  { slug: "/status/activity", label: "Activity Log", status: "in_progress" as ModuleStatus, group: "Status" },
  { slug: "/intake", label: "Client Intake", status: "in_progress" as ModuleStatus, group: "Intake" },
  { slug: "/readiness", label: "Readiness Assessment", status: "in_progress" as ModuleStatus, group: "Intake" },
  { slug: "/sin", label: "SIN Recommendation", status: "in_progress" as ModuleStatus, group: "Engine" },
  { slug: "/market-validation", label: "Market Validation", status: "in_progress" as ModuleStatus, group: "Engine" },
  { slug: "/sca", label: "LCAT Confirmation", status: "in_progress" as ModuleStatus, group: "Engine" },
  { slug: "/documents", label: "Documentation Generator", status: "in_progress" as ModuleStatus, group: "Engine" },
  { slug: "/pricing-workbook", label: "Pricing Workbook", status: "in_progress" as ModuleStatus, group: "Engine" },

  { slug: "/review", label: "Review Workflow", status: "not_started" as ModuleStatus, group: "Final" },
  { slug: "/export", label: "Export eOffer", status: "not_started" as ModuleStatus, group: "Final" },
  { slug: "/submission", label: "Submission Tracker", status: "not_started" as ModuleStatus, group: "Final" },
];

export const REGISTRATION_ITEMS = [
  { label: "SAM.gov Active Registration", status: "ok", note: "Expires 2025-04-12" },
  { label: "UEI Issued", status: "ok", note: "Z9L8H2M7K4P1" },
  { label: "CAGE Code", status: "ok", note: "8K2P7" },
  { label: "FAS ID Linked", status: "gap", note: "Required for eOffer portal" },
  { label: "eOffer Digital Cert", status: "gap", note: "Authorized negotiator missing" },
  { label: "Pathways to Success", status: "ok", note: "Completed 2024-11-02" },
  { label: "Readiness Assessment", status: "ok", note: "Score 88.4" },
];

export const SIN_MATCHES = [
  { code: "54151S", title: "IT Professional Services", confidence: 98, required: ["Past Performance", "LCAT Matrix", "EPA Narrative"] },
  { code: "54151HEC", title: "Health IT Services", confidence: 74, required: ["FedRAMP attestation", "Project summaries"] },
  { code: "541611", title: "Management & Financial Consulting", confidence: 62, required: ["Commercial Sales Practices"] },
  { code: "518210C", title: "Cloud Computing Services", confidence: 41, required: ["FedRAMP Mod", "SLA narrative"] },
];

export const COMPLIANCE_MATRIX = [
  { ref: "SCP-FSS-001", cat: "technical", req: "Technical Proposal Narrative", source: "DocGen_04.pdf", status: "missing" },
  { ref: "I-FSS-600", cat: "pricing", req: "Contract Sales Criteria", source: "Sales_Hist.xlsx", status: "valid" },
  { ref: "CP-114-A", cat: "administrative", req: "Agent Authorization Letter", source: "—", status: "missing" },
  { ref: "FAR 52.222-46", cat: "compliance", req: "Professional Compensation Plan", source: "Comp_Plan.docx", status: "review" },
  { ref: "FAR 52.237-10", cat: "compliance", req: "Uncompensated Overtime Policy", source: "UOT_Policy.docx", status: "valid" },
  { ref: "GSAR 552.216-70", cat: "pricing", req: "EPA Methodology", source: "EPA_Narrative.docx", status: "review" },
  { ref: "FAR 31.201-2", cat: "compliance", req: "Accounting Controls Narrative", source: "Acct_Controls.docx", status: "missing" },
  { ref: "I-FSS-639", cat: "pricing", req: "Commercial Sales Practices (CSP-1)", source: "CSP-1.xlsx", status: "review" },
  { ref: "SCP-FSS-004", cat: "administrative", req: "Letter of Supply (if applicable)", source: "—", status: "na" },
  { ref: "I-FSS-969", cat: "pricing", req: "EPA Negotiated Escalation", source: "—", status: "missing" },
];


export const DOCUMENT_QUEUE = [
  { name: "Technical Proposal: Corporate Experience", kind: "corporate-experience", status: "draft" },
  { name: "Technical Proposal: Quality Control", kind: "quality-control", status: "draft" },
  { name: "Relevant Project Experience", kind: "relevant-project", status: "draft" },
  { name: "Startup Springboard Substitution", kind: "startup-springboard", status: "draft" },
  { name: "Capability Statement", kind: "capability-statement", status: "draft" },
  { name: "EPA Narrative", kind: "epa-narrative", status: "review" },
  { name: "Accounting Controls Narrative", kind: "accounting-controls", status: "draft" },
  { name: "Uncompensated Overtime Policy", kind: "uncompensated-overtime", status: "final" },
  { name: "Professional Compensation Plan", kind: "compensation-plan", status: "review" },
  { name: "Project Summary — VA EHR Modernization", kind: "project-summary", status: "draft" },
  { name: "Key Personnel — Sr. Systems Architect", kind: "key-personnel", status: "draft" },
];

export const DOC_CRITERIA: Record<string, { source: string; items: string[] }> = {
  "corporate-experience": {
    source: "GSA MAS Solicitation — Technical Proposal: Corporate Experience",
    items: [
      "Minimum two (2) years of corporate experience in the products/services under this Schedule",
      "Organization's employee count, field experience, and resources to fulfill requirements",
      "Brief history of activities developing relevant expertise and capabilities",
      "Information demonstrating organizational and accounting controls",
      "Description of in-house resources or ability to acquire personnel/products proposed",
      "How the Offeror intends to market proposed products/services to Federal clients",
      "Discussion of intended use of subcontractors",
    ],
  },
  "quality-control": {
    source: "GSA MAS Solicitation — Technical Proposal: Quality Control",
    items: [
      "Internal review procedures that facilitate high-quality standards",
      "Individuals responsible for ensuring quality control (named roles)",
      "Subcontractor use and quality control measures applied to subcontractors",
      "How potential problem areas and solutions are handled",
      "Procedures for ensuring quality when meeting urgent requirements",
      "Managing QC across multiple simultaneous projects for multiple agencies",
    ],
  },
  "relevant-project": {
    source: "GSA MAS Solicitation — Relevant Project Experience",
    items: [
      "Detailed description of SIN-relevant work performed and results achieved",
      "Methodology, tools, and processes utilized",
      "Compliance with applicable laws, regulations, EOs, OMB Circulars, standards",
      "Project schedule — milestones, tasks, deliverables, and any delays explained",
      "Similarity in scope and complexity to work solicited under proposed SIN",
      "Specific experience or special qualifications required by the SIN",
      "Customer details — name, contract #, POC, phone, email",
      "Performance period (months/years) and total project dollar value",
      "Dollar value received for SIN-relevant work",
      "Brief project summary (background, purpose)",
    ],
  },
  "startup-springboard": {
    source: "GSA MAS Solicitation — Startup Springboard (Substitution for Relevant Project Experience)",
    items: [
      "Substitution used only when relevant project experience does not exist",
      "Clearly identify predecessor company or key personnel performing major work",
      "Describe predecessor or personnel's relevant projects in scope and complexity",
      "Role each identified individual will play in performing the proposed work",
      "Narrative explicitly attributes each prior project to the substituting entity/person",
    ],
  },
};


export const LABOR_CATEGORIES = [
  { code: "LCAT-01", title: "Senior Systems Architect", education: "Bachelors", years: 10, commercial: 215.0, gsa: 185.0 },
  { code: "LCAT-02", title: "Project Manager (PMP)", education: "Masters", years: 12, commercial: 225.0, gsa: 194.2 },
  { code: "LCAT-03", title: "Cybersecurity Specialist III", education: "Bachelors", years: 7, commercial: 188.5, gsa: 162.5 },
  { code: "LCAT-04", title: "Senior Data Engineer", education: "Bachelors", years: 8, commercial: 198.0, gsa: 170.4 },
  { code: "LCAT-05", title: "Technical Writer", education: "Bachelors", years: 4, commercial: 112.0, gsa: 95.75 },
  { code: "LCAT-06", title: "Junior Analyst", education: "Bachelors", years: 2, commercial: 92.0, gsa: 78.2 },
];

export const REVIEW_GATES = [
  { stage: "Intake QA", owner: "Engagement Lead", status: "approved" },
  { stage: "SIN Mapping Review", owner: "Capture Manager", status: "approved" },
  { stage: "Pricing Review", owner: "Pricing Analyst", status: "in_review" },
  { stage: "Compliance Matrix Sign-off", owner: "Compliance Officer", status: "pending" },
  { stage: "Authorized Negotiator Certify", owner: "Authorized Negotiator", status: "pending" },
];

export const EXPORT_BUNDLE = [
  { folder: "01_Administrative", files: ["SF1449.pdf", "Agent_Authorization.pdf", "Signed_Reps_Certs.pdf"] },
  { folder: "02_Technical", files: ["Corporate_Experience.docx", "Capability_Statement.docx", "Key_Personnel.docx"] },
  { folder: "03_Past_Performance", files: ["Project_Summaries.docx", "CPARS_Refs.pdf"] },
  { folder: "04_Pricing", files: ["CPL_Pricing_Final.xlsx", "CSP-1.xlsx", "EPA_Narrative.docx"] },
  { folder: "05_Compliance", files: ["Compliance_Matrix.xlsx", "Accounting_Controls.docx", "UOT_Policy.docx"] },
];
