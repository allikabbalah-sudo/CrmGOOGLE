import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, disableNetwork, setLogLevel } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Silence Firestore internal SDK log noise (e.g. backoff retries when quota is reached)
try {
  setLogLevel('silent');
} catch {
  // Ignore
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const customDbId = (firebaseConfig as any).firestoreDatabaseId;
export const db =
  customDbId && customDbId !== '(default)' && customDbId !== 'crmgoogle' && String(customDbId).trim() !== ''
    ? getFirestore(app, customDbId)
    : getFirestore(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

const QUOTA_STORAGE_KEY = 'fs_quota_exhausted_until';

// Clear any stale local quota blocks on startup so newly provisioned Firebase runs smoothly
try {
  localStorage.removeItem(QUOTA_STORAGE_KEY);
} catch {
  // Ignore
}

export function isFirestoreQuotaExceeded(): boolean {
  try {
    const val = localStorage.getItem(QUOTA_STORAGE_KEY);
    if (val) {
      const exp = parseInt(val, 10);
      if (Date.now() < exp) {
        return true;
      } else {
        localStorage.removeItem(QUOTA_STORAGE_KEY);
      }
    }
  } catch {
    // Ignore
  }
  return false;
}

export function markFirestoreQuotaExceeded(durationMs: number = 30 * 1000) {
  try {
    localStorage.setItem(QUOTA_STORAGE_KEY, String(Date.now() + durationMs));
  } catch {
    // Ignore
  }
}

export function clearFirestoreQuotaExceeded() {
  try {
    localStorage.removeItem(QUOTA_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export function isQuotaOrNetworkError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('resource-exhausted') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('quota') ||
    msg.includes('the client is offline') ||
    msg.includes('unavailable') ||
    msg.includes('deadline-exceeded')
  );
}

let lastWarnedTime = 0;

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const isQuota = isQuotaOrNetworkError(error);

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };

  if (isQuota) {
    markFirestoreQuotaExceeded();
    const now = Date.now();
    if (now - lastWarnedTime > 60000) {
      console.warn('Firestore sync notice: Cloud sync temporarily paused, local persistence is active.');
      lastWarnedTime = now;
    }
    return; // Don't throw for quota or network issues; local state continues seamlessly
  }

  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

export async function testFirestoreConnection() {
  if (isFirestoreQuotaExceeded()) {
    return;
  }

  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Successfully connected to Firestore cloud database.');
  } catch (error) {
    if (isQuotaOrNetworkError(error)) {
      markFirestoreQuotaExceeded(30 * 1000);
    } else {
      console.warn('Firestore test connection notice:', error instanceof Error ? error.message : error);
    }
  }
}

testFirestoreConnection();
