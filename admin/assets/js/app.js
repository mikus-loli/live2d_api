var App = (function () {
  var models = [];
  var groups = [];
  var activeGroup = '';
  var searchQuery = '';
  var currentView = 'list';
  var currentDetailModel = null;
  var currentCodeModel = '';

  // 移动设备检测
  function isMobileDevice() {
    var width = window.innerWidth || document.documentElement.clientWidth;
    if (width <= 768) return true;
    // 额外检测触摸设备
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      // 触摸设备但屏幕较大时，仍允许预览
      return width <= 768;
    }
    return false;
  }

  function init() {
    loadUserInfo();
    loadGroups();
    loadModels(function () {
      // 检测 URL 参数 ?gen=ModelName，自动打开代码生成
      var params = new URLSearchParams(window.location.search);
      var genModel = params.get('gen');
      if (genModel) {
        generateCode(genModel);
      }
    });
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

  function loadModels(callback) {
    var container = document.getElementById('model-grid');
    if (!container) return;
    UI.showLoading(container);

    Live2DAdminAPI.getModels()
      .then(function (res) {
        models = res.data || [];
        updateStats();
        renderFilteredModels();
        if (callback) callback();
      })
      .catch(function (err) {
        UI.showEmpty(container, '加载模型失败: ' + err.message);
        UI.toast('加载模型失败', 'error');
        if (callback) callback();
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
    if (cards.length === 0) return;
    // 使用 CSS 动画类代替 JS 逐个设置样式
    for (var i = 0; i < cards.length; i++) {
      cards[i].style.opacity = '0';
      cards[i].style.transform = 'translateY(20px)';
      cards[i].style.transition = 'none';
    }
    // 批量触发重排后设置动画
    container.offsetHeight; // 强制一次重排
    requestAnimationFrame(function () {
      for (var i = 0; i < cards.length; i++) {
        cards[i].style.transition = 'opacity 0.3s ease ' + (i * 50) + 'ms, transform 0.3s ease ' + (i * 50) + 'ms';
        cards[i].style.opacity = '1';
        cards[i].style.transform = 'translateY(0)';
      }
    });
  }

  function filterGroup(group) {
    activeGroup = group;
    renderGroups();
    renderFilteredModels();
  }

  function previewModel(nameOrId) {
    // 移动设备禁用预览
    if (isMobileDevice()) {
      UI.toast('移动设备不支持 Live2D 预览，请在桌面端查看', 'info');
      return;
    }

    if (typeof nameOrId !== 'string') {
      return;
    }

    var byName = findModelByName(nameOrId);
    if (byName) {
      if (byName.is_multi && byName.sub_models && byName.sub_models.length > 0) {
        Live2DPreview.loadModelMulti(byName.sub_models, 0);
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
      Live2DPreview.loadModelMulti(model.sub_models, 0);
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

  // 设置模型封面图
  function setModelCover(modelName) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp,image/gif';
    input.onchange = function () {
      var file = input.files && input.files[0];
      if (!file) return;
      var form = new FormData();
      form.append('file', file);
      form.append('model_name', modelName);
      UI.toast('正在上传封面...', 'info');
      fetch('/admin/api/set_cover', { method: 'POST', body: form })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.success) {
            UI.toast('封面已更新', 'success');
            loadModels();
          } else {
            UI.toast('上传失败: ' + (data.message || 'Unknown error'), 'error');
          }
        })
        .catch(function (e) {
          UI.toast('网络错误', 'error');
        });
    };
    input.click();
  }

  var pendingUploadFile = null;

  function handleFileSelect(file) {
    pendingUploadFile = file;
    var fileLabel = document.getElementById('upload-file-label');
    var nameInput = document.getElementById('upload-model-name');
    if (fileLabel) fileLabel.textContent = file.name + ' (' + UI.formatSize(file.size) + ')';

    // 自动从文件名获取模型名称
    if (nameInput) {
      var fileName = file.name;
      // 移除扩展名
      var extMatch = fileName.match(/\.(zip|moc|moc3|json|mtn|png|jpg|avif)$/i);
      if (extMatch) {
        fileName = fileName.slice(0, -extMatch[0].length);
      }
      nameInput.value = fileName;
    }
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

    if (!modelName) {
      UI.toast('请输入模型名称', 'error');
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
    scale: 1,
    hideOnMobile: true,
    messages: ['你好呀~', '今天天气真好!', '有什么想问的吗?', '欢迎来到这里~', '我是你的看板娘哦~'],
    skinId: 0,
    skins: [],
  };
  var genPixiApp = null;
  var genCubism2Loaded = false;

  function computeModelDimensions(config) {
    var layout = config.layout || {};
    var cx = layout.center_x || 0;
    var cy = layout.center_y || 0;
    var lw = layout.width || 2;
    var modelBottom;

    var hitAreas = config.hit_areas_custom || config.hit_areas || {};
    var allYMin = [];
    for (var key in hitAreas) {
      if (hitAreas[key] && Array.isArray(hitAreas[key]) && typeof hitAreas[key][1] === 'number') {
        allYMin.push(hitAreas[key][1]);
      }
    }
    if (allYMin.length > 0) {
      modelBottom = cy + Math.min.apply(null, allYMin);
    } else {
      modelBottom = cy - lw / 2;
    }

    var optimalRatio = Math.abs(modelBottom);
    optimalRatio = Math.max(0.4, Math.min(optimalRatio, 2.0));
    var defaultWidth = 280;
    var defaultHeight = Math.round(defaultWidth * optimalRatio);

    return { width: defaultWidth, height: defaultHeight };
  }

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
    genState.scale = 1;
    genState.hideOnMobile = true;
    genState.messages = ['你好呀~', '今天天气真好!', '有什么想问的吗?', '欢迎来到这里~', '我是你的看板娘哦~'];
    genState.skinId = 0;
    genState.skins = [];

    genState.isCubism4 = false;
    genState.isMulti = false;
    genState.subModels = [];
    for (var i = 0; i < models.length; i++) {
      var m = models[i];
      if (m.name === modelName) {
        if (m.is_cubism4) { genState.isCubism4 = true; }
        if (m.is_multi && m.sub_models) {
          genState.isMulti = true;
          genState.subModels = m.sub_models;
          for (var j = 0; j < m.sub_models.length; j++) {
            if (m.sub_models[j].is_cubism4) { genState.isCubism4 = true; break; }
          }
        }
        break;
      }
    }

    var offsetXEl = document.getElementById('gen-offset-x');
    var offsetYEl = document.getElementById('gen-offset-y');
    var widthEl = document.getElementById('gen-width');
    var heightEl = document.getElementById('gen-height');
    var skinEl = document.getElementById('gen-skin');
    var skinGroupEl = document.getElementById('gen-skin-group');
    if (offsetXEl) offsetXEl.value = 0;
    if (offsetYEl) offsetYEl.value = 0;
    if (skinEl) { skinEl.innerHTML = '<option value="0">默认皮肤</option>'; skinEl.value = '0'; }
    if (skinGroupEl) skinGroupEl.style.display = genState.isCubism4 ? 'none' : '';

    var pendingTasks = 2;

    function checkAllDone() {
      pendingTasks--;
      if (pendingTasks <= 0) doShowGeneratedCode();
    }

    Live2DAdminAPI.getModelDetail(modelName).then(function (res) {
      if (res.data && res.data.config && res.data.config.layout) {
        var dims = computeModelDimensions(res.data.config);
        genState.width = dims.width;
        genState.height = dims.height;
        if (widthEl) widthEl.value = dims.width;
        if (heightEl) heightEl.value = dims.height;
      } else {
        if (widthEl) widthEl.value = genState.width;
        if (heightEl) heightEl.value = genState.height;
      }
      checkAllDone();
    }).catch(function () {
      if (widthEl) widthEl.value = genState.width;
      if (heightEl) heightEl.value = genState.height;
      checkAllDone();
    });

    Live2DAdminAPI.getSkins(modelName).then(function (res) {
      if (genState.isMulti && genState.subModels.length > 0) {
        genState.skins = genState.subModels.map(function (sm, idx) {
          return { id: idx + 1, name: sm.name.split('/').pop(), model_name: sm.name };
        });
        if (skinEl) {
          var html = '';
          for (var k = 0; k < genState.skins.length; k++) {
            var s = genState.skins[k];
            html += '<option value="' + s.id + '">' + s.name + '</option>';
          }
          skinEl.innerHTML = html;
          skinEl.value = '1';
          genState.skinId = 1;
        }
        checkAllDone();
      } else if (res.data && res.data.skins && res.data.skins.length > 0) {
        genState.skins = res.data.skins;
        if (skinEl) {
          var html = '<option value="0">默认皮肤</option>';
          for (var k = 0; k < res.data.skins.length; k++) {
            var s = res.data.skins[k];
            html += '<option value="' + s.id + '">' + s.name + '</option>';
          }
          skinEl.innerHTML = html;
        }
        checkAllDone();
      } else {
        checkAllDone();
      }
    }).catch(function () {
      if (genState.isMulti && genState.subModels.length > 0) {
        genState.skins = genState.subModels.map(function (sm, idx) {
          return { id: idx + 1, name: sm.name.split('/').pop(), model_name: sm.name };
        });
        if (skinEl) {
          var html = '';
          for (var k = 0; k < genState.skins.length; k++) {
            var s = genState.skins[k];
            html += '<option value="' + s.id + '">' + s.name + '</option>';
          }
          skinEl.innerHTML = html;
          skinEl.value = '1';
          genState.skinId = 1;
        }
      }
      checkAllDone();
    });

    function doShowGeneratedCode() {
      var posBtns = document.querySelectorAll('.gen-btn[data-pos]');
      for (var i = 0; i < posBtns.length; i++) {
        posBtns[i].classList.toggle('active', posBtns[i].getAttribute('data-pos') === 'right');
      }

      var scaleBtns = document.querySelectorAll('.gen-btn[data-scale]');
      for (var j = 0; j < scaleBtns.length; j++) {
        scaleBtns[j].classList.toggle('active', parseFloat(scaleBtns[j].getAttribute('data-scale')) === 1);
      }

      var messagesEl = document.getElementById('gen-messages');
      if (messagesEl) {
        messagesEl.value = genState.messages ? genState.messages.join('\n') : '你好呀~\n今天天气真好!\n有什么想问的吗?\n欢迎来到这里~\n我是你的看板娘哦~';
      }

      showGeneratedCode();
    }
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

  function setGenScale(scale) {
    genState.scale = scale;
    var scaleBtns = document.querySelectorAll('.gen-btn[data-scale]');
    for (var i = 0; i < scaleBtns.length; i++) {
      scaleBtns[i].classList.toggle('active', parseFloat(scaleBtns[i].getAttribute('data-scale')) === scale);
    }
    loadGenPreview();
    updateGenCode();
  }

  function setHideOnMobile(val) {
    genState.hideOnMobile = val;
    var btns = document.querySelectorAll('.gen-btn[data-mobile]');
    for (var i = 0; i < btns.length; i++) {
      var isHide = btns[i].getAttribute('data-mobile') === 'hide';
      btns[i].classList.toggle('active', val ? isHide : !isHide);
    }
    updateGenCode();
  }

  function setGenSkin(skinId) {
    genState.skinId = parseInt(skinId, 10) || 0;
    loadGenPreview();
    updateGenCode();
  }

  function updateGenMessages() {
    var ta = document.getElementById('gen-messages');
    if (!ta) return;
    var lines = ta.value.split('\n');
    genState.messages = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line) genState.messages.push(line);
    }
    if (genState.messages.length === 0) {
      genState.messages = ['你好呀~'];
    }
    updateGenCode();
  }

  function updateGenCode() {
    var offsetXEl = document.getElementById('gen-offset-x');
    var offsetYEl = document.getElementById('gen-offset-y');
    var widthEl = document.getElementById('gen-width');
    var heightEl = document.getElementById('gen-height');
    var messagesEl = document.getElementById('gen-messages');
    if (offsetXEl) genState.offsetX = parseInt(offsetXEl.value, 10) || 0;
    if (offsetYEl) genState.offsetY = parseInt(offsetYEl.value, 10) || 0;
    if (widthEl) genState.width = Math.max(100, parseInt(widthEl.value, 10) || 300);
    if (heightEl) genState.height = Math.max(100, parseInt(heightEl.value, 10) || 400);
    if (messagesEl) {
      var lines = messagesEl.value.split('\n');
      genState.messages = [];
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line) genState.messages.push(line);
      }
      if (genState.messages.length === 0) genState.messages = ['你好呀~'];
    }

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
  var GEN_PREVIEW_SCALE = 1.5;
  var genDialogTimeout = null;

  function showGenDialog(text, duration) {
    var dialog = document.getElementById('gen-dialog');
    var content = document.getElementById('gen-dialog-content');
    if (!dialog || !content) return;

    if (genDialogTimeout) {
      clearTimeout(genDialogTimeout);
      genDialogTimeout = null;
    }

    content.textContent = text;
    dialog.classList.add('show');

    if (duration && duration > 0) {
      genDialogTimeout = setTimeout(function () {
        hideGenDialog();
      }, duration);
    }
  }

  function hideGenDialog() {
    var dialog = document.getElementById('gen-dialog');
    if (dialog) {
      dialog.classList.remove('show');
    }
    if (genDialogTimeout) {
      clearTimeout(genDialogTimeout);
      genDialogTimeout = null;
    }
  }

  function showGenRandomMessage() {
    var msgs = genState.messages && genState.messages.length > 0 ? genState.messages : ['你好呀~'];
    var msg = msgs[Math.floor(Math.random() * msgs.length)];
    showGenDialog(msg, 4000);
  }

  function loadGenPreview() {
    // 移动设备禁用预览
    if (isMobileDevice()) {
      var wrap = document.getElementById('gen-preview-wrap');
      if (wrap) {
        wrap.innerHTML = '<div class="gen-preview-mobile-msg"><p>移动设备不支持预览</p><p class="small">请在桌面端查看 Live2D 效果</p></div>';
      }
      return;
    }

    releaseMainPreview();

    var wrap = document.getElementById('gen-preview-wrap');
    if (!wrap) return;
    while (wrap.firstChild) wrap.removeChild(wrap.firstChild);

    var scale = genState.scale || 1;
    var cw = Math.round(genState.width * MOCK_SCALE * scale * GEN_PREVIEW_SCALE);
    var ch = Math.round(genState.height * MOCK_SCALE * scale * GEN_PREVIEW_SCALE);
    var renderW = Math.round(genState.width * scale * GEN_PREVIEW_SCALE);
    var renderH = Math.round(genState.height * scale * GEN_PREVIEW_SCALE);

    var canvas = document.createElement('canvas');
    canvas.id = 'gen-preview-canvas';
    canvas.width = renderW;
    canvas.height = renderH;
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    canvas.style.cursor = 'grab';
    wrap.appendChild(canvas);

    setupGenPreviewDrag();

    updateMockModelPosition();

    if (genState.isCubism4) {
      loadGenPreview4(canvas, cw, ch);
    } else {
      loadGenPreview2(canvas);
    }
  }

  function setupGenPreviewDrag() {
    var model = document.getElementById('gen-mock-model');
    if (!model) return;

    var isDragging = false;
    var startX, startY;
    var startOffsetX, startOffsetY;

    model.addEventListener('mousedown', function (e) {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startOffsetX = genState.offsetX;
      startOffsetY = genState.offsetY;
      model.style.cursor = 'grabbing';
      e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
      if (!isDragging) return;
      var dx = genState.position === 'left'
        ? e.clientX - startX
        : startX - e.clientX;
      var dy = startY - e.clientY;
      var rawOffsetX = startOffsetX + dx / MOCK_SCALE;
      var rawOffsetY = startOffsetY + dy / MOCK_SCALE;

      var mockPage = document.getElementById('gen-mock-page');
      var maxOffsetX = mockPage ? (mockPage.clientWidth / MOCK_SCALE - genState.width * (genState.scale || 1)) : 9999;
      var maxOffsetY = mockPage ? (mockPage.clientHeight / MOCK_SCALE - genState.height * (genState.scale || 1)) : 9999;
      maxOffsetX = Math.max(0, maxOffsetX);
      maxOffsetY = Math.max(0, maxOffsetY);

      var newOffsetX = Math.max(0, Math.min(Math.round(rawOffsetX), Math.round(maxOffsetX)));
      var newOffsetY = Math.max(0, Math.min(Math.round(rawOffsetY), Math.round(maxOffsetY)));
      genState.offsetX = newOffsetX;
      genState.offsetY = newOffsetY;
      var offsetXEl = document.getElementById('gen-offset-x');
      var offsetYEl = document.getElementById('gen-offset-y');
      if (offsetXEl) offsetXEl.value = newOffsetX;
      if (offsetYEl) offsetYEl.value = newOffsetY;
      updateMockModelPosition();
      updateGenCode();
    });

    document.addEventListener('mouseup', function () {
      if (isDragging) {
        isDragging = false;
        model.style.cursor = 'grab';
      }
    });
  }

  function updateMockModelPosition() {
    var model = document.getElementById('gen-mock-model');
    if (!model) return;

    var scale = genState.scale || 1;
    var cw = Math.round(genState.width * MOCK_SCALE * scale * GEN_PREVIEW_SCALE);
    var ch = Math.round(genState.height * MOCK_SCALE * scale * GEN_PREVIEW_SCALE);
    var ox = Math.round(genState.offsetX * MOCK_SCALE);
    var oy = Math.round(genState.offsetY * MOCK_SCALE);
    var renderW = Math.round(genState.width * scale * GEN_PREVIEW_SCALE);
    var renderH = Math.round(genState.height * scale * GEN_PREVIEW_SCALE);

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
    model.style.transform = 'none';

    var canvas = document.getElementById('gen-preview-canvas');
    if (canvas) {
      canvas.width = renderW;
      canvas.height = renderH;
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
      // 强制 WebGL preserveDrawingBuffer 以支持截图
      var origGetContext = canvas.getContext;
      canvas.getContext = function (type, attrs) {
        attrs = attrs || {};
        attrs.preserveDrawingBuffer = true;
        return origGetContext.call(canvas, type, attrs);
      };
      var skinId = genState.skinId || 0;
      var url;
      if (genState.isMulti && genState.skins.length > 0 && skinId > 0) {
        var skin = genState.skins[skinId - 1];
        if (skin && skin.model_name) {
          url = genState.apiBase + '/model/' + encodePath(skin.model_name) + '/index.json';
        } else {
          url = genState.apiBase + '/model/' + encodePath(genState.modelName) + '/index.json';
        }
      } else if (skinId > 0) {
        // 使用 /get/ API 传递 textures_id 以支持纹理切换
        url = genState.apiBase + '/get/?name=' + encodePath(genState.modelName) + '&textures_id=' + skinId;
      } else {
        url = genState.apiBase + '/model/' + encodePath(genState.modelName) + '/index.json';
      }
      loadlive2d('gen-preview-canvas', url);
      setTimeout(showGenRandomMessage, 500);
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
        preserveDrawingBuffer: true,
      });
    } catch (e) { return; }

    var modelUrl = genState.apiBase + '/model/' + encodePath(genState.modelName) + '/' + encodeURIComponent(genState.modelLast) + '.model3.json';
    PIXI.live2d.Live2DModel.from(modelUrl).then(function (m) {
      m.anchor.set(0.5, 0.5);
      m.x = cw / 2;
      m.y = ch / 2;
      var origW = m.width / m.scale.x;
      var origH = m.height / m.scale.y;
      var sc = Math.min(cw / origW, ch / origH);
      m.scale.set(sc);
      genPixiApp.stage.addChild(m);
      showGenRandomMessage();
    }).catch(function () {});
  }

  function destroyGenPixi() {
    hideGenDialog();
    if (genPixiApp) {
      genPixiApp.destroy(true);
      genPixiApp = null;
    }
    var wrap = document.getElementById('gen-preview-wrap');
    if (wrap) {
      while (wrap.firstChild) wrap.removeChild(wrap.firstChild);
    }
  }

  // 从预览画布生成封面图
  function genCover() {
    var modelName = genState.modelName;
    if (!modelName) { UI.toast('请先选择模型', 'error'); return; }

    try {
      if (genState.isCubism4 && genPixiApp && genPixiApp.view) {
        // Cubism 4: 临时提高渲染分辨率后截图
        var renderer = genPixiApp.renderer;
        var origW = renderer.width;
        var origH = renderer.height;
        var origRes = renderer.resolution;

        // 以 1024 为长边基准高清渲染
        var maxDim = 1024;
        var scale = Math.min(maxDim / origW, maxDim / origH);
        var hiW = Math.round(origW * scale);
        var hiH = Math.round(origH * scale);
        renderer.resolution = 1;
        renderer.resize(hiW, hiH);
        genPixiApp.stage.scale.set(scale);
        renderer.render(genPixiApp.stage);

        var dataUrl = renderer.view.toDataURL('image/png');

        // 还原
        genPixiApp.stage.scale.set(1);
        renderer.resize(origW, origH);
        renderer.resolution = origRes;

        if (!dataUrl) { UI.toast('截图失败', 'error'); return; }
        doUpload(dataUrl, modelName);
      } else {
        // Cubism 2: 先复位鼠标跟踪，等待模型回正后再截图
        document.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
        setTimeout(function () {
          try {
            var canvas = document.getElementById('gen-preview-canvas');
            if (!canvas || !canvas.toDataURL) { UI.toast('未找到预览画布', 'error'); return; }
            var dataUrl = canvas.toDataURL('image/png');
            if (!dataUrl) { UI.toast('截图失败', 'error'); return; }
            doUpload(dataUrl, modelName);
          } catch (e) {
            UI.toast('截图失败: ' + e.message, 'error');
          }
        }, 300);
      }
    } catch (e) {
      UI.toast('截图失败: ' + e.message, 'error');
    }
  }

  function doUpload(dataUrl, modelName) {
    UI.toast('正在生成封面...', 'info');
    fetch(dataUrl)
      .then(function (res) { return res.blob(); })
      .then(function (blob) {
        var form = new FormData();
        form.append('file', blob, 'preview.png');
        form.append('model_name', modelName);
        return fetch('/admin/api/set_cover', { method: 'POST', body: form });
      })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.success) {
          UI.toast('封面已生成', 'success');
          if (typeof loadModels === 'function') loadModels();
        } else {
          UI.toast('生成失败: ' + (data.message || 'Unknown error'), 'error');
        }
      })
      .catch(function () { UI.toast('网络错误', 'error'); });
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
    var css = '.live2d-wrap{position:fixed;' + pos + ':' + s.offsetX + 'px;bottom:' + s.offsetY + 'px;z-index:99999;pointer-events:auto}#live2d{position:relative;display:block;opacity:0;transition:opacity .4s ease}#live2d.show{opacity:1}#live2d-dialog{pointer-events:none}';
    if (s.hideOnMobile) {
      css += '@media(max-width:768px){.live2d-wrap,#live2d-dialog{display:none!important}}';
    }
    return '<style>' + css + '</style>\n';
  }

  function buildMobileCheckScript(s) {
    if (!s.hideOnMobile) return '';
    return '<script>function _l2dMobileCheck(){var e=document.querySelector(".live2d-wrap"),d=document.getElementById("live2d-dialog");if(!e)return;var isMobile=screen.width<=768||/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);if(isMobile){e.style.display="none";if(d)d.style.display="none"}else{e.style.display="";if(d)d.style.display=""}}_l2dMobileCheck();window.addEventListener("resize",_l2dMobileCheck)<\/script>';
  }

  function getCodeTemplate2(modelName, apiBase, s) {
    var w = Math.round(s.width * (s.scale || 1));
    var h = Math.round(s.height * (s.scale || 1));
    var pos = s.position === 'left' ? 'left' : 'right';
    var msgsJson = JSON.stringify(s.messages || ['你好呀~']);
    var skinId = s.skinId || 0;
    var modelUrl;
    if (s.isMulti && s.skins && s.skins.length > 0 && skinId > 0) {
      var skin = s.skins[skinId - 1];
      if (skin && skin.model_name) {
        modelUrl = apiBase + '/model/' + encodePath(skin.model_name) + '/index.json';
      } else {
        modelUrl = apiBase + '/model/' + encodePath(modelName) + '/index.json';
      }
    } else if (skinId > 0) {
      modelUrl = apiBase + '/model/' + encodePath(modelName) + '/config-' + skinId + '.json';
    } else {
      modelUrl = apiBase + '/model/' + encodePath(modelName) + '/index.json';
    }
    var dialogCSS = '#live2d-dialog{position:absolute;bottom:100%;left:50%;transform:translateX(-50%);margin-bottom:8px;background:rgba(255,255,255,0.95);border-radius:12px;padding:12px 16px;max-width:280px;min-width:120px;box-shadow:0 4px 20px rgba(0,0,0,0.15);z-index:99998;display:none;animation:dialogFadeIn 0.3s ease}#live2d-dialog.show{display:block}#live2d-dialog::after{content:"";position:absolute;bottom:-8px;left:50%;transform:translateX(-50%);border-left:8px solid transparent;border-right:8px solid transparent;border-top:8px solid rgba(255,255,255,0.95)}#dialog-content{font-size:14px;color:#333;text-align:center;line-height:1.4}@keyframes dialogFadeIn{from{opacity:0;transform:translateX(-50%) translateY(-10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}';
    return buildEmbedCSS(s) +
      '<style>' + dialogCSS + '</style>\n' +
      '<div class="live2d-wrap">\n' +
      '  <div id="live2d-dialog"><div id="dialog-content"></div></div>\n' +
      '  <canvas id="live2d" width="' + w + '" height="' + h + '"></canvas>\n' +
      '</div>\n' +
      '<script>\n' +
      '(function(){\n' +
      'var pos="' + pos + '",ox=' + s.offsetX + ',w=' + w + ',h=' + h + ';\n' +
      'var msgs=' + msgsJson + ';\n' +
      'var hoverMsgs=["干嘛呢你，快把手拿开～～","鼠…鼠标放错地方了！","你要干嘛呀？","怕怕(ノ≧∇≦)ノ","Hentai！","真…真的是不知羞耻！","不要动手动脚的！"];\n' +
      'var clickMsgs=["是…是不小心碰到了吧…","萝莉控是什么呀？","再摸的话我可要报警了！⌇●﹏●⌇","110 吗，这里有个变态一直在摸我(ó﹏ò｡)","干嘛动我呀！小心我咬你！","别摸我，有什么好摸的！"];\n' +
      'var timeMsgs={"6-7":"早上好！一日之计在于晨，美好的一天就要开始了~","8-11":"上午好！工作顺利嘛，不要久坐，多起来走动走动哦！","12-13":"中午了，工作了一个上午，现在是午餐时间！","14-17":"午后很容易犯困呢，今天的运动目标完成了吗？","18-19":"傍晚了！窗外夕阳的景色很美丽呢~","20-21":"晚上好，今天过得怎么样？","22-23":["已经这么晚了呀，早点休息吧，晚安~","深夜时要爱护眼睛呀！"],"0-5":"你是夜猫子呀？这么晚还不睡觉，明天起的来嘛？"};\n' +
      'var consoleMsg="哈哈，你打开了控制台，是想要看看我的小秘密吗？";\n' +
      'var copyMsg="你都复制了些什么呀，转载要记得加上出处哦！";\n' +
      'var backMsg="哇，你终于回来了~";\n' +
      'var welcomeMsg="欢迎来到这里~今天也要开心哦！";\n' +
      'var scrollMsgs={"25":"已经阅读四分之一啦，继续加油！","50":"已经阅读一半啦，觉得怎么样？","75":"马上就要读完了，精彩还在后面！","100":"哇，你竟然看完了！是不是很棒呢？"};\n' +
      'var dialogTimer=null,idleTimer=null,hoverTimer=null,scrollFired={};\n' +
      'function rnd(a){return a[Math.floor(Math.random()*a.length)]}\n' +
      'function showDialog(t,d){var el=document.getElementById("live2d-dialog"),c=document.getElementById("dialog-content");if(!el||!c)return;if(dialogTimer){clearTimeout(dialogTimer);dialogTimer=null}c.textContent=t;el.classList.add("show");resetIdle();if(d&&d>0){dialogTimer=setTimeout(function(){hideDialog()},d)}}\n' +
      'function hideDialog(){var el=document.getElementById("live2d-dialog");if(el)el.classList.remove("show");if(dialogTimer){clearTimeout(dialogTimer);dialogTimer=null}}\n' +
      'function showRandomMsg(){showDialog(rnd(msgs),5000)}\n' +
      'function getTimeMsg(){var h=new Date().getHours(),r;for(var k in timeMsgs){var p=k.split("-"),a=parseInt(p[0]),b=parseInt(p[1]);if(h>=a&&h<=b){r=timeMsgs[k];break}}if(!r)return null;return Array.isArray(r)?r[Math.floor(Math.random()*r.length)]:r}\n' +
      'function resetIdle(){if(idleTimer)clearTimeout(idleTimer);idleTimer=setTimeout(function(){showRandomMsg()},30000)}\n' +
      'var cv=document.getElementById("live2d"),wrap=cv.parentElement;\n' +
      'cv.addEventListener("mouseenter",function(){hoverTimer=setTimeout(function(){showDialog(rnd(hoverMsgs),4000)},500)});\n' +
      'cv.addEventListener("mouseleave",function(){if(hoverTimer){clearTimeout(hoverTimer);hoverTimer=null}});\n' +
      'cv.addEventListener("click",function(){showDialog(rnd(clickMsgs),4000)});\n' +
      'document.addEventListener("copy",function(){showDialog(copyMsg,4000)});\n' +
      'document.addEventListener("visibilitychange",function(){if(!document.hidden)showDialog(backMsg,4000)});\n' +
      'window.addEventListener("scroll",function(){var st=document.documentElement.scrollTop||document.body.scrollTop,sh=document.documentElement.scrollHeight-document.documentElement.clientHeight,pct=Math.round(st/sh*100);["25","50","75","100"].forEach(function(m){if(pct>=parseInt(m)&&!scrollFired[m]){scrollFired[m]=true;showDialog(scrollMsgs[m],4000)}})});\n' +
      'setInterval(function(){if(window.outerWidth-window.innerWidth>160||window.outerHeight-window.innerHeight>160){if(consoleMsg){showDialog(consoleMsg,4000);consoleMsg=null}}},1000);\n' +
      'var s=document.createElement("script");s.src="' + apiBase + '/live2d.min.js";s.onload=function(){loadlive2d("live2d","' + modelUrl + '");setTimeout(function(){cv.classList.add("show");var tm=getTimeMsg();if(tm)showDialog(tm,6000);else showDialog(welcomeMsg,6000)},800)};document.head.appendChild(s)\n' +
      '})();\n' +
      '<\/script>' +
      buildMobileCheckScript(s);
  }

  function getCodeTemplate4(modelName, modelLast, apiBase, s) {
    var w = Math.round(s.width * (s.scale || 1));
    var h = Math.round(s.height * (s.scale || 1));
    var pos = s.position === 'left' ? 'left' : 'right';
    var msgsJson = JSON.stringify(s.messages || ['你好呀~']);
    var dialogCSS = '#live2d-dialog{position:absolute;bottom:100%;left:50%;transform:translateX(-50%);margin-bottom:8px;background:rgba(255,255,255,0.95);border-radius:12px;padding:12px 16px;max-width:280px;min-width:120px;box-shadow:0 4px 20px rgba(0,0,0,0.15);z-index:99998;display:none;animation:dialogFadeIn 0.3s ease}#live2d-dialog.show{display:block}#live2d-dialog::after{content:"";position:absolute;bottom:-8px;left:50%;transform:translateX(-50%);border-left:8px solid transparent;border-right:8px solid transparent;border-top:8px solid rgba(255,255,255,0.95)}#dialog-content{font-size:14px;color:#333;text-align:center;line-height:1.4}@keyframes dialogFadeIn{from{opacity:0;transform:translateX(-50%) translateY(-10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}';
    return buildEmbedCSS(s) +
      '<style>' + dialogCSS + '</style>\n' +
      '<div class="live2d-wrap">\n' +
      '  <div id="live2d-dialog"><div id="dialog-content"></div></div>\n' +
      '  <canvas id="live2d" width="' + w + '" height="' + h + '"></canvas>\n' +
      '</div>\n' +
      '<script>\n' +
      '(function(){\n' +
      'var b="' + apiBase + '",w=' + w + ',h=' + h + ',pos="' + pos + '",ox=' + s.offsetX + ',oy=' + s.offsetY + ';\n' +
      'var msgs=' + msgsJson + ';\n' +
      'var hoverMsgs=["干嘛呢你，快把手拿开～～","鼠…鼠标放错地方了！","你要干嘛呀？","怕怕(ノ≧∇≦)ノ","Hentai！","真…真的是不知羞耻！","不要动手动脚的！"];\n' +
      'var clickMsgs=["是…是不小心碰到了吧…","萝莉控是什么呀？","再摸的话我可要报警了！⌇●﹏●⌇","110 吗，这里有个变态一直在摸我(ó﹏ò｡)","干嘛动我呀！小心我咬你！","别摸我，有什么好摸的！"];\n' +
      'var timeMsgs={"6-7":"早上好！一日之计在于晨，美好的一天就要开始了~","8-11":"上午好！工作顺利嘛，不要久坐，多起来走动走动哦！","12-13":"中午了，工作了一个上午，现在是午餐时间！","14-17":"午后很容易犯困呢，今天的运动目标完成了吗？","18-19":"傍晚了！窗外夕阳的景色很美丽呢~","20-21":"晚上好，今天过得怎么样？","22-23":["已经这么晚了呀，早点休息吧，晚安~","深夜时要爱护眼睛呀！"],"0-5":"你是夜猫子呀？这么晚还不睡觉，明天起的来嘛？"};\n' +
      'var consoleMsg="哈哈，你打开了控制台，是想要看看我的小秘密吗？";\n' +
      'var copyMsg="你都复制了些什么呀，转载要记得加上出处哦！";\n' +
      'var backMsg="哇，你终于回来了~";\n' +
      'var welcomeMsg="欢迎来到这里~今天也要开心哦！";\n' +
      'var scrollMsgs={"25":"已经阅读四分之一啦，继续加油！","50":"已经阅读一半啦，觉得怎么样？","75":"马上就要读完了，精彩还在后面！","100":"哇，你竟然看完了！是不是很棒呢？"};\n' +
      'var dialogTimer=null,idleTimer=null,hoverTimer=null,scrollFired={};\n' +
      'function rnd(a){return a[Math.floor(Math.random()*a.length)]}\n' +
      'function showDialog(t,d){var el=document.getElementById("live2d-dialog"),c=document.getElementById("dialog-content");if(!el||!c)return;if(dialogTimer){clearTimeout(dialogTimer);dialogTimer=null}c.textContent=t;el.classList.add("show");resetIdle();if(d&&d>0){dialogTimer=setTimeout(function(){hideDialog()},d)}}\n' +
      'function hideDialog(){var el=document.getElementById("live2d-dialog");if(el)el.classList.remove("show");if(dialogTimer){clearTimeout(dialogTimer);dialogTimer=null}}\n' +
      'function showRandomMsg(){showDialog(rnd(msgs),5000)}\n' +
      'function getTimeMsg(){var h=new Date().getHours(),r;for(var k in timeMsgs){var p=k.split("-"),a=parseInt(p[0]),b=parseInt(p[1]);if(h>=a&&h<=b){r=timeMsgs[k];break}}if(!r)return null;return Array.isArray(r)?r[Math.floor(Math.random()*r.length)]:r}\n' +
      'function resetIdle(){if(idleTimer)clearTimeout(idleTimer);idleTimer=setTimeout(function(){showRandomMsg()},30000)}\n' +
      'document.addEventListener("copy",function(){showDialog(copyMsg,4000)});\n' +
      'document.addEventListener("visibilitychange",function(){if(!document.hidden)showDialog(backMsg,4000)});\n' +
      'window.addEventListener("scroll",function(){var st=document.documentElement.scrollTop||document.body.scrollTop,sh=document.documentElement.scrollHeight-document.documentElement.clientHeight,pct=Math.round(st/sh*100);["25","50","75","100"].forEach(function(m){if(pct>=parseInt(m)&&!scrollFired[m]){scrollFired[m]=true;showDialog(scrollMsgs[m],4000)}})});\n' +
      'setInterval(function(){if(window.outerWidth-window.innerWidth>160||window.outerHeight-window.innerHeight>160){if(consoleMsg){showDialog(consoleMsg,4000);consoleMsg=null}}},1000);\n' +
      'function ls(u,c){var d=document.querySelector(\'script[src="\'+u+\'"]\');if(d){if(c)c();return}var s=document.createElement("script");s.src=u;s.onload=c;document.head.appendChild(s)}\n' +
      'ls(b+"/live2dcubismcore.min.js",function(){\n' +
      '  ls(b+"/pixi.min.js",function(){\n' +
      '    ls(b+"/cubism4.min.js",function(){\n' +
      '      var cv=document.getElementById("live2d");\n' +
      '      cv.addEventListener("mouseenter",function(){hoverTimer=setTimeout(function(){showDialog(rnd(hoverMsgs),4000)},500)});\n' +
      '      cv.addEventListener("mouseleave",function(){if(hoverTimer){clearTimeout(hoverTimer);hoverTimer=null}});\n' +
      '      cv.addEventListener("click",function(){showDialog(rnd(clickMsgs),4000)});\n' +
      '      var app=new PIXI.Application({view:cv,width:' + w + ',height:' + h + ',backgroundAlpha:0,autoDensity:true,resolution:window.devicePixelRatio||1});\n' +
      '      PIXI.live2d.Live2DModel.from(b+"/model/' + encodePath(modelName) + '/' + encodeURIComponent(modelLast) + '.model3.json").then(function(m){\n' +
      '        m.anchor.set(0.5,0.5);m.x=' + Math.round(w / 2) + ';m.y=' + Math.round(h / 2) + ';\n' +
      '        var ow=m.width/m.scale.x,oh=m.height/m.scale.y;\n' +
      '        var sc=Math.min(' + w + '/ow,' + h + '/oh);m.scale.set(sc);\n' +
      '        app.stage.addChild(m);\n' +
      '        cv.addEventListener("pointermove",function(e){var r=cv.getBoundingClientRect();m.focus(e.clientX-r.left,e.clientY-r.top)});\n' +
      '        cv.addEventListener("pointerleave",function(){m.focus(0,0)});\n' +
      '        cv.classList.add("show");\n' +
      '        var tm=getTimeMsg();if(tm)showDialog(tm,6000);else showDialog(welcomeMsg,6000);\n' +
      '      });\n' +
      '    });\n' +
      '  });\n' +
      '});\n' +
      '})();\n' +
      '<\/script>' +
      buildMobileCheckScript(s);
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

  var pollTimer = null;
  var ws = null;
  var wsRetryCount = 0;
  var WS_MAX_RETRIES = 5;

  function initRealtime() {
    connectWS();
  }

  function connectWS() {
    var protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    var wsUrl = protocol + '//' + window.location.host + '/admin/ws';

    try {
      ws = new WebSocket(wsUrl);
    } catch (e) {
      fallbackToPolling();
      return;
    }

    ws.onopen = function () {
      wsRetryCount = 0;
    };

    ws.onmessage = function (e) {
      try {
        var data = JSON.parse(e.data);
        if (data.type === 'models_updated') {
          loadModels();
          loadGroups();
        }
      } catch (err) {}
    };

    ws.onclose = function (e) {
      if (e.code === 4001) {
        // 未授权，不重连
        return;
      }
      retryWS();
    };

    ws.onerror = function () {
      // onclose 会随后触发
    };
  }

  function retryWS() {
    if (pollTimer) return; // 已降级为轮询
    if (wsRetryCount >= WS_MAX_RETRIES) {
      fallbackToPolling();
      return;
    }
    wsRetryCount++;
    var delay = Math.min(3000 * wsRetryCount, 15000);
    setTimeout(connectWS, delay);
  }

  function fallbackToPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(function () {
      loadModels();
      loadGroups();
    }, 60000);
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
    setModelCover: setModelCover,
    doCreate: doCreate,
    doEdit: doEdit,
    doDelete: doDelete,
    doUpload: doUpload,
    scanUnregistered: scanUnregistered,
    selectScannedDir: selectScannedDir,
    generateCode: generateCode,
    genCover: genCover,
    setGenPos: setGenPos,
    setGenScale: setGenScale,
    setHideOnMobile: setHideOnMobile,
    updateGenCode: updateGenCode,
    updateGenMessages: updateGenMessages,
    setGenSkin: setGenSkin,
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
