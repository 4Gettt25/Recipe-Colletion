import { Capacitor } from '@capacitor/core';

const SERVER_KEY = 'recipe-server-url';

export const isNative = () => Capacitor.isNativePlatform();

/** Returns the API base URL — relative on desktop, absolute on Android */
export function getApiBase(): string {
  if (!isNative()) return '/api';
  const url = localStorage.getItem(SERVER_KEY);
  return url ? `${url}/api` : '';
}

export function getServerUrl(): string | null {
  return localStorage.getItem(SERVER_KEY);
}

export function saveServerUrl(url: string): void {
  localStorage.setItem(SERVER_KEY, url.replace(/\/$/, ''));
}

export function clearServerUrl(): void {
  localStorage.removeItem(SERVER_KEY);
}

export const LOCAL_RECIPES_KEY = 'recipe-local-data';

// Shopping list localStorage keys
export const LOCAL_LISTS_KEY = 'shopping-lists-local';
export const SERVER_LISTS_CACHE_KEY = 'shopping-lists-server-cache';
export const SERVER_ITEMS_CACHE_PREFIX = 'shopping-items-cache';

export function isConnected(): boolean {
  return isNative() && !!getServerUrl();
}
