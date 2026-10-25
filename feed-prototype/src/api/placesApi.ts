import { apiGet } from './client';

export type PlaceSuggestion = { value: string; count: number };

export async function getPlaces(prefix: string, limit = 8): Promise<PlaceSuggestion[]> {
  const params = new URLSearchParams({ prefix, limit: String(limit) });
  const response = await apiGet<{ items: PlaceSuggestion[] }>(`/api/places?${params}`);
  return response.items;
}
