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
      className="card-glow group cursor-pointer bg-white rounded-2xl overflow-hidden border border-gray-200"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* 缩略图区域 */}
      <div className="relative aspect-[4/3] bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden">
        {preview ? (
          <div className="absolute inset-0 bg-cover bg-center" style={coverBg} />
        ) : (
          <div className="text-6xl opacity-20 group-hover:opacity-30 transition-opacity">🎭</div>
        )}

        {/* hover 遮罩 */}
        <div className="absolute inset-0 bg-white/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 rounded-full border border-cyan-500/30 text-cyan-600 text-sm">
            <Eye size={16} />
            <span>预览</span>
          </div>
        </div>
      </div>

      {/* 信息区域 */}
      <div className="p-4">
        <h3 className="font-medium text-gray-900 truncate mb-1">{displayName}</h3>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {group && <span>{group}</span>}
          <div className="flex items-center gap-1">
            <Shirt size={12} />
            <span>{skinCount} 皮肤</span>
          </div>
        </div>
      </div>
    </div>
  );
})
