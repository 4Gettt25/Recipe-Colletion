import { useState, useEffect, useCallback, useRef } from 'react';
import type { ShoppingList, ShoppingItem, ShoppingItemDraft } from '@/types/shoppingList';
import {
  isNative,
  getServerUrl,
  LOCAL_LISTS_KEY,
  SERVER_LISTS_CACHE_KEY,
  SERVER_ITEMS_CACHE_PREFIX,
} from '@/lib/api';

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function now(): string {
  return new Date().toISOString();
}

/** Strip client-only _dirty flag before sending to server */
function toServerItem(item: ShoppingItem): Omit<ShoppingItem, '_dirty'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _dirty, ...rest } = item;
  return rest;
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

function loadLocalLists(): ShoppingList[] {
  try {
    const stored = localStorage.getItem(LOCAL_LISTS_KEY);
    return stored ? (JSON.parse(stored) as ShoppingList[]) : [];
  } catch { return []; }
}

function persistLocalLists(lists: ShoppingList[]): void {
  localStorage.setItem(LOCAL_LISTS_KEY, JSON.stringify(lists));
}

function loadServerListsCache(): ShoppingList[] {
  try {
    const stored = localStorage.getItem(SERVER_LISTS_CACHE_KEY);
    return stored ? (JSON.parse(stored) as ShoppingList[]) : [];
  } catch { return []; }
}

function cacheServerLists(lists: ShoppingList[]): void {
  try {
    localStorage.setItem(SERVER_LISTS_CACHE_KEY, JSON.stringify(lists));
  } catch { /* storage full */ }
}

function loadItemsCache(listId: string): ShoppingItem[] {
  try {
    const stored = localStorage.getItem(`${SERVER_ITEMS_CACHE_PREFIX}-${listId}`);
    return stored ? (JSON.parse(stored) as ShoppingItem[]) : [];
  } catch { return []; }
}

function cacheItems(listId: string, items: ShoppingItem[]): void {
  try {
    localStorage.setItem(`${SERVER_ITEMS_CACHE_PREFIX}-${listId}`, JSON.stringify(items));
  } catch { /* storage full */ }
}

