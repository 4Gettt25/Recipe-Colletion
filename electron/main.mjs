import { app, BrowserWindow, Tray, Menu, dialog, shell } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let win = null;
let tray = null;
let isQuitting = false;

// Set the DB path before the server module is imported.
// In dev mode: use the existing server/recipes.db so data is shared with `npm run start`.
// In packaged mode: use the OS user-data directory (writable, survives updates).
if (app.isPackaged) {
  process.env.RECIPES_DB_PATH = join(app.getPath('userData'), 'recipes.db');
} else {
  process.env.RECIPES_DB_PATH = fileURLToPath(new URL('../server/recipes.db', import.meta.url));
}

// Register as default handler for recipes:// deep links.
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('recipes', process.execPath, [resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('recipes');
}

// Enforce single instance. If a second instance is launched with --quit
// (by the installer), signal this instance to exit gracefully.
const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  // We are the second instance — the first instance will receive second-instance
  // event below. Exit immediately so the installer can proceed.
  app.exit(0);
} else {
  app.on('second-instance', (_event, commandLine) => {
    if (commandLine.includes('--quit')) {
      // Installer is asking us to quit gracefully before updating.
      isQuitting = true;
      app.quit();
    } else {
      // Another launch attempt — bring the window to front.
      if (win) { win.show(); win.focus(); }
      // Check if launched via a recipes:// deep link (Windows passes it as last argv)
      const deepLinkUrl = commandLine.find(a => a.startsWith('recipes://'));
      if (deepLinkUrl && win) {
        win.webContents.send('deep-link-url', deepLinkUrl);
      }
    }
  });

  // macOS: deep link arrives via open-url event
  app.on('open-url', (event, url) => {
    event.preventDefault();
    if (win) {
      win.show();
      win.focus();
      win.webContents.send('deep-link-url', url);
    }
  });

  async function startServer() {
    await import('../server/index.js');
  }

  async function waitForServer(retries = 30) {
    for (let i = 0; i < retries; i++) {
      try {
        await fetch('http://localhost:51739/api/recipes');
        return;
      } catch {
        await new Promise(r => setTimeout(r, 200));
      }
    }
    throw new Error('Recipe server failed to start on port 51739');
  }

  function createWindow() {
    win = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      title: 'Recipe Collection',
      icon: join(__dirname, 'resources', 'icon.png'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: join(__dirname, 'preload.cjs'),
      },
    });

    win.loadURL('http://localhost:51739');

    // Close hides to tray instead of quitting
    win.on('close', (e) => {
      if (!isQuitting) {
        e.preventDefault();
        win.hide();
      }
    });
  }

  function createTray() {
    tray = new Tray(join(__dirname, 'resources', 'icon.png'));

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open Recipe Collection',
        click: () => { win.show(); win.focus(); },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => { isQuitting = true; app.quit(); },
      },
    ]);

    tray.setToolTip('Recipe Collection');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => { win.show(); win.focus(); });
  }

  function setupAutoUpdater() {
    // Only check for updates in packaged builds
    if (!app.isPackaged) return;

    autoUpdater.autoDownload = true;
    // We launch the installer ourselves via PowerShell so we can guarantee
    // the entire Electron process tree is dead before NSIS starts.
    autoUpdater.autoInstallOnAppQuit = false;

    autoUpdater.on('update-available', (info) => {
      dialog.showMessageBox({ type: 'info', title: 'Update available', message: `Version ${info.version} is downloading...` });
    });
    autoUpdater.on('update-not-available', (info) => {
      console.log('No update available, current:', info.version);
    });
    autoUpdater.on('error', (err) => {
      dialog.showMessageBox({ type: 'error', title: 'Update error', message: err.message });
    });
    autoUpdater.on('update-downloaded', (info) => {
      dialog.showMessageBox({
        type: 'info',
        title: 'Update ready',
        message: 'A new version has been downloaded. The app will close and install it.',
        buttons: ['Install now', 'Later'],
      }).then(async ({ response }) => {
        if (response !== 0) return;
        isQuitting = true;
        if (info.downloadedFile) {
          // shell.openPath triggers the installer as an independent OS process
          // so it survives the parent exiting and UAC prompts appear correctly.
          await shell.openPath(info.downloadedFile);
          app.exit(0);
        } else {
          autoUpdater.quitAndInstall(false, true);
        }
      });
    });

    autoUpdater.checkForUpdates().catch((err) => {
      autoUpdater.logger.error('checkForUpdates failed:', err.message);
    });
  }

  app.whenReady().then(async () => {
    await startServer();
    await waitForServer();
    createWindow();
    createTray();
    setupAutoUpdater();

    // Handle cold-start deep link on Windows (URL passed as argv)
    const coldStartUrl = process.argv.find(a => a.startsWith('recipes://'));
    if (coldStartUrl) {
      win.webContents.once('did-finish-load', () => {
        win.webContents.send('deep-link-url', coldStartUrl);
      });
    }
  });

  // Don't auto-quit when all windows are closed — we live in the tray
  app.on('window-all-closed', () => {});
}
