
const SPREADSHEET_ID = 'PASTE_YOUR_SPREADSHEET_ID_HERE';
const SHEET_NAME = 'Registrations';

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
};

function doGet(e) {
  const action = e && e.parameter ? e.parameter.action : '';

  if (action === 'verify') {
    return jsonResponse(verifyRegistrationCode_(e.parameter.code || ''));
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
  }

  return sheet;
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}
