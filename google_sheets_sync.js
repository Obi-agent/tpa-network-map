(function initializeGoogleSheetsSync() {
  if (typeof window === 'undefined') return;

  const appScriptPath = 'app.js';
  const manualDataKey = 'providerNetworkManualDataV1';
  const config = {
    enabled: false,
    appsScriptUrl: '',
    ...(window.providerSheetsConfig ? window.providerSheetsConfig : {}),
  };

  if (hasEndpoint()) clearLocalManualDrafts();
  initializeSubmissionHandoff();
  window.providerSheetsDataPromise = hasEndpoint()
    ? loadApprovedData().then((data) => {
        applyApprovedData(data);
        return data;
      }).catch((error) => {
        console.warn('Could not load approved Google Sheets data.', error);
        return { providers: [], categories: [] };
      })
    : Promise.resolve({ providers: [], categories: [] });
  window.providerSheetsDataPromise.finally(loadMapApp);

  window.submitProviderNetworkSubmission = async function submitProviderNetworkSubmission(submission) {
    if (!hasEndpoint()) return { ok: false, skipped: true };

    await fetch(config.appsScriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'submit',
        submission,
      }),
    });

    return { ok: true };
  };

  async function loadApprovedData() {
    return loadJsonp(`${config.appsScriptUrl}?action=data`);
  }

  function applyApprovedData(data) {
    const approvedProviders = Array.isArray(data?.providers) ? data.providers : [];
    const approvedCategories = Array.isArray(data?.categories) ? data.categories : [];

    if (approvedProviders.length && Array.isArray(window.providers)) {
      const existing = new Set(window.providers.map((provider) => provider.id).filter(Boolean));
      approvedProviders.forEach((provider) => {
        if (provider.id && existing.has(provider.id)) return;
        window.providers.push(provider);
        if (provider.id) existing.add(provider.id);
      });
    }

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

  function initializeSubmissionHandoff() {
    document.addEventListener('click', (event) => {
      if (!hasEndpoint()) return;
      if (event.target.closest('#addProviderButton')) {
        window.setTimeout(() => setSubmitLabel('Submit for review'), 0);
      }
      if (event.target.closest('#addCategoryButton')) {
        window.setTimeout(() => setSubmitLabel('Submit category'), 0);
      }
    });

    document.addEventListener(
      'submit',
      (event) => {
        if (!hasEndpoint() || event.target.id !== 'manualForm') return;
        event.preventDefault();
        event.stopImmediatePropagation();

        const form = event.target;
        const title = document.getElementById('modalTitle')?.textContent || '';
        handleReviewSubmission(form, title);
      },
      true
    );
  }

  async function handleReviewSubmission(form, title) {
    const data = Object.fromEntries(new FormData(form).entries());
    const submitButton = document.getElementById('modalSubmit');
    const originalLabel = submitButton ? submitButton.textContent : '';

    setModalError('');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Submitting...';
    }

    try {
      if (title === 'Add category') {
        const category = cleanText(data.category);
        if (!category) throw new Error('Category name is required.');
        await window.submitProviderNetworkSubmission({
          submission_type: 'category',
          category,
          submitted_at: new Date().toISOString(),
        });
        closeModal(form);
        return;
      }

      if (title === 'Add provider') {
        const provider = buildSubmissionProvider(data);
        await window.submitProviderNetworkSubmission({
          submission_type: 'provider',
          provider,
          submitted_at: new Date().toISOString(),
        });
        closeModal(form);
      }
    } catch (error) {
      setModalError(error.message || 'Could not submit this request.');
    } finally {
      if (!document.getElementById('manualModal')?.hidden && submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalLabel;
      }
    }
  }

  function buildSubmissionProvider(data) {
    const name = cleanText(data.name);
    const type = cleanText(data.type);
    const lat = Number(data.lat);
    const lon = Number(data.lon);

    if (!name) throw new Error('Provider name is required.');
    if (!type) throw new Error('Category is required.');
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      throw new Error('Latitude must be between -90 and 90.');
    }
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      throw new Error('Longitude must be between -180 and 180.');
    }

    const mainCountry = cleanText(data.main_country);
    return compactObject({
      id: `manual-${Date.now()}`,
      source: 'google-sheets-submission',
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

  function loadMapApp() {
    if (document.querySelector(`script[src="${appScriptPath}"]`)) return;
    const script = document.createElement('script');
    script.src = appScriptPath;
    document.body.appendChild(script);
  }

  function loadJsonp(url) {
    return new Promise((resolve, reject) => {
      const callbackName = `providerSheetsCallback_${Date.now()}_${Math.floor(
        Math.random() * 100000
      )}`;
      const separator = url.includes('?') ? '&' : '?';
      const script = document.createElement('script');
      const cleanup = () => {
        delete window[callbackName];
        script.remove();
      };

      window[callbackName] = (payload) => {
        cleanup();
        resolve({
          providers: Array.isArray(payload?.providers) ? payload.providers : [],
          categories: Array.isArray(payload?.categories) ? payload.categories : [],
        });
      };

      script.onerror = () => {
        cleanup();
        reject(new Error('Google Sheets data request failed.'));
      };
      script.src = `${url}${separator}callback=${encodeURIComponent(callbackName)}&cache=${Date.now()}`;
      document.head.appendChild(script);
    });
  }

  function hasEndpoint() {
    return (
      config.enabled === true &&
      typeof config.appsScriptUrl === 'string' &&
      config.appsScriptUrl.trim() !== ''
    );
  }

  function setSubmitLabel(label) {
    const submitButton = document.getElementById('modalSubmit');
    if (submitButton) submitButton.textContent = label;
  }

  function setModalError(message) {
    const error = document.getElementById('modalError');
    if (error) error.textContent = message;
  }

  function closeModal(form) {
    if (form) form.reset();
    const modal = document.getElementById('manualModal');
    if (modal) modal.hidden = true;
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

  function compactObject(record) {
    return Object.fromEntries(
      Object.entries(record).filter(([, value]) => value !== undefined && value !== null && value !== '')
    );
  }
})();
