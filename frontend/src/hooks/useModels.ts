import { create } from 'zustand';
import { fetchModelList, type ModelListResponse } from '@/utils/api';

interface ModelState {
  models: ModelListResponse | null;
  loading: boolean;
  error: string | null;
  searchQuery: string;
  activeCategory: string;
  loadData: () => Promise<void>;
  setSearchQuery: (q: string) => void;
  setActiveCategory: (c: string) => void;
}

export const useModelStore = create<ModelState>((set, get) => ({
  models: null,
  loading: false,
  error: null,
  searchQuery: '',
  activeCategory: '全部',

  loadData: async () => {
    set({ loading: true, error: null });
    try {
      const data = await fetchModelList();
      set({ models: data, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  setSearchQuery: (q) => set({ searchQuery: q }),
  setActiveCategory: (c) => set({ activeCategory: c }),
}));
