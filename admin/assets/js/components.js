var UI = (function () {
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  var toastContainer = null;

  function initToast() {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  function toast(message, type) {
    type = type || 'info';
    if (!toastContainer) initToast();
    var el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.innerHTML =
      '<span class="toast-icon">' +
      (type === 'success' ? '&#10003;' : type === 'error' ? '&#10007;' : '&#8505;') +
      '</span>' +
      '<span class="toast-msg">' +
      escapeHtml(message) +
      '</span>';
    toastContainer.appendChild(el);
    setTimeout(function () {
      el.classList.add('toast-exit');
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 300);
    }, 3000);
  }

  function overlay(show) {
    var el = document.getElementById('modal-overlay');
    if (!el) return;
    if (show) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
      var modals = document.querySelectorAll('.modal.active');
      for (var i = 0; i < modals.length; i++) modals[i].classList.remove('active');
    }
  }

  function openModal(id) {
    var el = document.getElementById(id);
    if (el) {
      el.classList.add('active');
      overlay(true);
    }
  }

  function closeModal(id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove('active');
    overlay(false);
  }

  function renderModelCard(model) {
    var statusTags = '';
    if (model.has_moc) statusTags += '<span class="tag tag-moc">MOC</span>';
    if (model.has_physics) statusTags += '<span class="tag tag-physics">物理</span>';
    if (model.has_pose) statusTags += '<span class="tag tag-pose">姿势</span>';

    var texturesInfo = model.textures_count > 0
      ? '<span class="card-meta-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>' + model.textures_count + ' 纹理</span>'
      : '';

    var filesInfo = '<span class="card-meta-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>' + model.file_count + ' 文件</span>';

    var displayName = model.name;
    var groupLabel = model.group ? '<span class="card-group">' + escapeHtml(model.group) + '</span>' : '';

    if (model.is_multi) {
      return '<div class="model-card multi" data-id="' + model.id + '" data-group="' + escapeHtml(model.group) + '">' +
        '<div class="card-header">' +
        '<div class="card-icon multi-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v3"/></svg></div>' +
        '<div class="card-title-wrap"><h3 class="card-title">' + escapeHtml(displayName) + '</h3>' + groupLabel + '</div>' +
        '</div>' +
        '<div class="card-body">' +
        '<p class="card-message">' + escapeHtml(model.message || '') + '</p>' +
        '<div class="card-tags">' + statusTags + '</div>' +
        '<p class="card-sub-count">' + (model.sub_models ? model.sub_models.length : 0) + ' 子模型</p>' +
        '</div>' +
        '<div class="card-actions">' +
        '<button class="btn btn-sm btn-outline" onclick="App.previewModel(\'' + model.id + '\')">预览</button>' +
        '<button class="btn btn-sm btn-outline" onclick="App.viewDetail(\'' + escapeHtml(model.sub_models && model.sub_models[0] ? model.sub_models[0].name : '') + '\')">详情</button>' +
        '<button class="btn btn-sm btn-outline" onclick="App.editModel(\'' + escapeHtml(model.name) + '\', \'' + escapeHtml(model.message || '') + '\')">编辑</button>' +
        '<button class="btn btn-sm btn-code" onclick="App.generateCode(\'' + escapeHtml(model.name) + '\')">生成代码</button>' +
        '<button class="btn btn-sm btn-danger-outline" onclick="App.confirmDelete(\'' + escapeHtml(model.name) + '\')">删除</button>' +
        '</div>' +
        '</div>';
    }

    return '<div class="model-card" data-name="' + escapeHtml(model.name) + '" data-group="' + escapeHtml(model.group) + '">' +
      '<div class="card-header">' +
      '<div class="card-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>' +
      '<div class="card-title-wrap"><h3 class="card-title">' + escapeHtml(displayName) + '</h3>' + groupLabel + '</div>' +
      '</div>' +
      '<div class="card-body">' +
      '<p class="card-message">' + escapeHtml(model.message || '') + '</p>' +
      '<div class="card-tags">' + statusTags + '</div>' +
      '<div class="card-meta">' + texturesInfo + filesInfo + '</div>' +
      '</div>' +
      '<div class="card-actions">' +
      '<button class="btn btn-sm btn-glow" onclick="App.previewModel(\'' + escapeHtml(model.name) + '\')">预览</button>' +
      '<button class="btn btn-sm btn-outline" onclick="App.viewDetail(\'' + escapeHtml(model.name) + '\')">详情</button>' +
      '<button class="btn btn-sm btn-outline" onclick="App.editModel(\'' + escapeHtml(model.name) + '\', \'' + escapeHtml(model.message || '') + '\')">编辑</button>' +
      '<button class="btn btn-sm btn-code" onclick="App.generateCode(\'' + escapeHtml(model.name) + '\')">生成代码</button>' +
      '<button class="btn btn-sm btn-danger-outline" onclick="App.confirmDelete(\'' + escapeHtml(model.name) + '\')">删除</button>' +
      '</div>' +
      '</div>';
  }

  function renderModelGrid(models) {
    var html = '';
    for (var i = 0; i < models.length; i++) {
      html += renderModelCard(models[i]);
    }
    return html;
  }

  function renderDetailFiles(files) {
    if (!files || files.length === 0) return '<p class="empty-text">未找到文件</p>';
    var html = '<div class="file-list">';
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var ext = f.name.split('.').pop().toLowerCase();
      var icon = 'file';
      if (ext === 'png' || ext === 'jpg') icon = 'image';
      else if (ext === 'json') icon = 'code';
      else if (ext === 'moc') icon = 'box';
      else if (ext === 'mtn') icon = 'play';

      var iconSvg = {
        file: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>',
        image: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
        code: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
        box: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>',
        play: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
      };

      html += '<div class="file-item">' +
        '<span class="file-icon">' + (iconSvg[icon] || iconSvg.file) + '</span>' +
        '<span class="file-name">' + escapeHtml(f.name) + '</span>' +
        '<span class="file-size">' + formatSize(f.size) + '</span>' +
        '</div>';
    }
    html += '</div>';
    return html;
  }

  function renderDetailConfig(config) {
    if (!config) return '<p class="empty-text">未找到配置</p>';
    return '<pre class="config-json"><code>' + escapeHtml(JSON.stringify(config, null, 2)) + '</code></pre>';
  }

  function renderDetailTextures(textures) {
    if (!textures || textures.length === 0) return '<p class="empty-text">无纹理</p>';
    var html = '<div class="texture-grid">';
    for (var i = 0; i < textures.length; i++) {
      html += '<div class="texture-item">' +
        '<span class="texture-name">' + escapeHtml(textures[i]) + '</span>' +
        '</div>';
    }
    html += '</div>';
    return html;
  }

  function renderDetailMotions(motions) {
    if (!motions) return '<p class="empty-text">无动作</p>';
    var keys = Object.keys(motions);
    if (keys.length === 0) return '<p class="empty-text">无动作</p>';
    var html = '<div class="motion-groups">';
    for (var i = 0; i < keys.length; i++) {
      var group = keys[i];
      var list = motions[group];
      html += '<div class="motion-group"><h4>' + escapeHtml(group) + ' <span class="count">(' + list.length + ')</span></h4><div class="motion-list">';
      for (var j = 0; j < list.length; j++) {
        html += '<span class="motion-item">' + escapeHtml(list[j].file || '') + '</span>';
      }
      html += '</div></div>';
    }
    html += '</div>';
    return html;
  }

  function renderGroupItem(group, activeGroup) {
    var isActive = group.name === activeGroup;
    return '<div class="sidebar-group-item' + (isActive ? ' active' : '') + '" data-group="' + escapeHtml(group.name) + '" onclick="App.filterGroup(\'' + escapeHtml(group.name) + '\')">' +
      '<span class="group-name">' + escapeHtml(group.name) + '</span>' +
      '<span class="group-count">' + group.model_count + '</span>' +
      '</div>';
  }

  function showLoading(container) {
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>加载中...</p></div>';
  }

  function showEmpty(container, message) {
    container.innerHTML = '<div class="empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><p>' + escapeHtml(message || '暂无数据') + '</p></div>';
  }

  return {
    escapeHtml: escapeHtml,
    formatSize: formatSize,
    toast: toast,
    overlay: overlay,
    openModal: openModal,
    closeModal: closeModal,
    renderModelCard: renderModelCard,
    renderModelGrid: renderModelGrid,
    renderDetailFiles: renderDetailFiles,
    renderDetailConfig: renderDetailConfig,
    renderDetailTextures: renderDetailTextures,
    renderDetailMotions: renderDetailMotions,
    renderGroupItem: renderGroupItem,
    showLoading: showLoading,
    showEmpty: showEmpty,
  };
})();
