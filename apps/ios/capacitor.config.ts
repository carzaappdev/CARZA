import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The iPhone app loads the live site, so every web deploy reaches the app without a new App Store
 * build. Native features (push, share sheet, haptics, sign-in sheet) are called from the web code
 * through window.Capacitor; see apps/web/src/lib/native.ts.
 */
const config: CapacitorConfig = {
  appId: 'com.carzaapp.app',
  appName: 'Carza',
  webDir: 'www',
  server: {
    url: 'https://www.carzaapp.com',
    // Supabase sign-in pages open in the in-app Safari sheet instead (see native.ts).
    allowNavigation: ['www.carzaapp.com', 'carzaapp.com'],
  },
  ios: {
    contentInset: 'never',
    // Lets the web code tell it's inside the app (e.g. to hide the "Add to Home Screen" card).
    appendUserAgent: 'CarzaApp/1',
    scheme: 'Carza',
  },
  plugins: {
    SplashScreen: { launchShowDuration: 600, backgroundColor: '#090d14', showSpinner: false },
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
  },
};

export default config;
