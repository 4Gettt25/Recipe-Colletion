import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getApiBase, isNative } from '@/lib/api';
import { extractRecipeFromHtml } from '@/lib/parseRecipeUrl';
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
      if (isNative()) {
        // Android: use CapacitorHttp to bypass CORS, parse client-side
        const { CapacitorHttp } = await import('@capacitor/core');
        const response = await CapacitorHttp.get({
          url: url.trim(),
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          },
          responseType: 'text',
        });
        if (response.status < 200 || response.status >= 300) {
          setError(t('importUrl.errorGeneric'));
          return;
        }
        const data = extractRecipeFromHtml(response.data as string);
        if (!data) { setError(t('importUrl.errorGeneric')); return; }
        onImported(data);
        handleClose();
      } else {
        // Desktop: proxy through local Express server endpoint
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
      }
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
