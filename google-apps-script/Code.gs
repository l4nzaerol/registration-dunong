
const SPREADSHEET_ID = 'PASTE_YOUR_SPREADSHEET_ID_HERE';
const SHEET_NAME = 'Registrations';

// E-certificate page URL shown in Google Form confirmation (no trailing slash).
// Example: https://your-site.vercel.app
const CERTIFICATE_PAGE_URL = 'PASTE_YOUR_DEPLOYED_APP_URL_HERE';

// Google Form response columns (0 = timestamp). Adjust if your form field order differs.
const FORM_COL = {
  REGISTRATION_CODE: 1,
  RATING: 2,
  COMMENTS: 3,
};

const HEADERS = [
  'Timestamp',
  'Registration Code',
  'Full Name',
  'Email',
  'Organization',
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
  ORGANIZATION: 5,
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
    return redirectToCertificate_(e.parameter.code || '');
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
  const organization = String(data.organization || '').trim();
  const phone = String(data.phone || '').trim();

  if (!fullName || !email || !organization) {
    return { success: false, message: 'Full name, email, and organization are required.' };
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
    organization,
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
    organization: organization,
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
    organization: row.values[COL.ORGANIZATION - 1],
    feedbackSubmitted: String(row.values[COL.FEEDBACK_SUBMITTED - 1]).toLowerCase() === 'yes',
    certificateIssued: String(row.values[COL.CERTIFICATE_ISSUED - 1]).toLowerCase() === 'yes',
  };
}

function buildCertificateUrl_(registrationCode, autoDownload) {
  if (!CERTIFICATE_PAGE_URL || CERTIFICATE_PAGE_URL.indexOf('PASTE_YOUR') !== -1) {
    return '';
  }

  const base = CERTIFICATE_PAGE_URL.replace(/\/$/, '');
  const url =
    base +
    '/?code=' +
    encodeURIComponent(registrationCode) +
    (autoDownload ? '&download=1' : '');

  return url;
}

function redirectToCertificate_(code) {
  const registrationCode = String(code || '').trim().toUpperCase();
  const certUrl = buildCertificateUrl_(registrationCode, true);

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
    '" style="display:inline-block;padding:12px 20px;background:#1a5f2a;color:#fff;text-decoration:none;border-radius:6px;">View &amp; Download E-Certificate</a></p>' +
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
    'Open this link to view and download your certificate:\n' +
    certUrl;

  MailApp.sendEmail({
    to: email,
    subject: subject,
    body: plainBody,
    htmlBody: htmlBody,
  });
}

function issueCertificate_(code) {
  const registrationCode = String(code || '').trim().toUpperCase();

  if (!registrationCode) {
    return { success: false, message: 'Registration code is required.' };
  }

  const row = findRowByCode_(registrationCode);

  if (!row) {
    return {
      success: false,
      message: 'Registration code not found. Only registered participants can receive a certificate.',
    };
  }

  const feedbackSubmitted =
    String(row.values[COL.FEEDBACK_SUBMITTED - 1]).toLowerCase() === 'yes';

  if (!feedbackSubmitted) {
    return {
      success: false,
      feedbackRequired: true,
      message:
        'Feedback has not been submitted yet. Please complete the Google Form first, then return here for your e-certificate.',
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
    registrationCode: row.values[COL.CODE - 1],
    fullName: row.values[COL.FULL_NAME - 1],
    certificateUrl: buildCertificateUrl_(row.values[COL.CODE - 1], true),
    message: alreadyIssued
      ? 'Your e-certificate is ready. You can download it again below.'
      : 'Your e-certificate is ready. You can download it below.',
  };
}

/**
 * Installable trigger: Run when a Google Form response is submitted.
 * In Apps Script: Triggers → Add trigger → onFormSubmit → From spreadsheet → On form submit.
 *
 * Expected form fields (in order):
 * 1. Registration Code (short answer)
 * 2. Webinar Rating (1–5)
 * 3. Feedback Comments (paragraph)
 */
function onFormSubmit(e) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    const responses = e.values;
    const registrationCode = String(responses[FORM_COL.REGISTRATION_CODE] || '')
      .trim()
      .toUpperCase();
    const ratingRaw = responses[FORM_COL.RATING];
    const comments = String(responses[FORM_COL.COMMENTS] || '').trim();

    if (!registrationCode) {
      Logger.log('Form submit skipped: missing registration code.');
      return;
    }

    const row = findRowByCode_(registrationCode);

    if (!row) {
      Logger.log('Form submit: registration code not found — ' + registrationCode);
      return;
    }

    const alreadySubmitted =
      String(row.values[COL.FEEDBACK_SUBMITTED - 1]).toLowerCase() === 'yes';
    const rating = parseRating_(ratingRaw);
    const sheet = getSheet_();

    if (!alreadySubmitted) {
      sheet.getRange(row.rowNumber, COL.FEEDBACK_SUBMITTED).setValue('Yes');
      sheet.getRange(row.rowNumber, COL.FEEDBACK_DATE).setValue(new Date());
      if (rating) {
        sheet.getRange(row.rowNumber, COL.RATING).setValue(rating);
      }
      if (comments) {
        sheet.getRange(row.rowNumber, COL.COMMENTS).setValue(comments);
      }
    }

    const certUrl = buildCertificateUrl_(registrationCode, true);
    sheet.getRange(row.rowNumber, COL.CERTIFICATE_ISSUED).setValue('Yes');
    if (certUrl) {
      sheet.getRange(row.rowNumber, COL.CERTIFICATE_LINK).setValue(certUrl);
    }

    const fullName = row.values[COL.FULL_NAME - 1];
    const email = row.values[COL.EMAIL - 1];

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
    organization: row.values[COL.ORGANIZATION - 1],
    message: alreadySubmitted
      ? 'Feedback was already submitted. You can download your certificate again.'
      : 'Thank you for your feedback. Your e-certificate is ready.',
  };
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

  return sheet;
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}
