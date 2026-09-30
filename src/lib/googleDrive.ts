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
import { MediaFile } from '../types';
import { dataStore } from './dataStore';

// Reuse existing app or initialize
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const driveProvider = new GoogleAuthProvider();
// Google Drive Scopes
driveProvider.addScope('https://www.googleapis.com/auth/drive');
driveProvider.addScope('https://www.googleapis.com/auth/drive.file');
driveProvider.addScope('https://www.googleapis.com/auth/drive.readonly');

let cachedDriveToken: string | null =
  typeof window !== 'undefined' ? sessionStorage.getItem('gdrive_access_token') : null;
let isSigningIn = false;

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  modifiedTime?: string;
  thumbnailLink?: string;
  webViewLink?: string;
  iconLink?: string;
  hasThumbnail?: boolean;
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

export const initGoogleDriveAuth = (
  onAuthSuccess?: (user: { email?: string }, token: string) => void,
  onAuthFailure?: () => void
) => {
  if (cachedDriveToken) {
    const savedEmail = sessionStorage.getItem('gdrive_user_email') || 'alli.kabbalah@gmail.com';
    if (onAuthSuccess) onAuthSuccess({ email: savedEmail }, cachedDriveToken);
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedDriveToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedDriveToken);
      } else if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      if (!cachedDriveToken && onAuthFailure) onAuthFailure();
    }
  });
};

