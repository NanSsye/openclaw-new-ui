import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.openclaw.app',
  appName: 'OpenClaw',
  webDir: 'out',
  android: {
    backgroundColor: "#000000",
  },
  server: {
    androidScheme: 'http',
  },
};

export default config;
