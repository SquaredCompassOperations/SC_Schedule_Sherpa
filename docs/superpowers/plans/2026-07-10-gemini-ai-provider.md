# Gemini AI Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the server-side AI provider with Gemini while keeping the existing Schedule Sherpa extraction workflows intact.

**Architecture:** The application already has a single AI wrapper consumed by extraction and automation server functions. Replace that wrapper with `src/lib/gemini-service.ts`, keep the existing helper names, and update imports to `gemini-service`.

**Tech Stack:** TypeScript, TanStack Start server functions, Vitest, native `fetch`, Google Gemini Interactions API.

## Global Constraints

- Use server-only `GEMINI_API_KEY`; never expose it as a `VITE_` variable.
- Default to `gemini-3.5-flash`.
- Allow `GEMINI_MODEL` override for production tuning.
- Do not add a Gemini SDK dependency for this switch.
- Keep existing upload/extraction UI behavior unchanged.

---

### Task 1: Gemini Service Wrapper

**Files:**
- Create: `src/lib/gemini-service.test.ts`
- Create: `src/lib/gemini-service.ts`
- Delete: the previous provider service file

**Interfaces:**
- Produces: `generateTextFromPrompt({ prompt, system?, maxOutputTokens?, model? }): Promise<string>`
- Produces: `generateTextFromDocument({ prompt, file, system?, maxOutputTokens?, model? }): Promise<string>`
- Produces: `generateTextFromImage({ prompt, file, system?, maxOutputTokens?, model? }): Promise<string>`

- [ ] **Step 1: Write failing tests for missing key, text prompts, extracted text files, PDF/document inline input, image inline input, and nested text parsing.**
- [ ] **Step 2: Run `npm test -- src/lib/gemini-service.test.ts` and verify the tests fail before implementation.**
- [ ] **Step 3: Implement `src/lib/gemini-service.ts` with the Gemini Interactions API.**
- [ ] **Step 4: Run `npm test -- src/lib/gemini-service.test.ts` and verify the tests pass.**

### Task 2: Application Import Swap

**Files:**
- Modify: all server function files importing the previous provider service
- Modify: docs that mention the previous provider key

**Interfaces:**
- Consumes: helpers from `src/lib/gemini-service.ts`.
- Produces: no `src` references to the previous provider names or env vars.

- [ ] **Step 1: Replace imports from the previous provider service with `./gemini-service`.**
- [ ] **Step 2: Update docs to `GEMINI_API_KEY` where they describe current deployment setup.**
- [ ] **Step 3: Run a provider-reference search and confirm no current app-code references remain.**

### Task 3: Verification

**Files:**
- No new files.

**Interfaces:**
- Consumes: completed Gemini provider and import swap.
- Produces: verified build-ready checkout.

- [ ] **Step 1: Run `npm test`.**
- [ ] **Step 2: Run `npx tsc --noEmit`.**
- [ ] **Step 3: Run changed-file lint for the modified files.**
- [ ] **Step 4: Run `npm run build`.**
- [ ] **Step 5: Commit the completed change.**
