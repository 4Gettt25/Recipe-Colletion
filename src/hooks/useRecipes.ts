import { useState, useEffect, useCallback } from 'react';
import type { Recipe, RecipeFormData } from '@/types/recipe';
import { isNative, getServerUrl, LOCAL_RECIPES_KEY } from '@/lib/api';

const LEGACY_LS_KEY = 'recipe-collection-data';

function loadLocalRecipes(): Recipe[] {
  try {
    const stored = localStorage.getItem(LOCAL_RECIPES_KEY);
    if (!stored) return [];
    return (JSON.parse(stored) as Recipe[]).map(r => ({ ...r, source: 'local' as const }));
  } catch { return []; }
}

function persistLocalRecipes(recipes: Recipe[]): void {
  localStorage.setItem(LOCAL_RECIPES_KEY,
    JSON.stringify(recipes.map(({ source: _s, ...r }) => r)));
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export function useRecipes() {
  const [localRecipesRaw, setLocalRecipesRaw] = useState<Recipe[]>([]);
  const [serverRecipes, setServerRecipes] = useState<Recipe[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [connectionError, setConnectionError] = useState<string | false>(false);

  const native = isNative();
  const serverUrl = getServerUrl();
  const apiBase = native ? (serverUrl ? `${serverUrl}/api` : null) : '/api';

  const setLocalRecipes = useCallback((updater: Recipe[] | ((prev: Recipe[]) => Recipe[])) => {
    setLocalRecipesRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      persistLocalRecipes(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!native) return;
    setLocalRecipesRaw(loadLocalRecipes());
  }, [native]);

  useEffect(() => {
    if (apiBase === null) { setIsLoaded(true); return; }
    fetch(`${apiBase}/recipes`)
      .then(r => r.json())
      .then(async (data: Recipe[]) => {
        if (data.length === 0) {
          const stored = localStorage.getItem(LEGACY_LS_KEY);
          if (stored) {
            try {
              const legacy: Recipe[] = JSON.parse(stored);
              if (legacy.length > 0) {
                await Promise.all(legacy.map(recipe =>
                  fetch(`${apiBase}/recipes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(recipe) })
                ));
                localStorage.removeItem(LEGACY_LS_KEY);
                setServerRecipes(legacy.map(r => ({ ...r, source: 'server' as const })));
                setIsLoaded(true);
                return;
              }
            } catch {}
          }
        }
        setServerRecipes(data.map(r => ({ ...r, source: 'server' as const })));
        setIsLoaded(true);
      })
      .catch(err => { setConnectionError(err?.message || String(err)); setIsLoaded(true); });
  }, [apiBase]);

  const localRecipes = localRecipesRaw;

  // When connected: server recipes that also exist locally are 'saved' (offline copy).
  // Deduplicate so saved recipes only appear once (in the server list).
  const recipes: Recipe[] = !native
    ? serverRecipes
    : serverUrl
      ? [
          ...serverRecipes.map(r => ({
            ...r,
            source: localRecipes.some(l => l.id === r.id) ? 'saved' as const : 'server' as const,
          })),
          ...localRecipes.filter(l => !serverRecipes.some(s => s.id === l.id)),
        ]
      : localRecipes;

  const addRecipe = useCallback(async (formData: RecipeFormData) => {
    const newRecipe: Recipe = {
      ...formData,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (apiBase === null) {
      setLocalRecipes(prev => [{ ...newRecipe, source: 'local' as const }, ...prev]);
    } else {
      await fetch(`${apiBase}/recipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecipe),
      });
      setServerRecipes(prev => [{ ...newRecipe, source: 'server' as const }, ...prev]);
    }
    return newRecipe.id;
  }, [apiBase, setLocalRecipes]);

  const updateRecipe = useCallback(async (id: string, formData: RecipeFormData) => {
    const updated = { ...formData, updatedAt: new Date().toISOString() };
    if (localRecipes.some(r => r.id === id)) {
      setLocalRecipes(prev =>
        prev.map(r => r.id === id ? { ...r, ...updated, source: 'local' as const } : r)
      );
    } else {
      await fetch(`${apiBase}/recipes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      setServerRecipes(prev =>
        prev.map(r => r.id === id ? { ...r, ...updated } : r)
      );
    }
  }, [apiBase, localRecipes, setLocalRecipes]);

  const deleteRecipe = useCallback(async (id: string) => {
    if (localRecipes.some(r => r.id === id)) {
      setLocalRecipes(prev => prev.filter(r => r.id !== id));
    } else {
      await fetch(`${apiBase}/recipes/${id}`, { method: 'DELETE' });
      setServerRecipes(prev => prev.filter(r => r.id !== id));
    }
  }, [apiBase, localRecipes, setLocalRecipes]);

  const toggleFavourite = useCallback(async (id: string) => {
    if (localRecipes.some(r => r.id === id)) {
      setLocalRecipes(prev =>
        prev.map(r => r.id === id ? { ...r, favourite: !r.favourite } : r)
      );
    } else {
      const recipe = serverRecipes.find(r => r.id === id);
      if (!recipe) return;
      const favourite = !recipe.favourite;
      await fetch(`${apiBase}/recipes/${id}/favourite`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favourite }),
      });
      setServerRecipes(prev =>
        prev.map(r => r.id === id ? { ...r, favourite } : r)
      );
    }
  }, [apiBase, localRecipes, serverRecipes, setLocalRecipes]);

  const updateRating = useCallback(async (id: string, rating: number) => {
    if (localRecipes.some(r => r.id === id)) {
      setLocalRecipes(prev =>
        prev.map(r => r.id === id ? { ...r, rating } : r)
      );
    } else {
      const result = await fetch(`${apiBase}/recipes/${id}/rating`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
      }).then(r => r.json());
      setServerRecipes(prev =>
        prev.map(r => r.id === id ? { ...r, rating, updatedAt: result.updatedAt } : r)
      );
    }
  }, [apiBase, localRecipes, setLocalRecipes]);

  const saveToPhone = useCallback((id: string) => {
    const recipe = serverRecipes.find(r => r.id === id);
    if (!recipe || localRecipes.some(l => l.id === id)) return;
    setLocalRecipes(prev => [...prev, { ...recipe, source: 'local' as const }]);
  }, [serverRecipes, localRecipes, setLocalRecipes]);

  const syncToServer = useCallback(async () => {
    if (!apiBase) return;
    // Only upload recipes that don't already exist on the server (skip saved copies)
    const serverIds = new Set(serverRecipes.map(r => r.id));
    const toSync = localRecipes.filter(r => !serverIds.has(r.id));
    if (toSync.length === 0) return;
    await Promise.all(
      toSync.map(({ source: _s, ...recipe }) =>
        fetch(`${apiBase}/recipes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(recipe),
        }).catch(() => {})
      )
    );
    const idsToRemove = new Set(toSync.map(r => r.id));
    setServerRecipes(prev => [...prev, ...toSync.map(r => ({ ...r, source: 'server' as const }))]);
    setLocalRecipes(prev => prev.filter(r => !idsToRemove.has(r.id)));
  }, [apiBase, localRecipes, serverRecipes, setLocalRecipes]);

  return {
    recipes,
    isLoaded,
    connectionError,
    // Only count truly phone-only recipes (not saved server copies)
    localRecipeCount: localRecipes.filter(r => !serverRecipes.some(s => s.id === r.id)).length,
    addRecipe,
    saveToPhone,
    updateRecipe,
    deleteRecipe,
    updateRating,
    toggleFavourite,
    syncToServer,
  };
}
