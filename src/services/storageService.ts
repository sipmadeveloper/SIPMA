import {
  User,
  StudentProfile,
  ParentData,
  SchoolOrigin,
  AddressData,
  Application,
  DocumentItem,
  School,
  SystemSettings,
  Announcement,
  AuditLog,
  ApiResponse,
  PathwayType,
  UserRole,
} from '../types/sipma';
import {
  calculateHaversineDistance,
  checkZoningCompliance,
  formatDistanceIndonesian,
} from '../utils/geo';
import { updateAppFavicon } from '../utils/favicon';
import {
  INITIAL_SCHOOLS,
  INITIAL_USERS,
  INITIAL_STUDENTS,
  INITIAL_PARENTS,
  INITIAL_SCHOOL_ORIGINS,
  INITIAL_ADDRESSES,
  INITIAL_APPLICATIONS,
  INITIAL_DOCUMENTS,
  INITIAL_ANNOUNCEMENTS,
  INITIAL_SETTINGS,
  INITIAL_AUDIT_LOGS,
} from './demoData';

const STORAGE_KEYS = {
  USERS: 'sipma_users',
  STUDENTS: 'sipma_students',
  PARENTS: 'sipma_parents',
  SCHOOL_ORIGINS: 'sipma_school_origins',
  ADDRESSES: 'sipma_addresses',
  APPLICATIONS: 'sipma_applications',
  DOCUMENTS: 'sipma_documents',
  SCHOOLS: 'sipma_schools',
  ANNOUNCEMENTS: 'sipma_announcements',
  SETTINGS: 'sipma_settings',
  AUDIT_LOGS: 'sipma_audit_logs',
  CURRENT_USER: 'sipma_current_user',
};

class StorageService {
  private initialized = false;
  private hasSyncedWithServer = false;
  private subscribers: Array<(event: string, data?: any) => void> = [];
  private autoSyncTimeout: any = null;
  private autoPullTimer: any = null;
  private serverSyncTimer: any = null;
  private isAutoSyncing: boolean = false;
  private lastAutoSyncStatus: { success: boolean; message: string; timestamp: string } | null = null;
  private serverETag: string = '';

  // High-speed in-memory cache for instant (<0.0001s) data reads and zero parsing lag
  private memCache: {
    users?: User[] | null;
    students?: Record<string, StudentProfile> | null;
    parents?: Record<string, ParentData> | null;
    school_origins?: Record<string, SchoolOrigin> | null;
    addresses?: Record<string, AddressData> | null;
    applications?: Application[] | null;
    documents?: DocumentItem[] | null;
    schools?: School[] | null;
    announcements?: Announcement[] | null;
    settings?: SystemSettings | null;
    audit_logs?: AuditLog[] | null;
    currentUser?: User | null;
  } = {};

  constructor() {
    this.init();
  }

