import LZString from 'lz-string';
import type { Recipe, RecipeFormData } from '@/types/recipe';

const SHARE_BASE_URL = 'https://4gettt25.github.io/Recipe-Colletion/share';

// Compact wire format — short keys + lz-string compression.
// Ingredient id is omitted and regenerated on import.
interface WireIngredient { n: string; a: number; u: string; }

interface SharePayloadV2 {
  v: 2 | 3;
  t: string;           // title
  d: string;           // description
  i: WireIngredient[]; // ingredients
  s: string[];         // steps (instructions)
  p: number;           // portions
  g: string[];         // tags
  m?: string;          // imageUrl
}

// Public shape used by the rest of the app
export interface SharePayload {
  v: number;
  title: string;
  description: string;
  ingredients: Recipe['ingredients'];
  instructions: string[];
  basePortions: number;
  tags: string[];
  imageUrl?: string;
}

function toWire(recipe: Recipe): SharePayloadV2 {
  return {
    v: 3,
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
  const json = JSON.stringify(toWire(recipe));
  const compressed = LZString.compressToEncodedURIComponent(json);
  return `${SHARE_BASE_URL}#${compressed}`;
}

function tryDecodeHash(hash: string): string | null {
  // v3: lz-string compressed
  const lz = LZString.decompressFromEncodedURIComponent(hash);
  if (lz) return lz;
  // v1/v2 fallback: plain base64
  try {
    return decodeURIComponent(escape(atob(hash)));
  } catch {
    return null;
  }
}

function normalise(raw: SharePayloadV2 | Record<string, unknown>): SharePayload {
  if (raw.v === 2 || raw.v === 3) {
    const r = raw as SharePayloadV2;
    return {
      v: r.v,
      title: r.t,
      description: r.d,
      ingredients: r.i.map((ing, idx) => ({
        id: String(idx),
        name: ing.n,
        amount: ing.a,
        unit: ing.u,
      })),
      instructions: r.s,
      basePortions: r.p,
      tags: r.g,
      imageUrl: r.m,
    };
  }
  // v1: fields already have long names
  return raw as unknown as SharePayload;
}

export function decodeShareUrl(url: string): SharePayload | null {
  try {
    const hash = url.split('#')[1];
    if (!hash) return null;
    const json = tryDecodeHash(hash);
    if (!json) return null;
    const raw = JSON.parse(json);
    if (raw.v !== 1 && raw.v !== 2 && raw.v !== 3) return null;
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
