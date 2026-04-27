const providerSubmissionConfig = {
  marker: 'PROVIDER_NETWORK_SUBMISSION_V1',
  repo: 'Obi-agent/tpa-network-map',
};

(function loadApprovedGitHubData() {
  const approvedProviderList =
    typeof approvedProviders !== 'undefined' && Array.isArray(approvedProviders)
      ? approvedProviders
      : [];
  const approvedCategoryList =
    typeof approvedCategories !== 'undefined' && Array.isArray(approvedCategories)
      ? approvedCategories
      : [];

  if (approvedProviderList.length && typeof providers !== 'undefined' && Array.isArray(providers)) {
    const existing = new Set(providers.map((provider) => provider.id).filter(Boolean));
    approvedProviderList.forEach((provider) => {
      if (provider.id && existing.has(provider.id)) return;
      providers.push(provider);
      if (provider.id) existing.add(provider.id);
    });
  }

  if (!approvedCategoryList.length) return;

  try {
    const key = 'providerNetworkManualDataV1';
    const stored = JSON.parse(localStorage.getItem(key) || '{"categories":[],"providers":[]}');
    const categories = new Set([...(stored.categories || []), ...approvedCategoryList]);
    localStorage.setItem(
      key,
      JSON.stringify({
        categories: Array.from(categories).filter(Boolean),
        providers: Array.isArray(stored.providers) ? stored.providers : [],
      })
    );
  } catch (error) {
    // localStorage may be blocked. The approved providers still load normally.
  }
})();

(function initializeGitHubSubmissionHandoff() {
  if (typeof document === 'undefined' || !document.addEventListener) return;

  document.addEventListener('click', (event) => {
    if (event.target.closest('#addProviderButton')) {
      window.setTimeout(() => setSubmitLabel('Submit for approval'), 0);
    }
    if (event.target.closest('#addCategoryButton')) {
      window.setTimeout(() => setSubmitLabel('Submit category'), 0);
    }
  });

  document.addEventListener(
    'submit',
    (event) => {
      if (event.target.id !== 'manualForm') return;
      const form = event.target;
      const title = document.getElementById('modalTitle')?.textContent || '';
      const data = Object.fromEntries(new FormData(form).entries());

      if (title === 'Add category') {
        const category = cleanText(data.category);
        if (!category) return;
        openSubmissionIssue({
          submission_type: 'category',
          category,
          submitted_at: new Date().toISOString(),
        });
        return;
      }

      if (title === 'Add provider') {
        const provider = buildSubmissionProvider(data);
        if (!provider) return;
        openSubmissionIssue({
          submission_type: 'provider',
          provider,
          submitted_at: new Date().toISOString(),
        });
      }
    },
    true
  );
})();

function buildSubmissionProvider(data) {
  const name = cleanText(data.name);
  const type = cleanText(data.type);
  const lat = Number(data.lat);
  const lon = Number(data.lon);

  if (!name || !type || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

  const mainCountry = cleanText(data.main_country);
  return compactObject({
    id: `manual-${Date.now()}`,
    source: 'manual-submission',
    name,
    type,
    agreement: cleanText(data.agreement) || 'Agreement pending',
    main_country: mainCountry,
    country: mainCountry,
    city: cleanText(data.city),
    region: cleanText(data.region),
    lat,
    lon,
    address: cleanText(data.address),
    network_manager: cleanText(data.network_manager),
    ops_phone: cleanText(data.ops_phone),
    ops_email: cleanText(data.ops_email),
    website: cleanText(data.website),
    comments: cleanText(data.comments),
  });
}

function openSubmissionIssue(submission) {
  if (typeof window === 'undefined' || !window.open) return;

  const title =
    submission.submission_type === 'category'
      ? `Category submission: ${submission.category}`
      : `Provider submission: ${submission.provider.name}`;
  const body = [
    providerSubmissionConfig.marker,
    '',
    '```json',
    JSON.stringify(submission, null, 2),
    '```',
  ].join('\n');
  const url = `https://github.com/${providerSubmissionConfig.repo}/issues/new?title=${encodeURIComponent(
    title
  )}&body=${encodeURIComponent(body)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function setSubmitLabel(label) {
  const submitButton = document.getElementById('modalSubmit');
  if (submitButton) submitButton.textContent = label;
}

function cleanText(value) {
  return String(value || '').trim();
}

function compactObject(record) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
}
