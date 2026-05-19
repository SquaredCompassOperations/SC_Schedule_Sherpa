import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway";

const NARRATIVE_PROMPTS: Record<string, string> = {
  "corporate-experience":
    "Draft a Corporate Experience Narrative for a GSA MAS offer. Cite at least two relevant projects, demonstrate commercial sales history, and end with a one-line summary of fit for the selected SINs. Tone: formal, federal, third person.",
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
  "key-personnel":
    "Draft a Key Personnel Summary for a GSA MAS offer. For a sample senior architect, include education, years of experience, certifications, and labor-category mapping.",
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
        "You are a senior GSA Federal Supply Schedule proposal writer. Output polished, ready-to-paste prose. No markdown headings, no bullet points unless explicitly asked. Maximum 350 words.",
      prompt: `${base}\n\nMaster intake context (use these fields where natural):\n${data.context ?? "Company: Advantix Systems LLC | UEI: Z9L8H2M7K4P1 | CAGE: 8K2P7 | NAICS: 541512 | SINs: 54151S | POC: Jordan Daniels"}`,
    });
    return { text };
  });
