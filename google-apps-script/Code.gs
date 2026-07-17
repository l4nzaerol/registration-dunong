
// Spreadsheet linked to the Dunong Feedback Google Form (Responses → Link to Sheets).
const SPREADSHEET_ID = '1L-uVPGSym1OysehKaCg9vO1u-QpCl0RXj5kJu812aSs';
const SHEET_NAME = 'Registrations';

// Dunong Feedback and Evaluation Form
const GOOGLE_FORM_ID = '1JRrFNtUlLU9_W64G8TjXSnhTxGzGcOiU8ps0EhWilFc';
const GOOGLE_FORM_URL =
  'https://docs.google.com/forms/d/' + GOOGLE_FORM_ID + '/viewform';

// E-certificate page URL shown in Google Form confirmation (no trailing slash).
// Example: https://your-site.vercel.app
const CERTIFICATE_PAGE_URL = 'PASTE_YOUR_DEPLOYED_APP_URL_HERE';

// Form Responses column indices (0 = Timestamp). Matches Dunong feedback form headers.
// Full form has 63 columns (0–62). Google Forms writes every answer to Form Responses 1
// when the form is linked to the spreadsheet; indices below are for Apps Script lookups.
const FORM_COL = {
  CONSENT: 1,
  FULL_NAME: 2,
  REGISTRATION_CODE: 3,
  ADDRESS: 4,
  AGE: 5,
  GENDER: 6,
  // Block A — general training (cols 7–10)
  CONTENT_RELEVANCE_A: 7,
  MATERIALS_ENGAGING_A: 8,
  TRAINER_EFFECTIVE_A: 9,
  TRAINER_EXPERTISE_A: 10,
  // Block B — trainer & schedule (cols 11–14)
  TRAINER_EFFECTIVE_B: 11,
  TRAINER_EXPERTISE_B: 12,
  TRAINER_PARTICIPATION: 13,
  SCHEDULE_PACE: 14,
  // Block C — virtual delivery (cols 15–18)
  VIRTUAL_DELIVERY: 15,
  VIRTUAL_ENGAGEMENT: 16,
  RESPONSIVENESS: 17,
  HANDLING_ISSUES: 18,
  // Block D — environment & presentation (cols 19–24)
  TRAINING_ENVIRONMENT: 19,
  PRESENTATION_RELEVANCE: 20,
  VOICE_QUALITY: 21,
  DYNAMISM: 22,
  PRESENTER_EXPERTISE: 23,
  OVERALL_SATISFACTION: 24,
  RECOMMEND_MENTOR: 25,
  BENEFITS_PROBLEMS: 26,
  COMMENTS: 27,
  VENUE_FACILITIES: 28,
  // Branching sections repeat similar questions (cols 29–51) — only the answered
  // branch has values; others stay blank in Form Responses 1.
  TRAINING_DELIVERY_METHOD: 54,
  OVERALL_FEEDBACK: 62,
  // Aliases used when saving to Registrations sheet
  RATING: 24,
};

const FORM_RESPONSE_COLUMN_COUNT = 63;

const HEADERS = [
  'Timestamp',
  'Registration Code',
  'Full Name',
  'Email',
  'Address',
  'Phone',
  'Feedback Submitted',
  'Feedback Date',
  'Rating',
  'Comments',
  'Certificate Issued',
  'Certificate Link',
];

const COL = {
  TIMESTAMP: 1,
  CODE: 2,
  FULL_NAME: 3,
  EMAIL: 4,
  ADDRESS: 5,
  PHONE: 6,
  FEEDBACK_SUBMITTED: 7,
  FEEDBACK_DATE: 8,
  RATING: 9,
  COMMENTS: 10,
  CERTIFICATE_ISSUED: 11,
  CERTIFICATE_LINK: 12,
};

