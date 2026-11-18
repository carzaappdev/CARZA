import {
  removeNativePushToken,
  removePushSubscription,
  saveNativePushToken,
  savePushSubscription,
} from '@/lib/actions/push';
import {
  isNativeApp,
  nativePushPermission,
  registerNativePush,
  unregisterNativePush,
} from '@/lib/native';

// The iPhone app's push token, kept once alerts are on so they can be turned off again.
const APNS_TOKEN = 'carza:apns-token';

function storedToken() {
  try {
    return localStorage.getItem(APNS_TOKEN);
  } catch {
    return null;
  }
}

/**
 * Where this browser stands on push alerts:
 * - unsupported: no push here (old browser, in-app browser, or no key on this deployment)
 * - needs-install: iPhone/iPad Safari, which only allows push once Carza is on the Home Screen
 * - supported: can ask
 */
export type PushSupport = 'unsupported' | 'needs-install' | 'supported';

export function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIos() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS reports itself as a Mac.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function pushSupport(publicKey: string | null): PushSupport {
  if (isNativeApp()) return 'supported';
  if (!publicKey || !('serviceWorker' in navigator)) {
    return 'unsupported';
  }
  if (isIos() && !isStandalone()) return 'needs-install';
  return 'PushManager' in window && 'Notification' in window ? 'supported' : 'unsupported';
}

async function registration() {
  return (
    (await navigator.serviceWorker.getRegistration('/')) ??
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
  );
}

export async function currentSubscription() {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration('/');
  return (await reg?.pushManager.getSubscription()) ?? null;
}

function keyBytes(base64url: string) {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

/** Whether this device already gets alerts. */
export async function pushIsOn() {
  if (isNativeApp()) return Boolean(storedToken()) && (await nativePushPermission()) === 'granted';
  return Boolean(await currentSubscription()) && Notification.permission === 'granted';
}

/** Whether the person said no to alerts in the browser or phone settings. */
export async function pushBlocked() {
  if (isNativeApp()) return (await nativePushPermission()) === 'denied';
  return Notification.permission === 'denied';
}

/**
 * In the iPhone app: registers with Apple and saves this phone's token for the signed-in user. With
 * `ask`, shows the iOS permission prompt first if needed. Returns an error message or null.
 */
export async function saveNativePush(ask: boolean): Promise<string | null> {
  try {
    const token = await registerNativePush(ask);
    const result = await saveNativePushToken(token);
    if (!result.ok) return result.error.message;
    try {
      localStorage.setItem(APNS_TOKEN, token);
    } catch {
      // Only needed to show the Settings switch as on and to turn alerts off again.
    }
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Couldn’t turn on alerts. Try again.';
  }
}

/** In the app, whether this phone had alerts on (so it re-saves its token for whoever is signed in). */
export const nativePushWasOn = () => isNativeApp() && Boolean(storedToken());

/** Stops this device's alerts when someone signs out, so a shared phone doesn't keep getting theirs. */
export function stopPushOnSignOut() {
  if (isNativeApp()) {
    try {
      localStorage.removeItem(APNS_TOKEN);
    } catch {
      // Unregistering still stops delivery.
    }
    return unregisterNativePush();
  }
  void currentSubscription().then((sub) => sub?.unsubscribe());
}

/** Asks for permission (must run from a tap) and saves this device. Returns an error message or null. */
export async function enablePush(key: string | null): Promise<string | null> {
  if (isNativeApp()) return saveNativePush(true);
  if (!key) return 'Alerts aren’t available yet.';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return permission === 'denied'
      ? 'Alerts are blocked for Carza. Allow notifications in your browser or phone settings.'
      : 'Alerts stay off until you allow them.';
  }
  try {
    const reg = await registration();
    await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(key),
      }));
    const result = await savePushSubscription(sub.toJSON());
    return result.ok ? null : result.error.message;
  } catch {
    return 'Couldn’t turn on alerts on this device. Try again.';
  }
}

/** Stops alerts on this device. */
export async function disablePush(): Promise<string | null> {
  if (isNativeApp()) {
    const token = storedToken();
    try {
      localStorage.removeItem(APNS_TOKEN);
    } catch {
      // Unregistering below still stops delivery.
    }
    unregisterNativePush();
    if (!token) return null;
    const result = await removeNativePushToken(token);
    return result.ok ? null : result.error.message;
  }
  const sub = await currentSubscription();
  if (!sub) return null;
  const result = await removePushSubscription(sub.endpoint);
  await sub.unsubscribe().catch(() => false);
  return result.ok ? null : result.error.message;
}
