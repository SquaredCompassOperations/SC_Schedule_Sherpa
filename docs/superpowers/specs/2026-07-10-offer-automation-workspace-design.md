# Offer Automation Workspace Production Rebuild Design

Date: 2026-07-10

## Summary

Rebuild the current Schedule Sherpa app into a production-backed **Offer Automation Workspace**. The first fully supported workflow is **GSA MAS end-to-end**, while the data model and navigation allow later expansion to VA FSS, GWAC/RFP, and custom solicitation workflows.

The rebuild should use Supabase as the source of truth for offers, client access, workflow state, artifacts, reviews, timeline history, and submission tracking. The existing intake, readiness, SIN, market validation, document generation, pricing workbook, review, export, submission, and client portal modules should be reused where they fit, but they must be moved away from single-user browser-only state and into selected offer workspaces.

## Product Decisions

1. Build the production foundation first, not a throwaway Loom replica.
2. Support GSA MAS end-to-end first.
3. Keep offer type selection and schema shape expansion-ready for VA FSS, GWAC/RFP, and other solicitations.
4. Preserve Squared Compass automatic admin access for `@squaredcompass.com` emails.
5. Let admins manage all workspaces; let client users see only assigned workspaces.
6. Keep manual entry available whenever AI extraction, crawling, or generation fails.
7. Replace the old "ScheduleBuilder" framing with "Offer Automation Workspace."

## Goals

- Provide a real multi-client workspace board for Squared Compass admins.
- Let each client company have one or more offer workspaces.
- Let admins assign client users to specific offers.
- Persist all important workflow state in Supabase so reloads, browsers, and users stay synchronized.
- Recreate the redesigned Loom workflow as one guided workspace instead of scattered tools.
- Support the full GSA MAS lifecycle: intake, readiness, automation, review, client sign-off, eOffer package export, submission checklist, and post-submission tracking.
- Restrict authorized negotiator certification to the matching negotiator email with signing authority.
- Maintain a useful client portal with readiness tasks, uploads, review/sign-off tasks, timeline, and status updates.
- Make the workspace board update when readiness, document review, client actions, or submission state changes.

## Non-Goals For The First Production Rebuild

- Fully automate every non-GSA offer type.
- Replace every current route in one large rewrite.
- Require AI or web crawling to complete the workflow.
- Build Monday.com integration in the first pass.
- Build a no-code editor inside the app.

## Current State

The current app already has useful module routes:

- Admin workflow routes: intake, readiness, SIN recommendation, market validation, SCA/LCAT confirmation, document generation, pricing workbook, review, export, submission, and status pages.
- Client routes: overview, readiness, documents, review, timeline, and messages.
- Supabase authentication and RBAC are already present, with `admin` and `client` roles.
- Most workflow state currently lives in local browser stores such as intake, automation, document, review, module status, activity, and submission stores.
- Static mock data still provides much of the workspace frame.

The rebuild should keep useful module logic, but the selected offer workspace must become the central data boundary.

## Core Domain Model

### Organizations

An organization is a client company. It stores client identity and account-level metadata.

Important fields:

- legal name
- DBA
- website
- primary contact
- organization status
- created and updated timestamps

### Offers / Workspaces

An offer workspace represents one submission effort for one organization.

Important fields:

- organization ID
- offer name
- offer type, initially `gsa_mas`
- solicitation number
- agency or vehicle name
- owner/admin lead
- current stage
- status
- readiness percentage
- target dates
- selected SINs
- locked or archived state
- created and updated timestamps

### Offer Members

Offer members connect users to offers.

Important fields:

- offer ID
- user ID
- member role, such as admin lead, reviewer, client contributor, authorized negotiator, or viewer
- invitation email for users who have not signed in yet
- active/inactive state

### Offer Intake

Offer intake holds structured company and offer data.

Important fields:

- SAM.gov profile fields
- UEI, CAGE, EIN, NAICS, SAM status, SAM expiration
- physical and mailing addresses
- SBA status
- negotiators
- authorized signer flags
- readiness questionnaire answers
- client submission timestamp

### Offer Artifacts

Artifacts represent uploaded and generated files.

Important fields:

- offer ID
- artifact type
- workflow section
- original filename
- storage path or generated content reference
- extracted metadata
- upload source, such as admin, client, OCR, or generated
- visibility, such as admin-only or client-visible
- created timestamp

### Offer Documents

Offer documents represent generated or uploaded deliverables.

Important fields:

- offer ID
- document kind
- title
- body/content
- source fields used
- status: draft, in review, final, not applicable
- comments
- sign-offs
- client visibility
- saved timestamp

Required first-pass GSA MAS documents include:

- Corporate Experience narrative
- Quality Control narrative
- Relevant Project Experience or Startup Springboard substitution
- EPA narrative
- Uncompensated Overtime policy
- Professional Compensation Plan
- Agent authorization letter

### Offer Pricing

Offer pricing holds pricing workbook and market validation data.

