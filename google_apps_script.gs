// Leave blank when this script is bound to the Google Sheet.
// For a standalone script from script.google.com/create, paste the spreadsheet ID here.
const SPREADSHEET_ID = '';

const PROVIDER_SHEET_NAME = 'Provider Submissions';
const CATEGORY_SHEET_NAME = 'Category Submissions';

const PROVIDER_HEADERS = [
  'review_status',
  'submitted_at',
  'approved_at',
  'change_action',
  'change_summary',
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
  'target_provider_id',
  'target_provider_name',
  'target_provider_type',
  'target_provider_lat',
  'target_provider_lon',
  'target_provider_json',
  'request_notes',
];

const CATEGORY_HEADERS = [
  'review_status',
  'submitted_at',
  'approved_at',
  'category',
  'notes',
];

const PROVIDER_CHANGE_FIELDS = [
  { key: 'name', label: 'Provider name' },
  { key: 'type', label: 'Category' },
  { key: 'agreement', label: 'Agreement status' },
  { key: 'main_country', label: 'Country/location' },
  { key: 'city', label: 'City' },
  { key: 'region', label: 'Region' },
  { key: 'lat', label: 'Latitude' },
  { key: 'lon', label: 'Longitude' },
  { key: 'address', label: 'Address' },
  { key: 'network_manager', label: 'Contact' },
  { key: 'ops_phone', label: 'Phone' },
  { key: 'ops_email', label: 'Email' },
  { key: 'website', label: 'Website' },
  { key: 'comments', label: 'Notes' },
];

