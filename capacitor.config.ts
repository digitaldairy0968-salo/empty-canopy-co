import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.digitaldairy',
  appName: 'DairySetu',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#2d7a4f',
      showSpinner: false,
    },
  },
  android: {
    // Microphone permission for voice entry
    // These are also declared in AndroidManifest.xml
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
