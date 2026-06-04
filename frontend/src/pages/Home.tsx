import { useEffect } from 'react';
import Header from '@/components/Header';
import HeroSection from '@/components/HeroSection';
import CategoryFilter from '@/components/CategoryFilter';
import ModelGrid from '@/components/ModelGrid';
import Footer from '@/components/Footer';
import { useModelStore } from '@/hooks/useModels';
import { RefreshCw } from 'lucide-react';

export default function Home() {
  const { loadData, setSearchQuery, setActiveCategory } = useModelStore();

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setSearchQuery('');
    setActiveCategory('全部');
    loadData();
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-16">
        <HeroSection />

        <section className="container mx-auto px-4 sm:px-6 pb-20">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">模型精选</h2>
              <p className="text-sm text-gray-400 mt-1">选择你喜欢的看板娘模型</p>
            </div>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-500 hover:text-cyan-600 bg-white border border-gray-200 rounded-xl hover:border-cyan-200 hover:bg-cyan-50/50 shadow-sm transition-all duration-200 active:scale-[0.97]"
            >
              <RefreshCw size={14} />
              换一换
            </button>
          </div>

          <CategoryFilter />
          <ModelGrid />
        </section>
      </main>
      <Footer />
    </div>
  );
}