function doGet(e) {
  const action = e && e.parameter ? e.parameter.action : '';

  if (action === 'verify') {
    return jsonResponse(verifyRegistrationCode_(e.parameter.code || ''));
  }

  if (action === 'redirectCertificate') {
    let code = e.parameter.code || '';

    // Used by Google Form "Go to a webpage" after submit (static URL for all users).
    // onFormSubmit caches the submitter's code for a few minutes before redirect.
    if (!code && e.parameter.latest === '1') {
      code = getLatestSubmittedCode_() || '';
    }

    if (!code && e.parameter.latest === '1') {
      return redirectPollingPage_();
    }

    return redirectToCertificate_(code);
  }

  if (action === 'latestCertCode') {
    const code = getLatestSubmittedCode_() || '';
    return jsonResponse({
      success: Boolean(code),
      code: code,
    });
  }

  return jsonResponse({
    success: true,
    message: 'Dunong Webinar API is running.',
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    const data = JSON.parse(e.postData.contents);
    let result;

    switch (data.action) {
      case 'register':
        result = registerParticipant_(data);
        break;
      case 'verify':
        result = verifyRegistrationCode_(data.code);
        break;
      case 'submitFeedback':
        result = submitFeedback_(data);
        break;
      case 'issueCertificate':
        result = issueCertificate_(data.code);
        break;
      case 'checkCertificateStatus':
        result = checkCertificateStatus_(data.code);
        break;
      default:
        result = { success: false, message: 'Unknown action.' };
    }

    return jsonResponse(result);
  } catch (error) {
    return jsonResponse({
      success: false,
      message: error.message || 'Server error.',
    });
  } finally {
    lock.releaseLock();
  }
}

function registerParticipant_(data) {
  const fullName = String(data.fullName || '').trim();
  const email = String(data.email || '').trim().toLowerCase();
  const address = String(data.address || data.organization || '').trim();
  const phone = String(data.phone || '').trim();

  if (!fullName || !email || !address) {
    return { success: false, message: 'Full name, email, and address are required.' };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, message: 'Invalid email address.' };
  }

  const sheet = getSheet_();
  const registrationCode = generateUniqueCode_(sheet);

  sheet.appendRow([
    new Date(),
    registrationCode,
    fullName,
    email,
    address,
    phone,
    'No',
    '',
    '',
    '',
    'No',
    '',
  ]);

  return {
    success: true,
    registrationCode: registrationCode,
    fullName: fullName,
    email: email,
    address: address,
    phone: phone,
  };
}

function verifyRegistrationCode_(code) {
  const registrationCode = String(code || '').trim().toUpperCase();

  if (!registrationCode) {
    return { success: false, valid: false, message: 'Registration code is required.' };
  }

  const row = findRowByCode_(registrationCode);

  if (!row) {
    return {
      success: true,
      valid: false,
      message: 'Registration code not found. Please check and try again.',
    };
  }

  return {
    success: true,
    valid: true,
    registrationCode: row.values[COL.CODE - 1],
    fullName: row.values[COL.FULL_NAME - 1],
    email: row.values[COL.EMAIL - 1],
    address: row.values[COL.ADDRESS - 1],
    feedbackSubmitted: String(row.values[COL.FEEDBACK_SUBMITTED - 1]).toLowerCase() === 'yes',
    certificateIssued: String(row.values[COL.CERTIFICATE_ISSUED - 1]).toLowerCase() === 'yes',
  };
}

function buildCertificateUrl_(registrationCode, autoDownload) {
  if (!CERTIFICATE_PAGE_URL || CERTIFICATE_PAGE_URL.indexOf('PASTE_YOUR') !== -1) {
    return '';
  }

  const base = CERTIFICATE_PAGE_URL.replace(/\/$/, '');
  const url = base + '/?code=' + encodeURIComponent(registrationCode);

  if (autoDownload) {
    return url + '&download=1';
  }

  return url;
}

