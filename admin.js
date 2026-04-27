const ADMIN_CONFIG = {
  owner: 'Obi-agent',
  repo: 'tpa-network-map',
  branch: 'main',
  marker: 'PROVIDER_NETWORK_SUBMISSION_V1',
  providersPath: 'approved_providers.js',
  categoriesPath: 'approved_categories.js',
};

const tokenInput = document.getElementById('githubToken');
const connectButton = document.getElementById('connectButton');
const refreshButton = document.getElementById('refreshButton');
const statusEl = document.getElementById('adminStatus');
const queueCountEl = document.getElementById('queueCount');
const submissionListEl = document.getElementById('submissionList');

let submissions = [];

tokenInput.value = sessionStorage.getItem('providerReviewGithubToken') || '';
connectButton.addEventListener('click', () => {
  sessionStorage.setItem('providerReviewGithubToken', tokenInput.value.trim());
  loadSubmissions();
});
refreshButton.addEventListener('click', loadSubmissions);
submissionListEl.addEventListener('click', handleSubmissionAction);

if (tokenInput.value) {
  loadSubmissions();
}

async function loadSubmissions() {
  const token = getToken();
  if (!token) {
    setStatus('Enter a GitHub token to review submissions.', true);
    return;
  }

  setStatus('Loading pending submissions...');
  submissionListEl.innerHTML = '';

  try {
    const query = `repo:${ADMIN_CONFIG.owner}/${ADMIN_CONFIG.repo} is:issue is:open ${ADMIN_CONFIG.marker}`;
    const result = await githubFetch(`/search/issues?q=${encodeURIComponent(query)}&per_page=50&sort=created&order=asc`);
    submissions = result.items.map(parseSubmissionIssue).filter(Boolean);
    renderSubmissions();
    setStatus(`Loaded ${submissions.length} pending submission${submissions.length === 1 ? '' : 's'}.`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

function parseSubmissionIssue(issue) {
  const body = issue.body || '';
  if (!body.includes(ADMIN_CONFIG.marker)) return null;

  const match = body.match(/```json\s*([\s\S]*?)```/);
  if (!match) return null;

  try {
    const data = JSON.parse(match[1]);
    if (!['provider', 'category'].includes(data.submission_type)) return null;
    return {
      issue,
      data,
      type: data.submission_type,
    };
  } catch (error) {
    return null;
  }
}

function renderSubmissions() {
  queueCountEl.textContent = String(submissions.length);
  submissionListEl.innerHTML = '';

  if (!submissions.length) {
    const template = document.getElementById('emptyStateTemplate');
    submissionListEl.appendChild(template.content.cloneNode(true));
    return;
  }

  submissions.forEach((submission, index) => {
    const card = document.createElement('article');
    card.className = 'submission-card';
    card.dataset.index = String(index);
    card.innerHTML = submission.type === 'provider'
      ? renderProviderCard(submission)
      : renderCategoryCard(submission);
    submissionListEl.appendChild(card);
  });
}

function renderProviderCard(submission) {
  const provider = submission.data.provider || {};
  return `
    <header>
      <div>
        <h3>${escapeHTML(provider.name || 'Unnamed provider')}</h3>
        <div class="submission-meta">Issue #${submission.issue.number} - ${escapeHTML(provider.type || 'Provider')}</div>
      </div>
      <a class="map-link" href="${escapeAttribute(submission.issue.html_url)}" target="_blank" rel="noopener">Open issue</a>
    </header>
    <div class="submission-fields" data-kind="provider">
      ${textField('name', 'Provider name', provider.name, 'wide')}
      ${textField('type', 'Category', provider.type)}
      ${textField('agreement', 'Agreement status', provider.agreement)}
      ${textField('main_country', 'Country or location', provider.main_country)}
      ${textField('city', 'City', provider.city)}
      ${textField('region', 'Region', provider.region)}
      ${numberField('lat', 'Latitude', provider.lat)}
      ${numberField('lon', 'Longitude', provider.lon)}
      ${textField('address', 'Address', provider.address, 'wide')}
      ${textField('network_manager', 'Contact', provider.network_manager)}
      ${textField('ops_phone', 'Phone', provider.ops_phone)}
      ${textField('ops_email', 'Email', provider.ops_email)}
      ${textField('website', 'Website', provider.website)}
      ${textareaField('comments', 'Notes', provider.comments, 'full')}
    </div>
    <div class="review-actions">
      <button class="secondary-action" type="button" data-action="refresh">Reset edits</button>
      <button class="danger-action" type="button" data-action="reject">Reject</button>
      <button class="primary-action" type="button" data-action="approve">Approve</button>
    </div>
  `;
}

function renderCategoryCard(submission) {
  return `
    <header>
      <div>
        <h3>${escapeHTML(submission.data.category || 'Unnamed category')}</h3>
        <div class="submission-meta">Issue #${submission.issue.number} - Category</div>
      </div>
      <a class="map-link" href="${escapeAttribute(submission.issue.html_url)}" target="_blank" rel="noopener">Open issue</a>
    </header>
    <div class="submission-fields" data-kind="category">
      ${textField('category', 'Category name', submission.data.category, 'wide')}
    </div>
    <div class="review-actions">
      <button class="secondary-action" type="button" data-action="refresh">Reset edits</button>
      <button class="danger-action" type="button" data-action="reject">Reject</button>
      <button class="primary-action" type="button" data-action="approve">Approve</button>
    </div>
  `;
}

async function handleSubmissionAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const card = event.target.closest('.submission-card');
  const submission = submissions[Number(card.dataset.index)];
  if (!submission) return;

  const action = button.dataset.action;
  if (action === 'refresh') {
    renderSubmissions();
    return;
  }

  button.disabled = true;
  setStatus(`${capitalize(action)}ing issue #${submission.issue.number}...`);

  try {
    if (action === 'approve') {
      await approveSubmission(card, submission);
    } else if (action === 'reject') {
      await rejectSubmission(submission);
    }
    await loadSubmissions();
  } catch (error) {
    button.disabled = false;
    setStatus(error.message, true);
  }
}

async function approveSubmission(card, submission) {
  if (submission.type === 'provider') {
    const provider = readProviderFromCard(card);
    const approved = {
      ...provider,
      id: provider.id || submission.data.provider?.id || `approved-provider-${submission.issue.number}`,
      source: 'github-approved',
      source_issue: submission.issue.number,
      approved_at: new Date().toISOString(),
    };
    await upsertArrayRecord({
      path: ADMIN_CONFIG.providersPath,
      variableName: 'approvedProviders',
      record: approved,
      match: (item) => item.id === approved.id || item.source_issue === approved.source_issue,
      message: `Approve provider submission #${submission.issue.number}: ${provider.name}`,
    });
    await commentAndCloseIssue(submission.issue.number, `Approved provider submission for ${provider.name}.`);
    return;
  }

  const category = readCategoryFromCard(card);
  await upsertArrayRecord({
    path: ADMIN_CONFIG.categoriesPath,
    variableName: 'approvedCategories',
    record: category,
    match: (item) => String(item).toLowerCase() === category.toLowerCase(),
    message: `Approve category submission #${submission.issue.number}: ${category}`,
  });
  await commentAndCloseIssue(submission.issue.number, `Approved category submission for ${category}.`);
}

async function rejectSubmission(submission) {
  const label = submission.type === 'provider'
    ? submission.data.provider?.name || 'provider'
    : submission.data.category || 'category';
  await githubFetch(`/repos/${ADMIN_CONFIG.owner}/${ADMIN_CONFIG.repo}/issues/${submission.issue.number}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body: `Rejected submission for ${label}.` }),
  });
  await githubFetch(`/repos/${ADMIN_CONFIG.owner}/${ADMIN_CONFIG.repo}/issues/${submission.issue.number}`, {
    method: 'PATCH',
    body: JSON.stringify({ state: 'closed' }),
  });
}

async function upsertArrayRecord({ path, variableName, record, match, message }) {
  const file = await githubFetch(`/repos/${ADMIN_CONFIG.owner}/${ADMIN_CONFIG.repo}/contents/${path}?ref=${ADMIN_CONFIG.branch}`);
  const currentText = decodeBase64(file.content);
  const rows = parseArrayFile(currentText, variableName);
  const index = rows.findIndex(match);

  if (index === -1) {
    rows.push(record);
  } else {
    rows[index] = record;
  }

  const nextText = `const ${variableName} = ${JSON.stringify(rows, null, 2)};\n`;
  await githubFetch(`/repos/${ADMIN_CONFIG.owner}/${ADMIN_CONFIG.repo}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({
      message,
      content: encodeBase64(nextText),
      sha: file.sha,
      branch: ADMIN_CONFIG.branch,
    }),
  });
}

async function commentAndCloseIssue(issueNumber, body) {
  await githubFetch(`/repos/${ADMIN_CONFIG.owner}/${ADMIN_CONFIG.repo}/issues/${issueNumber}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
  await githubFetch(`/repos/${ADMIN_CONFIG.owner}/${ADMIN_CONFIG.repo}/issues/${issueNumber}`, {
    method: 'PATCH',
    body: JSON.stringify({ state: 'closed' }),
  });
}

function readProviderFromCard(card) {
  const provider = {};
  card.querySelectorAll('[data-field]').forEach((field) => {
    provider[field.dataset.field] = field.value.trim();
  });
  provider.lat = Number(provider.lat);
  provider.lon = Number(provider.lon);

  if (!provider.name) throw new Error('Provider name is required.');
  if (!provider.type) throw new Error('Category is required.');
  if (!Number.isFinite(provider.lat) || provider.lat < -90 || provider.lat > 90) {
    throw new Error('Latitude must be between -90 and 90.');
  }
  if (!Number.isFinite(provider.lon) || provider.lon < -180 || provider.lon > 180) {
    throw new Error('Longitude must be between -180 and 180.');
  }

  if (!provider.country && provider.main_country) provider.country = provider.main_country;
  return compactObject(provider);
}

function readCategoryFromCard(card) {
  const category = card.querySelector('[data-field="category"]')?.value.trim();
  if (!category) throw new Error('Category name is required.');
  return category;
}

async function githubFetch(path, options = {}) {
  const token = getToken();
  const response = await fetch(path.startsWith('https://') ? path : `https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const payload = await response.json();
      detail = payload.message || detail;
    } catch (error) {
      detail = await response.text();
    }
    throw new Error(`GitHub API ${response.status}: ${detail}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

function parseArrayFile(text, variableName) {
  const pattern = new RegExp(`const\\s+${variableName}\\s*=\\s*([\\s\\S]*?);\\s*$`);
  const match = text.match(pattern);
  if (!match) throw new Error(`Could not parse ${variableName}.`);
  return JSON.parse(match[1]);
}

function textField(name, label, value = '', className = '') {
  return `
    <label class="form-field ${className}">
      <span>${escapeHTML(label)}</span>
      <input data-field="${escapeAttribute(name)}" value="${escapeAttribute(value || '')}" />
    </label>
  `;
}

function numberField(name, label, value = '') {
  return `
    <label class="form-field">
      <span>${escapeHTML(label)}</span>
      <input data-field="${escapeAttribute(name)}" type="number" step="any" value="${escapeAttribute(value || '')}" />
    </label>
  `;
}

function textareaField(name, label, value = '', className = '') {
  return `
    <label class="form-field ${className}">
      <span>${escapeHTML(label)}</span>
      <textarea data-field="${escapeAttribute(name)}" rows="3">${escapeHTML(value || '')}</textarea>
    </label>
  `;
}

function getToken() {
  return tokenInput.value.trim();
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

function compactObject(record) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
}

function decodeBase64(value) {
  const binary = atob(value.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function escapeAttribute(value) {
  return escapeHTML(value).replace(/`/g, '&#96;');
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\x22/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
