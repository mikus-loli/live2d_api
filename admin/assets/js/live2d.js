var Live2DPreview = (function () {
  var canvas2 = null;
  var canvas4 = null;
  var currentModel = null;
  var currentSkinId = 0;
  var panelOpen = false;
  var pixiApp = null;
  var pixiModel = null;
  var skinsData = { count: 0, list: [], loaded: {} };
  var preloadQueue = [];
  var isSwitching = false;

  function encodePath(name) {
    return name.split('/').map(encodeURIComponent).join('/');
  }

  function init() {
    canvas2 = document.getElementById('live2d-canvas');
  }

  function openPanel() {
    var panel = document.getElementById('preview-panel');
    if (panel) {
      panel.classList.add('open');
      panelOpen = true;
    }
  }

  function closePanel() {
    var panel = document.getElementById('preview-panel');
    if (panel) {
      panel.classList.remove('open');
      panelOpen = false;
    }
    destroyPixi();
    destroyCanvas2();
    removeFallback();
    hideLoading();
    clearSkinsData();
    currentModel = null;
    currentSkinId = 0;
  }

  function destroyCanvas2() {
    if (canvas2) {
      var parent = canvas2.parentNode;
      if (parent) parent.removeChild(canvas2);
      canvas2 = null;
    }
    var wrap = document.getElementById('preview-canvas-wrap');
    if (wrap) {
      var newCanvas = document.createElement('canvas');
      newCanvas.id = 'live2d-canvas';
      newCanvas.width = 480;
      newCanvas.height = 600;
      wrap.insertBefore(newCanvas, wrap.firstChild);
      canvas2 = newCanvas;
    }
  }

  function clearSkinsData() {
    skinsData = { count: 0, list: [], loaded: {} };
    preloadQueue = [];
    isSwitching = false;
    updateSkinSelector();
  }

  function destroyPixi() {
    if (pixiApp) {
      try { pixiApp.destroy(true, { children: true, texture: true }); } catch (e) {}
      pixiApp = null;
      pixiModel = null;
    }
    if (canvas4) {
      try {
        if (canvas4.parentNode) canvas4.parentNode.removeChild(canvas4);
      } catch (e) {}
      canvas4 = null;
    }
    showCanvas2();
  }

  function showCanvas2() {
    if (canvas2) canvas2.style.display = '';
  }

  function hideCanvas2() {
    if (canvas2) canvas2.style.display = 'none';
  }

  function loadModel(modelName, isCubism4) {
    if (!canvas2) init();
    if (!canvas2) return;

    currentModel = modelName;
    currentSkinId = 0;
    openPanel();
    removeFallback();
    destroyPixi();

    var modelInfo = document.getElementById('preview-model-name');
    if (modelInfo) modelInfo.textContent = modelName;

    if (isCubism4) {
      loadModel4(modelName);
    } else {
      fetchSkinsList(modelName);
    }
  }

  function loadModel2(modelName, skinId) {
    destroyPixi();
    showCanvas2();
    removeFallback();

    if (typeof loadlive2d !== 'function') {
      showFallback('缺少 Live2D Cubism 2 库');
      return;
    }

    var wrap = document.getElementById('preview-canvas-wrap');
    if (wrap && canvas2) {
      var dpr = window.devicePixelRatio || 1;
      var displayW = wrap.clientWidth;
      var displayH = wrap.clientHeight;
      canvas2.width = displayW * dpr;
      canvas2.height = displayH * dpr;
      canvas2.style.width = displayW + 'px';
      canvas2.style.height = displayH + 'px';
    }

    var url;
    if (skinId && skinId > 0) {
      url = '../model/' + encodePath(modelName) + '/config-' + skinId + '.json';
      currentSkinId = skinId;
    } else {
      url = '../model/' + encodePath(modelName) + '/index.json';
      currentSkinId = 0;
    }

    try {
      loadlive2d('live2d-canvas', url);
    } catch (e) {
      UI.toast('Live2D 加载错误: ' + e.message, 'error');
      showFallback('Cubism 2 加载失败');
    }
  }

  function loadModel4(modelName) {
    if (typeof PIXI === 'undefined' || !PIXI.live2d) {
      showFallback('缺少 PixiJS Live2D 库，无法预览 Cubism 4 模型');
      return;
    }

    var wrap = document.getElementById('preview-canvas-wrap');
    if (!wrap) return;

    destroyPixi();
    hideCanvas2();
    removeFallback();

    canvas4 = document.createElement('canvas');
    wrap.appendChild(canvas4);

    try {
      pixiApp = new PIXI.Application({
        view: canvas4,
        resizeTo: wrap,
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
    } catch (e) {
      showFallback('PixiJS 初始化失败: ' + e.message);
      return;
    }

    var modelUrl = '../model/' + encodePath(modelName) + '/' + encodeURIComponent(findModel4Config(modelName));
    showLoading('加载 Cubism 4 模型...');

    PIXI.live2d.Live2DModel.from(modelUrl)
      .then(function (model) {
        hideLoading();
        pixiModel = model;

        var sw = pixiApp.screen.width;
        var sh = pixiApp.screen.height;

        model.anchor.set(0.5, 0.5);
        model.x = sw / 2;
        model.y = sh / 2;

        var origW = model.width / model.scale.x;
        var origH = model.height / model.scale.y;
        var scale = Math.min(sw / origW, sh / origH);
        model.scale.set(scale);

        pixiApp.stage.addChild(model);

        if (canvas4) {
          canvas4.addEventListener('pointermove', function (e) {
            if (!pixiModel) return;
            var rect = canvas4.getBoundingClientRect();
            var cx = e.clientX - rect.left;
            var cy = e.clientY - rect.top;
            pixiModel.focus(cx, cy);
          });
          canvas4.addEventListener('pointerleave', function () {
            if (pixiModel) pixiModel.focus(0, 0);
          });
        }

        updateSkinSelectorForCubism4();
      })
      .catch(function (e) {
        hideLoading();
        showFallback('Cubism 4 模型加载失败: ' + (e.message || e));
      });
  }

  function findModel4Config(modelName) {
    var parts = modelName.split('/');
    var last = parts[parts.length - 1];
    return last + '.model3.json';
  }

  function fetchSkinsList(modelName) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '../admin/api/skins?model_name=' + encodeURIComponent(modelName), true);
    xhr.onload = function () {
      if (xhr.status === 200) {
        try {
          var resp = JSON.parse(xhr.responseText);
          if (resp.success && resp.data) {
            skinsData.count = resp.data.skins_count;
            skinsData.list = resp.data.skins || [];
            if (skinsData.count > 0) {
              currentSkinId = 1;
              loadModel2(modelName, 1);
            } else {
              loadModel2(modelName, 0);
            }
            updateSkinSelector();
            if (skinsData.count > 1) {
              preloadAdjacentSkins(1);
            }
          }
        } catch (e) {
          loadModel2(modelName, 0);
        }
      } else {
        loadModel2(modelName, 0);
      }
    };
    xhr.onerror = function () {
      loadModel2(modelName, 0);
    };
    xhr.send();
  }

  function updateSkinSelector() {
    var container = document.getElementById('skin-selector');
    if (!container) return;

    if (skinsData.count <= 1) {
      container.innerHTML = '<span class="skin-info">无可切换皮肤</span>';
      return;
    }

    var displayId = currentSkinId || 1;
    var html = '<select id="skin-dropdown" onchange="Live2DPreview.selectSkin(this.value)">';
    for (var i = 0; i < skinsData.list.length; i++) {
      var skin = skinsData.list[i];
      var selected = (skin.id === displayId) ? ' selected' : '';
      html += '<option value="' + skin.id + '"' + selected + '>' + skin.name + '</option>';
    }
    html += '</select>';
    html += '<span class="skin-count">' + displayId + ' / ' + skinsData.count + '</span>';
    html += '<button class="skin-prev" onclick="Live2DPreview.prevSkin()">◀</button>';
    html += '<button class="skin-next" onclick="Live2DPreview.nextSkin()">▶</button>';
    container.innerHTML = html;
  }

  function updateSkinSelectorForCubism4() {
    var container = document.getElementById('skin-selector');
    if (!container) return;
    container.innerHTML = '<span class="skin-info">Cubism 4 模型皮肤切换暂不支持</span>';
  }

  function selectSkin(skinId) {
    if (isSwitching || !currentModel) return;
    skinId = parseInt(skinId, 10);
    if (skinId < 1 || skinId > skinsData.count) return;
    if (skinId === currentSkinId) return;

    currentSkinId = skinId;
    loadSkinConfig(skinId);
    preloadAdjacentSkins(skinId);
  }

  function prevSkin() {
    if (skinsData.count <= 1) return;
    var newId = currentSkinId - 1;
    if (newId < 1) newId = skinsData.count;
    selectSkin(newId);
  }

  function nextSkin() {
    if (skinsData.count <= 1) return;
    var newId = currentSkinId + 1;
    if (newId > skinsData.count) newId = 1;
    selectSkin(newId);
  }

  function loadSkinConfig(skinId) {
    if (typeof loadlive2d !== 'function') return;

    isSwitching = true;

    var url = '../model/' + encodePath(currentModel) + '/config-' + skinId + '.json';

    try {
      loadlive2d('live2d-canvas', url);
      hideLoading();
      isSwitching = false;
      updateSkinSelector();
      UI.toast('皮肤 ' + skinId, 'info');
    } catch (e) {
      hideLoading();
      isSwitching = false;
      UI.toast('切换失败: ' + e.message, 'error');
    }
  }

  function preloadAdjacentSkins(currentId) {
    if (skinsData.count <= 1) return;

    var preloadIds = [];
    if (currentId > 1) preloadIds.push(currentId - 1);
    if (currentId < skinsData.count) preloadIds.push(currentId + 1);

    preloadIds.forEach(function (id) {
      if (skinsData.loaded[id]) return;
      preloadSkinTextures(id);
    });
  }

  function preloadSkinTextures(skinId) {
    var skin = skinsData.list.find(function (s) { return s.id === skinId; });
    if (!skin || !skin.textures) return;

    skin.textures.forEach(function (texPath) {
      var img = new Image();
      img.src = '../model/' + encodePath(currentModel) + '/' + encodePath(texPath);
      img.onload = function () {
        skinsData.loaded[skinId] = true;
      };
    });
  }

  function switchTexture() {
    if (!currentModel) {
      UI.toast('未加载模型', 'info');
      return;
    }

    if (pixiModel) {
      UI.toast('Cubism 4 模型纹理切换暂不支持', 'info');
      return;
    }

    if (skinsData.count <= 1) {
      UI.toast('此模型无可切换皮肤', 'info');
      return;
    }

    nextSkin();
  }

  function showLoading(msg) {
    var el = document.getElementById('preview-loading');
    if (!el) {
      var container = document.getElementById('preview-canvas-wrap');
      if (!container) return;
      el = document.createElement('div');
      el.id = 'preview-loading';
      el.className = 'preview-loading';
      el.innerHTML = '<div class="spinner"></div><p class="loading-text"></p>';
      container.appendChild(el);
    }
    var textEl = el.querySelector('.loading-text');
    if (textEl) textEl.textContent = msg || '加载中...';
    el.style.display = 'flex';
  }

  function hideLoading() {
    var el = document.getElementById('preview-loading');
    if (el) el.style.display = 'none';
  }

  function showFallback(msg) {
    var container = document.getElementById('preview-canvas-wrap');
    if (!container) return;

    destroyPixi();
    showCanvas2();

    var fallback = container.querySelector('.fallback-msg');
    if (!fallback) {
      fallback = document.createElement('div');
      fallback.className = 'fallback-msg';
      container.appendChild(fallback);
    }
    fallback.innerHTML =
      '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:8px"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M7 2v20M17 2v20M2 7h20M2 17h5M17 17h5M7 7h5M17 7h5"/></svg>' +
      '<p style="font-size:14px;color:var(--text-secondary)">Live2D 预览</p>' +
      '<p class="small">模型: ' + UI.escapeHtml(currentModel || '') + '</p>' +
      (msg ? '<p class="error" style="margin-top:8px;color:var(--accent-orange)">' + UI.escapeHtml(msg) + '</p>' : '');
  }

  function removeFallback() {
    var container = document.getElementById('preview-canvas-wrap');
    if (!container) return;
    var el = container.querySelector('.fallback-msg');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function isOpen() {
    return panelOpen;
  }

  return {
    init: init,
    loadModel: loadModel,
    closePanel: closePanel,
    switchTexture: switchTexture,
    selectSkin: selectSkin,
    prevSkin: prevSkin,
    nextSkin: nextSkin,
    isOpen: isOpen,
    getSkinsData: function () { return skinsData; },
  };
})();