function redirectToCertificate_(code) {
  const registrationCode = String(code || '').trim().toUpperCase();
  const certUrl = buildCertificateUrl_(registrationCode, false);

  if (!certUrl) {
    return HtmlService.createHtmlOutput(
      '<p>Certificate page URL is not configured in Apps Script.</p>'
    );
  }

  const safeUrl = certUrl.replace(/"/g, '&quot;');

  return HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html><head>' +
      '<meta charset="utf-8">' +
      '<meta http-equiv="refresh" content="0;url=' +
      safeUrl +
      '">' +
      '<title>Redirecting to your e-certificate</title>' +
      '</head><body>' +
      '<p>Redirecting to your e-certificate...</p>' +
      '<p>If you are not redirected, <a href="' +
      safeUrl +
      '">click here</a>.</p>' +
      '<script>window.location.replace("' +
      safeUrl +
      '");</script>' +
      '</body></html>'
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function sendCertificateEmail_(email, fullName, certUrl, registrationCode) {
  if (!email || !certUrl) {
    return;
  }

  const subject = 'Your Dunong Webinar E-Certificate';
  const htmlBody =
    '<div style="font-family:Arial,sans-serif;line-height:1.5;color:#222;">' +
    '<p>Hi <strong>' +
    fullName +
    '</strong>,</p>' +
    '<p>Thank you for submitting your feedback for the Dunong Webinar.</p>' +
    '<p>Your e-certificate is ready with your name and registration code <strong>' +
    registrationCode +
    '</strong>.</p>' +
    '<p><a href="' +
    certUrl +
    '" style="display:inline-block;padding:12px 20px;background:#1a5f2a;color:#fff;text-decoration:none;border-radius:6px;">Claim E-Certificate</a></p>' +
    '<p>Or copy this link:<br><a href="' +
    certUrl +
    '">' +
    certUrl +
    '</a></p>' +
    '</div>';
  const plainBody =
    'Hi ' +
    fullName +
    ',\n\nThank you for submitting your feedback for the Dunong Webinar.\n\n' +
    'Your e-certificate is ready with your name and registration code ' +
    registrationCode +
    '.\n\n' +
    'Open this link to claim and download your certificate:\n' +
    certUrl;

  MailApp.sendEmail({
    to: email,
    subject: subject,
    body: plainBody,
    htmlBody: htmlBody,
  });
}

function checkCertificateStatus_(code) {
  const registrationCode = String(code || '').trim().toUpperCase();

  if (!registrationCode) {
    return { success: false, valid: false, message: 'Registration code is required.' };
  }

  const row = findRowByCode_(registrationCode);

  if (!row) {
    return {
      success: true,
      valid: false,
      message: 'Registration code not found. Please check and try again.',
    };
  }

  const fullName = String(row.values[COL.FULL_NAME - 1] || '').trim();
  const codeValue = String(row.values[COL.CODE - 1] || '').trim().toUpperCase();
  let feedbackSubmitted =
    String(row.values[COL.FEEDBACK_SUBMITTED - 1]).toLowerCase() === 'yes';

  if (feedbackSubmitted) {
    return {
      success: true,
      valid: true,
      ready: true,
      feedbackSubmitted: true,
      pendingFeedback: false,
      registrationCode: codeValue,
      fullName: fullName,
    };
  }

  const formRow = findFormResponseRow_(registrationCode);

  if (!formRow) {
    return {
      success: true,
      valid: true,
      ready: false,
      feedbackSubmitted: false,
      feedbackRequired: true,
      pendingFeedback: false,
      registrationCode: codeValue,
      fullName: fullName,
      message:
        'You need to submit the feedback Google Form before claiming your e-certificate.',
    };
  }

  if (syncFeedbackFromFormResponses_(registrationCode)) {
    return {
      success: true,
      valid: true,
      ready: true,
      feedbackSubmitted: true,
      pendingFeedback: false,
      registrationCode: codeValue,
      fullName: fullName,
    };
  }

  return {
    success: true,
    valid: true,
    ready: false,
    feedbackSubmitted: false,
    feedbackRequired: true,
    pendingFeedback: true,
    registrationCode: codeValue,
    fullName: fullName,
    message:
      'Your feedback was received and is still being processed. Please wait a moment and try again.',
  };
}

function issueCertificate_(code) {
  const registrationCode = String(code || '').trim().toUpperCase();

  if (!registrationCode) {
    return { success: false, message: 'Registration code is required.' };
  }

  let row = findRowByCode_(registrationCode);

  if (!row) {
    return {
      success: false,
      message: 'Registration code not found. Only registered participants can receive a certificate.',
    };
  }

  let feedbackSubmitted =
    String(row.values[COL.FEEDBACK_SUBMITTED - 1]).toLowerCase() === 'yes';

  // Fallback when the form trigger is slow or missing: sync from Form Responses tab.
  if (!feedbackSubmitted && syncFeedbackFromFormResponses_(registrationCode)) {
    row = findRowByCode_(registrationCode);
    feedbackSubmitted =
      row && String(row.values[COL.FEEDBACK_SUBMITTED - 1]).toLowerCase() === 'yes';
  }

  if (!feedbackSubmitted) {
    return {
      success: false,
      feedbackRequired: true,
      pendingFeedback: hasFormResponseForCode_(registrationCode),
      message:
        'You need to submit the feedback Google Form before claiming your e-certificate.',
    };
  }

  const alreadyIssued =
    String(row.values[COL.CERTIFICATE_ISSUED - 1]).toLowerCase() === 'yes';

  if (!alreadyIssued) {
    const sheet = getSheet_();
    sheet.getRange(row.rowNumber, COL.CERTIFICATE_ISSUED).setValue('Yes');
  }

  return {
    success: true,
    registrationCode: String(row.values[COL.CODE - 1] || '')
      .trim()
      .toUpperCase(),
    fullName: String(row.values[COL.FULL_NAME - 1] || '').trim(),
    certificateUrl: buildCertificateUrl_(row.values[COL.CODE - 1], false),
    message: alreadyIssued
      ? 'Your e-certificate is ready. You can download it again below.'
      : 'Your e-certificate is ready. You can download it below.',
  };
}

/**
 * Installable trigger: Run when a Google Form response is submitted.
 * In Apps Script: Triggers → Add trigger → onFormSubmit → From spreadsheet → On form submit.
 *
 * Dunong form column order (after Timestamp):
 * Consent, Full Name, Registration Code, Address, Age, Gender, rating blocks,
 * Overall satisfaction (col 24), Recommend mentor (25), Benefits (26),
 * Comment and Suggestions (27), branching sections (29–51),
 * Training delivery method (54), Overall feedback (62).
 * Google Forms stores every answer in Form Responses 1; see FORM_COL for indices.
 */
function onFormSubmit(e) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    const responses = e.values;
    const registrationCode = String(responses[FORM_COL.REGISTRATION_CODE] || '')
      .trim()
      .toUpperCase();
    const formFullName = String(responses[FORM_COL.FULL_NAME] || '').trim();

    if (responses.length < FORM_RESPONSE_COLUMN_COUNT) {
      Logger.log(
        'Form submit: expected at least ' +
          FORM_RESPONSE_COLUMN_COUNT +
          ' columns, got ' +
          responses.length +
          '. Check that the form is linked to this spreadsheet.'
      );
    }

    if (!registrationCode) {
      Logger.log('Form submit skipped: missing registration code.');
      return;
    }

    const row = findRowByCode_(registrationCode);

    if (!row) {
      Logger.log('Form submit: registration code not found — ' + registrationCode);
      return;
    }

    const registeredName = String(row.values[COL.FULL_NAME - 1]).trim();
    if (formFullName && normalizeName_(formFullName) !== normalizeName_(registeredName)) {
      Logger.log(
        'Name mismatch for ' +
          registrationCode +
          ': form="' +
          formFullName +
          '" registered="' +
          registeredName +
          '"'
      );
    }

    const alreadySubmitted =
      String(row.values[COL.FEEDBACK_SUBMITTED - 1]).toLowerCase() === 'yes';

    if (!alreadySubmitted) {
      applyFeedbackToRegistration_(registrationCode, responses);
    }

    const certUrl = buildCertificateUrl_(registrationCode, false);

    // Brief cache so the form confirmation redirect can resolve the latest submitter.
    CacheService.getScriptCache().put('latestCertCode', registrationCode, 300);

    const refreshedRow = findRowByCode_(registrationCode);
    const sheet = getSheet_();

    if (refreshedRow && certUrl) {
      sheet.getRange(refreshedRow.rowNumber, COL.CERTIFICATE_LINK).setValue(certUrl);
    }

    const fullName = refreshedRow ? refreshedRow.values[COL.FULL_NAME - 1] : row.values[COL.FULL_NAME - 1];
    const email = refreshedRow ? refreshedRow.values[COL.EMAIL - 1] : row.values[COL.EMAIL - 1];

    try {
      sendCertificateEmail_(email, fullName, certUrl, registrationCode);
    } catch (mailError) {
      Logger.log('Certificate email failed for ' + registrationCode + ': ' + mailError.message);
    }
  } catch (error) {
    Logger.log('onFormSubmit error: ' + error.message);
  } finally {
    lock.releaseLock();
  }
}

