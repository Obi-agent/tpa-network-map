(function initializeGoogleSheetsSync() {
  if (typeof window === 'undefined') return;

  const appScriptPath = 'app.js?v=20260701-edit-approval-hardening';
  const manualDataKey = 'providerNetworkManualDataV1';
  let submissionNoticeTimer = null;
  const config = {
    enabled: false,
    appsScriptUrl: '',
    ...(window.providerSheetsConfig ? window.providerSheetsConfig : {}),
  };
  // Last known approved sheet data keeps browsers that block Apps Script from dropping approved providers.
  const embeddedFallbackApprovedData = {
    providers: [
      {
        id: 'manual-1777301718029',
        source: 'google-sheets-approved-fallback',
        name: 'Albert Einstein Israelite Hospital',
        type: 'Hospital/Clinic',
        agreement: 'Agreement pending',
        main_country: 'Brazil',
        country: 'Brazil',
        city: 'Sao Paulo',
        region: 'SP',
        lat: -23.6000507,
        lon: -46.7152458,
        address: 'Av. Albert Einstein, 627/701 - Morumbi, São Paulo - SP, 05652-900, Brazil',
        network_manager: 'International Department',
        ops_phone: '(55) 11 2151 1301',
        ops_email: 'international@einstein.br / contact@einstein.br',
        website: 'https://www.einstein.br/estrutura/unidades/morumbi',
        comments: 'Serves Sao Paulo (capital city of the State of Sao Paulo).',
      },
      {
        id: 'manual-1781698836775',
        source: 'google-sheets-approved-fallback',
        name: 'Renova Hospital',
        type: 'Hospital/Clinic',
        agreement: 'Agreement signed',
        main_country: 'Nepal',
        country: 'Nepal',
        city: 'Pokhara',
        lat: 28.2141417,
        lon: 83.95774999999999,
        address: 'Lakeside - 06, Hallan Chowk, Pokhara 33700',
        ops_phone: '+977 9813377736',
        ops_email: 'ips@renovahospital.com / admin@renovahospital.com / info@renovahospital.com',
      },
      {
        id: 'manual-1781699198876',
        source: 'google-sheets-approved-fallback',
        name: 'CIWEC Hospital',
        type: 'Hospital/Clinic',
        agreement: 'Agreement signed',
        main_country: 'Nepal',
        country: 'Nepal',
        city: 'Pokhara',
        lat: 28.2095831,
        lon: 83.9855674,
        address: '14th Street, Mansarovar Path, Lakeside, Pokhara-6',
        ops_phone: '+977 61 453082 / 457053 / Mobile +977 9856013130',
        ops_email: 'pkrbookings@ciwec-clinic.com / pkradministrator@ciwec-clinic.com',
        website: 'ciwechospital.com',
      },
      {
        id: 'manual-1781901530993',
        source: 'google-sheets-approved-fallback',
        name: 'Dentist Dr. Holger Maßen',
        type: 'Dental',
        agreement: 'GOP accepted - no DBA',
        main_country: 'Germany',
        country: 'Germany',
        city: '41747 Viersen',
        lat: 51.2585483,
        lon: 6.3848502,
        address: 'Remigiusstraße 1A, 41747 Viersen',
        ops_phone: '0049 (0)2162-20756',
        ops_email: 'dr.massen@gmail.com',
        website: 'https://www.zahnarzt-in-viersen.de/',
        comments: 'Accepts our GOP / no contract / Lisa June 2026',
      },
      {
        id: 'manual-1782170110913',
        source: 'google-sheets-approved-fallback',
        name: 'Air Medic',
        type: 'Air Ambulance',
        agreement: 'Agreement signed',
        main_country: 'Canada',
        country: 'Canada',
        lat: 45.5189662,
        lon: -73.411671,
        address: 'Saint-Hubert Airport , 4980 Airport Road, Saint-Hubert, QC J3Y 8Y9',
        ops_phone: '+1-877-999-3322 / +1 239-672-3664 (cell) / +1 450-766-0770 ext. 680',
        ops_email: 'repatriation@airmedic.net',
        website: 'https://www.airmedic.net/',
      },
    ],
    categories: [],
    changes: [
      {
        change_action: 'edit',
        target_provider: {
          name: 'TYROL AIR',
          type: 'Air Ambulance',
          agreement: 'Agreement pending',
          main_country: 'AUSTRIA',
          country: 'AUSTRIA',
          region: 'EUROPE',
          lat: 47.33333,
          lon: 13.33333,
          ops_phone: '+43 512 22422100',
          ops_email: 'air.ambulance@taa.at',
        },
        provider: {
          id: 'manual-1781901726998',
          source: 'google-sheets-approved-fallback-edit',
          name: 'TYROL AIR AMBULANCE (TAA)',
          type: 'Air Ambulance',
          agreement: 'Agreement pending',
          main_country: 'AUSTRIA',
          country: 'AUSTRIA',
          city: '6020 Innsbruck',
          region: 'EUROPE',
          lat: 47.26056029999999,
          lon: 11.3783617,
          address: 'Fürstenweg 180, 6020 Innsbruck',
          ops_phone: '+43 512 22422100',
          ops_email: 'taa@taa.at',
          website: 'https://www.taa.at/flug-ambulanz/',
        },
        request_notes: 'wrong location - they are based in Innsbruck at the airport',
      },
    ],
  };

  const fallbackApprovedData =
    window.providerSheetsFallbackData && typeof window.providerSheetsFallbackData === 'object'
      ? window.providerSheetsFallbackData
      : embeddedFallbackApprovedData;

  let lastRefreshStartedAt = 0;
  let refreshRetryTimer = null;
  let latestApprovedData = hasEndpoint()
    ? cloneApprovedData(fallbackApprovedData)
    : { providers: [], categories: [], changes: [] };
  let latestApprovedDataSignature = '';

  if (hasEndpoint()) clearLocalManualDrafts();
  publishApprovedData(latestApprovedData);
  initializeSubmissionHandoff();
  loadMapApp();

  window.providerSheetsDataPromise = Promise.resolve(latestApprovedData);
  if (hasEndpoint()) {
    refreshApprovedData();
    window.setInterval(() => refreshApprovedData(), 120000);
    window.addEventListener('focus', () => refreshApprovedData(30000));
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refreshApprovedData(30000);
    });
  }

  window.submitProviderNetworkSubmission = async function submitProviderNetworkSubmission(submission) {
    if (!hasEndpoint()) return { ok: false, skipped: true };
    const session = getActiveSession();
    const submittedBy = formatSessionUser(session) || 'Map user (no login)';
    const auditedSubmission = compactObject({
      ...submission,
      auth_token: session?.token || '',
      submitted_by: submittedBy,
    });

    await fetch(config.appsScriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'submit',
        submission: auditedSubmission,
      }),
    });

    return { ok: true };
  };

  async function loadApprovedData() {
    const url = `${config.appsScriptUrl}?action=data`;
    if (typeof window.fetch !== 'function') return loadJsonp(url, 45000);
    return loadCorsJson(url, 45000);
  }

  function refreshApprovedData(throttleMs = 0) {
    if (!hasEndpoint()) return window.providerSheetsDataPromise;
    const now = Date.now();
    if (throttleMs && now - lastRefreshStartedAt < throttleMs) {
      return window.providerSheetsDataPromise;
    }
    lastRefreshStartedAt = now;
    window.providerSheetsDataPromise = loadApprovedData()
      .then((data) => {
        if (refreshRetryTimer) {
          window.clearTimeout(refreshRetryTimer);
          refreshRetryTimer = null;
        }
        publishApprovedData(data);
        return data;
      })
      .catch(() => {
        queueApprovedDataRetry();
        return latestApprovedData;
      });
    return window.providerSheetsDataPromise;
  }

  function queueApprovedDataRetry() {
    if (refreshRetryTimer) return;
    refreshRetryTimer = window.setTimeout(() => {
      refreshRetryTimer = null;
      refreshApprovedData();
    }, 15000);
  }

  function publishApprovedData(data) {
    const approvedData = cloneApprovedData(data);
    const signature = JSON.stringify(approvedData);
    latestApprovedData = approvedData;
    window.providerSheetsLatestData = approvedData;
    applyApprovedData(approvedData);
    if (signature === latestApprovedDataSignature) return;
    latestApprovedDataSignature = signature;
    window.dispatchEvent(new CustomEvent('providerSheetsDataUpdated', { detail: approvedData }));
    if (typeof window.applyProviderSheetsData === 'function') {
      window.applyProviderSheetsData(approvedData);
    }
  }

  function applyApprovedData(data) {
    const approvedCategories = Array.isArray(data?.categories) ? data.categories : [];
    if (!approvedCategories.length) return;

    try {
      const stored = JSON.parse(window.localStorage.getItem(manualDataKey) || '{"categories":[],"providers":[]}');
      const categories = new Set([...(stored.categories || []), ...approvedCategories]);
      window.localStorage.setItem(
        manualDataKey,
        JSON.stringify({
          categories: Array.from(categories).filter(Boolean),
          providers: Array.isArray(stored.providers) ? stored.providers : [],
        })
      );
    } catch (error) {
      console.warn('Could not apply approved Google Sheets categories.', error);
    }
  }

  function cloneApprovedData(data) {
    return JSON.parse(JSON.stringify(data || { providers: [], categories: [], changes: [] }));
  }

  function initializeSubmissionHandoff() {
    document.addEventListener('click', (event) => {
      if (!hasEndpoint()) return;
      if (event.target.closest('#addProviderButton')) {
        window.setTimeout(() => {
          setSubmitLabel('Submit for review');
          allowOptionalCoordinates();
        }, 0);
      }
      if (event.target.closest('#addCategoryButton')) {
        window.setTimeout(() => setSubmitLabel('Submit category'), 0);
      }
      const providerAction = event.target.closest('[data-provider-review-action]');
      if (providerAction) {
        const label =
          providerAction.dataset.providerReviewAction === 'delete'
            ? 'Submit deletion request'
            : 'Submit edit request';
        window.setTimeout(() => {
          setSubmitLabel(label);
          allowOptionalCoordinates();
        }, 0);
      }
    });

    document.addEventListener(
      'submit',
      (event) => {
        if (!hasEndpoint() || event.target.id !== 'manualForm') return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        const form = event.target;
        const title = document.getElementById('modalTitle')?.textContent || '';
        handleReviewSubmission(form, title);
      },
      true
    );
  }

  function handleReviewSubmission(form, title) {
    const data = Object.fromEntries(new FormData(form).entries());

    setModalError('');

    try {
      let submission;

      if (title === 'Add category') {
        const category = cleanText(data.category);
        if (!category) throw new Error('Category name is required.');
        submission = {
          submission_type: 'category',
          category,
          submitted_at: new Date().toISOString(),
        };
      } else if (title === 'Add provider') {
        const provider = buildSubmissionProvider(data);
        submission = {
          submission_type: 'provider',
          provider,
          submitted_at: new Date().toISOString(),
        };
      } else if (title === 'Request provider edit') {
        const targetProvider = parseTargetProvider(data);
        const provider = buildSubmissionProvider(data);
        provider.source = 'google-sheets-submission-edit';
        submission = {
          submission_type: 'provider_change',
          change_action: 'edit',
          target_provider: targetProvider,
          provider,
          request_notes: cleanText(data.request_notes),
          submitted_at: new Date().toISOString(),
        };
      } else if (title === 'Request provider deletion') {
        const targetProvider = parseTargetProvider(data);
        submission = {
          submission_type: 'provider_change',
          change_action: 'delete',
          target_provider: targetProvider,
          request_notes: cleanText(data.request_notes),
          submitted_at: new Date().toISOString(),
        };
      } else {
        throw new Error('This request type is not supported.');
      }

      closeModal(form);
      clearLocalManualDrafts();
      queueReviewSubmission(submission);
      showSubmissionNotice('Request sent for approval.');
    } catch (error) {
      setModalError(error.message || 'Could not submit this request.');
    }
  }

  function queueReviewSubmission(submission) {
    try {
      Promise.resolve(window.submitProviderNetworkSubmission(submission)).catch((error) => {
        console.warn('Could not send provider submission to Google Sheets.', error);
        showSubmissionNotice('Request could not be sent. Please try again.', 'error');
      });
    } catch (error) {
      console.warn('Could not send provider submission to Google Sheets.', error);
      showSubmissionNotice('Request could not be sent. Please try again.', 'error');
    }
  }

  function buildSubmissionProvider(data) {
    const name = cleanText(data.name);
    const type = cleanText(data.type);
    const lat = parseCoordinateInput(data.lat);
    const lon = parseCoordinateInput(data.lon);
    const hasLat = Number.isFinite(lat);
    const hasLon = Number.isFinite(lon);

    if (!name) throw new Error('Provider name is required.');
    if (!type) throw new Error('Category is required.');
    if (hasLat !== hasLon) {
      throw new Error('Latitude and longitude must both be supplied, or both left blank.');
    }
    if (hasLat && (lat < -90 || lat > 90)) {
      throw new Error('Latitude must be between -90 and 90.');
    }
    if (hasLon && (lon < -180 || lon > 180)) {
      throw new Error('Longitude must be between -180 and 180.');
    }

    const mainCountry = cleanText(data.main_country);
    return compactObject({
      id: cleanText(data.provider_id) || `manual-${Date.now()}`,
      source: 'google-sheets-submission',
      name,
      type,
      agreement: cleanText(data.agreement) || 'Agreement pending',
      main_country: mainCountry,
      country: mainCountry,
      city: cleanText(data.city),
      region: cleanText(data.region),
      lat: hasLat ? lat : null,
      lon: hasLon ? lon : null,
      address: cleanText(data.address),
      network_manager: cleanText(data.network_manager),
      ops_phone: cleanText(data.ops_phone),
      ops_email: cleanText(data.ops_email),
      website: cleanText(data.website),
      comments: cleanText(data.comments),
    });
  }

  function parseCoordinateInput(value) {
    const text = cleanText(value);
    return text ? Number(text) : NaN;
  }

  function parseTargetProvider(data) {
    try {
      const target = JSON.parse(data.target_provider_json || '{}');
      if (!target.name) throw new Error();
      return target;
    } catch (error) {
      throw new Error('Could not identify the provider for this request.');
    }
  }

  function loadMapApp() {
    if (document.querySelector(`script[src="${appScriptPath}"]`)) return;
    const script = document.createElement('script');
    script.src = appScriptPath;
    document.body.appendChild(script);
  }

  async function loadCorsJson(url, timeoutMs = 45000) {
    const separator = url.includes('?') ? '&' : '?';
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = window.setTimeout(() => controller?.abort(), timeoutMs);

    try {
      const response = await window.fetch(`${url}${separator}cache=${Date.now()}`, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'follow',
        ...(controller ? { signal: controller.signal } : {}),
      });
      if (!response.ok) {
        throw new Error(`Google Sheets data request failed with status ${response.status}.`);
      }
      return sanitizeApprovedData(await response.json());
    } finally {
      window.clearTimeout(timer);
    }
  }

  function loadJsonp(url, timeoutMs = 45000) {
    return new Promise((resolve, reject) => {
      const callbackName = `providerSheetsCallback_${Date.now()}_${Math.floor(
        Math.random() * 100000
      )}`;
      const separator = url.includes('?') ? '&' : '?';
      const script = document.createElement('script');
      let settled = false;
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('Google Sheets data request timed out.'));
      }, timeoutMs);
      const cleanup = () => {
        window.clearTimeout(timer);
        delete window[callbackName];
        script.remove();
      };

      window[callbackName] = (payload) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(sanitizeApprovedData(payload));
      };

      script.onerror = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('Google Sheets data request failed.'));
      };
      script.src = `${url}${separator}callback=${encodeURIComponent(callbackName)}&cache=${Date.now()}`;
      document.head.appendChild(script);
    });
  }

  function sanitizeApprovedData(payload) {
    return {
      providers: Array.isArray(payload?.providers) ? payload.providers.map(sanitizeRecord) : [],
      categories: Array.isArray(payload?.categories) ? payload.categories : [],
      changes: Array.isArray(payload?.changes) ? payload.changes.map(sanitizeChange) : [],
    };
  }

  function hasEndpoint() {
    return (
      config.enabled === true &&
      typeof config.appsScriptUrl === 'string' &&
      config.appsScriptUrl.trim() !== ''
    );
  }

  function getActiveSession() {
    if (!window.providerAuth || typeof window.providerAuth.getStoredSession !== 'function') return null;
    return window.providerAuth.getStoredSession();
  }

  function formatSessionUser(session) {
    if (!session) return '';
    const name = cleanText(session.name);
    const email = cleanText(session.email);
    if (name && email) return `${name} <${email}>`;
    return email || name;
  }

  function setSubmitLabel(label) {
    const submitButton = document.getElementById('modalSubmit');
    if (submitButton) submitButton.textContent = label;
  }

  function allowOptionalCoordinates() {
    const lat = document.querySelector('input[name="lat"]');
    const lon = document.querySelector('input[name="lon"]');
    if (lat) lat.required = false;
    if (lon) lon.required = false;
  }

  function setModalError(message) {
    const error = document.getElementById('modalError');
    if (error) error.textContent = message;
  }

  function closeModal(form) {
    if (form) form.reset();
    const modal = document.getElementById('manualModal');
    if (modal) modal.hidden = true;
    const submitButton = document.getElementById('modalSubmit');
    if (submitButton) submitButton.disabled = false;
  }

  function clearLocalManualDrafts() {
    try {
      window.localStorage.setItem(manualDataKey, JSON.stringify({ categories: [], providers: [] }));
    } catch (error) {
      console.warn('Could not clear local manual provider drafts.', error);
    }
  }

  function cleanText(value) {
    return String(value || '').trim();
  }

  function showSubmissionNotice(message, type = 'success') {
    let notice = document.getElementById('submissionNotice');
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'submissionNotice';
      notice.className = 'submission-notice';
      notice.setAttribute('role', 'status');
      notice.setAttribute('aria-live', 'polite');
      document.body.appendChild(notice);
    }

    window.clearTimeout(submissionNoticeTimer);
    notice.textContent = message;
    notice.className = `submission-notice ${type === 'error' ? 'error' : 'success'}`;
    notice.hidden = false;
    window.requestAnimationFrame(() => notice.classList.add('visible'));
    submissionNoticeTimer = window.setTimeout(() => {
      notice.classList.remove('visible');
      window.setTimeout(() => {
        if (!notice.classList.contains('visible')) notice.hidden = true;
      }, 180);
    }, 3600);
  }

  function sanitizeChange(change) {
    if (!change || typeof change !== 'object') return change;
    return {
      ...change,
      target_provider: sanitizeRecord(change.target_provider),
      provider: sanitizeRecord(change.provider),
    };
  }

  function sanitizeRecord(record) {
    if (!record || typeof record !== 'object') return record;
    return Object.fromEntries(
      Object.entries(record).map(([key, value]) => [key, isSheetError(value) ? '' : value])
    );
  }

  function isSheetError(value) {
    return [
      '#error!',
      '#value!',
      '#ref!',
      '#name?',
      '#div/0!',
      '#n/a',
      '#num!',
    ].includes(String(value || '').trim().toLowerCase());
  }

  function compactObject(record) {
    return Object.fromEntries(
      Object.entries(record).filter(([, value]) => value !== undefined && value !== null && value !== '')
    );
  }
})();
