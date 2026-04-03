import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { networkInterfaces } from 'os';

// Returns all real local IPv4 addresses, skipping virtual/tunnel adapters.
// On Windows there are often many fake interfaces (Docker, Hyper-V, VirtualBox,
// WSL, VPNs) that appear before the actual Wi-Fi adapter.
function getLocalIPs() {
  const VIRTUAL = ['virtual', 'vmware', 'hyper-v', 'vethernet', 'wsl',
                   'docker', 'bluetooth', 'teredo', 'isatap', 'vpn', 'loopback'];
  const results = [];

  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    const n = name.toLowerCase();
    if (VIRTUAL.some(v => n.includes(v))) continue;
    for (const net of addrs ?? []) {
      if (net.family === 'IPv4' && !net.internal) results.push(net.address);
    }
  }

  // Prefer 192.168.x.x (home Wi-Fi) > 10.x.x.x > anything else
  return results.sort((a, b) => {
    const rank = ip => ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : 2;
    return rank(a) - rank(b);
  });
}

const __dirname = dirname(fileURLToPath(import.meta.url));

const db = new Database(process.env.RECIPES_DB_PATH ?? join(__dirname, 'recipes.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS recipes (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    description TEXT DEFAULT '',
    ingredients TEXT DEFAULT '[]',
    instructions TEXT DEFAULT '[]',
    basePortions INTEGER DEFAULT 2,
    rating      INTEGER DEFAULT 0,
    favourite   INTEGER DEFAULT 0,
    createdAt   TEXT NOT NULL,
    updatedAt   TEXT NOT NULL,
    tags        TEXT DEFAULT '[]',
    imageUrl    TEXT
  );

  CREATE TABLE IF NOT EXISTS shopping_lists (
    id        TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS shopping_items (
    id             TEXT PRIMARY KEY,
    listId         TEXT NOT NULL,
    name           TEXT NOT NULL,
    amount         REAL,
    unit           TEXT,
    checked        INTEGER NOT NULL DEFAULT 0,
    sortOrder      INTEGER NOT NULL DEFAULT 0,
    sourceRecipeId TEXT,
    createdAt      TEXT NOT NULL,
    updatedAt      TEXT NOT NULL
  );
`);

// Migrate existing databases that don't have the favourite column yet
try {
  db.exec(`ALTER TABLE recipes ADD COLUMN favourite INTEGER DEFAULT 0`);
} catch (_) {
  // Column already exists — nothing to do
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

function parse(row) {
  return {
    ...row,
    favourite: row.favourite === 1,
    ingredients: JSON.parse(row.ingredients),
    instructions: JSON.parse(row.instructions),
    tags: JSON.parse(row.tags),
  };
}

function serialize(recipe) {
  return {
    ...recipe,
    favourite: recipe.favourite ? 1 : 0,
    ingredients: JSON.stringify(recipe.ingredients ?? []),
    instructions: JSON.stringify(recipe.instructions ?? []),
    tags: JSON.stringify(recipe.tags ?? []),
    imageUrl: recipe.imageUrl ?? null,
  };
}

// GET all recipes
app.get('/api/recipes', (_req, res) => {
  const rows = db.prepare('SELECT * FROM recipes ORDER BY createdAt DESC').all();
  res.json(rows.map(parse));
});

// POST create recipe
app.post('/api/recipes', (req, res) => {
  const recipe = req.body;
  db.prepare(`
    INSERT INTO recipes (id, title, description, ingredients, instructions, basePortions, rating, favourite, createdAt, updatedAt, tags, imageUrl)
    VALUES (@id, @title, @description, @ingredients, @instructions, @basePortions, @rating, @favourite, @createdAt, @updatedAt, @tags, @imageUrl)
  `).run(serialize(recipe));
  res.json(recipe);
});

// PUT update recipe
app.put('/api/recipes/:id', (req, res) => {
  const { id } = req.params;
  const recipe = req.body;
  db.prepare(`
    UPDATE recipes SET
      title        = @title,
      description  = @description,
      ingredients  = @ingredients,
      instructions = @instructions,
      basePortions = @basePortions,
      rating       = @rating,
      updatedAt    = @updatedAt,
      tags         = @tags,
      imageUrl     = @imageUrl
    WHERE id = @id
  `).run({ ...serialize(recipe), id });
  res.json({ ...recipe, id });
});

// DELETE recipe
app.delete('/api/recipes/:id', (req, res) => {
  db.prepare('DELETE FROM recipes WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// PATCH rating
app.patch('/api/recipes/:id/rating', (req, res) => {
  const { id } = req.params;
  const { rating } = req.body;
  const updatedAt = new Date().toISOString();
  db.prepare('UPDATE recipes SET rating = ?, updatedAt = ? WHERE id = ?').run(rating, updatedAt, id);
  res.json({ id, rating, updatedAt });
});

// GET server info (local IPs + port, used to generate QR code)
app.get('/api/server-info', (_req, res) => {
  const ips = getLocalIPs();
  res.json({ ip: ips[0] ?? '127.0.0.1', ips, port: PORT });
});

// PATCH favourite
app.patch('/api/recipes/:id/favourite', (req, res) => {
  const { id } = req.params;
  const { favourite } = req.body;
  const updatedAt = new Date().toISOString();
  db.prepare('UPDATE recipes SET favourite = ?, updatedAt = ? WHERE id = ?').run(favourite ? 1 : 0, updatedAt, id);
  res.json({ id, favourite, updatedAt });
});

// ─── Import recipe from URL ───────────────────────────────────────────────────

const UNITS = [
  'tsp','teaspoon','teaspoons','tbsp','tablespoon','tablespoons',
  'cup','cups','oz','ounce','ounces','lb','pound','pounds',
  'g','gram','grams','kg','ml','l','liter','liters','litre','litres',
  'pinch','dash','clove','cloves','slice','slices','piece','pieces',
  'can','cans','pkg','package','packages','bunch','bunches',
  'sprig','sprigs','handful','handfuls','stick','sticks',
];

const UNIT_CANON = {
  teaspoon:'tsp', teaspoons:'tsp',
  tablespoon:'tbsp', tablespoons:'tbsp',
  cups:'cup', ounce:'oz', ounces:'oz',
  pound:'lb', pounds:'lb', gram:'g', grams:'g',
  liter:'l', liters:'l', litre:'l', litres:'l',
};

const VULGAR = { '½':'1/2','¼':'1/4','¾':'3/4','⅓':'1/3','⅔':'2/3','⅛':'1/8','⅜':'3/8','⅝':'5/8','⅞':'7/8' };

function stripHtml(str) {
  return String(str ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseAmount(raw) {
  let s = String(raw).trim();
  for (const [vf, dec] of Object.entries(VULGAR)) s = s.replace(new RegExp(vf, 'g'), dec);
  const total = s.split(/\s+/).reduce((sum, part) => {
    if (!part) return sum;
    if (part.includes('/')) {
      const [n, d] = part.split('/');
      return sum + (parseFloat(n) || 0) / (parseFloat(d) || 1);
    }
    const v = parseFloat(part);
    return sum + (isNaN(v) ? 0 : v);
  }, 0);
  return total;
}

function parseIngredientString(raw) {
  const id = Math.random().toString(36).substring(2, 9);
  let s = String(raw ?? '').trim();
  // Replace vulgar fractions
  for (const [vf, dec] of Object.entries(VULGAR)) s = s.replace(new RegExp(vf, 'g'), dec);

  // Peel leading amount
  const amtMatch = s.match(/^([\d\s./]+)/);
  let amount = 0;
  if (amtMatch) {
    amount = parseAmount(amtMatch[1]);
    s = s.slice(amtMatch[1].length).trimStart();
  }

  // Peel unit — lookahead instead of \b so "tsp." matches correctly
  let unit = '';
  const unitPattern = new RegExp(`^(${UNITS.join('|')})(?=[.,\\s]|$)`, 'i');
  const unitMatch = s.match(unitPattern);
  if (unitMatch) {
    const raw_unit = unitMatch[1].toLowerCase();
    unit = UNIT_CANON[raw_unit] ?? raw_unit;
    s = s.slice(unitMatch[1].length).trimStart();
  }

  // Strip leading noise ("of", period after unit, comma, dash)
  s = s.replace(/^(of|,|\.|–|-)\s*/i, '').trim();

  return { id, name: s || raw.trim(), amount, unit };
}

function splitIntoSteps(text) {
  const clean = stripHtml(text);
  if (!clean) return [];
  // Prefer newline splits when present
  const byNewline = clean.split(/\n+/).map(s => s.trim()).filter(Boolean);
  if (byNewline.length > 1) return byNewline;
  // Fallback: split on ". Capital" sentence boundaries (handles single-blob strings)
  const sentences = clean.split(/\.\s+(?=[A-Z])/).map(s => s.trim()).filter(Boolean);
  // Re-add the period that was consumed by the split (last sentence keeps its own punctuation)
  return sentences.map(s => /[.!?]$/.test(s) ? s : s + '.');
}

function normaliseInstructions(raw) {
  if (!raw) return [];
  if (typeof raw === 'string') return splitIntoSteps(raw);
  if (!Array.isArray(raw)) return [];
  const steps = [];
  for (const item of raw) {
    if (typeof item === 'string') { splitIntoSteps(item).forEach(t => steps.push(t)); continue; }
    if (item['@type'] === 'HowToSection' && Array.isArray(item.itemListElement)) {
      for (const sub of item.itemListElement) {
        splitIntoSteps(sub.text || sub.name || '').forEach(t => steps.push(t));
      }
      continue;
    }
    splitIntoSteps(item.text || item.name || '').forEach(t => steps.push(t));
  }
  return steps;
}

function normaliseImage(raw) {
  if (!raw) return undefined;
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) return raw[0] ? normaliseImage(raw[0]) : undefined;
  if (typeof raw === 'object' && raw.url) return raw.url;
  return undefined;
}

function normalisePortions(raw) {
  if (!raw) return 2;
  const m = String(raw).match(/\d+/);
  return m ? parseInt(m[0], 10) : 2;
}

function normaliseTags(ld) {
  const parts = [];
  const push = (v) => {
    if (!v) return;
    if (Array.isArray(v)) v.forEach(push);
    else String(v).split(/[,;]+/).forEach(t => { const s = t.trim(); if (s) parts.push(s); });
  };
  push(ld.keywords); push(ld.recipeCategory); push(ld.recipeCuisine);
  return [...new Set(parts)];
}

function findRecipeLd(parsed) {
  const isRecipe = (node) => {
    if (!node || typeof node !== 'object') return false;
    const t = node['@type'];
    return t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'));
  };
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      const found = findRecipeLd(item);
      if (found) return found;
    }
    return null;
  }
  if (isRecipe(parsed)) return parsed;
  if (Array.isArray(parsed['@graph'])) {
    for (const node of parsed['@graph']) { if (isRecipe(node)) return node; }
  }
  return null;
}

app.post('/api/recipes/import-url', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ message: 'No URL provided.' });

  let parsed;
  try { parsed = new URL(url); } catch {
    return res.status(400).json({ message: 'Invalid URL.' });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return res.status(400).json({ message: 'Only http and https URLs are supported.' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  let html;
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0',
      },
    });
    if (!response.ok) return res.status(400).json({ message: `Could not fetch the page (HTTP ${response.status}).` });
    html = await response.text();
  } catch (err) {
    if (err.name === 'AbortError') return res.status(400).json({ message: 'The request timed out. Try again.' });
    return res.status(400).json({ message: `Failed to fetch the URL: ${err.message}` });
  } finally {
    clearTimeout(timeout);
  }

  // Extract all JSON-LD blocks
  const ldBlocks = [];
  const ldRegex = /<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = ldRegex.exec(html)) !== null) {
    try { ldBlocks.push(JSON.parse(match[1])); } catch { /* skip malformed */ }
  }

  if (ldBlocks.length === 0) return res.status(400).json({ message: 'No structured data found on that page.' });

  let ld = null;
  for (const block of ldBlocks) { ld = findRecipeLd(block); if (ld) break; }
  if (!ld) return res.status(400).json({ message: 'No Recipe data found on that page.' });

  const result = {
    title: stripHtml(ld.name || ''),
    description: stripHtml(ld.description || ''),
    ingredients: (ld.recipeIngredient || []).map(parseIngredientString),
    instructions: normaliseInstructions(ld.recipeInstructions),
    basePortions: normalisePortions(ld.recipeYield),
    imageUrl: normaliseImage(ld.image),
    tags: normaliseTags(ld),
    rating: 0,
    favourite: false,
  };

  res.json(result);
});

// ─── Shopping list helpers ────────────────────────────────────────────────────

function parseItem(row) {
  return {
    ...row,
    checked: row.checked === 1,
    amount: row.amount ?? null,
    unit: row.unit ?? null,
    sourceRecipeId: row.sourceRecipeId ?? null,
  };
}

// GET all shopping lists
app.get('/api/shopping-lists', (_req, res) => {
  const rows = db.prepare('SELECT * FROM shopping_lists ORDER BY createdAt DESC').all();
  res.json(rows);
});

// POST create shopping list
app.post('/api/shopping-lists', (req, res) => {
  const { id, name, createdAt, updatedAt } = req.body;
  db.prepare(`
    INSERT INTO shopping_lists (id, name, createdAt, updatedAt)
    VALUES (@id, @name, @createdAt, @updatedAt)
  `).run({ id, name, createdAt, updatedAt });
  res.json({ id, name, createdAt, updatedAt });
});

// DELETE shopping list (and its items)
app.delete('/api/shopping-lists/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM shopping_items WHERE listId = ?').run(id);
  db.prepare('DELETE FROM shopping_lists WHERE id = ?').run(id);
  res.json({ success: true });
});

// GET items for a list
app.get('/api/shopping-lists/:id/items', (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM shopping_items WHERE listId = ? ORDER BY sortOrder ASC'
  ).all(req.params.id);
  res.json(rows.map(parseItem));
});

// POST add one item to a list
app.post('/api/shopping-lists/:id/items', (req, res) => {
  const { id: listId } = req.params;
  const { id, name, amount, unit, checked, sortOrder, sourceRecipeId, createdAt, updatedAt } = req.body;
  db.prepare(`
    INSERT INTO shopping_items (id, listId, name, amount, unit, checked, sortOrder, sourceRecipeId, createdAt, updatedAt)
    VALUES (@id, @listId, @name, @amount, @unit, @checked, @sortOrder, @sourceRecipeId, @createdAt, @updatedAt)
  `).run({
    id, listId, name,
    amount: amount ?? null,
    unit: unit ?? null,
    checked: checked ? 1 : 0,
    sortOrder: sortOrder ?? 0,
    sourceRecipeId: sourceRecipeId ?? null,
    createdAt, updatedAt,
  });
  res.json(parseItem(db.prepare('SELECT * FROM shopping_items WHERE id = ?').get(id)));
});

// POST bulk-add items to a list (transaction)
app.post('/api/shopping-lists/:id/items/bulk', (req, res) => {
  const { id: listId } = req.params;
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.json({ inserted: 0 });
  }
  const insert = db.prepare(`
    INSERT INTO shopping_items (id, listId, name, amount, unit, checked, sortOrder, sourceRecipeId, createdAt, updatedAt)
    VALUES (@id, @listId, @name, @amount, @unit, @checked, @sortOrder, @sourceRecipeId, @createdAt, @updatedAt)
  `);
  const insertMany = db.transaction((rows) => {
    for (const item of rows) {
      insert.run({
        id: item.id,
        listId,
        name: item.name,
        amount: item.amount ?? null,
        unit: item.unit ?? null,
        checked: item.checked ? 1 : 0,
        sortOrder: item.sortOrder ?? 0,
        sourceRecipeId: item.sourceRecipeId ?? null,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      });
    }
  });
  insertMany(items);
  res.json({ inserted: items.length });
});

// PATCH update a single item (toggle checked, edit name, etc.)
app.patch('/api/shopping-lists/:id/items/:itemId', (req, res) => {
  const { itemId } = req.params;
  const updatedAt = new Date().toISOString();
  const existing = db.prepare('SELECT * FROM shopping_items WHERE id = ?').get(itemId);
  if (!existing) return res.status(404).json({ error: 'Item not found' });

  const patch = {
    name: req.body.name ?? existing.name,
    amount: 'amount' in req.body ? (req.body.amount ?? null) : existing.amount,
    unit: 'unit' in req.body ? (req.body.unit ?? null) : existing.unit,
    checked: 'checked' in req.body ? (req.body.checked ? 1 : 0) : existing.checked,
    sortOrder: req.body.sortOrder ?? existing.sortOrder,
    updatedAt,
  };

  db.prepare(`
    UPDATE shopping_items
    SET name = @name, amount = @amount, unit = @unit, checked = @checked,
        sortOrder = @sortOrder, updatedAt = @updatedAt
    WHERE id = @itemId
  `).run({ ...patch, itemId });

  res.json(parseItem({ ...existing, ...patch }));
});

// DELETE one item
app.delete('/api/shopping-lists/:id/items/:itemId', (req, res) => {
  db.prepare('DELETE FROM shopping_items WHERE id = ?').run(req.params.itemId);
  res.json({ success: true });
});

// DELETE all checked items in a list
app.delete('/api/shopping-lists/:id/items', (req, res) => {
  const { id: listId } = req.params;
  if (req.query.checked === 'true') {
    db.prepare('DELETE FROM shopping_items WHERE listId = ? AND checked = 1').run(listId);
  }
  res.json({ success: true });
});

// Generic error handler — catches body-parser 413, JSON parse errors, etc.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  console.error(`[server error] ${status}:`, err.message);
  res.status(status).json({ error: err.message });
});

// Serve built frontend in production
const dist = join(__dirname, '../dist');
app.use(express.static(dist));
app.get('*', (_req, res) => res.sendFile(join(dist, 'index.html')));

const PORT = 51739;
app.listen(PORT, () => {
  console.log(`App running on http://localhost:${PORT}`);
});
