import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Reuse existing app or initialize
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/calendar');
provider.addScope('https://www.googleapis.com/auth/calendar.events');

let isSigningIn = false;
let cachedAccessToken: string | null =
  typeof window !== 'undefined' ? sessionStorage.getItem('gcal_access_token') : null;

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  htmlLink?: string;
}

async function requestGisOAuthToken(scopes: string[]): Promise<string> {
  const clientId = (firebaseConfig as any).oAuthClientId;
  if (!clientId) throw new Error('Missing oAuthClientId in config');

  if (typeof window !== 'undefined' && !(window as any).google?.accounts?.oauth2) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
      document.head.appendChild(script);
    });
  }

  return new Promise((resolve, reject) => {
    try {
      const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: scopes.join(' '),
        callback: (resp: any) => {
          if (resp.error) {
            reject(new Error(resp.error_description || resp.error));
          } else if (resp.access_token) {
            resolve(resp.access_token);
          } else {
            reject(new Error('לא התקבל תוקן מ-Google'));
          }
        },
      });
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err) {
      reject(err);
    }
  });
}

export const initGoogleCalendarAuth = (
  onAuthSuccess?: (user: { email?: string }, token: string) => void,
  onAuthFailure?: () => void
) => {
  // If we already have a cached token from session
  if (cachedAccessToken) {
    const savedEmail = sessionStorage.getItem('gcal_user_email') || 'alli.kabbalah@gmail.com';
    if (onAuthSuccess) onAuthSuccess({ email: savedEmail }, cachedAccessToken);
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        sessionStorage.removeItem('gcal_access_token');
        if (onAuthFailure) onAuthFailure();
      }
    } else if (!cachedAccessToken) {
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const signInWithGoogleCalendar = async (): Promise<{ user: { email?: string }; accessToken: string } | null> => {
  try {
    isSigningIn = true;

    // 1. Try Firebase signInWithPopup
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        cachedAccessToken = credential.accessToken;
        sessionStorage.setItem('gcal_access_token', cachedAccessToken);
        if (result.user.email) sessionStorage.setItem('gcal_user_email', result.user.email);
        return { user: { email: result.user.email || undefined }, accessToken: cachedAccessToken };
      }
    } catch (firebaseErr: any) {
      console.warn('Firebase signInWithPopup failed:', firebaseErr);

      // If domain is unauthorized in Firebase (e.g. crmgoogle.vercel.app), try Google Identity Services client directly
      if (
        firebaseErr?.code === 'auth/unauthorized-domain' ||
        String(firebaseErr?.message).includes('unauthorized-domain')
      ) {
        try {
          const gisToken = await requestGisOAuthToken([
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events',
          ]);
          if (gisToken) {
            cachedAccessToken = gisToken;
            sessionStorage.setItem('gcal_access_token', cachedAccessToken);
            const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${gisToken}` },
            })
              .then((r) => r.json())
              .catch(() => ({}));
            const email = userInfo.email || 'alli.kabbalah@gmail.com';
            sessionStorage.setItem('gcal_user_email', email);
            return { user: { email }, accessToken: cachedAccessToken };
          }
        } catch (gisErr) {
          console.warn('GIS fallback also failed:', gisErr);
        }
      }

      throw firebaseErr;
    }

    throw new Error('לא ניתן לקבל Access Token מ-Google Auth');
  } finally {
    isSigningIn = false;
  }
};

export const getCalendarAccessToken = (): string | null => {
  return cachedAccessToken || (typeof window !== 'undefined' ? sessionStorage.getItem('gcal_access_token') : null);
};

export const setCalendarAccessToken = (token: string, email?: string) => {
  cachedAccessToken = token;
  sessionStorage.setItem('gcal_access_token', token);
  if (email) sessionStorage.setItem('gcal_user_email', email);
};

export const logoutGoogleCalendar = async () => {
  cachedAccessToken = null;
  sessionStorage.removeItem('gcal_access_token');
  sessionStorage.removeItem('gcal_user_email');
  try {
    await firebaseSignOut(auth);
  } catch {
    // Ignore
  }
};

// --- Google Calendar API Functions ---

/**
 * Fetch calendar events from primary calendar
 */
export const fetchGoogleCalendarEvents = async (
  timeMin: Date,
  timeMax: Date
): Promise<GoogleCalendarEvent[]> => {
  const token = getCalendarAccessToken();
  if (!token) {
    throw new Error('חסר תוקן גישה ל-Google Calendar');
  }

  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}&singleEvents=true&orderBy=startTime`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `שגיאה בטעינת אירועים מ-Google Calendar (${response.status})`);
  }

  const data = await response.json();
  return data.items || [];
};

/**
 * Create a new event on user's Google Calendar
 */
export const createGoogleCalendarEvent = async (event: {
  summary: string;
  description?: string;
  startDateTime: string; // ISO String
  endDateTime: string; // ISO String
  location?: string;
}): Promise<GoogleCalendarEvent> => {
  const token = getCalendarAccessToken();
  if (!token) {
    throw new Error('חסר תוקן גישה ל-Google Calendar');
  }

  const payload = {
    summary: event.summary,
    description: event.description || '',
    location: event.location || '',
    start: {
      dateTime: event.startDateTime,
      timeZone: 'Asia/Jerusalem',
    },
    end: {
      dateTime: event.endDateTime,
      timeZone: 'Asia/Jerusalem',
    },
    reminders: {
      useDefault: true,
    },
  };

  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `שגיאה ביצירת אירוע ביומן (${response.status})`);
  }

  return await response.json();
};

/**
 * Delete an event from primary calendar
 */
export const deleteGoogleCalendarEvent = async (eventId: string): Promise<boolean> => {
  const token = getCalendarAccessToken();
  if (!token) {
    throw new Error('חסר תוקן גישה ל-Google Calendar');
  }

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok && response.status !== 404 && response.status !== 410) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `שגיאה במחיקת אירוע מהיומן (${response.status})`);
  }

  return true;
};
