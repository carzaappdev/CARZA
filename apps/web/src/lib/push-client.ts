import { clientEnv } from '@/env/client';
import { removePushSubscription, savePushSubscription } from '@/lib/actions/push';

/**
 * Where this browser stands on push alerts:
 * - unsupported: no push here (old browser, in-app browser, or the keys aren't configured)
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

export function pushSupport(): PushSupport {
  if (!clientEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !('serviceWorker' in navigator)) {
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
  const reg = await navigator.serviceWorker.getRegistration('/');
  return (await reg?.pushManager.getSubscription()) ?? null;
}

function keyBytes(base64url: string) {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

/** Asks for permission (must run from a tap) and saves this device. Returns an error message or null. */
export async function enablePush(): Promise<string | null> {
  const key = clientEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
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
  const sub = await currentSubscription();
  if (!sub) return null;
  const result = await removePushSubscription(sub.endpoint);
  await sub.unsubscribe().catch(() => false);
  return result.ok ? null : result.error.message;
}
