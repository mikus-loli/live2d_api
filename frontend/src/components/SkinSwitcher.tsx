import { useState, useCallback } from 'react';
import { Loader2, Check, AlertCircle, Palette } from 'lucide-react';
import type { SkinData, SkinChangeStatus } from '@/utils/skinManager';

interface SkinSwitcherProps {
  /** 可用皮肤列表 */
  skins: SkinData[];
  /** 当前选中的皮肤 ID */
  currentSkinId: number;
  /** 切换状态 */
  switchStatus: SkinChangeStatus;
  /** 错误信息 */
  errorMessage: string | null;
  /** 是否为 Cubism 4 模型 */
  isCubism4: boolean;
  /** 皮肤切换回调 */
  onSkinChange: (skinId: number) => void;
  /** 预加载回调 */
  onPreload?: (skinId: number) => void;
}

export default function SkinSwitcher({
  skins,
  currentSkinId,
  switchStatus,
  errorMessage,
  isCubism4,
  onSkinChange,
  onPreload,
}: SkinSwitcherProps) {
  const [hoveredSkin, setHoveredSkin] = useState<number | null>(null);

  const handleSkinClick = useCallback((skinId: number) => {
    if (skinId === currentSkinId || switchStatus === 'loading') return;
    onSkinChange(skinId);
  }, [currentSkinId, switchStatus, onSkinChange]);

  const handleSkinHover = useCallback((skinId: number) => {
    setHoveredSkin(skinId);
    // 鼠标悬停时预加载皮肤
    if (onPreload && skinId !== currentSkinId) {
      onPreload(skinId);
    }
  }, [onPreload, currentSkinId]);

  if (skins.length <= 1) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
        <Palette size={12} />
        皮肤选择
        {isCubism4 && (
          <span className="text-[10px] text-cyan-500 bg-cyan-50 px-1.5 py-0.5 rounded">Cubism 4 实时切换</span>
        )}
      </label>

      {/* 皮肤网格选择器 */}
      <div className="grid grid-cols-2 gap-1.5">
        {/* 默认皮肤 */}
        <button
          onClick={() => handleSkinClick(0)}
          onMouseEnter={() => handleSkinHover(0)}
          onMouseLeave={() => setHoveredSkin(null)}
          disabled={switchStatus === 'loading'}
          className={`
            relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all
            ${currentSkinId === 0
              ? 'bg-cyan-500/10 text-cyan-600 border border-cyan-200 shadow-sm'
              : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-cyan-200 hover:bg-cyan-50/50'}
            ${switchStatus === 'loading' ? 'opacity-60 cursor-wait' : 'cursor-pointer'}
          `}
        >
          {currentSkinId === 0 && (
            <Check size={14} className="text-cyan-500 flex-shrink-0" />
          )}
          <span className="truncate">默认皮肤</span>
        </button>

        {/* 其他皮肤 */}
        {skins.map(skin => {
          const isActive = currentSkinId === skin.id;
          const isHovered = hoveredSkin === skin.id;

          return (
            <button
              key={skin.id}
              onClick={() => handleSkinClick(skin.id)}
              onMouseEnter={() => handleSkinHover(skin.id)}
              onMouseLeave={() => setHoveredSkin(null)}
              disabled={switchStatus === 'loading'}
              className={`
                relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all
                ${isActive
                  ? 'bg-cyan-500/10 text-cyan-600 border border-cyan-200 shadow-sm'
                  : isHovered
                    ? 'bg-cyan-50/50 text-gray-700 border border-cyan-200'
                    : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-cyan-200 hover:bg-cyan-50/50'}
                ${switchStatus === 'loading' ? 'opacity-60 cursor-wait' : 'cursor-pointer'}
              `}
            >
              {isActive ? (
                <Check size={14} className="text-cyan-500 flex-shrink-0" />
              ) : switchStatus === 'loading' && hoveredSkin === skin.id ? (
                <Loader2 size={14} className="text-cyan-500 animate-spin flex-shrink-0" />
              ) : null}
              <span className="truncate" title={skin.name}>
                {skin.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* 状态提示 */}
      {switchStatus === 'loading' && (
        <div className="flex items-center gap-2 text-xs text-cyan-500 bg-cyan-50 px-3 py-1.5 rounded-lg">
          <Loader2 size={12} className="animate-spin" />
          <span>正在切换皮肤...</span>
        </div>
      )}

      {switchStatus === 'success' && (
        <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-lg">
          <Check size={12} />
          <span>皮肤切换成功</span>
        </div>
      )}

      {switchStatus === 'error' && errorMessage && (
        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">
          <AlertCircle size={12} />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
