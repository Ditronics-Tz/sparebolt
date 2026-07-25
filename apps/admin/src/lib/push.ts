import { getToken, onMessage } from 'firebase/messaging';
import { api } from '@sparebolt/shared/api';
import {
  firebaseVapidKey,
  getFirebaseMessaging,
  isFirebaseConfigured,
} from '@/lib/firebase';

const TOKEN_KEY = 'sb_admin_fcm_token';

/**
 * Register FCM web push for the logged-in admin.
 * Safe to call repeatedly — no-ops if unsupported / denied / misconfigured.
 * The admin app is not a PWA, so we register a dedicated FCM service worker.
 */
export async function registerAdminWebPush(): Promise<{
  ok: boolean;
  reason?: string;
  token?: string;
}> {
  if (typeof window === 'undefined') return { ok: false, reason: 'ssr' };
  if (!isFirebaseConfigured()) {
    return { ok: false, reason: 'firebase-not-configured' };
  }
  if (!firebaseVapidKey?.trim()) {
    console.warn(
      '[SpareBolt Admin] VITE_FIREBASE_VAPID_KEY missing — cannot obtain an FCM token.',
    );
    return { ok: false, reason: 'vapid-missing' };
  }
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return { ok: false, reason: 'unsupported' };
  }
  if (!window.isSecureContext) {
    return { ok: false, reason: 'insecure-context' };
  }

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    return { ok: false, reason: 'permission-denied' };
  }

  const messaging = await getFirebaseMessaging();
  if (!messaging) {
    return { ok: false, reason: 'messaging-unavailable' };
  }

  let registration: ServiceWorkerRegistration;
  try {
    await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    registration = await navigator.serviceWorker.ready;
  } catch {
    return { ok: false, reason: 'sw-register-failed' };
  }

  let token: string;
  try {
    token = await getToken(messaging, {
      vapidKey: firebaseVapidKey.trim(),
      serviceWorkerRegistration: registration,
    });
  } catch (err) {
    console.warn('[SpareBolt Admin] FCM getToken failed', err);
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'getToken-failed',
    };
  }
  if (!token) return { ok: false, reason: 'empty-token' };

  // Persist token; re-post even if unchanged in case the server lost it.
  try {
    await api.post('/notifications/push-token', { token, platform: 'web' });
    localStorage.setItem(TOKEN_KEY, token);
  } catch (err) {
    console.warn('[SpareBolt Admin] Failed to save push token', err);
    return { ok: false, reason: 'api-register-failed' };
  }

  // Foreground messages → surface a system notification when possible.
  onMessage(messaging, (payload) => {
    const title =
      payload.notification?.title || payload.data?.title || 'SpareBolt Admin';
    const body = payload.notification?.body || payload.data?.body || '';
    if (Notification.permission === 'granted' && body) {
      try {
        const n = new Notification(title, {
          body,
          tag: payload.data?.notificationId || 'sparebolt-admin',
          data: payload.data,
        });
        n.onclick = () => window.focus();
      } catch {
        /* Safari / focus restrictions */
      }
    }
  });

  return { ok: true, token };
}

export async function unregisterAdminWebPush() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;
  try {
    await api.delete('/notifications/push-token', { data: { token } });
  } catch {
    /* ignore */
  }
  localStorage.removeItem(TOKEN_KEY);
}
