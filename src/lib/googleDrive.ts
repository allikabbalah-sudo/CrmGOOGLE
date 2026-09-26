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

let cachedDriveToken: string | null = sessionStorage.getItem('gdrive_access_token');
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

export const initGoogleDriveAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedDriveToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedDriveToken);
      } else if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedDriveToken = null;
      sessionStorage.removeItem('gdrive_access_token');
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const signInWithGoogleDrive = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, driveProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('לא ניתן לקבל תוקן גישה מ-Google Drive');
    }

    cachedDriveToken = credential.accessToken;
    sessionStorage.setItem('gdrive_access_token', cachedDriveToken);
    return { user: result.user, accessToken: cachedDriveToken };
  } catch (error: any) {
    console.error('Sign in with Google Drive error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getDriveAccessToken = (): string | null => {
  return cachedDriveToken || sessionStorage.getItem('gdrive_access_token');
};

export const setDriveAccessToken = (token: string) => {
  cachedDriveToken = token;
  sessionStorage.setItem('gdrive_access_token', token);
};

export const logoutGoogleDrive = async () => {
  cachedDriveToken = null;
  sessionStorage.removeItem('gdrive_access_token');
  try {
    await firebaseSignOut(auth);
  } catch (e) {
    console.error('Error logging out from drive:', e);
  }
};

/**
 * Fetch files from Google Drive with optional search, folder, and mimeType filtering
 */
export const fetchGoogleDriveFiles = async (options: {
  folderId?: string;
  searchQuery?: string;
  filterType?: 'all' | 'image' | 'audio' | 'media';
  pageSize?: number;
}): Promise<DriveFileItem[]> => {
  const token = getDriveAccessToken();
  if (!token) {
    throw new Error('נדרשת התחברות ל-Google Drive');
  }

  const queryParts: string[] = ['trashed = false'];

  if (options.folderId) {
    queryParts.push(`'${options.folderId}' in parents`);
  }

  if (options.searchQuery && options.searchQuery.trim()) {
    const escaped = options.searchQuery.replace(/'/g, "\\'");
    queryParts.push(`name contains '${escaped}'`);
  }

  if (options.filterType === 'image') {
    queryParts.push("mimeType contains 'image/'");
  } else if (options.filterType === 'audio') {
    queryParts.push("mimeType contains 'audio/'");
  } else if (options.filterType === 'media') {
    queryParts.push("(mimeType contains 'image/' or mimeType contains 'audio/' or mimeType = 'application/vnd.google-apps.folder')");
  }

  const q = encodeURIComponent(queryParts.join(' and '));
  const fields = encodeURIComponent(
    'files(id, name, mimeType, size, modifiedTime, thumbnailLink, webViewLink, iconLink, hasThumbnail)'
  );
  const pageSize = options.pageSize || 50;

  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=${pageSize}&orderBy=folder,modifiedTime desc`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      cachedDriveToken = null;
      sessionStorage.removeItem('gdrive_access_token');
      throw new Error('פג תוקף החיבור ל-Google Drive. אנא התחבר מחדש.');
    }
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `שגיאה בטעינת קבצים מ-Drive (${response.status})`);
  }

  const data = await response.json();
  return (data.files || []).map((f: any) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    size: f.size ? parseInt(f.size, 10) : undefined,
    modifiedTime: f.modifiedTime,
    thumbnailLink: f.thumbnailLink,
    webViewLink: f.webViewLink,
    iconLink: f.iconLink,
    hasThumbnail: f.hasThumbnail,
  }));
};

/**
 * Fetch a direct blob URL for a Drive file using Google Drive API alt=media
 */
export const fetchDriveFileBlobUrl = async (fileId: string): Promise<string | null> => {
  const token = getDriveAccessToken();
  if (!token) return null;

  try {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) return null;
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (e) {
    console.error('Failed to fetch drive file blob:', e);
    return null;
  }
};

/**
 * Imports Google Drive files into the local/cloud clinic media store
 */
export const importDriveFilesToMedia = async (
  driveFiles: DriveFileItem[],
  parentId: string,
  category: 'client' | 'program' | 'general',
  organizationId: string
): Promise<MediaFile[]> => {
  const token = getDriveAccessToken();
  const importedMedia: MediaFile[] = [];

  for (const file of driveFiles) {
    const isImage = file.mimeType.startsWith('image/');
    const isAudio = file.mimeType.startsWith('audio/');
    const type = isAudio ? 'audio' : 'image';

    let blobData: Blob | undefined;
    let localUrl = '';

    // Attempt to download blob for offline & instantaneous playback
    if (token) {
      try {
        const downloadRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (downloadRes.ok) {
          blobData = await downloadRes.blob();
          localUrl = URL.createObjectURL(blobData);
        }
      } catch (err) {
        console.warn('Could not cache drive file blob, falling back to Drive links', err);
      }
    }

    const fallbackUrl = file.thumbnailLink || file.webViewLink || '';
    const fileUrl = localUrl || fallbackUrl;

    const newMediaFile = dataStore.addMediaFile({
      name: file.name,
      size: file.size || 0,
      type,
      category,
      parent_id: parentId,
      url: fileUrl,
      blob_data: blobData,
      drive_file_id: file.id,
      drive_view_link: file.webViewLink,
      drive_thumbnail_link: file.thumbnailLink,
      source: 'drive',
    });

    importedMedia.push(newMediaFile);
  }

  return importedMedia;
};
