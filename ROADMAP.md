# Roadmap: AI-Powered Vendor Verification Workspace

**Deadline:** 22:00 today · **Start:** ~12:00 · **Available:** ~10 hours

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite (TypeScript) | Quick setup. Design is low priority, so plain forms and tables are enough. |
| Backend | Node.js + Express | Simple REST API. Node 22 is already installed. |
| Database | PostgreSQL + Prisma | Production-grade relational DB with native JSON columns. `schema.prisma` is the schema deliverable. |
| AI | OpenAI API (`gpt-4o-mini` or newer) | Reads PDFs and images directly. Structured Outputs (JSON schema) give reliable JSON, so no OCR step. |
| Verification | OpenCorporates API | The preferred API in the brief. |
| Email | Resend (sandbox) | Free and takes about 5 lines of code. |
| File upload | Multer | Saves files to a local `/uploads` folder. |

---

## Phase 0: Setup & API Keys (12:00–12:30)

> **OpenCorporates can take a while to approve a token.** Apply first and build the other parts while you wait.

- [ ] Apply for an OpenCorporates API token
- [ ] Get an OpenAI API key from platform.openai.com (check it has billing credit)
- [ ] Get a Resend API key (sandbox only sends to **your own** email)
- [x] Set up PostgreSQL: local install, Docker (`docker run -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16`), or free Neon cloud DB
- [x] Create the monorepo: `/client` (React + Vite) and `/server` (Express)
- [x] Install server deps: express, prisma, @prisma/client, multer, cors, dotenv, openai, resend
- [x] Run `prisma init --datasource-provider postgresql` and set `DATABASE_URL` in `.env`
- [x] Create `.env` and `.env.example`, and add `.env` and `/uploads` to `.gitignore`
- [x] `git init` and make the first commit

---

## Phase 1: Vendor CRUD + Versioning (12:30–13:30)

- [x] Prisma models: `Vendor` and `VendorVersion`
- [x] Run the migration
- [x] `POST /api/vendors`: create a vendor and save version 1
- [x] `GET /api/vendors` and `GET /api/vendors/:id`
- [x] `PUT /api/vendors/:id`: update the vendor, compute changed fields and save a new version
- [x] Input validation (required fields, email format, IFSC/GST format)
- [x] Frontend: vendor list page
- [x] Frontend: vendor form with 9 fields (create and edit)

---

## Phase 2: Document Upload + AI Extraction (13:30–15:30)

- [x] Prisma model: `Document`
- [x] Multer upload (PDF/JPG/PNG, size limit)
- [x] `POST /api/vendors/:id/documents` with docType (Registration / GST / Bank)
- [x] OpenAI extraction service: send the file (PDF as file input, images as base64) and use Structured Outputs to get JSON back (companyName, regNumber, gstNumber, address, bankAccount, ifsc)
- [x] Save `extractedData` to the database
- [x] Handle AI errors (bad file, API failure, invalid JSON)
- [x] `PUT /api/documents/:id`: edit extracted data
- [x] Frontend: upload section with a doc type dropdown
- [x] Frontend: editable table of extracted data per document

---

## Phase 2b: AI Comparison (15:30–16:00)

- [x] Prisma model: `Comparison`
- [x] `POST /api/vendors/:id/compare`: send all extracted data plus vendor data to OpenAI
- [x] OpenAI returns, for each field: values per source and Match / Mismatch / Missing
- [x] Save the result
- [x] Frontend: comparison table with mismatches highlighted

---

## Lunch / Buffer (16:00–16:30)

- [ ] Take a break 🍽️

---

## Phase 3: OpenCorporates Verification (16:30–17:45)

> Mock mode: with no `OPENCORPORATES_API_TOKEN`, an offline mock returning the real v0.4 response shape is used (fixtures: ABC Technologies = Verified, XYZ Global Solutions = Mismatch, Globex = struck off; `SIMULATE_TIMEOUT` / `SIMULATE_RATE_LIMIT` / `SIMULATE_AUTH_ERROR` as reg number simulate API errors). Setting the token switches to the live API automatically.

- [x] Prisma model: `Verification`
- [x] OpenCorporates service: search by registration number, falling back to company name
- [x] Fetch company details (name, number, address, status)
- [x] Compare with vendor data, giving **Verified / Mismatch / Unable to Verify**
- [x] Handle errors: missing or invalid token (401), not found (404), rate limit (429), timeout
- [x] `POST /api/vendors/:id/verify`
- [x] Frontend: verification result card with a status badge