function normalizeName_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function parseRating_(value) {
  const text = String(value || '').trim();
  const leadingNumber = text.match(/^(\d)/);

  if (leadingNumber) {
    const rating = Number(leadingNumber[1]);
    if (rating >= 1 && rating <= 5) {
      return rating;
    }
  }

  return '';
}

function extractCommentsFromFormRow_(formRow) {
  const suggestions = String(formRow[FORM_COL.COMMENTS] || '').trim();
  const benefits = String(formRow[FORM_COL.BENEFITS_PROBLEMS] || '').trim();
  const overallFeedback = String(formRow[FORM_COL.OVERALL_FEEDBACK] || '').trim();

  const parts = [];

  if (benefits) {
    parts.push('Benefits/Problems: ' + benefits);
  }

  if (suggestions) {
    parts.push('Suggestions: ' + suggestions);
  }

  if (!suggestions && !benefits && overallFeedback) {
    parts.push(overallFeedback);
  }

  return parts.join('\n\n');
}

function getFormResponseColumnCount_(formSheet) {
  if (!formSheet) {
    return FORM_RESPONSE_COLUMN_COUNT;
  }

  return Math.max(formSheet.getLastColumn(), FORM_RESPONSE_COLUMN_COUNT);
}

function submitFeedback_(data) {
  const registrationCode = String(data.code || '').trim().toUpperCase();
  const rating = Number(data.rating);
  const comments = String(data.comments || '').trim();

  if (!registrationCode) {
    return { success: false, message: 'Registration code is required.' };
  }

  if (!rating || rating < 1 || rating > 5) {
    return { success: false, message: 'Please select a rating from 1 to 5.' };
  }

  if (!comments) {
    return { success: false, message: 'Please enter your feedback comments.' };
  }

  const row = findRowByCode_(registrationCode);

  if (!row) {
    return {
      success: false,
      message: 'Registration code not found. Only registered participants can submit feedback.',
    };
  }

  const alreadySubmitted =
    String(row.values[COL.FEEDBACK_SUBMITTED - 1]).toLowerCase() === 'yes';

  if (!alreadySubmitted) {
    const sheet = getSheet_();
    sheet.getRange(row.rowNumber, COL.FEEDBACK_SUBMITTED).setValue('Yes');
    sheet.getRange(row.rowNumber, COL.FEEDBACK_DATE).setValue(new Date());
    sheet.getRange(row.rowNumber, COL.RATING).setValue(rating);
    sheet.getRange(row.rowNumber, COL.COMMENTS).setValue(comments);
    sheet.getRange(row.rowNumber, COL.CERTIFICATE_ISSUED).setValue('Yes');
  }

  return {
    success: true,
    registrationCode: row.values[COL.CODE - 1],
    fullName: row.values[COL.FULL_NAME - 1],
    email: row.values[COL.EMAIL - 1],
    address: row.values[COL.ADDRESS - 1],
    message: alreadySubmitted
      ? 'Feedback was already submitted. You can download your certificate again.'
      : 'Thank you for your feedback. Your e-certificate is ready.',
  };
}

function getFormResponsesSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheets = spreadsheet.getSheets();

  for (let i = 0; i < sheets.length; i++) {
    const name = sheets[i].getName();
    if (name.indexOf('Form Responses') === 0) {
      return sheets[i];
    }
  }

  return null;
}

function getLatestSubmittedCode_() {
  const cached = CacheService.getScriptCache().get('latestCertCode');
  if (cached) {
    return cached;
  }

  const formSheet = getFormResponsesSheet_();
  if (!formSheet || formSheet.getLastRow() < 2) {
    return '';
  }

  const lastRow = formSheet.getLastRow();
  const codeCol = FORM_COL.REGISTRATION_CODE + 1;
  const code = String(formSheet.getRange(lastRow, codeCol).getValue() || '')
    .trim()
    .toUpperCase();

  return code || '';
}

function hasFormResponseForCode_(registrationCode) {
  return Boolean(findFormResponseRow_(registrationCode));
}

function findFormResponseRow_(registrationCode) {
  const formSheet = getFormResponsesSheet_();
  if (!formSheet) {
    return null;
  }

  const lastRow = formSheet.getLastRow();
  if (lastRow < 2) {
    return null;
  }

  const codeCol = FORM_COL.REGISTRATION_CODE + 1;
  const numRows = lastRow - 1;
  const codes = formSheet.getRange(2, codeCol, numRows, 1).getValues();

  for (let i = codes.length - 1; i >= 0; i--) {
    const code = String(codes[i][0] || '')
      .trim()
      .toUpperCase();

    if (code === registrationCode) {
      const rowNumber = i + 2;
      const numCols = getFormResponseColumnCount_(formSheet);
      return formSheet.getRange(rowNumber, 1, 1, numCols).getValues()[0];
    }
  }

  return null;
}

