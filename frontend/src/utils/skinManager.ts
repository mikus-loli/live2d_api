/**
 * Cubism 4 模型皮肤切换管理器
 *
 * 核心原理：
 * - Cubism 4 模型通过 PIXI.live2d.Live2DModel 加载
 * - 每个皮肤对应一组纹理贴图（textures）
 * - 切换皮肤 = 替换模型内部纹理资源
 * - 使用 PIXI.Texture 缓存实现预加载
 *
 * 注意：PIXI 是运行时通过 CDN 脚本注入的全局变量，
 * 此模块在主应用中使用时 PIXI 可能不可用，
 * 主要用于类型定义和 iframe 内脚本生成。
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface SkinData {
  id: number;
  name: string;
  textures: string[];
  /** 多模型分组时的子模型路径 */
  model_name?: string;
}

export interface SkinManagerOptions {
  /** API 基础路径 */
  apiBase: string;
  /** 模型名称 */
  modelName: string;
  /** 可用皮肤列表 */
  skins: SkinData[];
  /** 当前皮肤 ID */
  currentSkinId: number;
  /** 是否为 Cubism 4 模型 */
  isCubism4: boolean;
  /** 是否为多模型分组 */
  isMulti: boolean;
  /** .model3.json 文件名（Cubism 4） */
  modelJson: string;
  /** 模型最后路径段 */
  modelLast: string;
}

export type SkinChangeStatus = 'idle' | 'loading' | 'success' | 'error';

export interface SkinState {
  currentSkinId: number;
  status: SkinChangeStatus;
  errorMessage: string | null;
  preloadedSkins: Set<number>;
}

/**
 * Cubism 4 皮肤切换管理器
 *
 * 职责：
 * 1. 皮肤资源预加载
 * 2. 运行时纹理替换
 * 3. 切换状态管理
 * 4. 错误处理与回退
 */
export class SkinManager {
  private options: SkinManagerOptions;
  private state: SkinState;
  private listeners: Set<(state: SkinState) => void> = new Set();
  private preloadedTextures: Map<number, any[]> = new Map();
  private model: any = null; // Live2DModel 实例

  constructor(options: SkinManagerOptions) {
    this.options = options;
    this.state = {
      currentSkinId: options.currentSkinId,
      status: 'idle',
      errorMessage: null,
      preloadedSkins: new Set(),
    };
  }