---

## Phase 4: Document Checklist + Email (17:45–18:45)

- [ ] Prisma model: `EmailLog`
- [ ] Checklist logic: Registration / GST / Bank, each **Available / Missing / Verified**
- [ ] `GET /api/vendors/:id/checklist`
- [ ] Resend email service (company name, missing doc, request to provide it)
- [ ] Send automatically when a required doc is missing
- [ ] Log each email so the same one isn't sent twice
- [ ] `POST /api/vendors/:id/notify-missing` (manual resend)
- [ ] Frontend: checklist table plus email log

---

## Phase 5: Workflow + Tasks (18:45–19:45)

- [ ] Prisma model: `Task`
- [ ] Status flow: Draft → Under Review → Action Required → Approved / Rejected
- [ ] Validate allowed status transitions
- [ ] Automatically set **Action Required** on a missing doc or a mismatch
- [ ] Automatically create a Task (title, priority, due date, Pending)
- [ ] `PATCH /api/vendors/:id/status`: reviewer update
- [ ] `GET /api/tasks` and `PATCH /api/tasks/:id` (Pending / Completed)
- [ ] Frontend: status badge plus reviewer dropdown
- [ ] Frontend: task list with a complete button

---

## Phase 6: Version History UI (19:45–20:15)

- [x] `GET /api/vendors/:id/versions`
- [x] `POST /api/vendors/:id/versions/:v/restore`: restoring creates a new version
- [x] Frontend: version list showing previous value → new value and the date/time
- [x] Frontend: Restore button

---

## Polish (20:15–21:00)

- [x] Global error handler on the server
- [ ] Loading and error states in the frontend
- [x] Make 3 sample PDFs (Registration, GST, Bank), one with a deliberate name mismatch
- [ ] Test the full flow end to end
- [ ] Write the README: technologies, AI API, verification API, email service, database, how to run
- [ ] Write the architecture explanation (with a simple diagram)

---

## Demo Video (21:00–21:45)

- [ ] Write a short demo script
- [ ] Record 5 minutes following this order: Vendor Details → Upload → AI Extraction → AI Comparison → Company API Verification → Missing Document → Email → Review → Approve/Reject

---

## Submit (21:45–22:00)

- [ ] Working application
- [ ] Source code pushed to GitHub
- [ ] Database schema (`schema.prisma`)
- [ ] README
- [ ] Architecture explanation
- [ ] 5-minute demo video
- [ ] Send the submission ✅

---

## Database Schema (Draft)

```
Vendor          id, companyName, contactPerson, email, phone, address,
                regNumber, gstNumber, bankAccount, ifsc,
                status, currentVersion, createdAt, updatedAt

VendorVersion   id, vendorId, versionNo, snapshot (JSON),
                changedFields (JSON), createdAt

Document        id, vendorId, docType, filePath,
                extractedData (JSON), status, uploadedAt

Comparison      id, vendorId, result (JSON), createdAt

Verification    id, vendorId, source,
                result (Verified | Mismatch | Unable), rawResponse (JSON), createdAt

Task            id, vendorId, title, priority, dueDate,
                status (Pending | Completed), createdAt

EmailLog        id, vendorId, toEmail, subject, missingDoc, status, sentAt
```

---

## API Routes

```
POST   /api/vendors                          create vendor
GET    /api/vendors                          list vendors
GET    /api/vendors/:id                      get vendor
PUT    /api/vendors/:id                      update vendor (creates a version)

GET    /api/vendors/:id/versions             version history
POST   /api/vendors/:id/versions/:v/restore  restore a version

POST   /api/vendors/:id/documents            upload + AI extraction
PUT    /api/documents/:id                    edit extracted data

POST   /api/vendors/:id/compare              AI comparison
POST   /api/vendors/:id/verify               OpenCorporates verification

GET    /api/vendors/:id/checklist            document checklist
POST   /api/vendors/:id/notify-missing       send missing-document email

PATCH  /api/vendors/:id/status               reviewer status update
GET    /api/tasks                            list tasks
PATCH  /api/tasks/:id                        update task status
```

---

## If Running Behind, Cut in This Order

1. Styling
2. Version diff UI (show raw JSON instead)
3. Automatic task due dates (hardcode +3 days)

**Never cut:** AI extraction, AI comparison, OpenCorporates, email. These are what get graded.
