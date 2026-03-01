import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, Wifi, ChevronDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function QRCodePanel({ open, onClose }: Props) {
  const { t } = useTranslation();
  const [ips, setIps] = useState<string[]>([]);
  const [selectedIp, setSelectedIp] = useState<string | null>(null);
  const [port, setPort] = useState<number>(3001);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch('/api/server-info')
      .then((r) => r.json())
      .then(({ ips: detected, port: p }: { ips: string[]; port: number }) => {
        setIps(detected ?? []);
        setSelectedIp(detected?.[0] ?? null);
        setPort(p);
      })
      .catch(() => {});
  }, [open]);

  const url = selectedIp ? `http://${selectedIp}:${port}` : null;

  const copy = () => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="w-5 h-5 text-orange-600" />
            {t('settings.connectMobile')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          {url ? (
            <>
              <div className="p-4 bg-white rounded-xl border shadow-sm">
                <QRCodeSVG value={url} size={200} />
              </div>

              <p className="text-sm text-gray-500 text-center" style={{ whiteSpace: 'pre-line' }}>
                {t('settings.qrHint')}
              </p>

              {/* URL + copy */}
              <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 w-full">
                <code className="text-sm flex-1 truncate text-gray-700">{url}</code>
                <Button size="sm" variant="ghost" onClick={copy} className="shrink-0">
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>

              {/* IP switcher — shown when Windows has multiple adapters */}
              {ips.length > 1 && (
                <div className="w-full space-y-1">
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <ChevronDown className="w-3 h-3" />
                    {t('settings.wrongNetwork')}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {ips.map((ip) => (
                      <button
                        key={ip}
                        onClick={() => setSelectedIp(ip)}
                        className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                          ip === selectedIp
                            ? 'bg-orange-50 border-orange-300 text-orange-700'
                            : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'
                        }`}
                      >
                        {ip}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-400 text-sm py-8">{t('qrPanel.detectingIp')}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
