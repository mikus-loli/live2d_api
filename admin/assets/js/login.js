var Login = (function () {
  var currentView = 'login';
  var resetToken = '';

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

    var forgotLink = document.getElementById('forgot-pw-link');
    if (forgotLink) {
      forgotLink.addEventListener('click', function () {
        switchView('forgot');
      });
    }

    var backLink = document.getElementById('back-to-login-link');
    if (backLink) {
      backLink.addEventListener('click', function () {
        switchView('login');
      });
    }

    var forgotForm = document.getElementById('forgot-form');
    if (forgotForm) {
      forgotForm.addEventListener('submit', function (e) {
        e.preventDefault();
        doForgotPassword();
      });
    }

    var resetForm = document.getElementById('reset-form');
    if (resetForm) {
      resetForm.addEventListener('submit', function (e) {
        e.preventDefault();
        doResetPassword();
      });
    }

    var toggleResetPw = document.getElementById('toggle-reset-pw');
    if (toggleResetPw) {
      toggleResetPw.addEventListener('click', function () {
        togglePasswordVisibility('reset-password', 'toggle-reset-pw');
      });
    }

    window.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        if (currentView === 'login') {
          doLogin();
        } else if (currentView === 'forgot') {
          var step2 = document.getElementById('forgot-step-2');
          if (step2 && step2.style.display !== 'none') {
            doResetPassword();
          } else {
            doForgotPassword();
          }
        }
      }
    });
  }

  function switchView(view) {
    currentView = view;
    var loginView = document.getElementById('login-view');
    var forgotView = document.getElementById('forgot-view');
    var forgotError = document.getElementById('forgot-error');
    var forgotSuccess = document.getElementById('forgot-success');
    var forgotStep1 = document.getElementById('forgot-step-1');
    var forgotStep2 = document.getElementById('forgot-step-2');

    if (view === 'login') {
      if (loginView) loginView.style.display = '';
      if (forgotView) forgotView.style.display = 'none';
      if (forgotError) forgotError.style.display = 'none';
      if (forgotSuccess) forgotSuccess.style.display = 'none';
      if (forgotStep1) forgotStep1.style.display = '';
      if (forgotStep2) forgotStep2.style.display = 'none';
      resetToken = '';
      clearLoginForm();
      clearLoginError();
    } else {
      if (loginView) loginView.style.display = 'none';
      if (forgotView) forgotView.style.display = '';
      clearLoginError();
    }
  }

  function showError(msg) {
    var el;
    if (currentView === 'login') {
      el = document.getElementById('login-error');
    } else {
      el = document.getElementById('forgot-error');
    }
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    el.classList.add('shake');
    setTimeout(function () { el.classList.remove('shake'); }, 500);
  }

  function showSuccess(msg) {
    var el = document.getElementById('forgot-success');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
  }

  function clearLoginError() {
    var loginErr = document.getElementById('login-error');
    var forgotErr = document.getElementById('forgot-error');
    var forgotOk = document.getElementById('forgot-success');
    if (loginErr) loginErr.style.display = 'none';
    if (forgotErr) forgotErr.style.display = 'none';
    if (forgotOk) forgotOk.style.display = 'none';
  }

  function clearLoginForm() {
    var username = document.getElementById('login-username');
    var password = document.getElementById('login-password');
    if (username) username.value = '';
    if (password) password.value = '';
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
      showError('请输入用户名或邮箱');
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

  function doForgotPassword() {
    var username = document.getElementById('forgot-username').value.trim();

    var forgotErr = document.getElementById('forgot-error');
    var forgotOk = document.getElementById('forgot-success');
    if (forgotErr) forgotErr.style.display = 'none';
    if (forgotOk) forgotOk.style.display = 'none';

    if (!username) {
      showError('请输入用户名或邮箱');
      return;
    }

    setButtonLoading('forgot-submit-btn', 'forgot-btn-text', 'forgot-spinner', true);

    Live2DAdminAPI.forgotPassword(username)
      .then(function (res) {
        setButtonLoading('forgot-submit-btn', 'forgot-btn-text', 'forgot-spinner', false);
        if (res.data && res.data.reset_token) {
          resetToken = res.data.reset_token;
          var tokenInput = document.getElementById('reset-token');
          if (tokenInput) tokenInput.value = resetToken;

          var step1 = document.getElementById('forgot-step-1');
          var step2 = document.getElementById('forgot-step-2');
          if (step1) step1.style.display = 'none';
          if (step2) step2.style.display = '';
        }
        showSuccess(res.message || '如果账户存在，重置令牌已生成');
      })
      .catch(function (err) {
        setButtonLoading('forgot-submit-btn', 'forgot-btn-text', 'forgot-spinner', false);
        showError(err.message);
      });
  }

  function doResetPassword() {
    var token = document.getElementById('reset-token').value.trim();
    var password = document.getElementById('reset-password').value;
    var passwordConfirm = document.getElementById('reset-password-confirm').value;

    var forgotErr = document.getElementById('forgot-error');
    var forgotOk = document.getElementById('forgot-success');
    if (forgotErr) forgotErr.style.display = 'none';
    if (forgotOk) forgotOk.style.display = 'none';

    if (!token) {
      showError('缺少重置令牌');
      return;
    }
    if (!password) {
      showError('请输入新密码');
      return;
    }
    if (password.length < 8) {
      showError('密码长度至少为 8 个字符');
      return;
    }
    if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      showError('密码必须包含字母和数字');
      return;
    }
    if (password !== passwordConfirm) {
      showError('两次输入的密码不一致');
      return;
    }

    setButtonLoading('reset-submit-btn', 'reset-btn-text', 'reset-spinner', true);

    Live2DAdminAPI.resetPassword(token, password)
      .then(function (res) {
        setButtonLoading('reset-submit-btn', 'reset-btn-text', 'reset-spinner', false);
        showSuccess(res.message || '密码重置成功，请使用新密码登录');
        resetToken = '';
        setTimeout(function () {
          switchView('login');
        }, 2000);
      })
      .catch(function (err) {
        setButtonLoading('reset-submit-btn', 'reset-btn-text', 'reset-spinner', false);
        showError(err.message);
      });
  }

  return {
    init: init,
  };
})();

document.addEventListener('DOMContentLoaded', function () {
  Login.init();
});
