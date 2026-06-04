import { useState, useCallback } from 'react';
import { Loader2, Check, AlertCircle, Palette } from 'lucide-react';
import type { SkinData, SkinChangeStatus } from '@/utils/skinManager';

interface SkinSwitcherProps {
  skins: SkinData[];
  currentSkinId: number;
  switchStatus: SkinChangeStatus;
  errorMessage: string | null;
  isCubism4: boolean;
  onSkinChange: (skinId: number) => void;
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
    if (onPreload && skinId !== currentSkinId) {
      onPreload(skinId);
    }
  }, [onPreload, currentSkinId]);

  if (skins.length <= 1) return null;

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
        <Palette size={12} className="text-cyan-500" />
        皮肤选择
        {isCubism4 && (
          <span className="text-[10px] font-medium text-cyan-600 bg-gradient-to-r from-cyan-50 to-cyan-100/50 px-2 py-0.5 rounded-full border border-cyan-200/50">
            实时切换
          </span>
        )}
      </label>

      {/* 皮肤网格选择器 */}
      <div className="grid grid-cols-2 gap-2">
        {/* 默认皮肤 */}
        <button
          onClick={() => handleSkinClick(0)}
          onMouseEnter={() => handleSkinHover(0)}
          onMouseLeave={() => setHoveredSkin(null)}
          disabled={switchStatus === 'loading'}
          className={`
            relative flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
            ${currentSkinId === 0
              ? 'bg-gradient-to-r from-cyan-500 to-cyan-400 text-white shadow-md shadow-cyan-500/20'
              : 'bg-white text-gray-600 border border-gray-200 hover:border-cyan-200 hover:bg-cyan-50/50 shadow-sm'}
            ${switchStatus === 'loading' ? 'opacity-60 cursor-wait' : 'cursor-pointer active:scale-[0.97]'}
          `}
        >
          {currentSkinId === 0 && <Check size={14} className="flex-shrink-0" />}
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
                relative flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                ${isActive
                  ? 'bg-gradient-to-r from-cyan-500 to-cyan-400 text-white shadow-md shadow-cyan-500/20'
                  : isHovered
                    ? 'bg-cyan-50/80 text-cyan-700 border border-cyan-200 shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-cyan-200 hover:bg-cyan-50/50 shadow-sm'}
                ${switchStatus === 'loading' ? 'opacity-60 cursor-wait' : 'cursor-pointer active:scale-[0.97]'}
              `}
            >
              {isActive ? (
                <Check size={14} className="flex-shrink-0" />
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
        <div className="flex items-center gap-2 text-xs text-cyan-600 bg-gradient-to-r from-cyan-50 to-cyan-100/50 px-3 py-2 rounded-xl border border-cyan-100">
          <Loader2 size={12} className="animate-spin" />
          <span>正在切换皮肤...</span>
        </div>
      )}

      {switchStatus === 'success' && (
        <div className="flex items-center gap-2 text-xs text-emerald-600 bg-gradient-to-r from-emerald-50 to-emerald-100/50 px-3 py-2 rounded-xl border border-emerald-100">
          <Check size={12} />
          <span>皮肤切换成功</span>
        </div>
      )}

      {switchStatus === 'error' && errorMessage && (
        <div className="flex items-center gap-2 text-xs text-red-600 bg-gradient-to-r from-red-50 to-red-100/50 px-3 py-2 rounded-xl border border-red-100">
          <AlertCircle size={12} />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
