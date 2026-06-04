export default function Footer() {
  return (
    <footer className="border-t border-gray-100 mt-20">
      <div className="container mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-cyan-400 to-pink-400 flex items-center justify-center">
              <span className="text-[10px] text-white font-bold">L2</span>
            </div>
            <span className="text-sm font-semibold text-gray-400">Live2D API</span>
          </div>
          <p className="text-xs text-gray-300 text-center">
            模型版权归原作者所有 &middot; &copy; {new Date().getFullYear()}
          </p>
          <div className="flex items-center gap-4">
            <a href="/admin/" className="text-xs text-gray-400 hover:text-cyan-500 transition-colors">管理面板</a>
            <a href="https://github.com" target="_blank" rel="noopener" className="text-xs text-gray-400 hover:text-cyan-500 transition-colors">GitHub</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
