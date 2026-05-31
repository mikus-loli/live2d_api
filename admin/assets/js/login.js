var Login = (function () {
  function init() {
    initTheme();
    initRememberedUser();
    bindEvents();
  }

  function initTheme() {
    var saved = localStorage.getItem('live2d-admin-theme');
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
    }
  }

  function initRememberedUser() {
    var saved = localStorage.getItem('live2d-admin-user');
    if (saved) {
      var usernameInput = document.getElementById('login-username');
      var rememberCheck = document.getElementById('login-remember');
      if (usernameInput) usernameInput.value = saved;
      if (rememberCheck) rememberCheck.checked = true;
    }
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme') || 'dark';
    var next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('live2d-admin-theme', next);
  }

  function bindEvents() {
    var themeBtn = document.getElementById('login-theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', toggleTheme);
    }

    var loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        doLogin();
      });
    }

    var togglePw = document.getElementById('toggle-password');
    if (togglePw) {
      togglePw.addEventListener('click', function () {
        togglePasswordVisibility('login-password', 'toggle-password');
      });
    }
  }

  function showError(msg) {
    var el = document.getElementById('login-error');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    el.classList.add('shake');
    setTimeout(function () { el.classList.remove('shake'); }, 500);
  }

  function clearLoginError() {
    var el = document.getElementById('login-error');
    if (el) el.style.display = 'none';
  }

  function setButtonLoading(btnId, textId, spinnerId, loading) {
    var btn = document.getElementById(btnId);
    var text = document.getElementById(textId);
    var spinner = document.getElementById(spinnerId);
    if (btn) btn.disabled = loading;
    if (text) text.style.display = loading ? 'none' : '';
    if (spinner) spinner.style.display = loading ? '' : 'none';
  }

  function togglePasswordVisibility(inputId, btnId) {
    var input = document.getElementById(inputId);
    var btn = document.getElementById(btnId);
    if (!input || !btn) return;
    var isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    if (isPassword) {
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
    } else {
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    }
  }

  function doLogin() {
    var username = document.getElementById('login-username').value.trim();
    var password = document.getElementById('login-password').value;

    clearLoginError();

    if (!username) {
      showError('请输入用户名');
      return;
    }
    if (!password) {
      showError('请输入密码');
      return;
    }

    setButtonLoading('login-submit-btn', 'login-btn-text', 'login-spinner', true);

    Live2DAdminAPI.login(username, password)
      .then(function (res) {
        var remember = document.getElementById('login-remember');
        if (remember && remember.checked) {
          localStorage.setItem('live2d-admin-user', username);
        } else {
          localStorage.removeItem('live2d-admin-user');
        }
        window.location.href = 'index.html';
      })
      .catch(function (err) {
        showError(err.message);
        setButtonLoading('login-submit-btn', 'login-btn-text', 'login-spinner', false);
      });
  }

  return {
    init: init,
  };
})();

document.addEventListener('DOMContentLoaded', function () {
  Login.init();
});