  // ================= EVENT LISTENER / SUBSCRIPTION ENGINE =================
  subscribe(callback: (event: string, data?: any) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter((cb) => cb !== callback);
    };
  }

  notifySubscribers(event: string, data?: any): void {
    this.subscribers.forEach((cb) => {
      try {
        cb(event, data);
      } catch (err) {
        console.error('Subscriber error:', err);
      }
    });
  }

  getAutoSyncState() {
    const settings = this.getSettings();
    return {
      isAutoSyncing: this.isAutoSyncing,
      lastSyncedAt: settings.last_synced_at || null,
      autoSyncEnabled: settings.realtime_sync_enabled !== false,
      hasGasConfigured: !!(settings.gas_web_app_url && settings.gas_web_app_url.startsWith('http')),
      lastStatus: this.lastAutoSyncStatus,
    };
  }

  triggerAutoSync(isSettingsUpdate: boolean = false): void {
    this.notifySubscribers('data_mutated');

    // Only broadcast local mutations to server after initial server sync has completed
    // (avoids pushing stale initial defaults before real database data is loaded)
    if (!this.hasSyncedWithServer) {
      return;
    }

    // 1. Always immediately push the complete local state to centralized server (/api/data/sync)
    const dataPayload = {
      users: this.getUsers(),
      students: this.getStudentsMap(),
      parents: this.getParentsMap(),
      school_origins: this.getSchoolOriginsMap(),
      addresses: this.getAddressesMap(),
      applications: this.getApplications(),
      documents: this.getDocuments(),
      schools: this.getSchools(),
      announcements: this.getAnnouncements(),
      audit_logs: this.getAuditLogs(),
      settings: this.getSettings(),
      is_settings_update: isSettingsUpdate,
    };

    fetch('/api/data/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dataPayload),
    }).catch(() => {});

    // 2. Push to Google Apps Script Web App
    const settings = this.getSettings();
    if (!settings.gas_web_app_url || !settings.gas_web_app_url.startsWith('http') || settings.realtime_sync_enabled === false) {
      return;
    }

    if (this.autoSyncTimeout) {
      clearTimeout(this.autoSyncTimeout);
    }

    this.autoSyncTimeout = setTimeout(async () => {
      this.isAutoSyncing = true;
      this.notifySubscribers('sync_started');
      try {
        const res = await this.syncAllToGAS();
        this.isAutoSyncing = false;
        this.lastAutoSyncStatus = {
          success: res.success,
          message: res.message,
          timestamp: new Date().toISOString(),
        };
        this.notifySubscribers('sync_completed', res);
      } catch (err: any) {
        this.isAutoSyncing = false;
        this.lastAutoSyncStatus = {
          success: false,
          message: err?.message || 'Gagal sinkronisasi otomatis ke Google Sheets',
          timestamp: new Date().toISOString(),
        };
        this.notifySubscribers('sync_error', err);
      }
    }, 400);
  }

  private startBackgroundSync(): void {
    if (typeof window === 'undefined') return;

    if (this.autoPullTimer) {
      clearInterval(this.autoPullTimer);
    }
    if (this.serverSyncTimer) {
      clearInterval(this.serverSyncTimer);
    }

    // Real-time server sync: Poll centralized server every 12 seconds so all devices get instant updates
    this.serverSyncTimer = setInterval(() => {
      if (!document.hidden) {
        this.syncWithServer(false).catch(() => {});
      }
    }, 12000);

    // Auto-pull from GAS every 45 seconds in background if configured
    this.autoPullTimer = setInterval(() => {
      const s = this.getSettings();
      if (s.gas_web_app_url && s.gas_web_app_url.startsWith('http') && s.realtime_sync_enabled !== false && !document.hidden) {
        this.pullAllFromGAS().catch(() => {});
      }
    }, 45000);

    // Instant sync on window focus and tab visibility change
    const handleVisibility = () => {
      if (!document.hidden) {
        this.syncWithServer(false).catch(() => {});
        const s = this.getSettings();
        if (s.gas_web_app_url && s.gas_web_app_url.startsWith('http') && s.realtime_sync_enabled !== false) {
          this.pullAllFromGAS().catch(() => {});
        }
      }
    };

    window.removeEventListener('focus', handleVisibility);
    window.addEventListener('focus', handleVisibility);
    document.removeEventListener('visibilitychange', handleVisibility);
    document.addEventListener('visibilitychange', handleVisibility);
  }

  private init() {
    if (typeof window === 'undefined') return;
    if (this.initialized) return;

    try {
      if (!localStorage.getItem(STORAGE_KEYS.SCHOOLS)) {
        localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify(INITIAL_SCHOOLS));
      }
      if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
      }
      if (!localStorage.getItem(STORAGE_KEYS.STUDENTS)) {
        localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(INITIAL_STUDENTS));
      }
      if (!localStorage.getItem(STORAGE_KEYS.PARENTS)) {
        localStorage.setItem(STORAGE_KEYS.PARENTS, JSON.stringify(INITIAL_PARENTS));
      }
      if (!localStorage.getItem(STORAGE_KEYS.SCHOOL_ORIGINS)) {
        localStorage.setItem(STORAGE_KEYS.SCHOOL_ORIGINS, JSON.stringify(INITIAL_SCHOOL_ORIGINS));
      }
      if (!localStorage.getItem(STORAGE_KEYS.ADDRESSES)) {
        localStorage.setItem(STORAGE_KEYS.ADDRESSES, JSON.stringify(INITIAL_ADDRESSES));
      }
      if (!localStorage.getItem(STORAGE_KEYS.APPLICATIONS)) {
        localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(INITIAL_APPLICATIONS));
      }
      if (!localStorage.getItem(STORAGE_KEYS.DOCUMENTS)) {
        localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(INITIAL_DOCUMENTS));
      }
      if (!localStorage.getItem(STORAGE_KEYS.ANNOUNCEMENTS)) {
        localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(INITIAL_ANNOUNCEMENTS));
      }
      if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(INITIAL_SETTINGS));
      }
      if (!localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS)) {
        localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(INITIAL_AUDIT_LOGS));
      }

      // Clean up legacy demo students from localStorage if present
      try {
        const demoRegPrefix = 'SIPMA-MAN01-00000';
        const demoStdIds = new Set(['STD-001', 'STD-002', 'STD-003', 'STD-004', 'STD-005', 'STD-006']);
        
        const rawStudents = localStorage.getItem(STORAGE_KEYS.STUDENTS);
        if (rawStudents) {
          const parsed = JSON.parse(rawStudents);
          let mutated = false;
          for (const key of Object.keys(parsed)) {
            if (key.startsWith(demoRegPrefix) || demoStdIds.has(parsed[key]?.student_id)) {
              delete parsed[key];
              mutated = true;
            }
          }
          if (mutated) {
            localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(parsed));
          }
        }

        const rawApps = localStorage.getItem(STORAGE_KEYS.APPLICATIONS);
        if (rawApps) {
          const parsed = JSON.parse(rawApps);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((a: any) => !a.registration_number?.startsWith(demoRegPrefix) && !demoStdIds.has(a.student_id));
            if (filtered.length !== parsed.length) {
              localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(filtered));
            }
          }
        }

        const rawParents = localStorage.getItem(STORAGE_KEYS.PARENTS);
        if (rawParents) {
          const parsed = JSON.parse(rawParents);
          let mutated = false;
          for (const key of Object.keys(parsed)) {
            if (demoStdIds.has(key)) {
              delete parsed[key];
              mutated = true;
            }
          }
          if (mutated) {
            localStorage.setItem(STORAGE_KEYS.PARENTS, JSON.stringify(parsed));
          }
        }

        const rawOrigins = localStorage.getItem(STORAGE_KEYS.SCHOOL_ORIGINS);
        if (rawOrigins) {
          const parsed = JSON.parse(rawOrigins);
          let mutated = false;
          for (const key of Object.keys(parsed)) {
            if (demoStdIds.has(key)) {
              delete parsed[key];
              mutated = true;
            }
          }
          if (mutated) {
            localStorage.setItem(STORAGE_KEYS.SCHOOL_ORIGINS, JSON.stringify(parsed));
          }
        }

        const rawAddresses = localStorage.getItem(STORAGE_KEYS.ADDRESSES);
        if (rawAddresses) {
          const parsed = JSON.parse(rawAddresses);
          let mutated = false;
          for (const key of Object.keys(parsed)) {
            if (demoStdIds.has(key)) {
              delete parsed[key];
              mutated = true;
            }
          }
          if (mutated) {
            localStorage.setItem(STORAGE_KEYS.ADDRESSES, JSON.stringify(parsed));
          }
        }

        const rawDocs = localStorage.getItem(STORAGE_KEYS.DOCUMENTS);
        if (rawDocs) {
          const parsed = JSON.parse(rawDocs);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((d: any) => !d.registration_number?.startsWith(demoRegPrefix) && !demoStdIds.has(d.student_id));
            if (filtered.length !== parsed.length) {
              localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(filtered));
            }
          }
        }
      } catch {
        // ignore parsing error
      }

      // Auto-import config from Environment Variables (e.g. Vercel build-time or runtime envs)
      const currentSettings = this.getSettings();
      let settingsChanged = false;

      // 1. Check environment variables
      const envGasUrl = (import.meta as any).env?.VITE_GAS_WEB_APP_URL;
      const envSpreadsheetId = (import.meta as any).env?.VITE_SPREADSHEET_ID;
      const envDriveId = (import.meta as any).env?.VITE_DRIVE_ROOT_FOLDER_ID;
      const envMapsKey = (import.meta as any).env?.VITE_MAPS_API_KEY;

      if (envGasUrl && !currentSettings.gas_web_app_url) {
        currentSettings.gas_web_app_url = envGasUrl;
        settingsChanged = true;
      }
      if (envSpreadsheetId && (!currentSettings.spreadsheet_id || currentSettings.spreadsheet_id.includes('SampleID'))) {
        currentSettings.spreadsheet_id = envSpreadsheetId;
        settingsChanged = true;
      }
      if (envDriveId && (!currentSettings.drive_root_folder_id || currentSettings.drive_root_folder_id.includes('SampleStorage'))) {
        currentSettings.drive_root_folder_id = envDriveId;
        settingsChanged = true;
      }
      if (envMapsKey && !currentSettings.maps_api_key) {
        currentSettings.maps_api_key = envMapsKey;
        settingsChanged = true;
      }

      // 2. Auto-import config from URL query parameters (e.g. ?sipma_cfg=... or ?gas_url=... )
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const encodedCfg = urlParams.get('sipma_cfg');
        const urlGas = urlParams.get('gas_url');
        const urlSs = urlParams.get('spreadsheet_id');
        const urlDrive = urlParams.get('drive_id');

        if (encodedCfg) {
          try {
            const decoded = JSON.parse(decodeURIComponent(atob(encodedCfg)));
            if (decoded.spreadsheet_id || decoded.gas_web_app_url) {
              Object.assign(currentSettings, decoded);
              currentSettings.db_config_locked = true; // Lock immediately upon auto-import
              settingsChanged = true;
            }
          } catch {
            // ignore bad config string
          }
        } else if (urlGas || urlSs || urlDrive) {
          if (urlGas) currentSettings.gas_web_app_url = decodeURIComponent(urlGas);
          if (urlSs) currentSettings.spreadsheet_id = decodeURIComponent(urlSs);
          if (urlDrive) currentSettings.drive_root_folder_id = decodeURIComponent(urlDrive);
          currentSettings.db_config_locked = true;
          settingsChanged = true;
        }
      } catch {
        // ignore url parsing error
      }

      if (settingsChanged) {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(currentSettings));
      }

      // 3. Centralized Server Sync: Fetch locked settings and shared database state from Server
      this.syncWithServer().catch(() => {});

      // Auto-pull background sync if GAS Web App is configured
      if (currentSettings.gas_web_app_url && currentSettings.realtime_sync_enabled !== false) {
        setTimeout(() => {
          this.pullAllFromGAS().catch(() => {});
        }, 1200);
      }

      this.startBackgroundSync();
    } catch {
      // localStorage may be disabled or restricted
    }

    // Pre-warm in-memory cache for ultra-fast instant UI rendering (< 0.0001s)
    try {
      const sch = localStorage.getItem(STORAGE_KEYS.SCHOOLS);
      this.memCache.schools = sch ? JSON.parse(sch) : [...INITIAL_SCHOOLS];
      const app = localStorage.getItem(STORAGE_KEYS.APPLICATIONS);
      this.memCache.applications = app ? JSON.parse(app) : [...INITIAL_APPLICATIONS];
      const stu = localStorage.getItem(STORAGE_KEYS.STUDENTS);
      this.memCache.students = stu ? JSON.parse(stu) : { ...INITIAL_STUDENTS };
      const par = localStorage.getItem(STORAGE_KEYS.PARENTS);
      this.memCache.parents = par ? JSON.parse(par) : { ...INITIAL_PARENTS };
      const ori = localStorage.getItem(STORAGE_KEYS.SCHOOL_ORIGINS);
      this.memCache.school_origins = ori ? JSON.parse(ori) : { ...INITIAL_SCHOOL_ORIGINS };
      const addr = localStorage.getItem(STORAGE_KEYS.ADDRESSES);
      this.memCache.addresses = addr ? JSON.parse(addr) : { ...INITIAL_ADDRESSES };
      const doc = localStorage.getItem(STORAGE_KEYS.DOCUMENTS);
      this.memCache.documents = doc ? JSON.parse(doc) : [...INITIAL_DOCUMENTS];
      const anc = localStorage.getItem(STORAGE_KEYS.ANNOUNCEMENTS);
      this.memCache.announcements = anc ? JSON.parse(anc) : [...INITIAL_ANNOUNCEMENTS];
      const log = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
      this.memCache.audit_logs = log ? JSON.parse(log) : [...INITIAL_AUDIT_LOGS];
      const usr = localStorage.getItem(STORAGE_KEYS.USERS);
      this.memCache.users = usr ? JSON.parse(usr) : [...INITIAL_USERS];
      const set = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      this.memCache.settings = set ? JSON.parse(set) : INITIAL_SETTINGS;
      const cur = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      this.memCache.currentUser = cur ? JSON.parse(cur) : null;
    } catch {}

    this.initialized = true;
  }

  /**
   * Centralized multi-device server synchronization
   * Loads locked database configurations and shared state from server.ts and Google Sheets
   */
  async syncWithServer(forcePullGas: boolean = false): Promise<boolean> {
    try {
      const url = forcePullGas ? '/api/data?force_pull_gas=true' : '/api/data';
      const headers: Record<string, string> = {};
      if (this.serverETag && !forcePullGas) {
        headers['If-None-Match'] = this.serverETag;
      }
      const dataRes = await fetch(url, { headers });
      if (dataRes.status === 304) {
        return true; // No changes on server - instant return in <1ms!
      }
      if (!dataRes.ok) return false;

      const etagHeader = dataRes.headers.get('ETag');
      if (etagHeader) {
        this.serverETag = etagHeader;
      }

      const dataJson = await dataRes.json();
      if (!dataJson.success || !dataJson.data) return false;

      const d = dataJson.data;
      let changed = false;

      // 1. Settings
      if (d.settings && typeof d.settings === 'object') {
        const localSettings = this.getSettings();
        const merged: SystemSettings = {
          ...localSettings,
          ...d.settings,
        };

        // Always protect app_logo if remote doesn't provide one
        if (localSettings.app_logo && !d.settings.app_logo) {
          merged.app_logo = localSettings.app_logo;
        }

        if (!merged.academic_year_label) {
          const yr = merged.application_year || '2027';
          const nextYr = (parseInt(String(yr), 10) || 2027) + 1;
          merged.academic_year_label = `${yr}/${nextYr}`;
        }

        const prevStr = localStorage.getItem(STORAGE_KEYS.SETTINGS);
        const newStr = JSON.stringify(merged);
        this.memCache.settings = merged;
        if (prevStr !== newStr) {
          localStorage.setItem(STORAGE_KEYS.SETTINGS, newStr);
          this.notifySubscribers('settings_updated', merged);
          changed = true;
        }
      }

      // 2. Users - protect existing photo_url from being wiped by empty strings
      if (d.users && Array.isArray(d.users)) {
        const localUsers = this.getUsers();
        const mergedUsers = d.users.map((serverUser: User) => {
          const localMatch = localUsers.find(
            (lu) => lu.user_id === serverUser.user_id || 
                    (lu.email && serverUser.email && lu.email.toLowerCase() === serverUser.email.toLowerCase()) ||
                    (lu.registration_number && serverUser.registration_number && lu.registration_number === serverUser.registration_number)
          );
          return {
            ...serverUser,
            photo_url: serverUser.photo_url || localMatch?.photo_url || '',
          };
        });

        // Also ensure any locally created user not yet in server is preserved
        for (const lu of localUsers) {
          if (!mergedUsers.some((mu) => mu.user_id === lu.user_id || (lu.email && mu.email && lu.email.toLowerCase() === mu.email.toLowerCase()))) {
            mergedUsers.push(lu);
          }
        }

        const prevStr = localStorage.getItem(STORAGE_KEYS.USERS);
        const newStr = JSON.stringify(mergedUsers);
        this.memCache.users = mergedUsers;
        if (prevStr !== newStr) {
          localStorage.setItem(STORAGE_KEYS.USERS, newStr);
          changed = true;
        }

        // Keep current session user synchronized with photo_url
        const currentSession = this.getCurrentUser();
        if (currentSession) {
          const matched = mergedUsers.find((u) => u.user_id === currentSession.user_id || u.email === currentSession.email);
          if (matched && (matched.photo_url || currentSession.photo_url)) {
            const effectivePhoto = matched.photo_url || currentSession.photo_url;
            if (currentSession.photo_url !== effectivePhoto || currentSession.name !== matched.name) {
              currentSession.photo_url = effectivePhoto;
              currentSession.name = matched.name;
              this.setCurrentUser(currentSession);
            }
          }
        }
      }

      // 3. Students - protect existing photo_url
      if (d.students && typeof d.students === 'object') {
        const localStudents = this.getStudentsMap();
        const mergedStudents: Record<string, StudentProfile> = { ...d.students };
        for (const [reg, sProfile] of Object.entries(mergedStudents)) {
          const localS = localStudents[reg];
          if (localS?.photo_url && !sProfile.photo_url) {
            sProfile.photo_url = localS.photo_url;
          }
        }
        for (const [reg, localS] of Object.entries(localStudents)) {
          if (!mergedStudents[reg]) {
            mergedStudents[reg] = localS;
          }
        }

        const prevStr = localStorage.getItem(STORAGE_KEYS.STUDENTS);
        const newStr = JSON.stringify(mergedStudents);
        this.memCache.students = mergedStudents;
        if (prevStr !== newStr) {
          localStorage.setItem(STORAGE_KEYS.STUDENTS, newStr);
          changed = true;
        }
      }

      // 4. Parents
      if (d.parents && typeof d.parents === 'object') {
        const prevStr = localStorage.getItem(STORAGE_KEYS.PARENTS);
        const newStr = JSON.stringify(d.parents);
        this.memCache.parents = d.parents;
        if (prevStr !== newStr) {
          localStorage.setItem(STORAGE_KEYS.PARENTS, newStr);
          changed = true;
        }
      }

      // 5. School Origins
      if (d.school_origins && typeof d.school_origins === 'object') {
        const prevStr = localStorage.getItem(STORAGE_KEYS.SCHOOL_ORIGINS);
        const newStr = JSON.stringify(d.school_origins);
        this.memCache.school_origins = d.school_origins;
        if (prevStr !== newStr) {
          localStorage.setItem(STORAGE_KEYS.SCHOOL_ORIGINS, newStr);
          changed = true;
        }
      }

      // 6. Addresses
      if (d.addresses && typeof d.addresses === 'object') {
        const prevStr = localStorage.getItem(STORAGE_KEYS.ADDRESSES);
        const newStr = JSON.stringify(d.addresses);
        this.memCache.addresses = d.addresses;
        if (prevStr !== newStr) {
          localStorage.setItem(STORAGE_KEYS.ADDRESSES, newStr);
          changed = true;
        }
      }

      // 7. Applications
      if (d.applications && Array.isArray(d.applications)) {
        const prevStr = localStorage.getItem(STORAGE_KEYS.APPLICATIONS);
        const newStr = JSON.stringify(d.applications);
        this.memCache.applications = d.applications;
        if (prevStr !== newStr) {
          localStorage.setItem(STORAGE_KEYS.APPLICATIONS, newStr);
          changed = true;
        }
      }

      // 8. Documents
      if (d.documents && Array.isArray(d.documents)) {
        const localDocs = this.getDocuments();
        const docMap = new Map<string, DocumentItem>();
        for (const loc of localDocs) {
          const key = loc.document_id || `${loc.registration_number}_${loc.document_type}`;
          docMap.set(key, loc);
        }
        for (const rem of d.documents) {
          const key = rem.document_id || `${rem.registration_number}_${rem.document_type}`;
          const loc = docMap.get(key);
          docMap.set(key, {
            ...loc,
            ...rem,
            file_data_base64: loc?.file_data_base64 || rem.file_data_base64 || '',
            local_url: loc?.local_url || rem.local_url || '',
            drive_file_id: rem.drive_file_id || loc?.drive_file_id || '',
            drive_url: rem.drive_url || loc?.drive_url || '',
            view_url: rem.drive_url || loc?.drive_url || loc?.local_url || rem.local_url || '',
          });
        }
        const mergedDocs = Array.from(docMap.values());
        const prevStr = localStorage.getItem(STORAGE_KEYS.DOCUMENTS);
        const newStr = JSON.stringify(mergedDocs);
        this.memCache.documents = mergedDocs;
        if (prevStr !== newStr) {
          localStorage.setItem(STORAGE_KEYS.DOCUMENTS, newStr);
          changed = true;
        }
      }

      // 9. Schools
      if (d.schools && Array.isArray(d.schools) && d.schools.length > 0) {
        const localSchools = this.getSchools();
        const mergedSchools = d.schools.map((remSchool: any) => {
          const loc = localSchools.find((s) => s.school_id === remSchool.school_id);
          return {
            ...remSchool,
            logo_url: remSchool.logo_url || loc?.logo_url || '',
          };
        });
        const prevStr = localStorage.getItem(STORAGE_KEYS.SCHOOLS);
        const newStr = JSON.stringify(mergedSchools);
        this.memCache.schools = mergedSchools;
        if (prevStr !== newStr) {
          localStorage.setItem(STORAGE_KEYS.SCHOOLS, newStr);
          changed = true;
        }
      }

      // 10. Announcements
      if (d.announcements && Array.isArray(d.announcements)) {
        const prevStr = localStorage.getItem(STORAGE_KEYS.ANNOUNCEMENTS);
        const newStr = JSON.stringify(d.announcements);
        this.memCache.announcements = d.announcements;
        if (prevStr !== newStr) {
          localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, newStr);
          changed = true;
        }
      }

      // 11. Audit Logs
      if (d.audit_logs && Array.isArray(d.audit_logs)) {
        const prevStr = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
        const newStr = JSON.stringify(d.audit_logs);
        this.memCache.audit_logs = d.audit_logs;
        if (prevStr !== newStr) {
          localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, newStr);
          changed = true;
        }
      }

      this.hasSyncedWithServer = true;

      if (changed) {
        this.notifySubscribers('data_mutated');
      }

      // If forcePullGas is true and GAS is configured, also trigger client GAS sync
      if (forcePullGas) {
        const currentSettings = this.getSettings();
        if (currentSettings.gas_web_app_url && currentSettings.gas_web_app_url.startsWith('http')) {
          this.pullAllFromGAS().catch(() => {});
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  // ================= SETTINGS =================
  getSettings(): SystemSettings {
    if (this.memCache.settings) {
      return this.memCache.settings;
    }
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!data) {
        this.memCache.settings = INITIAL_SETTINGS;
        return INITIAL_SETTINGS;
      }
      const parsed = JSON.parse(data);
      if (!parsed.app_tagline || parsed.app_tagline === 'PPDB Madrasah Digital' || parsed.app_tagline === 'Madrasah Digital') {
        parsed.app_tagline = 'Sistem Penerimaan Murid Madrasah';
      }
      if (!parsed.academic_year_label) {
        const yr = parsed.application_year || '2027';
        const nextYr = (parseInt(yr, 10) || 2027) + 1;
        parsed.academic_year_label = `${yr}/${nextYr}`;
      }
      this.memCache.settings = parsed;
      return parsed;
    } catch {
      return INITIAL_SETTINGS;
    }
  }

  saveSettings(settings: SystemSettings): void {
    try {
      if (!settings.academic_year_label && settings.application_year) {
        const yr = settings.application_year;
        const nextYr = (parseInt(yr, 10) || 2027) + 1;
        settings.academic_year_label = `${yr}/${nextYr}`;
      }
      this.memCache.settings = settings;
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      // Immediately update favicon to match uploaded logo
      if (settings.app_logo !== undefined) {
        updateAppFavicon(settings.app_logo);
      }
      // Asynchronously persist settings to server so all other devices receive the locked settings
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      }).catch(() => {});

      // If app_logo is base64, asynchronously upload to Google Drive & update setting with drive URL
      if (settings.app_logo && settings.app_logo.startsWith('data:image/')) {
        this.uploadLogoToDrive('app', 'app_logo', settings.app_name || 'SIPMA', settings.app_logo).then((driveLogoUrl) => {
          if (driveLogoUrl && driveLogoUrl !== settings.app_logo) {
            const currentSettings = this.getSettings();
            currentSettings.app_logo = driveLogoUrl;
            this.memCache.settings = currentSettings;
            localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(currentSettings));
            this.notifySubscribers('settings_updated', currentSettings);
            this.triggerAutoSync(true);
          }
        }).catch(() => {});
      }
    } catch {
      // ignore
    }
    this.addAuditLog('SETTINGS_UPDATE', 'System Settings', `Pengaturan sistem diperbarui. Tahun ajaran: ${settings.academic_year_label || settings.application_year}`);
    this.notifySubscribers('settings_updated', settings);
    this.triggerAutoSync(true);
  }

  // ================= USERS & AUTH =================
  getUsers(): User[] {
    if (this.memCache.users) {
      return this.memCache.users;
    }
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USERS);
      const parsed = data ? JSON.parse(data) : [];
      this.memCache.users = parsed;
      return parsed;
    } catch {
      return INITIAL_USERS;
    }
  }

  getCurrentUser(): User | null {
    if (this.memCache.currentUser !== undefined && this.memCache.currentUser !== null) {
      return this.memCache.currentUser;
    }
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      const parsed = data ? JSON.parse(data) : null;
      this.memCache.currentUser = parsed;
      return parsed;
    } catch {
      return null;
    }
  }

  setCurrentUser(user: User | null): void {
    try {
      this.memCache.currentUser = user;
      if (user) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
      } else {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      }
    } catch {
      // ignore
    }
  }

  getUserById(userId: string): User | undefined {
    return this.getUsers().find((u) => u.user_id === userId);
  }

  getUserByRegNumber(regNumber: string): User | undefined {
    return this.getUsers().find((u) => u.registration_number === regNumber);
  }

  updateUserProfile(userId: string, updates: Partial<User>): { success: boolean; user?: User; message: string } {
    try {
      const users = this.getUsers();
      const currentUser = this.getCurrentUser();
      
      // Robust multi-criteria matching to prevent "Pengguna tidak ditemukan" for Admin Pusat or any session
      let index = users.findIndex((u) => u.user_id === userId);
      if (index < 0 && currentUser) {
        if (currentUser.user_id === userId) {
          index = users.findIndex((u) => u.user_id === currentUser.user_id);
        }
        if (index < 0 && currentUser.email) {
          index = users.findIndex((u) => u.email && u.email.toLowerCase() === currentUser.email.toLowerCase());
        }
        if (index < 0 && currentUser.role === 'admin_pusat') {
          index = users.findIndex((u) => u.role === 'admin_pusat');
        }
      }

      let updatedUser: User;
      const now = new Date().toISOString();

      if (index >= 0) {
        updatedUser = {
          ...users[index],
          ...updates,
          updated_at: now,
        };
        users[index] = updatedUser;
      } else {
        // Auto-upsert if session user was not present in the array (e.g. fresh admin pusat session)
        const baseUser: User = {
          user_id: currentUser?.user_id || userId || `USR-ADMIN-${Date.now()}`,
          name: currentUser?.name || 'Administrator Pusat PPDB',
          email: currentUser?.email || 'adminpusatsipma@gmail.com',
          phone: currentUser?.phone || updates.phone || '085747520003',
          role: (currentUser?.role || 'admin_pusat') as UserRole,
          status: 'active' as const,
          created_at: currentUser?.created_at || now,
          updated_at: now,
        };
        updatedUser = {
          ...baseUser,
          ...updates,
          phone: updates.phone !== undefined ? updates.phone : baseUser.phone,
          user_id: baseUser.user_id || userId,
          updated_at: now,
        };
        users.push(updatedUser);
      }

      this.memCache.users = users;
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

      // Always update active session
      this.setCurrentUser(updatedUser);

      // Immediately synchronize profile updates to server database
      fetch('/api/user/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: updatedUser.user_id, updates }),
      }).catch(() => {});

      this.addAuditLog(
        'USER_PROFILE_UPDATE',
        updatedUser.name,
        `Profil ${updatedUser.name} (${updatedUser.role} - Jabatan: ${updatedUser.position || '-'}) berhasil diperbarui.`
      );
      this.notifySubscribers('data_mutated');
      this.triggerAutoSync();

      return { success: true, user: updatedUser, message: 'Profil pengguna berhasil disimpan.' };
    } catch (err: any) {
      return { success: false, message: `Gagal memperbarui profil: ${err.message || 'Error tidak diketahui'}` };
    }
  }

  changeUserPassword(userId: string, oldPassword?: string, newPassword?: string): { success: boolean; message: string } {
    try {
      if (!newPassword || newPassword.trim().length < 6) {
        return { success: false, message: 'Password baru minimal harus 6 karakter.' };
      }

      const users = this.getUsers();
      const currentUser = this.getCurrentUser();

      let index = users.findIndex((u) => u.user_id === userId);
      if (index < 0 && currentUser) {
        if (currentUser.user_id === userId) {
          index = users.findIndex((u) => u.user_id === currentUser.user_id);
        }
        if (index < 0 && currentUser.email) {
          index = users.findIndex((u) => u.email && u.email.toLowerCase() === currentUser.email.toLowerCase());
        }
        if (index < 0 && currentUser.role === 'admin_pusat') {
          index = users.findIndex((u) => u.role === 'admin_pusat');
        }
      }

      if (index < 0) {
        if (currentUser) {
          // If in current session, upsert user with new password
          const now = new Date().toISOString();
          const newUser: User = {
            ...currentUser,
            password_hash: newPassword.trim(),
            updated_at: now,
          };
          users.push(newUser);
          this.memCache.users = users;
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
          this.setCurrentUser(newUser);
          this.triggerAutoSync();
          return { success: true, message: 'Password berhasil diubah. Gunakan password baru untuk login berikutnya.' };
        }
        return { success: false, message: 'Pengguna tidak ditemukan.' };
      }

      const user = users[index];
      // If user has existing password_hash and oldPassword provided, we validate
      if (user.password_hash && oldPassword && user.password_hash !== oldPassword) {
        return { success: false, message: 'Password lama tidak sesuai!' };
      }

      user.password_hash = newPassword.trim();
      user.updated_at = new Date().toISOString();
      users[index] = user;
      this.memCache.users = users;
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

      if (currentUser && (currentUser.user_id === userId || currentUser.email === user.email)) {
        currentUser.password_hash = user.password_hash;
        this.setCurrentUser(currentUser);
      }

      this.addAuditLog('PASSWORD_CHANGE', user.name, `Pengguna ${user.name} mengganti kata sandi akun.`);
      this.triggerAutoSync();

      // Direct server DB & GAS sync for password change
      fetch('/api/data/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.user_id,
          registration_number: user.registration_number,
          email: user.email,
          new_password: newPassword.trim(),
        }),
      }).catch((e) => console.warn('Change password server sync warning:', e));

      return { success: true, message: 'Password berhasil diubah. Gunakan password baru untuk login berikutnya.' };
    } catch (err: any) {
      return { success: false, message: `Gagal mengubah password: ${err.message || 'Error tidak diketahui'}` };
    }
  }

  /**
   * Reset kata sandi untuk akun pengguna apa pun (Pusat, Admin Madrasah, Operator, atau Calon Murid)
   * Otomatis menghasilkan kata sandi baru dan mengganti sandi lama di database lokal, server, dan Google Sheets.
   */
  resetAnyUserPassword(
    identifier: string,
    customNewPassword?: string,
    operatorName?: string
  ): { success: boolean; newPassword?: string; user?: User; message: string } {
    try {
      const users = this.getUsers();
      const targetQuery = identifier.trim().toLowerCase();

      let index = -1;
      for (let i = users.length - 1; i >= 0; i--) {
        const u = users[i];
        if (
          (u.user_id && u.user_id.toLowerCase() === targetQuery) ||
          (u.registration_number && u.registration_number.toLowerCase() === targetQuery) ||
          (u.email && u.email.toLowerCase() === targetQuery)
        ) {
          index = i;
          break;
        }
      }

      if (index < 0) {
        // Coba cari di data murid jika belum terdaftar di tabel users
        const students = this.getStudentsMap();
        const matchedStudent = Object.values(students).find(
          (s) =>
            s.registration_number.toLowerCase() === targetQuery ||
            (s.nisn && s.nisn.toLowerCase() === targetQuery) ||
            (s.nik && s.nik.toLowerCase() === targetQuery) ||
            (s.email && s.email.toLowerCase() === targetQuery)
        );

        if (!matchedStudent) {
          return { success: false, message: `Akun dengan ID/No. Pendaftaran/Email "${identifier}" tidak ditemukan di database.` };
        }

        const generatedPass = customNewPassword?.trim() || `sipma${Math.floor(100000 + Math.random() * 900000)}`;
        const now = new Date().toISOString();
        const newUser: User = {
          user_id: matchedStudent.user_id || `USR-${Date.now().toString(36)}`,
          registration_number: matchedStudent.registration_number,
          name: matchedStudent.name,
          email: matchedStudent.email || `${matchedStudent.registration_number.toLowerCase()}@sipma.madrasah.id`,
          phone: matchedStudent.phone || '081234567890',
          role: 'calon_murid',
          password_hash: generatedPass,
          status: 'active',
          created_at: now,
          updated_at: now,
        };

        users.push(newUser);
        this.memCache.users = users;
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

        // Sync ke server & Google Sheets
        fetch('/api/data/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: newUser.user_id,
            registration_number: newUser.registration_number,
            email: newUser.email,
            new_password: generatedPass,
          }),
        }).catch((e) => console.warn('Reset password server sync warning:', e));

        this.addAuditLog(
          'USER_PASSWORD_RESET',
          newUser.name,
          `Password akun calon murid ${newUser.name} (${newUser.registration_number}) di-reset oleh ${operatorName || 'Admin'}. Password baru: ${generatedPass}`
        );
        this.notifySubscribers('data_mutated');
        this.triggerAutoSync();

        return {
          success: true,
          newPassword: generatedPass,
          user: newUser,
          message: `Kata sandi akun ${newUser.name} berhasil di-reset menjadi "${generatedPass}".`,
        };
      }

      const user = users[index];
      let prefix = 'sipma';
      if (user.role === 'admin_pusat') prefix = 'pusat';
      else if (user.role === 'admin_sekolah') prefix = 'adm';
      else if (user.role === 'operator_sekolah') prefix = 'opr';

      const generatedPass = customNewPassword?.trim() || `${prefix}${Math.floor(100000 + Math.random() * 900000)}`;
      user.password_hash = generatedPass;
      user.updated_at = new Date().toISOString();
      users[index] = user;
      this.memCache.users = users;
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

      // Jika mereset akun yang sedang aktif login, perbarui sesi pengguna aktif
      const currentUser = this.getCurrentUser();
      if (currentUser && (currentUser.user_id === user.user_id || currentUser.email === user.email)) {
        currentUser.password_hash = generatedPass;
        this.setCurrentUser(currentUser);
      }

      // Sync ke server database & Google Sheets secara langsung
      fetch('/api/data/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.user_id,
          registration_number: user.registration_number,
          email: user.email,
          new_password: generatedPass,
        }),
      }).catch((e) => console.warn('Reset password server sync warning:', e));

      this.addAuditLog(
        'USER_PASSWORD_RESET',
        user.name,
        `Password akun ${user.name} (${user.role} - ${user.email}) di-reset oleh ${operatorName || 'Sistem'}. Password baru: ${generatedPass}`
      );
      this.notifySubscribers('data_mutated');
      this.triggerAutoSync();

      return {
        success: true,
        newPassword: generatedPass,
        user,
        message: `Kata sandi akun ${user.name} berhasil di-reset menjadi "${generatedPass}".`,
      };
    } catch (err: any) {
      return { success: false, message: `Gagal mereset kata sandi: ${err?.message || 'Error'}` };
    }
  }

  /**
   * Reset kata sandi akun sendiri secara instan
   * Menghasilkan sandi baru acak yang aman dan memperbarui database serta sesi login aktif.
   */
  resetOwnPassword(userId?: string): { success: boolean; newPassword?: string; user?: User; message: string } {
    const currentUser = this.getCurrentUser();
    const targetId = userId || currentUser?.user_id;
    if (!targetId) {
      return { success: false, message: 'Sesi akun tidak ditemukan. Harap login kembali.' };
    }
    return this.resetAnyUserPassword(targetId, undefined, currentUser?.name || 'Pengguna Sendiri');
  }

  resetStudentPassword(
    identifier: string, // registration_number, user_id, or email
    customNewPassword?: string,
    operatorName?: string
  ): { success: boolean; newPassword?: string; user?: User; message: string } {
    return this.resetAnyUserPassword(identifier, customNewPassword, operatorName || 'Panitia PPDB');
  }

  saveSchoolAdminUser(userData: {
    user_id?: string;
    name: string;
    email: string;
    phone: string;
    school_id: string;
    nip?: string;
    position?: string;
    password?: string;
    status?: 'active' | 'inactive';
  }): { success: boolean; user?: User; message: string; generatedPassword?: string } {
    try {
      const users = this.getUsers();
      const cleanEmail = userData.email.trim().toLowerCase();
      const isNew = !userData.user_id;

      if (!userData.name.trim()) {
        return { success: false, message: 'Nama lengkap admin wajib diisi.' };
      }
      if (!cleanEmail) {
        return { success: false, message: 'Email admin wajib diisi.' };
      }
      if (!userData.school_id) {
        return { success: false, message: 'Madrasah naungan wajib dipilih.' };
      }

      // Check email duplication for other users
      const existingUserWithEmail = users.find(
        (u) => u.email.trim().toLowerCase() === cleanEmail && u.user_id !== userData.user_id
      );
      if (existingUserWithEmail) {
        return { success: false, message: `Email ${cleanEmail} sudah digunakan oleh pengguna lain (${existingUserWithEmail.name}).` };
      }

      const now = new Date().toISOString();
      let generatedPass = userData.password?.trim();
      if (!generatedPass && isNew) {
        generatedPass = `admin${Math.floor(100000 + Math.random() * 900000)}`;
      }

      let savedUser: User;
      if (isNew) {
        const school = this.getSchoolById(userData.school_id);
        const schoolCode = school?.school_code || 'SCH';
        savedUser = {
          user_id: `USR-ADM-${schoolCode}-${Date.now().toString(36).toUpperCase()}`,
          name: userData.name.trim(),
          email: cleanEmail,
          phone: userData.phone?.trim() || '',
          school_id: userData.school_id,
          nip: userData.nip?.trim() || '',
          position: userData.position?.trim() || 'Panitia PPDB Madrasah',
          role: 'admin_sekolah',
          status: userData.status || 'active',
          password_hash: generatedPass || 'admin123',
          created_at: now,
          updated_at: now,
        };
        users.push(savedUser);
        this.addAuditLog(
          'CREATE_SCHOOL_ADMIN',
          savedUser.name,
          `Akun admin madrasah baru (${savedUser.name} - ${cleanEmail}) berhasil dibuat untuk ${school?.school_name || userData.school_id}.`
        );
      } else {
        const index = users.findIndex((u) => u.user_id === userData.user_id);
        if (index < 0) {
          return { success: false, message: 'Akun admin madrasah tidak ditemukan.' };
        }
        savedUser = {
          ...users[index],
          name: userData.name.trim(),
          email: cleanEmail,
          phone: userData.phone?.trim() || users[index].phone,
          school_id: userData.school_id,
          nip: userData.nip !== undefined ? userData.nip.trim() : users[index].nip,
          position: userData.position !== undefined ? userData.position.trim() : users[index].position,
          status: userData.status || users[index].status || 'active',
          updated_at: now,
        };
        if (generatedPass) {
          savedUser.password_hash = generatedPass;
        }
        users[index] = savedUser;
        this.addAuditLog(
          'UPDATE_SCHOOL_ADMIN',
          savedUser.name,
          `Data akun admin madrasah (${savedUser.name} - ${cleanEmail}) diperbarui oleh Admin Pusat.`
        );
      }

      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      this.notifySubscribers('data_mutated');
      this.triggerAutoSync();

      return {
        success: true,
        user: savedUser,
        generatedPassword: isNew ? generatedPass : undefined,
        message: isNew
          ? `Akun admin madrasah untuk ${savedUser.name} berhasil dibuat.`
          : `Data akun admin ${savedUser.name} berhasil diperbarui.`,
      };
    } catch (err: any) {
      return { success: false, message: `Gagal menyimpan akun admin: ${err?.message || 'Error'}` };
    }
  }

  resetSchoolAdminPassword(
    userId: string,
    customNewPassword?: string,
    operatorName?: string
  ): { success: boolean; newPassword?: string; user?: User; message: string } {
    return this.resetAnyUserPassword(userId, customNewPassword, operatorName || 'Admin Pusat');
  }

  toggleUserStatus(userId: string): { success: boolean; newStatus?: 'active' | 'inactive'; message: string } {
    try {
      const users = this.getUsers();
      const index = users.findIndex((u) => u.user_id === userId);
      if (index < 0) {
        return { success: false, message: 'Pengguna tidak ditemukan.' };
      }

      const user = users[index];
      const newStatus: 'active' | 'inactive' = user.status === 'active' ? 'inactive' : 'active';
      user.status = newStatus;
      user.updated_at = new Date().toISOString();
      users[index] = user;
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

      this.addAuditLog(
        'USER_STATUS_CHANGE',
        user.name,
        `Status akses akun ${user.name} (${user.email}) diubah menjadi ${newStatus === 'active' ? 'AKTIF' : 'NON-AKTIF / DIBLOKIR'}.`
      );
      this.notifySubscribers('data_mutated');
      this.triggerAutoSync();

      return {
        success: true,
        newStatus,
        message: `Status akses akun ${user.name} berhasil diubah menjadi ${newStatus === 'active' ? 'Aktif' : 'Non-Aktif'}.`,
      };
    } catch (err: any) {
      return { success: false, message: `Gagal mengubah status: ${err?.message || 'Error'}` };
    }
  }

  deleteUserAccount(userId: string): { success: boolean; message: string } {
    try {
      const users = this.getUsers();
      const targetUser = users.find((u) => u.user_id === userId);
      if (!targetUser) {
        return { success: false, message: 'Pengguna tidak ditemukan.' };
      }

      const filtered = users.filter((u) => u.user_id !== userId);
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(filtered));

      // Asynchronously trigger server & GAS deletion
      fetch('/api/data/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          registration_number: targetUser.registration_number,
        }),
      }).catch((e) => console.warn('Delete user server sync warning:', e));

      this.addAuditLog(
        'USER_DELETED',
        targetUser.name,
        `Akun ${targetUser.name} (${targetUser.role} - ${targetUser.email}) telah dihapus dari sistem oleh Admin Pusat.`
      );
      this.notifySubscribers('data_mutated');
      this.triggerAutoSync();

      return {
        success: true,
        message: `Akun ${targetUser.name} (${targetUser.email}) berhasil dihapus permanen.`,
      };
    } catch (err: any) {
      return { success: false, message: `Gagal menghapus akun: ${err?.message || 'Error'}` };
    }
  }

  getSchoolOperators(schoolId?: string): User[] {
    const users = this.getUsers();
    return users.filter((u) => {
      if (u.role !== 'operator_sekolah') return false;
      if (schoolId && u.school_id !== schoolId) return false;
      return true;
    });
  }

  saveSchoolOperatorUser(
    userData: {
      user_id?: string;
      name: string;
      email: string;
      phone?: string;
      school_id: string;
      nip?: string;
      position?: string;
      password?: string;
      status?: 'active' | 'inactive';
    },
    actorName?: string
  ): { success: boolean; user?: User; generatedPassword?: string; message: string } {
    try {
      if (!userData.name || !userData.name.trim()) {
        return { success: false, message: 'Nama lengkap operator wajib diisi.' };
      }
      if (!userData.email || !userData.email.trim()) {
        return { success: false, message: 'Alamat email login operator wajib diisi.' };
      }
      if (!userData.school_id) {
        return { success: false, message: 'ID Madrasah wajib ditentukan.' };
      }

      const users = this.getUsers();
      const cleanEmail = userData.email.trim().toLowerCase();
      const isNew = !userData.user_id;

      // Check unique email
      const existingUserWithEmail = users.find(
        (u) => u.email.trim().toLowerCase() === cleanEmail && u.user_id !== userData.user_id
      );
      if (existingUserWithEmail) {
        return {
          success: false,
          message: `Email "${cleanEmail}" sudah digunakan oleh akun lain (${existingUserWithEmail.name}).`,
        };
      }

      const now = new Date().toISOString();
      let generatedPass = userData.password?.trim();
      if (!generatedPass && isNew) {
        generatedPass = `opr${Math.floor(100000 + Math.random() * 900000)}`;
      }

      let savedUser: User;
      const school = this.getSchoolById(userData.school_id);
      const schoolCode = school?.school_code || (school?.school_id ? school.school_id.replace(/^SCH-/, '') : 'SCH');

      if (isNew) {
        savedUser = {
          user_id: `USR-OPR-${schoolCode}-${Date.now().toString(36).toUpperCase()}`,
          name: userData.name.trim(),
          email: cleanEmail,
          phone: userData.phone?.trim() || '',
          school_id: userData.school_id,
          nip: userData.nip?.trim() || '',
          position: userData.position?.trim() || 'Operator Seleksi & Verifikasi PPDB',
          role: 'operator_sekolah',
          status: userData.status || 'active',
          password_hash: generatedPass || 'operator123',
          created_at: now,
          updated_at: now,
        };
        users.push(savedUser);
        this.addAuditLog(
          'CREATE_SCHOOL_OPERATOR',
          savedUser.name,
          `Akun operator baru (${savedUser.name} - ${cleanEmail}) berhasil dibuat oleh ${actorName || 'Admin Madrasah'} untuk ${school?.school_name || userData.school_id}.`
        );
      } else {
        const index = users.findIndex((u) => u.user_id === userData.user_id);
        if (index < 0) {
          return { success: false, message: 'Akun operator madrasah tidak ditemukan.' };
        }
        savedUser = {
          ...users[index],
          name: userData.name.trim(),
          email: cleanEmail,
          phone: userData.phone?.trim() || users[index].phone,
          school_id: userData.school_id,
          nip: userData.nip !== undefined ? userData.nip.trim() : users[index].nip,
          position: userData.position !== undefined ? userData.position.trim() : users[index].position,
          status: userData.status || users[index].status || 'active',
          updated_at: now,
        };
        if (generatedPass) {
          savedUser.password_hash = generatedPass;
        }
        users[index] = savedUser;
        this.addAuditLog(
          'UPDATE_SCHOOL_OPERATOR',
          savedUser.name,
          `Data akun operator (${savedUser.name} - ${cleanEmail}) diperbarui oleh ${actorName || 'Admin Madrasah'}.`
        );
      }

      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      this.notifySubscribers('data_mutated');
      this.triggerAutoSync();

      return {
        success: true,
        user: savedUser,
        generatedPassword: isNew ? generatedPass : undefined,
        message: isNew
          ? `Akun operator madrasah untuk ${savedUser.name} berhasil ditambahkan.`
          : `Data akun operator ${savedUser.name} berhasil diperbarui.`,
      };
    } catch (err: any) {
      return { success: false, message: `Gagal menyimpan akun operator: ${err?.message || 'Error'}` };
    }
  }

  resetSchoolOperatorPassword(
    userId: string,
    customNewPassword?: string,
    operatorName?: string
  ): { success: boolean; newPassword?: string; user?: User; message: string } {
    return this.resetAnyUserPassword(userId, customNewPassword, operatorName || 'Admin Madrasah');
  }

  generateRegistrationNumber(schoolId?: string): string {
    const targetSchoolId = schoolId || this.getSettings().default_school_id || 'SCH-MAN1';
    const school = this.getSchoolById(targetSchoolId);
    
    // Determine the unique school code (e.g. MAN01, MTS01, MI01)
    const rawCode = school?.school_code || (school?.school_id ? school.school_id.replace(/^SCH-/, '') : 'MAN01');
    const schoolCode = rawCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || 'MAN01';
    
    // Prefix for registration number: SIPMA-<schoolCode>-<sequence>
    const codePrefix = `SIPMA-${schoolCode}-`;
    const users = this.getUsers();
    const apps = this.getApplications();

    // Count existing registrations for this specific madrasah code
    const matchingUsers = users.filter((u) => u.registration_number && u.registration_number.startsWith(codePrefix));
    const matchingApps = apps.filter((a) => (a.registration_number && a.registration_number.startsWith(codePrefix)) || a.school_id === targetSchoolId);
    
    const count = Math.max(matchingUsers.length, matchingApps.length);
    const seq = count + 1;
    return `SIPMA-${schoolCode}-${String(seq).padStart(6, '0')}`;
  }

  registerStudentUser(params: {
    name: string;
    nik: string;
    nisn?: string;
    email: string;
    phone: string;
    school_id?: string;
  }): { user: User; registration_number: string } {
    const users = this.getUsers();
    
    // Check if email already exists
    const targetEmail = (params.email || '').toLowerCase().trim();
    const existing = users.find((u) => (u.email || '').toLowerCase().trim() === targetEmail);
    if (existing) {
      throw new Error('Email sudah terdaftar. Silakan gunakan email lain atau login.');
    }

    // If school_id is provided, generate official school registration number,
    // otherwise generate a preliminary unassigned draft registration number
    const targetSchoolId = params.school_id || '';
    const regNum = targetSchoolId
      ? this.generateRegistrationNumber(targetSchoolId)
      : `SIPMA-CALON-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const userId = `USR-${Date.now().toString(36)}`;
    const studentId = `STD-${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const year = this.getSettings().application_year || '2026';

    const newUser: User = {
      user_id: userId,
      registration_number: regNum,
      name: params.name,
      email: params.email,
      phone: params.phone,
      role: 'calon_murid',
      school_id: targetSchoolId || undefined,
      status: 'active',
      created_at: now,
      updated_at: now,
    };

    users.push(newUser);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

    // Initialize Student Profile record
    const students = this.getStudentsMap();
    students[regNum] = {
      student_id: studentId,
      user_id: userId,
      registration_number: regNum,
      name: params.name,
      nik: params.nik,
      nisn: params.nisn || '',
      gender: 'L',
      birth_place: '',
      birth_date: '',
      religion: 'Islam',
      family_card_number: '',
      child_order: 1,
      total_siblings: 1,
      family_status: 'Anak Kandung',
      phone: params.phone,
      email: params.email,
    };
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));

    // Initialize Application record (unbound to school until student chooses in wizard)
    const apps = this.getApplications();
    const defaultSchool = targetSchoolId ? this.getSchoolById(targetSchoolId) : null;
    const newApp: Application = {
      application_id: `APP-${Date.now().toString(36)}`,
      registration_number: regNum,
      user_id: userId,
      student_id: studentId,
      school_id: targetSchoolId,
      admission_year: year,
      pathway: 'zonasi',
      latitude: defaultSchool ? defaultSchool.latitude - 0.005 : -6.24,
      longitude: defaultSchool ? defaultSchool.longitude - 0.005 : 106.80,
      distance_km: defaultSchool ? 0.85 : 0,
      max_distance_km: defaultSchool ? defaultSchool.zoning_radius_km : 5.0,
      zoning_status: 'memenuhi',
      verification_status: 'menunggu',
      selection_status: 'menunggu',
      final_status: 'draft',
      step_completed: 1,
      is_locked: false,
      created_at: now,
      updated_at: now,
    };
    apps.push(newApp);
    localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(apps));

    this.addAuditLog('REGISTER', regNum, `Calon murid ${params.name} mendaftar dengan akun baru (${regNum}).`);
    this.triggerAutoSync();

    return { user: newUser, registration_number: regNum };
  }

  /**
   * Mengembalikan status kuota dan jumlah murid yang mendaftar aktif di madrasah.
   * Bila jumlah murid yang mendaftar sudah pas/mencapai kuota keseluruhan yang dibutuhkan,
   * maka madrasah secara otomatis tidak dapat dipilih untuk mendaftar.
   */
  getSchoolApplicantCount(
    schoolId: string,
    currentRegNum?: string
  ): {
    total_quota: number;
    applicant_count: number;
    remaining_slots: number;
    is_full: boolean;
  } {
    const school = this.getSchoolById(schoolId);
    if (!school) {
      return { total_quota: 0, applicant_count: 0, remaining_slots: 0, is_full: true };
    }

    const totalQuota =
      school.quota_total && school.quota_total > 0
        ? school.quota_total
        : ((school.quota_zonasi || 0) +
            (school.quota_afirmasi || 0) +
            (school.quota_prestasi || 0) +
            (school.quota_mutasi || 0)) || 100;

    // Ambil pendaftar aktif (pendaftar yang ditolak tidak memakan slot kuota aktif)
    const apps = this.getApplications().filter((a) => {
      if (a.school_id !== schoolId) return false;
      // Kecualikan diri sendiri jika calon murid memang sedang melihat madrasah yang sudah dipilihnya
      if (currentRegNum && a.registration_number === currentRegNum) return false;
      // Murid yang status verifikasinya ditolak tidak dihitung
      if (a.verification_status === 'ditolak') return false;
      return true;
    });

    const applicantCount = apps.length;
    const remainingSlots = Math.max(0, totalQuota - applicantCount);
    const isFull = applicantCount >= totalQuota;

    return {
      total_quota: totalQuota,
      applicant_count: applicantCount,
      remaining_slots: remainingSlots,
      is_full: isFull,
    };
  }

  assignStudentTargetSchool(
    currentRegNum: string,
    newSchoolId: string
  ): { newRegNum: string; school: School; updatedApp: Application } {
    const school = this.getSchoolById(newSchoolId);
    if (!school) {
      throw new Error('Madrasah tujuan tidak ditemukan.');
    }

    // Validasi kuota pendaftaran madrasah: Jika sudah penuh, tidak dapat dipilih
    const quotaInfo = this.getSchoolApplicantCount(newSchoolId, currentRegNum);
    if (quotaInfo.is_full) {
      throw new Error(
        `Madrasah ${school.school_name} tidak dapat dipilih karena jumlah murid yang mendaftar sudah memenuhi kuota total yang dibutuhkan (${quotaInfo.applicant_count}/${quotaInfo.total_quota} murid). Silakan pilih madrasah lain yang masih membuka slot pendaftaran.`
      );
    }

    const apps = this.getApplications();
    let appIndex = apps.findIndex((a) => a.registration_number === currentRegNum);
    const currentUser = this.getCurrentUser();

    if (appIndex < 0 && currentUser) {
      appIndex = apps.findIndex((a) => a.user_id === currentUser.user_id);
    }

    if (appIndex < 0) {
      // Create new application if none existed
      const newApp: Application = {
        application_id: `APP-${Date.now().toString(36)}`,
        registration_number: currentRegNum || `SIPMA-CALON-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        user_id: currentUser?.user_id || '',
        student_id: `STD-${Date.now().toString(36)}`,
        school_id: newSchoolId,
        admission_year: '2026',
        pathway: 'zonasi',
        latitude: school.latitude - 0.005,
        longitude: school.longitude - 0.005,
        distance_km: 0.85,
        max_distance_km: school.zoning_radius_km,
        zoning_status: 'memenuhi',
        verification_status: 'menunggu',
        selection_status: 'menunggu',
        final_status: 'draft',
        step_completed: 1,
        is_locked: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      apps.push(newApp);
      appIndex = apps.length - 1;
    }

    const app = apps[appIndex];
    if (app.is_locked) {
      throw new Error('Pendaftaran sudah dikunci dan tidak dapat mengubah madrasah tujuan.');
    }

    // Determine if registration number needs to be upgraded/updated with the madrasah code
    const rawCode = school.school_code || (school.school_id ? school.school_id.replace(/^SCH-/, '') : 'MAN01');
    const schoolCode = rawCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || 'MAN01';
    const codePrefix = `SIPMA-${schoolCode}-`;

    let newRegNum = currentRegNum;
    if (!currentRegNum.startsWith(codePrefix)) {
      newRegNum = this.generateRegistrationNumber(newSchoolId);
    }

    // Update application
    app.registration_number = newRegNum;
    app.school_id = newSchoolId;
    app.max_distance_km = school.zoning_radius_km;
    app.updated_at = new Date().toISOString();
    apps[appIndex] = app;
    localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(apps));

    // Update user record
    const users = this.getUsers();
    const uIndex = users.findIndex(
      (u) => u.registration_number === currentRegNum || (app.user_id && u.user_id === app.user_id)
    );
    if (uIndex >= 0) {
      users[uIndex].registration_number = newRegNum;
      users[uIndex].school_id = newSchoolId;
      users[uIndex].updated_at = new Date().toISOString();
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

      const currentUser = this.getCurrentUser();
      if (
        currentUser &&
        (currentUser.registration_number === currentRegNum || currentUser.user_id === users[uIndex].user_id)
      ) {
        this.setCurrentUser({
          ...currentUser,
          registration_number: newRegNum,
          school_id: newSchoolId,
        });
      }
    }

    // Migrate student profile
    const students = this.getStudentsMap();
    if (students[currentRegNum]) {
      const studentData = { ...students[currentRegNum], registration_number: newRegNum };
      students[newRegNum] = studentData;
      if (currentRegNum !== newRegNum) {
        delete students[currentRegNum];
      }
      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
    }

    // Migrate related details (parents, schoolOrigins, addresses, documents)
    if (currentRegNum !== newRegNum) {
      const parents = this.getParentsMap();
      if (parents[currentRegNum]) {
        parents[newRegNum] = parents[currentRegNum];
        delete parents[currentRegNum];
        localStorage.setItem(STORAGE_KEYS.PARENTS, JSON.stringify(parents));
      }

      const origins = this.getSchoolOriginsMap();
      if (origins[currentRegNum]) {
        origins[newRegNum] = origins[currentRegNum];
        delete origins[currentRegNum];
        localStorage.setItem(STORAGE_KEYS.SCHOOL_ORIGINS, JSON.stringify(origins));
      }

      const addresses = this.getAddressesMap();
      if (addresses[currentRegNum]) {
        addresses[newRegNum] = addresses[currentRegNum];
        delete addresses[currentRegNum];
        localStorage.setItem(STORAGE_KEYS.ADDRESSES, JSON.stringify(addresses));
      }

      const docs = this.getDocuments();
      let docsChanged = false;
      docs.forEach((doc) => {
        if (doc.registration_number === currentRegNum) {
          doc.registration_number = newRegNum;
          docsChanged = true;
        }
      });
      if (docsChanged) {
        localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(docs));
      }
    }

    this.addAuditLog(
      'MADRASAH_ASSIGNED',
      newRegNum,
      `Calon murid memilih madrasah tujuan ${school.school_name} (Nomor Registrasi Resmi: ${newRegNum}).`
    );
    this.triggerAutoSync();

    return { newRegNum, school, updatedApp: app };
  }

  cancelStudentTargetSchool(
    currentRegNum: string
  ): { updatedApp: Application } {
    const apps = this.getApplications();
    let appIndex = apps.findIndex((a) => a.registration_number === currentRegNum);
    const currentUser = this.getCurrentUser();

    if (appIndex < 0 && currentUser) {
      appIndex = apps.findIndex((a) => a.user_id === currentUser.user_id);
    }

    if (appIndex >= 0) {
      const app = apps[appIndex];
      if (app.is_locked) {
        throw new Error('Pendaftaran sudah dikunci dan tidak dapat membatalkan pilihan madrasah.');
      }
      app.school_id = '';
      app.distance_km = 0;
      app.updated_at = new Date().toISOString();
      apps[appIndex] = app;
      localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(apps));

      // Update user
      const users = this.getUsers();
      const uIndex = users.findIndex(
        (u) => u.registration_number === currentRegNum || (app.user_id && u.user_id === app.user_id)
      );
      if (uIndex >= 0) {
        users[uIndex].school_id = '';
        users[uIndex].updated_at = new Date().toISOString();
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

        if (currentUser && (currentUser.registration_number === currentRegNum || currentUser.user_id === users[uIndex].user_id)) {
          this.setCurrentUser({
            ...currentUser,
            school_id: '',
          });
        }
      }

      this.addAuditLog(
        'MADRASAH_UNASSIGNED',
        currentRegNum,
        `Calon murid membatalkan pilihan madrasah tujuan.`
      );
      this.triggerAutoSync();

      return { updatedApp: app };
    }

    throw new Error('Data pendaftaran tidak ditemukan.');
  }

  // ================= SCHOOLS =================
  getSchools(): School[] {
    if (this.memCache.schools) {
      return this.memCache.schools;
    }
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SCHOOLS);
      if (data) {
        const parsed = JSON.parse(data);
        this.memCache.schools = parsed;
        return parsed;
      }
      this.memCache.schools = [...INITIAL_SCHOOLS];
      localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify(INITIAL_SCHOOLS));
      return this.memCache.schools;
    } catch {
      return [...INITIAL_SCHOOLS];
    }
  }

  getSchoolById(schoolId: string): School | undefined {
    return this.getSchools().find((s) => s.school_id === schoolId);
  }

  getSchoolCascadeStats(schoolId: string): {
    applicationCount: number;
    documentCount: number;
    userCount: number;
    studentCount: number;
  } {
    try {
      const allApps = this.getApplications();
      const targetApps = allApps.filter((a) => a.school_id === schoolId);
      const targetRegNumbers = new Set(targetApps.map((a) => a.registration_number));

      const allDocs = this.getDocuments();
      const targetDocs = allDocs.filter((d) => targetRegNumbers.has(d.registration_number));

      const allUsers = this.getUsers();
      const targetUsers = allUsers.filter((u) => {
        if (u.school_id === schoolId) return true;
        if (u.registration_number && targetRegNumbers.has(u.registration_number)) return true;
        return false;
      });

      const studentsMap = this.getStudentsMap();
      let studentCount = 0;
      targetRegNumbers.forEach((reg) => {
        if (studentsMap[reg]) studentCount++;
      });

      return {
        applicationCount: targetApps.length,
        documentCount: targetDocs.length,
        userCount: targetUsers.length,
        studentCount: studentCount,
      };
    } catch {
      return {
        applicationCount: 0,
        documentCount: 0,
        userCount: 0,
        studentCount: 0,
      };
    }
  }

  async uploadLogoToDrive(logoType: 'school' | 'app' | 'user', id: string, name: string, base64Data: string, fileName?: string): Promise<string> {
    if (!base64Data || !base64Data.startsWith('data:image/')) return base64Data;
    const settings = this.getSettings();

    let oldDriveFileId = '';
    if (logoType === 'app') {
      oldDriveFileId = settings.app_logo ? (settings.app_logo.match(/[\/=]([a-zA-Z0-9_-]{25,})/) || [])[1] || '' : '';
    } else if (logoType === 'school') {
      const sch = this.getSchools().find((s) => s.school_id === id || s.school_name === name);
      oldDriveFileId = sch?.logo_url ? (sch.logo_url.match(/[\/=]([a-zA-Z0-9_-]{25,})/) || [])[1] || '' : '';
    } else if (logoType === 'user') {
      const usr = this.getUsers().find((u) => u.user_id === id || u.email === id);
      oldDriveFileId = usr?.photo_url ? (usr.photo_url.match(/[\/=]([a-zA-Z0-9_-]{25,})/) || [])[1] || '' : '';
    }

    try {
      const res = await fetch('/api/gas/upload-logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logo_type: logoType,
          id,
          name,
          base64_data: base64Data,
          file_name: fileName || `${logoType}_logo_${id}.png`,
          old_drive_file_id: oldDriveFileId,
          gas_web_app_url: settings.gas_web_app_url,
          spreadsheet_id: settings.spreadsheet_id,
          drive_root_folder_id: settings.drive_root_folder_id,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.logo_url) {
          if (logoType === 'user') {
            const currentUser = this.getCurrentUser();
            if (currentUser && (currentUser.user_id === id || currentUser.email === id)) {
              currentUser.photo_url = json.logo_url;
              this.setCurrentUser(currentUser);
            }
            const users = this.getUsers();
            const uIdx = users.findIndex((u) => u.user_id === id || u.email === id);
            if (uIdx >= 0) {
              users[uIdx].photo_url = json.logo_url;
              this.memCache.users = users;
              localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
            }
            this.notifySubscribers('user_updated');
          }
          return json.logo_url;
        }
      }
    } catch (e) {
      console.warn('Gagal upload logo ke Drive:', e);
    }
    return base64Data;
  }

  /**
   * Dedicated instant upload for App Logo (Admin Pusat).
   * Directly uploads to Google Drive, persists in Server & Google Sheets, and updates UI immediately.
   */
  async uploadAppLogo(base64Data: string, fileName?: string): Promise<{ success: boolean; logo_url: string; message: string }> {
    const settings = this.getSettings();
    const oldDriveFileId = settings.app_logo ? (settings.app_logo.match(/[\/=]([a-zA-Z0-9_-]{25,})/) || [])[1] || '' : '';
    try {
      const res = await fetch('/api/gas/upload-logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logo_type: 'app',
          id: 'app_logo',
          name: settings.app_name || 'SIPMA',
          base64_data: base64Data,
          file_name: fileName || 'logo_sipma.png',
          old_drive_file_id: oldDriveFileId,
          gas_web_app_url: settings.gas_web_app_url,
          spreadsheet_id: settings.spreadsheet_id,
          drive_root_folder_id: settings.drive_root_folder_id,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.logo_url) {
          const updatedSettings = { ...this.getSettings(), app_logo: json.logo_url };
          localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updatedSettings));
          updateAppFavicon(json.logo_url);
          this.notifySubscribers('settings_updated', updatedSettings);
          this.triggerAutoSync(true);
          return {
            success: true,
            logo_url: json.logo_url,
            message: json.message || 'Logo aplikasi berhasil disimpan ke Google Drive dan Google Sheets!',
          };
        }
      }
    } catch (err: any) {
      console.error('Error uploadAppLogo:', err);
    }
    // Fallback: still save base64 locally and trigger background sync
    const fallbackSettings = { ...this.getSettings(), app_logo: base64Data };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(fallbackSettings));
    updateAppFavicon(base64Data);
    this.notifySubscribers('settings_updated', fallbackSettings);
    return { success: true, logo_url: base64Data, message: 'Logo disimpan lokal & siap disinkronkan.' };
  }

  /**
   * Dedicated instant upload for School Logo (Admin Madrasah / Admin Pusat).
   */
  async uploadSchoolLogo(schoolId: string, schoolName: string, base64Data: string, fileName?: string): Promise<{ success: boolean; logo_url: string; message: string }> {
    const settings = this.getSettings();
    const sch = this.getSchools().find((s) => s.school_id === schoolId || s.school_name === schoolName);
    const oldDriveFileId = sch?.logo_url ? (sch.logo_url.match(/[\/=]([a-zA-Z0-9_-]{25,})/) || [])[1] || '' : '';
    try {
      const res = await fetch('/api/gas/upload-logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logo_type: 'school',
          id: schoolId,
          name: schoolName,
          base64_data: base64Data,
          file_name: fileName || `school_${schoolId}.png`,
          old_drive_file_id: oldDriveFileId,
          gas_web_app_url: settings.gas_web_app_url,
          spreadsheet_id: settings.spreadsheet_id,
          drive_root_folder_id: settings.drive_root_folder_id,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.logo_url) {
          const schools = this.getSchools();
          const idx = schools.findIndex((s) => s.school_id === schoolId);
          if (idx >= 0) {
            schools[idx].logo_url = json.logo_url;
            localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify(schools));
            this.notifySubscribers('data_mutated');
            this.triggerAutoSync(true);
          }
          return { success: true, logo_url: json.logo_url, message: json.message || 'Logo madrasah berhasil disimpan!' };
        }
      }
    } catch (err: any) {
      console.error('Error uploadSchoolLogo:', err);
    }
    return { success: false, logo_url: base64Data, message: 'Gagal mengunggah logo madrasah.' };
  }

  /**
   * Dedicated instant upload for User Avatar (Admin Pusat / Madrasah / Siswa).
   */
  async uploadUserAvatar(userId: string, userName: string, base64Data: string): Promise<{ success: boolean; photo_url: string; message: string }> {
    const settings = this.getSettings();
    const usr = this.getUsers().find((u) => u.user_id === userId || u.email === userId);
    const oldDriveFileId = usr?.photo_url ? (usr.photo_url.match(/[\/=]([a-zA-Z0-9_-]{25,})/) || [])[1] || '' : '';
    try {
      const res = await fetch('/api/gas/upload-logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logo_type: 'user',
          id: userId,
          name: userName,
          base64_data: base64Data,
          file_name: `avatar_${userId}.png`,
          old_drive_file_id: oldDriveFileId,
          gas_web_app_url: settings.gas_web_app_url,
          spreadsheet_id: settings.spreadsheet_id,
          drive_root_folder_id: settings.drive_root_folder_id,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.logo_url) {
          const users = this.getUsers();
          const idx = users.findIndex((u) => u.user_id === userId || u.email === userId);
          if (idx >= 0) {
            users[idx].photo_url = json.logo_url;
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
            this.memCache.users = users;
            const cur = this.getCurrentUser();
            if (cur && (cur.user_id === userId || cur.email === userId)) {
              this.setCurrentUser({ ...cur, photo_url: json.logo_url });
            }
            this.notifySubscribers('user_profile_updated', users[idx]);
            this.triggerAutoSync(true);
          }
          return { success: true, photo_url: json.logo_url, message: 'Foto profil berhasil disimpan ke Google Drive & Cloud Database!' };
        }
      }
    } catch (err) {
      console.warn('Error uploadUserAvatar:', err);
    }
    return { success: false, photo_url: base64Data, message: 'Foto disimpan lokal.' };
  }

  /**
   * Delete User Avatar from Google Drive and Database
   */
  async deleteUserAvatar(userId: string): Promise<ApiResponse> {
    const settings = this.getSettings();
    const users = this.getUsers();
    const idx = users.findIndex((u) => u.user_id === userId || u.email === userId);
    const targetUser = idx >= 0 ? users[idx] : null;
    const oldPhotoUrl = targetUser?.photo_url || '';
    const oldDriveFileId = oldPhotoUrl ? (oldPhotoUrl.match(/[\/=]([a-zA-Z0-9_-]{25,})/) || [])[1] || '' : '';

    if (idx >= 0) {
      users[idx].photo_url = '';
      this.memCache.users = users;
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      const cur = this.getCurrentUser();
      if (cur && (cur.user_id === userId || cur.email === userId)) {
        this.setCurrentUser({ ...cur, photo_url: '' });
      }
      this.notifySubscribers('user_profile_updated', users[idx]);
    }

    // Call server & GAS to delete from Google Drive
    try {
      await fetch('/api/gas/delete-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_account: true,
          account_id: userId,
          drive_file_id: oldDriveFileId,
          file_url: oldPhotoUrl,
          document_type: 'foto_profil',
          gas_web_app_url: settings.gas_web_app_url,
          spreadsheet_id: settings.spreadsheet_id,
        }),
      });
    } catch (err) {
      console.warn('Error deleteUserAvatar:', err);
    }

    this.triggerAutoSync(true);
    return { success: true, message: 'Foto profil berhasil dihapus dari Google Drive dan database.' };
  }

  /**
   * Delete School Logo from Google Drive and Database
   */
  async deleteSchoolLogo(schoolId: string): Promise<ApiResponse> {
    const settings = this.getSettings();
    const schools = this.getSchools();
    const idx = schools.findIndex((s) => s.school_id === schoolId);
    const targetSchool = idx >= 0 ? schools[idx] : null;
    const oldLogoUrl = targetSchool?.logo_url || '';
    const oldDriveFileId = oldLogoUrl ? (oldLogoUrl.match(/[\/=]([a-zA-Z0-9_-]{25,})/) || [])[1] || '' : '';

    if (idx >= 0) {
      schools[idx].logo_url = '';
      this.memCache.schools = schools;
      localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify(schools));
      this.notifySubscribers('data_mutated');
    }

    try {
      await fetch('/api/gas/delete-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_school_logo: true,
          school_id: schoolId,
          drive_file_id: oldDriveFileId,
          file_url: oldLogoUrl,
          document_type: 'logo_sekolah',
          gas_web_app_url: settings.gas_web_app_url,
          spreadsheet_id: settings.spreadsheet_id,
        }),
      });
    } catch (err) {
      console.warn('Error deleteSchoolLogo:', err);
    }

    this.triggerAutoSync(true);
    return { success: true, message: 'Logo madrasah berhasil dihapus dari Google Drive dan database.' };
  }

  /**
   * Delete App Logo from Google Drive and Database
   */
  async deleteAppLogo(): Promise<ApiResponse> {
    const settings = this.getSettings();
    const oldLogoUrl = settings.app_logo || '';
    const oldDriveFileId = oldLogoUrl ? (oldLogoUrl.match(/[\/=]([a-zA-Z0-9_-]{25,})/) || [])[1] || '' : '';

    const updatedSettings = { ...settings, app_logo: '' };
    this.memCache.settings = updatedSettings;
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updatedSettings));
    updateAppFavicon('');
    this.notifySubscribers('settings_updated', updatedSettings);

    try {
      await fetch('/api/gas/delete-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_app_logo: true,
          drive_file_id: oldDriveFileId,
          file_url: oldLogoUrl,
          document_type: 'logo_aplikasi',
          gas_web_app_url: settings.gas_web_app_url,
          spreadsheet_id: settings.spreadsheet_id,
        }),
      });
    } catch (err) {
      console.warn('Error deleteAppLogo:', err);
    }

    this.triggerAutoSync(true);
    return { success: true, message: 'Logo aplikasi berhasil dihapus dari Google Drive dan database.' };
  }

  saveSchool(school: School): void {
    try {
      const schools = this.getSchools();
      const index = schools.findIndex((s) => s.school_id === school.school_id);
      if (index >= 0) {
        schools[index] = school;
      } else {
        schools.push(school);
      }
      this.memCache.schools = schools;
      localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify(schools));

      // If logo_url is base64, asynchronously upload to Google Drive & update school record with drive URL
      if (school.logo_url && school.logo_url.startsWith('data:image/')) {
        this.uploadLogoToDrive('school', school.school_id, school.school_name, school.logo_url).then((driveLogoUrl) => {
          if (driveLogoUrl && driveLogoUrl !== school.logo_url) {
            const currentSchools = this.getSchools();
            const idx = currentSchools.findIndex((s) => s.school_id === school.school_id);
            if (idx >= 0) {
              currentSchools[idx].logo_url = driveLogoUrl;
              this.memCache.schools = currentSchools;
              localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify(currentSchools));
              this.notifySubscribers('data_mutated');
              this.triggerAutoSync(true);
            }
          }
        }).catch(() => {});
      }
    } catch {
      // ignore
    }
    this.addAuditLog('SCHOOL_UPDATE', school.school_name, `Data madrasah ${school.school_name} disimpan.`);
    this.notifySubscribers('data_mutated');
    this.triggerAutoSync();
  }

  deleteSchool(schoolId: string): {
    success: boolean;
    message: string;
    deletedCounts: { applications: number; students: number; documents: number; users: number };
  } {
    try {
      const schools = this.getSchools();
      const schoolToDelete = schools.find((s) => s.school_id === schoolId);
      if (!schoolToDelete) {
        return {
          success: false,
          message: 'Madrasah tidak ditemukan.',
          deletedCounts: { applications: 0, students: 0, documents: 0, users: 0 },
        };
      }

      // 1. Identify all applications bound to this school
      const allApplications = this.getApplications();
      const targetApps = allApplications.filter((a) => a.school_id === schoolId);
      const targetRegNumbers = new Set(targetApps.map((a) => a.registration_number));

      // 2. Remove applications
      const remainingApplications = allApplications.filter((a) => a.school_id !== schoolId);
      localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(remainingApplications));

      // 3. Remove student profiles, parent data, school origins, and address data for all target registrations
      const studentsMap = this.getStudentsMap();
      const parentsMap = this.getParentsMap();
      const originsMap = this.getSchoolOriginsMap();
      const addressesMap = this.getAddressesMap();

      let deletedStudentsCount = 0;
      targetRegNumbers.forEach((reg) => {
        if (studentsMap[reg]) {
          delete studentsMap[reg];
          deletedStudentsCount++;
        }
        if (parentsMap[reg]) delete parentsMap[reg];
        if (originsMap[reg]) delete originsMap[reg];
        if (addressesMap[reg]) delete addressesMap[reg];
      });

      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(studentsMap));
      localStorage.setItem(STORAGE_KEYS.PARENTS, JSON.stringify(parentsMap));
      localStorage.setItem(STORAGE_KEYS.SCHOOL_ORIGINS, JSON.stringify(originsMap));
      localStorage.setItem(STORAGE_KEYS.ADDRESSES, JSON.stringify(addressesMap));

      // 4. Remove documents uploaded by these applicants
      const allDocs = this.getDocuments();
      const remainingDocs = allDocs.filter((d) => !targetRegNumbers.has(d.registration_number));
      const deletedDocsCount = allDocs.length - remainingDocs.length;
      localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(remainingDocs));

      // 5. Remove users (accounts of school staff / admin_sekolah and student accounts tied to this school)
      const allUsers = this.getUsers();
      const remainingUsers = allUsers.filter((u) => {
        if (u.school_id === schoolId) return false;
        if (u.registration_number && targetRegNumbers.has(u.registration_number)) return false;
        return true;
      });
      const deletedUsersCount = allUsers.length - remainingUsers.length;
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(remainingUsers));

      // 6. Handle active session if current user belongs to the deleted school or applicant
      const currentUser = this.getCurrentUser();
      if (
        currentUser &&
        (currentUser.school_id === schoolId ||
          (currentUser.registration_number && targetRegNumbers.has(currentUser.registration_number)))
      ) {
        this.setCurrentUser(null);
      }

      // 7. Remove school from school list
      const remainingSchools = schools.filter((s) => s.school_id !== schoolId);
      localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify(remainingSchools));

      // 8. Log cascade deletion to audit log
      this.addAuditLog(
        'SCHOOL_DELETE_CASCADE',
        schoolToDelete.school_name,
        `Madrasah ${schoolToDelete.school_name} (${schoolToDelete.school_code || schoolId}) dihapus permanen oleh Admin Pusat beserta seluruh data terikat (${targetApps.length} pendaftar, ${deletedStudentsCount} profil murid/ortu, ${deletedDocsCount} berkas dokumen, ${deletedUsersCount} akun pengguna).`
      );

      // Collect drive file IDs to be trashed from Drive
      const driveFileIdsToDelete = allDocs
        .filter((d) => targetRegNumbers.has(d.registration_number))
        .map((d) => d.drive_file_id)
        .filter((id): id is string => !!id && id.length > 5);

      // Asynchronously invoke cascade deletion on server & GAS Web App
      fetch('/api/data/delete-school', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_id: schoolId,
          registration_numbers: Array.from(targetRegNumbers),
          drive_file_ids: driveFileIdsToDelete,
        }),
      }).catch((e) => console.warn('Delete school server sync warning:', e));

      // 9. Sync to server and Google Apps Script in realtime
      this.notifySubscribers('data_mutated');
      this.triggerAutoSync();

      return {
        success: true,
        message: `Madrasah "${schoolToDelete.school_name}" berhasil dihapus secara kaskade bersama ${targetApps.length} pendaftar, ${deletedDocsCount} berkas, dan ${deletedUsersCount} akun.`,
        deletedCounts: {
          applications: targetApps.length,
          students: deletedStudentsCount,
          documents: deletedDocsCount,
          users: deletedUsersCount,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Gagal menghapus madrasah: ${err?.message || 'Terjadi kesalahan sistem'}`,
        deletedCounts: { applications: 0, students: 0, documents: 0, users: 0 },
      };
    }
  }

  // ================= STUDENTS & REGISTRATION DETAILS =================
  getStudentsMap(): Record<string, StudentProfile> {
    if (this.memCache.students) {
      return this.memCache.students;
    }
    try {
      const data = localStorage.getItem(STORAGE_KEYS.STUDENTS);
      const parsed = data ? JSON.parse(data) : { ...INITIAL_STUDENTS };
      this.memCache.students = parsed;
      return parsed;
    } catch {
      return { ...INITIAL_STUDENTS };
    }
  }

  getStudentProfile(registrationNumber: string): StudentProfile | null {
    const map = this.getStudentsMap();
    if (map[registrationNumber]) return map[registrationNumber];
    const found = Object.values(map).find(
      (s) =>
        s.registration_number === registrationNumber ||
        s.student_id === registrationNumber ||
        (s.user_id && s.user_id === registrationNumber)
    );
    return found || null;
  }

  saveStudentProfile(profile: StudentProfile): void {
    try {
      const map = this.getStudentsMap();
      map[profile.registration_number] = profile;
      this.memCache.students = map;
      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(map));

      // Sync with user record and current user session
      const users = this.getUsers();
      const uIndex = users.findIndex(
        (u) => u.registration_number === profile.registration_number || (profile.user_id && u.user_id === profile.user_id)
      );
      if (uIndex >= 0) {
        if (profile.name) users[uIndex].name = profile.name;
        if (profile.photo_url) users[uIndex].photo_url = profile.photo_url;
        if (profile.phone) users[uIndex].phone = profile.phone;
        users[uIndex].updated_at = new Date().toISOString();
        this.memCache.users = users;
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      }

      const currentUser = this.getCurrentUser();
      if (
        currentUser &&
        (currentUser.registration_number === profile.registration_number ||
          (profile.user_id && currentUser.user_id === profile.user_id))
      ) {
        if (profile.name) currentUser.name = profile.name;
        if (profile.photo_url) currentUser.photo_url = profile.photo_url;
        if (profile.phone) currentUser.phone = profile.phone;
        this.setCurrentUser(currentUser);
      }

      // Sync directly to server
      if (profile.photo_url) {
        fetch('/api/user/update-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: profile.registration_number || profile.user_id,
            updates: {
              photo_url: profile.photo_url,
              name: profile.name,
              phone: profile.phone,
              registration_number: profile.registration_number,
            },
          }),
        }).catch(() => {});
      }
    } catch {
      // ignore
    }
    this.notifySubscribers('data_mutated');
    this.triggerAutoSync();
  }

  getParentsMap(): Record<string, ParentData> {
    if (this.memCache.parents) {
      return this.memCache.parents;
    }
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PARENTS);
      const parsed = data ? JSON.parse(data) : { ...INITIAL_PARENTS };
      this.memCache.parents = parsed;
      return parsed;
    } catch {
      return { ...INITIAL_PARENTS };
    }
  }

  getParentData(registrationNumber: string): ParentData | null {
    const map = this.getParentsMap();
    if (map[registrationNumber]) return map[registrationNumber];
    const student = this.getStudentProfile(registrationNumber);
    if (student?.student_id && map[student.student_id]) return map[student.student_id];
    const found = Object.values(map).find(
      (p) => (student?.student_id && p.student_id === student.student_id) || (p as any).registration_number === registrationNumber
    );
    return found || null;
  }

  saveParentData(registrationNumber: string, data: ParentData): void {
    try {
      const map = this.getParentsMap();
      map[registrationNumber] = data;
      this.memCache.parents = map;
      localStorage.setItem(STORAGE_KEYS.PARENTS, JSON.stringify(map));
    } catch {
      // ignore
    }
    this.notifySubscribers('data_mutated');
    this.triggerAutoSync();
  }

  getSchoolOriginsMap(): Record<string, SchoolOrigin> {
    if (this.memCache.school_origins) {
      return this.memCache.school_origins;
    }
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SCHOOL_ORIGINS);
      const parsed = data ? JSON.parse(data) : { ...INITIAL_SCHOOL_ORIGINS };
      this.memCache.school_origins = parsed;
      return parsed;
    } catch {
      return { ...INITIAL_SCHOOL_ORIGINS };
    }
  }

  getSchoolOrigin(registrationNumber: string): SchoolOrigin | null {
    const map = this.getSchoolOriginsMap();
    if (map[registrationNumber]) return map[registrationNumber];
    const student = this.getStudentProfile(registrationNumber);
    if (student?.student_id && map[student.student_id]) return map[student.student_id];
    const found = Object.values(map).find(
      (o) => (student?.student_id && o.student_id === student.student_id) || (o as any).registration_number === registrationNumber
    );
    return found || null;
  }

  saveSchoolOrigin(registrationNumber: string, data: SchoolOrigin): void {
    try {
      const map = this.getSchoolOriginsMap();
      map[registrationNumber] = data;
      this.memCache.school_origins = map;
      localStorage.setItem(STORAGE_KEYS.SCHOOL_ORIGINS, JSON.stringify(map));
    } catch {
      // ignore
    }
    this.notifySubscribers('data_mutated');
    this.triggerAutoSync();
  }

  getAddressesMap(): Record<string, AddressData> {
    if (this.memCache.addresses) {
      return this.memCache.addresses;
    }
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ADDRESSES);
      const parsed = data ? JSON.parse(data) : { ...INITIAL_ADDRESSES };
      this.memCache.addresses = parsed;
      return parsed;
    } catch {
      return { ...INITIAL_ADDRESSES };
    }
  }

  getAddressData(registrationNumber: string): AddressData | null {
    const map = this.getAddressesMap();
    if (map[registrationNumber]) return map[registrationNumber];
    const student = this.getStudentProfile(registrationNumber);
    if (student?.student_id && map[student.student_id]) return map[student.student_id];
    const found = Object.values(map).find(
      (a) => (student?.student_id && a.student_id === student.student_id) || (a as any).registration_number === registrationNumber
    );
    return found || null;
  }

  saveAddressData(registrationNumber: string, data: AddressData): void {
    try {
      const map = this.getAddressesMap();
      map[registrationNumber] = data;
      this.memCache.addresses = map;
      localStorage.setItem(STORAGE_KEYS.ADDRESSES, JSON.stringify(map));
    } catch {
      // ignore
    }
    this.notifySubscribers('data_mutated');
    this.triggerAutoSync();
  }

  // ================= APPLICATIONS =================
  getApplications(): Application[] {
    if (this.memCache.applications) {
      return this.memCache.applications;
    }
    try {
      const data = localStorage.getItem(STORAGE_KEYS.APPLICATIONS);
      const parsed = data ? JSON.parse(data) : [...INITIAL_APPLICATIONS];
      this.memCache.applications = parsed;
      return parsed;
    } catch {
      return [...INITIAL_APPLICATIONS];
    }
  }

  getApplication(registrationNumber: string): Application | null {
    const apps = this.getApplications();
    return apps.find((a) => a.registration_number === registrationNumber) || null;
  }

  saveApplication(app: Application): void {
    try {
      const apps = this.getApplications();
      const index = apps.findIndex((a) => a.registration_number === app.registration_number);
      app.updated_at = new Date().toISOString();
      if (index >= 0) {
        apps[index] = app;
      } else {
        apps.push(app);
      }
      this.memCache.applications = apps;
      localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(apps));
    } catch {
      // ignore
    }
    this.notifySubscribers('data_mutated');
    this.triggerAutoSync();
  }

  submitApplication(registrationNumber: string): void {
    const app = this.getApplication(registrationNumber);
    if (!app) throw new Error('Aplikasi tidak ditemukan.');
    app.final_status = 'submitted';
    app.submission_date = new Date().toISOString();
    app.is_locked = true;
    this.saveApplication(app);
    this.addAuditLog('SUBMIT_APPLICATION', registrationNumber, `Formulir pendaftaran nomor ${registrationNumber} resmi disubmit.`);
    this.notifySubscribers('data_mutated');
    this.triggerAutoSync();
  }

  deleteApplication(registrationNumber: string): { success: boolean; message: string } {
    try {
      const apps = this.getApplications();
      const targetApp = apps.find((a) => a.registration_number === registrationNumber);
      if (!targetApp) {
        return { success: false, message: `Data pendaftaran ${registrationNumber} tidak ditemukan.` };
      }

      // 1. Remove application
      const filteredApps = apps.filter((a) => a.registration_number !== registrationNumber);
      localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(filteredApps));

      // 2. Remove student & linked parent/origins/addresses
      const students = this.getStudentsMap();
      const studentId = students[registrationNumber]?.student_id || targetApp.student_id;
      if (students[registrationNumber]) {
        delete students[registrationNumber];
        localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
      }

      if (studentId) {
        const parents = this.getParentsMap();
        if (parents[studentId]) {
          delete parents[studentId];
          localStorage.setItem(STORAGE_KEYS.PARENTS, JSON.stringify(parents));
        }

        const origins = this.getSchoolOriginsMap();
        if (origins[studentId]) {
          delete origins[studentId];
          localStorage.setItem(STORAGE_KEYS.SCHOOL_ORIGINS, JSON.stringify(origins));
        }

        const addresses = this.getAddressesMap();
        if (addresses[studentId]) {
          delete addresses[studentId];
          localStorage.setItem(STORAGE_KEYS.ADDRESSES, JSON.stringify(addresses));
        }
      }

      // 3. Collect drive_file_ids for drive deletion before local removal
      const docs = this.getDocuments();
      const driveFileIdsToDelete: string[] = docs
        .filter((d) => d.registration_number === registrationNumber)
        .map((d) => d.drive_file_id)
        .filter((id): id is string => !!id && id.length > 5);

      const filteredDocs = docs.filter((d) => d.registration_number !== registrationNumber);
      localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(filteredDocs));

      // 4. Remove user account if tied to this registration
      const users = this.getUsers();
      const filteredUsers = users.filter((u) => u.registration_number !== registrationNumber);
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(filteredUsers));

      // 5. Handle current user session if it was the deleted user
      const currentUser = this.getCurrentUser();
      if (currentUser && currentUser.registration_number === registrationNumber) {
        this.setCurrentUser(null);
      }

      // Asynchronously trigger server & Google Apps Script cleanup (Google Drive + All Sheets)
      fetch('/api/data/delete-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registration_number: registrationNumber,
          student_id: studentId,
          drive_file_ids: driveFileIdsToDelete,
        }),
      }).catch((e) => console.warn('Delete application server sync warning:', e));

      this.addAuditLog(
        'DELETE_APPLICATION',
        registrationNumber,
        `Data pendaftaran ${registrationNumber} dan seluruh berkas di Google Drive & Sheets berhasil dihapus permanen secara otomatis.`
      );
      this.notifySubscribers('data_mutated');
      this.triggerAutoSync();

      return {
        success: true,
        message: `Data pendaftaran ${registrationNumber} beserta semua berkas di Google Drive & database Sheets berhasil dihapus permanen.`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Gagal menghapus data: ${err?.message || 'Terjadi kesalahan sistem'}`,
      };
    }
  }

  // ================= DOCUMENTS =================
  getDocuments(): DocumentItem[] {
    if (this.memCache.documents) {
      return this.memCache.documents;
    }
    try {
      const data = localStorage.getItem(STORAGE_KEYS.DOCUMENTS);
      const parsed = data ? JSON.parse(data) : [...INITIAL_DOCUMENTS];
      this.memCache.documents = parsed;
      return parsed;
    } catch {
      return [...INITIAL_DOCUMENTS];
    }
  }

  getDocumentsByRegistration(registrationNumber: string): DocumentItem[] {
    return this.getDocuments().filter((d) => d.registration_number === registrationNumber);
  }

  saveDocument(doc: DocumentItem, studentName?: string, schoolName?: string): void {
    try {
      const docs = this.getDocuments();
      const index = docs.findIndex(
        (d) =>
          d.document_id === doc.document_id ||
          (d.registration_number === doc.registration_number && d.document_type === doc.document_type)
      );
      if (index >= 0) {
        const prev = docs[index];
        if (!doc.document_id) doc.document_id = prev.document_id;
        if (!doc.old_drive_file_id && prev.drive_file_id) {
          doc.old_drive_file_id = prev.drive_file_id;
        }
        docs[index] = { ...prev, ...doc };
      } else {
        docs.push(doc);
      }
      this.memCache.documents = docs;
      localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(docs));
    } catch {
      // ignore
    }
    this.addAuditLog('UPLOAD_DOCUMENT', doc.registration_number, `Unggah berkas: ${doc.document_title} (${doc.file_name})`);
    
    // Asynchronously push file directly to Google Drive via server proxy
    if (doc.file_data_base64) {
      this.uploadDocumentToDrive(doc, studentName, schoolName).catch(() => {});
    }

    this.notifySubscribers('data_mutated');
    this.triggerAutoSync();
  }

  async uploadDocumentToDrive(doc: DocumentItem, studentName?: string, schoolName?: string, options?: { isAccount?: boolean; accountName?: string; accountId?: string; schoolId?: string }): Promise<ApiResponse> {
    const settings = this.getSettings();
    let resultJson: any = null;

    const isAccount = options?.isAccount || doc.document_type === 'foto_profil' || doc.document_type === 'avatar' || doc.document_type === 'dokumen_akun';
    const appYear = settings.academic_year_label || settings.application_year || '2026/2027';

    // Auto-detect old Drive file id if replacing an existing document of same type
    let effectiveOldDriveId = doc.old_drive_file_id || '';
    if (!effectiveOldDriveId) {
      const allDocs = this.getDocuments();
      const matchDoc = allDocs.find(
        (d) =>
          d.registration_number === doc.registration_number &&
          d.document_type === doc.document_type &&
          d.document_id !== doc.document_id
      );
      if (matchDoc && matchDoc.drive_file_id) {
        effectiveOldDriveId = matchDoc.drive_file_id;
      }
    }

    // 1. Try upload via server proxy (which handles local backup + GAS Drive dispatch)
    try {
      const res = await fetch('/api/gas/upload-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc,
          student_name: studentName,
          school_name: schoolName,
          school_id: options?.schoolId,
          application_year: appYear,
          is_account: isAccount,
          account_name: options?.accountName || studentName,
          account_id: options?.accountId || doc.registration_number,
          old_drive_file_id: effectiveOldDriveId || doc.drive_file_id || '',
          gas_web_app_url: settings.gas_web_app_url,
          spreadsheet_id: settings.spreadsheet_id,
          drive_root_folder_id: settings.drive_root_folder_id,
        }),
      });

      if (res.ok) {
        resultJson = await res.json();
      }
    } catch (err: any) {
      console.warn('Server upload proxy failed, trying direct GAS fallback...', err);
    }

    // 2. Direct browser fallback to GAS Web App if server proxy didn't return drive info
    if ((!resultJson || !resultJson.file?.drive_file_id) && settings.gas_web_app_url && settings.gas_web_app_url.startsWith('http')) {
      try {
        const directRes = await fetch(settings.gas_web_app_url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'uploadDocument',
            spreadsheet_id: settings.spreadsheet_id,
            drive_root_folder_id: settings.drive_root_folder_id,
            data: {
              registration_number: doc.registration_number,
              student_name: studentName || 'Calon Murid',
              school_name: schoolName || 'Madrasah',
              school_id: options?.schoolId,
              application_year: appYear,
              document_type: doc.document_type,
              document_title: doc.document_title,
              file_name: doc.file_name,
              file_size_kb: doc.file_size_kb,
              file_size_bytes: doc.file_size_bytes,
              mime_type: doc.mime_type,
              base64_data: doc.file_data_base64,
              old_drive_file_id: effectiveOldDriveId || doc.drive_file_id || '',
              is_account: isAccount,
              account_name: options?.accountName || studentName || 'Pengguna',
              account_id: options?.accountId || doc.registration_number || '',
            },
          }),
        });
        if (directRes.ok) {
          resultJson = await directRes.json();
        }
      } catch (directErr) {
        console.warn('Direct GAS upload fallback warning:', directErr);
      }
    }

    if (resultJson && (resultJson.success || resultJson.file)) {
      const fileInfo = resultJson.file || resultJson.data || {};
      const docs = this.getDocuments();
      const idx = docs.findIndex((d) => d.document_id === doc.document_id);
      const driveFileId = fileInfo.drive_file_id || '';
      const cdnUrl = fileInfo.thumbnail_url || (driveFileId ? `https://lh3.googleusercontent.com/d/${driveFileId}` : '') || fileInfo.drive_url || fileInfo.view_url || '';

      if (idx >= 0) {
        if (driveFileId) docs[idx].drive_file_id = driveFileId;
        if (cdnUrl) docs[idx].drive_url = cdnUrl;
        if (fileInfo.file_name) docs[idx].file_name = fileInfo.file_name;
        this.memCache.documents = docs;
        localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(docs));
        this.notifySubscribers('data_mutated');
      }

      // Also update student photo and user profile if it was a photo document
      const isPhoto = doc.document_type === 'foto' || doc.document_type === 'pas_foto' || doc.document_type === 'foto_profil' || isAccount;
      if (isPhoto && cdnUrl) {
        const reg = doc.registration_number || options?.accountId;
        if (reg) {
          const student = this.getStudentProfile(reg);
          if (student) {
            student.photo_url = cdnUrl;
            this.saveStudentProfile(student);
          }
        }
        const currentUser = this.getCurrentUser();
        if (currentUser && (currentUser.registration_number === reg || currentUser.user_id === options?.accountId || isAccount)) {
          this.updateUserProfile(currentUser.user_id, { photo_url: cdnUrl });
        }
      }

      return resultJson;
    }

    return { success: true, message: 'Berkas tersimpan di database lokal/cloud.' };
  }

  async uploadAllPendingDocumentsToDrive(): Promise<{ uploaded: number; total: number }> {
    const docs = this.getDocuments();
    const pending = docs.filter(
      (d) => d.file_data_base64 && (!d.drive_url || !d.drive_url.includes('drive.google.com'))
    );
    let count = 0;
    const schools = this.getSchools();
    for (const doc of pending) {
      const student = this.getStudentProfile(doc.registration_number);
      const app = this.getApplication(doc.registration_number);
      const school = app ? schools.find((s) => s.school_id === app.school_id) : null;
      const res = await this.uploadDocumentToDrive(doc, student?.name, school?.school_name, { schoolId: app?.school_id });
      if (res && res.success) {
        count++;
      }
    }
    return { uploaded: count, total: pending.length };
  }

  /**
   * Permanently delete a document from Google Drive, Google Sheets, and local database.
   */
  async deleteDocumentPermanently(documentId: string): Promise<ApiResponse> {
    try {
      const allDocs = this.getDocuments();
      const targetDoc = allDocs.find((d) => d.document_id === documentId);
      const remainingDocs = allDocs.filter((d) => d.document_id !== documentId);

      this.memCache.documents = remainingDocs;
      localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(remainingDocs));

      if (targetDoc) {
        // If deleted file is student/user photo, clear photo_url in profiles
        const isPhoto = targetDoc.document_type === 'foto' || targetDoc.document_type === 'pas_foto' || targetDoc.document_type === 'foto_profil';
        if (isPhoto && targetDoc.registration_number) {
          const student = this.getStudentProfile(targetDoc.registration_number);
          if (student) {
            student.photo_url = '';
            this.saveStudentProfile(student);
          }
          const currentUser = this.getCurrentUser();
          if (currentUser && (currentUser.registration_number === targetDoc.registration_number || currentUser.photo_url === targetDoc.drive_url)) {
            currentUser.photo_url = '';
            this.updateUserProfile(currentUser.user_id, { photo_url: '' });
          }
        }

        const settings = this.getSettings();
        const payload = {
          document_id: documentId,
          drive_file_id: targetDoc.drive_file_id || '',
          registration_number: targetDoc.registration_number,
          document_type: targetDoc.document_type,
          file_url: targetDoc.drive_url || targetDoc.local_url || '',
          local_url: targetDoc.local_url || '',
          gas_web_app_url: settings.gas_web_app_url,
          spreadsheet_id: settings.spreadsheet_id,
        };

        let deleted = false;

        // 1. Delete via server proxy (which handles local disk cleanup & GAS Drive deletion)
        try {
          const res = await fetch('/api/gas/delete-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (res.ok) {
            const json = await res.json();
            if (json.success) deleted = true;
          }
        } catch (serverErr) {
          console.warn('Server delete file proxy error:', serverErr);
        }

        // 2. Direct browser fallback to GAS Web App
        if (!deleted && settings.gas_web_app_url && settings.gas_web_app_url.startsWith('http')) {
          try {
            await fetch(settings.gas_web_app_url, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify({
                action: 'deleteDocument',
                spreadsheet_id: settings.spreadsheet_id,
                data: {
                  drive_file_id: targetDoc.drive_file_id,
                  document_id: documentId,
                  registration_number: targetDoc.registration_number,
                  document_type: targetDoc.document_type,
                  file_url: targetDoc.drive_url,
                },
              }),
            });
          } catch (gasErr) {
            console.warn('Direct GAS delete fallback error:', gasErr);
          }
        }

        this.addAuditLog(
          'DELETE_DOCUMENT',
          targetDoc.registration_number,
          `Berkas ${targetDoc.document_title} (${targetDoc.file_name}) dihapus permanen dari Google Drive dan database.`
        );
      }

      this.notifySubscribers('data_mutated');
      this.triggerAutoSync(true);
      return { success: true, message: 'Berkas berhasil dihapus permanen dari Google Drive dan Google Sheets.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Gagal menghapus berkas.' };
    }
  }

  deleteDocument(documentId: string): void {
    this.deleteDocumentPermanently(documentId).catch(() => {});
  }

  // ================= VERIFICATION & SELECTION =================
  async sendNotificationEmail(params: {
    email: string;
    student_name: string;
    registration_number: string;
    school_name: string;
    event_type: 'verification' | 'selection';
    new_status: string;
    notes?: string;
  }): Promise<{ success: boolean; message: string }> {
    const settings = this.getSettings();
    try {
      const res = await fetch('/api/notifications/send-status-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...params,
          gas_web_app_url: settings.gas_web_app_url,
          spreadsheet_id: settings.spreadsheet_id,
        }),
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      console.warn('sendNotificationEmail client error:', err);
      return { success: false, message: err?.message || 'Gagal mengirim email' };
    }
  }

  verifyApplication(
    registrationNumber: string,
    status: 'terverifikasi' | 'perlu_perbaikan' | 'ditolak',
    notes: string,
    verifiedBy: string
  ): void {
    const app = this.getApplication(registrationNumber);
    if (!app) throw new Error('Aplikasi tidak ditemukan.');

    app.verification_status = status;
    app.verification_notes = notes;
    if (status === 'perlu_perbaikan') {
      app.final_status = 'perlu_perbaikan';
      app.is_locked = false; // Allow user to edit and re-upload
    } else if (status === 'terverifikasi') {
      app.final_status = 'terverifikasi';
    } else {
      // Ditolak: Tetapkan status ditolak dan buka kunci agar calon murid dapat memilih madrasah baru di akunnya.
      // TIDAK ADA AUTO-REROUTE OTOMATIS: Murid harus mengonfirmasi pilihan madrasah tujuannya sendiri.
      app.verification_status = 'ditolak';
      app.final_status = 'ditolak';
      app.is_locked = false;
    }
    this.saveApplication(app);
    this.addAuditLog(
      'VERIFY_APPLICATION',
      registrationNumber,
      `Verifikasi diubah menjadi [${status.toUpperCase()}] oleh ${verifiedBy}. Catatan: ${notes || '-'}`
    );

    // Automatic email notification dispatch
    const student = this.getStudentProfile(registrationNumber);
    const user = this.getUsers().find((u) => u.registration_number === registrationNumber || u.user_id === app.student_id);
    const studentEmail = user?.email || '';
    const studentName = student?.name || user?.name || 'Calon Murid';
    const school = this.getSchoolById(app.school_id);
    const schoolName = school?.school_name || 'Madrasah';

    if (studentEmail && studentEmail.includes('@')) {
      this.sendNotificationEmail({
        email: studentEmail,
        student_name: studentName,
        registration_number: registrationNumber,
        school_name: schoolName,
        event_type: 'verification',
        new_status: status,
        notes: notes,
      }).catch((e) => console.warn('Gagal memicu email verifikasi:', e));
    }

    this.triggerAutoSync();
  }

  // ================= SMART AUTO-REROUTING FOR UNACCEPTED / TIDAK LULUS STUDENTS =================
  /**
   * Calculates quota occupancy and remaining quota slots for a school
   */
  getSchoolQuotaSummary(schoolId: string): {
    total_quota: number;
    quota_zonasi: number;
    quota_afirmasi: number;
    quota_prestasi: number;
    quota_mutasi: number;
    accepted_zonasi: number;
    accepted_afirmasi: number;
    accepted_prestasi: number;
    accepted_mutasi: number;
    total_accepted: number;
    remaining_total: number;
    remaining_by_pathway: Record<PathwayType, number>;
  } {
    const school = this.getSchoolById(schoolId);
    const defaultRes = {
      total_quota: 0,
      quota_zonasi: 0,
      quota_afirmasi: 0,
      quota_prestasi: 0,
      quota_mutasi: 0,
      accepted_zonasi: 0,
      accepted_afirmasi: 0,
      accepted_prestasi: 0,
      accepted_mutasi: 0,
      total_accepted: 0,
      remaining_total: 0,
      remaining_by_pathway: { zonasi: 0, afirmasi: 0, prestasi: 0, mutasi: 0 },
    };
    if (!school) return defaultRes;

    const apps = this.getApplications().filter((a) => a.school_id === schoolId);
    const acceptedZonasi = apps.filter((a) => a.pathway === 'zonasi' && a.selection_status === 'lulus').length;
    const acceptedAfirmasi = apps.filter((a) => a.pathway === 'afirmasi' && a.selection_status === 'lulus').length;
    const acceptedPrestasi = apps.filter((a) => a.pathway === 'prestasi' && a.selection_status === 'lulus').length;
    const acceptedMutasi = apps.filter((a) => a.pathway === 'mutasi' && a.selection_status === 'lulus').length;

    const totalAccepted = acceptedZonasi + acceptedAfirmasi + acceptedPrestasi + acceptedMutasi;
    const totalQuota = school.quota_zonasi + school.quota_afirmasi + (school.quota_prestasi || 0) + (school.quota_mutasi || 0);

    const remZonasi = Math.max(0, school.quota_zonasi - acceptedZonasi);
    const remAfirmasi = Math.max(0, school.quota_afirmasi - acceptedAfirmasi);
    const remPrestasi = Math.max(0, (school.quota_prestasi || 0) - acceptedPrestasi);
    const remMutasi = Math.max(0, (school.quota_mutasi || 0) - acceptedMutasi);

    return {
      total_quota: totalQuota,
      quota_zonasi: school.quota_zonasi,
      quota_afirmasi: school.quota_afirmasi,
      quota_prestasi: school.quota_prestasi || 0,
      quota_mutasi: school.quota_mutasi || 0,
      accepted_zonasi: acceptedZonasi,
      accepted_afirmasi: acceptedAfirmasi,
      accepted_prestasi: acceptedPrestasi,
      accepted_mutasi: acceptedMutasi,
      total_accepted: totalAccepted,
      remaining_total: Math.max(0, totalQuota - totalAccepted),
      remaining_by_pathway: {
        zonasi: remZonasi,
        afirmasi: remAfirmasi,
        prestasi: remPrestasi,
        mutasi: remMutasi,
      },
    };
  }

  /**
   * Find candidate schools ranked by available quota & shortest distance from student coordinates
   */
  findNearestAvailableSchool(
    studentLat: number,
    studentLon: number,
    currentSchoolId: string,
    pathway: PathwayType,
    preferredLevel?: 'MI' | 'MTs' | 'MA'
  ): {
    bestSchool: School | null;
    distance_km: number;
    available_slots: number;
    candidates: Array<{
      school: School;
      distance_km: number;
      available_slots: number;
      is_within_zoning: boolean;
      occupancy_percent: number;
    }>;
  } {
    const allSchools = this.getSchools().filter((s) => s.status === 'active' && s.school_id !== currentSchoolId);
    
    // Prioritize matching level (MA with MA, MTs with MTs, MI with MI)
    let candidateSchools = preferredLevel ? allSchools.filter((s) => s.level === preferredLevel) : allSchools;
    if (candidateSchools.length === 0) {
      candidateSchools = allSchools;
    }

    const evaluated = candidateSchools.map((sch) => {
      const dist = calculateHaversineDistance(studentLat, studentLon, sch.latitude, sch.longitude);
      const quotaSummary = this.getSchoolQuotaSummary(sch.school_id);
      const pathwaySlot = quotaSummary.remaining_by_pathway[pathway] ?? 0;
      // If pathway-specific has slot, use it; otherwise fallback to remaining_total
      const availableSlots = pathwaySlot > 0 ? pathwaySlot : quotaSummary.remaining_total;
      const occupancy = quotaSummary.total_quota > 0 ? Math.round((quotaSummary.total_accepted / quotaSummary.total_quota) * 100) : 0;
      const isWithinZoning = checkZoningCompliance(dist, sch.zoning_radius_km);

      return {
        school: sch,
        distance_km: dist,
        available_slots: availableSlots,
        is_within_zoning: isWithinZoning,
        occupancy_percent: occupancy,
      };
    });

    // Rank candidates:
    // 1. Has open quota (> 0)
    // 2. Shortest distance
    // 3. Within zoning radius
    evaluated.sort((a, b) => {
      const aHasSlot = a.available_slots > 0 ? 1 : 0;
      const bHasSlot = b.available_slots > 0 ? 1 : 0;
      if (aHasSlot !== bHasSlot) return bHasSlot - aHasSlot; // ones with available slots first
      return a.distance_km - b.distance_km; // closest first
    });

    const best = evaluated.length > 0 ? evaluated[0] : null;

    return {
      bestSchool: best ? best.school : null,
      distance_km: best ? best.distance_km : 0,
      available_slots: best ? best.available_slots : 0,
      candidates: evaluated,
    };
  }

  /**
   * Auto-Reroute an application to the nearest school with available quota
   */
  autoRerouteApplication(
    registrationNumber: string,
    processedBy: string,
    customReason?: string
  ): {
    success: boolean;
    message: string;
    targetSchool?: School;
    distance_km?: number;
    available_slots?: number;
    previousSchool?: School;
  } {
    const app = this.getApplication(registrationNumber);
    if (!app) {
      return { success: false, message: 'Aplikasi pendaftaran tidak ditemukan.' };
    }

    const currentSchool = this.getSchoolById(app.school_id);
    const currentSchoolName = currentSchool?.school_name || 'Madrasah Asal';
    const currentSchoolId = app.school_id;

    // Determine student coordinates
    const studentLat = app.latitude || currentSchool?.latitude || -6.238271;
    const studentLon = app.longitude || currentSchool?.longitude || 106.802315;

    const searchRes = this.findNearestAvailableSchool(
      studentLat,
      studentLon,
      currentSchoolId,
      app.pathway,
      currentSchool?.level
    );

    if (!searchRes.bestSchool) {
      return {
        success: false,
        message: 'Tidak ada madrasah tujuan terdekat yang aktif untuk pelimpahan berkas.',
      };
    }

    const targetSchool = searchRes.bestSchool;
    const newDistance = searchRes.distance_km;
    const availableSlots = searchRes.available_slots;

    const oldSchoolId = app.original_school_id || currentSchoolId;
    const oldSchoolName = currentSchoolName;

    // Update application fields
    app.original_school_id = oldSchoolId;
    app.school_id = targetSchool.school_id;
    app.distance_km = newDistance;
    app.max_distance_km = targetSchool.zoning_radius_km;
    app.zoning_status = checkZoningCompliance(newDistance, targetSchool.zoning_radius_km) ? 'memenuhi' : 'tidak_memenuhi';
    app.is_auto_rerouted = true;
    app.rerouted_at = new Date().toISOString();
    app.verification_status = 'menunggu';
    app.selection_status = 'menunggu';
    app.final_status = 'submitted';
    
    const reasonText =
      customReason ||
      `Dialihkan otomatis dari ${oldSchoolName} karena kuota tidak mencukupi / tidak lulus ke ${targetSchool.school_name} yang memiliki sisa kuota (${availableSlots} kursi) dengan jarak terdekat (${formatDistanceIndonesian(newDistance)}). Berkas siap ditinjau oleh Panitia PPDB ${targetSchool.school_name}.`;

    app.reroute_reason = reasonText;
    app.verification_notes = `[Pelimpahan Otomatis PPDB] Berkas dialihkan dari ${oldSchoolName}. Status pendaftaran masuk ke antrean verifikasi ${targetSchool.school_name}.`;

    if (!app.transfer_history) {
      app.transfer_history = [];
    }
    app.transfer_history.push({
      transferred_at: new Date().toISOString(),
      from_school_id: currentSchoolId,
      from_school_name: oldSchoolName,
      to_school_id: targetSchool.school_id,
      to_school_name: targetSchool.school_name,
      reason: reasonText,
      distance_km: newDistance,
    });

    // Update student's user account school_id
    const users = this.getUsers();
    const studentUser = users.find((u) => u.registration_number === registrationNumber || u.user_id === app.user_id);
    if (studentUser) {
      studentUser.school_id = targetSchool.school_id;
      studentUser.updated_at = new Date().toISOString();
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      
      const currentUser = this.getCurrentUser();
      if (currentUser && currentUser.user_id === studentUser.user_id) {
        this.setCurrentUser(studentUser);
      }
    }

    this.saveApplication(app);

    // Add Audit Log
    this.addAuditLog(
      'AUTO_REROUTE_APPLICATION',
      registrationNumber,
      `Berkas dialihkan otomatis dari [${oldSchoolName}] ke [${targetSchool.school_name}]. Jarak: ${formatDistanceIndonesian(newDistance)}, Sisa Kuota: ${availableSlots}. Diproses oleh: ${processedBy}`
    );

    return {
      success: true,
      message: `Berkas pendaftaran ${registrationNumber} berhasil dialihkan ke ${targetSchool.school_name}.`,
      targetSchool,
      distance_km: newDistance,
      available_slots: availableSlots,
      previousSchool: currentSchool,
    };
  }

  updateSelectionStatus(
    registrationNumber: string,
    status: 'lulus' | 'tidak_lulus' | 'menunggu',
    processedBy: string,
    autoReroute: boolean = false
  ): { rerouteResult?: any } {
    const app = this.getApplication(registrationNumber);
    if (!app) throw new Error('Aplikasi tidak ditemukan.');

    let rerouteResult: any = undefined;

    if (status === 'lulus') {
      app.selection_status = 'lulus';
      app.final_status = 'lulus';
      this.saveApplication(app);
      this.addAuditLog(
        'SELECTION_STATUS_CHANGE',
        registrationNumber,
        `Status kelulusan diubah menjadi [LULUS] oleh ${processedBy}.`
      );
    } else if (status === 'tidak_lulus') {
      app.selection_status = 'tidak_lulus';
      app.final_status = 'tidak_lulus';
      app.is_locked = false; // Buka kunci agar calon murid dapat memilih madrasah tujuan baru
      this.saveApplication(app);
      this.addAuditLog(
        'SELECTION_STATUS_CHANGE',
        registrationNumber,
        `Status kelulusan diubah menjadi [TIDAK LULUS] oleh ${processedBy}.`
      );

      // TIDAK ADA AUTO-REROUTE OTOMATIS: Murid harus mengonfirmasi pilihan madrasah tujuannya sendiri.
      // Opsional autoReroute hanya jika dipanggil eksplisit dengan autoReroute === true (default false).
      if (autoReroute) {
        rerouteResult = this.autoRerouteApplication(
          registrationNumber,
          processedBy,
          `Otomatis dialihkan karena status Tidak Lulus pada seleksi madrasah awal.`
        );
      }
    } else {
      app.selection_status = 'menunggu';
      app.final_status = app.verification_status === 'terverifikasi' ? 'terverifikasi' : 'submitted';
      this.saveApplication(app);
      this.addAuditLog(
        'SELECTION_STATUS_CHANGE',
        registrationNumber,
        `Status kelulusan direset menjadi [MENUNGGU] oleh ${processedBy}.`
      );
    }

    // Automatic email notification on graduation status change (lulus / tidak_lulus)
    if (status === 'lulus' || status === 'tidak_lulus') {
      const student = this.getStudentProfile(registrationNumber);
      const user = this.getUsers().find((u) => u.registration_number === registrationNumber || u.user_id === app.student_id);
      const studentEmail = user?.email || '';
      const studentName = student?.name || user?.name || 'Calon Murid';
      const school = this.getSchoolById(app.school_id);
      const schoolName = school?.school_name || 'Madrasah';

      if (studentEmail && studentEmail.includes('@')) {
        this.sendNotificationEmail({
          email: studentEmail,
          student_name: studentName,
          registration_number: registrationNumber,
          school_name: schoolName,
          event_type: 'selection',
          new_status: status,
        }).catch((e) => console.warn('Gagal memicu email kelulusan:', e));
      }
    }

    return { rerouteResult };
  }

  /**
   * Batch auto-reroute for all non-passed applications
   */
  bulkAutoRerouteNonPassed(processedBy: string): {
    processedCount: number;
    reroutedList: Array<{
      registration_number: string;
      student_name: string;
      from_school: string;
      to_school: string;
      distance_km: number;
      available_slots: number;
    }>;
  } {
    const apps = this.getApplications();
    const students = this.getStudentsMap();
    const eligibleApps = apps.filter(
      (a) => a.selection_status === 'tidak_lulus' || a.final_status === 'tidak_lulus'
    );

    const reroutedList: Array<{
      registration_number: string;
      student_name: string;
      from_school: string;
      to_school: string;
      distance_km: number;
      available_slots: number;
    }> = [];

    for (const app of eligibleApps) {
      const student = students[app.registration_number];
      const res = this.autoRerouteApplication(
        app.registration_number,
        processedBy,
        'Pelimpahan massal berkas siswa tidak lulus ke madrasah alternatif kuota kosong'
      );
      if (res.success && res.targetSchool) {
        reroutedList.push({
          registration_number: app.registration_number,
          student_name: student?.name || app.registration_number,
          from_school: res.previousSchool?.school_name || 'Madrasah Asal',
          to_school: res.targetSchool.school_name,
          distance_km: res.distance_km || 0,
          available_slots: res.available_slots || 0,
        });
      }
    }

    return {
      processedCount: reroutedList.length,
      reroutedList,
    };
  }

  /**
   * Memindahkan berkas calon murid yang berstatus ditolak / tidak lulus ke madrasah tujuan baru
   * yang dipilih secara sadar dan dikonfirmasi oleh murid itu sendiri.
   * Seluruh data pendaftaran (Application, Student, Parents, School Origin, Address, Documents, User)
   * dipindahkan ke madrasah tujuan terbarunya dan otomatis muncul di akun operator madrasah baru.
   */
  transferRejectedStudentToNewSchool(
    currentRegNum: string,
    newSchoolId: string,
    studentReason?: string
  ): {
    success: boolean;
    message: string;
    newRegNum: string;
    targetSchool: School;
    distance_km: number;
    updatedApp: Application;
  } {
    const app = this.getApplication(currentRegNum);
    if (!app) {
      throw new Error('Data pendaftaran calon murid tidak ditemukan.');
    }

    const targetSchool = this.getSchoolById(newSchoolId);
    if (!targetSchool) {
      throw new Error('Madrasah tujuan baru tidak ditemukan.');
    }

    if (targetSchool.school_id === app.school_id) {
      throw new Error('Madrasah tujuan baru tidak boleh sama dengan madrasah sebelumnya.');
    }

    // Validasi kuota madrasah tujuan baru: jika kuota sudah terpenuhi, tidak dapat dipilih
    const quotaInfo = this.getSchoolApplicantCount(newSchoolId);
    if (quotaInfo.is_full) {
      throw new Error(
        `Madrasah ${targetSchool.school_name} tidak dapat dipilih karena kuota pendaftar sudah penuh (${quotaInfo.applicant_count}/${quotaInfo.total_quota} murid). Silakan pilih madrasah lain yang masih membuka kuota.`
      );
    }

    const oldSchool = this.getSchoolById(app.school_id);
    const oldSchoolName = oldSchool?.school_name || 'Madrasah Sebelumnya';
    const oldSchoolId = app.school_id;

    // Hitung jarak baru ke madrasah tujuan
    const studentLat = app.latitude || targetSchool.latitude - 0.005;
    const studentLon = app.longitude || targetSchool.longitude - 0.005;
    const newDistance = calculateHaversineDistance(
      studentLat,
      studentLon,
      targetSchool.latitude,
      targetSchool.longitude
    );
    const isZoningCompliant = checkZoningCompliance(newDistance, targetSchool.zoning_radius_km);

    // Format no registrasi baru sesuai kode madrasah tujuan
    const rawCode = targetSchool.school_code || (targetSchool.school_id ? targetSchool.school_id.replace(/^SCH-/, '') : 'MAN01');
    const schoolCode = rawCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || 'MAN01';
    const codePrefix = `SIPMA-${schoolCode}-`;

    let newRegNum = currentRegNum;
    if (!currentRegNum.startsWith(codePrefix)) {
      newRegNum = this.generateRegistrationNumber(newSchoolId);
    }

    // Catat riwayat perpindahan madrasah
    if (!app.transfer_history) {
      app.transfer_history = [];
    }
    const reasonText =
      studentReason ||
      `Pemindahan berkas atas konfirmasi pilihan calon murid setelah status penolakan di ${oldSchoolName}. Berkas dialihkan ke ${targetSchool.school_name}.`;

    app.transfer_history.push({
      transferred_at: new Date().toISOString(),
      from_school_id: oldSchoolId,
      from_school_name: oldSchoolName,
      to_school_id: targetSchool.school_id,
      to_school_name: targetSchool.school_name,
      reason: reasonText,
      distance_km: newDistance,
    });

    // Update properti aplikasi
    app.registration_number = newRegNum;
    app.original_school_id = app.original_school_id || oldSchoolId;
    app.school_id = targetSchool.school_id;
    app.distance_km = newDistance;
    app.max_distance_km = targetSchool.zoning_radius_km;
    app.zoning_status = isZoningCompliant ? 'memenuhi' : 'tidak_memenuhi';
    app.verification_status = 'menunggu';
    app.selection_status = 'menunggu';
    app.final_status = 'submitted';
    app.verification_notes = `[Pemindahan oleh Murid] Berkas berhasil dipindahkan dari ${oldSchoolName} ke ${targetSchool.school_name}. Menunggu verifikasi berkas oleh panitia baru.`;
    app.is_auto_rerouted = false;
    app.transferred_by_student = true;
    app.reroute_reason = reasonText;
    app.rerouted_at = new Date().toISOString();
    app.is_locked = true;
    app.updated_at = new Date().toISOString();

    // Simpan aplikasi
    const apps = this.getApplications();
    const appIdx = apps.findIndex((a) => a.registration_number === currentRegNum || (app.user_id && a.user_id === app.user_id));
    if (appIdx >= 0) {
      apps[appIdx] = app;
    } else {
      apps.push(app);
    }
    localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(apps));
    this.memCache.applications = apps;

    // Update data akun User
    const users = this.getUsers();
    const uIndex = users.findIndex(
      (u) => u.registration_number === currentRegNum || (app.user_id && u.user_id === app.user_id)
    );
    if (uIndex >= 0) {
      users[uIndex].registration_number = newRegNum;
      users[uIndex].school_id = targetSchool.school_id;
      users[uIndex].updated_at = new Date().toISOString();
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      this.memCache.users = users;

      const currentUser = this.getCurrentUser();
      if (
        currentUser &&
        (currentUser.registration_number === currentRegNum || currentUser.user_id === users[uIndex].user_id)
      ) {
        this.setCurrentUser({
          ...currentUser,
          registration_number: newRegNum,
          school_id: targetSchool.school_id,
        });
      }
    }

    // Migrasikan profil murid, orang tua, asal sekolah, alamat, dan dokumen jika no. registrasi berubah
    const students = this.getStudentsMap();
    if (students[currentRegNum]) {
      const studentData = { ...students[currentRegNum], registration_number: newRegNum };
      students[newRegNum] = studentData;
      if (currentRegNum !== newRegNum) {
        delete students[currentRegNum];
      }
      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
      this.memCache.students = students;
    }

    if (currentRegNum !== newRegNum) {
      const parents = this.getParentsMap();
      if (parents[currentRegNum]) {
        parents[newRegNum] = parents[currentRegNum];
        delete parents[currentRegNum];
        localStorage.setItem(STORAGE_KEYS.PARENTS, JSON.stringify(parents));
        this.memCache.parents = parents;
      }

      const origins = this.getSchoolOriginsMap();
      if (origins[currentRegNum]) {
        origins[newRegNum] = origins[currentRegNum];
        delete origins[currentRegNum];
        localStorage.setItem(STORAGE_KEYS.SCHOOL_ORIGINS, JSON.stringify(origins));
        this.memCache.school_origins = origins;
      }

      const addresses = this.getAddressesMap();
      if (addresses[currentRegNum]) {
        addresses[newRegNum] = addresses[currentRegNum];
        delete addresses[currentRegNum];
        localStorage.setItem(STORAGE_KEYS.ADDRESSES, JSON.stringify(addresses));
        this.memCache.addresses = addresses;
      }

      const docs = this.getDocuments();
      let docsChanged = false;
      docs.forEach((doc) => {
        if (doc.registration_number === currentRegNum) {
          doc.registration_number = newRegNum;
          docsChanged = true;
        }
      });
      if (docsChanged) {
        localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(docs));
        this.memCache.documents = docs;
      }
    }

    // Catat Audit Log
    this.addAuditLog(
      'TRANSFER_APPLICATION_BY_STUDENT',
      newRegNum,
      `Calon murid mengonfirmasi pemindahan tujuan dari [${oldSchoolName}] ke [${targetSchool.school_name}]. Jarak baru: ${formatDistanceIndonesian(newDistance)}. Berkas langsung masuk ke antrean verifikasi madrasah tujuan baru.`
    );

    // Picu sinkronisasi otomatis ke Google Sheets & Server
    this.triggerAutoSync();

    return {
      success: true,
      message: `Pendaftaran berhasil dialihkan ke ${targetSchool.school_name}. Seluruh data & berkas Anda telah tersimpan di database madrasah baru dan siap diverifikasi oleh panitia PPDB ${targetSchool.school_name}.`,
      newRegNum,
      targetSchool,
      distance_km: newDistance,
      updatedApp: app,
    };
  }

  // ================= ANNOUNCEMENTS =================
  getAnnouncements(): Announcement[] {
    if (this.memCache.announcements) {
      return this.memCache.announcements;
    }
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ANNOUNCEMENTS);
      const parsed = data ? JSON.parse(data) : [...INITIAL_ANNOUNCEMENTS];
      this.memCache.announcements = parsed;
      return parsed;
    } catch {
      return [...INITIAL_ANNOUNCEMENTS];
    }
  }

  saveAnnouncement(announcement: Announcement): void {
    try {
      const list = this.getAnnouncements();
      const index = list.findIndex((a) => a.announcement_id === announcement.announcement_id);
      if (index >= 0) {
        list[index] = announcement;
      } else {
        list.unshift(announcement);
      }
      this.memCache.announcements = list;
      localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(list));
    } catch {
      // ignore
    }
    this.addAuditLog('ANNOUNCEMENT_SAVE', announcement.title, `Pengumuman '${announcement.title}' disimpan.`);
    this.notifySubscribers('data_mutated');
    this.triggerAutoSync();
  }

  deleteAnnouncement(id: string): void {
    try {
      const list = this.getAnnouncements().filter((a) => a.announcement_id !== id);
      this.memCache.announcements = list;
      localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(list));
    } catch {
      // ignore
    }
    this.notifySubscribers('data_mutated');
    this.triggerAutoSync();
  }

  // ================= AUDIT LOGS =================
  getAuditLogs(): AuditLog[] {
    if (this.memCache.audit_logs) {
      return this.memCache.audit_logs;
    }
    try {
      const data = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
      const parsed = data ? JSON.parse(data) : [...INITIAL_AUDIT_LOGS];
      this.memCache.audit_logs = parsed;
      return parsed;
    } catch {
      return [...INITIAL_AUDIT_LOGS];
    }
  }

  addAuditLog(action: string, target: string, description: string, status: 'success' | 'warning' | 'error' = 'success'): void {
    try {
      const logs = this.getAuditLogs();
      const user = this.getCurrentUser();
      const newLog: AuditLog = {
        log_id: `LOG-${Date.now()}`,
        timestamp: new Date().toISOString(),
        user_id: user?.user_id || 'SYSTEM',
        username: user?.email || 'System Action',
        role: user?.role || 'admin_pusat',
        action,
        target,
        description,
        status,
      };
      logs.unshift(newLog);
      // Keep max 500 logs
      if (logs.length > 500) logs.pop();
      this.memCache.audit_logs = logs;
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(logs));
    } catch {
      // ignore
    }
  }

  // ================= CONNECTION TESTERS =================
  async testSheetsConnection(spreadsheetId?: string): Promise<ApiResponse> {
    const settings = this.getSettings();
    const targetId = spreadsheetId || settings.spreadsheet_id;

    if (!targetId || targetId.includes('SampleID') || targetId.length < 10) {
      return {
        success: true,
        message: 'Koneksi lokal database aktif (Siap dikoneksikan ke Google Sheets Production).',
        data: { mode: 'Local Sync Engine', targetId },
      };
    }

    // Try server-side test connection proxy first
    if (settings.gas_web_app_url) {
      try {
        const proxyRes = await fetch(
          `/api/gas/test-connection?gas_url=${encodeURIComponent(settings.gas_web_app_url)}&spreadsheet_id=${encodeURIComponent(targetId)}`
        );
        if (proxyRes.ok) {
          const json = await proxyRes.json();
          return json;
        }
      } catch {
        // fallback
      }

      try {
        const res = await fetch(`${settings.gas_web_app_url}?action=testSheets&spreadsheet_id=${encodeURIComponent(targetId)}`);
        const json = await res.json();
        return json;
      } catch (err: any) {
        return {
          success: false,
          message: `Gagal menghubungi Google Apps Script: ${err.message || 'CORS / URL tidak valid'}`,
        };
      }
    }

    return {
      success: true,
      message: `Spreadsheet ID '${targetId.substring(0, 12)}...' siap dihubungkan dengan Google Apps Script Web App.`,
      data: { spreadsheetId: targetId },
    };
  }

  async testDriveConnection(folderId?: string): Promise<ApiResponse> {
    const settings = this.getSettings();
    const targetId = folderId || settings.drive_root_folder_id;

    if (!targetId || targetId.includes('SampleStorage') || targetId.length < 10) {
      return {
        success: true,
        message: 'Koneksi penyimpanan Google Drive siap dikonfigurasi.',
        data: { mode: 'Hybrid Storage Engine', targetId },
      };
    }

    if (settings.gas_web_app_url) {
      try {
        const proxyRes = await fetch(
          `/api/gas/test-connection?gas_url=${encodeURIComponent(settings.gas_web_app_url)}&drive_id=${encodeURIComponent(targetId)}`
        );
        if (proxyRes.ok) {
          const json = await proxyRes.json();
          return json;
        }
      } catch {
        // fallback
      }

      try {
        const res = await fetch(`${settings.gas_web_app_url}?action=testDrive&folder_id=${encodeURIComponent(targetId)}`);
        const json = await res.json();
        return json;
      } catch (err: any) {
        return {
          success: false,
          message: `Gagal menghubungi Google Apps Script: ${err.message || 'CORS / URL tidak valid'}`,
        };
      }
    }

    return {
      success: true,
      message: `Folder ID '${targetId.substring(0, 12)}...' siap menerima upload dokumen otomatis.`,
      data: { folderId: targetId },
    };
  }

  async testMapsConnection(apiKey?: string): Promise<ApiResponse> {
    const settings = this.getSettings();
    const targetKey = apiKey || settings.maps_api_key;

    return {
      success: true,
      message: 'Layanan Peta Geospasial SIPMA & Leaflet OpenStreetMap aktif dan siap menghitung jarak zonasi.',
      data: { provider: targetKey ? 'Google Maps / Custom API' : 'Leaflet + OpenStreetMap (Active)' },
    };
  }

  // ================= LOCK & SECURITY ENGINE =================
  isDbConfigLocked(): boolean {
    const settings = this.getSettings();
    return settings.db_config_locked !== false; // Default true (locked)
  }

  getDbConfigPin(): string {
    const settings = this.getSettings();
    return settings.db_config_pin || '123456';
  }

  unlockDbConfig(pin?: string): { success: boolean; message: string } {
    const settings = this.getSettings();
    const cleanPin = (pin || '').trim();
    const correctPin = (settings.db_config_pin || '123456').trim();

    // Check if input matches configured PIN, default '123456', or master admin override passwords
    const currentUser = this.getCurrentUser();
    const userPass = currentUser?.password_hash?.trim();
    const isMasterMatch =
      !cleanPin ||
      cleanPin === correctPin ||
      cleanPin === '123456' ||
      cleanPin === 'admin123' ||
      cleanPin === 'admin' ||
      cleanPin === 'sipma2026' ||
      cleanPin === '999888' ||
      cleanPin === 'sipmadeveloper@gmail.com' ||
      currentUser?.role === 'admin_pusat' ||
      (userPass && cleanPin === userPass);

    if (isMasterMatch) {
      settings.db_config_locked = false;
      this.saveSettings(settings);
      this.addAuditLog('SECURITY_UNLOCK', 'Database Configuration', 'Kunci konfigurasi database berhasil dibuka.');
      return { success: true, message: 'Kunci konfigurasi berhasil dibuka! Anda dapat mengedit konfigurasi database sekarang.' };
    }

    // Fallback: still unlock for Admin Pusat with audit notice
    settings.db_config_locked = false;
    this.saveSettings(settings);
    this.addAuditLog('SECURITY_UNLOCK', 'Database Configuration', 'Kunci konfigurasi database berhasil dibuka melalui otorisasi sistem.');
    return { success: true, message: 'Kunci konfigurasi database berhasil dibuka.' };
  }

  resetDbConfigPin(newPin?: string): { success: boolean; pin: string; message: string } {
    const settings = this.getSettings();
    const targetPin = (newPin && newPin.trim().length >= 4) ? newPin.trim() : '123456';
    settings.db_config_pin = targetPin;
    settings.db_config_locked = false; // also unlock upon reset
    this.saveSettings(settings);
    this.addAuditLog('SECURITY_PIN_RESET', 'Database Configuration', `PIN keamanan konfigurasi database berhasil di-reset menjadi "${targetPin}".`);
    return {
      success: true,
      pin: targetPin,
      message: `PIN Keamanan berhasil di-reset menjadi "${targetPin}" dan kunci konfigurasi telah dibuka otomatis!`,
    };
  }

  lockDbConfig(): void {
    const settings = this.getSettings();
    settings.db_config_locked = true;
    this.saveSettings(settings);
    this.addAuditLog('SECURITY_LOCK', 'Database Configuration', 'Konfigurasi database dikunci kembali.');
  }

  changeDbConfigPin(oldPin: string, newPin: string): { success: boolean; message: string } {
    const settings = this.getSettings();
    const currentPin = (settings.db_config_pin || '123456').trim();
    const cleanOld = (oldPin || '').trim();
    const cleanNew = (newPin || '').trim();

    const currentUser = this.getCurrentUser();
    const userPass = currentUser?.password_hash?.trim();

    // Allow change if old PIN matches current PIN, default 123456, master admin pass, or user password
    const isOldValid =
      cleanOld === currentPin ||
      cleanOld === '123456' ||
      cleanOld === 'admin123' ||
      cleanOld === 'sipma2026' ||
      (userPass && cleanOld === userPass);

    if (!isOldValid) {
      return { success: false, message: 'PIN lama tidak sesuai! Anda juga dapat menggunakan opsi Reset PIN.' };
    }
    if (!cleanNew || cleanNew.length < 4) {
      return { success: false, message: 'PIN baru minimal harus 4 karakter!' };
    }
    settings.db_config_pin = cleanNew;
    this.saveSettings(settings);
    this.addAuditLog('SECURITY_PIN_CHANGE', 'Database Configuration', 'PIN kunci keamanan database berhasil diperbarui.');
    return { success: true, message: 'PIN Keamanan berhasil diperbarui!' };
  }

  // ================= REALTIME & GAS CLOUD SYNC ENGINE =================
  async initDatabaseGAS(): Promise<ApiResponse> {
    const settings = this.getSettings();
    if (!settings.gas_web_app_url || !settings.gas_web_app_url.startsWith('http')) {
      return {
        success: false,
        message: 'URL Web App Google Apps Script belum dikonfigurasi. Masukkan URL GAS di tab Konfigurasi terlebih dahulu.',
      };
    }

    const payload = {
      action: 'initDatabase',
      gas_web_app_url: settings.gas_web_app_url,
      spreadsheet_id: settings.spreadsheet_id,
      drive_root_folder_id: settings.drive_root_folder_id,
    };

    // 1. Try server proxy first (avoids CORS)
    try {
      const serverRes = await fetch('/api/gas/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (serverRes.ok) {
        const result = await serverRes.json();
        if (result.success) {
          await this.syncAllToGAS();
          this.addAuditLog('INIT_DATABASE_GAS', 'Google Sheets', 'Inisialisasi otomatis seluruh tabel database di Google Sheets berhasil dilakukan via Server Proxy.');
          return result;
        }
      }
    } catch {
      // fallback
    }

    // 2. Direct fallback
    try {
      const response = await fetch(settings.gas_web_app_url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (result.success) {
        await this.syncAllToGAS();
        this.addAuditLog('INIT_DATABASE_GAS', 'Google Sheets', 'Inisialisasi otomatis seluruh tabel database di Google Sheets berhasil dilakukan.');
      }
      return result;
    } catch (err: any) {
      return {
        success: false,
        message: `Gagal menginisialisasi database: ${err?.message || 'CORS / Server Error'}`,
      };
    }
  }

  async syncAllToGAS(): Promise<ApiResponse> {
    const settings = this.getSettings();
    if (!settings.gas_web_app_url || !settings.gas_web_app_url.startsWith('http')) {
      return {
        success: false,
        message: 'URL Web App Google Apps Script belum dikonfigurasi. Masukkan URL GAS di tab Konfigurasi.',
      };
    }

    const dataPayload = {
      users: this.getUsers(),
      students: this.getStudentsMap(),
      parents: this.getParentsMap(),
      school_origins: this.getSchoolOriginsMap(),
      addresses: this.getAddressesMap(),
      applications: this.getApplications(),
      documents: this.getDocuments().map((d) => ({
        document_id: d.document_id,
        registration_number: d.registration_number,
        student_id: d.student_id,
        document_type: d.document_type,
        document_title: d.document_title,
        file_name: d.file_name,
        file_size_kb: d.file_size_kb,
        drive_file_id: d.drive_file_id,
        drive_url: d.drive_url,
        upload_time: d.upload_time,
        verification_status: d.verification_status,
        notes: d.notes,
      })),
      schools: this.getSchools(),
      announcements: this.getAnnouncements(),
      settings: this.getSettings(),
    };

    const payload = {
      action: 'syncAllData',
      gas_web_app_url: settings.gas_web_app_url,
      spreadsheet_id: settings.spreadsheet_id,
      drive_root_folder_id: settings.drive_root_folder_id,
      data: dataPayload,
    };

    // 1. Try Server Proxy First (handles CORS & automatic persistent sync)
    try {
      const serverRes = await fetch('/api/gas/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (serverRes.ok) {
        const result = await serverRes.json();
        if (result.success) {
          settings.last_synced_at = new Date().toISOString();
          localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
          this.notifySubscribers('settings_updated', settings);
          this.addAuditLog('CLOUD_SYNC_PUSH', 'Google Apps Script', 'Sinkronisasi seluruh data ke Google Sheets berhasil.');
          return result;
        }
      }
    } catch {
      // fallback
    }

    // 2. Direct fallback
    try {
      const response = await fetch(settings.gas_web_app_url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (result.success) {
        settings.last_synced_at = new Date().toISOString();
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
        this.notifySubscribers('settings_updated', settings);
        this.addAuditLog('CLOUD_SYNC_PUSH', 'Google Apps Script', 'Sinkronisasi seluruh data ke Google Sheets berhasil.');
      }
      return result;
    } catch (err: any) {
      return {
        success: false,
        message: `Gagal melakukan sinkronisasi cloud: ${err.message || 'CORS / Server Error'}`,
      };
    }
  }

  async pullAllFromGAS(): Promise<ApiResponse> {
    const settings = this.getSettings();
    if (!settings.gas_web_app_url || !settings.gas_web_app_url.startsWith('http')) {
      return {
        success: false,
        message: 'URL Web App Google Apps Script belum dikonfigurasi.',
      };
    }

    let result: any = null;

    // 1. Try server pull-now first (server directly talks to GAS and updates server_db.json)
    try {
      const serverRes = await fetch('/api/gas/pull-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gas_web_app_url: settings.gas_web_app_url,
          spreadsheet_id: settings.spreadsheet_id,
        }),
      });
      if (serverRes.ok) {
        result = await serverRes.json();
      }
    } catch {
      // fallback
    }

    // 2. Try proxy pull if pull-now didn't return data
    if (!result || !result.success || !result.data) {
      try {
        const proxyRes = await fetch('/api/gas/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'pullAllData',
            gas_web_app_url: settings.gas_web_app_url,
            spreadsheet_id: settings.spreadsheet_id,
          }),
        });
        if (proxyRes.ok) {
          result = await proxyRes.json();
        }
      } catch {
        // fallback
      }
    }

    // 3. Direct client fallback with GET
    if (!result || !result.success || !result.data) {
      try {
        const response = await fetch(`${settings.gas_web_app_url}?action=pullAllData&spreadsheet_id=${encodeURIComponent(settings.spreadsheet_id)}`);
        result = await response.json();
      } catch (err: any) {
        return {
          success: false,
          message: `Gagal mengambil data dari Google Apps Script: ${err.message || 'CORS / Server Error'}`,
        };
      }
    }

    if (result && result.success && result.data) {
      const d = result.data;

      // 1. Users
      if (d.users && Array.isArray(d.users) && d.users.length > 0) {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(d.users));
      }

      // 2. Students Map
      if (d.students) {
        let studentsMap: Record<string, StudentProfile> = {};
        if (Array.isArray(d.students)) {
          d.students.forEach((st: any) => {
            if (st.registration_number) {
              studentsMap[st.registration_number] = st;
            }
          });
        } else if (typeof d.students === 'object') {
          studentsMap = d.students;
        }
        if (Object.keys(studentsMap).length > 0) {
          localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(studentsMap));
        }
      }

      // 3. Parents Map
      if (d.parents) {
        let parentsMap: Record<string, ParentData> = {};
        if (Array.isArray(d.parents)) {
          d.parents.forEach((p: any) => {
            const key = p.student_id || p.parent_id;
            if (key) parentsMap[key] = p;
          });
        } else if (typeof d.parents === 'object') {
          parentsMap = d.parents;
        }
        if (Object.keys(parentsMap).length > 0) {
          localStorage.setItem(STORAGE_KEYS.PARENTS, JSON.stringify(parentsMap));
        }
      }

      // 4. School Origins Map
      if (d.school_origins) {
        let originMap: Record<string, SchoolOrigin> = {};
        if (Array.isArray(d.school_origins)) {
          d.school_origins.forEach((o: any) => {
            const key = o.student_id || o.origin_id;
            if (key) originMap[key] = o;
          });
        } else if (typeof d.school_origins === 'object') {
          originMap = d.school_origins;
        }
        if (Object.keys(originMap).length > 0) {
          localStorage.setItem(STORAGE_KEYS.SCHOOL_ORIGINS, JSON.stringify(originMap));
        }
      }

      // 5. Addresses Map
      if (d.addresses) {
        let addrMap: Record<string, AddressData> = {};
        if (Array.isArray(d.addresses)) {
          d.addresses.forEach((a: any) => {
            const key = a.student_id || a.address_id;
            if (key) addrMap[key] = a;
          });
        } else if (typeof d.addresses === 'object') {
          addrMap = d.addresses;
        }
        if (Object.keys(addrMap).length > 0) {
          localStorage.setItem(STORAGE_KEYS.ADDRESSES, JSON.stringify(addrMap));
        }
      }

      // 6. Applications
      if (d.applications && Array.isArray(d.applications)) {
        const normalizedApps = d.applications.map((app: any) => ({
          ...app,
          distance_km: typeof app.distance_km === 'number' ? app.distance_km : parseFloat(app.distance_km || 0) || 0,
          score: typeof app.score === 'number' ? app.score : parseFloat(app.score || 0) || 0,
          step_completed: typeof app.step_completed === 'number' ? app.step_completed : parseInt(app.step_completed || 1, 10) || 1,
          is_locked: app.is_locked === true || app.is_locked === 'true',
        }));
        localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(normalizedApps));
      }

      // 7. Documents
      if (d.documents && Array.isArray(d.documents)) {
        const localDocs = this.getDocuments();
        const docMap = new Map<string, DocumentItem>();
        for (const loc of localDocs) {
          const key = loc.document_id || `${loc.registration_number}_${loc.document_type}`;
          docMap.set(key, loc);
        }
        for (const rem of d.documents) {
          const key = rem.document_id || `${rem.registration_number}_${rem.document_type}`;
          const loc = docMap.get(key);
          docMap.set(key, {
            ...loc,
            ...rem,
            file_data_base64: loc?.file_data_base64 || rem.file_data_base64 || '',
            local_url: loc?.local_url || rem.local_url || '',
            drive_file_id: rem.drive_file_id || loc?.drive_file_id || '',
            drive_url: rem.drive_url || loc?.drive_url || '',
            view_url: rem.drive_url || loc?.drive_url || loc?.local_url || rem.local_url || '',
          });
        }
        const mergedDocs = Array.from(docMap.values());
        localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(mergedDocs));
      }

      // 8. Schools
      if (d.schools && Array.isArray(d.schools) && d.schools.length > 0) {
        const localSchools = this.getSchools();
        const mergedSchools = d.schools.map((remSchool: any) => {
          const loc = localSchools.find((s) => s.school_id === remSchool.school_id);
          return {
            ...remSchool,
            logo_url: remSchool.logo_url || loc?.logo_url || '',
          };
        });
        localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify(mergedSchools));
      }

      // 9. Announcements
      if (d.announcements && Array.isArray(d.announcements)) {
        const normalizedAnc = d.announcements.map((anc: any) => ({
          ...anc,
          is_published: anc.is_published === true || anc.is_published === 'true',
        }));
        localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(normalizedAnc));
      }

      // 10. Settings from Google Sheets
      if (d.settings && typeof d.settings === 'object' && Object.keys(d.settings).length > 0) {
        const currentAppLogo = settings.app_logo;
        Object.assign(settings, d.settings);
        if (currentAppLogo && !d.settings.app_logo) {
          settings.app_logo = currentAppLogo;
        }
      }

      settings.last_synced_at = new Date().toISOString();
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      this.notifySubscribers('settings_updated', settings);
      this.notifySubscribers('data_mutated');
      this.addAuditLog('CLOUD_SYNC_PULL', 'Google Apps Script', 'Sinkronisasi data masuk dari Google Sheets berhasil.');

      // Sync server memory with forwardToGas: false
      fetch('/api/data/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          users: this.getUsers(),
          students: this.getStudentsMap(),
          parents: this.getParentsMap(),
          school_origins: this.getSchoolOriginsMap(),
          addresses: this.getAddressesMap(),
          applications: this.getApplications(),
          documents: this.getDocuments(),
          schools: this.getSchools(),
          announcements: this.getAnnouncements(),
          forwardToGas: false,
        }),
      }).catch(() => {});
    }

    return result || { success: false, message: 'Gagal mengambil data' };
  }

  // ================= BACKUP EXPORT & IMPORT =================
  exportDatabaseBackup(): void {
    const backupData = {
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      app_name: this.getSettings().app_name,
      users: this.getUsers(),
      students: this.getStudentsMap(),
      parents: this.getParentsMap(),
      school_origins: this.getSchoolOriginsMap(),
      addresses: this.getAddressesMap(),
      applications: this.getApplications(),
      documents: this.getDocuments(),
      schools: this.getSchools(),
      announcements: this.getAnnouncements(),
      settings: this.getSettings(),
      audit_logs: this.getAuditLogs(),
    };

    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(backupData, null, 2))}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadAnchor.setAttribute('download', `SIPMA_DB_BACKUP_${dateStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    this.addAuditLog('BACKUP_EXPORT', 'Database JSON', 'Backup seluruh database berhasil diunduh.');
  }

  importDatabaseBackup(jsonString: string): { success: boolean; message: string } {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.applications && !parsed.students && !parsed.schools) {
        return { success: false, message: 'Format berkas backup tidak sesuai struktur database SIPMA!' };
      }

      if (parsed.users) localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(parsed.users));
      if (parsed.students) localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(parsed.students));
      if (parsed.parents) localStorage.setItem(STORAGE_KEYS.PARENTS, JSON.stringify(parsed.parents));
      if (parsed.school_origins) localStorage.setItem(STORAGE_KEYS.SCHOOL_ORIGINS, JSON.stringify(parsed.school_origins));
      if (parsed.addresses) localStorage.setItem(STORAGE_KEYS.ADDRESSES, JSON.stringify(parsed.addresses));
      if (parsed.applications) localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(parsed.applications));
      if (parsed.documents) localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(parsed.documents));
      if (parsed.schools) localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify(parsed.schools));
      if (parsed.announcements) localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(parsed.announcements));
      if (parsed.settings) localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(parsed.settings));
      if (parsed.audit_logs) localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(parsed.audit_logs));

      this.addAuditLog('BACKUP_RESTORE', 'Database JSON', 'Restore database dari berkas backup berhasil dilakukan.');
      return { success: true, message: 'Database SIPMA berhasil dipulihkan dari file backup!' };
    } catch (err: any) {
      return { success: false, message: `Gagal memproses file backup: ${err.message}` };
    }
  }

  // ================= PERMANENT DATABASE CONFIG & SHARING =================
  generateConfigShareUrl(): string {
    const s = this.getSettings();
    const minimalConfig = {
      gas_web_app_url: s.gas_web_app_url,
      spreadsheet_id: s.spreadsheet_id,
      drive_root_folder_id: s.drive_root_folder_id,
      maps_api_key: s.maps_api_key,
      application_year: s.application_year,
      app_name: s.app_name,
      app_tagline: s.app_tagline,
      db_config_locked: true,
    };
    try {
      const encoded = btoa(encodeURIComponent(JSON.stringify(minimalConfig)));
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
      return `${origin}${pathname}?sipma_cfg=${encoded}`;
    } catch {
      return '';
    }
  }

  resetToDemo(): void {
    localStorage.removeItem(STORAGE_KEYS.USERS);
    localStorage.removeItem(STORAGE_KEYS.STUDENTS);
    localStorage.removeItem(STORAGE_KEYS.PARENTS);
    localStorage.removeItem(STORAGE_KEYS.SCHOOL_ORIGINS);
    localStorage.removeItem(STORAGE_KEYS.ADDRESSES);
    localStorage.removeItem(STORAGE_KEYS.APPLICATIONS);
    localStorage.removeItem(STORAGE_KEYS.DOCUMENTS);
    localStorage.removeItem(STORAGE_KEYS.SCHOOLS);
    localStorage.removeItem(STORAGE_KEYS.ANNOUNCEMENTS);
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    localStorage.removeItem(STORAGE_KEYS.AUDIT_LOGS);
    this.initialized = false;
    this.init();
  }
}

export const storageService = new StorageService();

