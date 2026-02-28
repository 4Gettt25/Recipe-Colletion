import { useState } from 'react';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { ChefHat, QrCode, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { saveServerUrl } from '@/lib/api';
import { toast } from 'sonner';

interface Props {
  onConnected: () => void;
}

export function ServerConnect({ onConnected }: Props) {
  const [scanning, setScanning] = useState(false);
  const [manualUrl, setManualUrl] = useState('');

  const startScan = async () => {
    setScanning(true);
    try {
      // Request camera permission using Capacitor 8's modern permission API
      const { camera } = await BarcodeScanner.requestPermissions();
      if (camera === 'denied') {
        toast.error('Camera permission denied. Enter the URL manually below.');
        setScanning(false);
        return;
      }

      // Opens a full-screen native scanning activity
      const { barcodes } = await BarcodeScanner.scan({
        formats: [BarcodeFormat.QrCode],
      });

      if (barcodes.length > 0 && barcodes[0].rawValue) {
        saveServerUrl(barcodes[0].rawValue);
        onConnected();
      }
    } catch (e) {
      // User cancelled or scan failed
    } finally {
      setScanning(false);
    }
  };

  const connectManual = () => {
    let url = manualUrl.trim();
    if (!url) return;
    // Be forgiving — add http:// if they left it out
    if (!url.startsWith('http')) url = `http://${url}`;
    saveServerUrl(url);
    onConnected();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 gap-6">
      <div className="flex flex-col items-center gap-3">
        <ChefHat className="w-16 h-16 text-orange-600" />
        <h1 className="text-2xl font-bold text-gray-900">Recipe Collection</h1>
        <p className="text-gray-500 text-center text-sm">
          Connect to your desktop to access your recipes
        </p>
      </div>

      <div className="w-full max-w-xs space-y-4">
        <Button className="w-full" size="lg" onClick={startScan} disabled={scanning}>
          <QrCode className="w-5 h-5 mr-2" />
          {scanning ? 'Opening camera…' : 'Scan QR Code'}
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-gray-50 px-2 text-gray-400 uppercase tracking-wide">
              or enter manually
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="192.168.1.x:3001"
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && connectManual()}
          />
          <Button variant="outline" onClick={connectManual}>
            <Wifi className="w-4 h-4" />
          </Button>
        </div>

        <p className="text-xs text-gray-400 text-center">
          Click "Connect Mobile" on the desktop app to see the QR code
        </p>
      </div>
    </div>
  );
}
