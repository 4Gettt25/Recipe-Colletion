import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { ShoppingList } from '@/types/shoppingList';
import { useTranslation } from 'react-i18next';

interface ShoppingListSelectorProps {
  lists: ShoppingList[];
  onSelect: (list: ShoppingList) => void;
  onCreate: (name: string) => void;
  onDelete: (id: string) => void;
}

export function ShoppingListSelector({ lists, onSelect, onCreate, onDelete }: ShoppingListSelectorProps) {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input when the dialog opens
  useEffect(() => {
    if (dialogOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setNewListName('');
    }
  }, [dialogOpen]);

  const handleCreate = () => {
    const name = newListName.trim();
    if (!name) return;
    onCreate(name);
    setDialogOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleCreate();
  };

  return (
    <div className="space-y-4">
      {/* New list button */}
      <Button onClick={() => setDialogOpen(true)} className="w-full sm:w-auto">
        <Plus className="w-4 h-4 mr-2" />
        {t('shopping.newList')}
      </Button>

      {/* List of shopping lists */}
      {lists.length === 0 ? (
        <div className="text-center py-12">
          <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">{t('shopping.noLists')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {lists.map(list => (
            <div
              key={list.id}
              className="flex items-center justify-between bg-white rounded-lg border shadow-sm px-4 py-3 hover:border-orange-200 transition-colors cursor-pointer"
              onClick={() => onSelect(list)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <ShoppingCart className="w-4 h-4 text-orange-500 shrink-0" />
                <span className="font-medium truncate">{list.name}</span>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-gray-400 hover:text-red-500 h-8 w-8"
                    onClick={e => e.stopPropagation()}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('shopping.deleteListTitle')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('shopping.deleteListConfirm', { name: list.name })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('recipeDetail.cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDelete(list.id)}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {t('recipeDetail.delete')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      )}

      {/* New list dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('shopping.newList')}</DialogTitle>
          </DialogHeader>
          <Input
            ref={inputRef}
            value={newListName}
            onChange={e => setNewListName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('shopping.listNamePlaceholder')}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('recipeDetail.cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={!newListName.trim()}>
              {t('shopping.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
