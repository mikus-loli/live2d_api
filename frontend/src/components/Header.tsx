import { Github, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/40">
      <div className="container mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-pink-400 flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:shadow-cyan-500/20 transition-all duration-300">
            <Sparkles size={16} className="text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">
            Live<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-pink-400">2D</span>
          </span>
        </Link>
        <nav aria-label="主导航" className="flex items-center gap-1 sm:gap-2">
          <Link
            to="/"
            className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-cyan-600 rounded-lg hover:bg-cyan-50/60 transition-all duration-200"
          >
            首页
          </Link>
          <a
            href="/admin/"
            className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-cyan-600 rounded-lg hover:bg-cyan-50/60 transition-all duration-200"
          >
            管理
          </a>
          <div className="w-px h-5 bg-gray-200 mx-1 hidden sm:block" />
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener"
            aria-label="GitHub"
            className="p-2 text-gray-400 hover:text-cyan-600 rounded-lg hover:bg-cyan-50/60 transition-all duration-200"
          >
            <Github size={18} />
          </a>
        </nav>
      </div>
    </header>
  );
}
