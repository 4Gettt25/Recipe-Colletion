import { useState, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { Recipe } from '@/types/recipe';
import { encodeShareUrl } from '@/lib/shareRecipe';

// QR codes can hold at most ~4000 alphanumeric chars reliably
const QR_MAX_LENGTH = 4000;

interface ShareRecipeDialogProps {
  recipe: Recipe;
  open: boolean;
  onClose: () => void;
}

function SafeQRCode({ value }: { value: string }) {
  try {
    return <QRCodeSVG value={value} size={200} />;
  } catch {
    return null;
  }
}

export function ShareRecipeDialog({ recipe, open, onClose }: ShareRecipeDialogProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const shareUrl = useMemo(() => {
    try {
      return encodeShareUrl(recipe);
    } catch {
      return null;
    }
  }, [recipe]);

  const qrTooBig = !shareUrl || shareUrl.length > QR_MAX_LENGTH;

  const copy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success(t('share.copied'));
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('share.title')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          {!qrTooBig && shareUrl ? (
            <>
              <div className="p-3 bg-white rounded-xl border shadow-sm">
                <SafeQRCode value={shareUrl} />
              </div>
              <p className="text-xs text-gray-500 text-center">{t('share.hint')}</p>
            </>
          ) : (
            <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-md px-3 py-2 text-center w-full">
              {t('share.largeWarning')}
            </p>
          )}

          <Button variant="outline" className="w-full" onClick={copy} disabled={!shareUrl}>
            {copied
              ? <><Check className="w-4 h-4 mr-2 text-green-500" />{t('share.copied')}</>
              : <><Copy className="w-4 h-4 mr-2" />{t('share.copyLink')}</>
            }
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
