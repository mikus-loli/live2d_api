import { Github } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gray-50/80 backdrop-blur-xl border-b border-gray-200">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-xl font-bold">Live<span className="text-cyan-600">2D</span></span>
        </Link>
        <nav aria-label="主导航" className="flex items-center gap-6">
          <Link to="/" className="text-sm text-gray-700 hover:text-cyan-600 transition-colors">首页</Link>
          <a href="/admin/" className="text-sm text-gray-700 hover:text-cyan-600 transition-colors">管理</a>
          <a href="https://github.com" target="_blank" rel="noopener" aria-label="GitHub" className="text-gray-500 hover:text-cyan-600 transition-colors">
            <Github size={18} />
          </a>
        </nav>
      </div>
    </header>
  );
}
