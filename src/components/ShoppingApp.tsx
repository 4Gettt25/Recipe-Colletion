import { useEffect } from 'react';
import { useShoppingLists } from '@/hooks/useShoppingLists';
import { ShoppingListSelector } from './ShoppingListSelector';
import { ShoppingListDetail } from './ShoppingListDetail';
import type { Recipe } from '@/types/recipe';

interface ShoppingAppProps {
  recipes: Recipe[];
  onLocalListCountChange?: (count: number) => void;
}

export function ShoppingApp({ recipes, onLocalListCountChange }: ShoppingAppProps) {
  const {
    lists,
    items,
    activeListId,
    setActiveListId,
    createList,
    deleteList,
    addItem,
    addItems,
    toggleItem,
    clearChecked,
    localListCount,
  } = useShoppingLists();

  useEffect(() => {
    onLocalListCountChange?.(localListCount);
  }, [localListCount, onLocalListCountChange]);

  const activeList = lists.find(l => l.id === activeListId) ?? null;

  if (activeListId && activeList) {
    return (
      <ShoppingListDetail
        listId={activeListId}
        listName={activeList.name}
        items={items}
        onBack={() => setActiveListId(null)}
        onToggle={(itemId) => toggleItem(activeListId, itemId)}
        onAddItem={(draft) => addItem(activeListId, draft)}
        onAddItems={(drafts) => addItems(activeListId, drafts)}
        onClearChecked={() => clearChecked(activeListId)}
        recipes={recipes}
      />
    );
  }

  return (
    <ShoppingListSelector
      lists={lists}
      onSelect={(list) => setActiveListId(list.id)}
      onCreate={createList}
      onDelete={deleteList}
    />
  );
}
