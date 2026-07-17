import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateTextFromPrompt } from "./gemini-service";

export const NARRATIVE_PROMPTS: Record<string, string> = {
  "corporate-experience":
    "Draft a Corporate Experience Narrative for a GSA MAS offer. MUST address every required element in order, each as its own short labeled paragraph: (1) Number of years of corporate experience providing the products/services described under this Schedule, regardless of the specific products/services being proposed — a minimum of two (2) years of corporate experience is required; (2) Organization's number of employees, experience in the field, and resources available to enable it to fulfill requirements; (3) Brief history of the Offeror's activities contributing to the development of expertise and capabilities related to this requirement; (4) Information that demonstrates the Offeror's organizational and accounting controls (segregation of direct vs indirect costs, contract cost tracking, auditable records consistent with FAR Part 31 / FAR 31.201-2 and DCAA expectations); (5) A description of the resources presently in-house or the ability to acquire the type and kinds of personnel/products proposed; (6) A description of how the Offeror intends to market the proposed products/services to Federal clients; (7) A discussion regarding the intended use of subcontractors. Tone: formal, federal, third person.",
  "quality-control":
    "Draft a Quality Control Narrative for a GSA MAS offer. MUST cover every required element, each as its own short labeled paragraph: (1) Description of internal review procedures that facilitate high-quality standards; (2) Identification of individuals responsible for ensuring quality control (titles/roles); (3) Whether or not subcontractors are used and, if so, the quality control measures used to ensure acceptable subcontractor performance; (4) How potential problem areas and solutions are handled; (5) The procedures for ensuring quality performance when meeting urgent requirements; (6) How quality control will be managed when completing multiple projects for multiple agencies simultaneously. Do NOT cover accounting or FAR Part 31 controls — those belong in the Corporate Experience narrative. Tone: formal, federal, third person.",
  "relevant-project":
    "Draft a Relevant Project Experience narrative for a GSA MAS Past Performance package. CRITICAL: Do NOT invent or fabricate any Customer name, contract number, POC name, POC phone, POC email, performance period, or dollar values. Extract Customer POC name and email VERBATIM from the Past Performance document referenced in the master intake context. If a field is not present in the supplied context, write `[TBD — extract from Past Performance source document]` in its place. MUST include every required element: (1) Detailed description of SIN-relevant work performed and results achieved; (2) Methodology, tools, and/or processes utilized; (3) Demonstration of compliance with applicable laws, regulations, Executive Orders, OMB Circulars, and professional standards; (4) Project schedule with major milestones, tasks, deliverables, and explanation of any delays; (5) How the work is similar in scope and complexity to the work solicited under the proposed SIN; (6) Demonstration of required specific experience and/or special qualifications detailed under the proposed SIN; (7) Customer Details block — Customer/Client name, project name/contract number, customer POC, POC phone (XXX-XXX-XXXX), POC email, performance period (months/years), total project dollar value, dollar value received for SIN-relevant work, and a brief project summary (background, purpose).",
  "startup-springboard":
    "Draft a Startup Springboard Substitution narrative for a GSA MAS Past Performance package. Used in place of Relevant Project Experience when the Offeror itself lacks two years of relevant work. MUST: clearly identify each predecessor entity or key personnel performing the substituting work; describe their projects' scope and complexity relative to the proposed SIN; specify the role each individual will play on the proposed Offeror's contract; and explicitly attribute each prior project to the substituting entity/person, not the Offeror.",
  "agent-authorization-letter":
    "Draft an Agent Authorization Letter for a GSA MAS offer package. Use the supplied master intake context to identify the Offeror legal name, the authorized agent, and contact email. Must include: title, date, an Offeror Authorization section, a concise paragraph authorizing the named agent to act for the Offeror in connection with the preparation, submission, and administration of the offer package, a statement that the authorization remains in effect until revoked in writing, and a signature block with Offeror Representative, Title, Authorized Agent, and Accepted By lines. Use a formal, federal tone and do not invent missing names or emails.",
  "epa-narrative":
    "Draft an Economic Price Adjustment (EPA) narrative for a GSA MAS Schedule. Anchor every element to the current GSA Pricing Terms Attachment and cite GSAM 538.270-4 subsection numbers explicitly, together with the Multiple Award Schedule EPA clause at GSAR 552.238-120. Do NOT cite the legacy/retired clauses 552.216-70 or I-FSS-969 — they were removed from MAS. The Offeror has elected a specific EPA mechanism — use the mechanism provided in the master intake context (EPA Mechanism field). The three elective GSAM 538.270-4 mechanisms, in canonical order, are: (a)(1) Adjustments based on fixed escalation rates; (a)(2) Adjustments based on a market index or other basis (e.g., BLS Employment Cost Index); (a)(3) Adjustments based on established pricing (e.g., the contractor's commercial price list, commercial catalog, or other standard market pricing). Subsection (a)(4) — unforeseeable significant changes in market conditions — is always incorporated by reference and requires no separate election. Address: the elected mechanism and its GSAM 538.270-4 citation; basis for adjustment and supporting documentation submitted with each EPA request under GSAR 552.238-120; per-period and aggregate caps; frequency (annual on the anniversary date of contract award unless otherwise stated) and notice requirements; whether the method is consistent with the Offeror's commercial practices. Tone: formal, federal, third person.",
  "uncompensated-overtime":
    "Draft an Uncompensated Overtime Policy narrative consistent with FAR 52.237-10 for a GSA MAS offer. Address exempt staff, time recording, and pricing impact.",
  "compensation-plan":
    "Draft a Professional Employee Compensation Plan narrative consistent with FAR 52.222-46 for a GSA MAS offer. Address salary structure, fringe benefits, recruitment, and retention.",
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
    const base = NARRATIVE_PROMPTS[data.kind];
    if (!base) throw new Error(`Unknown narrative kind: ${data.kind}`);

    const text = await generateTextFromPrompt({
      system:
        "You are a senior GSA Federal Supply Schedule proposal writer. Output polished, ready-to-paste federal prose grounded ONLY in the supplied master intake context. STRICT ANTI-HALLUCINATION RULES: (1) Never invent company names, customer names, POC names/emails/phones, contract numbers, dollar values, dates, or project identifiers. (2) If a required field is missing from the supplied context, write `[TBD — to be supplied by Offeror]` in its place — do NOT guess or use plausible-sounding stand-ins. (3) Use generic placeholders for any role/process not explicitly described. (4) Use short labeled paragraphs (no markdown headings, no bullets) so each required element is clearly addressed in order. Maximum 650 words.",
      prompt: `${base}\n\nMaster intake context (use these fields where natural — do NOT introduce facts not present here):\n${data.context ?? "(no intake context provided — produce a placeholder draft and flag every missing field with [TBD] brackets)"}`,
      maxOutputTokens: 2500,
    });
    return { text };
  });
