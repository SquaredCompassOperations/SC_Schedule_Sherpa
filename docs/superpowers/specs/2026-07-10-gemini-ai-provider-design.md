# Gemini AI Provider Design

## Goal

Switch Schedule Sherpa's document extraction and AI prompt calls to Google Gemini because the previous provider quota is not available for this deployment.

## Scope

- Replace server-only previous-provider key usage with `GEMINI_API_KEY`.
- Keep the existing extraction helper interface: `generateTextFromPrompt`, `generateTextFromDocument`, and `generateTextFromImage`.
- Use Google Gemini's Interactions API directly through `fetch`; do not add a new SDK dependency.
- Keep document/text preprocessing in `src/lib/file-extraction.ts`.
- Keep Vercel deployment expectations simple: add `GEMINI_API_KEY`, optionally add `GEMINI_MODEL`.

## Design

`src/lib/gemini-service.ts` owns Gemini API access. It builds Interactions API requests, applies the default model `gemini-3.5-flash`, sends system instructions when provided, and parses text from `output_text` or nested text blocks.

For text-like files, `generateTextFromDocument` continues to use local extraction first and sends extracted text to Gemini. For binary inputs that Gemini can read directly, it sends inline base64 content as either an `image` part for images or a `document` part for PDFs and other document uploads.

## Error Handling

Missing AI configuration reports `GEMINI_API_KEY is not configured. Add it in Vercel Project Settings > Environment Variables.` Failed Gemini responses include the HTTP status and a short response body excerpt.

## Verification

- Unit-test Gemini request shaping and response parsing without calling the live API.
- Run the full test suite.
- Run TypeScript type-checking.
- Run a production build.

## References

- Gemini model list: https://ai.google.dev/gemini-api/docs/models
- Gemini text generation and Interactions API: https://ai.google.dev/gemini-api/docs/text-generation
- Gemini document understanding: https://ai.google.dev/gemini-api/docs/document-processing
- Gemini image understanding: https://ai.google.dev/gemini-api/docs/image-understanding
- Gemini API keys: https://ai.google.dev/gemini-api/docs/api-key
