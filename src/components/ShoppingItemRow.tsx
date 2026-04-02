import { Clock } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import type { ShoppingItem } from '@/types/shoppingList';

interface ShoppingItemRowProps {
  item: ShoppingItem;
  onToggle: () => void;
}

export function ShoppingItemRow({ item, onToggle }: ShoppingItemRowProps) {
  return (
    <div className="flex items-center gap-3 py-2 px-3 bg-white rounded-md border border-gray-100">
      <Checkbox
        checked={item.checked}
        onCheckedChange={onToggle}
        id={`item-${item.id}`}
        className="shrink-0"
      />
      <label
        htmlFor={`item-${item.id}`}
        className={`flex-1 cursor-pointer flex items-center gap-1.5 ${
          item.checked ? 'line-through text-muted-foreground' : ''
        }`}
      >
        <span>{item.name}</span>
        {item._dirty && (
          <Clock className="w-3 h-3 text-orange-400 shrink-0" aria-label="Pending sync" />
        )}
      </label>
      {(item.amount !== null || item.unit) && (
        <span className="text-sm text-gray-500 shrink-0 tabular-nums">
          {item.amount !== null ? item.amount : ''}
          {item.unit ? ` ${item.unit}` : ''}
        </span>
      )}
    </div>
  );
}
