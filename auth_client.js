(function initializeProviderAuthClient() {
  if (typeof window === 'undefined') return;

  const SESSION_KEY = 'providerNetworkAuthSessionV1';
  const DEFAULT_SESSION_HOURS = 8;

  function getConfig() {
    return {
      enabled: false,
      appsScriptUrl: '',
      authEnabled: false,
      sessionDurationHours: DEFAULT_SESSION_HOURS,
      ...(window.providerSheetsConfig ? window.providerSheetsConfig : {}),
    };
  }

  function isAuthRequired() {
    return getConfig().authEnabled === true;
  }

  function hasEndpoint() {
    const config = getConfig();
    return (
      config.enabled === true &&
      typeof config.appsScriptUrl === 'string' &&
      config.appsScriptUrl.trim() !== ''
    );
  }

  async function login(email, password) {
    if (!isAuthRequired()) {
      throw new Error('Login is not enabled yet.');
    }
    if (!hasEndpoint()) {
      throw new Error('Login service is not configured.');
    }

    const normalizedEmail = normalizeEmail(email);
    const cleanPassword = String(password || '');
    if (!normalizedEmail || !cleanPassword) {
      throw new Error('Email and password are required.');
    }

    const passwordHash = await hashPassword(normalizedEmail, cleanPassword);
    const config = getConfig();
    const payload = await loadJsonp(
      `${config.appsScriptUrl}?action=login&email=${encodeURIComponent(normalizedEmail)}&password_hash=${encodeURIComponent(passwordHash)}`
    );

    if (!payload || payload.ok !== true || !payload.token) {
      throw new Error(payload?.error || 'Invalid email or password.');
    }

    saveSession(payload);
    return payload;
  }

  async function register(name, email, password, notes) {
    if (!isAuthRequired()) {
      throw new Error('Login is not enabled yet.');
    }
    if (!hasEndpoint()) {
      throw new Error('Login service is not configured.');
    }

    const cleanName = String(name || '').trim();
    const normalizedEmail = normalizeEmail(email);
    const cleanPassword = String(password || '');
    if (!cleanName || !normalizedEmail || !cleanPassword) {
      throw new Error('Name, email, and password are required.');
    }

    const passwordHash = await hashPassword(normalizedEmail, cleanPassword);
    const config = getConfig();
    const payload = await loadJsonp(
      `${config.appsScriptUrl}?action=register&name=${encodeURIComponent(cleanName)}&email=${encodeURIComponent(normalizedEmail)}&password_hash=${encodeURIComponent(passwordHash)}&notes=${encodeURIComponent(String(notes || '').trim())}`
    );

    if (!payload || payload.ok !== true || payload.pending !== true) {
      throw new Error(payload?.error || 'Could not submit this access request.');
    }

    return payload;
  }

  async function validateSession() {
    if (!isAuthRequired()) {
      return { ok: true, bypassed: true };
    }
    if (!hasEndpoint()) {
      return { ok: false, error: 'Login service is not configured.' };
    }

    const session = getStoredSession();
    if (!session || !session.token) {
      return { ok: false, error: 'No active session.' };
    }

    const config = getConfig();
    const payload = await loadJsonp(
      `${config.appsScriptUrl}?action=session&token=${encodeURIComponent(session.token)}`
    );

    if (payload && payload.ok === true && payload.authenticated === true) {
      saveSession({
        ...session,
        ...payload,
        token: payload.token || session.token,
      });
      return payload;
    }

    clearSession();
    return { ok: false, error: payload?.error || 'Session expired.' };
  }

  async function logout() {
    const session = getStoredSession();
    clearSession();
    if (!session || !session.token || !hasEndpoint()) return;
    const config = getConfig();
    try {
      await loadJsonp(`${config.appsScriptUrl}?action=logout&token=${encodeURIComponent(session.token)}`);
    } catch (error) {
      // Local logout already happened; remote cleanup is best effort.
    }
  }

  function saveSession(payload) {
    const config = getConfig();
    const expiresAt =
      Date.parse(payload.expires_at || payload.expiresAt || '') ||
      Date.now() + Number(config.sessionDurationHours || DEFAULT_SESSION_HOURS) * 60 * 60 * 1000;

    const session = {
      token: String(payload.token || '').trim(),
      email: normalizeEmail(payload.email),
      name: String(payload.name || '').trim(),
      role: String(payload.role || '').trim(),
      expires_at: new Date(expiresAt).toISOString(),
    };

    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  function getStoredSession() {
    try {
      const raw = window.localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (!session || !session.token) return null;
      const expiresAt = Date.parse(session.expires_at || '');
      if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
        clearSession();
        return null;
      }
      return session;
    } catch (error) {
      clearSession();
      return null;
    }
  }

  function clearSession() {
    try {
      window.localStorage.removeItem(SESSION_KEY);
    } catch (error) {
      // Ignore storage cleanup failures.
    }
  }

  async function hashPassword(email, password) {
    const normalizedEmail = normalizeEmail(email);
    const text = `${normalizedEmail}:${String(password || '')}`;
    const bytes = new TextEncoder().encode(text);
    const digest = await window.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  function loadJsonp(url) {
    return new Promise((resolve, reject) => {
      const callbackName = `providerAuthCallback_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
      const separator = url.includes('?') ? '&' : '?';
      const script = document.createElement('script');
      const cleanup = () => {
        delete window[callbackName];
        script.remove();
      };

      window[callbackName] = (payload) => {
        cleanup();
        resolve(payload);
      };

      script.onerror = () => {
        cleanup();
        reject(new Error('Login service request failed.'));
      };
      script.src = `${url}${separator}callback=${encodeURIComponent(callbackName)}&cache=${Date.now()}`;
      document.head.appendChild(script);
    });
  }

  window.providerAuth = {
    clearSession,
    getStoredSession,
    hashPassword,
    isAuthRequired,
    login,
    logout,
    normalizeEmail,
    register,
    validateSession,
  };
})();
