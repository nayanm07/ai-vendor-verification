# Architecture

## Overview

A classic three-tier app: a React SPA talks to an Express REST API, which persists to PostgreSQL via
Prisma and calls three external services (OpenAI, OpenCorporates, an email provider). The API is the
single place that holds secrets and orchestrates the verification workflow.

```
┌──────────────┐     REST/JSON      ┌─────────────────────────────┐      ┌──────────────┐
│  React SPA   │  ───────────────►  │   Express API (TypeScript)  │ ───► │ PostgreSQL   │
│  (Vite)      │  ◄───────────────  │                             │      │  (Prisma)    │
└──────────────┘                    │  services ── integrations   │      └──────────────┘
                                    └──────┬─────────┬─────────┬──┘
                                           │         │         │
                                      OpenAI   OpenCorporates  Email
                                   (extract/    (live | mock)  (Resend | SMTP/Mailpit)
                                    compare)
```

## Backend layering

The server separates concerns into three layers so that external APIs and the database are easy to
swap or mock:

- **routes/** — thin HTTP layer: parse + validate (Zod), call a service, shape the response.
- **services/** — all business logic (vendor CRUD + versioning, extraction, comparison, verification,
  checklist, notifications, tasks, the workflow state machine). Services never touch `req`/`res`.
- **integrations/** — adapters for external systems behind an interface, each with a real and a
  fallback implementation selected from env config:
  - `opencorporates/` — `LiveOpenCorporatesClient` (v0.4 REST) and `MockOpenCorporatesClient`
    (same response shape, fictitious fixtures) behind `CompanyRegistryClient`.
  - `email.ts` — `ResendProvider` and `SmtpProvider` behind `EmailProvider`.

Cross-cutting: a single Express error-handling middleware maps domain errors (`HttpError`), Zod
validation errors, Multer upload errors and Prisma "not found" into consistent JSON responses.

## Data model (PostgreSQL via Prisma)

| Model | Purpose |
|---|---|
| `Vendor` | the 9 vendor fields + `status` + `currentVersion` |
| `VendorVersion` | immutable snapshot + field-level diff per save; enables restore |
| `Document` | uploaded file metadata + AI `extractedData` (JSON) + extraction status |
| `Comparison` | latest AI cross-document comparison result (JSON) |
| `Verification` | each OpenCorporates attempt: result, registry record, raw response, errors |
| `Task` | workflow tasks (priority, due date, Pending/Completed); auto or manual |
| `EmailLog` | every missing-document email sent (for dedupe + audit) |
| `Activity` | audit trail of workflow events (status changes, emails, tasks, checks) |

All child records cascade-delete with the vendor. JSON columns store the shape-flexible AI output and
raw API responses while keeping the relational structure for everything queried.

## Key flows

**AI extraction.** The uploaded file is sent to OpenAI (PDF as a file part, images as base64) with a
strict JSON schema (Structured Outputs), so the model must return exactly the expected fields.
A deterministic post-processing step then normalises identifiers (strip spaces, uppercase), drops
placeholder "null" strings, de-duplicates an ID copied into two fields, and ignores a bank letter's
branch address — things the model shouldn't be trusted to do consistently.

**AI comparison.** For each field, the API gathers values only from the sources expected to carry it
(e.g. a GST number isn't expected on a bank letter), then asks OpenAI to classify each field as
Match / Mismatch / Missing with a short note. The per-source values are attached server-side so the
UI can show the full table.

**Company verification.** Look up by registration number first, then fall back to a name search;
compare the registry record against the vendor (name with suffix normalisation, number, address
token overlap, active status) → Verified / Mismatch / Unable to Verify. Network, auth, rate-limit,
timeout and not-found cases are all handled and recorded.

**Workflow automation.** Entering review (or any document/verification change) runs
`evaluateVendor`: it collects the current issues (missing docs, document mismatches, registry
mismatch/failure), emails the vendor about missing documents (deduplicated via `EmailLog`), opens a
task per new issue and auto-completes tasks whose issue is resolved, and flips the status between
Under Review and Action Required. Approval is blocked while tasks are pending. Every step is written
to `Activity`.

## Security & configuration

- All API credentials come from environment variables; `.env` is git-ignored, `.env.example` is
  committed as documentation.
- Uploads are constrained by type and size (10 MB) and stored outside the repo-tracked tree.
- Request bodies and AI responses are validated with Zod before use.
- The external integrations fail safe: a missing/invalid credential yields a clear, handled error
  (e.g. "Unable to Verify") rather than a crash.

## Trade-offs

- **Local file storage** for uploads keeps the setup simple; production would use object storage (S3).
- **Mock OpenCorporates / Mailpit** make the app fully demonstrable without approved third-party
  accounts, while the live adapters are a config flag away.
- **No auth** — out of scope for the assessment; the API assumes a single trusted reviewer.
