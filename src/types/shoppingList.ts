export interface ShoppingList {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShoppingItem {
  id: string;
  listId: string;
  name: string;
  amount: number | null;
  unit: string | null;
  checked: boolean;
  sortOrder: number;
  sourceRecipeId: string | null;
  createdAt: string;
  updatedAt: string;
  _dirty?: boolean; // client-only, not sent to server
}

export type ShoppingItemDraft = Omit<ShoppingItem, 'id' | 'listId' | 'createdAt' | 'updatedAt' | '_dirty'>;
