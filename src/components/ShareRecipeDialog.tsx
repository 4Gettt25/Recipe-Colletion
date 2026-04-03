import { useState, useMemo, useRef, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Copy, Check, Share2, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { Recipe } from '@/types/recipe';
import { encodeShareUrl } from '@/lib/shareRecipe';

const QR_MAX_LENGTH = 4000;
const QR_DISPLAY_SIZE = 200;
const QR_EXPORT_SIZE = 400; // higher res for sharing
const QR_PADDING = 24;      // white border around QR in exported image

interface ShareRecipeDialogProps {
  recipe: Recipe;
  open: boolean;
  onClose: () => void;
}

const canNativeShare = typeof navigator !== 'undefined' && 'share' in navigator;

export function ShareRecipeDialog({ recipe, open, onClose }: ShareRecipeDialogProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const shareUrl = useMemo(() => {
    try { return encodeShareUrl(recipe); } catch { return null; }
  }, [recipe]);

  const qrTooBig = !shareUrl || shareUrl.length > QR_MAX_LENGTH;

  const copy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success(t('share.copied'));
    setTimeout(() => setCopied(false), 2000);
  };

  const exportQRImage = useCallback((): Promise<Blob | null> => {
    return new Promise(resolve => {
      const src = canvasRef.current;
      if (!src) return resolve(null);

      const total = QR_EXPORT_SIZE + QR_PADDING * 2;
      const out = document.createElement('canvas');
      out.width = total;
      out.height = total;
      const ctx = out.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, total, total);
      ctx.drawImage(src, QR_PADDING, QR_PADDING, QR_EXPORT_SIZE, QR_EXPORT_SIZE);
      out.toBlob(resolve, 'image/png');
    });
  }, []);

  const shareQR = useCallback(async () => {
    const blob = await exportQRImage();
    if (!blob) return;
    const file = new File([blob], `${recipe.title}.png`, { type: 'image/png' });
    try {
      if (canNativeShare && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: recipe.title });
      } else {
        // Desktop fallback: download the PNG
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${recipe.title}-qr.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') toast.error('Could not share');
    }
  }, [exportQRImage, recipe.title]);

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
                <QRCodeCanvas ref={canvasRef} value={shareUrl} size={QR_DISPLAY_SIZE} />
              </div>

              {/* Share / Save QR image */}
              <Button className="w-full" onClick={shareQR}>
                {canNativeShare
                  ? <><Share2 className="w-4 h-4 mr-2" />{t('share.shareQR')}</>
                  : <><Download className="w-4 h-4 mr-2" />{t('share.saveQR')}</>
                }
              </Button>

              <p className="text-xs text-gray-500 text-center">{t('share.hint')}</p>
            </>
          ) : (
            <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-md px-3 py-2 text-center w-full">
              {t('share.largeWarning')}
            </p>
          )}

          {/* Copy link always available as fallback */}
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
