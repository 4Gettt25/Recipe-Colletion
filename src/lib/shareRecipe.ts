import { deflateSync, inflateSync, strToU8, strFromU8 } from 'fflate';
import LZString from 'lz-string'; // kept for decoding v3 links
import type { Recipe, RecipeFormData } from '@/types/recipe';

const SHARE_BASE_URL = 'https://4gettt25.github.io/Recipe-Colletion/share';

// ─── Wire format v4 ──────────────────────────────────────────────────────────
// Array tuple — no keys at all. Positions:
//  [0] version (4)
//  [1] title
//  [2] description
//  [3] ingredients: [[name, amount, unit], ...]
//  [4] instructions: [step, ...]
//  [5] basePortions
//  [6] tags: [tag, ...]
//  [7] imageUrl (optional, omitted when undefined)
type WireV4 = [
  4,
  string,
  string,
  [string, number, string][],
  string[],
  number,
  string[],
  (string | undefined)?,
];

// ─── Public shape used by the rest of the app ────────────────────────────────
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

// ─── Encoding ────────────────────────────────────────────────────────────────
function toWireV4(recipe: Recipe): WireV4 {
  const wire: WireV4 = [
    4,
    recipe.title,
    recipe.description,
    recipe.ingredients.map(ing => [ing.name, ing.amount, ing.unit]),
    recipe.instructions,
    recipe.basePortions,
    recipe.tags,
  ];
  const imgUrl = recipe.imageUrl?.startsWith('data:') ? undefined : recipe.imageUrl;
  if (imgUrl) wire.push(imgUrl);
  return wire;
}

function base64urlEncode(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach(b => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function encodeShareUrl(recipe: Recipe): string {
  const json = JSON.stringify(toWireV4(recipe));
  const compressed = deflateSync(strToU8(json), { level: 9 });
  return `${SHARE_BASE_URL}#${base64urlEncode(compressed)}`;
}

// ─── Decoding ────────────────────────────────────────────────────────────────
function base64urlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function tryDecodeHash(hash: string): string | null {
  // v4: deflate-raw + base64url
  try {
    return strFromU8(inflateSync(base64urlDecode(hash)));
  } catch { /* not deflate */ }

  // v3: lz-string
  try {
    const lz = LZString.decompressFromEncodedURIComponent(hash);
    if (lz) return lz;
  } catch { /* not lz-string */ }

  // v1/v2: plain base64
  try {
    return decodeURIComponent(escape(atob(hash)));
  } catch { /* not base64 */ }

  return null;
}

function normalise(raw: unknown): SharePayload {
  // v4: array tuple
  if (Array.isArray(raw) && raw[0] === 4) {
    const [, title, description, ings, instructions, basePortions, tags, imageUrl] = raw as WireV4;
    return {
      v: 4,
      title,
      description,
      ingredients: ings.map(([name, amount, unit], idx) => ({
        id: String(idx),
        name,
        amount,
        unit,
      })),
      instructions,
      basePortions,
      tags,
      imageUrl: imageUrl ?? undefined,
    };
  }

  // v2/v3: compact object keys
  if (!Array.isArray(raw) && (raw as Record<string,unknown>).v === 2 || !Array.isArray(raw) && (raw as Record<string,unknown>).v === 3) {
    const r = raw as { v: number; t: string; d: string; i: {n:string;a:number;u:string}[]; s: string[]; p: number; g: string[]; m?: string };
    return {
      v: r.v,
      title: r.t,
      description: r.d,
      ingredients: r.i.map((ing, idx) => ({ id: String(idx), name: ing.n, amount: ing.a, unit: ing.u })),
      instructions: r.s,
      basePortions: r.p,
      tags: r.g,
      imageUrl: r.m,
    };
  }

  // v1: full field names
  return raw as SharePayload;
}

export function decodeShareUrl(url: string): SharePayload | null {
  try {
    const hash = url.split('#')[1];
    if (!hash) return null;
    const json = tryDecodeHash(hash);
    if (!json) return null;
    const raw = JSON.parse(json);
    const version = Array.isArray(raw) ? raw[0] : (raw as Record<string,unknown>).v;
    if (![1, 2, 3, 4].includes(version as number)) return null;
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
