import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getApiBase } from '@/lib/api';
import type { RecipeFormData } from '@/types/recipe';
import { useTranslation } from 'react-i18next';

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: (data: Partial<RecipeFormData>) => void;
}

export function RecipeUrlImportDialog({ open, onClose, onImported }: Props) {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setUrl('');
    setLoading(false);
    setError(null);
    onClose();
  };

  const handleImport = async () => {
    if (!url.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const base = getApiBase();
      const res = await fetch(`${base}/recipes/import-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? t('importUrl.errorGeneric'));
        return;
      }
      onImported(data);
      handleClose();
    } catch {
      setError(t('importUrl.errorNetwork'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('importUrl.title')}</DialogTitle>
          <DialogDescription>{t('importUrl.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="import-url">{t('importUrl.urlLabel')}</Label>
            <Input
              id="import-url"
              type="url"
              autoFocus
              placeholder="https://www.allrecipes.com/recipe/…"
              value={url}
              disabled={loading}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleImport(); }}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose} disabled={loading}>
              {t('importUrl.cancel')}
            </Button>
            <Button onClick={handleImport} disabled={!url.trim() || loading}>
              {loading && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {loading ? t('importUrl.importing') : t('importUrl.import')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
