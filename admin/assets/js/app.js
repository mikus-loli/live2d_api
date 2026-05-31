var App = (function () {
  var models = [];
  var groups = [];
  var activeGroup = '';
  var searchQuery = '';
  var currentView = 'list';
  var currentDetailModel = null;
  var generatedCode2 = '';
  var generatedCode4 = '';
  var activeCodeTab = 'cubism2';
  var currentCodeModel = '';

  function init() {
    loadUserInfo();
    loadGroups();
    loadModels();
    bindEvents();
    Live2DPreview.init();
    initTheme();
    initRealtime();
  }

  function initTheme() {
    var saved = localStorage.getItem('live2d-admin-theme');
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
    }
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme') || 'dark';
    var next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('live2d-admin-theme', next);
  }

  function bindEvents() {
    var searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', debounce(function () {
        searchQuery = this.value.trim().toLowerCase();
        renderFilteredModels();
      }, 250));
    }

    var overlay = document.getElementById('modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', function () {
        UI.overlay(false);
      });
    }

    var uploadZone = document.getElementById('upload-drop-zone');
    if (uploadZone) {
      uploadZone.addEventListener('dragover', function (e) {
        e.preventDefault();
        this.classList.add('drag-over');
      });
      uploadZone.addEventListener('dragleave', function () {
        this.classList.remove('drag-over');
      });
      uploadZone.addEventListener('drop', function (e) {
        e.preventDefault();
        this.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
          handleFileSelect(e.dataTransfer.files[0]);
        }
      });
      uploadZone.addEventListener('click', function () {
        var input = document.getElementById('upload-file-input');
        if (input) input.click();
      });
    }

    var fileInput = document.getElementById('upload-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', function () {
        if (this.files.length > 0) {
          handleFileSelect(this.files[0]);
          this.value = '';
        }
      });
    }

    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        UI.overlay(false);
        Live2DPreview.closePanel();
      }
    });
  }

  function debounce(fn, delay) {
    var timer;
    return function () {
      var ctx = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, delay);
    };
  }

  function loadModels() {
    var container = document.getElementById('model-grid');
    if (!container) return;
    UI.showLoading(container);

    Live2DAdminAPI.getModels()
      .then(function (res) {
        models = res.data || [];
        updateStats();
        renderFilteredModels();
      })
      .catch(function (err) {
        UI.showEmpty(container, '加载模型失败: ' + err.message);
        UI.toast('加载模型失败', 'error');
      });
  }

  function loadGroups() {
    Live2DAdminAPI.getGroups()
      .then(function (res) {
        groups = res.data || [];
        renderGroups();
      })
      .catch(function () {
        groups = [];
      });
  }

  function updateStats() {
    var totalEl = document.getElementById('stat-total');
    var groupsEl = document.getElementById('stat-groups');
    var texturesEl = document.getElementById('stat-textures');

    if (totalEl) totalEl.textContent = models.length;
    if (groupsEl) groupsEl.textContent = groups.length;

    var totalTextures = 0;
    for (var i = 0; i < models.length; i++) {
      totalTextures += models[i].textures_count || 0;
      if (models[i].sub_models) {
        for (var j = 0; j < models[i].sub_models.length; j++) {
          totalTextures += models[i].sub_models[j].textures_count || 0;
        }
      }
    }
    if (texturesEl) texturesEl.textContent = totalTextures;
  }

  function renderGroups() {
    var container = document.getElementById('group-list');
    if (!container) return;

    var html = '<div class="sidebar-group-item' + (activeGroup === '' ? ' active' : '') + '" onclick="App.filterGroup(\'\')">' +
      '<span class="group-name">全部模型</span>' +
      '<span class="group-count">' + models.length + '</span></div>';

    for (var i = 0; i < groups.length; i++) {
      html += UI.renderGroupItem(groups[i], activeGroup);
    }
    container.innerHTML = html;
  }

  function renderFilteredModels() {
    var container = document.getElementById('model-grid');
    if (!container) return;

    var filtered = models.filter(function (m) {
      var matchGroup = !activeGroup || m.group === activeGroup;
      var matchSearch = !searchQuery ||
        m.name.toLowerCase().indexOf(searchQuery) !== -1 ||
        (m.message && m.message.toLowerCase().indexOf(searchQuery) !== -1) ||
        m.group.toLowerCase().indexOf(searchQuery) !== -1;
      return matchGroup && matchSearch;
    });

    if (filtered.length === 0) {
      UI.showEmpty(container, '未找到模型');
      return;
    }

    container.innerHTML = UI.renderModelGrid(filtered);
    animateCards(container);
  }

  function animateCards(container) {
    var cards = container.querySelectorAll('.model-card');
    for (var i = 0; i < cards.length; i++) {
      (function (card, idx) {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        setTimeout(function () {
          card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
          card.style.opacity = '1';
          card.style.transform = 'translateY(0)';
        }, idx * 50);
      })(cards[i], i);
    }
  }

  function filterGroup(group) {
    activeGroup = group;
    renderGroups();
    renderFilteredModels();
  }

  function previewModel(nameOrId) {
    if (typeof nameOrId !== 'string') {
      return;
    }

    var byName = findModelByName(nameOrId);
    if (byName) {
      if (byName.is_multi && byName.sub_models && byName.sub_models.length > 0) {
        Live2DPreview.loadModel(byName.sub_models[0].name);
      } else {
        Live2DPreview.loadModel(byName.name);
      }
      return;
    }

    var modelId = parseInt(nameOrId);
    if (isNaN(modelId)) {
      Live2DPreview.loadModel(nameOrId);
      return;
    }

    var model = null;
    for (var i = 0; i < models.length; i++) {
      if (models[i].id == modelId) {
        model = models[i];
        break;
      }
    }
    if (model && model.is_multi && model.sub_models && model.sub_models.length > 0) {
      Live2DPreview.loadModel(model.sub_models[0].name);
    } else if (model && !model.is_multi) {
      Live2DPreview.loadModel(model.name);
    } else {
      Live2DPreview.loadModelById(modelId + 1, 0);
    }
  }

  function findModelByName(name) {
    for (var i = 0; i < models.length; i++) {
      if (models[i].name === name) return models[i];
      if (models[i].sub_models) {
        for (var j = 0; j < models[i].sub_models.length; j++) {
          if (models[i].sub_models[j].name === name) return models[i].sub_models[j];
        }
      }
    }
    return null;
  }

  function viewDetail(modelName) {
    if (!modelName) return;
    currentDetailModel = modelName;
    currentView = 'detail';

    var container = document.getElementById('main-content');
    if (!container) return;

    container.innerHTML =
      '<div class="detail-view">' +
      '<div class="detail-header">' +
      '<button class="btn btn-outline" onclick="App.backToList()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg> 返回</button>' +
      '<h2 class="detail-title">' + UI.escapeHtml(modelName) + '</h2>' +
      '<div class="detail-actions">' +
      '<button class="btn btn-glow" onclick="App.previewModel(\'' + UI.escapeHtml(modelName) + '\')">预览</button>' +
      '<button class="btn btn-outline" onclick="App.editModel(\'' + UI.escapeHtml(modelName) + '\')">编辑</button>' +
      '<button class="btn btn-danger-outline" onclick="App.confirmDelete(\'' + UI.escapeHtml(modelName) + '\')">删除</button>' +
      '</div></div>' +
      '<div class="detail-body"><div class="loading-spinner"><div class="spinner"></div><p>加载中...</p></div></div>' +
      '</div>';

    Live2DAdminAPI.getModelDetail(modelName)
      .then(function (res) {
        var data = res.data;
        var body = container.querySelector('.detail-body');
        if (!body) return;

        body.innerHTML =
          '<div class="detail-grid">' +
          '<div class="detail-section"><h3>配置信息</h3>' + UI.renderDetailConfig(data.config) + '</div>' +
          '<div class="detail-section"><h3>纹理</h3>' + UI.renderDetailTextures(data.textures) + '</div>' +
          '<div class="detail-section"><h3>动作</h3>' + UI.renderDetailMotions(data.motions) + '</div>' +
          '<div class="detail-section"><h3>文件 (' + (data.files ? data.files.length : 0) + ')</h3>' + UI.renderDetailFiles(data.files) + '</div>' +
          '</div>';
      })
      .catch(function (err) {
        var body = container.querySelector('.detail-body');
        if (body) body.innerHTML = '<p class="error-text">错误: ' + UI.escapeHtml(err.message) + '</p>';
      });
  }

  function backToList() {
    currentView = 'list';
    currentDetailModel = null;
    var container = document.getElementById('main-content');
    if (!container) return;

    container.innerHTML =
      '<div class="content-header">' +
      '<h2 class="content-title">模型列表</h2>' +
      '<div class="content-actions">' +
      '<div class="search-box"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg><input type="text" id="search-input" placeholder="搜索模型..."></div>' +
      '<button class="btn btn-glow" onclick="App.showUploadModal()">上传模型</button>' +
      '<button class="btn btn-outline" onclick="App.showCreateModal()">添加模型</button>' +
      '</div></div>' +
      '<div id="model-grid" class="model-grid"></div>';

    bindEvents();
    renderFilteredModels();
  }

  function showCreateModal() {
    var nameInput = document.getElementById('create-name');
    var msgInput = document.getElementById('create-message');
    if (nameInput) nameInput.value = '';
    if (msgInput) msgInput.value = '';
    UI.openModal('modal-create');
  }

  function showUploadModal() {
    var nameInput = document.getElementById('upload-model-name');
    var fileLabel = document.getElementById('upload-file-label');
    var progressBar = document.getElementById('upload-progress');
    var progressFill = document.getElementById('upload-progress-fill');
    if (nameInput) nameInput.value = '';
    if (fileLabel) fileLabel.textContent = '点击或拖拽文件到此处';
    if (progressBar) progressBar.style.display = 'none';
    if (progressFill) progressFill.style.width = '0%';
    UI.openModal('modal-upload');
  }

  function editModel(name, message) {
    var nameInput = document.getElementById('edit-old-name');
    var newNameInput = document.getElementById('edit-new-name');
    var msgInput = document.getElementById('edit-message');
    if (nameInput) nameInput.value = name;
    if (newNameInput) newNameInput.value = name;
    if (msgInput) msgInput.value = message || '';
    UI.openModal('modal-edit');
  }

  function confirmDelete(name) {
    var nameEl = document.getElementById('delete-name');
    var confirmCheck = document.getElementById('delete-confirm-files');
    if (nameEl) nameEl.textContent = name;
    if (confirmCheck) confirmCheck.checked = false;
    UI.openModal('modal-delete');
  }

  var pendingUploadFile = null;

  function handleFileSelect(file) {
    pendingUploadFile = file;
    var fileLabel = document.getElementById('upload-file-label');
    if (fileLabel) fileLabel.textContent = file.name + ' (' + UI.formatSize(file.size) + ')';
  }

  function doCreate() {
    var name = document.getElementById('create-name').value.trim();
    var message = document.getElementById('create-message').value.trim();

    if (!name) {
      UI.toast('请输入模型名称', 'error');
      return;
    }

    Live2DAdminAPI.createModel(name, message)
      .then(function () {
        UI.toast('模型添加成功', 'success');
        UI.closeModal('modal-create');
        loadModels();
        loadGroups();
      })
      .catch(function (err) {
        UI.toast(err.message, 'error');
      });
  }

  function doEdit() {
    var oldName = document.getElementById('edit-old-name').value.trim();
    var newName = document.getElementById('edit-new-name').value.trim();
    var message = document.getElementById('edit-message').value.trim();

    if (!oldName) return;

    Live2DAdminAPI.updateModel(oldName, newName, message)
      .then(function () {
        UI.toast('模型更新成功', 'success');
        UI.closeModal('modal-edit');
        loadModels();
        loadGroups();
        if (currentView === 'detail' && currentDetailModel === oldName) {
          viewDetail(newName || oldName);
        }
      })
      .catch(function (err) {
        UI.toast(err.message, 'error');
      });
  }

  function doDelete() {
    var name = document.getElementById('delete-name').textContent;
    var confirmFiles = document.getElementById('delete-confirm-files').checked;

    Live2DAdminAPI.deleteModel(name, confirmFiles)
      .then(function () {
        UI.toast('模型删除成功', 'success');
        UI.closeModal('modal-delete');
        loadModels();
        loadGroups();
        if (currentView === 'detail') {
          backToList();
        }
      })
      .catch(function (err) {
        UI.toast(err.message, 'error');
      });
  }

  function scanUnregistered() {
    var resultDiv = document.getElementById('scan-result');
    if (!resultDiv) return;
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<div class="loading-spinner" style="padding:16px"><div class="spinner"></div><p>扫描中...</p></div>';

    Live2DAdminAPI.request('GET', 'scan-dirs.php')
      .then(function (res) {
        var dirs = res.data || [];
        var existingNames = {};
        for (var i = 0; i < models.length; i++) {
          existingNames[models[i].name] = true;
        }
        var unregistered = dirs.filter(function (d) {
          return !existingNames[d.name];
        });

        if (unregistered.length === 0) {
          resultDiv.innerHTML = '<div class="scan-dir-item" style="cursor:default;justify-content:center;color:var(--text-muted)">所有目录已注册</div>';
          return;
        }

        var html = '';
        for (var j = 0; j < unregistered.length; j++) {
          var d = unregistered[j];
          var badge = d.has_model3 ? '<span class="scan-dir-badge moc3">MOC3</span>' : (d.has_moc ? '<span class="scan-dir-badge moc2">MOC</span>' : '');
          html += '<div class="scan-dir-item" onclick="App.selectScannedDir(\'' + UI.escapeHtml(d.name) + '\')">' +
            '<span>' + UI.escapeHtml(d.name) + '</span>' + badge + '</div>';
        }
        resultDiv.innerHTML = html;
      })
      .catch(function () {
        resultDiv.innerHTML = '<div class="scan-dir-item" style="cursor:default;justify-content:center;color:var(--accent-red)">扫描失败</div>';
      });
  }

  function selectScannedDir(name) {
    var nameInput = document.getElementById('create-name');
    if (nameInput) nameInput.value = name;
    var resultDiv = document.getElementById('scan-result');
    if (resultDiv) resultDiv.style.display = 'none';
  }

  function doUpload() {
    var modelName = document.getElementById('upload-model-name').value.trim();

    if (!modelName || modelName.indexOf('/') === -1) {
      UI.toast('模型名称必须使用 分组/模型名 格式', 'error');
      return;
    }

    if (!pendingUploadFile) {
      UI.toast('请选择文件', 'error');
      return;
    }

    var progressBar = document.getElementById('upload-progress');
    var progressFill = document.getElementById('upload-progress-fill');
    var submitBtn = document.getElementById('upload-submit-btn');

    if (progressBar) progressBar.style.display = 'block';
    if (submitBtn) submitBtn.disabled = true;

    Live2DAdminAPI.uploadFile(pendingUploadFile, modelName, function (percent) {
      if (progressFill) progressFill.style.width = percent + '%';
    })
      .then(function (res) {
        UI.toast('上传成功！已上传 ' + (res.data.uploaded_files ? res.data.uploaded_files.length : 0) + ' 个文件', 'success');
        UI.closeModal('modal-upload');
        if (submitBtn) submitBtn.disabled = false;
        pendingUploadFile = null;
        loadModels();
        loadGroups();
      })
      .catch(function (err) {
        UI.toast('上传失败: ' + err.message, 'error');
        if (submitBtn) submitBtn.disabled = false;
      });
  }

  function generateCode(modelName) {
    currentCodeModel = modelName;
    document.getElementById('generate-model-name').textContent = '模型: ' + modelName;

    var apiBase = window.location.origin;
    var modelLast = modelName.split('/').pop();

    Live2DAdminAPI.request('GET', '../../get/?name=' + encodeURIComponent(modelName))
      .then(function (res) {
        var isCubism4 = res.model && res.model.indexOf('.moc3') !== -1;

        generatedCode2 = getCodeTemplate2(modelName, apiBase);
        generatedCode4 = getCodeTemplate4(modelName, modelLast, apiBase);

        if (isCubism4) {
          activeCodeTab = 'cubism4';
        } else {
          activeCodeTab = 'cubism2';
        }

        switchCodeTab(activeCodeTab);
        UI.openModal('modal-generate');
      })
      .catch(function () {
        generatedCode2 = getCodeTemplate2(modelName, apiBase);
        generatedCode4 = getCodeTemplate4(modelName, modelLast, apiBase);
        activeCodeTab = 'cubism2';
        switchCodeTab(activeCodeTab);
        UI.openModal('modal-generate');
      });
  }

  function switchCodeTab(tab) {
    activeCodeTab = tab;
    var content = document.getElementById('generate-code-content');
    if (!content) return;

    content.textContent = tab === 'cubism4' ? generatedCode4 : generatedCode2;

    var tabBtns = document.querySelectorAll('.code-tab');
    for (var i = 0; i < tabBtns.length; i++) {
      tabBtns[i].classList.toggle('active', tabBtns[i].getAttribute('data-tab') === tab);
    }
  }

  function copyCode() {
    var content = document.getElementById('generate-code-content');
    if (!content) return;

    var text = content.textContent;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        UI.toast('代码已复制到剪贴板', 'success');
      }).catch(function () {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); UI.toast('代码已复制到剪贴板', 'success'); } catch (e) { UI.toast('复制失败，请手动复制', 'error'); }
    document.body.removeChild(ta);
  }

  function getCodeTemplate2(modelName, apiBase) {
    return '<!-- Live2D \u770b\u677f\u5a18 - ' + modelName + ' -->\n' +
      '<!-- \u4f9d\u8d56\uff1alive2d.min.js (Cubism 2 Runtime) -->\n' +
      '<!-- CDN: https://cdn.jsdelivr.net/gh/dylanNew/live2d/webgl/Live2D/lib/live2d.min.js -->\n' +
      '\n' +
      '<canvas id="live2d" width="300" height="400"></canvas>\n' +
      '\n' +
      '<script src="' + apiBase + '/live2d.min.js"><\/script>\n' +
      '<script>\n' +
      'loadlive2d(\'live2d\', \'' + apiBase + '/get/?name=' + encodeURIComponent(modelName) + '\');\n' +
      '<\/script>';
  }

  function getCodeTemplate4(modelName, modelLast, apiBase) {
    return '<!-- Live2D \u770b\u677f\u5a18 - ' + modelName + ' (Cubism 4) -->\n' +
      '<!-- \u4f9d\u8d56\uff1aPixiJS v7 + Cubism 4 Runtime -->\n' +
      '\n' +
      '<canvas id="live2d" width="300" height="400"></canvas>\n' +
      '\n' +
      '<script src="https://cdn.jsdelivr.net/npm/pixi.js@7/dist/pixi.min.js"><\/script>\n' +
      '<script src="https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js"><\/script>\n' +
      '<script src="https://cdn.jsdelivr.net/npm/pixi-live2d-display/dist/cubism4.min.js"><\/script>\n' +
      '<script>\n' +
      '(function() {\n' +
      '  var canvas = document.getElementById(\'live2d\');\n' +
      '  var app = new PIXI.Application({\n' +
      '    view: canvas,\n' +
      '    width: 300,\n' +
      '    height: 400,\n' +
      '    backgroundAlpha: 0,\n' +
      '    autoDensity: true,\n' +
      '    resolution: window.devicePixelRatio || 1\n' +
      '  });\n' +
      '\n' +
      '  var modelUrl = \'' + apiBase + '/model/' + encodeURIComponent(modelName) + '/' + encodeURIComponent(modelLast) + '.model3.json\';\n' +
      '\n' +
      '  PIXI.live2d.Live2DModel.from(modelUrl).then(function(model) {\n' +
      '    var scale = Math.min(300 / model.width * 0.85, 400 / model.height * 0.85);\n' +
      '    model.scale.set(scale);\n' +
      '    model.x = 150;\n' +
      '    model.y = 200;\n' +
      '    app.stage.addChild(model);\n' +
      '\n' +
      '    canvas.addEventListener(\'pointermove\', function(e) {\n' +
      '      var rect = canvas.getBoundingClientRect();\n' +
      '      model.focus(e.clientX - rect.left, e.clientY - rect.top);\n' +
      '    });\n' +
      '    canvas.addEventListener(\'pointerleave\', function() {\n' +
      '      model.focus(0, 0);\n' +
      '    });\n' +
      '  });\n' +
      '})();\n' +
      '<\/script>';
  }

  function loadUserInfo() {
    var avatarEl = document.getElementById('sidebar-user-avatar');
    var nameEl = document.getElementById('sidebar-user-name');
    var roleEl = document.getElementById('sidebar-user-role');

    Live2DAdminAPI.getStatus()
      .then(function (res) {
        var data = res.data || {};
        var username = data.username || '用户';
        var role = data.role || 'user';
        if (avatarEl) avatarEl.textContent = username.charAt(0).toUpperCase();
        if (nameEl) nameEl.textContent = username;
        if (roleEl) roleEl.textContent = role;
      })
      .catch(function () {
        if (avatarEl) avatarEl.textContent = '?';
        if (nameEl) nameEl.textContent = '加载失败';
        if (roleEl) roleEl.textContent = '';
      });
  }

  function doLogout() {
    Live2DAdminAPI.logout()
      .then(function () {
        window.location.href = 'login.html';
      })
      .catch(function () {
        window.location.href = 'login.html';
      });
  }

  var sseRetryTimer = null;

  function initRealtime() {
    var es = new EventSource('api/events');
    es.onmessage = function (e) {
      try {
        var data = JSON.parse(e.data);
        if (data.type === 'models_updated') {
          loadModels();
          loadGroups();
        }
      } catch (err) {}
    };
    es.onerror = function () {
      es.close();
      if (!sseRetryTimer) {
        sseRetryTimer = setInterval(function () {
          loadModels();
          loadGroups();
        }, 30000);
      }
    };
  }

  function doRefresh() {
    UI.toast('刷新中...', 'info');
    loadModels();
    loadGroups();
  }

  function openSettings() {
    document.getElementById('settings-current-password').value = '';
    document.getElementById('settings-new-password').value = '';
    document.getElementById('settings-new-password-confirm').value = '';
    document.getElementById('settings-email').value = '';
    document.getElementById('settings-error').style.display = 'none';
    document.getElementById('settings-success').style.display = 'none';
    document.getElementById('settings-pw-error').style.display = 'none';
    document.getElementById('settings-pw-success').style.display = 'none';

    Live2DAdminAPI.getStatus()
      .then(function (res) {
        var emailEl = document.getElementById('settings-email');
        if (emailEl && res.data && res.data.email) {
          emailEl.value = res.data.email;
        }
      })
      .catch(function () {});

    UI.openModal('modal-settings');
  }

  function doUpdateProfile() {
    var currentPassword = document.getElementById('settings-current-password').value;
    var email = document.getElementById('settings-email').value.trim();
    var errEl = document.getElementById('settings-error');
    var okEl = document.getElementById('settings-success');

    if (errEl) errEl.style.display = 'none';
    if (okEl) okEl.style.display = 'none';

    if (!currentPassword) {
      if (errEl) { errEl.textContent = '请输入当前密码'; errEl.style.display = 'block'; }
      return;
    }
    if (!email) {
      if (errEl) { errEl.textContent = '请输入邮箱'; errEl.style.display = 'block'; }
      return;
    }

    Live2DAdminAPI.updateProfile(currentPassword, email)
      .then(function () {
        if (okEl) { okEl.textContent = '邮箱已更新'; okEl.style.display = 'block'; }
        loadUserInfo();
      })
      .catch(function (err) {
        if (errEl) { errEl.textContent = err.message; errEl.style.display = 'block'; }
      });
  }

  function doChangePassword() {
    var currentPassword = document.getElementById('settings-pw-current').value;
    var newPassword = document.getElementById('settings-new-password').value;
    var confirmPassword = document.getElementById('settings-new-password-confirm').value;
    var errEl = document.getElementById('settings-pw-error');
    var okEl = document.getElementById('settings-pw-success');

    if (errEl) errEl.style.display = 'none';
    if (okEl) okEl.style.display = 'none';

    if (!currentPassword) {
      if (errEl) { errEl.textContent = '请输入当前密码'; errEl.style.display = 'block'; }
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      if (errEl) { errEl.textContent = '新密码长度至少为 8 个字符'; errEl.style.display = 'block'; }
      return;
    }
    if (!/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      if (errEl) { errEl.textContent = '密码必须包含字母和数字'; errEl.style.display = 'block'; }
      return;
    }
    if (newPassword !== confirmPassword) {
      if (errEl) { errEl.textContent = '两次输入的密码不一致'; errEl.style.display = 'block'; }
      return;
    }

    Live2DAdminAPI.changePassword(currentPassword, newPassword)
      .then(function () {
        if (okEl) { okEl.textContent = '密码修改成功，请重新登录'; okEl.style.display = 'block'; }
        setTimeout(function () {
          window.location.href = 'login.html';
        }, 1500);
      })
      .catch(function (err) {
        if (errEl) { errEl.textContent = err.message; errEl.style.display = 'block'; }
      });
  }

  return {
    init: init,
    toggleTheme: toggleTheme,
    filterGroup: filterGroup,
    previewModel: previewModel,
    viewDetail: viewDetail,
    backToList: backToList,
    showCreateModal: showCreateModal,
    showUploadModal: showUploadModal,
    editModel: editModel,
    confirmDelete: confirmDelete,
    doCreate: doCreate,
    doEdit: doEdit,
    doDelete: doDelete,
    doUpload: doUpload,
    scanUnregistered: scanUnregistered,
    selectScannedDir: selectScannedDir,
    generateCode: generateCode,
    switchCodeTab: switchCodeTab,
    copyCode: copyCode,
    doLogout: doLogout,
    doRefresh: doRefresh,
    openSettings: openSettings,
    doUpdateProfile: doUpdateProfile,
    doChangePassword: doChangePassword,
  };
})();

document.addEventListener('DOMContentLoaded', function () {
  App.init();
});
