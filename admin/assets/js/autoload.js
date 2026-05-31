(function () {
  if (window.__live2d_widget_loaded) return;
  window.__live2d_widget_loaded = true;

  var settings = {
    apiBase: '',
    modelId: 0,
    width: 280,
    height: 250,
    position: 'right',
    tipDuration: 5000,
    draggable: true,
  };

  var modelList = [];
  var currentIdx = 0;
  var isCubism4 = false;

  function mergeSettings(opts) {
    for (var k in opts) {
      if (opts.hasOwnProperty(k)) settings[k] = opts[k];
    }
  }

  function loadScript(url, cb) {
    var s = document.createElement('script');
    s.src = url;
    s.onload = cb;
    s.onerror = function () { if (cb) cb(new Error('Failed to load ' + url)); };
    document.head.appendChild(s);
  }

  function loadScriptsChain(urls, cb) {
    var i = 0;
    function next() {
      if (i >= urls.length) return cb();
      loadScript(urls[i], function (err) {
        if (err) return cb(err);
        i++;
        next();
      });
    }
    next();
  }

  function injectCSS() {
    var css = document.createElement('style');
    css.textContent =
      '.lw-wrap{position:fixed;bottom:0;z-index:99999;font-size:0;transition:transform .3s ease}' +
      '.lw-wrap.lw-left{left:0}.lw-wrap.lw-right{right:0}' +
      '.lw-wrap:hover{transform:translateY(0)!important}' +
      '.lw-wrap.lw-hidden{display:none}' +
      '.lw-canvas{position:relative;cursor:grab}' +
      '.lw-canvas:active{cursor:grabbing}' +
      '.lw-tip{opacity:0;min-height:60px;margin:-20px 20px;padding:8px 14px;border:1px solid rgba(224,186,140,.62);border-radius:12px;background:rgba(236,217,188,.5);box-shadow:0 3px 15px 2px rgba(191,158,118,.2);font-size:13px;color:#6a5e50;overflow:hidden;text-overflow:ellipsis;transition:opacity .3s;line-height:1.5}' +
      '.lw-tip.lw-show{opacity:1}' +
      '.lw-toolbar{display:none;position:absolute;top:5px;right:8px;gap:6px;flex-direction:column}' +
      '.lw-wrap:hover .lw-toolbar{display:flex}' +
      '.lw-btn{width:28px;height:28px;border-radius:50%;border:1px solid rgba(150,140,130,.3);background:rgba(255,255,255,.7);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;color:#7a6e62;transition:all .2s}' +
      '.lw-btn:hover{background:rgba(255,255,255,.95);color:#4a3e32;border-color:rgba(150,140,130,.6)}' +
      '.lw-btn svg{width:14px;height:14px;pointer-events:none}';
    document.head.appendChild(css);
  }

  function createWidget() {
    var wrap = document.createElement('div');
    wrap.className = 'lw-wrap lw-' + settings.position;
    wrap.style.transform = 'translateY(3px)';

    var tip = document.createElement('div');
    tip.className = 'lw-tip';

    var canvas = document.createElement('canvas');
    canvas.className = 'lw-canvas';
    canvas.id = 'live2d-widget';
    canvas.width = settings.width;
    canvas.height = settings.height;

    var toolbar = document.createElement('div');
    toolbar.className = 'lw-toolbar';

    var btns = [
      { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>', title: '切换模型', action: switchModel },
      { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>', title: '切换服装', action: switchTexture },
      { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>', title: '关闭', action: closeWidget },
    ];

    btns.forEach(function (b) {
      var btn = document.createElement('button');
      btn.className = 'lw-btn';
      btn.title = b.title;
      btn.innerHTML = b.icon;
      btn.onclick = function (e) { e.stopPropagation(); b.action(); };
      toolbar.appendChild(btn);
    });

    wrap.appendChild(tip);
    wrap.appendChild(canvas);
    wrap.appendChild(toolbar);
    document.body.appendChild(wrap);

    if (settings.draggable) makeDraggable(wrap);

    return { wrap: wrap, tip: tip, canvas: canvas };
  }

  var tipTimer = null;
  function showTip(text, duration) {
    var tip = document.querySelector('.lw-tip');
    if (!tip) return;
    tip.textContent = text;
    tip.classList.add('lw-show');
    clearTimeout(tipTimer);
    tipTimer = setTimeout(function () {
      tip.classList.remove('lw-show');
    }, duration || settings.tipDuration);
  }

  function closeWidget() {
    var wrap = document.querySelector('.lw-wrap');
    if (wrap) wrap.classList.add('lw-hidden');
    showTip('再见~ (刷新页面可重新显示)', 3000);
  }

  function makeDraggable(el) {
    var dragging = false, startX, startY, origX, origY;

    el.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.lw-btn') || e.target.closest('.lw-toolbar')) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      var rect = el.getBoundingClientRect();
      origX = rect.left;
      origY = rect.top;
      el.style.transition = 'none';
      el.setPointerCapture(e.pointerId);
    });

    el.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      el.style.left = (origX + dx) + 'px';
      el.style.top = (origY + dy) + 'px';
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    });

    el.addEventListener('pointerup', function () {
      dragging = false;
      el.style.transition = '';
    });
  }

  function fetchModelList(cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', settings.apiBase + '/api/models');
    xhr.onload = function () {
      try {
        var res = JSON.parse(xhr.responseText);
        if (res.success && res.data) {
          modelList = res.data;
          cb(null);
        } else {
          cb(new Error('No models'));
        }
      } catch (e) {
        cb(e);
      }
    };
    xhr.onerror = function () { cb(new Error('Network error')); };
    xhr.send();
  }

  function switchModel() {
    if (modelList.length === 0) return;
    currentIdx = (currentIdx + 1) % modelList.length;
    localStorage.setItem('live2d-widget-idx', currentIdx);
    loadCurrentModel();
  }

  function switchTexture() {
    var model = modelList[currentIdx];
    if (!model || !model.is_multi || !model.sub_models || model.sub_models.length <= 1) {
      showTip('当前模型没有更多服装');
      return;
    }
    var subIdx = parseInt(localStorage.getItem('live2d-widget-subidx') || '0', 10);
    subIdx = (subIdx + 1) % model.sub_models.length;
    localStorage.setItem('live2d-widget-subidx', subIdx);
    loadCurrentModel();
  }

  function loadCurrentModel() {
    var model = modelList[currentIdx];
    if (!model) return;

    var modelName;
    if (model.is_multi && model.sub_models && model.sub_models.length > 0) {
      var subIdx = parseInt(localStorage.getItem('live2d-widget-subidx') || '0', 10);
      if (subIdx >= model.sub_models.length) subIdx = 0;
      modelName = model.sub_models[subIdx].name;
      showTip('当前: ' + model.sub_models[subIdx].name);
    } else {
      modelName = model.name;
      showTip('当前: ' + model.name);
    }

    isCubism4 = !model.has_moc;

    var canvas = document.getElementById('live2d-widget');
    if (!canvas) return;

    if (isCubism4) {
      loadCubism4Model(modelName, canvas);
    } else {
      loadCubism2Model(modelName, canvas);
    }
  }

  function loadCubism2Model(modelName, canvas) {
    if (typeof loadlive2d === 'function') {
      loadlive2d('live2d-widget', settings.apiBase + '/model/' + encodeURIComponent(modelName) + '/index.json');
    } else {
      loadScript(settings.apiBase + '/live2d.min.js', function () {
        loadlive2d('live2d-widget', settings.apiBase + '/model/' + encodeURIComponent(modelName) + '/index.json');
      });
    }
  }

  var pixiApp = null;
  function loadCubism4Model(modelName, canvas) {
    var modelLast = modelName.split('/').pop();

    function init4() {
      if (pixiApp) {
        pixiApp.destroy(true);
        pixiApp = null;
      }
      canvas.width = settings.width;
      canvas.height = settings.height;
      pixiApp = new PIXI.Application({
        view: canvas,
        width: settings.width,
        height: settings.height,
        backgroundAlpha: 0,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      });
      var modelUrl = settings.apiBase + '/model/' + encodeURIComponent(modelName) + '/' + encodeURIComponent(modelLast) + '.model3.json';
      PIXI.live2d.Live2DModel.from(modelUrl).then(function (m) {
        var sc = Math.min(settings.width / m.width * 0.85, settings.height / m.height * 0.85);
        m.scale.set(sc);
        m.x = settings.width / 2;
        m.y = settings.height / 2;
        pixiApp.stage.addChild(m);
        canvas.addEventListener('pointermove', function (e) {
          var r = canvas.getBoundingClientRect();
          m.focus(e.clientX - r.left, e.clientY - r.top);
        });
        canvas.addEventListener('pointerleave', function () { m.focus(0, 0); });
      }).catch(function (err) {
        showTip('模型加载失败: ' + err.message);
      });
    }

    if (typeof PIXI !== 'undefined' && PIXI.live2d) {
      init4();
    } else {
      loadScriptsChain([
        settings.apiBase + '/live2dcubismcore.min.js',
        settings.apiBase + '/pixi.min.js',
        settings.apiBase + '/cubism4.min.js',
      ], function (err) {
        if (err) { showTip('Cubism 4 库加载失败'); return; }
        init4();
      });
    }
  }

  function init(opts) {
    if (opts) mergeSettings(opts);
    if (!settings.apiBase) {
      console.error('[Live2D Widget] apiBase is required');
      return;
    }

    injectCSS();
    createWidget();

    fetchModelList(function (err) {
      if (err) {
        showTip('模型列表加载失败');
        return;
      }
      if (modelList.length === 0) {
        showTip('暂无可用模型');
        return;
      }

      var savedIdx = parseInt(localStorage.getItem('live2d-widget-idx') || '0', 10);
      if (savedIdx >= 0 && savedIdx < modelList.length) currentIdx = savedIdx;

      loadCurrentModel();
    });
  }

  window.live2dWidget = { init: init };
})();
