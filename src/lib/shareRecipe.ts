import type { Recipe, RecipeFormData } from '@/types/recipe';

const SHARE_BASE_URL = 'https://4gettt25.github.io/Recipe-Colletion/share';

// Compact wire format (v2) — short keys to minimise base64 length.
// Ingredient id is omitted and regenerated on import.
interface WireIngredient { n: string; a: number; u: string; }

interface SharePayloadV2 {
  v: 2;
  t: string;          // title
  d: string;          // description
  i: WireIngredient[]; // ingredients
  s: string[];        // steps (instructions)
  p: number;          // portions
  g: string[];        // tags
  m?: string;         // imageUrl
}

// Legacy v1 shape (still decoded for backward-compat)
export interface SharePayload {
  v: 1 | 2;
  title: string;
  description: string;
  ingredients: Recipe['ingredients'];
  instructions: string[];
  basePortions: number;
  tags: string[];
  imageUrl?: string;
}

function toV2(recipe: Recipe): SharePayloadV2 {
  return {
    v: 2,
    t: recipe.title,
    d: recipe.description,
    i: recipe.ingredients.map(ing => ({ n: ing.name, a: ing.amount, u: ing.unit })),
    s: recipe.instructions,
    p: recipe.basePortions,
    g: recipe.tags,
    m: recipe.imageUrl?.startsWith('data:') ? undefined : recipe.imageUrl,
  };
}

export function encodeShareUrl(recipe: Recipe): string {
  const payload = toV2(recipe);
  const json = JSON.stringify(payload);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return `${SHARE_BASE_URL}#${b64}`;
}

function normalise(raw: SharePayloadV2 | SharePayload): SharePayload {
  if (raw.v === 2) {
    const v2 = raw as unknown as SharePayloadV2;
    return {
      v: 2,
      title: v2.t,
      description: v2.d,
      ingredients: v2.i.map((ing, idx) => ({
        id: String(idx),
        name: ing.n,
        amount: ing.a,
        unit: ing.u,
      })),
      instructions: v2.s,
      basePortions: v2.p,
      tags: v2.g,
      imageUrl: v2.m,
    };
  }
  return raw as SharePayload;
}

export function decodeShareUrl(url: string): SharePayload | null {
  try {
    const hash = url.split('#')[1];
    if (!hash) return null;
    const json = decodeURIComponent(escape(atob(hash)));
    const raw = JSON.parse(json);
    if (raw.v !== 1 && raw.v !== 2) return null;
    return normalise(raw);
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

/** Returns true for any URL that encodes a shared recipe. */
export function isShareUrl(url: string): boolean {
  return url.startsWith('recipes://share') || url.includes('/Recipe-Colletion/share#');
}
