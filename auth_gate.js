(function initializeAuthGate() {
  if (typeof window === 'undefined') return;

  const assetVersion = '20260428-loginpoc';
  const mapScripts = [
    {
      src: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
      integrity: 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=',
      crossOrigin: '',
    },
    { src: `data.js?v=${assetVersion}` },
    { src: `ground_ambulance.js?v=${assetVersion}` },
    { src: `air_ambulance.js?v=${assetVersion}` },
    { src: `medical_escort.js?v=${assetVersion}` },
    { src: `worldwide_hq_overrides.js?v=${assetVersion}` },
    { src: `google_sheets_sync.js?v=${assetVersion}` },
  ];

  const status = document.getElementById('authGateStatus');
  const loginUrl = `login.html?next=${encodeURIComponent('index.html')}`;

  boot();

  async function boot() {
    try {
      if (!window.providerAuth) throw new Error('Login client did not load.');
      const session = await window.providerAuth.validateSession();
      if (!session || session.ok !== true) {
        redirectToLogin();
        return;
      }

      setStatus('Loading provider network...');
      initializeLogout(session.bypassed !== true);
      await loadMapScripts();
      document.body.classList.remove('auth-pending');
      if (status) status.hidden = true;
    } catch (error) {
      console.warn('Access check failed.', error);
      redirectToLogin();
    }
  }

  function initializeLogout(showButton) {
    const button = document.getElementById('logoutButton');
    if (!button) return;
    if (!showButton) {
      button.hidden = true;
      return;
    }
    button.hidden = false;
    if (button.dataset.authReady === 'true') return;
    button.dataset.authReady = 'true';
    button.addEventListener('click', async () => {
      button.disabled = true;
      await window.providerAuth.logout();
      window.location.href = 'login.html?signed_out=1';
    });
  }

  async function loadMapScripts() {
    for (const scriptConfig of mapScripts) {
      await loadScript(scriptConfig);
    }
  }

  function loadScript({ src, integrity, crossOrigin }) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      if (integrity) script.integrity = integrity;
      if (crossOrigin !== undefined) script.crossOrigin = crossOrigin;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Could not load ${src}`));
      document.body.appendChild(script);
    });
  }

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  function redirectToLogin() {
    if (window.providerAuth) window.providerAuth.clearSession();
    setStatus('Redirecting to login...');
    window.location.replace(loginUrl);
  }
})();
