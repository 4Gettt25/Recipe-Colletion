import type { ShoppingItemDraft } from '@/types/shoppingList';

export function scaleAmount(amount: number, factor: number): number {
  const scaled = amount * factor;
  if (scaled >= 10) return Math.round(scaled);
  if (scaled >= 1) return Math.round(scaled * 10) / 10;
  return Math.round(scaled * 100) / 100;
}

export function scaleIngredients(
  ingredients: Array<{ name: string; amount: number; unit: string }>,
  basePortions: number,
  targetPortions: number,
  recipeId: string,
): ShoppingItemDraft[] {
  const factor = targetPortions / Math.max(basePortions, 1);
  return ingredients.map((ing, idx) => ({
    name: ing.name,
    amount: ing.amount > 0 ? scaleAmount(ing.amount, factor) : null,
    unit: ing.unit || null,
    checked: false,
    sortOrder: idx,
    sourceRecipeId: recipeId,
  }));
}
