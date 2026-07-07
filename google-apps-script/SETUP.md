# Dunong Webinar + Google Sheets Setup

This guide connects the React registration app to Google Sheets using Google Apps Script.

## Flow

1. **Before webinar** — User registers on the website. Data and a unique code (e.g. `DUNONG-20260707-A1B2C3`) are saved in Google Sheets.
2. **After webinar** — User opens the Feedback page, enters their registration code, and submits feedback.
3. **Verification** — Google Apps Script checks the code in the sheet.
4. **E-certificate** — If the code is valid, the user can download a certificate after submitting feedback.

---

## Step 1: Create the Google Sheet

1. Go to [Google Sheets](https://sheets.google.com) and create a new spreadsheet.
2. Name it something like **Dunong Webinar Registrations**.
3. Copy the **Spreadsheet ID** from the URL:

```
https://docs.google.com/spreadsheets/d/THIS_PART_IS_THE_ID/edit
```

---

## Step 2: Add the Google Apps Script

1. In the spreadsheet, open **Extensions → Apps Script**.
2. Delete any default code in `Code.gs`.
3. Copy all contents from [`Code.gs`](./Code.gs) in this folder and paste it into Apps Script.
4. Replace `PASTE_YOUR_SPREADSHEET_ID_HERE` with your Spreadsheet ID:

```javascript
const SPREADSHEET_ID = 'your-spreadsheet-id-here';
```

5. Click **Save** (disk icon).

The script creates a **Registrations** sheet with these columns:

| Timestamp | Registration Code | Full Name | Email | Organization | Phone | Feedback Submitted | Feedback Date | Rating | Comments | Certificate Issued |

---

## Step 3: Deploy as Web App

1. In Apps Script, click **Deploy → New deployment**.
2. Click the gear icon next to **Select type** and choose **Web app**.
3. Set:
   - **Description:** Dunong Webinar API
   - **Execute as:** Me
   - **Who has access:** Anyone
4. Click **Deploy**.
5. Authorize the app when prompted (Google account permissions).
6. Copy the **Web app URL**. It looks like:

```
https://script.google.com/macros/s/AKfycb.../exec
```

Important: After any code change, use **Deploy → Manage deployments → Edit → New version → Deploy** so the live URL uses the latest script.

---

## Step 4: Connect the React App

1. In the `registration` folder, copy the example env file:

```bash
cp .env.example .env
```

2. Open `.env` and paste your Web App URL:

```
VITE_GAS_WEB_APP_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

3. Start the app:

```bash
npm install
npm run dev
```

4. Test registration — a new row should appear in your Google Sheet.

---

## API Actions (used by the React app)

All requests are `POST` with JSON body and `Content-Type: text/plain` (required for browser CORS with Apps Script).

### Register

```json
{
  "action": "register",
  "fullName": "Juan Dela Cruz",
  "email": "juan@example.com",
  "organization": "DA Office",
  "phone": "+63 912 345 6789"
}
```

Response:

```json
{
  "success": true,
  "registrationCode": "DUNONG-20260707-A1B2C3",
  "fullName": "Juan Dela Cruz",
  "email": "juan@example.com",
  "organization": "DA Office",
  "phone": "+63 912 345 6789"
}
```

### Verify code

```json
{
  "action": "verify",
  "code": "DUNONG-20260707-A1B2C3"
}
```

### Submit feedback

```json
{
  "action": "submitFeedback",
  "code": "DUNONG-20260707-A1B2C3",
  "rating": 5,
  "comments": "Very informative webinar."
}
```

---

## Troubleshooting

| Problem | Solution |
|--------|----------|
| "Google Apps Script URL is not configured" | Add `VITE_GAS_WEB_APP_URL` to `.env` and restart `npm run dev`. |
| Registration not saving | Confirm Web App access is **Anyone**, redeploy a new version, and check Spreadsheet ID. |
| CORS / network errors | Use `Content-Type: text/plain` (already set in the app). Ensure URL ends with `/exec`. |
| Code not found on feedback | Code must match exactly (case-insensitive). Check the **Registration Code** column in the sheet. |
| Changes not applied | Create a **new deployment version** after editing Apps Script. |

---

## Optional: Link with Google Forms

If you prefer Google Forms for feedback instead of the built-in form:

1. Create a Google Form with a **Registration Code** short-answer field.
2. Connect the form to the same spreadsheet (Responses tab → Link to Sheets).
3. Use Apps Script **onFormSubmit** trigger to validate the code and mark feedback as submitted.

The React app already includes a feedback form that talks directly to the same API, so a separate Google Form is optional.

---

## Production

When deploying the React site (Vercel, Netlify, etc.), set `VITE_GAS_WEB_APP_URL` in the host’s environment variables and rebuild.

Your Google Sheet acts as the database for registration codes, feedback, and certificate status.
