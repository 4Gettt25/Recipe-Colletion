import { useState, useMemo, useRef, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Copy, Check, Share2, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { Recipe } from '@/types/recipe';
import { encodeShareUrl } from '@/lib/shareRecipe';
import { isNative } from '@/lib/api';

const QR_MAX_LENGTH = 4000;
const QR_DISPLAY_SIZE = 300;
const QR_EXPORT_SIZE  = 600;  // 2× for sharing
const QR_PADDING      = 28;

interface ShareRecipeDialogProps {
  recipe: Recipe;
  open: boolean;
  onClose: () => void;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ShareRecipeDialog({ recipe, open, onClose }: ShareRecipeDialogProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const native = isNative();

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

  const exportQRBlob = useCallback((): Promise<Blob | null> => {
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
    const blob = await exportQRBlob();
    if (!blob) return;
    const filename = `${recipe.title}.png`;

    if (native) {
      // Android: write to cache dir, share via native intent
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');
        const base64 = await blobToBase64(blob);
        await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache });
        const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
        await Share.share({ files: [uri], dialogTitle: t('share.shareQR') });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') toast.error('Could not share');
      }
    } else {
      // Desktop: download the PNG
      downloadBlob(blob, filename);
    }
  }, [exportQRBlob, native, recipe.title, t]);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-xs w-[360px]">
        <DialogHeader>
          <DialogTitle>{t('share.title')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          {!qrTooBig && shareUrl ? (
            <>
              <div className="p-3 bg-white rounded-xl border shadow-sm">
                <QRCodeCanvas
                  ref={canvasRef}
                  value={shareUrl}
                  size={QR_DISPLAY_SIZE}
                  level="L"
                  marginSize={2}
                />
              </div>

              <Button className="w-full" onClick={shareQR}>
                {native
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
