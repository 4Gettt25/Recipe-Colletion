import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';
import type { SharePayload } from '@/lib/shareRecipe';
import { sharePayloadToFormData } from '@/lib/shareRecipe';
import type { RecipeFormData } from '@/types/recipe';

interface ImportFromShareDialogProps {
  payload: SharePayload | null;
  open: boolean;
  onClose: () => void;
  onImport: (data: RecipeFormData) => void;
}

export function ImportFromShareDialog({ payload, open, onClose, onImport }: ImportFromShareDialogProps) {
  const { t } = useTranslation();

  if (!payload) return null;

  const handleImport = () => {
    onImport(sharePayloadToFormData(payload));
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('share.importTitle')}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-gray-500">{t('share.importSubtitle')}</p>

        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <p className="font-semibold text-base">{payload.title}</p>
          {payload.description && (
            <p className="text-sm text-gray-600 line-clamp-2">{payload.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-gray-500">
              {t('share.ingredients', { count: payload.ingredients.length })}
            </span>
            {payload.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
            ))}
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>{t('share.cancel')}</Button>
          <Button onClick={handleImport}>{t('share.importConfirm')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
