import { useEffect, useState, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { Monitor, Smartphone, Wifi, LogOut, RefreshCw, Copy, Check, ChevronDown, Globe } from 'lucide-react';

declare const __APP_VERSION__: string;
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { isNative, getServerUrl, saveServerUrl, clearServerUrl } from '@/lib/api';
import { isShareUrl } from '@/lib/shareRecipe';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n/i18n';

interface Props {
  open: boolean;
  onClose: () => void;
  localRecipeCount: number;
  onSyncToServer: () => Promise<void>;
  connectionError: string | false;
  onShareUrl?: (url: string) => void;
}

export function SettingsSheet({ open, onClose, localRecipeCount, onSyncToServer, connectionError, onShareUrl }: Props) {
  const { t } = useTranslation();
  const native = isNative();
  const serverUrl = getServerUrl();
  const connected = native && !!serverUrl;

  const [ips, setIps] = useState<string[]>([]);
  const [selectedIp, setSelectedIp] = useState<string | null>(null);
  const [port, setPort] = useState<number>(51739);
  const [copied, setCopied] = useState(false);

  const [manualUrl, setManualUrl] = useState('');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!open || native) return;
    fetch('/api/server-info')
      .then(r => r.json())
      .then(({ ips: detected, port: p }: { ips: string[]; port: number }) => {
        setIps(detected ?? []);
        setSelectedIp(detected?.[0] ?? null);
        setPort(p);
      })
      .catch(() => {});
  }, [open, native]);

  const qrUrl = selectedIp ? `http://${selectedIp}:${port}` : null;

  const copy = () => {
    if (!qrUrl) return;
    navigator.clipboard.writeText(qrUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startScan = useCallback(async () => {
    try {
      const { barcodes } = await BarcodeScanner.scan({
        formats: [BarcodeFormat.QrCode],
      });
      const rawValue = barcodes[0]?.rawValue;
      if (rawValue) {
        if (isShareUrl(rawValue) && onShareUrl) {
          onShareUrl(rawValue);
          onClose();
        } else {
          saveServerUrl(rawValue);
          window.location.reload();
        }
      }
    } catch (err) {
      toast.error('Scan failed: ' + (err instanceof Error ? err.message : String(err)));
    }
  }, [onShareUrl, onClose]);

  const connectManual = useCallback(() => {
    let url = manualUrl.trim();
    if (!url) return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `http://${url}`;
    }
    saveServerUrl(url);
    window.location.reload();
  }, [manualUrl]);

  const disconnect = useCallback(() => {
    clearServerUrl();
    window.location.reload();
  }, []);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await onSyncToServer();
      toast.success(t('toast.syncedToDesktop'));
    } catch {
      toast.error(t('toast.syncFailed'));
    } finally {
      setSyncing(false);
    }
  }, [onSyncToServer, t]);

  const currentLang = i18n.resolvedLanguage ?? 'en';

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t('settings.title')}</SheetTitle>
        </SheetHeader>

        <div className="px-4 pb-6 flex flex-col gap-6">
          {/* Desktop section: QR code for mobile to scan */}
          {!native && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-gray-500" />
                <span className="font-medium text-sm">{t('settings.connectMobile')}</span>
              </div>
              {qrUrl ? (
                <>
                  <div className="flex justify-center">
                    <div className="p-3 bg-white rounded-xl border shadow-sm inline-block">
                      <QRCodeSVG value={qrUrl} size={180} />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 text-center" style={{ whiteSpace: 'pre-line' }}>
                    {t('settings.qrHint')}
                  </p>
                  <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
                    <code className="text-sm flex-1 truncate text-gray-700">{qrUrl}</code>
                    <Button size="sm" variant="ghost" onClick={copy} className="shrink-0">
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                  {ips.length > 1 && (
                    <div className="space-y-1">
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <ChevronDown className="w-3 h-3" />
                        {t('settings.wrongNetwork')}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {ips.map(ip => (
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
                <p className="text-gray-400 text-sm py-4 text-center">{t('settings.detecting')}</p>
              )}
            </div>
          )}

          {/* Mobile section: connect/disconnect controls */}
          {native && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-gray-500" />
                <span className="font-medium text-sm">{t('settings.desktopConnection')}</span>
              </div>
              {connected ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 text-xs font-medium">
                      <Wifi className="w-3 h-3" />
                      {serverUrl}
                    </span>
                  </div>
                  {connectionError && (
                    <p className="text-xs text-red-500 break-all">{t('settings.error', { message: connectionError })}</p>
                  )}
                  <Button size="sm" variant="outline" onClick={disconnect} className="w-fit">
                    <LogOut className="w-3.5 h-3.5 mr-1.5" />
                    {t('settings.disconnect')}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <Button size="sm" onClick={startScan}>
                    {t('settings.scanQR')}
                  </Button>
                  <div className="flex items-center gap-2">
                    <Separator className="flex-1" />
                    <span className="text-xs text-gray-400">{t('settings.orManually')}</span>
                    <Separator className="flex-1" />
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="192.168.1.x:51739"
                      value={manualUrl}
                      onChange={e => setManualUrl(e.target.value)}
                      className="text-sm"
                    />
                    <Button size="sm" onClick={connectManual}>
                      {t('settings.connect')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sync section: only shown on mobile when connected */}
          {native && connected && (
            <>
              <Separator />
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-gray-500" />
                  <span className="font-medium text-sm">{t('settings.sync')}</span>
                </div>
                {localRecipeCount > 0 ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm text-gray-600">
                      {t('settings.localRecipes', { count: localRecipeCount })}
                    </p>
                    <Button size="sm" onClick={handleSync} disabled={syncing} className="w-fit">
                      <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
                      {t('settings.syncToDesktop')}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">{t('settings.allSynced')}</p>
                )}
              </div>
            </>
          )}

          <Separator />

          {/* Language selector */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-gray-500" />
              <span className="font-medium text-sm">{t('settings.language')}</span>
            </div>
            <Select value={currentLang} onValueChange={(lang) => i18n.changeLanguage(lang)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />
          <p className="text-xs text-gray-400 text-center">{t('settings.version', { version: __APP_VERSION__ })}</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
