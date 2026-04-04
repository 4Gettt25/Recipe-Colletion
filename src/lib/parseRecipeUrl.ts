import type { RecipeFormData } from '@/types/recipe';

// ─── Constants (mirrored from server/index.js) ────────────────────────────────

const UNITS = [
  'tsp','teaspoon','teaspoons','tbsp','tablespoon','tablespoons',
  'cup','cups','oz','ounce','ounces','lb','pound','pounds',
  'g','gram','grams','kg','ml','l','liter','liters','litre','litres',
  'pinch','dash','clove','cloves','slice','slices','piece','pieces',
  'can','cans','pkg','package','packages','bunch','bunches',
  'sprig','sprigs','handful','handfuls','stick','sticks',
];

const UNIT_CANON: Record<string, string> = {
  teaspoon:'tsp', teaspoons:'tsp',
  tablespoon:'tbsp', tablespoons:'tbsp',
  cups:'cup', ounce:'oz', ounces:'oz',
  pound:'lb', pounds:'lb', gram:'g', grams:'g',
  liter:'l', liters:'l', litre:'l', litres:'l',
};

const VULGAR: Record<string, string> = {
  '½':'1/2','¼':'1/4','¾':'3/4','⅓':'1/3','⅔':'2/3',
  '⅛':'1/8','⅜':'3/8','⅝':'5/8','⅞':'7/8',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(str: unknown): string {
  return String(str ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseAmount(raw: string): number {
  let s = String(raw).trim();
  for (const [vf, dec] of Object.entries(VULGAR)) s = s.replace(new RegExp(vf, 'g'), dec);
  return s.split(/\s+/).reduce((sum, part) => {
    if (!part) return sum;
    if (part.includes('/')) {
      const [n, d] = part.split('/');
      return sum + (parseFloat(n) || 0) / (parseFloat(d) || 1);
    }
    const v = parseFloat(part);
    return sum + (isNaN(v) ? 0 : v);
  }, 0);
}

function parseIngredientString(raw: string) {
  const id = Math.random().toString(36).substring(2, 9);
  let s = String(raw ?? '').trim();
  for (const [vf, dec] of Object.entries(VULGAR)) s = s.replace(new RegExp(vf, 'g'), dec);

  const amtMatch = s.match(/^([\d\s./]+)/);
  let amount = 0;
  if (amtMatch) {
    amount = parseAmount(amtMatch[1]);
    s = s.slice(amtMatch[1].length).trimStart();
  }

  let unit = '';
  const unitPattern = new RegExp(`^(${UNITS.join('|')})(?=[.,\\s]|$)`, 'i');
  const unitMatch = s.match(unitPattern);
  if (unitMatch) {
    const rawUnit = unitMatch[1].toLowerCase();
    unit = UNIT_CANON[rawUnit] ?? rawUnit;
    s = s.slice(unitMatch[1].length).trimStart();
  }

  s = s.replace(/^(of|,|\.|–|-)\s*/i, '').trim();
  return { id, name: s || raw.trim(), amount, unit };
}

function splitIntoSteps(text: string): string[] {
  const clean = stripHtml(text);
  if (!clean) return [];
  const byNewline = clean.split(/\n+/).map(s => s.trim()).filter(Boolean);
  if (byNewline.length > 1) return byNewline;
  const sentences = clean.split(/\.\s+(?=[A-Z])/).map(s => s.trim()).filter(Boolean);
  return sentences.map(s => /[.!?]$/.test(s) ? s : s + '.');
}

function normaliseInstructions(raw: unknown): string[] {
  if (!raw) return [];
  if (typeof raw === 'string') return splitIntoSteps(raw);
  if (!Array.isArray(raw)) return [];
  const steps: string[] = [];
  for (const item of raw) {
    if (typeof item === 'string') { splitIntoSteps(item).forEach(t => steps.push(t)); continue; }
    const obj = item as Record<string, unknown>;
    if (obj['@type'] === 'HowToSection' && Array.isArray(obj.itemListElement)) {
      for (const sub of obj.itemListElement as Record<string, unknown>[]) {
        splitIntoSteps(String(sub.text || sub.name || '')).forEach(t => steps.push(t));
      }
      continue;
    }
    splitIntoSteps(String(obj.text || obj.name || '')).forEach(t => steps.push(t));
  }
  return steps;
}

function normaliseImage(raw: unknown): string | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) return raw[0] ? normaliseImage(raw[0]) : undefined;
  if (typeof raw === 'object' && (raw as Record<string, unknown>).url) {
    return String((raw as Record<string, unknown>).url);
  }
  return undefined;
}

function normalisePortions(raw: unknown): number {
  if (!raw) return 2;
  const m = String(raw).match(/\d+/);
  return m ? parseInt(m[0], 10) : 2;
}

function normaliseTags(ld: Record<string, unknown>): string[] {
  const parts: string[] = [];
  const push = (v: unknown) => {
    if (!v) return;
    if (Array.isArray(v)) v.forEach(push);
    else String(v).split(/[,;]+/).forEach(t => { const s = t.trim(); if (s) parts.push(s); });
  };
  push(ld.keywords); push(ld.recipeCategory); push(ld.recipeCuisine);
  return [...new Set(parts)];
}

function findRecipeLd(parsed: unknown): Record<string, unknown> | null {
  const isRecipe = (node: unknown): boolean => {
    if (!node || typeof node !== 'object') return false;
    const t = (node as Record<string, unknown>)['@type'];
    return t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'));
  };
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      const found = findRecipeLd(item);
      if (found) return found;
    }
    return null;
  }
  if (isRecipe(parsed)) return parsed as Record<string, unknown>;
  const graph = (parsed as Record<string, unknown>)?.['@graph'];
  if (Array.isArray(graph)) {
    for (const node of graph) { if (isRecipe(node)) return node as Record<string, unknown>; }
  }
  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extracts recipe data from raw HTML by parsing JSON-LD structured data.
 * Returns null if no Recipe schema is found.
 */
export function extractRecipeFromHtml(html: string): Partial<RecipeFormData> | null {
  const ldBlocks: unknown[] = [];
  const ldRegex = /<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = ldRegex.exec(html)) !== null) {
    try { ldBlocks.push(JSON.parse(match[1])); } catch { /* skip malformed */ }
  }
  if (!ldBlocks.length) return null;

  let ld: Record<string, unknown> | null = null;
  for (const block of ldBlocks) { ld = findRecipeLd(block); if (ld) break; }
  if (!ld) return null;

  return {
    title: stripHtml(ld.name || ''),
    description: stripHtml(ld.description || ''),
    ingredients: ((ld.recipeIngredient as string[]) || []).map(parseIngredientString),
    instructions: normaliseInstructions(ld.recipeInstructions),
    basePortions: normalisePortions(ld.recipeYield),
    imageUrl: normaliseImage(ld.image),
    tags: normaliseTags(ld),
    rating: 0,
    favourite: false,
  };
}