Important fields:

- offer ID
- selected SINs
- selected LCATs
- extracted price list rows
- market validation rows
- pricing workbook template
- workbook rows
- pricing terms
- saved timestamp

### Offer Reviews

Offer reviews hold review gates and approval history.

Important fields:

- offer ID
- stage name
- reviewer or owner role
- status
- required deliverables
- comments
- approved by
- approved timestamp
- requested changes

Required first-pass gates:

- Intake QA
- SIN mapping review
- Pricing review
- Compliance matrix sign-off
- Authorized negotiator certification

### Offer Submission

Offer submission holds eOffer export and post-submission tracking.

Important fields:

- offer ID
- generated package record
- eOffer checklist item statuses
- uploaded-to-portal marker
- confirmation number
- submitted by
- submitted timestamp
- receipt artifact
- post-submission events
- archive/lock state

### Offer Activity

Offer activity records timeline events.

Important fields:

- offer ID
- actor user ID or system actor
- module
- action
- target
- visibility
- timestamp

The activity log should support both admin audit history and client-visible timeline updates.

## Admin Experience

### Workspace Board

Admins land on a workspace board showing active offers grouped by stage.

Each card should show:

- client/company name
- offer type
- current stage
- readiness percentage
- documents in review
- open client items
- authorized negotiator status
- submission status
- next action

The board should support filters for:

- client
- offer type
- owner
- blocked items
- review status
- stage

Opening a card enters that offer workspace.

### Workspace Shell

Inside an offer, the workspace shell should provide:

- offer selector
- offer summary
- stage progress
- next action
- admin/client mode-aware navigation
- quick links into workflow sections

The main admin workflow order is:

1. Intake
2. Readiness
3. Automation
4. Review
5. Client Portal preview/context
6. Submission

Every page should answer: "What is the next action for this offer?"

## GSA MAS Workflow

### Intake

Admins can upload and extract data from:

- SAM.gov profile
- solicitation or RFQ/RFP packet
- professional compensation plan
- uncompensated overtime policy
- corporate price list
- company logo
- P&L statements
- balance sheets
- past performance documents
- PPQs
- proposals
- capability statements
- case studies

The SAM profile extraction should feed corporate identity, address, SAM status, and Government Business POC details. Government Business POC should seed an authorized negotiator candidate. Admins must be able to add or edit negotiators manually.

The intake screen should also support manual entry for EIN and DUNS/UEI-related fields where extraction is incomplete.

### Readiness

Readiness should calculate blockers from intake and client questionnaire data.

It should show:

- readiness percentage
- missing required fields
- missing documents
- financial review issues
- SAM/SBA status issues
- negotiator/signing authority gaps
- next recommended action

Readiness can reach completion when required GSA MAS fields, documents, and questionnaire answers are present.

### Automation

The automation section follows the four-bucket Loom model:

1. AI narrative drafts
2. Market validation
3. Agent authorization
4. Pricing workbook

#### AI Narrative Drafts

Narrative generation should create editable drafts in offer documents. The user can finalize drafts or mark them for review. Each draft should show the fields and artifacts used as sources.

#### Market Validation

Market validation is enabled for GSA MAS. It should support selected SINs, market rows, source URLs, and manual row entry. If crawlers or external data lookups fail, users can enter validation data manually and continue.

#### Agent Authorization

Agent authorization should generate a letter or certification package from the offer's organization, negotiator, and signer data. Authorized signer visibility and signing actions must respect negotiator permissions.

#### Pricing Workbook

Pricing workbook should support:

- selected SIN confirmation
- FCP product or FCP services-plus template selection
- extracted or manually entered LCAT rows
- descriptions
- generated or manually entered keywords
- education and experience minimums
- units of measure
- proposed prices
- pricing terms

The workbook status feeds review readiness and export readiness.

### Review

The review area should support:

- document status counts: draft, in review, final, not applicable
- admin review queue
- requested changes
- client-ready items
- compliance matrix status
- gate approvals
- authorized negotiator certification

The compliance matrix should not mark incomplete mapping as done. Draft or not-applicable requirements must display correctly.

### Client Portal

Clients see only assigned offers.

The client portal should include:

- readiness questionnaire
- missing intake items
- document upload requests
- client-visible timeline
- review/sign-off tasks
- requested changes
- submission status
- package uploaded marker where appropriate

Authorized negotiator-only documents and certification actions must only be available to the authorized negotiator email with signing authority.

### Submission

Submission should include:

- generate eOffer package record
- checklist for downloading the package
- verify package
- log into eOffer
- upload package by section
- authorized negotiator certify
- submit and capture confirmation
- upload or record receipt

After authorized negotiator certification, the post-submission workflow must become available.

Post-submission tracking should support:

- confirmation number
- submitted timestamp
- submitted by
- contracting officer assignment
- clarification requests
- clarification responses
- negotiation notes
- final proposal revision
- award, rejection, or withdrawal
- archive/lock final package

