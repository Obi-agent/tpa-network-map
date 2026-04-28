(function initializeLoginPage() {
  const form = document.getElementById('loginForm');
  const error = document.getElementById('loginError');
  const button = document.getElementById('loginButton');

  showSignedOutMessage();

  if (!window.providerAuth || !form) {
    setError('Login client is not available.');
    return;
  }

  if (!window.providerAuth.isAuthRequired()) {
    setError('Login is not enabled yet. The map is still using open proof-of-concept access.');
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);

    try {
      const formData = new FormData(form);
      await window.providerAuth.login(formData.get('email'), formData.get('password'));
      window.location.href = getSafeNextUrl();
    } catch (loginError) {
      setError(loginError.message || 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  });

  function setBusy(isBusy) {
    if (!button) return;
    button.disabled = isBusy;
    button.textContent = isBusy ? 'Checking...' : 'Sign in';
  }

  function setError(message) {
    if (error) error.textContent = message;
  }

  function showSignedOutMessage() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('signed_out') === '1') {
      setError('You have been signed out.');
    }
  }

  function getSafeNextUrl() {
    const params = new URLSearchParams(window.location.search);
    const next = params.get('next') || 'index.html';
    if (/^https?:\/\//i.test(next) || next.startsWith('//')) return 'index.html';
    return next;
  }
})();
