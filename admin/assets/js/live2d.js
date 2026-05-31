var Live2DPreview = (function () {
  var canvas2 = null;
  var canvas4 = null;
  var currentModel = null;
  var currentTextureId = 0;
  var panelOpen = false;
  var pixiApp = null;
  var pixiModel = null;

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
    showCanvas2();
    removeFallback();
    hideLoadingIndicator();
    currentModel = null;
    currentTextureId = 0;
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
    currentTextureId = 0;
    openPanel();
    removeFallback();
    destroyPixi();

    var modelInfo = document.getElementById('preview-model-name');
    if (modelInfo) modelInfo.textContent = modelName;

    if (isCubism4) {
      loadModel4(modelName);
    } else {
      loadModel2(modelName);
    }
  }

  function loadModel2(modelName) {
    destroyPixi();
    showCanvas2();
    removeFallback();

    if (typeof loadlive2d !== 'function') {
      showFallback('缺少 Live2D Cubism 2 库');
      return;
    }
    var url = '../model/' + encodePath(modelName) + '/index.json';
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
    showLoadingIndicator(true);

    PIXI.live2d.Live2DModel.from(modelUrl)
      .then(function (model) {
        hideLoadingIndicator();
        pixiModel = model;

        var sw = pixiApp.screen.width;
        var sh = pixiApp.screen.height;
        var origW = model.width;
        var origH = model.height;
        var scale = Math.min(sw / origW * 0.85, sh / origH * 0.85);
        model.scale.set(scale);
        model.x = (sw - origW * scale) / 2;
        model.y = (sh - origH * scale) / 2;

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
      })
      .catch(function (e) {
        hideLoadingIndicator();
        showFallback('Cubism 4 模型加载失败: ' + (e.message || e));
      });
  }

  function findModel4Config(modelName) {
    var parts = modelName.split('/');
    var last = parts[parts.length - 1];
    return last + '.model3.json';
  }

  function showLoadingIndicator(show) {
    var container = document.getElementById('preview-canvas-wrap');
    if (!container) return;
    var el = container.querySelector('.pixi-loading');
    if (show) {
      if (!el) {
        el = document.createElement('div');
        el.className = 'pixi-loading';
        el.innerHTML = '<div class="spinner"></div><p>加载 Cubism 4 模型中...</p>';
        container.appendChild(el);
      }
      el.style.display = 'flex';
    } else if (el) {
      el.style.display = 'none';
    }
  }

  function hideLoadingIndicator() {
    var container = document.getElementById('preview-canvas-wrap');
    if (!container) return;
    var el = container.querySelector('.pixi-loading');
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
      '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:8px"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="m7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 7h5M17 17h5"/></svg>' +
      '<p style="font-size:14px;color:var(--text-secondary)">Live2D 预览</p>' +
      '<p class="small">模型: ' + UI.escapeHtml(currentModel || '') + '</p>' +
      (msg ? '<p class="small" style="margin-top:8px;color:var(--accent-orange)">' + UI.escapeHtml(msg) + '</p>' : '');
  }

  function removeFallback() {
    var container = document.getElementById('preview-canvas-wrap');
    if (!container) return;
    var el = container.querySelector('.fallback-msg');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function loadModelById(modelId, textureId) {
    if (!canvas2) init();
    if (!canvas2) return;

    textureId = textureId || 0;
    currentTextureId = textureId;
    currentModel = null;
    openPanel();
    destroyPixi();
    removeFallback();
    showCanvas2();

    var modelInfo = document.getElementById('preview-model-name');
    if (modelInfo) modelInfo.textContent = '模型 #' + modelId;

    if (typeof loadlive2d === 'function') {
      try {
        loadlive2d('live2d-canvas', '../model/' + encodePath(modelName) + '/index.json');
      } catch (e) {
        UI.toast('Live2D 加载错误: ' + e.message, 'error');
        showFallback('Cubism 2 加载失败');
      }
    } else {
      showFallback('缺少 Live2D 库');
    }
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

    currentTextureId++;
    var url = '../model/' + encodePath(currentModel) + '/index.json';

    if (typeof loadlive2d === 'function') {
      try {
        loadlive2d('live2d-canvas', url);
      } catch (e) {
        currentTextureId = 0;
        loadlive2d('live2d-canvas', '../model/' + encodePath(currentModel) + '/index.json');
        UI.toast('已回到首个纹理', 'info');
      }
    } else {
      UI.toast('Live2D 库未加载', 'info');
    }
  }

  function isOpen() {
    return panelOpen;
  }

  return {
    init: init,
    loadModel: loadModel,
    loadModelById: loadModelById,
    closePanel: closePanel,
    switchTexture: switchTexture,
    isOpen: isOpen,
  };
})();
