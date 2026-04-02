import { useState, useMemo } from 'react';
import { Search, Plus, Minus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import type { Recipe } from '@/types/recipe';
import type { ShoppingItemDraft } from '@/types/shoppingList';
import { scaleIngredients } from '@/lib/scaling';
import { useTranslation } from 'react-i18next';

interface RecipeImportDialogProps {
  open: boolean;
  onClose: () => void;
  recipes: Recipe[];
  onImport: (items: ShoppingItemDraft[]) => void;
}

interface RecipeSelection {
  selected: boolean;
  portions: number;
}

export function RecipeImportDialog({ open, onClose, recipes, onImport }: RecipeImportDialogProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selections, setSelections] = useState<Record<string, RecipeSelection>>({});

  const filteredRecipes = useMemo(() => {
    if (!searchQuery.trim()) return recipes;
    const q = searchQuery.toLowerCase();
    return recipes.filter(r =>
      r.title.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q)
    );
  }, [recipes, searchQuery]);

  const toggleSelect = (recipe: Recipe) => {
    setSelections(prev => {
      const current = prev[recipe.id];
      if (current?.selected) {
        // Deselect
        const next = { ...prev };
        delete next[recipe.id];
        return next;
      }
      return {
        ...prev,
        [recipe.id]: {
          selected: true,
          portions: recipe.basePortions || 2,
        },
      };
    });
  };

  const adjustPortions = (recipeId: string, delta: number) => {
    setSelections(prev => {
      const current = prev[recipeId];
      if (!current) return prev;
      return {
        ...prev,
        [recipeId]: {
          ...current,
          portions: Math.max(1, current.portions + delta),
        },
      };
    });
  };

  const selectedCount = Object.values(selections).filter(s => s.selected).length;

  const handleImport = () => {
    const allDrafts: ShoppingItemDraft[] = [];
    for (const recipe of recipes) {
      const sel = selections[recipe.id];
      if (!sel?.selected) continue;
      const drafts = scaleIngredients(
        recipe.ingredients,
        recipe.basePortions || 2,
        sel.portions,
        recipe.id,
      );
      allDrafts.push(...drafts);
    }
    onImport(allDrafts);
    // Reset state
    setSelections({});
    setSearchQuery('');
    onClose();
  };

  const handleClose = () => {
    setSelections({});
    setSearchQuery('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={open ? handleClose : undefined}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('shopping.importTitle')}</DialogTitle>
        </DialogHeader>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder={t('recipeList.searchPlaceholder')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          {filteredRecipes.length === 0 ? (
            <p className="text-center text-gray-500 py-6">{t('recipeList.noResults')}</p>
          ) : (
            filteredRecipes.map(recipe => {
              const sel = selections[recipe.id];
              const isSelected = !!sel?.selected;
              return (
                <div
                  key={recipe.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
                    isSelected ? 'border-orange-300 bg-orange-50' : 'border-gray-100 bg-white'
                  }`}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelect(recipe)}
                    id={`import-${recipe.id}`}
                    className="shrink-0"
                  />
                  <label
                    htmlFor={`import-${recipe.id}`}
                    className="flex-1 cursor-pointer min-w-0"
                  >
                    <span className="font-medium truncate block">{recipe.title}</span>
                    <span className="text-xs text-gray-400">
                      {recipe.ingredients.length} {t('recipeDetail.ingredients').toLowerCase()}
                    </span>
                  </label>
                  {isSelected && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => adjustPortions(recipe.id, -1)}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-6 text-center text-sm font-medium tabular-nums">
                        {sel.portions}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => adjustPortions(recipe.id, 1)}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="pt-3 border-t mt-3">
          <Button
            className="w-full"
            disabled={selectedCount === 0}
            onClick={handleImport}
          >
            {t('shopping.importAdd')}
            {selectedCount > 0 && ` (${selectedCount})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
