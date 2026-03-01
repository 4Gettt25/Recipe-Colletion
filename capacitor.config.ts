import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dev.gettt.recipes',
  appName: 'Recipe Collection',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
  },
};

export default config;
