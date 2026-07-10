# Dunong Webinar + Google Sheets Setup

This guide connects the React registration app to Google Sheets using Google Apps Script.

## Flow

1. **Before webinar** — User registers on the website. Data and a unique code (e.g. `DUNONG-20260707-A1B2C3`) are saved in Google Sheets.
2. **After webinar** — User submits feedback via a **Google Form** using their registration code.
3. **Automatic link** — Apps Script records the feedback and **emails a personalized e-certificate link** to the email they used when registering.
4. **E-certificate** — User clicks the link. The certificate page opens automatically with their **full name** and **registration code**, and the PDF download starts.

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
4. Replace these placeholders:

```javascript
const SPREADSHEET_ID = 'your-spreadsheet-id-here';
const CERTIFICATE_PAGE_URL = 'https://your-deployed-app-url.vercel.app';
```

5. Click **Save** (disk icon).

The script creates a **Registrations** sheet with these columns:

| Timestamp | Registration Code | Full Name | Email | Organization | Phone | Feedback Submitted | Feedback Date | Rating | Comments | Certificate Issued | Certificate Link |

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

## Step 4: Set Up Google Forms for Feedback

### Create the form

1. Go to [Google Forms](https://forms.google.com) and create a new form titled **Dunong Webinar Feedback**.
2. Add these questions **in this order** (column order matters for the script):

| # | Question | Type |
|---|----------|------|
| 1 | Registration Code | Short answer (required) |
| 2 | Webinar Rating | Multiple choice: `5 - Excellent`, `4 - Good`, `3 - Average`, `2 - Fair`, `1 - Poor` |
| 3 | Your Feedback | Paragraph (required) |

3. In the form, click **Responses → Link to Sheets** and select your **Dunong Webinar Registrations** spreadsheet.
   - This creates a **Form Responses** tab. The `onFormSubmit` trigger reads from this.

### Set the confirmation message

1. In the form, open **Settings** (gear icon) → **Presentation**.
2. Under **Confirmation message**, choose **Custom** and paste:

```
Thank you for your feedback!

Your personalized e-certificate link has been sent to the email you used when you registered for the webinar.

Open that email and click "View & Download E-Certificate" — your certificate will open automatically with your full name and registration code, and the PDF will download.
```

No manual code entry is needed when users use the email link.

### Install the form submit trigger

1. In Apps Script (same project as `Code.gs`), click **Triggers** (clock icon) → **Add trigger**.
2. Set:
   - **Function:** `onFormSubmit`
   - **Deployment:** Head
   - **Event source:** From spreadsheet
   - **Event type:** On form submit
3. Save and authorize when prompted.

When a user submits the Google Form, the script:
- Validates their registration code against the **Registrations** sheet
- Marks **Feedback Submitted** = Yes and saves rating and comments
- Marks **Certificate Issued** = Yes
- Saves a personalized **Certificate Link** in the sheet
- **Emails** the participant a link like:

```
https://your-app.vercel.app/?code=DUNONG-20260707-ABC123&download=1
```

Opening that link automatically generates and downloads the certificate with their full name and registration code.

---

## Step 5: Connect the React App

1. In the `registration` folder, copy the example env file:

```bash
cp .env.example .env
```

2. Open `.env` and add your URLs:

```
VITE_GAS_WEB_APP_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
VITE_GOOGLE_FORM_URL=https://docs.google.com/forms/d/YOUR_FORM_ID/viewform
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

### Issue certificate (after Google Form feedback)

```json
{
  "action": "issueCertificate",
  "code": "DUNONG-20260707-A1B2C3"
}
```

Response (success):

```json
{
  "success": true,
  "registrationCode": "DUNONG-20260707-A1B2C3",
  "fullName": "Juan Dela Cruz",
  "message": "Your e-certificate is ready. You can download it below."
}
```

Response (feedback not yet submitted):

```json
{
  "success": false,
  "feedbackRequired": true,
  "message": "Feedback has not been submitted yet. Please complete the Google Form first..."
}
```

### Verify code

```json
{
  "action": "verify",
  "code": "DUNONG-20260707-A1B2C3"
}
```

---

## Troubleshooting

| Problem | Solution |
|--------|----------|
| "Google Apps Script URL is not configured" | Add `VITE_GAS_WEB_APP_URL` to `.env` and restart `npm run dev`. |
| Registration not saving | Confirm Web App access is **Anyone**, redeploy a new version, and check Spreadsheet ID. |
| CORS / network errors | Use `Content-Type: text/plain` (already set in the app). Ensure URL ends with `/exec`. |
| Code not found on e-cert page | Code must match exactly (case-insensitive). Check the **Registration Code** column in the sheet. |
| "Feedback has not been submitted yet" | User must submit the Google Form first. Check the **Feedback Submitted** column. |
| No certificate email received | Check spam folder. Confirm `CERTIFICATE_PAGE_URL` is set in `Code.gs` and redeploy. The trigger needs Gmail send permission. |
| Form submit not updating sheet | Confirm the **onFormSubmit** trigger is installed and form questions are in the correct order. |
| Changes not applied | Create a **new deployment version** after editing Apps Script. |

---

## Customizing form field order

If your Google Form questions are in a different order, edit `FORM_COL` in `Code.gs`:

```javascript
const FORM_COL = {
  REGISTRATION_CODE: 1,  // index in e.values (0 = timestamp)
  RATING: 2,
  COMMENTS: 3,
};
```

---

## Production

When deploying the React site (Vercel, Netlify, etc.):

1. Set `VITE_GAS_WEB_APP_URL` and `VITE_GOOGLE_FORM_URL` in the host's environment variables.
2. Rebuild the site.
3. Update `CERTIFICATE_PAGE_URL` in `Code.gs` to match your production URL.
4. Update the Google Form confirmation message with the same production URL.

Your Google Sheet acts as the database for registration codes, feedback, and certificate status.
