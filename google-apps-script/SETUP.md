# Dunong Webinar — Complete Setup & Execution Guide

This guide covers one-time setup, how to configure the feedback Google Form, and the day-by-day steps to run the webinar with registration and e-certificates.

---

## How the system works

```text
BEFORE WEBINAR                         AFTER WEBINAR
─────────────────                      ─────────────────
Registration site (Vercel)           Feedback Google Form
        │                                      │
        ▼                                      ▼
   Apps Script API  ◄──────────────  onFormSubmit trigger
        │                                      │
        ▼                                      ▼
   Registrations sheet  ◄──────────  Updates same row by code
        │
        ▼
   Certificate site (Vercel) ──► PDF with name + registration code
```

### Two Google Sheet tabs

| Tab | What it stores |
|-----|----------------|
| **Registrations** | Main database: registration data, feedback status, rating, comments, certificate link |
| **Form Responses 1** (auto-created) | Raw copy of **every** Google Form answer (timestamp + all questions) |

When someone submits feedback, Apps Script finds their row in **Registrations** using the **Registration Code** and copies rating/comments there. The certificate uses the **Full Name** and **Registration Code** already saved from registration.

> **Important:** The name printed on the certificate comes from **registration**, not from the feedback form. The feedback form still asks for Full Name so you have a record and can verify the participant is using the correct code.

---

## Part A — One-time setup (do this first)

### A1. Google Sheet

1. Create a spreadsheet named **Dunong Webinar Registrations**.
2. Copy the **Spreadsheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/THIS_PART_IS_THE_ID/edit
   ```

### A2. Google Apps Script

1. In the spreadsheet: **Extensions → Apps Script**.
2. Paste all code from [`Code.gs`](./Code.gs).
3. Set these values:
   ```javascript
   const SPREADSHEET_ID = 'your-spreadsheet-id-here';
   const CERTIFICATE_PAGE_URL = 'https://your-certificate-site.vercel.app';
   ```
   Use the **certificate** Vercel URL (not the registration URL).
4. **Save**.

The script creates a **Registrations** sheet with these columns:

| Timestamp | Registration Code | Full Name | Email | Address | Phone | Feedback Submitted | Feedback Date | Rating | Comments | Certificate Issued | Certificate Link |

### A3. Deploy Apps Script as Web App

1. **Deploy → New deployment** → type **Web app**.
2. **Execute as:** Me  
3. **Who has access:** Anyone  
4. **Deploy** and authorize.
5. Copy the Web App URL (ends with `/exec`).

After any code change: **Deploy → Manage deployments → Edit → New version → Deploy**.

### A4. Deploy two Vercel sites

Create **two projects** from the same repo, root directory `registration`:

| Project | `VITE_APP_MODE` | When to share |
|---------|-----------------|---------------|
| `dunong-register` | `register` | Before & during sign-up period |
| `dunong-certificate` | `certificate` | After webinar (also set as `CERTIFICATE_PAGE_URL`) |

Both projects need (in Vercel → Settings → Environment Variables):

```
VITE_GAS_WEB_APP_URL=https://script.google.com/macros/s/YOUR_ID/exec
VITE_GOOGLE_FORM_URL=https://docs.google.com/forms/d/YOUR_FORM_ID/viewform
```

You can also set `GAS_WEB_APP_URL` instead of `VITE_GAS_WEB_APP_URL` — the `/api/gas` serverless function accepts either. Redeploy after adding env vars.

### A5. Feedback Google Form (see Part B below)

Set up the form, link it to the spreadsheet, install the trigger, and set the confirmation message.

---

## Part B — Feedback Google Form setup

### B1. Create the form

1. Go to [Google Forms](https://forms.google.com).
2. Title: **Dunong Webinar Feedback**.
3. Add questions **in this exact order** (order matters for Apps Script):

| # | Question label | Type | Required | Used for |
|---|----------------|------|----------|----------|
| **1** | **Registration Code** | Short answer | **Yes** | Links feedback to the correct row — **required for certificate** |
| **2** | **Full Name** | Short answer | **Yes** | Verification + saved in Form Responses tab |
| **3** | **Webinar Rating** | Multiple choice | Yes | Saved to **Registrations → Rating** |
| **4** | **Your Feedback** | Paragraph | Yes | Saved to **Registrations → Comments** |
| 5+ | *(optional extra questions)* | Any type | Optional | Saved in **Form Responses** only |

#### Question 1 — Registration Code

- Type: **Short answer**
- Required: **Yes**
- Description (suggested):
  ```
  Enter the code you received when you registered (example: DUNONG-20260711-ABC123).
  Copy it exactly from your registration confirmation.
  ```
- Turn on **Response validation → Text → Contains** (optional) or leave as plain text.

#### Question 2 — Full Name

- Type: **Short answer**
- Required: **Yes**
- Description (suggested):
  ```
  Enter your full name exactly as you registered. This must match your registration.
  ```
- The certificate will show the name from your **registration**, not this form answer. This field helps you verify the person submitting feedback is the registered participant.

#### Question 3 — Webinar Rating

- Type: **Multiple choice**
- Options (use these labels so the script can read the number):
  ```
  5 - Excellent
  4 - Good
  3 - Average
  2 - Fair
  1 - Poor
  ```

#### Question 4 — Your Feedback

- Type: **Paragraph**
- Required: **Yes**

#### Optional extra questions (Q5, Q6, …)

You may add more questions **after** question 4 (e.g. "What did you learn?", "Would you recommend this webinar?"). They are automatically saved in the **Form Responses** tab. Do **not** insert new questions between 1–4 without updating `FORM_COL` in `Code.gs`.

### B2. Link form to the spreadsheet

1. In the form, open **Responses** tab.
2. Click the green **Sheets** icon (**Link to Sheets**).
3. Select your **Dunong Webinar Registrations** spreadsheet.
4. Google creates a tab like **Form Responses 1** — every submission is stored there with all answers.

### B3. Form confirmation message

1. **Settings** (gear) → **Presentation**.
2. **Confirmation message** → **Custom**. Example:

```
Thank you for your feedback!