function doGet(e) {
  ensureWorkbook_();
  const action = String(e.parameter.action || 'data');
  const payload = action === 'health'
    ? { ok: true }
    : {
        ok: true,
        providers: getApprovedProviders_(),
        changes: getApprovedProviderChanges_(),
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

  if (submission.submission_type === 'provider_change') {
    appendProviderChangeSubmission_(submission);
    return respond_({ ok: true, type: 'provider_change' });
  }

  return respond_({ ok: false, error: 'Unknown submission type' });
}

function appendProviderSubmission_(submission) {
  const provider = submission.provider || {};
  const sheet = getSheet_(PROVIDER_SHEET_NAME, PROVIDER_HEADERS);
  appendRow_(sheet, {
    review_status: 'Pending',
    submitted_at: submission.submitted_at || new Date().toISOString(),
    approved_at: '',
    change_action: 'Add',
    change_summary: buildProviderChangeSummary_('Add', provider, null),
    provider_id: provider.id || `manual-${Date.now()}`,
    name: provider.name || '',
    type: provider.type || '',
    agreement: provider.agreement || '',
    main_country: provider.main_country || '',
    country: provider.country || '',
    city: provider.city || '',
    region: provider.region || '',
    lat: valueOrBlank_(provider.lat),
    lon: valueOrBlank_(provider.lon),
    address: provider.address || '',
    network_manager: provider.network_manager || '',
    ops_phone: provider.ops_phone || '',
    ops_email: provider.ops_email || '',
    website: provider.website || '',
    comments: provider.comments || '',
    source: provider.source || '',
  }, PROVIDER_HEADERS);
}

function appendProviderChangeSubmission_(submission) {
  const provider = submission.provider || {};
  const target = submission.target_provider || {};
  const sheet = getSheet_(PROVIDER_SHEET_NAME, PROVIDER_HEADERS);
  appendRow_(sheet, {
    review_status: 'Pending',
    submitted_at: submission.submitted_at || new Date().toISOString(),
    approved_at: '',
    change_action: submission.change_action || '',
    change_summary: buildProviderChangeSummary_(submission.change_action || '', provider, target),
    provider_id: provider.id || target.id || '',
    name: provider.name || '',
    type: provider.type || '',
    agreement: provider.agreement || '',
    main_country: provider.main_country || '',
    country: provider.country || '',
    city: provider.city || '',
    region: provider.region || '',
    lat: valueOrBlank_(provider.lat),
    lon: valueOrBlank_(provider.lon),
    address: provider.address || '',
    network_manager: provider.network_manager || '',
    ops_phone: provider.ops_phone || '',
    ops_email: provider.ops_email || '',
    website: provider.website || '',
    comments: provider.comments || '',
    source: provider.source || '',
    target_provider_id: target.id || '',
    target_provider_name: target.name || '',
    target_provider_type: target.type || '',
    target_provider_lat: valueOrBlank_(target.lat),
    target_provider_lon: valueOrBlank_(target.lon),
    target_provider_json: JSON.stringify(target),
    request_notes: submission.request_notes || '',
  }, PROVIDER_HEADERS);
}

function appendCategorySubmission_(submission) {
  const sheet = getSheet_(CATEGORY_SHEET_NAME, CATEGORY_HEADERS);
  appendRow_(sheet, {
    review_status: 'Pending',
    submitted_at: submission.submitted_at || new Date().toISOString(),
    approved_at: '',
    category: submission.category || '',
  }, CATEGORY_HEADERS);
}

function buildProviderChangeSummary_(action, provider, target) {
  const normalizedAction = String(action || '').trim().toLowerCase();
  if (normalizedAction === 'delete') {
    return `Deletion requested for: ${formatProviderIdentity_(target || provider)}`;
  }

  if (normalizedAction === 'edit') {
    const before = target || {};
    const after = provider || {};
    const changes = PROVIDER_CHANGE_FIELDS
      .map((field) => formatProviderFieldChange_(field, before, after))
      .filter(Boolean);
    return changes.length ? changes.join('\n') : 'No field changes detected; see request notes.';
  }

  return buildProviderAddSummary_(provider || {});
}

function buildProviderAddSummary_(provider) {
  const lines = [
    `New provider requested: ${formatProviderIdentity_(provider)}`,
    provider.agreement ? `Agreement status: ${formatProviderChangeValue_(provider.agreement)}` : '',
    provider.address ? `Address: ${formatProviderChangeValue_(provider.address)}` : '',
    provider.ops_phone ? `Phone: ${formatProviderChangeValue_(provider.ops_phone)}` : '',
    provider.ops_email ? `Email: ${formatProviderChangeValue_(provider.ops_email)}` : '',
  ].filter(Boolean);
  return lines.join('\n');
}

function formatProviderFieldChange_(field, before, after) {
  const beforeValue = getProviderSummaryValue_(before, field.key);
  const afterValue = getProviderSummaryValue_(after, field.key);
  if (providerSummaryValuesEqual_(field.key, beforeValue, afterValue)) return '';
  return `${field.label}: ${formatProviderChangeValue_(beforeValue)} -> ${formatProviderChangeValue_(afterValue)}`;
}

function getProviderSummaryValue_(provider, key) {
  if (!provider) return '';
  if (key === 'main_country') {
    return provider.main_country || provider.country || '';
  }
  return provider[key];
}

function providerSummaryValuesEqual_(key, beforeValue, afterValue) {
  const beforeText = normalizeProviderSummaryValue_(beforeValue);
  const afterText = normalizeProviderSummaryValue_(afterValue);
  if (!beforeText && !afterText) return true;

  if (key === 'lat' || key === 'lon') {
    const beforeNumber = Number(beforeText);
    const afterNumber = Number(afterText);
    if (isFinite(beforeNumber) && isFinite(afterNumber)) {
      return Math.abs(beforeNumber - afterNumber) < 0.000001;
    }
  }

  return beforeText === afterText;
}

function normalizeProviderSummaryValue_(value) {
  return String(value === null || value === undefined ? '' : value)
    .trim()
    .replace(/\s+/g, ' ');
}

function formatProviderChangeValue_(value) {
  const text = normalizeProviderSummaryValue_(value);
  if (!text) return '(blank)';
  const trimmed = text.length > 220 ? `${text.slice(0, 217)}...` : text;
  return `"${trimmed}"`;
}

function formatProviderIdentity_(provider) {
  const record = provider || {};
  const name = normalizeProviderSummaryValue_(record.name) || 'Unknown provider';
  const location = getProviderSummaryValue_(record, 'main_country');
  const details = [
    record.type,
    record.city,
    location,
  ]
    .map((value) => normalizeProviderSummaryValue_(value))
    .filter(Boolean);
  return details.length ? `${name} (${details.join(', ')})` : name;
}

function getApprovedProviders_() {
  const rows = readObjects_(PROVIDER_SHEET_NAME, PROVIDER_HEADERS);
  return rows
    .filter((row) => isApproved_(row.review_status) && isAddAction_(row.change_action))
    .map((row) => resolveProviderCoordinates_(buildApprovedProvider_(row, 'google-sheets-approved'), row))
    .filter((provider) => provider.name && isFinite(provider.lat) && isFinite(provider.lon));
}

function getApprovedProviderChanges_() {
  const rows = readObjects_(PROVIDER_SHEET_NAME, PROVIDER_HEADERS);
  return rows
    .filter((row) => isApproved_(row.review_status) && isChangeAction_(row.change_action))
    .map((row) => {
      const target = parseJson_(row.target_provider_json) || compact_({
        id: row.target_provider_id,
        name: row.target_provider_name,
        type: row.target_provider_type,
        lat: row.target_provider_lat,
        lon: row.target_provider_lon,
      });
      const action = String(row.change_action || '').trim().toLowerCase();
      let provider = compact_({
        id: row.provider_id || target.id,
        source: 'google-sheets-approved-edit',
        name: row.name,
        type: row.type,
        agreement: row.agreement,
        main_country: row.main_country,
        country: row.country || row.main_country,
        city: row.city,
        region: row.region,
        lat: parseNumber_(row.lat),
        lon: parseNumber_(row.lon),
        address: row.address,
        network_manager: row.network_manager,
        ops_phone: row.ops_phone,
        ops_email: row.ops_email,
        website: row.website,
        comments: row.comments,
      });
      if (action === 'edit') {
        provider = resolveProviderCoordinates_(provider, row);
      }
      return compact_({
        change_action: action,
        change_summary: row.change_summary,
        target_provider: target,
        provider,
        approved_at: row.approved_at,
        request_notes: row.request_notes,
      });
    })
    .filter((change) => change.target_provider && change.target_provider.name);
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
  const formulas = sheet.getDataRange().getFormulas();
  const actualHeaders = getSheetHeaders_(sheet, headers);
  return values.slice(1).map((row, rowIndex) => {
    const record = {};
    const sheetRow = rowIndex + 2;
    headers.forEach((header) => {
      const index = actualHeaders.indexOf(header);
      if (index === -1) {
        record[header] = '';
        return;
      }

      const normalized = normalizeSheetCell_(row[index], formulas[rowIndex + 1] && formulas[rowIndex + 1][index]);
      record[header] = normalized.value;
      if (normalized.recovered) {
        writeTextCell_(sheet, sheetRow, index + 1, normalized.value);
      }
    });
    record.__row_number = sheetRow;
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
  const width = Math.max(sheet.getLastColumn(), headers.length);
  const existingHeaders = sheet.getRange(1, 1, 1, width).getValues()[0];
  const hasHeaders = existingHeaders.some((value) => String(value || '').trim() !== '');
  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  } else {
    const normalized = existingHeaders.map((value) => String(value || '').trim());
    const missing = headers.filter((header) => !normalized.includes(header));
    if (missing.length) {
      const startColumn = normalized.filter(Boolean).length + 1;
      sheet.getRange(1, startColumn, 1, missing.length).setValues([missing]);
      sheet.getRange(1, startColumn, 1, missing.length).setFontWeight('bold');
    }
  }
  return sheet;
}

function getSheetHeaders_(sheet, fallbackHeaders) {
  const width = Math.max(sheet.getLastColumn(), fallbackHeaders.length);
  return sheet
    .getRange(1, 1, 1, width)
    .getValues()[0]
    .map((header) => String(header || '').trim());
}

function appendRow_(sheet, valuesByHeader, fallbackHeaders) {
  const headers = getSheetHeaders_(sheet, fallbackHeaders).filter(Boolean);
  const values = headers.map((header) => valuesByHeader[header] !== undefined ? valuesByHeader[header] : '');
  const rowNumber = sheet.getLastRow() + 1;
  const range = sheet.getRange(rowNumber, 1, 1, headers.length);
  range.setNumberFormat('@');
  range.setValues([values]);
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

function isAddAction_(value) {
  const action = String(value || '').trim().toLowerCase();
  return action === '' || action === 'add';
}

function isChangeAction_(value) {
  const action = String(value || '').trim().toLowerCase();
  return action === 'edit' || action === 'delete';
}

function parseJson_(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch (error) {
    return null;
  }
}

function parseNumber_(value) {
  if (value === '' || value === null || value === undefined) return NaN;
  return Number(value);
}

function normalizeSheetCell_(value, formula) {
  const formulaText = String(formula || '').trim();
  if (formulaText.indexOf('=+') === 0) {
    return { value: formulaText.slice(1), recovered: true };
  }
  if (isSheetError_(value)) {
    return { value: '', recovered: false };
  }
  return { value, recovered: false };
}

function isSheetError_(value) {
  const text = String(value || '').trim().toUpperCase();
  return [
    '#ERROR!',
    '#VALUE!',
    '#REF!',
    '#NAME?',
    '#DIV/0!',
    '#N/A',
    '#NUM!',
  ].includes(text);
}

function writeTextCell_(sheet, row, column, value) {
  sheet.getRange(row, column).setNumberFormat('@').setValue(value);
}

function buildApprovedProvider_(row, source) {
  return compact_({
    id: row.provider_id,
    source,
    name: row.name,
    type: row.type,
    agreement: row.agreement,
    main_country: row.main_country,
    country: row.country || row.main_country,
    city: row.city,
    region: row.region,
    lat: parseNumber_(row.lat),
    lon: parseNumber_(row.lon),
    address: row.address,
    network_manager: row.network_manager,
    ops_phone: row.ops_phone,
    ops_email: row.ops_email,
    website: row.website,
    comments: row.comments,
  });
}

function resolveProviderCoordinates_(provider, row) {
  if (!provider || !provider.name) return provider;
  const lat = parseNumber_(provider.lat);
  const lon = parseNumber_(provider.lon);
  if (hasUsableCoordinates_(lat, lon)) {
    return provider;
  }

  const geocoded = geocodeProvider_(provider);
  if (!geocoded) return provider;

  writeResolvedCoordinates_(row, geocoded.lat, geocoded.lon);
  return {
    ...provider,
    lat: geocoded.lat,
    lon: geocoded.lon,
  };
}

function hasUsableCoordinates_(lat, lon) {
  return (
    isFinite(lat) &&
    isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180 &&
    !(lat === 0 && lon === 0)
  );
}

function geocodeProvider_(provider) {
  const geocoder = Maps.newGeocoder();
  const queries = buildGeocodeQueries_(provider);
  for (let index = 0; index < queries.length; index += 1) {
    try {
      const response = geocoder.geocode(queries[index]);
      const location = response &&
        response.results &&
        response.results[0] &&
        response.results[0].geometry &&
        response.results[0].geometry.location;
      const lat = location && parseNumber_(location.lat);
      const lon = location && parseNumber_(location.lng);
      if (hasUsableCoordinates_(lat, lon)) {
        return { lat, lon };
      }
    } catch (error) {
      // Try the next broader query before giving up.
    }
  }
  return null;
}

function buildGeocodeQueries_(provider) {
  const address = String(provider.address || '').trim();
  const city = String(provider.city || '').trim();
  const country = String(provider.country || provider.main_country || '').trim();
  const mainCountry = String(provider.main_country || '').trim();
  const queries = [
    [address, city, country],
    [address, country],
    [city, country],
    [country],
    [address, city, mainCountry],
    [city, mainCountry],
    [mainCountry],
  ]
    .map((parts) => parts.filter(Boolean).join(', '))
    .filter(Boolean);
  return Array.from(new Set(queries));
}

function writeResolvedCoordinates_(row, lat, lon) {
  if (!row || !row.__row_number) return;
  const sheet = getSheet_(PROVIDER_SHEET_NAME, PROVIDER_HEADERS);
  const headers = getSheetHeaders_(sheet, PROVIDER_HEADERS);
  const latColumn = headers.indexOf('lat') + 1;
  const lonColumn = headers.indexOf('lon') + 1;
  if (latColumn > 0) sheet.getRange(row.__row_number, latColumn).setValue(lat);
  if (lonColumn > 0) sheet.getRange(row.__row_number, lonColumn).setValue(lon);
}

function valueOrBlank_(value) {
  return value === null || value === undefined ? '' : value;
}

function compact_(record) {
  const clean = {};
  Object.keys(record).forEach((key) => {
    if (
      record[key] !== '' &&
      record[key] !== null &&
      record[key] !== undefined &&
      !(typeof record[key] === 'number' && !isFinite(record[key]))
    ) {
      clean[key] = record[key];
    }
  });
  return clean;
}
