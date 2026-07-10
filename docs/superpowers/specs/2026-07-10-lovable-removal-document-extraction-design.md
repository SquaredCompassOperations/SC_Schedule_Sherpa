# Lovable Removal And Document Extraction Design

## Goal

Remove the remaining Lovable runtime dependencies from Schedule Sherpa and replace the Lovable AI gateway with an app-owned document extraction service backed by `OPENAI_API_KEY`.

## Scope

- Replace all `LOVABLE_API_KEY` reads with `OPENAI_API_KEY`.
- Remove the app-owned `ai-gateway` Lovable wrapper.
- Route SAM profile extraction, price list extraction, SBA screenshot extraction, financial checks, narrative drafting, SCA matching, SIN crawling, and market validation through one OpenAI helper.
- Add a local file text extraction helper for plain text, RTF, DOCX, CSV, XLS, and XLSX where possible.
- Preserve PDF and image support by sending supported files to the OpenAI file/image input path.
- Remove the Lovable Vite config package and use official Vite, TanStack Start, React, Tailwind, tsconfig paths, and Nitro plugins directly.
- Keep manual data entry available when extraction fails or the OpenAI key is missing.

## Architecture

`src/lib/openai-service.ts` owns OpenAI API access. It builds Responses API requests, sets `store: false`, extracts the returned text, and exposes text, document, and image generation helpers. The default model is configurable with `OPENAI_MODEL`; the app falls back to `gpt-4.1` for broad file-input compatibility.

`src/lib/file-extraction.ts` owns local file scraping. It decodes uploaded base64 files and extracts readable text for simple text-like files, DOCX bodies, and spreadsheets. If local extraction cannot read the file, the OpenAI service passes the original file payload as a model input.

Existing server functions keep their public names so the UI does not need a major rewrite. Their internal AI calls are changed to use the new OpenAI service.

## Error Handling

Missing AI configuration reports `OPENAI_API_KEY is not configured. Add it in Vercel Project Settings > Environment Variables.` No user-facing code should mention Lovable. Extraction failures return the same empty/manual fallback behavior the app already uses.

## Verification

- Add unit coverage for local file extraction.
- Run focused tests for the extractor.
- Run TypeScript type checking.
- Run the full test suite.
- Run a production build.

## Sources Checked

- OpenAI file input guide: https://platform.openai.com/docs/guides/pdf-files
- OpenAI Responses API reference: https://platform.openai.com/docs/api-reference/responses
