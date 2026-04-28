(function initializePasswordHashHelper() {
  const form = document.getElementById('hashForm');
  const output = document.getElementById('passwordHashOutput');
  const error = document.getElementById('hashError');

  if (!form || !window.providerAuth) {
    setError('Password helper is not available.');
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setError('');
    if (output) output.value = '';

    const formData = new FormData(form);
    const email = window.providerAuth.normalizeEmail(formData.get('email'));
    const password = String(formData.get('password') || '');
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }

    try {
      output.value = await window.providerAuth.hashPassword(email, password);
      output.focus();
      output.select();
    } catch (hashError) {
      setError(hashError.message || 'Could not generate hash.');
    }
  });

  function setError(message) {
    if (error) error.textContent = message;
  }
})();
