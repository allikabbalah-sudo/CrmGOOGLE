// Native IndexedDB storage for offline persistence of large media blobs and app state backups

const DB_NAME = 'eliran_crm_idb';
const DB_VERSION = 1;
const MEDIA_STORE = 'media_blobs';
const STATE_STORE = 'app_state_backup';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(MEDIA_STORE)) {
        db.createObjectStore(MEDIA_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STATE_STORE)) {
        db.createObjectStore(STATE_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveMediaBlobToIDB(id: string, dataUrl: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(MEDIA_STORE, 'readwrite');
      const store = tx.objectStore(MEDIA_STORE);
      store.put({ id, dataUrl, updatedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IDB saveMediaBlob error:', err);
  }
}

export async function getMediaBlobFromIDB(id: string): Promise<string | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(MEDIA_STORE, 'readonly');
      const store = tx.objectStore(MEDIA_STORE);
      const req = store.get(id);
      req.onsuccess = () => {
        resolve(req.result ? req.result.dataUrl : null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IDB getMediaBlob error:', err);
    return null;
  }
}

export async function getAllMediaBlobsFromIDB(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(MEDIA_STORE, 'readonly');
      const store = tx.objectStore(MEDIA_STORE);
      const req = store.openCursor();
      req.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          if (cursor.value && cursor.value.id && cursor.value.dataUrl) {
            map.set(cursor.value.id, cursor.value.dataUrl);
          }
          cursor.continue();
        } else {
          resolve(map);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IDB getAllMediaBlobs error:', err);
    return map;
  }
}

export async function deleteMediaBlobFromIDB(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(MEDIA_STORE, 'readwrite');
      const store = tx.objectStore(MEDIA_STORE);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IDB deleteMediaBlob error:', err);
  }
}

export async function saveStateBackupToIDB(stateJson: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STATE_STORE, 'readwrite');
      const store = tx.objectStore(STATE_STORE);
      store.put({ key: 'latest_state', data: stateJson, updatedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IDB saveStateBackup error:', err);
  }
}

export async function getStateBackupFromIDB(): Promise<string | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STATE_STORE, 'readonly');
      const store = tx.objectStore(STATE_STORE);
      const req = store.get('latest_state');
      req.onsuccess = () => {
        resolve(req.result ? req.result.data : null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IDB getStateBackup error:', err);
    return null;
  }
}

/**
 * Utility to compress image files before reading as Base64.
 * Reduces 5-15MB camera photos down to lightweight high-quality WebP/JPEG (approx 100-250KB).
 */
export function compressImageFile(file: File, maxWidth = 1280, maxHeight = 1280, quality = 0.82): Promise<string> {
  return new Promise((resolve) => {
    // If not an image or SVG/GIF, fallback to direct data URL
    if (!file.type.startsWith('image/') || file.type.includes('svg') || file.type.includes('gif')) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => {
        resolve(e.target?.result as string);
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}
