import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway";

const NARRATIVE_PROMPTS: Record<string, string> = {
  "corporate-experience":
    "Draft a Corporate Experience Narrative for a GSA MAS offer. MUST address every required element in order: (1) Years of corporate experience providing the products/services described under this Schedule — minimum two (2) years required; (2) Organization's number of employees, experience in the field, and resources available to fulfill requirements; (3) Brief history of the Offeror's activities contributing to the development of expertise and capabilities related to this requirement; (4) A description of resources presently in-house or the ability to acquire the type and kinds of personnel/products proposed; (5) How the Offeror intends to market the proposed products/services to Federal clients; (6) Intended use of subcontractors. Tone: formal, federal, third person.",
  "quality-control":
    "Draft a combined Quality Control & Accounting Controls Narrative for a GSA MAS offer. MUST cover every required element: (1) Internal review procedures that facilitate high-quality standards; (2) Identification of individuals responsible for ensuring quality control (titles/roles); (3) Whether subcontractors are used and, if so, the quality control measures used to ensure acceptable subcontractor performance; (4) How potential problem areas and solutions are handled; (5) Procedures for ensuring quality performance when meeting urgent requirements; (6) How quality control will be managed when completing multiple projects for multiple agencies simultaneously; (7) Accounting controls: how the offeror segregates direct vs indirect costs, tracks contract costs separately, and produces auditable records consistent with FAR Part 31 (specifically FAR 31.201-2) and DCAA expectations. Tone: formal, federal, third person.",
  "relevant-project":
    "Draft a Relevant Project Experience narrative for a GSA MAS Past Performance package. MUST include every required element: (1) Detailed description of SIN-relevant work performed and results achieved; (2) Methodology, tools, and/or processes utilized; (3) Demonstration of compliance with applicable laws, regulations, Executive Orders, OMB Circulars, and professional standards; (4) Project schedule with major milestones, tasks, deliverables, and explanation of any delays; (5) How the work is similar in scope and complexity to the work solicited under the proposed SIN; (6) Demonstration of required specific experience and/or special qualifications detailed under the proposed SIN; (7) Customer Details block — Customer/Client name, project name/contract number, customer POC, POC phone (XXX-XXX-XXXX), POC email, performance period (months/years), total project dollar value, dollar value received for SIN-relevant work, and a brief project summary (background, purpose).",
  "startup-springboard":
    "Draft a Startup Springboard Substitution narrative for a GSA MAS Past Performance package. Used in place of Relevant Project Experience when the Offeror itself lacks two years of relevant work. MUST: clearly identify each predecessor entity or key personnel performing the substituting work; describe their projects' scope and complexity relative to the proposed SIN; specify the role each individual will play on the proposed Offeror's contract; and explicitly attribute each prior project to the substituting entity/person, not the Offeror.",
  "epa-narrative":
    "Draft an Economic Price Adjustment (EPA) narrative for a GSA MAS Schedule. The Offeror has elected a specific EPA mechanism — use the mechanism provided in the master intake context (EPA Mechanism field). The three valid mechanisms are: 'Commercial Price List' (GSAR 552.238-120 Alternate I — escalation tied to the published commercial price list); 'Market Indicator' (Alternate II — tied to a recognized economic index such as the BLS Employment Cost Index); 'Fixed Ceiling' (Alternate III — pre-negotiated fixed annual escalation cap). Address: the elected mechanism and its statutory basis; basis for adjustment and the supporting documentation submitted with each EPA request; per-period and aggregate caps; frequency and notice requirements; and compliance with GSAR 552.216-70 / I-FSS-969 escalation limitations. Tone: formal, federal, third person.",
  "uncompensated-overtime":
    "Draft an Uncompensated Overtime Policy narrative consistent with FAR 52.237-10 for a GSA MAS offer. Address exempt staff, time recording, and pricing impact.",
  "compensation-plan":
    "Draft a Professional Employee Compensation Plan narrative consistent with FAR 52.222-46 for a GSA MAS offer. Address salary structure, fringe benefits, recruitment, and retention.",
  "project-summary":
    "Draft a Project Summary suitable for a GSA MAS Past Performance package. Include: Customer, Period of Performance, Contract Value, Scope, Outcomes, and Relevance to SINs.",
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
      prompt: `${base}\n\nMaster intake context (use these fields where natural):\n${data.context ?? "(no intake context provided — produce a placeholder draft and flag missing fields with [BRACKETS])"}`,
    });
    return { text };
  });
