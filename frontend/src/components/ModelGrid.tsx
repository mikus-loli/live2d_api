import { useModelStore } from '@/hooks/useModels';
import ModelCard from './ModelCard';
import { useMemo } from 'react';
import { PackageOpen } from 'lucide-react';
import type { ModelListResponse } from '@/utils/api';

interface FlatModel {
  name: string;
  group: string;
  skinCount: number;
  preview: string | null;
}

function flattenModels(models: ModelListResponse['models'], _messages: string[], skinCounts: (number | number[])[], previewsArr: (string | string[] | null)[], search: string, category: string): FlatModel[] {
  const result: FlatModel[] = [];
  models.forEach((m, idx) => {
    if (typeof m === 'string') {
      const parts = m.split('/');
      const group = parts.length > 1 ? parts[0] : '';
      const name = m;
      const sc = (Array.isArray(skinCounts[idx]) ? (skinCounts[idx] as number[])[0] : skinCounts[idx]) || 1;
      const pv = Array.isArray(previewsArr[idx]) ? (previewsArr[idx] as string[])[0] : (previewsArr[idx] || null);
      result.push({ name, group, skinCount: sc, preview: pv });
    } else if (Array.isArray(m)) {
      m.forEach((sub, subIdx) => {
        const parts = sub.split('/');
        const group = parts.length > 1 ? parts[0] : '';
        const sc = (Array.isArray(skinCounts[idx]) ? (skinCounts[idx] as number[])[subIdx] : 1) || m.length;
        const pv = Array.isArray(previewsArr[idx]) ? ((previewsArr[idx] as string[])[subIdx] || null) : null;
        result.push({ name: sub, group, skinCount: sc, preview: pv });
      });
    }
  });

  return result.filter(item => {
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = category === '全部' || item.group === category || (!item.group && category === item.name);
    return matchSearch && matchCategory;
  });
}

export default function ModelGrid() {
  const { models, loading, searchQuery, activeCategory } = useModelStore();

  const flatModels = useMemo(() => {
    if (!models || !Array.isArray(models.models)) return [];
    return flattenModels(models.models, models.messages || [], models.skin_counts || [], models.previews || [], searchQuery, activeCategory);
  }, [models, searchQuery, activeCategory]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm">
            <div className="aspect-[4/3] bg-gradient-to-br from-gray-100 to-gray-50 animate-pulse" />
            <div className="p-4 space-y-2.5">
              <div className="h-4 bg-gray-100 rounded-lg w-2/3 animate-pulse" />
              <div className="h-3 bg-gray-50 rounded-lg w-1/3 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (flatModels.length === 0) {
    return (
      <div className="text-center py-24">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gray-50 mb-6">
          <PackageOpen className="text-gray-300" size={36} />
        </div>
        <p className="text-gray-400 text-sm">暂无模型</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 stagger-in">
      {flatModels.map((model, idx) => (
        <ModelCard
          key={model.name}
          name={model.name}
          group={model.group}
          skinCount={model.skinCount}
          preview={model.preview}
          index={idx}
        />
      ))}
    </div>
  );
}
