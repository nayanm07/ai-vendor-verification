# AI-Powered Vendor Verification Workspace

A full-stack application for onboarding and verifying a vendor/company. It covers the complete
flow from the assessment brief:

> Vendor Details → Upload Documents → AI Extraction → AI Comparison → Company API Verification →
> Missing Document → Email Client → Review → Approve/Reject

## Technologies Used

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite, React Router |
| Backend | Node.js + Express 5 (TypeScript, ESM) |
| Database | PostgreSQL 16 via Prisma ORM |
| **AI API** | **OpenAI** (`gpt-4o-mini`) — document extraction + cross-document comparison, using Structured Outputs (JSON schema) |
| **Company verification API** | **OpenCorporates** v0.4 REST API (with a built-in offline mock — see below) |
| **Email service** | **Resend** (sandbox) or any **SMTP** server; ships with **Mailpit** in Docker for local testing |
| Validation | Zod (request bodies + AI output) |
| File upload | Multer (local `uploads/` folder) |

## Prerequisites

- **Node.js 20+** (developed on Node 22)
- **Docker** (for PostgreSQL + Mailpit via `docker-compose.yml`) — or your own PostgreSQL instance
- An **OpenAI API key** (required for extraction/comparison)
- *(Optional)* an **OpenCorporates API token** and/or a **Resend API key**

## How to Run

```bash
# 1. Install dependencies (root + server + client)
npm run install:all

# 2. Start PostgreSQL + Mailpit (SMTP test inbox)
npm run db:up                 # docker compose; Postgres on :5440, Mailpit UI on http://localhost:8026
                              # (Docker inside WSL on Windows: npm run db:up:wsl)

# 3. Configure environment
cp server/.env.example server/.env
#    then edit server/.env and set at least OPENAI_API_KEY

# 4. Create the database schema
npm --prefix server run db:migrate

# 5. Run the app (API + web together)
npm run dev
```

- **Web app:** http://localhost:5173
- **API:** http://localhost:4010 (health check at `/api/health`)
- **Test email inbox (Mailpit):** http://localhost:8026

Sample vendor documents (fictitious) are in [`sample-docs/`](./sample-docs). The registration and GST
certificates deliberately differ in the company name (`ABC Technologies` vs `ABC Technology`) to
demonstrate mismatch detection.

### Environment variables (`server/.env`)

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `OPENAI_API_KEY` | yes | OpenAI extraction + comparison |
| `OPENAI_MODEL` | no | defaults to `gpt-4o-mini` |
| `OPENCORPORATES_API_TOKEN` | no | enables the **live** OpenCorporates API |
| `OPENCORPORATES_MODE` | no | `auto` (default) / `live` / `mock` |
| `RESEND_API_KEY` | no | enables Resend; otherwise SMTP is used |
| `EMAIL_PROVIDER` | no | `auto` (default) / `resend` / `smtp` |
| `SMTP_HOST` / `SMTP_PORT` | no | default to Mailpit (`localhost:1026`) |

Secrets are read from environment variables only; `.env` is git-ignored and `.env.example`
documents every key.

## A note on the external APIs (please read before the demo)

This is an assessment build, so I used my **own** API keys and have **not** committed them. Two
integrations are designed to degrade gracefully so the app is fully runnable and demonstrable even
without paid/approved accounts:

- **OpenCorporates** — a new API token requires manual approval that may not arrive in time. With no
  token, the app runs in **mock mode**: it returns data in the exact OpenCorporates v0.4 response
  shape from a small set of **fictitious** fixtures, so Verified / Mismatch / Unable-to-Verify and
  all error paths (timeout, rate-limit, auth, not-found) can be demonstrated. Setting
  `OPENCORPORATES_API_TOKEN` switches to the real API automatically — no code change. Mock results
  are clearly labelled "Mock data" in the UI.
- **Email** — with no `RESEND_API_KEY`, the app sends through **SMTP to Mailpit** (bundled in Docker)
  so missing-document emails are actually delivered and viewable at http://localhost:8026. Setting a
  Resend key switches to Resend automatically.

OpenAI is the one key you must supply for the AI features to work.

## Features (mapped to the brief)

1. **Vendor Details** — form with all 9 fields, create + edit, server-side validation.
2. **Document Upload & AI Extraction** — upload Registration / GST / Bank documents (PDF or image);
   OpenAI extracts the fields; results are shown and are editable by the reviewer.
3. **AI Comparison** — compares the vendor form against every extracted document and flags
   mismatches / missing information per field.
4. **Company Verification** — OpenCorporates lookup (by registration number, falling back to name),
   compared against the vendor → **Verified / Mismatch / Unable to Verify**, with error handling.
5. **Document Checklist + Email** — Available / Missing / Verified per document; a missing document
   triggers an automatic email to the vendor (deduplicated, logged).
6. **Verification Workflow** — Draft → Under Review → Action Required → Approved / Rejected, with
   auto-created tasks (priority, due date, Pending/Completed) when action is required.
7. **Version History** — every vendor edit snapshots a version with a field-level diff
   (previous → new value, timestamp); any version can be restored.

## Project Structure

```
server/            Express + Prisma API (TypeScript)
  prisma/          schema.prisma + migrations
  src/
    integrations/  opencorporates (live + mock), email (resend + smtp)
    services/      vendor, document, ai, verification, checklist,
                   notification, task, workflow
    routes/        REST endpoints
    middleware/    upload, error handler
client/            React + Vite frontend (TypeScript)
sample-docs/       fictitious test PDFs
docker-compose.yml PostgreSQL + Mailpit
ARCHITECTURE.md    design overview
ROADMAP.md         build plan
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the design, data model, and request flow.

## Production readiness

This was built as a time-boxed assessment. The structure is meant to carry into production
(layered services, swappable integrations, validated inputs and AI output, migrations, an audit
trail), but these are the deliberate gaps I would close before handling real vendor data:

| Area | Current state | Production next step |
|---|---|---|
| Authentication | None; the API assumes one trusted reviewer | Login + role-based access (reviewer / admin) on every route |
| Sensitive data | Bank details stored in plain text and sent to OpenAI | Field-level encryption at rest; mask in UI and logs; data-processing agreement for AI calls |
| Tests | Verified manually and with a scripted browser run | Unit tests for services, API integration tests, an end-to-end suite in CI |
| File uploads | Local disk; type checked from the browser-reported MIME type | Object storage (e.g. S3) with signed URLs; check file contents, not just the declared type; virus scan |
| AI calls | Run inside the HTTP request | Background job queue with retries, so slow model responses don't hold requests |
| Concurrency | Evaluations serialised per vendor in-process | DB-level lock (`pg_advisory_xact_lock`) once the API runs as multiple instances |
| Abuse / cost | No rate limiting or security headers | Rate limiting (especially on AI endpoints), Helmet, request size and per-user quotas |
| Operations | Dev servers only | Dockerfile for the app, CI/CD, structured logging, error monitoring, health/readiness probes |
