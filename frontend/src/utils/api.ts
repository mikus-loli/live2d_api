const API_BASE = '';

export interface ModelListResponse {
  models: (string | string[])[];
  messages: string[];
  skin_counts: (number | number[])[];
  previews: (string | string[] | null)[];
}

export async function fetchModelList(): Promise<ModelListResponse> {
  // 前台使用公开的 model_list.json，无需认证
  const res = await fetch(`${API_BASE}/model_list.json`);
  const data = await res.json();
  return {
    models: data.models || [],
    messages: data.messages || [],
    skin_counts: data.skin_counts || [],
    previews: data.previews || [],
  };
}

export async function fetchModelConfig(modelName: string, texturesId: number = 0) {
  const res = await fetch(`${API_BASE}/get/?name=${encodeURIComponent(modelName)}&textures_id=${texturesId}`);
  return res.json();
}

export async function fetchRandomModel(groupId: number) {
  const res = await fetch(`${API_BASE}/rand/?id=${groupId}`);
  return res.json();
}

export async function fetchSwitchModel(groupId: number) {
  const res = await fetch(`${API_BASE}/switch/?id=${groupId}`);
  return res.json();
}

export async function fetchRandomTexture(id: string) {
  const res = await fetch(`${API_BASE}/rand_textures/?id=${id}`);
  return res.json();
}

export async function fetchSwitchTexture(id: string) {
  const res = await fetch(`${API_BASE}/switch_textures/?id=${id}`);
  return res.json();
}

export interface SkinInfo {
  id: number;
  textures: string[];
  name: string;
}

export async function fetchModelSkins(modelName: string): Promise<{ model_name: string; skins_count: number; skins: SkinInfo[] }> {
  const res = await fetch(`${API_BASE}/skins/?name=${encodeURIComponent(modelName)}`);
  return res.json();
}

export function getModelThumbnailUrl(modelName: string): string {
  return `${API_BASE}/model/${modelName}/textures/cache_preview.png`;
}

export function getModelUrl(modelName: string): string {
  return `${API_BASE}/model/${modelName}`;
}
