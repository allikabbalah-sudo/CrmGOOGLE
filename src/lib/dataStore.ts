import JSZip from 'jszip';
import { doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';
import seedState from './seedState.json';
import {
  db,
  handleFirestoreError,
  OperationType,
  isQuotaOrNetworkError,
  isFirestoreQuotaExceeded,
  markFirestoreQuotaExceeded,
} from './firebase';
import {
  saveMediaBlobToIDB,
  getMediaBlobFromIDB,
  getAllMediaBlobsFromIDB,
  deleteMediaBlobFromIDB,
  saveStateBackupToIDB,
  getStateBackupFromIDB,
} from './indexedDbStorage';
import {
  Client,
  Program,
  Session,
  Task,
  NotificationItem,
  ActivityLog,
  Organization,
  OrganizationMember,
  OrgInvite,
  OrgPendingApproval,
  Profile,
  MediaFile,
  ClientStatus,
  MemberRole,
} from '../types';
import { generateUUID, toWhatsAppUrl } from './utils';
import { generateSessions, createRescheduledSession } from './sessionGenerator';

const STORAGE_KEY = 'kabbalah_crm_state_v3';

export function getDeterministicUserId(email: string): string {
  const clean = email.trim().toLowerCase();
  try {
    const encoded = btoa(encodeURIComponent(clean)).replace(/[^a-zA-Z0-9]/g, '_');
    return `usr_${encoded}`;
  } catch {
    return `usr_${clean.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }
}

interface AppState {
  organizations: Organization[];
  profiles: Profile[];
  organizationMembers: OrganizationMember[];
  orgInvites: OrgInvite[];
  pendingApprovals: OrgPendingApproval[];
  clients: Client[];
  programs: Program[];
  sessions: Session[];
  tasks: Task[];
  notifications: NotificationItem[];
  activityLogs: ActivityLog[];
  mediaFiles: MediaFile[];
  activeOrgId: string;
  currentUserId: string;
}

export interface ImportMappingItem {
  fileName: string;
  entityType: 'clients' | 'programs' | 'sessions' | 'tasks' | 'mediaFiles' | 'activityLogs' | 'notifications' | 'full_export' | 'ignore';
  items: any[];
}

export function deduplicateById<T extends { id?: string }>(arr: T[] | undefined): T[] {
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const id = item.id ? String(item.id).trim() : generateUUID();
    if (!seen.has(id)) {
      seen.add(id);
      result.push({ ...item, id });
    }
  }
  return result;
}

export function normalizePhoneForMatching(phone?: string): string {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('972') && digits.length >= 11) {
    digits = '0' + digits.slice(3);
  }
  return digits;
}

export function normalizeEmailForMatching(email?: string): string {
  if (!email) return '';
  return String(email).trim().toLowerCase();
}

export function normalizeNameForMatching(name?: string): string {
  if (!name) return '';
  return String(name).trim().toLowerCase().replace(/\s+/g, ' ');
}

export function splitFullName(fullName: string = ''): { firstName: string; lastName: string } {
  const clean = (fullName || '').trim();
  if (!clean) return { firstName: '', lastName: '' };
  const parts = clean.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

export function formatClientToCustomExport(client: Client): Record<string, any> {
  const anyClient = client as any;
  const rawFullName = client.full_name?.trim() || anyClient.fullName?.trim() || '';
  const { firstName: splitFirst, lastName: splitLast } = splitFullName(rawFullName);
  
  const firstName = anyClient.firstName || anyClient.first_name || splitFirst || '';
  const lastName = anyClient.lastName || anyClient.last_name || splitLast || '';
  const status = client.status || anyClient.status || 'lead';
  const userId = anyClient.userId || client.id || '';

  // Return object strictly beginning with firstName, lastName, status, userId
  // followed by all other details of the client
  return {
    firstName,
    lastName,
    status,
    userId,
    // Complete client details (camelCase & snake_case)
    id: client.id || '',
    fullName: rawFullName,
    phone: client.phone || anyClient.phone || '',
    email: client.email || anyClient.email || '',
    motherName: client.mother_name || anyClient.motherName || '',
    dateOfBirth: client.date_of_birth || anyClient.dateOfBirth || '',
    address: client.address || anyClient.address || '',
    avatarUrl: client.avatar_url || anyClient.avatarUrl || '',
    selectedReading: client.selected_reading || anyClient.selectedReading || '',
    partnerFullName: client.partner_full_name || anyClient.partnerFullName || '',
    partnerDob: client.partner_dob || anyClient.partnerDob || '',
    partnerMotherName: client.partner_mother_name || anyClient.partnerMotherName || '',
    notes: client.notes || anyClient.notes || '',
    assignedTo: client.assigned_to || anyClient.assignedTo || '',
    createdBy: client.created_by || anyClient.createdBy || '',
    organizationId: client.organization_id || anyClient.organizationId || '',
    lastCompletedSessionAt: client.last_completed_session_at || anyClient.lastCompletedSessionAt || '',
    createdAt: client.created_at || anyClient.createdAt || '',
    updatedAt: client.updated_at || anyClient.updatedAt || '',
    // DB original fields
    full_name: client.full_name || rawFullName,
    mother_name: client.mother_name || anyClient.motherName || '',
    date_of_birth: client.date_of_birth || anyClient.dateOfBirth || '',
    avatar_url: client.avatar_url || anyClient.avatarUrl || '',
    selected_reading: client.selected_reading || anyClient.selectedReading || '',
    partner_full_name: client.partner_full_name || anyClient.partnerFullName || '',
    partner_dob: client.partner_dob || anyClient.partnerDob || '',
    partner_mother_name: client.partner_mother_name || anyClient.partnerMotherName || '',
    assigned_to: client.assigned_to || anyClient.assignedTo || '',
    created_by: client.created_by || anyClient.createdBy || '',
    organization_id: client.organization_id || anyClient.organizationId || '',
    last_completed_session_at: client.last_completed_session_at || anyClient.lastCompletedSessionAt || '',
    created_at: client.created_at || anyClient.createdAt || '',
    updated_at: client.updated_at || anyClient.updatedAt || '',
  };
}

export function findExistingClientMatch(
  imported: Partial<Client> | Record<string, any>,
  existingClients: Client[]
): Client | undefined {
  if (!existingClients || existingClients.length === 0 || !imported) return undefined;

  const imp = imported as Record<string, any>;
  const effectiveId = imp.id ? String(imp.id).trim() : imp.userId ? String(imp.userId).trim() : '';

  // 1. Direct ID / userId match
  if (effectiveId) {
    const byId = existingClients.find((c) => c && (c.id === effectiveId || (c as any).userId === effectiveId));
    if (byId) return byId;
  }

  // 2. Phone match (ignoring dashes, spaces, +972)
  const normPhone = normalizePhoneForMatching(imp.phone);
  if (normPhone && normPhone.length >= 7) {
    const byPhone = existingClients.find((c) => {
      const cNorm = normalizePhoneForMatching(c.phone);
      return cNorm && cNorm === normPhone;
    });
    if (byPhone) return byPhone;
  }

  // 3. Email match (case-insensitive)
  const normEmail = normalizeEmailForMatching(imp.email);
  if (normEmail && normEmail.includes('@') && normEmail.length >= 5) {
    const byEmail = existingClients.find((c) => {
      const cNorm = normalizeEmailForMatching(c.email);
      return cNorm && cNorm === normEmail;
    });
    if (byEmail) return byEmail;
  }

  // 4. Exact Full Name match (from full_name, fullName, or firstName + lastName)
  const rawFullName = imp.full_name || imp.fullName || (imp.firstName ? `${imp.firstName} ${imp.lastName || ''}`.trim() : '');
  const normName = normalizeNameForMatching(rawFullName);
  if (normName && normName.length >= 2) {
    const byName = existingClients.find((c) => {
      const cNorm = normalizeNameForMatching(c.full_name);
      return cNorm && cNorm === normName;
    });
    if (byName) return byName;
  }

  return undefined;
}

export function mergeClientRecord(existing: Client, imported: Partial<Client> | Record<string, any>): Client {
  const imp = imported as Record<string, any>;
  const isNotEmpty = (val: any) => val !== undefined && val !== null && String(val).trim() !== '';

  const mergedNotes = () => {
    const exNotes = existing.notes?.trim() || '';
    const imNotes = (imp.notes || '').trim();
    if (!imNotes) return exNotes;
    if (!exNotes) return imNotes;
    if (exNotes.includes(imNotes)) return exNotes;
    return `${exNotes}\n---\n${imNotes}`;
  };

  const incomingName = isNotEmpty(imp.full_name)
    ? String(imp.full_name).trim()
    : isNotEmpty(imp.fullName)
    ? String(imp.fullName).trim()
    : isNotEmpty(imp.firstName)
    ? `${String(imp.firstName).trim()} ${String(imp.lastName || '').trim()}`.trim()
    : existing.full_name;

  return {
    ...existing,
    full_name: incomingName || existing.full_name,
    phone: isNotEmpty(imp.phone) ? String(imp.phone).trim() : existing.phone,
    email: isNotEmpty(imp.email) ? String(imp.email).trim() : existing.email,
    address: isNotEmpty(imp.address) ? String(imp.address).trim() : existing.address,
    mother_name: isNotEmpty(imp.mother_name)
      ? String(imp.mother_name).trim()
      : isNotEmpty(imp.motherName)
      ? String(imp.motherName).trim()
      : existing.mother_name,
    date_of_birth: isNotEmpty(imp.date_of_birth)
      ? String(imp.date_of_birth).trim()
      : isNotEmpty(imp.dateOfBirth)
      ? String(imp.dateOfBirth).trim()
      : existing.date_of_birth,
    status: isNotEmpty(imp.status) ? (imp.status as ClientStatus) : existing.status,
    notes: mergedNotes(),
    assigned_to: isNotEmpty(imp.assigned_to)
      ? imp.assigned_to
      : isNotEmpty(imp.assignedTo)
      ? imp.assignedTo
      : existing.assigned_to,
    avatar_url: isNotEmpty(imp.avatar_url)
      ? imp.avatar_url
      : isNotEmpty(imp.avatarUrl)
      ? imp.avatarUrl
      : existing.avatar_url,
    selected_reading: isNotEmpty(imp.selected_reading)
      ? imp.selected_reading
      : isNotEmpty(imp.selectedReading)
      ? imp.selectedReading
      : existing.selected_reading,
    partner_full_name: isNotEmpty(imp.partner_full_name)
      ? imp.partner_full_name
      : isNotEmpty(imp.partnerFullName)
      ? imp.partnerFullName
      : existing.partner_full_name,
    partner_dob: isNotEmpty(imp.partner_dob)
      ? imp.partner_dob
      : isNotEmpty(imp.partnerDob)
      ? imp.partnerDob
      : existing.partner_dob,
    partner_mother_name: isNotEmpty(imp.partner_mother_name)
      ? imp.partner_mother_name
      : isNotEmpty(imp.partnerMotherName)
      ? imp.partnerMotherName
      : existing.partner_mother_name,
    updated_at: new Date().toISOString(),
  };
}

export function stripUndefinedDeep<T>(value: T): T {
  if (value === undefined) {
    return null as any;
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefinedDeep(item)) as any;
  }
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(value as Record<string, any>)) {
    if (val !== undefined) {
      result[key] = stripUndefinedDeep(val);
    }
  }
  return result as any;
}

const initialAppState: AppState = {
  activeOrgId: '',
  currentUserId: '',
  organizations: [],
  profiles: [],
  organizationMembers: [],
  orgInvites: [],
  pendingApprovals: [],
  clients: [],
  programs: [],
  sessions: [],
  tasks: [],
  notifications: [],
  activityLogs: [],
  mediaFiles: [],
};

class DataStore {
  private state: AppState;
  private listeners: Set<() => void> = new Set();
  private unsubscribeFirestore: (() => void) | null = null;
  private isSyncingFromCloud: boolean = false;
  private isQuotaExceeded: boolean = false;
  private quotaExceededUntil: number = 0;
  private cloudSyncDebounceTimer: any = null;
  private syncedMediaBlobIds: Set<string> = new Set();
  private lastProfileSync: { userId: string; email: string; fullName: string; time: number } | null = null;
  private hasConfirmedCloudEmpty: boolean = false;

  constructor() {
    this.pruneOldStorageKeys();
    this.state = this.sanitizeState(this.loadState());
    this.ensureDefaultUser();
    this.deleteOrgsExceptEliran();
    this.state = this.sanitizeState(this.state);
    this.writeToLocalStorage(this.state);
    this.hydrateFromIDB();
    if (this.state.currentUserId) {
      this.initCloudSync(this.state.currentUserId);
      if ((this.state.clients || []).length > 0) {
        this.scheduleCloudSync();
      }
    }
  }

  private ensureDefaultUser() {
    const defaultEmail = 'alli.kabbalah@gmail.com';
    const defaultId = getDeterministicUserId(defaultEmail);

    let prof = (this.state.profiles || []).find(
      (p) =>
        (p.email && p.email.toLowerCase() === defaultEmail) ||
        p.id === defaultId ||
        p.id === 'ee44f38b-8ed3-4e69-8fb6-ccd95911d38e'
    );
    if (prof) {
      prof.id = defaultId;
      prof.email = defaultEmail;
      if (!prof.full_name || prof.full_name === 'guest') prof.full_name = 'אלי קבלה';
      if (!prof.password) prof.password = 'kabbalah0219';
    } else {
      prof = {
        id: defaultId,
        full_name: 'אלי קבלה',
        email: defaultEmail,
        password: 'kabbalah0219',
        created_at: new Date().toISOString(),
      };
      this.state.profiles = [prof, ...(this.state.profiles || [])];
    }

    if (!this.state.currentUserId) {
      this.state.currentUserId = defaultId;
    }
  }

  private async hydrateFromIDB() {
    // 1. If state had 0 clients/programs (e.g. fresh storage), check IDB backup
    try {
      if ((!this.state.clients || this.state.clients.length === 0) && (!this.state.programs || this.state.programs.length === 0)) {
        const backupStr = await getStateBackupFromIDB();
        if (backupStr) {
          const parsed = JSON.parse(backupStr);
          if (parsed && Array.isArray(parsed.clients) && parsed.clients.length > 0) {
            this.state = this.sanitizeState(parsed);
            this.deleteOrgsExceptEliran();
            this.writeToLocalStorage(this.state);
            this.notify();
            if (this.state.currentUserId) {
              this.scheduleCloudSync();
            }
          }
        }
      }

      // 2. If still empty, query cloud fallback documents (e.g. opening fresh on mobile)
      if (!this.state.clients || this.state.clients.length === 0) {
        const fallbackDocIds = [
          this.state.currentUserId,
          'ee44f38b-8ed3-4e69-8fb6-ccd95911d38e',
          'usr_YWxsaS5rYWJiYWxhaCU0MGdtYWlsLmNvbQ__',
          'usr_ZWxpYmVsaXJhbiU0MGdtYWlsLmNvbQ__',
          'clinic_shared',
        ].filter(Boolean);

        for (const fId of fallbackDocIds) {
          try {
            const snap = await getDoc(doc(db, 'users', fId, 'appData', 'state'));
            if (snap.exists()) {
              const cData = snap.data();
              if (cData && Array.isArray(cData.clients) && cData.clients.length > 0) {
                this.state = this.sanitizeState({
                  ...this.state,
                  ...cData,
                  currentUserId: this.state.currentUserId || fId,
                });
                this.deleteOrgsExceptEliran();
                this.writeToLocalStorage(this.state);
                this.notify();
                break;
              }
            }
          } catch {
            // Ignore network issues
          }
        }
      }
    } catch (e) {
      console.warn('Notice: IDB state backup restore skipped:', e);
    }
  }

  public async resolveBlobUrl(urlOrBlobId: string): Promise<string | null> {
    if (!urlOrBlobId) return null;
    const blobId = urlOrBlobId.replace(/^(cloud_media:|idb_media:)/, '');

    // 1. Check IndexedDB
    try {
      const fromIdb = await getMediaBlobFromIDB(blobId);
      if (fromIdb) return fromIdb;
    } catch {
      // Ignore
    }

    // 2. Check Cloud Firestore
    const userId = this.state.currentUserId;
    if (userId) {
      try {
        const fromCloud = await this.fetchMediaBlobFromCloud(userId, blobId);
        if (fromCloud) {
          saveMediaBlobToIDB(blobId, fromCloud).catch(() => {});
          return fromCloud;
        }
      } catch {
        // Ignore
      }
    }
    return null;
  }

  public async resolveMediaFileUrl(mediaId: string): Promise<string | null> {
    const existing = (this.state.mediaFiles || []).find((m) => m.id === mediaId);
    if (existing && existing.url && !existing.url.startsWith('cloud_media:') && !existing.url.startsWith('idb_media:')) {
      return existing.url;
    }

    const resolved = await this.resolveBlobUrl(mediaId);
    if (resolved && existing) {
      existing.url = resolved;
    }
    return resolved;
  }

  public sanitizeState(state: AppState): AppState {
    const cleanedMediaFiles = deduplicateById(state.mediaFiles).map((m: any) => {
      if (m && 'blob_data' in m) {
        const { blob_data, ...rest } = m;
        return rest;
      }
      return m;
    });

    return {
      activeOrgId: state.activeOrgId || '',
      currentUserId: state.currentUserId || '',
      organizations: deduplicateById(state.organizations),
      profiles: deduplicateById(state.profiles),
      organizationMembers: deduplicateById(state.organizationMembers),
      orgInvites: deduplicateById(state.orgInvites),
      pendingApprovals: deduplicateById(state.pendingApprovals),
      clients: deduplicateById(state.clients),
      programs: deduplicateById(state.programs),
      sessions: deduplicateById(state.sessions),
      tasks: deduplicateById(state.tasks),
      notifications: deduplicateById(state.notifications),
      activityLogs: deduplicateById(state.activityLogs),
      mediaFiles: cleanedMediaFiles,
    };
  }

  private initCloudSync(userId: string) {
    if (this.unsubscribeFirestore) {
      this.unsubscribeFirestore();
      this.unsubscribeFirestore = null;
    }
    if (!userId) return;

    if (isFirestoreQuotaExceeded() || (this.isQuotaExceeded && Date.now() < this.quotaExceededUntil)) {
      return;
    }

    try {
      const docRef = doc(db, 'users', userId, 'appData', 'state');

      this.unsubscribeFirestore = onSnapshot(
        docRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const cloudData = snapshot.data();
            if (cloudData) {
              this.isSyncingFromCloud = true;

              const cloudMediaFiles: MediaFile[] = Array.isArray(cloudData.mediaFiles)
                ? cloudData.mediaFiles
                : this.state.mediaFiles;

              // Preserve any existing local data URLs if cloud mediaFile has a placeholder reference
              const mergedMediaFiles = cloudMediaFiles.map((cm) => {
                if (cm.url && (cm.url.startsWith('cloud_media:') || cm.url.startsWith('idb_media:'))) {
                  const localMatch = (this.state.mediaFiles || []).find((lm) => lm.id === cm.id);
                  if (localMatch && localMatch.url && !localMatch.url.startsWith('cloud_media:') && !localMatch.url.startsWith('idb_media:')) {
                    return { ...cm, url: localMatch.url };
                  }
                }
                return cm;
              });

              // Retain local items that have not yet arrived in cloudData
              const mergeLocalUnsynced = <T extends { id: string }>(cloudList: T[] | undefined, localList: T[] | undefined): T[] => {
                const cloudArr = Array.isArray(cloudList) ? cloudList : [];
                const localArr = Array.isArray(localList) ? localList : [];
                const cloudIds = new Set(cloudArr.map((i) => i.id));
                const missingInCloud = localArr.filter((i) => !cloudIds.has(i.id));
                return [...cloudArr, ...missingInCloud];
              };

              // Merge client avatars, preserving local high-quality images if cloud has placeholder
              const rawCloudClients = Array.isArray(cloudData.clients) ? cloudData.clients : [];
              const mergedClients = rawCloudClients.map((cc) => {
                if (cc.avatar_url && (cc.avatar_url.startsWith('cloud_media:') || cc.avatar_url.startsWith('idb_media:'))) {
                  const localMatch = (this.state.clients || []).find((lc) => lc.id === cc.id);
                  if (localMatch && localMatch.avatar_url && !localMatch.avatar_url.startsWith('cloud_media:') && !localMatch.avatar_url.startsWith('idb_media:')) {
                    return { ...cc, avatar_url: localMatch.avatar_url };
                  }
                }
                return cc;
              });

              const finalClients = mergeLocalUnsynced(mergedClients, this.state.clients);
              const finalPrograms = mergeLocalUnsynced(cloudData.programs, this.state.programs);
              const finalSessions = mergeLocalUnsynced(cloudData.sessions, this.state.sessions);
              const finalTasks = mergeLocalUnsynced(cloudData.tasks, this.state.tasks);
              const finalMediaFiles = mergeLocalUnsynced(mergedMediaFiles, this.state.mediaFiles);

              this.state = this.sanitizeState({
                ...this.state,
                activeOrgId: cloudData.activeOrgId || this.state.activeOrgId,
                currentUserId: userId,
                organizations: Array.isArray(cloudData.organizations) ? cloudData.organizations : this.state.organizations,
                profiles: Array.isArray(cloudData.profiles) ? cloudData.profiles : this.state.profiles,
                organizationMembers: Array.isArray(cloudData.organizationMembers) ? cloudData.organizationMembers : this.state.organizationMembers,
                orgInvites: Array.isArray(cloudData.orgInvites) ? cloudData.orgInvites : this.state.orgInvites,
                pendingApprovals: Array.isArray(cloudData.pendingApprovals) ? cloudData.pendingApprovals : this.state.pendingApprovals,
                clients: finalClients,
                programs: finalPrograms,
                sessions: finalSessions,
                tasks: finalTasks,
                notifications: Array.isArray(cloudData.notifications) ? cloudData.notifications : this.state.notifications,
                activityLogs: Array.isArray(cloudData.activityLogs) ? cloudData.activityLogs : this.state.activityLogs,
                mediaFiles: finalMediaFiles,
              });

              this.deleteOrgsExceptEliran();
              this.state = this.sanitizeState(this.state);
              this.writeToLocalStorage(this.state);
              this.isSyncingFromCloud = false;
              this.notify();

              // Asynchronously resolve cloud-referenced files and avatars
              this.resolveCloudMediaFiles(userId, finalMediaFiles).catch(() => {});
              this.resolveCloudAvatars(userId, finalClients).catch(() => {});
            }
          } else {
            // Cloud state does not exist yet.
            // Only push local state if we have actual clients or programs in local state, avoiding wiping cloud with empty mobile device
            if ((this.state.clients || []).length > 0 || (this.state.programs || []).length > 0) {
              this.scheduleCloudSync();
            }
          }
        },
        (error) => {
          if (isQuotaOrNetworkError(error)) {
            this.isQuotaExceeded = true;
            this.quotaExceededUntil = Date.now() + 30 * 1000;
            markFirestoreQuotaExceeded(30 * 1000);
          }
          handleFirestoreError(error, OperationType.GET, `users/${userId}/appData/state`);
        }
      );
    } catch (err) {
      if (isQuotaOrNetworkError(err)) {
        this.isQuotaExceeded = true;
        this.quotaExceededUntil = Date.now() + 30 * 1000;
        markFirestoreQuotaExceeded(30 * 1000);
      }
      handleFirestoreError(err, OperationType.GET, `users/${userId}/appData/state`);
    }
  }

  public async forceImmediateCloudSync() {
    if (this.cloudSyncDebounceTimer) {
      clearTimeout(this.cloudSyncDebounceTimer);
      this.cloudSyncDebounceTimer = null;
    }
    await this.syncStateToCloud();
  }

  public scheduleCloudSync() {
    if (isFirestoreQuotaExceeded() || (this.isQuotaExceeded && Date.now() < this.quotaExceededUntil)) {
      return;
    }
    if (this.cloudSyncDebounceTimer) {
      clearTimeout(this.cloudSyncDebounceTimer);
    }
    this.cloudSyncDebounceTimer = setTimeout(() => {
      this.syncStateToCloud();
    }, 2000);
  }

  public async syncStateToCloud() {
    const userId = this.state.currentUserId;
    if (!userId) return;

    if (isFirestoreQuotaExceeded() || (this.isQuotaExceeded && Date.now() < this.quotaExceededUntil)) {
      return;
    }

    // Protection guard: Do not overwrite existing cloud data with an empty client list
    // if a fresh mobile device opened before receiving the cloud snapshot.
    if ((this.state.clients || []).length === 0 && !this.hasConfirmedCloudEmpty) {
      console.warn('Sync guard: local state has 0 clients and cloud state not verified empty yet. Skipping upload to protect cloud data.');
      return;
    }

    try {
      const docRef = doc(db, 'users', userId, 'appData', 'state');
      const userProfileRef = doc(db, 'users', userId);
      const currProfile = this.getCurrentProfile();

      await setDoc(
        userProfileRef,
        stripUndefinedDeep({
          userId,
          email: currProfile.email || 'alli.kabbalah@gmail.com',
          fullName: currProfile.full_name || 'אלי קבלה',
          clientCount: (this.state.clients || []).length,
          sessionsCount: (this.state.sessions || []).length,
          programsCount: (this.state.programs || []).length,
          tasksCount: (this.state.tasks || []).length,
          mediaCount: (this.state.mediaFiles || []).length,
          activeOrgId: this.state.activeOrgId || '',
          lastSyncAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'active',
        }),
        { merge: true }
      );
      this.lastProfileSync = {
        userId,
        email: currProfile.email || 'alli.kabbalah@gmail.com',
        fullName: currProfile.full_name || 'אלי קבלה',
        time: Date.now(),
      };

      // Separate heavy media files and blobs into subcollection sync
      const mediaBlobsToSync: { id: string; dataUrl: string }[] = [];

      const sanitizedMediaFiles = (this.state.mediaFiles || []).map((m: any) => {
        const { blob_data, ...cleanM } = m;
        let urlToStore = cleanM.url || '';

        // If blob_data is present on m, read it for subcollection sync
        if (blob_data && !this.syncedMediaBlobIds.has(cleanM.id)) {
          if (typeof FileReader !== 'undefined') {
            const reader = new FileReader();
            reader.onload = () => {
              const res = reader.result as string;
              if (res) this.syncMediaBlobToCloud(userId, cleanM.id, res);
            };
            reader.readAsDataURL(blob_data);
          }
        }

        // Heavy URL or data URL -> offload to mediaBlobs subcollection
        if (urlToStore.startsWith('data:') || urlToStore.length > 250) {
          if (urlToStore.startsWith('data:') && !this.syncedMediaBlobIds.has(cleanM.id)) {
            mediaBlobsToSync.push({ id: cleanM.id, dataUrl: urlToStore });
          }
          urlToStore = `cloud_media:${cleanM.id}`;
        } else if (urlToStore.startsWith('blob:')) {
          urlToStore = cleanM.drive_view_link || cleanM.drive_thumbnail_link || `cloud_media:${cleanM.id}`;
        }

        return { ...cleanM, url: urlToStore };
      });

      // Sanitize sessions (remove data/blob URLs from audio_urls and image_urls)
      const sanitizedSessions = (this.state.sessions || []).map((s) => {
        let modified = false;
        const cleanAudioUrls = (s.audio_urls || []).map((url, idx) => {
          if (url && (url.startsWith('data:') || url.startsWith('blob:') || url.length > 250)) {
            const blobId = `session_audio_${s.id}_${idx}`;
            if (url.startsWith('data:') && !this.syncedMediaBlobIds.has(blobId)) {
              mediaBlobsToSync.push({ id: blobId, dataUrl: url });
            }
            modified = true;
            return `cloud_media:${blobId}`;
          }
          return url;
        });

        const cleanImageUrls = (s.image_urls || []).map((url, idx) => {
          if (url && (url.startsWith('data:') || url.startsWith('blob:') || url.length > 250)) {
            const blobId = `session_image_${s.id}_${idx}`;
            if (url.startsWith('data:') && !this.syncedMediaBlobIds.has(blobId)) {
              mediaBlobsToSync.push({ id: blobId, dataUrl: url });
            }
            modified = true;
            return `cloud_media:${blobId}`;
          }
          return url;
        });

        return modified ? { ...s, audio_urls: cleanAudioUrls, image_urls: cleanImageUrls } : s;
      });

      // Sanitize clients (keep preset SVGs and normal avatars <= 65KB embedded directly; only offload massive ones)
      const sanitizedClients = (this.state.clients || []).map((c) => {
        if (!c.avatar_url) return c;
        // Keep preset SVGs and standard sized avatars directly in payload
        if (c.avatar_url.startsWith('data:image/svg+xml') || c.avatar_url.length <= 65000) {
          return c;
        }
        const blobId = `avatar_${c.id}`;
        if (c.avatar_url.startsWith('data:') && !this.syncedMediaBlobIds.has(blobId)) {
          mediaBlobsToSync.push({ id: blobId, dataUrl: c.avatar_url });
        }
        return { ...c, avatar_url: `cloud_media:${blobId}` };
      });

      const payload: any = {
        userId,
        activeOrgId: this.state.activeOrgId || '',
        organizations: this.state.organizations || [],
        profiles: this.state.profiles || [],
        organizationMembers: this.state.organizationMembers || [],
        orgInvites: this.state.orgInvites || [],
        pendingApprovals: this.state.pendingApprovals || [],
        clients: sanitizedClients,
        programs: this.state.programs || [],
        sessions: sanitizedSessions,
        tasks: this.state.tasks || [],
        notifications: (this.state.notifications || []).slice(0, 40),
        activityLogs: (this.state.activityLogs || []).slice(0, 40),
        mediaFiles: sanitizedMediaFiles,
        updatedAt: new Date().toISOString(),
      };

      // Deep sanitize to eliminate any undefined fields before Firestore document write
      let cleanPayload: any = stripUndefinedDeep(payload);

      // Safeguard against 1MB document limit: ensure payload < 650,000 bytes
      let jsonStr = JSON.stringify(cleanPayload);
      if (jsonStr.length > 650000) {
        console.warn(`Payload size (${jsonStr.length} chars) is high. Applying protective pruning...`);
        cleanPayload.activityLogs = (cleanPayload.activityLogs || []).slice(0, 10);
        cleanPayload.notifications = (cleanPayload.notifications || []).slice(0, 10);
        jsonStr = JSON.stringify(cleanPayload);
      }

      if (jsonStr.length > 700000) {
        cleanPayload.clients = (cleanPayload.clients || []).map((c: any) => ({
          ...c,
          notes: c.notes && c.notes.length > 1000 ? c.notes.slice(0, 1000) + '...' : c.notes,
        }));
        cleanPayload.sessions = (cleanPayload.sessions || []).map((s: any) => ({
          ...s,
          notes: s.notes && s.notes.length > 1000 ? s.notes.slice(0, 1000) + '...' : s.notes,
        }));
        cleanPayload.mediaFiles = (cleanPayload.mediaFiles || []).slice(0, 50);
        jsonStr = JSON.stringify(cleanPayload);
      }

      if (jsonStr.length > 900000) {
        console.error(`Payload size (${jsonStr.length} bytes) exceeds 900KB safety margin. Aborting write to prevent Firestore document overflow.`);
        return;
      }

      // JSON.parse guarantees a clean object with no undefined values or prototype discrepancies
      const firestorePayload = JSON.parse(jsonStr);
      await setDoc(docRef, firestorePayload, { merge: true });

      // Synchronize clients subcollection for direct browsing in Firebase Console
      for (const client of (this.state.clients || [])) {
        if (!client || !client.id) continue;
        const clientDocRef = doc(db, 'users', userId, 'clients', client.id);
        await setDoc(
          clientDocRef,
          stripUndefinedDeep({
            id: client.id,
            full_name: client.full_name || '',
            phone: client.phone || '',
            email: client.email || '',
            status: client.status || 'active',
            mother_name: client.mother_name || '',
            address: client.address || '',
            date_of_birth: client.date_of_birth || '',
            selected_reading: client.selected_reading || '',
            created_at: client.created_at || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
          { merge: true }
        ).catch(() => {});
      }

      // Asynchronously sync new mediaBlobs to Firestore subcollection
      for (const item of mediaBlobsToSync) {
        await this.syncMediaBlobToCloud(userId, item.id, item.dataUrl);
      }
    } catch (error) {
      if (isQuotaOrNetworkError(error)) {
        this.isQuotaExceeded = true;
        this.quotaExceededUntil = Date.now() + 30 * 1000;
        markFirestoreQuotaExceeded(30 * 1000);
      }
      handleFirestoreError(error, OperationType.WRITE, `users/${userId}/appData/state`);
    }
  }

  private async syncMediaBlobToCloud(userId: string, mediaId: string, dataUrl: string) {
    if (this.isQuotaExceeded && Date.now() < this.quotaExceededUntil) return;
    try {
      const CHUNK_SIZE = 600000; // 600KB
      if (dataUrl.length <= CHUNK_SIZE) {
        const blobDocRef = doc(db, 'users', userId, 'mediaBlobs', mediaId);
        await setDoc(
          blobDocRef,
          stripUndefinedDeep({ dataUrl, updatedAt: new Date().toISOString() }),
          { merge: true }
        );
        this.syncedMediaBlobIds.add(mediaId);
      } else {
        const totalChunks = Math.ceil(dataUrl.length / CHUNK_SIZE);
        for (let i = 0; i < totalChunks; i++) {
          const chunk = dataUrl.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          const chunkDocRef = doc(db, 'users', userId, 'mediaBlobs', `${mediaId}_chunk_${i}`);
          await setDoc(
            chunkDocRef,
            stripUndefinedDeep({ chunk, chunkIndex: i, totalChunks, mediaId, updatedAt: new Date().toISOString() }),
            { merge: true }
          );
        }
        this.syncedMediaBlobIds.add(mediaId);
      }
    } catch (err) {
      if (isQuotaOrNetworkError(err)) {
        this.isQuotaExceeded = true;
        this.quotaExceededUntil = Date.now() + 15 * 60 * 1000;
      }
      console.warn(`Notice: Cloud media sync skipped for ${mediaId}.`);
    }
  }

  private async resolveCloudMediaFiles(userId: string, mediaFiles: MediaFile[]) {
    const unresolved = mediaFiles.filter((m) => m.url && m.url.startsWith('cloud_media:'));
    if (unresolved.length === 0) return;

    for (const m of unresolved) {
      const dataUrl = await this.fetchMediaBlobFromCloud(userId, m.id);
      if (dataUrl) {
        saveMediaBlobToIDB(m.id, dataUrl).catch(() => {});
        const target = this.state.mediaFiles.find((item) => item.id === m.id);
        if (target) {
          target.url = dataUrl;
          this.writeToLocalStorage(this.state);
          this.notify();
        }
      }
    }
  }

  private async resolveCloudAvatars(userId: string, clients: Client[]) {
    const unresolved = clients.filter((c) => c.avatar_url && c.avatar_url.startsWith('cloud_media:'));
    if (unresolved.length === 0) return;

    for (const c of unresolved) {
      const blobId = c.avatar_url!.replace('cloud_media:', '');
      const dataUrl = await this.fetchMediaBlobFromCloud(userId, blobId);
      if (dataUrl) {
        saveMediaBlobToIDB(blobId, dataUrl).catch(() => {});
        const target = this.state.clients.find((item) => item.id === c.id);
        if (target) {
          target.avatar_url = dataUrl;
          this.writeToLocalStorage(this.state);
          this.notify();
        }
      }
    }
  }

  private async fetchMediaBlobFromCloud(userId: string, mediaId: string): Promise<string | null> {
    if (isFirestoreQuotaExceeded() || (this.isQuotaExceeded && Date.now() < this.quotaExceededUntil)) {
      return null;
    }
    try {
      const blobDocRef = doc(db, 'users', userId, 'mediaBlobs', mediaId);
      const snap = await getDoc(blobDocRef);
      if (snap.exists() && snap.data().dataUrl) {
        return snap.data().dataUrl;
      }
      const chunk0Ref = doc(db, 'users', userId, 'mediaBlobs', `${mediaId}_chunk_0`);
      const chunk0Snap = await getDoc(chunk0Ref);
      if (chunk0Snap.exists()) {
        const { totalChunks } = chunk0Snap.data();
        let fullUrl = chunk0Snap.data().chunk || '';
        for (let i = 1; i < totalChunks; i++) {
          const cRef = doc(db, 'users', userId, 'mediaBlobs', `${mediaId}_chunk_${i}`);
          const cSnap = await getDoc(cRef);
          if (cSnap.exists()) {
            fullUrl += cSnap.data().chunk || '';
          }
        }
        return fullUrl;
      }
    } catch (err) {
      if (isQuotaOrNetworkError(err)) {
        this.isQuotaExceeded = true;
        this.quotaExceededUntil = Date.now() + 6 * 60 * 60 * 1000;
        markFirestoreQuotaExceeded();
      }
      console.warn(`Notice: Cloud media retrieval deferred for ${mediaId}.`);
    }
    return null;
  }

  private loadState(): AppState {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.clients) && parsed.clients.length > 0) {
          return this.sanitizeState({
            activeOrgId: parsed.activeOrgId || '',
            currentUserId: parsed.currentUserId || '',
            organizations: Array.isArray(parsed.organizations) ? parsed.organizations : [],
            profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
            organizationMembers: Array.isArray(parsed.organizationMembers) ? parsed.organizationMembers : [],
            orgInvites: Array.isArray(parsed.orgInvites) ? parsed.orgInvites : [],
            pendingApprovals: Array.isArray(parsed.pendingApprovals) ? parsed.pendingApprovals : [],
            clients: parsed.clients,
            programs: Array.isArray(parsed.programs) ? parsed.programs : [],
            sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
            tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
            notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
            activityLogs: Array.isArray(parsed.activityLogs) ? parsed.activityLogs : [],
            mediaFiles: Array.isArray(parsed.mediaFiles) ? parsed.mediaFiles : [],
          });
        }
      }
    } catch (e) {
      console.warn('Failed to parse saved state from localStorage, using seed state:', e);
    }
    return this.sanitizeState(seedState as any);
  }

  private getCleanLocalStorageState(state: AppState): AppState {
    const lightMediaFiles = (state.mediaFiles || []).map((m) => {
      if (m.url && (m.url.startsWith('data:') || m.url.length > 300)) {
        return { ...m, url: `idb_media:${m.id}` };
      }
      return m;
    });
    return { ...state, mediaFiles: lightMediaFiles };
  }

  private writeToLocalStorage(state: AppState) {
    try {
      const cleanState = this.getCleanLocalStorageState(state);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanState));
    } catch {
      try {
        this.pruneOldStorageKeys();
        const cleanState = this.getCleanLocalStorageState(state);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanState));
      } catch {
        // Fallback gracefully without console spam; IndexedDB maintains persistent backup
      }
    }
  }

  private pruneOldStorageKeys() {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (
          k &&
          (k.startsWith('kabbalah_crm_state_v1') ||
            k.startsWith('kabbalah_crm_state_v2') ||
            k.startsWith('kabbalah_crm_state_backup') ||
            k.startsWith('temp_'))
        ) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {
      // Ignore
    }
  }

  private saveState() {
    this.state = this.sanitizeState(this.state);
    
    // Save clean state to localStorage (no heavy base64 strings)
    this.writeToLocalStorage(this.state);

    // Persist clean state backup to IndexedDB for reliable offline storage without memory spikes
    try {
      const cleanBackup = this.getCleanLocalStorageState(this.state);
      saveStateBackupToIDB(JSON.stringify(cleanBackup)).catch(() => {});
    } catch {
      // Ignore
    }

    this.notify();

    if (!this.isSyncingFromCloud && this.state.currentUserId) {
      this.scheduleCloudSync();
    }
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  public deleteOrgsExceptEliran() {
    const isEliranName = (name: string) => {
      if (!name) return false;
      const lower = name.toLowerCase();
      return lower.includes('eliran') || name.includes('אלירן');
    };

    let eliranOrg = (this.state.organizations || []).find((o) => isEliranName(o.name));

    if (!eliranOrg) {
      const newOrgId = 'org_eliran_default';
      const currUserId = this.state.currentUserId || getDeterministicUserId('alli.kabbalah@gmail.com');
      const currProf = this.getCurrentProfile();
      eliranOrg = {
        id: newOrgId,
        name: 'קליניקת Eliran',
        owner_id: currUserId,
        created_at: new Date().toISOString(),
      };
      this.state.organizations = [eliranOrg];
      this.state.organizationMembers = [
        {
          id: 'mem_eliran_default',
          organization_id: newOrgId,
          user_id: currUserId,
          role: 'owner',
          created_at: new Date().toISOString(),
          user_email: currProf.email || 'alli.kabbalah@gmail.com',
          user_name: currProf.full_name || 'Eliran',
        },
      ];
    } else {
      eliranOrg.name = 'קליניקת Eliran';
      const eliranOrgId = eliranOrg.id;
      this.state.organizations = [eliranOrg];

      this.state.organizationMembers = (this.state.organizationMembers || []).filter(
        (m) => m.organization_id === eliranOrgId
      );
      this.state.orgInvites = (this.state.orgInvites || []).filter(
        (i) => i.organization_id === eliranOrgId
      );
      this.state.pendingApprovals = (this.state.pendingApprovals || []).filter(
        (p) => p.organization_id === eliranOrgId
      );
    }

    const eliranOrgId = eliranOrg.id;
    this.state.activeOrgId = eliranOrgId;

    if (Array.isArray(this.state.clients)) {
      this.state.clients.forEach((c) => {
        c.organization_id = eliranOrgId;
      });
    }
    if (Array.isArray(this.state.programs)) {
      this.state.programs.forEach((p) => {
        p.organization_id = eliranOrgId;
      });
    }
    if (Array.isArray(this.state.sessions)) {
      this.state.sessions.forEach((s) => {
        s.organization_id = eliranOrgId;
      });
    }
    if (Array.isArray(this.state.tasks)) {
      this.state.tasks.forEach((t) => {
        t.organization_id = eliranOrgId;
      });
    }
    if (Array.isArray(this.state.mediaFiles)) {
      this.state.mediaFiles.forEach((m) => {
        m.organization_id = eliranOrgId;
      });
    }
  }

  // Active Org & User
  public getActiveOrgId(): string {
    return this.state.activeOrgId;
  }

  public setActiveOrgId(orgId: string) {
    this.state.activeOrgId = orgId;
    this.saveState();
  }

  public getCurrentUserId(): string {
    return this.state.currentUserId;
  }

  public setCurrentUserId(userId: string) {
    this.state.currentUserId = userId;
    this.initCloudSync(userId);
    this.saveState();
  }

  // Auth Methods
  public autoLinkUserToOrganizations(prof: Profile) {
    const cleanEmail = prof.email.trim().toLowerCase();

    // Check if there is a pending invite token in localStorage
    if (typeof window !== 'undefined') {
      const pendingToken = localStorage.getItem('pending_invite_token');
      if (pendingToken) {
        this.acceptInvite(pendingToken);
        localStorage.removeItem('pending_invite_token');
      }
    }

    // 1. Process pending invites for this email
    const pendingInvites = (this.state.orgInvites || []).filter(
      (i) => i.email.trim().toLowerCase() === cleanEmail && !i.accepted_at
    );
    for (const invite of pendingInvites) {
      invite.accepted_at = new Date().toISOString();
      invite.accepted_by = prof.id;

      const existingMem = (this.state.organizationMembers || []).find(
        (m) =>
          m.organization_id === invite.organization_id &&
          (m.user_id === prof.id || (m.user_email && m.user_email.toLowerCase() === cleanEmail))
      );
      if (!existingMem) {
        this.state.organizationMembers.push({
          id: generateUUID(),
          organization_id: invite.organization_id,
          user_id: prof.id,
          role: invite.role === 'owner' ? 'admin' : invite.role,
          invited_by: invite.invited_by,
          created_at: new Date().toISOString(),
          user_email: prof.email,
          user_name: prof.full_name,
        });
      } else {
        existingMem.user_id = prof.id;
        if (prof.full_name) existingMem.user_name = prof.full_name;
        existingMem.user_email = prof.email;
      }
    }

    // 2. Link any member records pre-added by email
    for (const m of this.state.organizationMembers || []) {
      if (m.user_email && m.user_email.trim().toLowerCase() === cleanEmail) {
        m.user_id = prof.id;
        if (prof.full_name) m.user_name = prof.full_name;
      }
    }

    // 3. Link pending approvals
    for (const p of this.state.pendingApprovals || []) {
      if (p.user_email && p.user_email.trim().toLowerCase() === cleanEmail) {
        p.user_id = prof.id;
        if (prof.full_name) p.user_name = prof.full_name;
      }
    }

    // 4. Ensure user has an active organization
    const userOrgs = this.getOrganizations(prof.id);
    if (userOrgs.length > 0) {
      const hasActive = userOrgs.some((o) => o.id === this.state.activeOrgId);
      if (!hasActive) {
        this.state.activeOrgId = userOrgs[0].id;
      }
    } else {
      // If there are ALREADY existing organizations in the app, join the user to existing organizations
      if (this.state.organizations.length > 0) {
        for (const targetOrg of this.state.organizations) {
          this.state.organizationMembers.push({
            id: generateUUID(),
            organization_id: targetOrg.id,
            user_id: prof.id,
            role: 'therapist',
            created_at: new Date().toISOString(),
            user_email: prof.email,
            user_name: prof.full_name,
          });
        }
        this.state.activeOrgId = this.state.organizations[0].id;
      } else {
        // Create default organization if no orgs exist at all
        const newOrgId = generateUUID();
        const newOrgName = `קליניקת ${prof.full_name || 'קבלית'}`;
        const newOrg: Organization = {
          id: newOrgId,
          name: newOrgName,
          owner_id: prof.id,
          created_at: new Date().toISOString(),
        };
        this.state.organizations.push(newOrg);
        this.state.organizationMembers.push({
          id: generateUUID(),
          organization_id: newOrgId,
          user_id: prof.id,
          role: 'owner',
          created_at: new Date().toISOString(),
          user_email: prof.email,
          user_name: prof.full_name,
        });
        this.state.activeOrgId = newOrgId;
      }
    }
  }

  public loginWithGoogle(email: string, fullName?: string): { success: boolean; error?: string } {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, error: 'כתובת דוא"ל לא תקינה' };
    }

    const deterministicId = getDeterministicUserId(cleanEmail);
    let prof = this.state.profiles.find((p) => p.email.toLowerCase() === cleanEmail);
    if (!prof) {
      prof = {
        id: deterministicId,
        full_name: fullName?.trim() || cleanEmail.split('@')[0],
        email: cleanEmail,
        created_at: new Date().toISOString(),
      };
      this.state.profiles.push(prof);
    } else {
      if (prof.id !== deterministicId) {
        const oldId = prof.id;
        prof.id = deterministicId;
        (this.state.organizationMembers || []).forEach((m) => {
          if (m.user_id === oldId) m.user_id = deterministicId;
        });
      }
      if (fullName?.trim() && (!prof.full_name || prof.full_name === cleanEmail.split('@')[0])) {
        prof.full_name = fullName.trim();
      }
    }

    this.state.currentUserId = prof.id;
    this.initCloudSync(prof.id);
    this.autoLinkUserToOrganizations(prof);
    this.saveState();
    return { success: true };
  }

  public loginDirectly(email: string, fullName?: string): { success: boolean; error?: string } {
    const cleanEmail = (email || 'alli.kabbalah@gmail.com').trim().toLowerCase();
    const deterministicId = getDeterministicUserId(cleanEmail);
    let prof = this.state.profiles.find((p) => p.email && p.email.toLowerCase() === cleanEmail);

    if (!prof) {
      prof = {
        id: deterministicId,
        full_name: fullName?.trim() || cleanEmail.split('@')[0],
        email: cleanEmail,
        password: 'kabbalah0219',
        created_at: new Date().toISOString(),
      };
      this.state.profiles.push(prof);
    } else {
      prof.id = deterministicId;
      if (fullName?.trim()) prof.full_name = fullName.trim();
    }

    this.state.currentUserId = prof.id;
    this.initCloudSync(prof.id);
    this.autoLinkUserToOrganizations(prof);
    this.saveState();
    return { success: true };
  }

  public resetPassword(email: string, newPass: string): { success: boolean; error?: string } {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, error: 'אנא הזן כתובת דוא"ל' };
    }
    if (!newPass || newPass.trim().length < 4) {
      return { success: false, error: 'סיסמה חדשה חייבת להכיל לפחות 4 תווים' };
    }

    const deterministicId = getDeterministicUserId(cleanEmail);
    let prof = this.state.profiles.find((p) => p.email && p.email.toLowerCase() === cleanEmail);

    if (!prof) {
      prof = {
        id: deterministicId,
        full_name: cleanEmail.split('@')[0],
        email: cleanEmail,
        password: newPass.trim(),
        created_at: new Date().toISOString(),
      };
      this.state.profiles.push(prof);
    } else {
      prof.id = deterministicId;
      prof.password = newPass.trim();
    }

    this.state.currentUserId = prof.id;
    this.initCloudSync(prof.id);
    this.autoLinkUserToOrganizations(prof);
    this.saveState();
    return { success: true };
  }

  public login(email: string, pass: string): { success: boolean; error?: string } {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, error: 'אנא הזן כתובת דוא"ל' };
    }

    const deterministicId = getDeterministicUserId(cleanEmail);
    let prof = this.state.profiles.find((p) => p.email && p.email.toLowerCase() === cleanEmail);

    if (!prof) {
      // Auto-create user profile on first login with deterministic ID
      prof = {
        id: deterministicId,
        full_name: cleanEmail.split('@')[0],
        email: cleanEmail,
        password: pass.trim(),
        created_at: new Date().toISOString(),
      };
      this.state.profiles.push(prof);
    } else {
      if (prof.id !== deterministicId) {
        const oldId = prof.id;
        prof.id = deterministicId;
        (this.state.organizationMembers || []).forEach((m) => {
          if (m.user_id === oldId) m.user_id = deterministicId;
        });
      }

      // Check password: allow configured password or clinic master password
      const entered = pass.trim();
      const isMasterPass = entered === 'kabbalah0219' || entered === '123456';
      if (prof.password && prof.password !== entered && !isMasterPass) {
        return {
          success: false,
          error: 'סיסמה שגויה. באפשרותך להתחבר מיידית בלחיצה או לאפס את הסיסמה.',
        };
      }
      if (!prof.password && entered) {
        prof.password = entered;
      }
    }

    this.state.currentUserId = prof.id;
    this.initCloudSync(prof.id);
    this.autoLinkUserToOrganizations(prof);
    this.saveState();
    return { success: true };
  }

  public register(email: string, pass: string, fullName: string): { success: boolean; error?: string } {
    const cleanEmail = email.trim().toLowerCase();
    const deterministicId = getDeterministicUserId(cleanEmail);
    let prof = this.state.profiles.find((p) => p.email.toLowerCase() === cleanEmail);

    if (prof) {
      if (prof.password) {
        return { success: false, error: 'משתמש עם כתובת אימייל זו כבר קיים. אנא התחבר.' };
      } else {
        if (prof.id !== deterministicId) {
          const oldId = prof.id;
          prof.id = deterministicId;
          (this.state.organizationMembers || []).forEach((m) => {
            if (m.user_id === oldId) m.user_id = deterministicId;
          });
        }
        prof.password = pass.trim();
        prof.full_name = fullName.trim() || prof.full_name;
      }
    } else {
      prof = {
        id: deterministicId,
        full_name: fullName.trim(),
        email: cleanEmail,
        password: pass.trim(),
        created_at: new Date().toISOString(),
      };
      this.state.profiles.push(prof);
    }

    this.state.currentUserId = prof.id;
    this.initCloudSync(prof.id);
    this.autoLinkUserToOrganizations(prof);
    this.saveState();
    return { success: true };
  }

  public logout() {
    if (this.unsubscribeFirestore) {
      this.unsubscribeFirestore();
      this.unsubscribeFirestore = null;
    }
    this.state.currentUserId = '';
    this.state.activeOrgId = '';
    this.saveState();
  }

  public createOrganization(name: string): Organization {
    if (!this.state.currentUserId) {
      throw new Error('יש להתחבר למערכת כדי ליצור ארגון');
    }
    const currProf = this.getCurrentProfile();
    const newOrgId = generateUUID();
    const newOrg: Organization = {
      id: newOrgId,
      name: name.trim() || 'קליניקה חדשה',
      owner_id: this.state.currentUserId,
      created_at: new Date().toISOString(),
    };
    this.state.organizations.push(newOrg);
    this.state.organizationMembers.push({
      id: generateUUID(),
      organization_id: newOrgId,
      user_id: this.state.currentUserId,
      role: 'owner',
      created_at: new Date().toISOString(),
      user_email: currProf.email,
      user_name: currProf.full_name,
    });
    this.state.activeOrgId = newOrgId;
    this.saveState();
    return newOrg;
  }

  public canManageMembers(orgId = this.state.activeOrgId, userId = this.state.currentUserId): boolean {
    const member = this.state.organizationMembers.find(
      (m) => m.organization_id === orgId && m.user_id === userId
    );
    return member?.role === 'owner' || member?.role === 'admin';
  }

  public addMemberDirect(email: string, fullName: string, role: MemberRole = 'therapist') {
    if (!this.canManageMembers()) {
      throw new Error('רק מנהל או יוצר הארגון רשאי להוסיף חברים לארגון');
    }
    const cleanEmail = email.trim().toLowerCase();
    let profile = this.state.profiles.find((p) => p.email.toLowerCase() === cleanEmail);
    if (!profile) {
      profile = {
        id: generateUUID(),
        full_name: fullName.trim() || cleanEmail.split('@')[0],
        email: cleanEmail,
        created_at: new Date().toISOString(),
      };
      this.state.profiles.push(profile);
    } else if (fullName.trim() && (!profile.full_name || profile.full_name === cleanEmail.split('@')[0])) {
      profile.full_name = fullName.trim();
    }

    const existingMem = this.state.organizationMembers.find(
      (m) =>
        m.organization_id === this.state.activeOrgId &&
        (m.user_id === profile!.id || (m.user_email && m.user_email.toLowerCase() === cleanEmail))
    );
    if (!existingMem) {
      this.state.organizationMembers.push({
        id: generateUUID(),
        organization_id: this.state.activeOrgId,
        user_id: profile.id,
        role,
        created_at: new Date().toISOString(),
        user_email: cleanEmail,
        user_name: profile.full_name,
      });
    } else {
      existingMem.user_id = profile.id;
      existingMem.role = role;
      existingMem.user_name = profile.full_name;
    }

    // Ensure invite record exists for complete auto-link matching
    const existingInvite = (this.state.orgInvites || []).find(
      (i) => i.organization_id === this.state.activeOrgId && i.email.toLowerCase() === cleanEmail
    );
    if (!existingInvite) {
      if (!this.state.orgInvites) this.state.orgInvites = [];
      this.state.orgInvites.push({
        id: generateUUID(),
        organization_id: this.state.activeOrgId,
        email: cleanEmail,
        role: role === 'owner' ? 'admin' : role,
        token: generateUUID(),
        invited_by: this.state.currentUserId,
        created_at: new Date().toISOString(),
      });
    }

    this.saveState();
  }

  public getOrganizations(userId = this.state.currentUserId): Organization[] {
    if (!userId) return [];
    const myOrgIds = new Set(
      (this.state.organizationMembers || [])
        .filter((m) => m.user_id === userId)
        .map((m) => m.organization_id)
    );
    return (this.state.organizations || []).filter((o) => myOrgIds.has(o.id));
  }

  public getActiveOrg(): Organization | undefined {
    const userOrgs = this.getOrganizations();
    const active = userOrgs.find((o) => o.id === this.state.activeOrgId);
    if (!active && userOrgs.length > 0) {
      this.state.activeOrgId = userOrgs[0].id;
      return userOrgs[0];
    }
    return active;
  }

  public getProfiles(): Profile[] {
    return this.state.profiles || [];
  }

  public getCurrentProfile(): Profile {
    if (!this.state.currentUserId) {
      const defaultEmail = 'alli.kabbalah@gmail.com';
      this.state.currentUserId = getDeterministicUserId(defaultEmail);
    }

    let prof = (this.state.profiles || []).find((p) => p.id === this.state.currentUserId);
    if (!prof) {
      // Try to find profile by email matching deterministic id
      prof = (this.state.profiles || []).find(
        (p) => p.email && getDeterministicUserId(p.email) === this.state.currentUserId
      );
    }
    if (!prof && (this.state.profiles || []).length > 0) {
      prof = this.state.profiles[0];
    }
    if (prof) {
      if (prof.id !== this.state.currentUserId && this.state.currentUserId) {
        prof.id = this.state.currentUserId;
      }
      return prof;
    }

    return {
      id: this.state.currentUserId || getDeterministicUserId('alli.kabbalah@gmail.com'),
      full_name: 'אלי קבלה',
      email: 'alli.kabbalah@gmail.com',
      password: 'kabbalah0219',
      created_at: new Date().toISOString(),
    };
  }

  public getOrganizationMembers(orgId = this.state.activeOrgId): OrganizationMember[] {
    return (this.state.organizationMembers || []).filter((m) => m.organization_id === orgId);
  }

  public getPendingApprovals(orgId = this.state.activeOrgId): OrgPendingApproval[] {
    return (this.state.pendingApprovals || []).filter(
      (p) => p.organization_id === orgId && p.status === 'pending'
    );
  }

  public getUserRoleInOrg(orgId = this.state.activeOrgId, userId = this.state.currentUserId) {
    const member = this.state.organizationMembers.find(
      (m) => m.organization_id === orgId && m.user_id === userId
    );
    return member?.role || 'therapist';
  }

  // CLIENTS
  public getClients(orgId = this.state.activeOrgId): Client[] {
    const list = this.state.clients || [];
    if (!orgId) return list;
    const filtered = list.filter((c) => !c.organization_id || c.organization_id === orgId);
    if (filtered.length === 0 && list.length > 0) return list;
    return filtered;
  }

  public getInactiveClients(inactivityDays = 14, orgId = this.state.activeOrgId): {
    client: Client;
    daysSinceLastActivity: number;
    lastActivityDate: string | null;
    hasActiveProgram: boolean;
    totalSessions: number;
    totalPrograms: number;
    reason: 'no_programs_or_sessions' | 'inactive_period';
  }[] {
    const clients = this.getClients(orgId);
    const now = Date.now();
    const thresholdMs = inactivityDays * 24 * 60 * 60 * 1000;

    return clients
      .map((client) => {
        const clientPrograms = (this.state.programs || []).filter((p) => p.client_id === client.id);
        const clientSessions = (this.state.sessions || []).filter((s) => s.client_id === client.id);

        // If client has future scheduled sessions, they are already on the calendar and not neglected
        const futureSessions = clientSessions.filter(
          (s) => s.session_date && new Date(s.session_date).getTime() > now && s.status !== 'cancelled'
        );
        if (futureSessions.length > 0) {
          return null;
        }

        const activityTimestamps: number[] = [];
        clientSessions.forEach((s) => {
          if (s.session_date) {
            const t = new Date(s.session_date).getTime();
            if (!isNaN(t) && t <= now) activityTimestamps.push(t);
          }
        });
        clientPrograms.forEach((p) => {
          if (p.created_at) {
            const t = new Date(p.created_at).getTime();
            if (!isNaN(t) && t <= now) activityTimestamps.push(t);
          }
          if (p.start_date) {
            const t = new Date(p.start_date).getTime();
            if (!isNaN(t) && t <= now) activityTimestamps.push(t);
          }
        });

        if (activityTimestamps.length === 0) {
          const createdMs = client.created_at ? new Date(client.created_at).getTime() : now;
          const days = Math.floor((now - createdMs) / (1000 * 60 * 60 * 24));
          return {
            client,
            daysSinceLastActivity: Math.max(0, days),
            lastActivityDate: client.created_at || null,
            hasActiveProgram: false,
            totalSessions: 0,
            totalPrograms: 0,
            reason: 'no_programs_or_sessions' as const,
          };
        }

        const mostRecent = Math.max(...activityTimestamps);
        const diffMs = now - mostRecent;
        const daysSince = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMs >= thresholdMs) {
          return {
            client,
            daysSinceLastActivity: daysSince,
            lastActivityDate: new Date(mostRecent).toISOString(),
            hasActiveProgram: clientPrograms.some((p) => p.status === 'active'),
            totalSessions: clientSessions.length,
            totalPrograms: clientPrograms.length,
            reason: 'inactive_period' as const,
          };
        }

        return null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.daysSinceLastActivity - a.daysSinceLastActivity);
  }

  public getClientById(id: string): Client | undefined {
    return (this.state.clients || []).find((c) => c.id === id);
  }

  public addClient(clientData: Omit<Client, 'id' | 'created_at' | 'organization_id'>): Client {
    const newClient: Client = {
      ...clientData,
      id: generateUUID(),
      organization_id: this.state.activeOrgId,
      created_by: this.state.currentUserId,
      created_at: new Date().toISOString(),
    };
    this.state.clients.push(newClient);

    this.logActivity(newClient.id, 'client_created', { name: newClient.full_name });

    // Trigger waiting follow-up if status is waiting
    if (newClient.status === 'waiting') {
      this.ensureWaitingFollowupTask(newClient);
    }

    this.saveState();
    return newClient;
  }

  public updateClient(id: string, updates: Partial<Client>): Client | undefined {
    const idx = this.state.clients.findIndex((c) => c.id === id);
    if (idx === -1) return undefined;

    const oldClient = this.state.clients[idx];
    const updatedClient = {
      ...oldClient,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.state.clients[idx] = updatedClient;

    if (updates.status && updates.status !== oldClient.status) {
      this.logActivity(id, 'status_changed', { from: oldClient.status, to: updates.status });
      if (updates.status === 'waiting') {
        this.ensureWaitingFollowupTask(updatedClient);
      }
    }

    this.saveState();
    return updatedClient;
  }

  public deleteClientCascading(clientId: string) {
    // Delete sessions, programs, tasks, activity logs, media files, then client
    this.state.sessions = this.state.sessions.filter((s) => s.client_id !== clientId);
    this.state.programs = this.state.programs.filter((p) => p.client_id !== clientId);
    this.state.tasks = this.state.tasks.filter((t) => t.client_id !== clientId);
    this.state.activityLogs = this.state.activityLogs.filter((a) => a.client_id !== clientId);
    this.state.mediaFiles = this.state.mediaFiles.filter((m) => m.parent_id !== clientId);
    this.state.clients = this.state.clients.filter((c) => c.id !== clientId);
    this.saveState();
  }

  // Auto trigger for waiting status
  private ensureWaitingFollowupTask(client: Client) {
    const existing = this.state.tasks.find(
      (t) =>
        t.client_id === client.id &&
        t.status === 'todo' &&
        t.source === 'waiting_followup'
    );
    if (!existing) {
      const dueDate = new Date(Date.now() + 10 * 86400000).toISOString();
      this.addTask({
        title: `חזור ללקוח בהמתנה — ${client.full_name}`,
        description: 'משימת מעקב אוטומטית בעקבות מעבר הלקוח לסטטוס בהמתנה.',
        priority: 'medium',
        status: 'todo',
        due_date: dueDate,
        client_id: client.id,
        assigned_to: client.assigned_to || this.state.currentUserId,
        source: 'waiting_followup',
      });
    }
  }

  // PROGRAMS
  public getPrograms(clientId?: string, orgId = this.state.activeOrgId): Program[] {
    const list = this.state.programs || [];
    return list.filter((p) => {
      if (orgId && p.organization_id && p.organization_id !== orgId) {
        const hasOrgMatches = list.some((x) => x.organization_id === orgId);
        if (hasOrgMatches) return false;
      }
      if (clientId && p.client_id !== clientId) return false;
      return true;
    });
  }

  public getProgramById(programId: string): Program | undefined {
    return (this.state.programs || []).find((p) => p.id === programId);
  }

  public addProgram(programData: Omit<Program, 'id' | 'created_at' | 'organization_id'>): Program {
    const newProg: Program = {
      ...programData,
      id: generateUUID(),
      organization_id: this.state.activeOrgId,
      created_by: this.state.currentUserId,
      created_at: new Date().toISOString(),
    };
    this.state.programs.push(newProg);

    // Auto generate sessions
    const generated = generateSessions({
      organization_id: this.state.activeOrgId,
      program_id: newProg.id,
      client_id: newProg.client_id,
      start_date: newProg.start_date,
      weekly_days: newProg.weekly_days,
      total_sessions: newProg.total_sessions,
      session_times: newProg.session_times,
      day_times: newProg.day_times,
      session_time: newProg.session_time,
      assigned_to: newProg.assigned_to,
    });

    generated.forEach((s) => {
      this.state.sessions.push({
        ...s,
        created_at: new Date().toISOString(),
      });
    });

    // Auto set client status to active
    this.updateClient(newProg.client_id, { status: 'active' });
    this.logActivity(newProg.client_id, 'program_created', { title: newProg.title });

    this.saveState();
    return newProg;
  }

  public updateProgramWithSessions(
    programId: string,
    updates: Partial<Program>
  ): Program | undefined {
    const idx = this.state.programs.findIndex((p) => p.id === programId);
    if (idx === -1) return undefined;

    const oldProg = this.state.programs[idx];
    const updatedProg = { ...oldProg, ...updates, updated_at: new Date().toISOString() };
    this.state.programs[idx] = updatedProg;

    // Retain past or completed/cancelled sessions, recreate future scheduled
    const nowISO = new Date().toISOString();
    const existingSessions = this.state.sessions.filter((s) => s.program_id === programId);

    const retainedSessions = existingSessions.filter(
      (s) => s.status !== 'scheduled' || s.session_date < nowISO
    );

    // Remove old scheduled future sessions
    this.state.sessions = this.state.sessions.filter(
      (s) => s.program_id !== programId || (s.status !== 'scheduled' || s.session_date < nowISO)
    );

    const remainingCount = Math.max(0, updatedProg.total_sessions - retainedSessions.length);
    if (remainingCount > 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      const startDateUse = updatedProg.start_date > todayStr ? updatedProg.start_date : todayStr;

      const newGenerated = generateSessions({
        organization_id: updatedProg.organization_id,
        program_id: updatedProg.id,
        client_id: updatedProg.client_id,
        start_date: startDateUse,
        weekly_days: updatedProg.weekly_days,
        total_sessions: remainingCount,
        session_times: updatedProg.session_times,
        day_times: updatedProg.day_times,
        session_time: updatedProg.session_time,
        assigned_to: updatedProg.assigned_to,
      });

      newGenerated.forEach((s) => {
        this.state.sessions.push({
          ...s,
          created_at: new Date().toISOString(),
        });
      });
    }

    this.logActivity(updatedProg.client_id, 'program_updated', { title: updatedProg.title });
    this.saveState();
    return updatedProg;
  }

  public deleteProgram(programId: string) {
    const prog = this.state.programs.find((p) => p.id === programId);
    this.state.sessions = this.state.sessions.filter((s) => s.program_id !== programId);
    this.state.programs = this.state.programs.filter((p) => p.id !== programId);
    if (prog) {
      this.logActivity(prog.client_id, 'program_deleted', { title: prog.title });
    }
    this.saveState();
  }

  // SESSIONS
  public getSessions(clientId?: string, programId?: string, orgId = this.state.activeOrgId): Session[] {
    const list = this.state.sessions || [];
    const filtered = list.filter((s) => {
      if (orgId && s.organization_id && s.organization_id !== orgId) {
        const hasOrgMatches = list.some((x) => x.organization_id === orgId);
        if (hasOrgMatches) return false;
      }
      if (clientId && s.client_id !== clientId) return false;
      if (programId && s.program_id !== programId) return false;
      return true;
    });

    // Sort: most recent at the top (descending by session_date, then created_at)
    return filtered.sort((a, b) => {
      const timeA = a.session_date ? new Date(a.session_date).getTime() : 0;
      const timeB = b.session_date ? new Date(b.session_date).getTime() : 0;
      if (timeB !== timeA) return timeB - timeA;
      const crA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const crB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return crB - crA;
    });
  }

  public deleteSession(sessionId: string) {
    const sess = this.state.sessions.find((s) => s.id === sessionId);
    this.state.sessions = this.state.sessions.filter((s) => s.id !== sessionId);
    if (sess) {
      this.logActivity(sess.client_id, 'session_deleted', { date: sess.session_date });
    }
    this.saveState();
  }

  public addSession(sessionData: Omit<Session, 'id' | 'created_at' | 'organization_id'>): Session {
    const newSession: Session = {
      ...sessionData,
      id: generateUUID(),
      organization_id: this.state.activeOrgId,
      audio_urls: sessionData.audio_urls || [],
      image_urls: sessionData.image_urls || [],
      created_at: new Date().toISOString(),
    };
    this.state.sessions.push(newSession);
    this.saveState();
    return newSession;
  }

  public updateSession(sessionId: string, updates: Partial<Session>): Session | undefined {
    const idx = this.state.sessions.findIndex((s) => s.id === sessionId);
    if (idx === -1) return undefined;

    const oldSession = this.state.sessions[idx];
    const updatedSession = { ...oldSession, ...updates, updated_at: new Date().toISOString() };
    this.state.sessions[idx] = updatedSession;

    // Handle status change
    if (updates.status && updates.status !== oldSession.status) {
      if (updates.status === 'completed') {
        // Update client last_completed_session_at
        this.updateClient(updatedSession.client_id, {
          last_completed_session_at: new Date().toISOString(),
        });
        this.logActivity(updatedSession.client_id, 'session_completed', {
          date: updatedSession.session_date,
        });
      } else if (updates.status === 'postponed' && updatedSession.program_id) {
        // Auto reschedule
        const prog = this.state.programs.find((p) => p.id === updatedSession.program_id);
        if (prog) {
          const existingForProg = this.state.sessions.filter((s) => s.program_id === prog.id);
          const rescheduled = createRescheduledSession(existingForProg, prog);
          if (rescheduled) {
            this.state.sessions.push(rescheduled);
            this.addNotification({
              type: 'system',
              title: 'נוצר מפגש חלופי',
              body: `נוצר מפגש חדש בתוכנית בעקבות דחיית המפגש.`,
              link: `/calendar`,
            });
          }
        }
      }
    }

    this.saveState();
    return updatedSession;
  }

  // TASKS
  public getTasks(orgId = this.state.activeOrgId): Task[] {
    const list = this.state.tasks || [];
    if (!orgId) return list;
    const filtered = list.filter((t) => !t.organization_id || t.organization_id === orgId);
    if (filtered.length === 0 && list.length > 0) return list;
    return filtered;
  }

  public addTask(taskData: Omit<Task, 'id' | 'created_at' | 'organization_id'>): Task {
    const newTask: Task = {
      ...taskData,
      id: generateUUID(),
      organization_id: this.state.activeOrgId,
      created_by: this.state.currentUserId,
      created_at: new Date().toISOString(),
    };
    this.state.tasks.push(newTask);
    this.saveState();
    return newTask;
  }

  public updateTask(id: string, updates: Partial<Task>): Task | undefined {
    const idx = this.state.tasks.findIndex((t) => t.id === id);
    if (idx === -1) return undefined;

    const oldTask = this.state.tasks[idx];
    const updatedTask = { ...oldTask, ...updates, updated_at: new Date().toISOString() };

    // Reset reminders if due_date changed
    if (updates.due_date && updates.due_date !== oldTask.due_date) {
      updatedTask.reminder_1h_sent_at = undefined;
      updatedTask.reminder_10m_sent_at = undefined;
    }

    this.state.tasks[idx] = updatedTask;
    this.saveState();
    return updatedTask;
  }

  public deleteTask(id: string) {
    this.state.tasks = this.state.tasks.filter((t) => t.id !== id);
    this.saveState();
  }

  // LIVE READING
  public performLiveReading(clientId: string, readingType: string, summaryNotes: string, followupDays: number) {
    const client = this.getClientById(clientId);
    if (!client) return;

    // 1. Update selected_reading on client
    this.updateClient(clientId, { selected_reading: readingType });

    // 2. Create Live Reading Program (1 session)
    const today = new Date().toISOString().split('T')[0];
    const prog = this.addProgram({
      client_id: clientId,
      title: `לייב רידינג — ${readingType}`,
      total_sessions: 1,
      weekly_days: [new Date().getDay()],
      start_date: today,
      status: 'completed',
      sessions_per_day: 1,
      session_times: [new Date().toISOString().split('T')[1].substring(0, 5)],
    });

    // Mark the auto-created session as completed
    const session = this.getSessions(clientId, prog.id)[0];
    if (session) {
      this.updateSession(session.id, {
        status: 'completed',
        notes: `קריאה קבלית: ${readingType}\nסיכום: ${summaryNotes}`,
      });
    }

    // 3. Create follow-up task X days out
    const dueDate = new Date(Date.now() + followupDays * 86400000).toISOString();
    this.addTask({
      title: `מעקב לייב רידינג (${readingType}) — ${client.full_name}`,
      description: `סיכום הקריאה:\n${summaryNotes}`,
      priority: 'high',
      status: 'todo',
      due_date: dueDate,
      client_id: clientId,
      assigned_to: client.assigned_to || this.state.currentUserId,
    });

    this.logActivity(clientId, 'live_reading', { reading: readingType });
    this.saveState();
  }

  // NOTIFICATIONS
  public getNotifications(userId = this.state.currentUserId): NotificationItem[] {
    return (this.state.notifications || [])
      .filter((n) => n.user_id === userId && n.organization_id === this.state.activeOrgId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 50);
  }

  public getUnreadNotificationCount(userId = this.state.currentUserId): number {
    return (this.state.notifications || []).filter(
      (n) => n.user_id === userId && n.organization_id === this.state.activeOrgId && !n.read_at
    ).length;
  }

  public addNotification(
    data: Omit<NotificationItem, 'id' | 'created_at' | 'user_id' | 'organization_id'>
  ): NotificationItem {
    const newNotif: NotificationItem = {
      ...data,
      id: generateUUID(),
      user_id: this.state.currentUserId,
      organization_id: this.state.activeOrgId,
      created_at: new Date().toISOString(),
    };
    this.state.notifications.unshift(newNotif);
    this.saveState();
    return newNotif;
  }

  public markAllNotificationsAsRead() {
    const now = new Date().toISOString();
    this.state.notifications.forEach((n) => {
      if (n.user_id === this.state.currentUserId && !n.read_at) {
        n.read_at = now;
      }
    });
    this.saveState();
  }

  public markAllNotificationsRead() {
    this.markAllNotificationsAsRead();
  }

  public markNotificationRead(id: string) {
    const notif = this.state.notifications.find((n) => n.id === id);
    if (notif) {
      notif.read_at = new Date().toISOString();
      this.saveState();
    }
  }

  public approvePendingUser(approvalId: string) {
    const app = this.state.pendingApprovals.find((p) => p.id === approvalId);
    if (app) {
      app.status = 'approved';
      this.state.organizationMembers.push({
        id: generateUUID(),
        organization_id: app.organization_id,
        user_id: app.user_id,
        role: 'therapist',
        created_at: new Date().toISOString(),
        user_email: app.user_email,
        user_name: app.user_name,
      });
      this.saveState();
    }
  }

  public rejectPendingUser(approvalId: string) {
    const app = this.state.pendingApprovals.find((p) => p.id === approvalId);
    if (app) {
      app.status = 'rejected';
      this.saveState();
    }
  }

  public updateMemberRole(userId: string, role: 'admin' | 'therapist' | 'member') {
    const m = this.state.organizationMembers.find(
      (item) => item.organization_id === this.state.activeOrgId && item.user_id === userId
    );
    if (m) {
      m.role = role;
      this.saveState();
    }
  }

  public removeMember(userId: string) {
    this.state.organizationMembers = this.state.organizationMembers.filter(
      (m) => !(m.organization_id === this.state.activeOrgId && m.user_id === userId)
    );
    this.saveState();
  }

  public exportAllData() {
    return {
      clients: this.state.clients,
      programs: this.state.programs,
      sessions: this.state.sessions,
      tasks: this.state.tasks,
      mediaFiles: this.state.mediaFiles,
      activityLogs: this.state.activityLogs,
    };
  }

  public exportClientsCustomFormat(clients?: Client[]): any[] {
    const list = clients || this.getClients();
    return list.map((c) => formatClientToCustomExport(c));
  }

  public importAllData(
    data: any,
    options?: { mergeStrategy?: 'merge_and_update' | 'skip_existing' | 'add_all_as_new' }
  ) {
    const mergeStrategy = options?.mergeStrategy || 'merge_and_update';
    if (!data || typeof data !== 'object') return;

    if (data.clients && Array.isArray(data.clients)) {
      const clientIdRemap: Record<string, string> = {};
      data.clients.forEach((c: any) => {
        if (!c || typeof c !== 'object') return;
        const origId = c.id ? String(c.id).trim() : '';

        if (mergeStrategy === 'add_all_as_new') {
          const newId = generateUUID();
          if (origId) clientIdRemap[origId] = newId;
          this.state.clients.push({ ...c, id: newId });
          return;
        }

        const match = findExistingClientMatch(c, this.state.clients);
        if (match) {
          if (origId && origId !== match.id) clientIdRemap[origId] = match.id;
          if (mergeStrategy === 'merge_and_update') {
            const merged = mergeClientRecord(match, c);
            const idx = this.state.clients.findIndex((x) => x.id === match.id);
            if (idx >= 0) this.state.clients[idx] = merged;
          }
        } else {
          const newId = origId || generateUUID();
          if (origId) clientIdRemap[origId] = newId;
          this.state.clients.push({ ...c, id: newId });
        }
      });

      // Remap client IDs in related tables if present
      const remapClientIdInList = (list?: any[]) => {
        if (!Array.isArray(list)) return;
        list.forEach((item) => {
          if (item && item.client_id && clientIdRemap[item.client_id]) {
            item.client_id = clientIdRemap[item.client_id];
          }
          if (item && item.parent_id && clientIdRemap[item.parent_id]) {
            item.parent_id = clientIdRemap[item.parent_id];
          }
        });
      };

      remapClientIdInList(data.programs);
      remapClientIdInList(data.sessions);
      remapClientIdInList(data.tasks);
      remapClientIdInList(data.mediaFiles);
    }

    if (data.programs && Array.isArray(data.programs)) {
      this.state.programs = deduplicateById([...this.state.programs, ...data.programs]);
    }
    if (data.sessions && Array.isArray(data.sessions)) {
      this.state.sessions = deduplicateById([...this.state.sessions, ...data.sessions]);
    }
    if (data.tasks && Array.isArray(data.tasks)) {
      this.state.tasks = deduplicateById([...this.state.tasks, ...data.tasks]);
    }
    if (data.mediaFiles && Array.isArray(data.mediaFiles)) {
      this.state.mediaFiles = deduplicateById([...this.state.mediaFiles, ...data.mediaFiles]);
    }
    if (data.activityLogs && Array.isArray(data.activityLogs)) {
      this.state.activityLogs = deduplicateById([...this.state.activityLogs, ...data.activityLogs]);
    }
    this.saveState();
  }

  public importMappedJsonEntities(
    mappings: ImportMappingItem[],
    options?: { mergeStrategy?: 'merge_and_update' | 'skip_existing' | 'add_all_as_new' }
  ): {
    success: boolean;
    importedCounts: Record<string, number>;
    updatedClientsCount: number;
    newClientsCount: number;
    skippedClientsCount: number;
  } {
    const mergeStrategy = options?.mergeStrategy || 'merge_and_update';
    const counts: Record<string, number> = {
      clients: 0,
      programs: 0,
      sessions: 0,
      tasks: 0,
      mediaFiles: 0,
      activityLogs: 0,
      notifications: 0,
    };
    let updatedClientsCount = 0;
    let newClientsCount = 0;
    let skippedClientsCount = 0;

    const targetOrgId = this.state.activeOrgId;
    if (!targetOrgId) {
      throw new Error('אין ארגון פעיל. אנא בחר או צור ארגון חדש ראשית.');
    }

    // Map to remap old client IDs to existing/new client IDs for linked entities
    const clientIdRemap: Record<string, string> = {};

    // 1. Separate client entities so they are ALWAYS processed first
    const clientItemsToProcess: any[] = [];
    const otherMappings: { entityType: keyof AppState; item: any }[] = [];

    mappings.forEach((mapping) => {
      if (mapping.entityType === 'ignore' || !mapping.items || !Array.isArray(mapping.items)) return;

      if (mapping.entityType === 'full_export') {
        const obj = mapping.items[0] || {};
        if (Array.isArray(obj.clients)) {
          obj.clients.forEach((c: any) => {
            if (c && typeof c === 'object') clientItemsToProcess.push(c);
          });
        }
        const otherKeys = ['programs', 'sessions', 'tasks', 'mediaFiles', 'activityLogs', 'notifications'] as const;
        otherKeys.forEach((k) => {
          if (Array.isArray(obj[k])) {
            obj[k].forEach((it: any) => {
              if (it && typeof it === 'object') otherMappings.push({ entityType: k, item: it });
            });
          }
        });
      } else if (mapping.entityType === 'clients') {
        mapping.items.forEach((item) => {
          if (item && typeof item === 'object') clientItemsToProcess.push(item);
        });
      } else {
        const key = mapping.entityType as keyof AppState;
        mapping.items.forEach((item) => {
          if (item && typeof item === 'object') otherMappings.push({ entityType: key, item });
        });
      }
    });

    // 2. Process Clients with smart deduplication & merge
    clientItemsToProcess.forEach((importedClient) => {
      const origId = importedClient.id ? String(importedClient.id).trim() : '';

      if (mergeStrategy === 'add_all_as_new') {
        const newId = generateUUID();
        if (origId) clientIdRemap[origId] = newId;
        const newClient: Client = {
          ...importedClient,
          id: newId,
          organization_id: targetOrgId,
          created_at: importedClient.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        this.state.clients.push(newClient);
        newClientsCount++;
        counts.clients++;
        return;
      }

      // Find existing match by ID, phone, email, or full_name
      const existingMatch = findExistingClientMatch(importedClient, this.state.clients);

      if (existingMatch) {
        // Record ID remapping if the imported item had a different ID
        if (origId && origId !== existingMatch.id) {
          clientIdRemap[origId] = existingMatch.id;
        }

        if (mergeStrategy === 'merge_and_update') {
          // Merge data into existing client without wiping good fields
          const merged = mergeClientRecord(existingMatch, importedClient);
          merged.organization_id = targetOrgId;
          const idx = this.state.clients.findIndex((c) => c.id === existingMatch.id);
          if (idx >= 0) {
            this.state.clients[idx] = merged;
          }
          updatedClientsCount++;
          counts.clients++;
        } else if (mergeStrategy === 'skip_existing') {
          skippedClientsCount++;
        }
      } else {
        // No match found -> create new client
        const newId = origId || generateUUID();
        if (origId) clientIdRemap[origId] = newId;
        const newClient: Client = {
          ...importedClient,
          id: newId,
          organization_id: targetOrgId,
          created_at: importedClient.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        this.state.clients.push(newClient);
        newClientsCount++;
        counts.clients++;
      }
    });

    // 3. Process remaining entities with ID remapping & deduplication
    otherMappings.forEach(({ entityType, item }) => {
      const prepared = { ...item, organization_id: targetOrgId };

      // Remap client_id or parent_id
      if (prepared.client_id && clientIdRemap[prepared.client_id]) {
        prepared.client_id = clientIdRemap[prepared.client_id];
      }
      if (prepared.parent_id && clientIdRemap[prepared.parent_id]) {
        prepared.parent_id = clientIdRemap[prepared.parent_id];
      }

      const arr = this.state[entityType] as any[];
      if (!Array.isArray(arr)) return;

      // Smart upsert for programs/sessions/tasks to avoid duplicate sessions or tasks
      let existingIdx = -1;
      if (prepared.id) {
        existingIdx = arr.findIndex((x) => x && x.id === prepared.id);
      }

      // If no ID match, check for logical match
      if (existingIdx === -1) {
        if (entityType === 'programs' && prepared.client_id && prepared.title) {
          existingIdx = arr.findIndex(
            (p) => p && p.client_id === prepared.client_id && p.title === prepared.title
          );
        } else if (entityType === 'sessions' && prepared.client_id && prepared.session_date) {
          existingIdx = arr.findIndex(
            (s) => s && s.client_id === prepared.client_id && String(s.session_date).slice(0, 16) === String(prepared.session_date).slice(0, 16)
          );
        } else if (entityType === 'tasks' && prepared.client_id && prepared.title) {
          existingIdx = arr.findIndex(
            (t) => t && t.client_id === prepared.client_id && t.title === prepared.title
          );
        }
      }

      if (existingIdx >= 0) {
        arr[existingIdx] = { ...arr[existingIdx], ...prepared };
      } else {
        if (!prepared.id) prepared.id = generateUUID();
        arr.push(prepared);
      }
      counts[entityType] = (counts[entityType] || 0) + 1;
    });

    this.saveState();
    return {
      success: true,
      importedCounts: counts,
      updatedClientsCount,
      newClientsCount,
      skippedClientsCount,
    };
  }

  // ACTIVITY LOGS
  public getActivityLogs(clientId?: string): ActivityLog[] {
    return this.state.activityLogs
      .filter((a) => {
        if (a.organization_id !== this.state.activeOrgId) return false;
        if (clientId && a.client_id !== clientId) return false;
        return true;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public logActivity(clientId: string | null, action: string, payload?: Record<string, any>) {
    this.state.activityLogs.unshift({
      id: generateUUID(),
      organization_id: this.state.activeOrgId,
      client_id: clientId,
      user_id: this.state.currentUserId,
      action,
      payload,
      created_at: new Date().toISOString(),
    });
  }

  // MEDIA FILES
  public getMediaFiles(parentId: string): MediaFile[] {
    return (this.state.mediaFiles || [])
      .filter((m) => m.parent_id === parentId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public getAllMediaFiles(): MediaFile[] {
    const orgId = this.state.activeOrgId;
    return (this.state.mediaFiles || [])
      .filter((m) => !orgId || m.organization_id === orgId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public addMediaFile(file: Omit<MediaFile, 'id' | 'created_at' | 'organization_id'>): MediaFile {
    const { blob_data, ...cleanFile } = file as any;
    const newMedia: MediaFile = {
      ...cleanFile,
      id: generateUUID(),
      organization_id: this.state.activeOrgId,
      created_at: new Date().toISOString(),
    };
    this.state.mediaFiles.push(newMedia);

    // Save blob/dataUrl to IndexedDB for local offline use without document bloat
    if (newMedia.url && !newMedia.url.startsWith('http') && !newMedia.url.startsWith('cloud_media:')) {
      saveMediaBlobToIDB(newMedia.id, newMedia.url).catch(() => {});
    } else if (blob_data && typeof FileReader !== 'undefined') {
      const reader = new FileReader();
      reader.onload = () => {
        const res = reader.result as string;
        if (res) saveMediaBlobToIDB(newMedia.id, res).catch(() => {});
      };
      reader.readAsDataURL(blob_data);
    }

    this.saveState();
    return newMedia;
  }

  public deleteMediaFile(id: string) {
    this.state.mediaFiles = this.state.mediaFiles.filter((m) => m.id !== id);
    deleteMediaBlobFromIDB(id).catch(() => {});
    this.saveState();
  }

  public renameMediaFile(id: string, newName: string) {
    const m = this.state.mediaFiles.find((f) => f.id === id);
    if (m) {
      m.name = newName;
      this.saveState();
    }
  }

  public transferMediaFile(id: string, targetParentId: string, targetCategory: 'client' | 'program' | 'general') {
    const m = this.state.mediaFiles.find((f) => f.id === id);
    if (m) {
      m.parent_id = targetParentId;
      m.category = targetCategory;
      this.saveState();
    }
  }

  // EXPORT / IMPORT ZIP
  public async exportDataZIP(options: { tablesOnly?: boolean; onProgress?: (pct: number) => void }): Promise<Blob> {
    const zip = new JSZip();
    const orgId = this.state.activeOrgId;

    options.onProgress?.(10);

    const orgMediaFiles = this.state.mediaFiles.filter((m) => m.organization_id === orgId);

    const dataObj = {
      organization: this.getActiveOrg(),
      clients: this.getClients(orgId),
      programs: this.getPrograms(undefined, orgId),
      sessions: this.getSessions(undefined, undefined, orgId),
      tasks: this.getTasks(orgId),
      notifications: this.getNotifications(),
      activityLogs: this.getActivityLogs(),
      members: this.getOrganizationMembers(orgId),
      mediaFiles: orgMediaFiles,
    };

    // JSON export
    zip.file('data/export.json', JSON.stringify(dataObj, null, 2));

    options.onProgress?.(30);

    // CSV exports with UTF-8 BOM (\uFEFF)
    const jsonToCsv = (arr: any[]) => {
      if (!arr || arr.length === 0) return '';
      const keys = Object.keys(arr[0]);
      const header = keys.join(',');
      const rows = arr.map((item) =>
        keys
          .map((k) => {
            const val = item[k];
            if (val === null || val === undefined) return '""';
            if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
            return `"${String(val).replace(/"/g, '""')}"`;
          })
          .join(',')
      );
      return '\uFEFF' + [header, ...rows].join('\n');
    };

    zip.file('data/clients.csv', jsonToCsv(dataObj.clients));
    zip.file('data/programs.csv', jsonToCsv(dataObj.programs));
    zip.file('data/sessions.csv', jsonToCsv(dataObj.sessions));
    zip.file('data/tasks.csv', jsonToCsv(dataObj.tasks));
    zip.file('data/activity_logs.csv', jsonToCsv(dataObj.activityLogs));
    zip.file('data/media_files.csv', jsonToCsv(orgMediaFiles));

    options.onProgress?.(60);

    if (!options.tablesOnly) {
      // Add media metadata & base64/files
      const mediaFolder = zip.folder('media');
      for (const m of orgMediaFiles) {
        if (m.url && m.url.startsWith('data:')) {
          const parts = m.url.split(',');
          if (parts[1]) {
            mediaFolder?.file(`client_${m.parent_id}_${m.name}`, parts[1], { base64: true });
          }
        } else {
          mediaFolder?.file(`client_${m.parent_id}_${m.name}`, `[Media File Content Placeholder for ${m.name}]`);
        }
      }
    }

    zip.file(
      'manifest.json',
      JSON.stringify(
        {
          appName: 'Kabbalah CRM',
          exportedAt: new Date().toISOString(),
          version: '1.0',
          orgName: this.getActiveOrg()?.name,
        },
        null,
        2
      )
    );

    zip.file(
      'README.txt',
      `קובץ גיבוי וייצוא נתונים מגלריית Kabbalah CRM
נוצר בתאריך: ${new Date().toLocaleString('he-IL')}
מכיל נתוני לקוחות, תוכניות טיפול, מפגשים, משימות ולוגים.`
    );

    options.onProgress?.(90);
    const content = await zip.generateAsync({ type: 'blob' });
    options.onProgress?.(100);
    return content;
  }

  public async importDataZIP(zipBlob: Blob): Promise<boolean> {
    try {
      const zip = await JSZip.loadAsync(zipBlob);
      const exportJsonFile = zip.file('data/export.json');
      if (!exportJsonFile) return false;

      const text = await exportJsonFile.async('text');
      const dataObj = JSON.parse(text);

      if (dataObj.clients && Array.isArray(dataObj.clients)) {
        this.state.clients = dataObj.clients;
      }
      if (dataObj.programs && Array.isArray(dataObj.programs)) {
        this.state.programs = dataObj.programs;
      }
      if (dataObj.sessions && Array.isArray(dataObj.sessions)) {
        this.state.sessions = dataObj.sessions;
      }
      if (dataObj.tasks && Array.isArray(dataObj.tasks)) {
        this.state.tasks = dataObj.tasks;
      }
      if (dataObj.activityLogs && Array.isArray(dataObj.activityLogs)) {
        this.state.activityLogs = dataObj.activityLogs;
      }

      this.saveState();
      return true;
    } catch (e) {
      console.error('Failed to import ZIP:', e);
      return false;
    }
  }

  // INVITES & MEMBERS
  public createInvite(email: string, role: 'admin' | 'therapist' | 'member'): OrgInvite {
    if (!this.canManageMembers()) {
      throw new Error('רק מנהל או יוצר הארגון רשאי להזמין חברים חדשים לארגון');
    }
    const invite: OrgInvite = {
      id: generateUUID(),
      organization_id: this.state.activeOrgId,
      email,
      role,
      token: generateUUID(),
      invited_by: this.state.currentUserId,
      created_at: new Date().toISOString(),
    };
    this.state.orgInvites.push(invite);
    this.saveState();
    return invite;
  }

  public acceptInvite(token: string): { ok: boolean; reason?: string } {
    let invite = this.state.orgInvites.find((i) => i.token === token && !i.accepted_at);
    let targetOrgId = invite?.organization_id;

    if (!invite) {
      // Check if token matches an organization ID directly
      const directOrg = this.state.organizations.find((o) => o.id === token);
      if (directOrg) {
        targetOrgId = directOrg.id;
      } else if (this.state.organizations.length > 0) {
        targetOrgId = this.state.organizations[0].id;
      } else {
        return { ok: false, reason: 'הזמנה לא תקפה או שהארגון אינו קיים' };
      }
    } else {
      invite.accepted_at = new Date().toISOString();
      invite.accepted_by = this.state.currentUserId;
    }

    if (!this.state.currentUserId) {
      return { ok: false, reason: 'יש להתחבר למערכת תחילה' };
    }

    const currProf = this.getCurrentProfile();
    const existing = this.state.organizationMembers.find(
      (m) => m.organization_id === targetOrgId && m.user_id === this.state.currentUserId
    );
    if (!existing) {
      this.state.organizationMembers.push({
        id: generateUUID(),
        organization_id: targetOrgId!,
        user_id: this.state.currentUserId,
        role: invite ? (invite.role === 'owner' ? 'admin' : invite.role) : 'therapist',
        invited_by: invite?.invited_by || 'system',
        created_at: new Date().toISOString(),
        user_email: currProf.email,
        user_name: currProf.full_name,
      });
    } else {
      existing.user_id = this.state.currentUserId;
      existing.user_email = currProf.email;
      if (currProf.full_name) existing.user_name = currProf.full_name;
    }

    this.state.activeOrgId = targetOrgId!;
    this.saveState();
    return { ok: true };
  }
}

export const dataStore = new DataStore();
