import type { Recipe, RecipeFormData } from '@/types/recipe';

export interface SharePayload {
  v: 1;
  title: string;
  description: string;
  ingredients: Recipe['ingredients'];
  instructions: string[];
  basePortions: number;
  tags: string[];
  imageUrl?: string;
}

export function encodeShareUrl(recipe: Recipe): string {
  const payload: SharePayload = {
    v: 1,
    title: recipe.title,
    description: recipe.description,
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
    basePortions: recipe.basePortions,
    tags: recipe.tags,
    // Only include remote image URLs — data: URLs are too large for a share link
    imageUrl: recipe.imageUrl?.startsWith('data:') ? undefined : recipe.imageUrl,
  };
  const json = JSON.stringify(payload);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return `recipes://share#${b64}`;
}

export function decodeShareUrl(url: string): SharePayload | null {
  try {
    const hash = url.split('#')[1];
    if (!hash) return null;
    const json = decodeURIComponent(escape(atob(hash)));
    const payload = JSON.parse(json) as SharePayload;
    if (payload.v !== 1) return null;
    return payload;
  } catch {
    return null;
  }
}

export function sharePayloadToFormData(payload: SharePayload): RecipeFormData {
  return {
    title: payload.title,
    description: payload.description,
    ingredients: payload.ingredients,
    instructions: payload.instructions,
    basePortions: payload.basePortions,
    tags: payload.tags,
    imageUrl: payload.imageUrl,
    rating: 0,
    favourite: false,
  };
}