function applyFeedbackToRegistration_(registrationCode, formRow) {
  const row = findRowByCode_(registrationCode);

  if (!row) {
    return false;
  }

  const alreadySubmitted =
    String(row.values[COL.FEEDBACK_SUBMITTED - 1]).toLowerCase() === 'yes';

  if (alreadySubmitted) {
    return true;
  }

  const rating = parseRating_(formRow[FORM_COL.RATING]);
  const comments = extractCommentsFromFormRow_(formRow);
  const sheet = getSheet_();

  sheet.getRange(row.rowNumber, COL.FEEDBACK_SUBMITTED).setValue('Yes');
  sheet.getRange(row.rowNumber, COL.FEEDBACK_DATE).setValue(new Date());

  if (rating) {
    sheet.getRange(row.rowNumber, COL.RATING).setValue(rating);
  }

  if (comments) {
    sheet.getRange(row.rowNumber, COL.COMMENTS).setValue(comments);
  }

  const certUrl = buildCertificateUrl_(registrationCode, false);
  sheet.getRange(row.rowNumber, COL.CERTIFICATE_ISSUED).setValue('Yes');

  if (certUrl) {
    sheet.getRange(row.rowNumber, COL.CERTIFICATE_LINK).setValue(certUrl);
  }

  CacheService.getScriptCache().put('latestCertCode', registrationCode, 300);

  return true;
}

function syncFeedbackFromFormResponses_(registrationCode) {
  const formRow = findFormResponseRow_(registrationCode);

  if (!formRow) {
    return false;
  }

  return applyFeedbackToRegistration_(registrationCode, formRow);
}

function redirectPollingPage_() {
  const certBase = CERTIFICATE_PAGE_URL.replace(/\/$/, '');
  const scriptUrl = ScriptApp.getService().getUrl();

  if (!certBase || certBase.indexOf('PASTE_YOUR') !== -1) {
    return HtmlService.createHtmlOutput(
      '<p>Certificate page URL is not configured in Apps Script.</p>'
    );
  }

  const safeScriptUrl = scriptUrl.replace(/"/g, '&quot;');
  const safeCertBase = certBase.replace(/"/g, '&quot;');

  return HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html><head>' +
      '<meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Preparing your e-certificate</title>' +
      '<style>body{font-family:Arial,sans-serif;line-height:1.5;color:#222;max-width:32rem;margin:3rem auto;padding:0 1rem;text-align:center}' +
      'p{color:#444}.spinner{width:2.5rem;height:2.5rem;border:3px solid #e5e7eb;border-top-color:#1a5f2a;border-radius:50%;margin:1.5rem auto;animation:spin 1s linear infinite}' +
      '@keyframes spin{to{transform:rotate(360deg)}}</style>' +
      '</head><body>' +
      '<div class="spinner" aria-hidden="true"></div>' +
      '<h1>Preparing your e-certificate</h1>' +
      '<p>Your feedback was received. Please wait while we finalize your certificate link.</p>' +
      '<p id="status">This usually takes a few seconds.</p>' +
      '<script>' +
      '(function(){' +
      'var attempts=0,maxAttempts=15,scriptUrl="' +
      safeScriptUrl +
      '",certBase="' +
      safeCertBase +
      '";' +
      'function poll(){' +
      'attempts++;' +
      'fetch(scriptUrl+"?action=latestCertCode")' +
      '.then(function(response){return response.json();})' +
      '.then(function(data){' +
      'if(data&&data.success&&data.code){window.location.replace(certBase+"/?code="+encodeURIComponent(data.code));return;}' +
      'if(attempts<maxAttempts){setTimeout(poll,2000);return;}' +
      'document.getElementById("status").textContent="Still processing. Check your email for a personalized certificate link, or open the certificate page and enter your registration code in a minute.";' +
      '})' +
      '.catch(function(){if(attempts<maxAttempts){setTimeout(poll,2000);}});' +
      '}' +
      'setTimeout(poll,1500);' +
      '})();' +
      '</script>' +
      '</body></html>'
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function findRowByCode_(registrationCode) {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return null;
  }

  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();

  for (let i = 0; i < values.length; i++) {
    const rowCode = String(values[i][COL.CODE - 1]).trim().toUpperCase();

    if (rowCode === registrationCode) {
      return {
        rowNumber: i + 2,
        values: values[i],
      };
    }
  }

  return null;
}

function generateUniqueCode_(sheet) {
  const datePart = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');

  for (let attempt = 0; attempt < 20; attempt++) {
    const randomPart = Utilities.getUuid().replace(/-/g, '').substring(0, 6).toUpperCase();
    const code = 'DUNONG-' + datePart + '-' + randomPart;
    const existing = findRowByCode_(code);

    if (!existing) {
      return code;
    }
  }

  throw new Error('Unable to generate a unique registration code.');
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  } else if (sheet.getLastColumn() < HEADERS.length) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }

  const addressHeader = String(sheet.getRange(1, COL.ADDRESS).getValue()).trim();
  if (addressHeader === 'Organization') {
    sheet.getRange(1, COL.ADDRESS).setValue('Address');
  }

  return sheet;
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}
