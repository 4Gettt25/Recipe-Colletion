import { useState } from 'react';
import { ChevronLeft, ShoppingCart, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShoppingItemRow } from './ShoppingItemRow';
import { RecipeImportDialog } from './RecipeImportDialog';
import type { ShoppingItem, ShoppingItemDraft } from '@/types/shoppingList';
import type { Recipe } from '@/types/recipe';
import { useTranslation } from 'react-i18next';

interface ShoppingListDetailProps {
  listId: string;
  listName: string;
  items: ShoppingItem[];
  onBack: () => void;
  onToggle: (itemId: string) => void;
  onAddItem: (draft: ShoppingItemDraft) => void;
  onAddItems: (drafts: ShoppingItemDraft[]) => void;
  onClearChecked: () => void;
  recipes: Recipe[];
}

export function ShoppingListDetail({
  listId: _listId,
  listName,
  items,
  onBack,
  onToggle,
  onAddItem,
  onAddItems,
  onClearChecked,
  recipes,
}: ShoppingListDetailProps) {
  const { t } = useTranslation();
  const [itemName, setItemName] = useState('');
  const [itemAmount, setItemAmount] = useState('');
  const [itemUnit, setItemUnit] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  const unchecked = items.filter(i => !i.checked).sort((a, b) => a.sortOrder - b.sortOrder);
  const checked = items.filter(i => i.checked).sort((a, b) => a.sortOrder - b.sortOrder);

  const handleAddItem = () => {
    const name = itemName.trim();
    if (!name) return;
    const amount = itemAmount.trim() ? parseFloat(itemAmount) : null;
    const unit = itemUnit.trim() || null;
    onAddItem({
      name,
      amount: amount !== null && !isNaN(amount) ? amount : null,
      unit,
      checked: false,
      sortOrder: items.length,
      sourceRecipeId: null,
    });
    setItemName('');
    setItemAmount('');
    setItemUnit('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleAddItem();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="shrink-0">
          <ChevronLeft className="w-4 h-4 mr-1" />
          {t('recipeDetail.back')}
        </Button>
        <h2 className="text-lg font-bold flex-1 truncate">{listName}</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setImportOpen(true)}
          className="shrink-0"
        >
          <ShoppingCart className="w-4 h-4 mr-1" />
          {t('shopping.importRecipes')}
        </Button>
        {checked.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearChecked}
            className="shrink-0 text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            {t('shopping.clearChecked')}
          </Button>
        )}
      </div>

      {/* Unchecked items */}
      {unchecked.length === 0 && checked.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <ShoppingCart className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p>{t('shopping.noItems')}</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {unchecked.map(item => (
            <ShoppingItemRow
              key={item.id}
              item={item}
              onToggle={() => onToggle(item.id)}
            />
          ))}
        </div>
      )}

      {/* Checked section */}
      {checked.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-gray-400 px-1">
            {t('shopping.checkedSection', { count: checked.length })}
          </p>
          <div className="space-y-1.5 opacity-60">
            {checked.map(item => (
              <ShoppingItemRow
                key={item.id}
                item={item}
                onToggle={() => onToggle(item.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Add item form */}
      <div className="space-y-2 pt-2 border-t">
        {/* Name row */}
        <div className="flex gap-2">
          <Input
            value={itemName}
            onChange={e => setItemName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('shopping.addItem')}
            className="flex-1"
          />
          <Button onClick={handleAddItem} disabled={!itemName.trim()} size="icon">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        {/* Optional amount + unit row */}
        <div className="flex gap-2">
          <Input
            type="number"
            min="0"
            step="any"
            value={itemAmount}
            onChange={e => setItemAmount(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('shopping.amountPlaceholder')}
            className="w-24 text-sm"
          />
          <Input
            value={itemUnit}
            onChange={e => setItemUnit(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('shopping.unitPlaceholder')}
            className="w-24 text-sm"
          />
          <p className="text-xs text-gray-400 self-center">{t('shopping.amountOptional')}</p>
        </div>
      </div>

      {/* Import dialog */}
      <RecipeImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        recipes={recipes}
        onImport={onAddItems}
      />
    </div>
  );
}
