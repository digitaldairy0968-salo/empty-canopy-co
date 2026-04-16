import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.digitaldairy',
  appName: 'DIGITAL DAIRY',
  webDir: 'dist',
  server: {
    url: 'https://2b6e8426-d950-4fbf-aca4-216c7b8a3fbd.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
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
};

export default config;
