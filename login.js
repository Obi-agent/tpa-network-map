(function initializeLoginPage() {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const loginError = document.getElementById('loginError');
  const registerError = document.getElementById('registerError');
  const registerStatus = document.getElementById('registerStatus');
  const loginButton = document.getElementById('loginButton');
  const registerButton = document.getElementById('registerButton');
  const signInTab = document.getElementById('signInTab');
  const registerTab = document.getElementById('registerTab');
  const copy = document.getElementById('loginCopy');

  showSignedOutMessage();

  if (!window.providerAuth || !loginForm || !registerForm) {
    setLoginError('Login client is not available.');
    return;
  }

  if (!window.providerAuth.isAuthRequired()) {
    setLoginError('Login is not enabled yet. The map is still using open proof-of-concept access.');
  }

  signInTab?.addEventListener('click', () => showMode('login'));
  registerTab?.addEventListener('click', () => showMode('register'));

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setLoginError('');
    setLoginBusy(true);

    try {
      const formData = new FormData(loginForm);
      await window.providerAuth.login(formData.get('email'), formData.get('password'));
      window.location.href = getSafeNextUrl();
    } catch (loginError) {
      setLoginError(loginError.message || 'Could not sign in.');
    } finally {
      setLoginBusy(false);
    }
  });

  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setRegisterError('');
    setRegisterStatus('');

    const formData = new FormData(registerForm);
    const name = formData.get('name');
    const email = formData.get('email');
    const password = String(formData.get('password') || '');
    const confirmPassword = String(formData.get('confirm_password') || '');
    const notes = formData.get('notes');

    if (password.length < 8) {
      setRegisterError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setRegisterError('Passwords do not match.');
      return;
    }

    setRegisterBusy(true);
    try {
      await window.providerAuth.register(name, email, password, notes);
      registerForm.reset();
      setRegisterStatus('Request sent. Your access will work after an administrator marks it Active.');
    } catch (registrationError) {
      setRegisterError(registrationError.message || 'Could not submit this access request.');
    } finally {
      setRegisterBusy(false);
    }
  });

  function showMode(mode) {
    const isRegister = mode === 'register';
    loginForm.hidden = isRegister;
    registerForm.hidden = !isRegister;
    signInTab?.classList.toggle('active', !isRegister);
    registerTab?.classList.toggle('active', isRegister);
    signInTab?.setAttribute('aria-selected', String(!isRegister));
    registerTab?.setAttribute('aria-selected', String(isRegister));
    if (copy) {
      copy.textContent = isRegister
        ? 'Submit your details for administrator approval.'
        : 'Use your approved email and password to continue.';
    }
    setLoginError('');
    setRegisterError('');
    setRegisterStatus('');
  }

  function setLoginBusy(isBusy) {
    if (!loginButton) return;
    loginButton.disabled = isBusy;
    loginButton.textContent = isBusy ? 'Checking...' : 'Sign in';
  }

  function setRegisterBusy(isBusy) {
    if (!registerButton) return;
    registerButton.disabled = isBusy;
    registerButton.textContent = isBusy ? 'Sending...' : 'Request access';
  }

  function setLoginError(message) {
    if (loginError) loginError.textContent = message;
  }

  function setRegisterError(message) {
    if (registerError) registerError.textContent = message;
  }

  function setRegisterStatus(message) {
    if (registerStatus) registerStatus.textContent = message;
  }

  function showSignedOutMessage() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('signed_out') === '1') {
      setLoginError('You have been signed out.');
    }
  }

  function getSafeNextUrl() {
    const params = new URLSearchParams(window.location.search);
    const next = params.get('next') || 'index.html';
    if (/^https?:\/\//i.test(next) || next.startsWith('//')) return 'index.html';
    return next;
  }
})();
