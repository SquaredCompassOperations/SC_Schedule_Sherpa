# Lovable Removal And Document Extraction Design

## Goal

Remove the remaining Lovable runtime dependencies from Schedule Sherpa and replace the Lovable AI gateway with an app-owned document extraction service backed by `GEMINI_API_KEY`.

## Scope

- Replace all `LOVABLE_API_KEY` reads with `GEMINI_API_KEY`.
- Remove the app-owned `ai-gateway` Lovable wrapper.
- Route SAM profile extraction, price list extraction, SBA screenshot extraction, financial checks, narrative drafting, SCA matching, SIN crawling, and market validation through one Gemini helper.
- Add a local file text extraction helper for plain text, RTF, DOCX, CSV, XLS, and XLSX where possible.
- Preserve PDF and image support by sending supported files to the Gemini document/image input path.
- Remove the Lovable Vite config package and use official Vite, TanStack Start, React, Tailwind, tsconfig paths, and Nitro plugins directly.
- Keep manual data entry available when extraction fails or the Gemini key is missing.

## Architecture

`src/lib/gemini-service.ts` owns Gemini API access. It builds Interactions API requests, extracts the returned text, and exposes text, document, and image generation helpers. The default model is configurable with `GEMINI_MODEL`; the app falls back to `gemini-3.5-flash`.

`src/lib/file-extraction.ts` owns local file scraping. It decodes uploaded base64 files and extracts readable text for simple text-like files, DOCX bodies, and spreadsheets. If local extraction cannot read the file, the Gemini service passes the original file payload as a model input.

Existing server functions keep their public names so the UI does not need a major rewrite. Their internal AI calls are changed to use the new Gemini service.

## Error Handling

Missing AI configuration reports `GEMINI_API_KEY is not configured. Add it in Vercel Project Settings > Environment Variables.` No user-facing code should mention Lovable. Extraction failures return the same empty/manual fallback behavior the app already uses.

## Verification

- Add unit coverage for local file extraction.
- Run focused tests for the extractor.
- Run TypeScript type checking.
- Run the full test suite.
- Run a production build.

## Sources Checked

- Gemini text generation and Interactions API: https://ai.google.dev/gemini-api/docs/text-generation
- Gemini document understanding: https://ai.google.dev/gemini-api/docs/document-processing
- Gemini image understanding: https://ai.google.dev/gemini-api/docs/image-understanding
