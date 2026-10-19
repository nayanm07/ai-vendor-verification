# Manual Testing Guide

A step-by-step script to exercise every feature by hand, with copy-paste data and the result to expect.

## 0. Start everything

```bash
npm run db:up        # Postgres + Mailpit (Docker)
npm run dev          # API :4010, web :5173
```

Open two browser tabs:
- **App:** http://localhost:5173
- **Email inbox (Mailpit):** http://localhost:8026  ← missing-document emails land here

> Make sure `server/.env` has a valid `OPENAI_API_KEY`. OpenCorporates and email need no keys
> (mock registry + Mailpit are used automatically).

Sample documents to upload are in [`sample-docs/`](./sample-docs):
`1-registration-certificate.pdf`, `2-gst-certificate.pdf`, `3-bank-letter.pdf`.
They are fictitious. The registration cert says **ABC Technologies** and the GST cert says
**ABC Technology** on purpose, to trigger a mismatch.

---

## 1. Create a vendor (Vendor Details)

On the Vendors page click **+ New Vendor** and paste:

| Field | Value |
|---|---|
| Company Name | `ABC Technologies Pvt Ltd` |
| Contact Person | `Priya Sharma` |
| Email | *(use your own email so the reminder is easy to find — any address works, Mailpit catches all)* |
| Phone | `+91 98765 43210` |
| Address | `No. 42, 3rd Floor, MG Road, Bengaluru, Karnataka 560001` |
| Company Registration Number | `U72900KA2019PTC123456` |
| GST / Tax Number | `29ABCDE1234F1Z5` |
| Bank Account Number | `50200012345678` |
| IFSC Code | `HDFC0001234` |

**Expect:** it opens the vendor page at **Draft**, version **v1**.

**Validation test:** edit the vendor, set IFSC to `HELLO` and Email to `abc`, click Save.
→ both fields show inline red errors; nothing saves.

---

## 2. Upload documents + AI extraction (Documents tab)

Upload each sample file into its matching card:
- **Company Registration Certificate** → `1-registration-certificate.pdf`
- **GST / Tax Certificate** → `2-gst-certificate.pdf`
- *(leave **Bank Document** empty for now)*

**Expect (a few seconds each):** status turns **Extracted**; the key/values fill in.
The GST card shows the company name as **ABC Technology Pvt Ltd** (the deliberate typo).

**Edit test:** on any card click **Edit**, change a value, **Save corrections** →
the card shows a **Manually corrected** tag.

---

## 3. AI comparison

Scroll to **AI Comparison**, click **Run AI comparison**.

**Expect:**
- Overall badge **Mismatch**; red alert: company name differs.
- **Company Name** row is highlighted, the GST value shown in red.
- **Bank Account** and **IFSC** rows = **Missing** (no bank doc yet).
- Footer: Matched / Mismatched / Missing counts.

---

## 4. Company verification (Verification tab)

Click **Verify company**.

**Expect:** **Verified** + a grey **Mock data** badge, the registry record grid, and
**3/3 matched**. Click **Raw JSON** to see the underlying response.

### Try the other outcomes
Go to **Details**, change **Company Registration Number**, Save, then re-verify:

| Registration Number | Company Name | Result |
|---|---|---|
| `U72900KA2019PTC123456` | ABC Technologies Pvt Ltd | ✅ **Verified** |
| `U74999MH2020PTC654321` | (any) | ⚠️ **Mismatch** (registry name is "XYZ Global Solutions") |
| `L24110DL2001PLC111222` | (any) | ⚠️ **Mismatch** (company is struck off) |
| `U00000XX0000PTC000000` | Nonexistent Corp | ❓ **Unable to Verify** (not found) |
| `SIMULATE_TIMEOUT` | (any) | ❓ **Unable to Verify** (simulated API timeout) |
| `SIMULATE_RATE_LIMIT` | (any) | ❓ **Unable to Verify** (simulated 429) |
| `SIMULATE_AUTH_ERROR` | (any) | ❓ **Unable to Verify** (simulated bad token) |

> Set the registration number back to `U72900KA2019PTC123456` afterwards.

---

## 5. Workflow + email + tasks (Review tab)

Click **Submit for Review**.

**Expect (automation fires):**
- Status moves **Draft → Action Required** (missing bank doc + name mismatch).
- A banner: issue(s) found, email sent, task(s) created.
- **Document Checklist:** Registration & GST = Available, Bank = **Missing**.
- **Tasks:** "Obtain missing Bank Document" (High) and "Resolve document mismatch: Company Name" (Medium), both **Pending**.
- **Emails to Vendor:** one **Sent** row.
- **Check http://localhost:8026** → the "Action required: Bank Document missing…" email is there.

**Manual reminder:** click **Send reminder email now** → a second email appears in Mailpit.

**Try approving now:** it is **blocked** ("tasks still pending") — correct.

---

## 6. Resolve the issues → approve

1. **Documents tab:** upload `3-bank-letter.pdf` into the Bank card.
2. On the **GST** card, click **Edit**, set Company Name to `ABC Technologies Pvt Ltd`, **Save corrections**.
3. Click **Run AI comparison** again → now **No mismatches**.

**Back on Review:**
- Both tasks auto-complete; status returns to **Under Review**.
- Checklist: all three **Verified**.
- Click **Approve** → status **Approved**. (Or **Reject** to test that path.)

Also open the top-nav **Tasks** page to see tasks across all vendors, with the
Pending/Completed/All filter and the stat cards.

---

## 7. Version history (History tab)

Each save in the steps above created a version.

**Expect:** a stack of version cards, each listing the changed fields with
**previous value (red, struck through) → new value (blue)** and a timestamp.
Click **Restore** on an older version → a *new* version is created matching it
(history is never overwritten).

---

## Reset between runs

To wipe all data and start fresh:

```bash
# from the repo root
docker exec vendor-verify-db psql -U vendor -d vendor_verify -c "TRUNCATE \"Vendor\" CASCADE;"
rm -f server/uploads/*.pdf server/uploads/*.png server/uploads/*.jpg
```

(On Windows PowerShell, prefix the docker command with `wsl`.)
