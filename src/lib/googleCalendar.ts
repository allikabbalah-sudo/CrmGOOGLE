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
// Google Calendar Scopes
provider.addScope('https://www.googleapis.com/auth/calendar');
provider.addScope('https://www.googleapis.com/auth/calendar.events');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  htmlLink?: string;
}

export const initGoogleCalendarAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const signInWithGoogleCalendar = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('לא ניתן לקבל Access Token מ-Google Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in with Google Calendar error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getCalendarAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const logoutGoogleCalendar = async () => {
  await firebaseSignOut(auth);
  cachedAccessToken = null;
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
 * Create an event in primary Google Calendar
 */
export const createGoogleCalendarEvent = async (event: {
  summary: string;
  description?: string;
  startDateTime: string; // ISO string
  endDateTime: string; // ISO string
  location?: string;
}): Promise<GoogleCalendarEvent> => {
  const token = getCalendarAccessToken();
  if (!token) {
    throw new Error('חסר תוקן גישה ל-Google Calendar');
  }

  const payload = {
    summary: event.summary,
    description: event.description || '',
    start: { dateTime: event.startDateTime },
    end: { dateTime: event.endDateTime },
    location: event.location || 'קליניקה קבלית',
  };

  const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `שגיאה ביצירת אירוע ב-Google Calendar (${response.status})`);
  }

  return await response.json();
};

/**
 * Delete an event from primary Google Calendar
 */
export const deleteGoogleCalendarEvent = async (eventId: string): Promise<void> => {
  const token = getCalendarAccessToken();
  if (!token) {
    throw new Error('חסר תוקן גישה ל-Google Calendar');
  }

  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `שגיאה במחיקת אירוע מ-Google Calendar (${response.status})`);
  }
};
