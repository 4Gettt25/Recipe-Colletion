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

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`App running on http://localhost:${PORT}`);
});
