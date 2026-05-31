var App = (function () {
  var models = [];
  var groups = [];
  var activeGroup = '';
  var searchQuery = '';
  var currentView = 'list';
  var currentDetailModel = null;
  var currentCodeModel = '';

  function init() {
    loadUserInfo();
    loadGroups();
    loadModels();
    bindEvents();
    Live2DPreview.init();
    initTheme();
    initRealtime();
    initGenModalObserver();
  }

  function initGenModalObserver() {
    var modal = document.getElementById('modal-generate');
    if (!modal) return;
    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        if (mutations[i].attributeName === 'class') {
          if (!modal.classList.contains('active')) {
            destroyGenPixi();
          }
        }
      }
    });
    observer.observe(modal, { attributes: true });
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
        Live2DPreview.loadModel(byName.sub_models[0].name, byName.sub_models[0].is_cubism4);
      } else {
        Live2DPreview.loadModel(byName.name, byName.is_cubism4);
      }
      return;
    }

    var modelId = parseInt(nameOrId);
    if (isNaN(modelId)) {
      Live2DPreview.loadModel(nameOrId, false);
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
      Live2DPreview.loadModel(model.sub_models[0].name, model.sub_models[0].is_cubism4);
    } else if (model && !model.is_multi) {
      Live2DPreview.loadModel(model.name, model.is_cubism4);
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

  var genState = {
    modelName: '',
    modelLast: '',
    apiBase: '',
    isCubism4: false,
    position: 'right',
    offsetX: 0,
    offsetY: 0,
    width: 300,
    height: 400,
  };
  var genPixiApp = null;
  var genCubism2Loaded = false;

  function generateCode(modelName) {
    currentCodeModel = modelName;
    document.getElementById('generate-model-name').textContent = '模型: ' + modelName;

    genState.modelName = modelName;
    genState.modelLast = modelName.split('/').pop();
    genState.apiBase = window.location.origin;
    genState.position = 'right';
    genState.offsetX = 0;
    genState.offsetY = 0;
    genState.width = 300;
    genState.height = 400;

    genState.isCubism4 = false;
    for (var i = 0; i < models.length; i++) {
      var m = models[i];
      if (m.name === modelName) {
        if (m.is_cubism4) { genState.isCubism4 = true; break; }
        if (m.is_multi && m.sub_models) {
          for (var j = 0; j < m.sub_models.length; j++) {
            if (m.sub_models[j].is_cubism4) { genState.isCubism4 = true; break; }
          }
          if (genState.isCubism4) break;
        }
      }
    }

    var offsetXEl = document.getElementById('gen-offset-x');
    var offsetYEl = document.getElementById('gen-offset-y');
    var widthEl = document.getElementById('gen-width');
    var heightEl = document.getElementById('gen-height');
    if (offsetXEl) offsetXEl.value = 0;
    if (offsetYEl) offsetYEl.value = 0;
    if (widthEl) widthEl.value = 300;
    if (heightEl) heightEl.value = 400;

    var posBtns = document.querySelectorAll('.gen-btn[data-pos]');
    for (var i = 0; i < posBtns.length; i++) {
      posBtns[i].classList.toggle('active', posBtns[i].getAttribute('data-pos') === 'right');
    }

    showGeneratedCode();
  }

  function showGeneratedCode() {
    loadGenPreview();
    updateGenCode();
    UI.openModal('modal-generate');
  }

  function setGenPos(pos) {
    genState.position = pos;
    var posBtns = document.querySelectorAll('.gen-btn[data-pos]');
    for (var i = 0; i < posBtns.length; i++) {
      posBtns[i].classList.toggle('active', posBtns[i].getAttribute('data-pos') === pos);
    }
    updateMockModelPosition();
    updateGenCode();
  }

  function updateGenCode() {
    var offsetXEl = document.getElementById('gen-offset-x');
    var offsetYEl = document.getElementById('gen-offset-y');
    var widthEl = document.getElementById('gen-width');
    var heightEl = document.getElementById('gen-height');
    if (offsetXEl) genState.offsetX = parseInt(offsetXEl.value, 10) || 0;
    if (offsetYEl) genState.offsetY = parseInt(offsetYEl.value, 10) || 0;
    if (widthEl) genState.width = Math.max(100, parseInt(widthEl.value, 10) || 300);
    if (heightEl) genState.height = Math.max(100, parseInt(heightEl.value, 10) || 400);

    updateMockModelPosition();

    var content = document.getElementById('generate-code-content');
    var langEl = document.getElementById('generate-code-lang');
    if (!content) return;

    if (genState.isCubism4) {
      content.textContent = getCodeTemplate4(genState.modelName, genState.modelLast, genState.apiBase, genState);
      if (langEl) langEl.textContent = 'Cubism 4 · HTML + JavaScript';
    } else {
      content.textContent = getCodeTemplate2(genState.modelName, genState.apiBase, genState);
      if (langEl) langEl.textContent = 'Cubism 2 · HTML + JavaScript';
    }
  }

  var MOCK_PAGE_W = 400;
  var MOCK_PAGE_H = 250;
  var MOCK_SCALE = MOCK_PAGE_W / 1920;

  function loadGenPreview() {
    releaseMainPreview();

    var wrap = document.getElementById('gen-preview-wrap');
    if (!wrap) return;
    while (wrap.firstChild) wrap.removeChild(wrap.firstChild);

    var cw = Math.round(genState.width * MOCK_SCALE);
    var ch = Math.round(genState.height * MOCK_SCALE);

    var canvas = document.createElement('canvas');
    canvas.id = 'gen-preview-canvas';
    canvas.width = cw;
    canvas.height = ch;
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    wrap.appendChild(canvas);

    updateMockModelPosition();

    if (genState.isCubism4) {
      loadGenPreview4(canvas, cw, ch);
    } else {
      loadGenPreview2(canvas);
    }
  }

  function updateMockModelPosition() {
    var model = document.getElementById('gen-mock-model');
    if (!model) return;

    var cw = Math.round(genState.width * MOCK_SCALE);
    var ch = Math.round(genState.height * MOCK_SCALE);
    var ox = Math.round(genState.offsetX * MOCK_SCALE);
    var oy = Math.round(genState.offsetY * MOCK_SCALE);

    model.style.width = cw + 'px';
    model.style.height = ch + 'px';

    if (genState.position === 'left') {
      model.style.left = ox + 'px';
      model.style.right = 'auto';
    } else {
      model.style.right = ox + 'px';
      model.style.left = 'auto';
    }
    model.style.bottom = oy + 'px';

    var canvas = document.getElementById('gen-preview-canvas');
    if (canvas) {
      canvas.width = cw;
      canvas.height = ch;
      canvas.style.width = cw + 'px';
      canvas.style.height = ch + 'px';
    }
  }

  function releaseMainPreview() {
    if (typeof Live2DPreview !== 'undefined' && Live2DPreview.closePanel) {
      Live2DPreview.closePanel();
    }
    var mainWrap = document.getElementById('preview-canvas-wrap');
    if (mainWrap) {
      while (mainWrap.firstChild) mainWrap.removeChild(mainWrap.firstChild);
    }
    var freshCanvas = document.createElement('canvas');
    freshCanvas.id = 'live2d-canvas';
    freshCanvas.width = 320;
    freshCanvas.height = 400;
    if (mainWrap) mainWrap.appendChild(freshCanvas);
    if (typeof Live2DPreview !== 'undefined' && Live2DPreview.init) {
      Live2DPreview.init();
    }
  }

  function loadGenPreview2(canvas) {
    canvas.style.display = '';
    if (typeof loadlive2d === 'function') {
      loadlive2d('gen-preview-canvas', genState.apiBase + '/model/' + encodePath(genState.modelName) + '/index.json');
    }
  }

  function loadGenPreview4(canvas, cw, ch) {
    if (typeof PIXI === 'undefined' || !PIXI.live2d) return;

    canvas.style.display = 'none';
    var wrap = document.getElementById('gen-preview-wrap');
    if (!wrap) return;

    var cv = document.createElement('canvas');
    cv.style.width = cw + 'px';
    cv.style.height = ch + 'px';
    wrap.appendChild(cv);

    try {
      genPixiApp = new PIXI.Application({
        view: cv,
        width: cw,
        height: ch,
        backgroundAlpha: 0,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      });
    } catch (e) { return; }

    var modelUrl = genState.apiBase + '/model/' + encodePath(genState.modelName) + '/' + encodeURIComponent(genState.modelLast) + '.model3.json';
    PIXI.live2d.Live2DModel.from(modelUrl).then(function (m) {
      var sc = Math.min(cw / m.width * 0.85, ch / m.height * 0.85);
      m.scale.set(sc);
      m.x = cw / 2;
      m.y = ch / 2;
      genPixiApp.stage.addChild(m);
    }).catch(function () {});
  }

  function destroyGenPixi() {
    if (genPixiApp) {
      genPixiApp.destroy(true);
      genPixiApp = null;
    }
    var wrap = document.getElementById('gen-preview-wrap');
    if (wrap) {
      while (wrap.firstChild) wrap.removeChild(wrap.firstChild);
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

  function encodePath(name) {
    return name.split('/').map(encodeURIComponent).join('/');
  }

  function buildEmbedCSS(s) {
    var pos = s.position === 'left' ? 'left' : 'right';
    var css = '#live2d{position:fixed;' + pos + ':' + s.offsetX + 'px;bottom:' + s.offsetY + 'px;z-index:99999;pointer-events:none}';
    return '<style>' + css + '</style>\n';
  }

  function getCodeTemplate2(modelName, apiBase, s) {
    return buildEmbedCSS(s) +
      '<canvas id="live2d" width="' + s.width + '" height="' + s.height + '"></canvas>\n' +
      '<script>\n' +
      '(function(){var s=document.createElement("script");s.src="' + apiBase + '/live2d.min.js";s.onload=function(){loadlive2d("live2d","' + apiBase + '/model/' + encodePath(modelName) + '/index.json")};document.head.appendChild(s)})();\n' +
      '<\/script>';
  }

  function getCodeTemplate4(modelName, modelLast, apiBase, s) {
    var w = s.width;
    var h = s.height;
    return buildEmbedCSS(s) +
      '<canvas id="live2d" width="' + w + '" height="' + h + '"></canvas>\n' +
      '<script>\n' +
      '(function(){\n' +
      'var b="' + apiBase + '";\n' +
      'function ls(u,c){var s=document.createElement("script");s.src=u;s.onload=c;document.head.appendChild(s)}\n' +
      'ls(b+"/live2dcubismcore.min.js",function(){\n' +
      '  ls(b+"/pixi.min.js",function(){\n' +
      '    ls(b+"/cubism4.min.js",function(){\n' +
      '      var cv=document.getElementById("live2d");\n' +
      '      var app=new PIXI.Application({view:cv,width:' + w + ',height:' + h + ',backgroundAlpha:0,autoDensity:true,resolution:window.devicePixelRatio||1});\n' +
      '      PIXI.live2d.Live2DModel.from(b+"/model/' + encodePath(modelName) + '/' + encodeURIComponent(modelLast) + '.model3.json").then(function(m){\n' +
      '        var sc=Math.min(' + w + '/m.width*0.85,' + h + '/m.height*0.85);m.scale.set(sc);m.x=' + Math.round(w / 2) + ';m.y=' + Math.round(h / 2) + ';app.stage.addChild(m);\n' +
      '        cv.addEventListener("pointermove",function(e){var r=cv.getBoundingClientRect();m.focus(e.clientX-r.left,e.clientY-r.top)});\n' +
      '        cv.addEventListener("pointerleave",function(){m.focus(0,0)});\n' +
      '      });\n' +
      '    });\n' +
      '  });\n' +
      '});\n' +
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
    document.getElementById('settings-new-username').value = '';
    document.getElementById('settings-error').style.display = 'none';
    document.getElementById('settings-success').style.display = 'none';
    document.getElementById('settings-pw-error').style.display = 'none';
    document.getElementById('settings-pw-success').style.display = 'none';

    Live2DAdminAPI.getStatus()
      .then(function (res) {
        var usernameEl = document.getElementById('settings-new-username');
        if (usernameEl && res.data && res.data.username) {
          usernameEl.value = res.data.username;
        }
      })
      .catch(function () {});

    UI.openModal('modal-settings');
  }

  function doUpdateProfile() {
    var currentPassword = document.getElementById('settings-current-password').value;
    var newUsername = document.getElementById('settings-new-username').value.trim();
    var errEl = document.getElementById('settings-error');
    var okEl = document.getElementById('settings-success');

    if (errEl) errEl.style.display = 'none';
    if (okEl) okEl.style.display = 'none';

    if (!currentPassword) {
      if (errEl) { errEl.textContent = '请输入当前密码'; errEl.style.display = 'block'; }
      return;
    }
    if (!newUsername) {
      if (errEl) { errEl.textContent = '请输入新用户名'; errEl.style.display = 'block'; }
      return;
    }
    if (newUsername.length < 2) {
      if (errEl) { errEl.textContent = '用户名至少 2 个字符'; errEl.style.display = 'block'; }
      return;
    }
    if (!/^[a-zA-Z0-9_\u4e00-\u9fff]+$/.test(newUsername)) {
      if (errEl) { errEl.textContent = '用户名只能包含字母、数字、下划线和中文'; errEl.style.display = 'block'; }
      return;
    }

    Live2DAdminAPI.updateProfile(currentPassword, newUsername)
      .then(function () {
        if (okEl) { okEl.textContent = '用户名已更新'; okEl.style.display = 'block'; }
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
    setGenPos: setGenPos,
    updateGenCode: updateGenCode,
    closeGenModal: function () {
      destroyGenPixi();
      UI.closeModal('modal-generate');
    },
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
