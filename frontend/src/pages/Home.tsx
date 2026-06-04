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

        <section className="container mx-auto px-4 pb-20">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">模型精选</h2>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-cyan-600 transition-colors"
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
