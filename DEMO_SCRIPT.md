# 5-Minute Demo Script

A shot-by-shot script for the demo video. It follows the brief's expected workflow:
**Vendor Details → Upload → AI Extraction → AI Comparison → Company API Verification →
Missing Document → Email → Review → Approve/Reject**, then version history.

**Total target: ~5:00.** Lines in quotes are what to say; *italics* are what to do on screen.

---

## Before you hit record (setup, ~1 min, not filmed)

```bash
# clean slate
docker exec vendor-verify-db psql -U vendor -d vendor_verify -c "TRUNCATE \"Vendor\" CASCADE;"
rm -f server/uploads/*.*
npm run dev          # if not already running
```
Open two tabs: **app** http://localhost:5173 and **Mailpit** http://localhost:8026.
Have the `sample-docs/` folder ready.

> Tip: record the whole thing, pause the AI/verify calls narration while they run (each ~3s), and
> keep moving. If you fluff a line, just keep going — a slightly rough 5 min beats a perfect 20 min.

---

## 0:00 – Intro (15s)

*Show the Vendors list page.*

> "This is the AI-Powered Vendor Verification Workspace. It onboards a vendor, extracts and
> cross-checks their documents with AI, verifies the company against a public registry, and runs a
> review workflow with automated emails and tasks. Stack is React, Node/Express, PostgreSQL with
> Prisma, the OpenAI API, OpenCorporates, and an email service. Let me walk through the full flow."

---

## 0:15 – 1. Vendor Details (30s)

*Click **+ New Vendor**. Fill the form.*

> "First, vendor details — company name, contact, email, address, registration number, GST, and
> bank details. Everything is validated."

*(Optional: show one invalid IFSC error, then fix it.)* Paste:

```
Company Name:     ABC Technologies Pvt Ltd
Contact Person:   Priya Sharma
Email:            (your email)
Phone:            +91 98765 43210
Address:          No. 42, 3rd Floor, MG Road, Bengaluru, Karnataka 560001
Registration No:  U72900KA2019PTC123456
GST / Tax Number: 29ABCDE1234F1Z5
Bank Account:     50200012345678
IFSC Code:        HDFC0001234
```

*Click **Create Vendor**.*

> "Saved as a Draft, version 1."

---

## 0:45 – 2. Upload + AI Extraction (60s)

*Go to the **Documents** tab. Upload `1-registration-certificate.pdf` to the Registration card and
`2-gst-certificate.pdf` to the GST card. Leave Bank empty.*

> "Now I upload the vendor's documents. Each one is sent to the OpenAI API, which reads the PDF and
> extracts the fields — company name, registration number, GST number, address — as structured JSON."

*Point at the extracted values appearing.*

> "The extracted data shows here, and if the AI gets something wrong, the reviewer can edit it
> directly. Notice the registration certificate says 'ABC Technologies', but the GST certificate
> says 'ABC Technology' — a real-world name mismatch we'll catch in a second."

---

## 1:45 – 3. AI Comparison (40s)

*Scroll to **AI Comparison**, click **Run AI comparison**.*

> "The AI comparison checks the vendor form against every document, field by field."

*Point at the table.*

> "It flags the company-name mismatch between the GST document and the others, and it marks the bank
> account and IFSC as missing, because I haven't uploaded the bank document yet. Three matched, one
> mismatch, two missing."

---

## 2:25 – 4. Company Verification (45s)

*Go to the **Verification** tab. Click **Verify company**.*

> "Next, external verification. The system searches the company registry by registration number and
> compares the registered record against the vendor."

*Point at the Verified badge and registry grid.*

> "Here it's Verified — the registered name, number, and address all match. One note for the
> reviewers: this runs against OpenCorporates. A live API token needs manual approval that didn't
> arrive in time, so I built an offline mock that returns the exact same response format — you can
> see the 'Mock data' label. Setting the API token switches to the live API with no code change.
> It also handles not-found, timeouts, and rate limits, which I can show returning 'Unable to Verify'."

---

## 3:10 – 5 & 6. Missing Document + Email + Workflow (50s)

*Go to the **Review** tab. Click **Submit for Review**.*

> "Now the workflow. Submitting for review runs the automation."

*Point at the status changing to Action Required and the banner.*

> "Because the bank document is missing and there's a name mismatch, the vendor automatically moves
> to 'Action Required'. The system emailed the vendor asking for the missing document, and it opened
> two tasks — each with a priority and due date."

*Switch to the Mailpit tab (http://localhost:8026) and open the email.*

> "Here's the actual email — it names the company and the missing document and asks them to provide
> it."

*Back to the app.* 

> "And if I try to approve now, it's blocked while tasks are still pending."

---

## 4:00 – 6b. Resolve → Approve (40s)

*Documents tab: upload `3-bank-letter.pdf`; on the GST card click **Edit**, fix the name to
"ABC Technologies Pvt Ltd", **Save corrections**; click **Run AI comparison** again.*

> "I upload the missing bank document and correct the GST name, then re-run the comparison — now
> everything matches."

*Review tab.*

> "The tasks auto-complete, the status returns to Under Review, and now I can Approve."

*Click **Approve**.*

---

## 4:40 – 7. Version History (20s)

*Go to the **History** tab.*

> "Finally, every change is versioned. Each version shows the old value, the new value, and the
> timestamp, and I can restore any previous version — which creates a new version, so the audit
> trail is never lost."

---

## 5:00 – Close (optional 5s)

> "That's the full pipeline — details, AI extraction and comparison, registry verification, email
> automation, workflow, and version history. Thanks for watching."

---

### Backup clips (only if you have time)
- **Unable to Verify:** set the registration number to `SIMULATE_TIMEOUT`, re-verify → clean error.
- **Fill from documents:** create a vendor with just name/email, upload docs, click
  "Fill form from documents" → the form populates from the AI-extracted data.
- **Tasks page:** the top-nav Tasks view with the Pending/Completed filter and stat cards.
