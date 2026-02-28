import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.recipe.app',
  appName: 'Recipe Collection',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
  },
};

export default config;
