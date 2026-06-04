import { Search } from 'lucide-react';
import { useModelStore } from '@/hooks/useModels';
import { useMemo } from 'react';

export default function HeroSection() {
  const { searchQuery, setSearchQuery } = useModelStore();

  const particles = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      delay: Math.random() * 8,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 4 + 6,
    })), []);

  return (
    <section className="relative min-h-[70vh] sm:min-h-[80vh] flex items-center justify-center overflow-hidden">
      {/* 粒子背景 */}
      {particles.map(p => (
        <div key={p.id} className="particle" style={{
          left: `${p.left}%`, top: `${p.top}%`,
          animationDelay: `${p.delay}s`,
          animationDuration: `${p.duration}s`,
          width: p.size, height: p.size,
        }} />
      ))}

      {/* 多层渐变背景 */}
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/[0.03] via-transparent to-transparent" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-400/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-pink-400/5 rounded-full blur-3xl" />

      <div className="relative z-10 text-center px-4 sm:px-6 max-w-3xl mx-auto">
        {/* 标签 */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full bg-white/60 border border-cyan-100 shadow-sm animate-in">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-xs font-medium text-cyan-600">Live2D Cubism 2 & 4</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold mb-6 gradient-text leading-tight tracking-tight">
          让你的网站活起来
        </h1>
        <p className="text-base sm:text-lg md:text-xl text-gray-400 mb-10 max-w-lg mx-auto leading-relaxed">
          一键添加 Live2D 看板娘到你的网站，<br className="hidden sm:block" />
          支持皮肤切换、对话交互和自定义配置
        </p>

        {/* 搜索框 */}
        <div className="relative max-w-md mx-auto group">
          <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400/20 via-pink-400/20 to-cyan-400/20 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-cyan-400 transition-colors duration-300" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索模型..."
              aria-label="搜索模型"
              className="w-full pl-12 pr-4 py-3.5 bg-white/80 border border-gray-200/80 rounded-2xl text-gray-900 placeholder-gray-300 input-focus text-sm sm:text-base"
            />
          </div>
        </div>
      </div>

      {/* 底部渐变过渡 */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[var(--color-surface-alt)] to-transparent" />
    </section>
  );
}
