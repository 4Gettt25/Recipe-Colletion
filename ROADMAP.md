# Roadmap

Features are grouped by priority, not tied to specific version numbers.

---

## Near-Term

### Dark Mode
- Toggle in the Settings sheet alongside the language switcher
- `next-themes` is already installed — just needs `ThemeProvider` wired up

### Export / Backup
- Export all recipes as a JSON file (timestamped filename)
- Import from a previously exported JSON file — skips duplicates by ID

### Print View
- "Print recipe" button on the recipe detail page
- Clean `@media print` stylesheet — shows title, image, ingredients, and steps; hides navigation

---

## Mid-Term

### Shopping List
Two ways to add items:
1. **From recipes** — select one or more recipes and set the portion count → all ingredients are scaled and added automatically
2. **Manual** — free-text input for any item not tied to a recipe

Features: tap to check off items, "Clear checked" button, persisted in the database (desktop) or localStorage (mobile), synced when connected.

### Import Recipe from URL
Paste a link from any recipe website (e.g. chefkoch.de, allrecipes.com) → the app parses the page using structured data ([Schema.org Recipe](https://schema.org/Recipe)) → opens a pre-filled recipe form ready to save.

---

## Long-Term

### Sync & Offline Improvements
- **Offline edit queue** — edit any recipe while disconnected; changes are applied to the server on next connection
- **Conflict resolution** — detect when a recipe was changed on both devices and let the user choose which version to keep
- **Background sync** — automatically sync when network connectivity is detected instead of requiring a manual trigger
