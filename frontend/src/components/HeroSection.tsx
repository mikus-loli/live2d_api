import { Search } from 'lucide-react';
import { useModelStore } from '@/hooks/useModels';
import { useMemo } from 'react';

export default function HeroSection() {
  const { searchQuery, setSearchQuery } = useModelStore();

  const particles = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      delay: Math.random() * 8,
      size: Math.random() * 3 + 1,
    })), []);

  return (
    <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
      {/* 粒子背景 */}
      {particles.map(p => (
        <div key={p.id} className="particle" style={{
          left: `${p.left}%`, top: `${p.top}%`,
          animationDelay: `${p.delay}s`, width: p.size, height: p.size,
        }} />
      ))}

      {/* 渐变背景 */}
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-transparent" />

      <div className="relative z-10 text-center px-4 max-w-3xl mx-auto">
        <h1 className="text-5xl md:text-7xl font-bold mb-6 gradient-text">
          让你的网站活起来
        </h1>
        <p className="text-lg md:text-xl text-gray-500 mb-10">
          一键添加 Live2D 看板娘到你的网站
        </p>

        {/* 搜索框 */}
        <div className="relative max-w-md mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索模型..."
            className="w-full pl-12 pr-4 py-3 bg-white/80 border border-gray-300 rounded-full text-gray-900 placeholder-gray-400 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
          />
        </div>
      </div>
    </section>
  );
}
