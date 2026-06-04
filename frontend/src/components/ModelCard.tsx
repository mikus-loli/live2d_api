import { Shirt, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { memo } from 'react';

interface ModelCardProps {
  name: string;
  group?: string;
  skinCount: number;
  preview: string | null;
  index: number;
}

export default memo(function ModelCard({ name, group, skinCount, preview, index }: ModelCardProps) {
  const navigate = useNavigate();
  const displayName = name.split('/').pop() || name;

  const coverBg = preview
    ? { backgroundImage: `url(/${preview})` }
    : {};

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/model/${encodeURIComponent(name)}`)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/model/${encodeURIComponent(name)}`); } }}
      className="card-glow group cursor-pointer bg-white rounded-2xl overflow-hidden border border-gray-100"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* 缩略图区域 */}
      <div className="relative aspect-[4/3] bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center overflow-hidden">
        {preview ? (
          <div className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105" style={coverBg} />
        ) : (
          <div className="text-5xl opacity-15 group-hover:opacity-25 transition-opacity duration-300 select-none">&#127917;</div>
        )}

        {/* 渐变遮罩 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* hover 操作按钮 */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
          <div className="flex items-center gap-2 px-5 py-2.5 bg-white/90 backdrop-blur-sm rounded-full border border-white/50 shadow-lg text-cyan-600 text-sm font-medium transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
            <Eye size={16} />
            <span>预览</span>
          </div>
        </div>

        {/* 皮肤数量标签 */}
        {skinCount > 1 && (
          <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 bg-white/80 backdrop-blur-sm rounded-full text-[11px] font-medium text-gray-500 shadow-sm">
            <Shirt size={10} />
            <span>{skinCount}</span>
          </div>
        )}
      </div>

      {/* 信息区域 */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-800 truncate mb-1 text-sm group-hover:text-cyan-600 transition-colors duration-200">{displayName}</h3>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {group && (
            <>
              <span className="truncate max-w-[120px]">{group}</span>
              <span className="w-0.5 h-0.5 rounded-full bg-gray-300" />
            </>
          )}
          <div className="flex items-center gap-1">
            <Shirt size={11} />
            <span>{skinCount} 皮肤</span>
          </div>
        </div>
      </div>
    </div>
  );
})