function removeItemsCache(listId: string): void {
  localStorage.removeItem(`${SERVER_ITEMS_CACHE_PREFIX}-${listId}`);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useShoppingLists() {
  const [serverLists, setServerLists] = useState<ShoppingList[]>([]);
  const [localLists, setLocalListsRaw] = useState<ShoppingList[]>([]);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [connectionError, setConnectionError] = useState<string | false>(false);

  const native = isNative();
  const serverUrl = getServerUrl();
  const apiBase = native ? (serverUrl ? `${serverUrl}/api` : null) : '/api';

  // Track previous connectionError to detect reconnection
  const prevConnectionError = useRef<string | false>(false);
  // Track active list id in a ref so async callbacks can guard stale updates
  const activeListIdRef = useRef<string | null>(null);
  activeListIdRef.current = activeListId;

  const setLocalLists = useCallback((updater: ShoppingList[] | ((prev: ShoppingList[]) => ShoppingList[])) => {
    setLocalListsRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      persistLocalLists(next);
      return next;
    });
  }, []);

  // Combined list: server lists + local-only lists (no duplicates)
  const lists: ShoppingList[] = (() => {
    const serverIds = new Set(serverLists.map(l => l.id));
    return [
      ...serverLists,
      ...localLists.filter(l => !serverIds.has(l.id)),
    ];
  })();

  // Load local lists on startup (mobile only)
  useEffect(() => {
    if (!native) return;
    setLocalListsRaw(loadLocalLists());
  }, [native]);

  // Initial fetch of lists from server (with cache fallback)
  useEffect(() => {
    if (apiBase === null) { setIsLoaded(true); return; }
    fetch(`${apiBase}/shopping-lists`)
      .then(r => r.json())
      .then((data: ShoppingList[]) => {
        cacheServerLists(data);
        setServerLists(data);
        setConnectionError(false);
        setIsLoaded(true);
      })
      .catch(err => {
        const cached = loadServerListsCache();
        if (cached.length > 0) setServerLists(cached);
        setConnectionError((err as Error)?.message || String(err));
        setIsLoaded(true);
      });
  }, [apiBase]);

  // Poll for list changes every 30 seconds
  useEffect(() => {
    if (apiBase === null) return;
    const poll = async () => {
      try {
        const data: ShoppingList[] = await fetch(`${apiBase}/shopping-lists`).then(r => r.json());
        cacheServerLists(data);
        setServerLists(data);
        setConnectionError(false);
      } catch (err: unknown) {
        setConnectionError((err as Error)?.message || String(err));
      }
    };
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, [apiBase]);

  // Load items when activeListId changes
  useEffect(() => {
    if (!activeListId) {
      setItems([]);
      return;
    }
    // Load from cache immediately
    const cached = loadItemsCache(activeListId);
    if (cached.length > 0) setItems(cached);

    if (!apiBase) return;
    fetch(`${apiBase}/shopping-lists/${activeListId}/items`)
      .then(r => r.json())
      .then((data: ShoppingItem[]) => {
        cacheItems(activeListId, data);
        setItems(data);
        setConnectionError(false);
      })
      .catch(err => {
        setConnectionError((err as Error)?.message || String(err));
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeListId, apiBase]);

  // Auto sync dirty items on reconnection
  useEffect(() => {
    const wasError = prevConnectionError.current;
    prevConnectionError.current = connectionError;
    if (wasError && !connectionError && activeListId && apiBase) {
      syncDirtyItems(activeListId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionError]);

  // ─── syncDirtyItems ─────────────────────────────────────────────────────────

  const syncDirtyItems = useCallback(async (listId: string) => {
    if (!apiBase) return;
    const dirtyItems = items.filter(i => i._dirty);
    if (dirtyItems.length === 0) return;
    await Promise.all(
      dirtyItems.map(item =>
        fetch(`${apiBase}/shopping-lists/${listId}/items/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toServerItem(item)),
        }).catch(() => { /* keep dirty on failure */ })
      )
    );
    // Re-fetch to get clean state
    const data: ShoppingItem[] = await fetch(`${apiBase}/shopping-lists/${listId}/items`)
      .then(r => r.json())
      .catch(() => items);
    cacheItems(listId, data);
    setItems(data);
  }, [apiBase, items]);

  // ─── CRUD ────────────────────────────────────────────────────────────────────

  const createList = useCallback(async (name: string) => {
    const list: ShoppingList = {
      id: generateId(),
      name,
      createdAt: now(),
      updatedAt: now(),
    };
    if (!apiBase) {
      setLocalLists(prev => [list, ...prev]);
      return;
    }
    try {
      await fetch(`${apiBase}/shopping-lists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(list),
      });
      setServerLists(prev => [list, ...prev]);
    } catch {
      if (native) {
        setLocalLists(prev => [list, ...prev]);
      } else {
        throw new Error('Failed to create list');
      }
    }
  }, [apiBase, native, setLocalLists]);

  const deleteList = useCallback(async (id: string) => {
    // Check if it's a local-only list
    const isLocal = localLists.some(l => l.id === id) && !serverLists.some(l => l.id === id);
    if (isLocal) {
      setLocalLists(prev => prev.filter(l => l.id !== id));
      removeItemsCache(id);
      if (activeListId === id) setActiveListId(null);
      return;
    }
    if (apiBase) {
      await fetch(`${apiBase}/shopping-lists/${id}`, { method: 'DELETE' });
    }
    setServerLists(prev => prev.filter(l => l.id !== id));
    removeItemsCache(id);
    if (activeListId === id) setActiveListId(null);
  }, [apiBase, localLists, serverLists, activeListId, setLocalLists]);

  const addItem = useCallback(async (listId: string, draft: ShoppingItemDraft) => {
    const item: ShoppingItem = {
      ...draft,
      id: generateId(),
      listId,
      createdAt: now(),
      updatedAt: now(),
    };
    // Optimistic update
    setItems(prev => {
      const next = [...prev, item];
      cacheItems(listId, next);
      return next;
    });
    if (!apiBase) return;
    try {
      await fetch(`${apiBase}/shopping-lists/${listId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toServerItem(item)),
      });
    } catch {
      // Keep local item; mark dirty so it syncs later
      setItems(prev => {
        const next = prev.map(i => i.id === item.id ? { ...i, _dirty: true } : i);
        cacheItems(listId, next);
        return next;
      });
    }
  }, [apiBase]);

  const addItems = useCallback(async (listId: string, drafts: ShoppingItemDraft[]) => {
    const timestamp = now();
    const newItems: ShoppingItem[] = drafts.map(d => ({
      ...d,
      id: generateId(),
      listId,
      createdAt: timestamp,
      updatedAt: timestamp,
    }));
    // Optimistic update
    setItems(prev => {
      const next = [...prev, ...newItems];
      cacheItems(listId, next);
      return next;
    });
    if (!apiBase) return;
    try {
      await fetch(`${apiBase}/shopping-lists/${listId}/items/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: newItems.map(toServerItem) }),
      });
    } catch {
      // Mark all new items dirty
      setItems(prev => {
        const newIds = new Set(newItems.map(i => i.id));
        const next = prev.map(i => newIds.has(i.id) ? { ...i, _dirty: true } : i);
        cacheItems(listId, next);
        return next;
      });
    }
  }, [apiBase]);

  const toggleItem = useCallback(async (listId: string, itemId: string) => {
    // Optimistic update with _dirty flag
    let toggled: ShoppingItem | undefined;
    setItems(prev => {
      const next = prev.map(i => {
        if (i.id !== itemId) return i;
        toggled = { ...i, checked: !i.checked, updatedAt: now(), _dirty: true };
        return toggled;
      });
      cacheItems(listId, next);
      return next;
    });

    if (!apiBase || !toggled) return;
    try {
      await fetch(`${apiBase}/shopping-lists/${listId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checked: toggled.checked }),
      });
      // Clear dirty flag on success
      setItems(prev => {
        const next = prev.map(i => i.id === itemId ? { ...i, _dirty: false } : i);
        cacheItems(listId, next);
        return next;
      });
    } catch {
      // Keep _dirty: true so syncDirtyItems can retry later
    }
  }, [apiBase]);

  const clearChecked = useCallback(async (listId: string) => {
    // Capture exact IDs to delete — don't rely on server checked state, which
    // may lag behind if toggleItem PATCHes are still in-flight.
    const clearedIds = items.filter(i => i.checked).map(i => i.id);
    if (clearedIds.length === 0) return;

    // Optimistic
    const clearedSet = new Set(clearedIds);
    setItems(prev => {
      const next = prev.filter(i => !clearedSet.has(i.id));
      cacheItems(listId, next);
      return next;
    });
    if (!apiBase) return;
    try {
      // Delete each item by ID so the server removes exactly what we cleared,
      // regardless of whether the checked PATCH has arrived yet.
      await Promise.all(
        clearedIds.map(id =>
          fetch(`${apiBase}/shopping-lists/${listId}/items/${id}`, { method: 'DELETE' })
        )
      );
    } catch {
      // Restore from cache on failure
      const cached = loadItemsCache(listId);
      setItems(cached);
    }
  }, [apiBase, items]);

  // localListCount: lists only in LOCAL_LISTS_KEY (not yet on server)
  const serverIds = new Set(serverLists.map(l => l.id));
  const localListCount = localLists.filter(l => !serverIds.has(l.id)).length;

  return {
    lists,
    items,
    activeListId,
    setActiveListId,
    isLoaded,
    connectionError,
    createList,
    deleteList,
    addItem,
    addItems,
    toggleItem,
    clearChecked,
    syncDirtyItems,
    localListCount,
  };
}
