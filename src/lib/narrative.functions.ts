import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway";

const NARRATIVE_PROMPTS: Record<string, string> = {
  "corporate-experience":
    "Draft a Corporate Experience Narrative for a GSA MAS offer. MUST address every required element in order: (1) Years of corporate experience providing the products/services described under this Schedule — minimum two (2) years required; (2) Organization's number of employees, experience in the field, and resources available to fulfill requirements; (3) Brief history of the Offeror's activities contributing to the development of expertise and capabilities related to this requirement; (4) Information demonstrating the Offeror's organizational and accounting controls; (5) A description of resources presently in-house or the ability to acquire the type and kinds of personnel/products proposed; (6) How the Offeror intends to market the proposed products/services to Federal clients; (7) Intended use of subcontractors. Tone: formal, federal, third person.",
  "quality-control":
    "Draft a Quality Control Narrative for a GSA MAS offer. MUST cover every required element: (1) Internal review procedures that facilitate high-quality standards; (2) Identification of individuals responsible for ensuring quality control (titles/roles); (3) Whether subcontractors are used and, if so, the quality control measures used to ensure acceptable subcontractor performance; (4) How potential problem areas and solutions are handled; (5) Procedures for ensuring quality performance when meeting urgent requirements; (6) How quality control will be managed when completing multiple projects for multiple agencies simultaneously. Tone: formal, federal, third person.",
  "relevant-project":
    "Draft a Relevant Project Experience narrative for a GSA MAS Past Performance package. MUST include every required element: (1) Detailed description of SIN-relevant work performed and results achieved; (2) Methodology, tools, and/or processes utilized; (3) Demonstration of compliance with applicable laws, regulations, Executive Orders, OMB Circulars, and professional standards; (4) Project schedule with major milestones, tasks, deliverables, and explanation of any delays; (5) How the work is similar in scope and complexity to the work solicited under the proposed SIN; (6) Demonstration of required specific experience and/or special qualifications detailed under the proposed SIN; (7) Customer Details block — Customer/Client name, project name/contract number, customer POC, POC phone (XXX-XXX-XXXX), POC email, performance period (months/years), total project dollar value, dollar value received for SIN-relevant work, and a brief project summary (background, purpose). If proposing under Startup Springboard, clearly identify the predecessor entity or key personnel who performed the work in place of the offeror.",
  "capability-statement":
    "Draft a one-page Capability Statement suitable for a GSA MAS submission. Include: Core Competencies, Differentiators, Past Performance highlights, and Company Data block (UEI, CAGE, NAICS).",
  "epa-narrative":
    "Draft an Economic Price Adjustment (EPA) narrative pursuant to GSAR 552.216-70 for a GSA MAS Schedule contract. Propose a clear annual escalation methodology and reference the applicable index.",
  "accounting-controls":
    "Draft an Accounting Controls Narrative describing how the offeror tracks direct/indirect costs, segregates contract costs, and produces auditable records consistent with FAR Part 31 and DCAA expectations.",
  "uncompensated-overtime":
    "Draft an Uncompensated Overtime Policy narrative consistent with FAR 52.237-10 for a GSA MAS offer. Address exempt staff, time recording, and pricing impact.",
  "compensation-plan":
    "Draft a Professional Employee Compensation Plan narrative consistent with FAR 52.222-46 for a GSA MAS offer. Address salary structure, fringe benefits, recruitment, and retention.",
  "project-summary":
    "Draft a Project Summary suitable for a GSA MAS Past Performance package. Include: Customer, Period of Performance, Contract Value, Scope, Outcomes, and Relevance to SINs.",
  "agent-authorization":
    "Draft a GSA Agent Authorization Letter (CP-114-A) on the Offeror's letterhead, addressed to the GSA Contracting Officer for the Multiple Award Schedule. MUST include every required element in order, as continuous formal letter prose (no markdown, no bullets, no headings): (1) Date line; (2) 'To: General Services Administration, Federal Acquisition Service, Multiple Award Schedule Contracting Officer'; (3) 'Re: Authorization of Agent — [Offeror Legal Name], UEI [UEI], CAGE [CAGE]'; (4) Opening statement that the Offeror hereby authorizes the named agent/consultant (placeholder: [Agent Name], [Agent Company], [Agent Address], [Agent Phone], [Agent Email]) to act on the Offeror's behalf in connection with the preparation, negotiation, and submission of its GSA MAS offer; (5) Scope of authority — preparing and submitting the offer in eOffer/eMod, responding to clarifications and negotiation requests, uploading documentation, and communicating with the Contracting Officer and Contract Specialist on administrative matters; (6) Explicit limitation that the agent is NOT authorized to sign the final contract, certifications, or representations requiring an Authorized Negotiator's signature, and that all binding signatures remain with the Offeror's Authorized Negotiator(s); (7) Effective period (from date of this letter through award or written revocation); (8) Statement that this authorization may be revoked at any time by written notice to the Contracting Officer; (9) Closing signature block for the Offeror's Authorized Negotiator with name, title, phone, email, and date. Tone: formal, federal, third person where appropriate, ready to print on letterhead.",
};

export const generateNarrative = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        kind: z.string().min(1).max(64),
        context: z.string().max(4000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY is not configured");
    const base = NARRATIVE_PROMPTS[data.kind];
    if (!base) throw new Error(`Unknown narrative kind: ${data.kind}`);

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");
    const { text } = await generateText({
      model,
      system:
        "You are a senior GSA Federal Supply Schedule proposal writer. Output polished, ready-to-paste federal prose. Use short labeled paragraphs (no markdown headings, no bullets) so each required element is clearly addressed in order. Maximum 650 words.",
      prompt: `${base}\n\nMaster intake context (use these fields where natural):\n${data.context ?? "Company: Advantix Systems LLC | UEI: Z9L8H2M7K4P1 | CAGE: 8K2P7 | NAICS: 541512 | SINs: 54151S | POC: Jordan Daniels"}`,
    });
    return { text };
  });
