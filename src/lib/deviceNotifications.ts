/**
 * Device Notification Service for Kabbalah CRM
 * Dispatches real native OS / browser notifications to mobile and desktop devices.
 */

// Synthesize a pleasant chime sound using Web Audio API without needing external mp3 files
export function playChimeSound() {
  try {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    
    // Pleasant two-tone harp chime (440Hz -> 880Hz)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc1.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.15); // E5

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(783.99, ctx.currentTime + 0.08); // G5
    osc2.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.3); // C6

    gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start();
    osc2.start(ctx.currentTime + 0.08);
    osc1.stop(ctx.currentTime + 0.6);
    osc2.stop(ctx.currentTime + 0.6);
  } catch (e) {
    // AudioContext might be blocked until user gesture, safely ignore
  }
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  try {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      // Send welcoming verification notification
      sendDeviceNotification('התראות פעילות בהצלחה 🔔', {
        body: 'מערכת קליניקה קבלית תשלח לך תזכורות למפגשים ומשימות ישירות למכשיר.',
        url: '/',
        sound: true,
      });
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Error requesting notification permission:', err);
    return false;
  }
}

export interface DeviceNotificationOptions {
  body?: string;
  tag?: string;
  url?: string;
  sound?: boolean;
  requireInteraction?: boolean;
}

/**
 * Sends a real OS/device notification
 */
export async function sendDeviceNotification(
  title: string,
  options: DeviceNotificationOptions = {}
): Promise<boolean> {
  if (!isNotificationSupported()) return false;

  // If permission is not granted, do not throw
  if (Notification.permission !== 'granted') {
    return false;
  }

  if (options.sound !== false) {
    playChimeSound();
  }

  const notifOptions: NotificationOptions = {
    body: options.body || '',
    icon: '/pwa-192x192.png',
    badge: '/favicon.ico',
    tag: options.tag || `notif_${Date.now()}`,
    data: { url: options.url || '/' },
    // vibrate on supported mobile devices
    ...(typeof navigator !== 'undefined' && 'vibrate' in navigator ? { vibrate: [150, 80, 150] } : {}),
  };

  try {
    // 1. Prefer Service Worker showNotification if active (works on background / Android / PWA)
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, notifOptions);
        return true;
      }
    }

    // 2. Fallback to standard Window Notification
    const notif = new Notification(title, notifOptions);
    notif.onclick = () => {
      window.focus();
      if (options.url && options.url !== window.location.pathname) {
        window.location.href = options.url;
      }
      notif.close();
    };
    return true;
  } catch (err) {
    console.warn('Failed to dispatch device notification:', err);
    // If constructor works fallback
    try {
      new Notification(title, { body: options.body, icon: '/pwa-192x192.png' });
      return true;
    } catch {
      return false;
    }
  }
}
