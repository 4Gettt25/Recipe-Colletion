import { app, BrowserWindow, Tray, Menu } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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

async function startServer() {
  await import('../server/index.js');
}

async function waitForServer(retries = 30) {
  for (let i = 0; i < retries; i++) {
    try {
      await fetch('http://localhost:3001/api/recipes');
      return;
    } catch {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  throw new Error('Recipe server failed to start on port 3001');
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
    },
  });

  win.loadURL('http://localhost:3001');

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

app.whenReady().then(async () => {
  await startServer();
  await waitForServer();
  createWindow();
  createTray();
});

// Don't auto-quit when all windows are closed — we live in the tray
app.on('window-all-closed', () => {});