Your e-certificate is loading automatically. If you are not redirected, check the email you used when you registered for a personalized download link.
```

3. **Go to a webpage** (recommended) — use your Apps Script redirect URL so participants land on their certificate without typing a code:

```
https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?action=redirectCertificate&latest=1
```

Replace `YOUR_DEPLOYMENT_ID` with the same ID as `VITE_GAS_WEB_APP_URL`. After each form submit, Apps Script caches that participant's registration code for a few minutes and redirects them to:

```
https://your-certificate-site.vercel.app/?code=DUNONG-20260711-ABC123
```

The certificate page loads automatically with their registered **full name** and **URN** (registration code). They only need to click **Download Certificate (PDF)**.

> **Note:** If two people submit feedback within seconds of each other, the redirect may briefly point to the wrong certificate. The personalized email link is always correct — tell participants to use that if the redirect seems wrong.

### B4. Install the form submit trigger

1. Open **Apps Script** (same project as `Code.gs`).
2. **Triggers** (clock icon) → **Add trigger**.
3. Set:
   - **Function:** `onFormSubmit`
   - **Deployment:** Head
   - **Event source:** From spreadsheet
   - **Event type:** On form submit
4. Save and authorize (Gmail permission is needed to send certificate emails).

### B5. What happens on each form submit

1. Apps Script reads **Registration Code** and **Full Name** from the form.
2. Finds the matching row in **Registrations** by code.
3. If the form name does not match the registered name, it logs a warning (certificate still uses the registered name).
4. Updates **Registrations**: Feedback Submitted = Yes, Feedback Date, Rating, Comments.
5. Sets **Certificate Issued** = Yes and saves the **Certificate Link**.
6. Emails the participant a personalized link like:
   ```
   https://your-certificate-site.vercel.app/?code=DUNONG-20260711-ABC123
   ```

---

## Part C — Webinar execution timeline

### Before the webinar (1–2 weeks ahead)

| Step | Action |
|------|--------|
| 1 | Finish Part A setup (Sheet, Apps Script, Vercel, Form, trigger) |
| 2 | Test registration on the **register** site — confirm a new row appears in **Registrations** |
| 3 | Copy a test registration code from the sheet |
| 4 | Submit a test feedback form with that code + matching full name |
| 5 | Confirm **Registrations** row updates (Feedback Submitted = Yes, Rating, Comments) |
| 6 | Confirm certificate email arrives and the claim link works |
| 7 | Share the **registration** Vercel URL on social media, posters, etc. |

### During the webinar

| Step | Action |
|------|--------|
| 1 | Remind attendees to **save their registration code** |
| 2 | Tell them feedback + certificate instructions will come **after** the session |
| 3 | Optionally show the feedback form URL at the end (or wait until after) |

### After the webinar

| Step | Action |
|------|--------|
| 1 | Share the **feedback Google Form** link (`VITE_GOOGLE_FORM_URL`) |
| 2 | Remind participants: they need their **registration code** and **full name** |
| 3 | Certificate site is already live — participants use email link or form confirmation link |
| 4 | Monitor **Registrations** sheet: Feedback Submitted, Certificate Issued columns |
| 5 | Check **Form Responses 1** for all raw feedback answers |

### Optional: close registration

- Leave the register site up, or remove/stop sharing it after the webinar starts.
- The certificate site stays available for claim links.

---

## Part D — Local development

```bash
cd registration
cp .env.example .env
```

```env
VITE_GAS_WEB_APP_URL=https://script.google.com/macros/s/YOUR_ID/exec
VITE_GOOGLE_FORM_URL=https://docs.google.com/forms/d/YOUR_FORM_ID/viewform
VITE_APP_MODE=both
```

```bash
npm install
npm run dev
```

---

## Part E — Customizing form field order

If your first four questions are in a different order, edit `FORM_COL` in `Code.gs`:

```javascript
const FORM_COL = {
  REGISTRATION_CODE: 1,  // index in e.values (0 = timestamp)
  FULL_NAME: 2,
  RATING: 3,
  COMMENTS: 4,
};
```

Extra questions after #4 do not require code changes.

---

## Part F — Troubleshooting

| Problem | Solution |
|--------|----------|
| Registration not saving | Web App access = **Anyone**; check Spreadsheet ID; redeploy new Apps Script version |
| Form submit not updating Registrations | Confirm **onFormSubmit** trigger exists; questions 1–4 are in correct order |
| "Registration code not found" on form | Code must match **Registrations** sheet exactly (case-insensitive) |
| "Feedback has not been submitted yet" on cert page | Submit the Google Form first with your registration code. If you already did, wait 10–30 seconds and retry — the app now auto-retries. Also confirm `onFormSubmit` trigger exists and form is linked to the same spreadsheet |
| Testing on localhost | Works on any device — feedback is stored in Google Sheets, not localStorage. You still need `VITE_GAS_WEB_APP_URL` pointing to your deployed Apps Script |
| Certificate page must be deployed | Yes — set `CERTIFICATE_PAGE_URL` in Apps Script to your **certificate** Vercel URL (not localhost). Form redirect and certificate emails use that URL |
| Wrong name on certificate | Name comes from **registration** — edit **Full Name** in Registrations sheet if needed |
| Name mismatch in Apps Script logs | Participant typed a different name in the form; cert still uses registered name |
| No certificate email | Check spam; confirm `CERTIFICATE_PAGE_URL` is set; trigger needs Gmail permission |
| Rating not saved | Use options starting with `5 -`, `4 -`, etc. |
| Extra form answers missing | Check **Form Responses 1** tab (not Registrations) — only Q3–Q4 sync to Registrations |
| CORS errors | URL must end with `/exec`; app uses `Content-Type: text/plain` |

---

## Quick reference — what each field is for

| Field | Where collected | Where stored | Used on certificate? |
|-------|-----------------|--------------|----------------------|
| Registration Code | Registration site + Feedback form | Registrations + Form Responses | **Yes** |
| Full Name | Registration site + Feedback form | Registrations + Form Responses | **Yes** (from registration row) |
| Email | Registration site | Registrations | For certificate email only |
| Address | Registration site | Registrations | No |
| Phone | Registration site | Registrations | No |
| Rating | Feedback form | Registrations + Form Responses | No |
| Comments | Feedback form | Registrations + Form Responses | No |
| Other feedback questions | Feedback form | Form Responses only | No |
