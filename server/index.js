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
  )
`);

// Migrate existing databases that don't have the favourite column yet
try {
  db.exec(`ALTER TABLE recipes ADD COLUMN favourite INTEGER DEFAULT 0`);
} catch (_) {
  // Column already exists — nothing to do
}

const app = express();
app.use(cors());
app.use(express.json());

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

// Serve built frontend in production
const dist = join(__dirname, '../dist');
app.use(express.static(dist));
app.get('*', (_req, res) => res.sendFile(join(dist, 'index.html')));

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`App running on http://localhost:${PORT}`);
});