export const signInWithGoogleDrive = async (): Promise<{ user: { email?: string }; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    try {
      const result = await signInWithPopup(auth, driveProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        cachedDriveToken = credential.accessToken;
        sessionStorage.setItem('gdrive_access_token', cachedDriveToken);
        if (result.user.email) sessionStorage.setItem('gdrive_user_email', result.user.email);
        return { user: { email: result.user.email || undefined }, accessToken: cachedDriveToken };
      }
    } catch (firebaseErr: any) {
      console.warn('Firebase signInWithPopup for Drive failed:', firebaseErr);

      if (
        firebaseErr?.code === 'auth/unauthorized-domain' ||
        String(firebaseErr?.message).includes('unauthorized-domain')
      ) {
        try {
          const gisToken = await requestGisOAuthToken([
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/drive.file',
            'https://www.googleapis.com/auth/drive.readonly',
          ]);
          if (gisToken) {
            cachedDriveToken = gisToken;
            sessionStorage.setItem('gdrive_access_token', cachedDriveToken);
            const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${gisToken}` },
            })
              .then((r) => r.json())
              .catch(() => ({}));
            const email = userInfo.email || 'alli.kabbalah@gmail.com';
            sessionStorage.setItem('gdrive_user_email', email);
            return { user: { email }, accessToken: cachedDriveToken };
          }
        } catch (gisErr) {
          console.warn('GIS fallback for Drive failed:', gisErr);
        }
      }

      throw firebaseErr;
    }

    throw new Error('לא ניתן לקבל תוקן גישה מ-Google Drive');
  } finally {
    isSigningIn = false;
  }
};

export const getDriveAccessToken = (): string | null => {
  return cachedDriveToken || (typeof window !== 'undefined' ? sessionStorage.getItem('gdrive_access_token') : null);
};

export const setDriveAccessToken = (token: string, email?: string) => {
  cachedDriveToken = token;
  sessionStorage.setItem('gdrive_access_token', token);
  if (email) sessionStorage.setItem('gdrive_user_email', email);
};

export const logoutGoogleDrive = async () => {
  cachedDriveToken = null;
  sessionStorage.removeItem('gdrive_access_token');
  sessionStorage.removeItem('gdrive_user_email');
  try {
    await firebaseSignOut(auth);
  } catch {
    // Ignore
  }
};

// --- Google Drive API Functions ---

/**
 * List files and folders from Google Drive
 */
export const listGoogleDriveFiles = async (
  folderId = 'root',
  options: {
    pageSize?: number;
    pageToken?: string;
    filterType?: 'all' | 'audio' | 'images' | 'documents' | 'folders';
    searchQuery?: string;
  } = {}
): Promise<{ files: DriveFileItem[]; nextPageToken?: string }> => {
  const token = getDriveAccessToken();
  if (!token) {
    throw new Error('חסר תוקן גישה מחובר ל-Google Drive');
  }

  let query = `'${folderId}' in parents and trashed = false`;

  if (options.filterType === 'folders') {
    query += ` and mimeType = 'application/vnd.google-apps.folder'`;
  } else if (options.filterType === 'audio') {
    query += ` and (mimeType contains 'audio/' or mimeType = 'application/ogg')`;
  } else if (options.filterType === 'images') {
    query += ` and (mimeType contains 'image/')`;
  } else if (options.filterType === 'documents') {
    query += ` and (mimeType contains 'pdf' or mimeType contains 'document' or mimeType contains 'text')`;
  }

  if (options.searchQuery && options.searchQuery.trim()) {
    const escaped = options.searchQuery.replace(/'/g, "\\'");
    query += ` and name contains '${escaped}'`;
  }

  const fields = 'nextPageToken, files(id, name, mimeType, size, modifiedTime, thumbnailLink, webViewLink, iconLink, hasThumbnail)';
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&pageSize=${options.pageSize || 50}&fields=${encodeURIComponent(fields)}&orderBy=folder,name`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson.error?.message || `שגיאה בטעינת קבצים מ-Drive (${res.status})`);
  }

  const data = await res.json();
  return {
    files: data.files || [],
    nextPageToken: data.nextPageToken,
  };
};

/**
 * Fetch files from Google Drive with query options
 */
export const fetchGoogleDriveFiles = async (options?: {
  folderId?: string;
  searchQuery?: string;
  filterType?: 'all' | 'audio' | 'images' | 'documents' | 'folders';
  pageSize?: number;
  pageToken?: string;
}): Promise<DriveFileItem[]> => {
  const res = await listGoogleDriveFiles(options?.folderId || 'root', options);
  return res.files;
};

/**
 * Import multiple drive files into media store
 */
export const importDriveFilesToMedia = async (
  files: DriveFileItem[],
  parentId: string,
  category: 'client' | 'program' | 'general',
  organizationId: string
): Promise<MediaFile[]> => {
  const imported: MediaFile[] = [];
  for (const file of files) {
    const isAudio = file.mimeType.startsWith('audio/') || file.mimeType.includes('audio');
    const type: 'image' | 'audio' = isAudio ? 'audio' : 'image';
    const media = dataStore.addMediaFile({
      name: file.name,
      url: file.webViewLink || file.thumbnailLink || '',
      size: file.size || 0,
      type,
      category,
      parent_id: parentId,
      drive_file_id: file.id,
      drive_view_link: file.webViewLink,
      drive_thumbnail_link: file.thumbnailLink,
      source: 'drive',
    });
    imported.push(media);
  }
  return imported;
};

/**
 * Download a file from Google Drive and return its binary data as Blob and DataURL
 */
export const downloadDriveFile = async (
  fileId: string,
  fileName: string,
  mimeType: string
): Promise<{ blob: Blob; dataUrl: string }> => {
  const token = getDriveAccessToken();
  if (!token) {
    throw new Error('חסר תוקן גישה מחובר ל-Google Drive');
  }

  let downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  if (mimeType.startsWith('application/vnd.google-apps.')) {
    let exportMime = 'application/pdf';
    if (mimeType.includes('document')) exportMime = 'application/pdf';
    else if (mimeType.includes('spreadsheet')) exportMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMime)}`;
  }

  const res = await fetch(downloadUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`שגיאה בהורדת הקובץ מ-Google Drive (${res.status}): ${errText}`);
  }

  const blob = await res.blob();

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  return { blob, dataUrl };
};

/**
 * Import a drive file directly into the CRM client's media gallery
 */
export const importDriveFileToClient = async (
  file: DriveFileItem,
  clientId: string,
  programId?: string,
  sessionId?: string,
  category: 'client' | 'program' | 'general' = 'client'
): Promise<MediaFile> => {
  const { dataUrl } = await downloadDriveFile(file.id, file.name, file.mimeType);

  const isAudio = file.mimeType.startsWith('audio/') || file.mimeType.includes('audio');
  const fileType: 'image' | 'audio' = isAudio ? 'audio' : 'image';

  const mediaFile = dataStore.addMediaFile({
    name: file.name,
    size: file.size || 0,
    type: fileType,
    url: dataUrl,
    category,
    parent_id: programId || sessionId || clientId,
    drive_file_id: file.id,
    drive_view_link: file.webViewLink,
    drive_thumbnail_link: file.thumbnailLink,
    source: 'drive',
  });

  return mediaFile;
};
