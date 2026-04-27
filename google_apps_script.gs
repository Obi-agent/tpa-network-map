// Leave blank when this script is bound to the Google Sheet.
// For a standalone script from script.google.com/create, paste the spreadsheet ID here.
const SPREADSHEET_ID = '';

const PROVIDER_SHEET_NAME = 'Provider Submissions';
const CATEGORY_SHEET_NAME = 'Category Submissions';

const PROVIDER_HEADERS = [
  'review_status',
  'submitted_at',
  'approved_at',
  'provider_id',
  'name',
  'type',
  'agreement',
  'main_country',
  'country',
  'city',
  'region',
  'lat',
  'lon',
  'address',
  'network_manager',
  'ops_phone',
  'ops_email',
  'website',
  'comments',
  'source',
];

const CATEGORY_HEADERS = [
  'review_status',
  'submitted_at',
  'approved_at',
  'category',
  'notes',
];

function doGet(e) {
  ensureWorkbook_();
  const action = String(e.parameter.action || 'data');
  const payload = action === 'health'
    ? { ok: true }
    : {
        ok: true,
        providers: getApprovedProviders_(),
        categories: getApprovedCategories_(),
      };

  return respond_(payload, e.parameter.callback);
}

function doPost(e) {
  ensureWorkbook_();
  const payload = JSON.parse(e.postData.contents || '{}');
  const submission = payload.submission || payload;

  if (submission.submission_type === 'category') {
    appendCategorySubmission_(submission);
    return respond_({ ok: true, type: 'category' });
  }

  if (submission.submission_type === 'provider') {
    appendProviderSubmission_(submission);
    return respond_({ ok: true, type: 'provider' });
  }

  return respond_({ ok: false, error: 'Unknown submission type' });
}

function appendProviderSubmission_(submission) {
  const provider = submission.provider || {};
  const sheet = getSheet_(PROVIDER_SHEET_NAME, PROVIDER_HEADERS);
  sheet.appendRow(PROVIDER_HEADERS.map((header) => {
    if (header === 'review_status') return 'Pending';
    if (header === 'submitted_at') return submission.submitted_at || new Date().toISOString();
    if (header === 'approved_at') return '';
    if (header === 'provider_id') return provider.id || `manual-${Date.now()}`;
    return provider[header] || '';
  }));
}

function appendCategorySubmission_(submission) {
  const sheet = getSheet_(CATEGORY_SHEET_NAME, CATEGORY_HEADERS);
  sheet.appendRow(CATEGORY_HEADERS.map((header) => {
    if (header === 'review_status') return 'Pending';
    if (header === 'submitted_at') return submission.submitted_at || new Date().toISOString();
    if (header === 'approved_at') return '';
    if (header === 'category') return submission.category || '';
    return '';
  }));
}

function getApprovedProviders_() {
  const rows = readObjects_(PROVIDER_SHEET_NAME, PROVIDER_HEADERS);
  return rows
    .filter((row) => isApproved_(row.review_status))
    .map((row) => compact_({
      id: row.provider_id,
      source: 'google-sheets-approved',
      name: row.name,
      type: row.type,
      agreement: row.agreement,
      main_country: row.main_country,
      country: row.country || row.main_country,
      city: row.city,
      region: row.region,
      lat: Number(row.lat),
      lon: Number(row.lon),
      address: row.address,
      network_manager: row.network_manager,
      ops_phone: row.ops_phone,
      ops_email: row.ops_email,
      website: row.website,
      comments: row.comments,
    }))
    .filter((provider) => provider.name && isFinite(provider.lat) && isFinite(provider.lon));
}

function getApprovedCategories_() {
  const rows = readObjects_(CATEGORY_SHEET_NAME, CATEGORY_HEADERS);
  return Array.from(new Set(
    rows
      .filter((row) => isApproved_(row.review_status))
      .map((row) => String(row.category || '').trim())
      .filter(Boolean)
  ));
}

function readObjects_(sheetName, headers) {
  const sheet = getSheet_(sheetName, headers);
  const values = sheet.getDataRange().getValues();
  return values.slice(1).map((row) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = row[index];
    });
    return record;
  });
}

function ensureWorkbook_() {
  getSheet_(PROVIDER_SHEET_NAME, PROVIDER_HEADERS);
  getSheet_(CATEGORY_SHEET_NAME, CATEGORY_HEADERS);
}

function getSheet_(name, headers) {
  const spreadsheet = getSpreadsheet_();
  const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  const existingHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const hasHeaders = existingHeaders.some((value) => String(value || '').trim() !== '');
  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sheet;
}

function getSpreadsheet_() {
  if (SPREADSHEET_ID) return SpreadsheetApp.openById(SPREADSHEET_ID);
  return SpreadsheetApp.getActiveSpreadsheet();
}

function respond_(payload, callback) {
  if (callback) {
    const safeCallback = String(callback).replace(/[^\w.$]/g, '');
    return ContentService
      .createTextOutput(`${safeCallback}(${JSON.stringify(payload)});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function isApproved_(value) {
  return String(value || '').trim().toLowerCase() === 'approved';
}

function compact_(record) {
  const clean = {};
  Object.keys(record).forEach((key) => {
    if (record[key] !== '' && record[key] !== null && record[key] !== undefined) {
      clean[key] = record[key];
    }
  });
  return clean;
}
