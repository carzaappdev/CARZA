/**
 * The Carza iPhone app (apps/ios) is this website inside a native shell. The shell injects
 * `window.Capacitor`, which lets the page call the app's native plugins: push alerts, the share sheet,
 * haptics and the in-app Safari sheet used for Google/Apple sign-in. In a normal browser none of this
 * exists and every helper here is a no-op, so callers keep their web behavior.
 */

type Listener = { remove: () => Promise<void> };
type Bridge = {
  isNativePlatform: () => boolean;
  nativePromise: <T = unknown>(plugin: string, method: string, options?: object) => Promise<T>;
  addListener: <T>(plugin: string, event: string, callback: (data: T) => void) => Listener;
};

function bridge(): Bridge | null {
  if (typeof window === 'undefined') return null;
  const cap = (window as Window & { Capacitor?: Partial<Bridge> }).Capacitor;
  return cap?.isNativePlatform?.() && cap.nativePromise && cap.addListener ? (cap as Bridge) : null;
}

/** True inside the Carza iPhone app. */
export const isNativeApp = () => bridge() !== null;

/** Where Google/Apple send people back to in the app. Must be allow-listed in Supabase Auth. */
export const NATIVE_AUTH_REDIRECT = 'com.carzaapp.app://auth/callback';

/** A light tap on the phone's Taptic Engine (e.g. on a like). Nothing in a browser. */
export function haptic(style: 'LIGHT' | 'MEDIUM' = 'LIGHT') {
  void bridge()
    ?.nativePromise('Haptics', 'impact', { style })
    .catch(() => {});
}

/**
 * Opens the iPhone share sheet. Returns false when not in the app, so the caller can fall back to
 * the web share sheet or copying the link. A cancelled share still counts as handled.
 */
export async function nativeShare(data: { title?: string; text?: string; url: string }) {
  const b = bridge();
  if (!b) return false;
  await b.nativePromise('Share', 'share', data).catch(() => {});
  return true;
}

/** Opens a page (the Google/Apple sign-in) in the in-app Safari sheet. */
export async function openInAppBrowser(url: string) {
  await bridge()?.nativePromise('Browser', 'open', { url, presentationStyle: 'popover' });
}

export function closeInAppBrowser() {
  void bridge()
    ?.nativePromise('Browser', 'close')
    .catch(() => {});
}

export function onNative<T>(plugin: string, event: string, callback: (data: T) => void) {
  return bridge()?.addListener<T>(plugin, event, callback) ?? null;
}

type Permission = { receive: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' };

/** Push permission in the app, or null in a browser. */
export async function nativePushPermission() {
  const b = bridge();
  if (!b) return null;
  return (await b.nativePromise<Permission>('PushNotifications', 'checkPermissions')).receive;
}

/**
 * Asks iOS for permission if needed, registers with Apple and resolves with this phone's push token.
 * Rejects with a message people can read.
 */
export async function registerNativePush(ask: boolean): Promise<string> {
  const b = bridge();
  if (!b) throw new Error('Alerts aren’t available here.');
  let permission = await nativePushPermission();
  if (permission !== 'granted' && ask) {
    permission = (await b.nativePromise<Permission>('PushNotifications', 'requestPermissions'))
      .receive;
  }
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Alerts are off for Carza. Turn them on in Settings › Notifications › Carza.'
        : 'Alerts stay off until you allow them.',
    );
  }
  return new Promise<string>((resolve, reject) => {
    const listeners: (Listener | null)[] = [];
    const done = () => listeners.forEach((l) => void l?.remove());
    listeners.push(
      onNative<{ value: string }>('PushNotifications', 'registration', ({ value }) => {
        done();
        resolve(value);
      }),
      onNative('PushNotifications', 'registrationError', () => {
        done();
        reject(new Error('Couldn’t turn on alerts on this phone. Try again.'));
      }),
    );
    b.nativePromise('PushNotifications', 'register').catch(() => {
      done();
      reject(new Error('Couldn’t turn on alerts on this phone. Try again.'));
    });
  });
}

/** Stops Apple delivering to this phone until alerts are turned on again. */
export function unregisterNativePush() {
  void bridge()
    ?.nativePromise('PushNotifications', 'unregister')
    .catch(() => {});
}