## Permissions And Security

Supabase row-level security is required for all offer tables.

Rules:

- Admin users can access all organizations, offers, artifacts, documents, reviews, and submission records.
- Client users can access only offers where they are active offer members.
- Client users cannot access unassigned offers by URL.
- Client users can only update client-approved fields and actions.
- Authorized negotiator certification requires a matching negotiator email with signing authority on the offer.
- Service-role server functions may perform trusted admin operations, but client-side code must not expose service-role capabilities.

## Data Flow

1. User signs in through Supabase auth.
2. App resolves app role and offer membership.
3. Admins load the workspace board; clients load their assigned workspace list or active workspace.
4. Selecting an offer creates a workspace context for all workflow modules.
5. Modules read and write through offer-scoped data functions.
6. Mutations write workflow data and append offer activity events.
7. Board cards, readiness, review queues, timelines, and client status derive from Supabase state.

## Error Handling And Manual Fallbacks

The workflow must remain usable if an automation fails.

Examples:

- If SAM extraction fails, the user can manually enter the corporate profile.
- If SIN crawling fails, the user can manually choose SINs.
- If market validation fails, the user can enter market rows manually.
- If narrative generation fails, the user can draft manually in the document editor.
- If export generation fails, the app shows the missing inputs and keeps finalized source artifacts intact.

Errors should be visible near the action that failed and should not erase user-entered data.

## Rollout Plan

### Phase 1: Supabase Foundation

- Add offer workspace tables, RLS policies, and typed access helpers.
- Seed or create one active GSA MAS demo/workspace from existing browser-state assumptions.
- Add offer membership and client assignment rules.

### Phase 2: Workspace Board And Shell

- Replace the default admin landing experience with the workspace board.
- Add selected workspace context.
- Add workspace selector and offer summary.
- Keep existing routes available while they are being migrated.

### Phase 3: Move State To Offer Scope

- Migrate intake, readiness, automation, document, review, activity, and submission state to Supabase-backed offer data.
- Keep local state only for temporary unsaved form edits.

### Phase 4: Loom-Style Admin Workflow

- Rework admin pages around the guided GSA MAS flow.
- Add automation bucket landing page.
- Correct review queue, compliance matrix, authorized negotiator certification, and post-submission availability.

### Phase 5: Client Portal Rebuild

- Rebuild client portal around assigned workspaces.
- Add client readiness, uploads, review/sign-off, timeline, and submission status.
- Enforce authorized negotiator-only actions.

### Phase 6: Export And Submission Tracking

- Generate eOffer package records from finalized offer artifacts.
- Add submission checklist and post-submission tracker.
- Add archive/lock behavior for completed submissions.

### Phase 7: Visual Polish And Naming Cleanup

- Rename product framing from ScheduleBuilder to Offer Automation Workspace.
- Polish navigation, cards, tables, timelines, and workflow status.
- Remove stale mock-only UI where production state has replaced it.

## Testing And Acceptance Criteria

Automated tests should cover:

- Admin role resolution.
- Client role resolution.
- Workspace access for assigned clients.
- URL access denial for unassigned clients.
- Authorized negotiator certification permissions.
- Offer board status derivation.
- Review gate status derivation.
- Submission checklist and post-submission state transitions.
- Manual fallback paths for failed automation functions.

Manual verification should cover:

- Squared Compass user sees all workspaces.
- Client user sees only assigned workspaces.
- Admin creates a GSA MAS offer and assigns a client.
- Intake data persists after reload.
- Readiness updates after missing fields are fixed.
- Documents can move from draft to review to final.
- Client can sign allowed deliverables.
- Non-negotiator cannot certify.
- eOffer package can be generated from finalized artifacts.
- Submission confirmation starts the post-submission tracker.
- Vercel production build passes.

## Risks And Mitigations

### Risk: Scope Is Large

Mitigation: implement in phases, starting with the Supabase foundation and workspace shell. Keep each module migration small and independently verifiable.

### Risk: Existing Local Stores Are Entangled With UI

Mitigation: introduce offer-scoped data helpers and migrate one module at a time. Preserve the old module behavior until the Supabase-backed replacement is verified.

### Risk: RLS Mistakes Could Expose Client Data

Mitigation: write RLS policies first, add access tests, and manually verify assigned versus unassigned client accounts before production use.

### Risk: AI/Crawler Reliability

Mitigation: treat automation as acceleration, not the only path. Every generated or extracted field must remain editable.

### Risk: Big Visual Rework Could Hide Broken Workflow State

Mitigation: build the board and workflow shell around real derived statuses before visual polish.

## Implementation Boundary

The next step is to write a detailed implementation plan. That plan should break this design into small commits, starting with:

1. Supabase offer workspace schema and policies.
2. Offer workspace data access helpers.
3. Workspace board and selected workspace shell.
4. First migrated module using offer-scoped state.

Implementation should not begin until this design spec has been reviewed and approved.
