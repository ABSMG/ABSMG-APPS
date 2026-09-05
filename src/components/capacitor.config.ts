import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nodysom.ai',
  appName: 'Nodysom AI',
  webDir: 'dist',

  server: {
    url: 'https://absmg-apps.onrender.com',
    cleartext: false,
  },

  android: {
    allowMixedContent: false,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#020617',
      showSpinner: false,
    },
  },
};

export default config;
