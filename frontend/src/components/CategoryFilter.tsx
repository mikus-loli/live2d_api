import { useModelStore } from '@/hooks/useModels';
import { useMemo } from 'react';
import type { ModelListResponse } from '@/utils/api';

function extractCategories(models: ModelListResponse | null): string[] {
  if (!models || !Array.isArray(models.models)) return ['全部'];
  const cats = new Set<string>();
  models.models.forEach((m: string | string[]) => {
    if (typeof m === 'string') {
      const parts = m.split('/');
      if (parts.length > 1) cats.add(parts[0]);
      else cats.add(m);
    } else if (Array.isArray(m)) {
      m.forEach((sub: string) => {
        const parts = sub.split('/');
        if (parts.length > 1) cats.add(parts[0]);
        else cats.add(sub);
      });
    }
  });
  return ['全部', ...Array.from(cats)];
}

export default function CategoryFilter() {
  const { models, activeCategory, setActiveCategory } = useModelStore();
  const categories = useMemo(() => extractCategories(models), [models]);

  return (
    <div className="flex flex-wrap gap-2 mb-8">
      {categories.map(cat => (
        <button
          key={cat}
          onClick={() => setActiveCategory(cat)}
          className={`px-4 py-1.5 rounded-full text-sm transition-all ${
            activeCategory === cat
              ? 'bg-cyan-500/10 text-cyan-600 border border-cyan-500/30'
              : 'bg-gray-100 text-gray-500 border border-gray-200 hover:border-gray-400 hover:text-gray-700'
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
