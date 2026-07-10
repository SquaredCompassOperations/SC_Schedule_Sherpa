# Lovable Removal And Document Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Lovable AI/runtime dependencies with app-owned Gemini document extraction and direct Vite/TanStack config.

**Architecture:** Add a local document extraction helper and a single Gemini service wrapper. Existing server functions keep their names but swap Lovable calls for the new helper. Build config uses official plugins directly.

**Tech Stack:** TanStack Start server functions, React, Vite, Nitro Vercel preset, Gemini Interactions API via `fetch`, JSZip, XLSX, Vitest, TypeScript.

## Global Constraints

- No `LOVABLE_API_KEY` runtime dependency remains.
- No user-facing error text mentions Lovable.
- `GEMINI_API_KEY` is server-only and never exposed with `VITE_`.
- Gemini model is configurable through `GEMINI_MODEL`.
- File uploads keep the existing 12 MB UI limit.
- Manual entry remains available when extraction fails.

---

### Task 1: Document The Approved Design

**Files:**
- Create: `docs/superpowers/specs/2026-07-10-lovable-removal-document-extraction-design.md`
- Create: `docs/superpowers/plans/2026-07-10-lovable-removal-document-extraction.md`

**Interfaces:**
- Consumes: approved user direction to use Gemini
- Produces: implementation reference for the cleanup

- [ ] **Step 1: Write the design and plan files.**
- [ ] **Step 2: Review both files for placeholders and contradictions.**
- [ ] **Step 3: Include both files in the final commit.**

### Task 2: Add Local File Extraction

**Files:**
- Create: `src/lib/file-extraction.ts`
- Create: `src/lib/file-extraction.test.ts`

**Interfaces:**
- Produces: `extractFileText(input): Promise<ExtractedFileText>`
- Produces: `buildDataUrl(mediaType, dataBase64): string`

- [ ] **Step 1: Write failing tests for text, DOCX, XLSX, and binary fallback behavior.**
- [ ] **Step 2: Run `npm test -- src/lib/file-extraction.test.ts` and confirm it fails because the module is missing.**
- [ ] **Step 3: Implement local extraction using JSZip and XLSX.**
- [ ] **Step 4: Run `npm test -- src/lib/file-extraction.test.ts` and confirm it passes.**

### Task 3: Add Gemini Service

**Files:**
- Create: `src/lib/gemini-service.ts`
- Delete: `src/lib/ai-gateway.ts`

**Interfaces:**
- Consumes: `extractFileText`, `buildDataUrl`
- Produces: `generateTextFromPrompt`
- Produces: `generateTextFromDocument`
- Produces: `generateTextFromImage`

- [ ] **Step 1: Implement a Gemini Interactions API wrapper using `fetch`.**
- [ ] **Step 2: Use `GEMINI_API_KEY` and optional `GEMINI_MODEL`.**
- [ ] **Step 3: Return `output_text` or reconstructed output text.**
- [ ] **Step 4: Throw a clear `GEMINI_API_KEY` configuration message when missing.**

### Task 4: Replace Lovable AI Calls

**Files:**
- Modify: `src/lib/intake-extract.functions.ts`
- Modify: `src/lib/price-list-extract.functions.ts`
- Modify: `src/lib/sba-lookup.functions.ts`
- Modify: `src/lib/financials-check.functions.ts`
- Modify: `src/lib/narrative.functions.ts`
- Modify: `src/lib/market-validation.functions.ts`
- Modify: `src/lib/sca-suggest.functions.ts`
- Modify: `src/lib/sin-crawler.functions.ts`
- Modify: `src/lib/price-list-crawl.functions.ts`

**Interfaces:**
- Consumes: Gemini service helpers
- Produces: unchanged server function exports used by routes

- [ ] **Step 1: Replace document upload extraction with `generateTextFromDocument`.**
- [ ] **Step 2: Replace screenshot extraction with `generateTextFromImage`.**
- [ ] **Step 3: Replace prompt-only calls with `generateTextFromPrompt`.**
- [ ] **Step 4: Search for `LOVABLE`, `lovable`, and `ai.gateway.lovable.dev`; fix all remaining app-code hits.**

### Task 5: Remove Lovable Build Package

**Files:**
- Modify: `vite.config.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `bun.lock`
- Modify: `src/routes/__root.tsx`

**Interfaces:**
- Consumes: official plugin imports from installed dependencies
- Produces: Vercel build using Nitro preset without Lovable config

- [ ] **Step 1: Replace `@lovable.dev/vite-tanstack-config` with official Vite/TanStack/React/Tailwind/Nitro config.**
- [ ] **Step 2: Remove Lovable dev dependency and lockfile entries.**
- [ ] **Step 3: Replace Lovable preview image URLs in app metadata with no image metadata for now.**

### Task 6: Verify And Commit

**Files:**
- All changed files

**Interfaces:**
- Consumes: completed Tasks 1-5
- Produces: commit on `main`

- [ ] **Step 1: Run `npm test -- src/lib/file-extraction.test.ts`.**
- [ ] **Step 2: Run `npx tsc --noEmit`.**
- [ ] **Step 3: Run `npm test`.**
- [ ] **Step 4: Run `npm run build`.**
- [ ] **Step 5: Commit with message `Remove Lovable AI dependencies`.**
- [ ] **Step 6: Push `main` when network access allows.**
