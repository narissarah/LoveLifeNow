/**
 * Login page authentication handler
 */
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const passwordInput = document.getElementById('password');
  const loginBtn = document.getElementById('loginBtn');
  const errorMessage = document.getElementById('errorMessage');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const password = passwordInput.value.trim();
    if (!password) {
      showError('Please enter the admin password');
      return;
    }

    setLoading(true);
    hideError();

    try {
      const response = await fetch('/api/auth-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Redirect to dashboard on success
        window.location.href = '/dashboard';
      } else {
        showError(data.error || 'Login failed. Please try again.');
        passwordInput.value = '';
        passwordInput.focus();
      }
    } catch (error) {
      console.error('Login error:', error);
      showError('Unable to connect to server. Please try again.');
    } finally {
      setLoading(false);
    }
  });

  function setLoading(loading) {
    loginBtn.disabled = loading;
    loginBtn.querySelector('.btn-text').style.display = loading ? 'none' : 'inline';
    loginBtn.querySelector('.btn-loading').style.display = loading ? 'inline' : 'none';
  }

  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
  }

  function hideError() {
    errorMessage.style.display = 'none';
  }

  // Focus password input on load
  passwordInput.focus();
});
