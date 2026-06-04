export default function Footer() {
  return (
    <footer className="border-t border-gray-200 py-8 mt-20">
      <div className="container mx-auto px-4 text-center text-sm text-gray-300">
        <p>Live2D API &copy; {new Date().getFullYear()} | 模型版权归原作者所有</p>
      </div>
    </footer>
  );
}