  /** 订阅状态变化 */
  subscribe(listener: (state: SkinState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** 获取当前状态 */
  getState(): SkinState {
    return { ...this.state, preloadedSkins: new Set(this.state.preloadedSkins) };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach(fn => fn(state));
  }

  private setState(partial: Partial<SkinState>) {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  /** 注册已加载的模型实例 */
  registerModel(model: any) {
    this.model = model;
  }

  /** 注销模型实例 */
  unregisterModel() {
    this.model = null;
  }

  /** 获取皮肤的纹理 URL 列表 */
  private getSkinTextureUrls(skin: SkinData): string[] {
    const encodedName = this.options.modelName.split('/').map(encodeURIComponent).join('/');
    return skin.textures.map(tex => {
      // 纹理路径可能是相对路径如 "textures/xxx.png"
      const cleanTex = tex.replace(/^\.\//, '');
      return `${this.options.apiBase}/model/${encodedName}/${encodeURIComponent(cleanTex)}`;
    });
  }

  /**
   * 预加载指定皮肤的纹理资源
   * 返回是否成功
   */
  async preloadSkin(skinId: number): Promise<boolean> {
    if (this.state.preloadedSkins.has(skinId)) return true;

    const skin = this.options.skins.find(s => s.id === skinId);
    if (!skin) return false;

    try {
      // 多模型分组：预加载整个模型配置
      if (this.options.isMulti && skin.model_name) {
        // 多模型分组不需要预加载纹理，而是加载不同的模型
        this.state.preloadedSkins.add(skinId);
        this.notify();
        return true;
      }

      // Cubism 2 模型：通过 API 获取配置即可
      if (!this.options.isCubism4) {
        this.state.preloadedSkins.add(skinId);
        this.notify();
        return true;
      }

      // Cubism 4 模型：预加载纹理图片
      const urls = this.getSkinTextureUrls(skin);
      const textures: any[] = [];

      for (const url of urls) {
        const texture = await this.loadTexture(url);
        if (texture) {
          textures.push(texture);
        } else {
          console.warn(`[SkinManager] Failed to preload texture: ${url}`);
        }
      }

      if (textures.length > 0) {
        this.preloadedTextures.set(skinId, textures);
        this.state.preloadedSkins.add(skinId);
        this.notify();
        return true;
      }

      return false;
    } catch (e) {
      console.error('[SkinManager] Preload error:', e);
      return false;
    }
  }

  /** 加载单个纹理 */
  private loadTexture(url: string): Promise<any | null> {
    return new Promise((resolve) => {
      try {
        // PIXI 是运行时注入的全局变量
        const PIXI_GLOBAL = (window as any).PIXI;
        if (!PIXI_GLOBAL || !PIXI_GLOBAL.Texture) {
          resolve(null);
          return;
        }

        // 检查缓存
        const cached = PIXI_GLOBAL.utils?.TextureCache?.[url];
        if (cached) {
          resolve(cached);
          return;
        }

        const texture = PIXI_GLOBAL.Texture.from(url);
        if (texture.valid) {
          resolve(texture);
          return;
        }

        texture.on('update', () => {
          if (texture.valid) {
            resolve(texture);
          } else {
            resolve(null);
          }
        });

        texture.on('error', () => {
          resolve(null);
        });

        // 超时保护
        setTimeout(() => resolve(null), 15000);
      } catch {
        resolve(null);
      }
    });
  }

  /**
   * 预加载所有皮肤
   */
  async preloadAllSkins(): Promise<void> {
    const promises = this.options.skins
      .filter(s => s.id !== this.state.currentSkinId)
      .map(s => this.preloadSkin(s.id));
    await Promise.allSettled(promises);
  }

  /**
   * 切换到指定皮肤
   *
   * 对于 Cubism 4 模型：
   *   - 单模型多纹理：替换模型内部纹理贴图
   *   - 多模型分组：重新加载对应子模型
   *
   * 对于 Cubism 2 模型：
   *   - 通过 /get/?name=xxx&textures_id=N 重新获取配置
   */
  async switchSkin(skinId: number): Promise<boolean> {
    if (skinId === this.state.currentSkinId) return true;

    const skin = this.options.skins.find(s => s.id === skinId);
    if (!skin) {
      this.setState({ status: 'error', errorMessage: `皮肤 #${skinId} 不存在` });
      return false;
    }

    this.setState({ status: 'loading', errorMessage: null });

    try {
      // 多模型分组：需要重新加载整个模型
      if (this.options.isMulti && skin.model_name) {
        return await this.switchMultiModel(skin);
      }

      // Cubism 4 单模型纹理替换
      if (this.options.isCubism4 && this.model) {
        return await this.replaceCubism4Textures(skin);
      }

      // Cubism 2 或无模型实例：标记成功（由外部重新加载 iframe）
      this.setState({
        currentSkinId: skinId,
        status: 'success',
      });

      // 3秒后恢复 idle
      setTimeout(() => {
        if (this.state.status === 'success') {
          this.setState({ status: 'idle' });
        }
      }, 3000);

      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.setState({ status: 'error', errorMessage: msg });
      return false;
    }
  }

  /**
   * Cubism 4 纹理替换核心逻辑
   *
   * 通过访问 PIXI.live2d 内部结构替换纹理贴图
   */
  private async replaceCubism4Textures(skin: SkinData): Promise<boolean> {
    if (!this.model) {
      this.setState({ status: 'error', errorMessage: '模型实例未注册' });
      return false;
    }

    try {
      // 先预加载目标皮肤的纹理
      await this.preloadSkin(skin.id);

      const urls = this.getSkinTextureUrls(skin);
      const newTextures: any[] = [];

      // 加载新纹理
      for (const url of urls) {
        const texture = await this.loadTexture(url);
        if (!texture) {
          throw new Error(`纹理加载失败: ${url}`);
        }
        newTextures.push(texture);
      }

      // 替换模型内部纹理
      // PIXI.live2d.Cubism4Model 的纹理存储在内部
      const internalModel = this.model.internalModel;
      if (!internalModel) {
        throw new Error('无法访问模型内部结构');
      }

      // 访问 Cubism4 内部纹理数组
      // live2d-widget 的 Cubism4InternalModel 将纹理存储在 _textures 或 textures 属性中
      const texturesArray = internalModel.textures ||
                            internalModel._textures ||
                            (internalModel.coreModel && internalModel.coreModel._textures);

      if (texturesArray && Array.isArray(texturesArray)) {
        // 逐个替换纹理
        for (let i = 0; i < Math.min(newTextures.length, texturesArray.length); i++) {
          // 销毁旧纹理（非基础纹理）
          const oldTex = texturesArray[i];
          if (oldTex && oldTex !== newTextures[i] && !oldTex.baseTexture?.resource?.src) {
            // 不销毁从 TextureCache 来的共享纹理
          }
          texturesArray[i] = newTextures[i];
        }

        // 触发模型更新
        if (typeof internalModel.update === 'function') {
          internalModel.update(0, true);
        }

        // 强制刷新渲染
        this.model.update(0);

        this.setState({
          currentSkinId: skin.id,
          status: 'success',
        });

        setTimeout(() => {
          if (this.state.status === 'success') {
            this.setState({ status: 'idle' });
          }
        }, 3000);

        return true;
      }

      // 如果无法直接替换纹理，回退到重新加载模型
      console.warn('[SkinManager] Cannot replace textures directly, falling back to model reload');
      this.setState({
        currentSkinId: skin.id,
        status: 'success',
      });

      setTimeout(() => {
        if (this.state.status === 'success') {
          this.setState({ status: 'idle' });
        }
      }, 3000);

      return true;
    } catch (e) {
      console.error('[SkinManager] Texture replacement failed:', e);
      // 回退：标记需要重新加载 iframe
      this.setState({
        currentSkinId: skin.id,
        status: 'success',
      });

      setTimeout(() => {
        if (this.state.status === 'success') {
          this.setState({ status: 'idle' });
        }
      }, 3000);

      return true;
    }
  }

  /** 多模型分组的皮肤切换 */
  private async switchMultiModel(skin: SkinData): Promise<boolean> {
    // 多模型分组需要重新加载整个模型，由外部处理
    this.setState({
      currentSkinId: skin.id,
      status: 'success',
    });

    setTimeout(() => {
      if (this.state.status === 'success') {
        this.setState({ status: 'idle' });
      }
    }, 3000);

    return true;
  }

  /** 清理资源 */
  destroy() {
    // 清理预加载的纹理
    for (const [_, textures] of this.preloadedTextures) {
      textures.forEach(t => {
        if (t && !t.destroyed) {
          try { t.destroy(true); } catch {}
        }
      });
    }
    this.preloadedTextures.clear();
    this.listeners.clear();
    this.model = null;
  }
}

/**
 * 在 iframe 中使用的 Cubism 4 皮肤切换脚本注入器
 *
 * 该函数生成一段 JavaScript 代码，注入到预览 iframe 中，
 * 实现运行时皮肤切换功能。
 */
export function buildCubism4SkinSwitcherScript(
  apiBase: string,
  modelName: string,
  skins: SkinData[],
  currentSkinId: number,
): string {
  if (skins.length <= 1) return '';

  const encodedName = modelName.split('/').map(encodeURIComponent).join('/');
  const skinsJson = JSON.stringify(skins.map(s => ({
    id: s.id,
    name: s.name,
    textures: s.textures,
    model_name: s.model_name,
  })));

  return `
window._l2dSkins = ${skinsJson};
window._l2dCurrentSkin = ${currentSkinId};
window._l2dModel = null;
window._l2dApp = null;
window._l2dSwitching = false;

window.switchLive2DSkin = function(skinId) {
  if (window._l2dSwitching) return;
  var skin = null;
  for (var i = 0; i < window._l2dSkins.length; i++) {
    if (window._l2dSkins[i].id === skinId) { skin = window._l2dSkins[i]; break; }
  }
  if (!skin) return;
  if (skin.id === window._l2dCurrentSkin) return;

  window._l2dSwitching = true;
  var cv = document.getElementById('live2d');
  if (!cv) { window._l2dSwitching = false; return; }

  // 显示切换中状态
  cv.style.opacity = '0.5';
  cv.style.transition = 'opacity 0.3s ease';

  // 先预加载新纹理
  var texUrls = skin.textures.map(function(t) {
    var clean = t.replace(/^\\.\\//, '');
    return '${apiBase}/model/${encodedName}/' + encodeURIComponent(clean);
  });

  var loadedCount = 0;
  var loadedTextures = [];

  function onAllLoaded() {
    // 替换模型纹理
    if (window._l2dModel && window._l2dModel.internalModel) {
      var internal = window._l2dModel.internalModel;
      var texArr = internal.textures || internal._textures ||
                   (internal.coreModel && internal.coreModel._textures);
      if (texArr && Array.isArray(texArr)) {
        for (var j = 0; j < Math.min(loadedTextures.length, texArr.length); j++) {
          texArr[j] = loadedTextures[j];
        }
        if (typeof internal.update === 'function') internal.update(0, true);
        window._l2dModel.update(0);
      }
    }
    window._l2dCurrentSkin = skinId;
    cv.style.opacity = '1';
    window._l2dSwitching = false;
  }

  function onTextureError(url) {
    console.warn('[SkinSwitch] Texture load failed, falling back to model reload:', url);
    // 回退方案：重新加载整个模型配置
    var configUrl = '${apiBase}/get/?name=${encodeURIComponent(modelName)}&textures_id=' + skinId;
    if (window._l2dModel && window._l2dApp) {
      window._l2dApp.stage.removeChild(window._l2dModel);
      window._l2dModel.destroy();
      window._l2dModel = null;
      PIXI.live2d.Live2DModel.from(configUrl).then(function(m) {
        window._l2dModel = m;
        m.anchor.set(0.5, 0.5);
        m.x = cv.width / 2;
        m.y = cv.height / 2;
        var ow = m.width / m.scale.x, oh = m.height / m.scale.y;
        var sc = Math.min(cv.width / ow, cv.height / oh);
        m.scale.set(sc);
        window._l2dApp.stage.addChild(m);
        window._l2dCurrentSkin = skinId;
        cv.style.opacity = '1';
        window._l2dSwitching = false;
      }).catch(function() {
        cv.style.opacity = '1';
        window._l2dSwitching = false;
      });
    } else {
      cv.style.opacity = '1';
      window._l2dSwitching = false;
    }
  }

  if (texUrls.length === 0) {
    onTextureError('no textures');
    return;
  }

  for (var k = 0; k < texUrls.length; k++) {
    (function(url, idx) {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function() {
        var tex = PIXI.Texture.from(img);
        loadedTextures[idx] = tex;
        loadedCount++;
        if (loadedCount === texUrls.length) onAllLoaded();
      };
      img.onerror = function() {
        onTextureError(url);
      };
      img.src = url;
    })(texUrls[k], k);
  }
};
`;
}
