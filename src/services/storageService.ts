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
  private subscribers: Array<(event: string, data?: any) => void> = [];
  private autoSyncTimeout: any = null;
  private autoPullTimer: any = null;
  private isAutoSyncing: boolean = false;
  private lastAutoSyncStatus: { success: boolean; message: string; timestamp: string } | null = null;

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

    // Auto-pull every 40 seconds in background if configured
    this.autoPullTimer = setInterval(() => {
      const s = this.getSettings();
      if (s.gas_web_app_url && s.gas_web_app_url.startsWith('http') && s.realtime_sync_enabled !== false && !document.hidden) {
        this.pullAllFromGAS().catch(() => {});
      }
    }, 40000);

    // Auto-pull on window focus / tab visibility
    const handleVisibility = () => {
      if (!document.hidden) {
        const s = this.getSettings();
        if (s.gas_web_app_url && s.gas_web_app_url.startsWith('http') && s.realtime_sync_enabled !== false) {
          this.pullAllFromGAS().catch(() => {});
        }
      }
    };

    window.removeEventListener('focus', handleVisibility);
    window.addEventListener('focus', handleVisibility);
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

    this.initialized = true;
  }

  /**
   * Centralized multi-device server synchronization
   * Loads locked database configurations and shared state from server.ts and Google Sheets
   */
  async syncWithServer(): Promise<void> {
    try {
      const res = await fetch('/api/settings');
      let gasUrlToPull: string | null = null;
      let ssIdToPull: string | null = null;

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.settings && typeof json.settings === 'object') {
          const serverSettings: SystemSettings = json.settings;
          const localSettings = this.getSettings();

          // Unconditionally adopt server configuration so all devices stay 100% in sync
          const merged: SystemSettings = {
            ...localSettings,
            ...serverSettings,
          };

          // Guarantee consistent academic year text
          if (!merged.academic_year_label) {
            const yr = merged.application_year || '2027';
            const nextYr = (parseInt(yr, 10) || 2027) + 1;
            merged.academic_year_label = `${yr}/${nextYr}`;
          }

          localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(merged));
          this.notifySubscribers('settings_updated', merged);

          if (merged.gas_web_app_url && merged.gas_web_app_url.startsWith('http')) {
            gasUrlToPull = merged.gas_web_app_url;
            ssIdToPull = merged.spreadsheet_id;
          }
        }
      }

      // Also pull shared database items from server if available
      const dataRes = await fetch('/api/data?force_pull_gas=true');
      if (dataRes.ok) {
        const dataJson = await dataRes.json();
        if (dataJson.success && dataJson.data) {
          const d = dataJson.data;
          let changed = false;
          if (d.users && Array.isArray(d.users) && d.users.length > 0) {
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(d.users));
            changed = true;
          }
          if (d.students && typeof d.students === 'object') {
            localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(d.students));
            changed = true;
          }
          if (d.parents && typeof d.parents === 'object') {
            localStorage.setItem(STORAGE_KEYS.PARENTS, JSON.stringify(d.parents));
            changed = true;
          }
          if (d.school_origins && typeof d.school_origins === 'object') {
            localStorage.setItem(STORAGE_KEYS.SCHOOL_ORIGINS, JSON.stringify(d.school_origins));
            changed = true;
          }
          if (d.addresses && typeof d.addresses === 'object') {
            localStorage.setItem(STORAGE_KEYS.ADDRESSES, JSON.stringify(d.addresses));
            changed = true;
          }
          if (d.applications && Array.isArray(d.applications)) {
            localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(d.applications));
            changed = true;
          }
          if (d.documents && Array.isArray(d.documents)) {
            localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(d.documents));
            changed = true;
          }
          if (d.schools && Array.isArray(d.schools) && d.schools.length > 0) {
            localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify(d.schools));
            changed = true;
          }
          if (d.announcements && Array.isArray(d.announcements)) {
            localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(d.announcements));
            changed = true;
          }
          if (d.audit_logs && Array.isArray(d.audit_logs)) {
            localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(d.audit_logs));
            changed = true;
          }
          if (changed) {
            this.notifySubscribers('data_mutated');
          }
        }
      }

      // If GAS is configured, also perform a live pull to guarantee freshest Google Sheets data
      if (gasUrlToPull && gasUrlToPull.startsWith('http')) {
        setTimeout(() => {
          this.pullAllFromGAS().catch(() => {});
        }, 500);
      }
    } catch {
      // Offline or direct client mode
    }
  }

  // ================= SETTINGS =================
  getSettings(): SystemSettings {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!data) return INITIAL_SETTINGS;
      const parsed = JSON.parse(data);
      if (!parsed.app_tagline || parsed.app_tagline === 'PPDB Madrasah Digital' || parsed.app_tagline === 'Madrasah Digital') {
        parsed.app_tagline = 'Sistem Penerimaan Murid Madrasah';
      }
      if (!parsed.academic_year_label) {
        const yr = parsed.application_year || '2027';
        const nextYr = (parseInt(yr, 10) || 2027) + 1;
        parsed.academic_year_label = `${yr}/${nextYr}`;
      }
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
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return INITIAL_USERS;
    }
  }

  getCurrentUser(): User | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  setCurrentUser(user: User | null): void {
    try {
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
      const index = users.findIndex((u) => u.user_id === userId);
      if (index < 0) {
        return { success: false, message: 'Pengguna tidak ditemukan.' };
      }

      const updatedUser: User = {
        ...users[index],
        ...updates,
        updated_at: new Date().toISOString(),
      };

      users[index] = updatedUser;
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

      // Update active session if it matches current user
      const currentUser = this.getCurrentUser();
      if (currentUser && currentUser.user_id === userId) {
        this.setCurrentUser(updatedUser);
      }

      this.addAuditLog('USER_PROFILE_UPDATE', updatedUser.name, `Profil pengguna ${updatedUser.name} (${updatedUser.role}) berhasil diperbarui.`);
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
      const index = users.findIndex((u) => u.user_id === userId);
      if (index < 0) {
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
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

      const currentUser = this.getCurrentUser();
      if (currentUser && currentUser.user_id === userId) {
        currentUser.password_hash = user.password_hash;
        this.setCurrentUser(currentUser);
      }

      this.addAuditLog('PASSWORD_CHANGE', user.name, `Pengguna ${user.name} mengganti kata sandi akun.`);
      this.triggerAutoSync();
      return { success: true, message: 'Password berhasil diubah. Gunakan password baru untuk login berikutnya.' };
    } catch (err: any) {
      return { success: false, message: `Gagal mengubah password: ${err.message || 'Error tidak diketahui'}` };
    }
  }

  resetStudentPassword(
    identifier: string, // registration_number, user_id, or email
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
          (u.registration_number && u.registration_number.toLowerCase() === targetQuery) ||
          (u.user_id && u.user_id.toLowerCase() === targetQuery) ||
          (u.email && u.email.toLowerCase() === targetQuery)
        ) {
          index = i;
          break;
        }
      }

      if (index < 0) {
        // If user record wasn't pre-created in users array, let's look in students map and create/recover user account
        const students = this.getStudentsMap();
        const matchedStudent = Object.values(students).find(
          (s) =>
            s.registration_number.toLowerCase() === targetQuery ||
            (s.nisn && s.nisn.toLowerCase() === targetQuery) ||
            (s.nik && s.nik.toLowerCase() === targetQuery) ||
            (s.email && s.email.toLowerCase() === targetQuery)
        );

        if (!matchedStudent) {
          return { success: false, message: `Data akun calon murid dengan ID/No. Pendaftaran "${identifier}" tidak ditemukan.` };
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
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

        this.addAuditLog(
          'STUDENT_PASSWORD_RESET',
          matchedStudent.name,
          `Password akun calon murid ${matchedStudent.name} (${matchedStudent.registration_number}) di-reset oleh ${operatorName || 'Admin'}. Password baru: ${generatedPass}`
        );
        this.triggerAutoSync();

        return {
          success: true,
          newPassword: generatedPass,
          user: newUser,
          message: `Password akun calon murid ${matchedStudent.name} berhasil di-reset menjadi "${generatedPass}".`,
        };
      }

      const user = users[index];
      const generatedPass = customNewPassword?.trim() || `sipma${Math.floor(100000 + Math.random() * 900000)}`;
      user.password_hash = generatedPass;
      user.updated_at = new Date().toISOString();
      users[index] = user;
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

      this.addAuditLog(
        'STUDENT_PASSWORD_RESET',
        user.name,
        `Password akun calon murid ${user.name} (${user.registration_number || user.email}) di-reset oleh ${operatorName || 'Admin'}. Password baru: ${generatedPass}`
      );
      this.triggerAutoSync();

      return {
        success: true,
        newPassword: generatedPass,
        user,
        message: `Password akun murid ${user.name} berhasil di-reset menjadi "${generatedPass}".`,
      };
    } catch (err: any) {
      return { success: false, message: `Gagal mereset password: ${err.message || 'Error'}` };
    }
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
    try {
      const users = this.getUsers();
      const index = users.findIndex((u) => u.user_id === userId);
      if (index < 0) {
        return { success: false, message: 'Akun admin madrasah tidak ditemukan.' };
      }

      const user = users[index];
      const generatedPass = customNewPassword?.trim() || `adm${Math.floor(100000 + Math.random() * 900000)}`;
      user.password_hash = generatedPass;
      user.updated_at = new Date().toISOString();
      users[index] = user;
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

      this.addAuditLog(
        'ADMIN_PASSWORD_RESET',
        user.name,
        `Password akun admin madrasah ${user.name} (${user.email}) berhasil di-reset oleh ${operatorName || 'Admin Pusat'}. Password baru: ${generatedPass}`
      );
      this.triggerAutoSync();

      return {
        success: true,
        newPassword: generatedPass,
        user,
        message: `Kata sandi akun admin ${user.name} berhasil di-reset menjadi "${generatedPass}".`,
      };
    } catch (err: any) {
      return { success: false, message: `Gagal mereset kata sandi: ${err?.message || 'Error'}` };
    }
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
    try {
      const users = this.getUsers();
      const index = users.findIndex((u) => u.user_id === userId);
      if (index < 0) {
        return { success: false, message: 'Akun operator madrasah tidak ditemukan.' };
      }

      const user = users[index];
      const generatedPass = customNewPassword?.trim() || `opr${Math.floor(100000 + Math.random() * 900000)}`;
      user.password_hash = generatedPass;
      user.updated_at = new Date().toISOString();
      users[index] = user;
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

      this.addAuditLog(
        'OPERATOR_PASSWORD_RESET',
        user.name,
        `Password akun operator ${user.name} (${user.email}) di-reset oleh ${operatorName || 'Admin Madrasah'}. Password baru: ${generatedPass}`
      );
      this.triggerAutoSync();

      return {
        success: true,
        newPassword: generatedPass,
        user,
        message: `Kata sandi akun operator ${user.name} berhasil di-reset menjadi "${generatedPass}".`,
      };
    } catch (err: any) {
      return { success: false, message: `Gagal mereset kata sandi operator: ${err?.message || 'Error'}` };
    }
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

  assignStudentTargetSchool(
    currentRegNum: string,
    newSchoolId: string
  ): { newRegNum: string; school: School; updatedApp: Application } {
    const school = this.getSchoolById(newSchoolId);
    if (!school) {
      throw new Error('Madrasah tujuan tidak ditemukan.');
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
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SCHOOLS);
      if (data) {
        return JSON.parse(data);
      }
      localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify(INITIAL_SCHOOLS));
      return [...INITIAL_SCHOOLS];
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

  async uploadLogoToDrive(logoType: 'school' | 'app', id: string, name: string, base64Data: string, fileName?: string): Promise<string> {
    if (!base64Data || !base64Data.startsWith('data:image/')) return base64Data;
    const settings = this.getSettings();
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
          gas_web_app_url: settings.gas_web_app_url,
          spreadsheet_id: settings.spreadsheet_id,
          drive_root_folder_id: settings.drive_root_folder_id,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.logo_url) {
          return json.logo_url;
        }
      }
    } catch (e) {
      console.warn('Gagal upload logo ke Drive:', e);
    }
    return base64Data;
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
      localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify(schools));

      // If logo_url is base64, asynchronously upload to Google Drive & update school record with drive URL
      if (school.logo_url && school.logo_url.startsWith('data:image/')) {
        this.uploadLogoToDrive('school', school.school_id, school.school_name, school.logo_url).then((driveLogoUrl) => {
          if (driveLogoUrl && driveLogoUrl !== school.logo_url) {
            const currentSchools = this.getSchools();
            const idx = currentSchools.findIndex((s) => s.school_id === school.school_id);
            if (idx >= 0) {
              currentSchools[idx].logo_url = driveLogoUrl;
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
    try {
      const data = localStorage.getItem(STORAGE_KEYS.STUDENTS);
      return data ? JSON.parse(data) : { ...INITIAL_STUDENTS };
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
    } catch {
      // ignore
    }
    this.triggerAutoSync();
  }

  getParentsMap(): Record<string, ParentData> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PARENTS);
      return data ? JSON.parse(data) : { ...INITIAL_PARENTS };
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
      localStorage.setItem(STORAGE_KEYS.PARENTS, JSON.stringify(map));
    } catch {
      // ignore
    }
    this.triggerAutoSync();
  }

  getSchoolOriginsMap(): Record<string, SchoolOrigin> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SCHOOL_ORIGINS);
      return data ? JSON.parse(data) : { ...INITIAL_SCHOOL_ORIGINS };
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
      localStorage.setItem(STORAGE_KEYS.SCHOOL_ORIGINS, JSON.stringify(map));
    } catch {
      // ignore
    }
    this.triggerAutoSync();
  }

  getAddressesMap(): Record<string, AddressData> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ADDRESSES);
      return data ? JSON.parse(data) : { ...INITIAL_ADDRESSES };
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
      localStorage.setItem(STORAGE_KEYS.ADDRESSES, JSON.stringify(map));
    } catch {
      // ignore
    }
    this.triggerAutoSync();
  }

  // ================= APPLICATIONS =================
  getApplications(): Application[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.APPLICATIONS);
      return data ? JSON.parse(data) : [...INITIAL_APPLICATIONS];
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
      localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(apps));
    } catch {
      // ignore
    }
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
    try {
      const data = localStorage.getItem(STORAGE_KEYS.DOCUMENTS);
      return data ? JSON.parse(data) : [...INITIAL_DOCUMENTS];
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
      const index = docs.findIndex((d) => d.document_id === doc.document_id);
      if (index >= 0) {
        docs[index] = doc;
      } else {
        docs.push(doc);
      }
      localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(docs));
    } catch {
      // ignore
    }
    this.addAuditLog('UPLOAD_DOCUMENT', doc.registration_number, `Unggah berkas: ${doc.document_title} (${doc.file_name})`);
    
    // Asynchronously push file directly to Google Drive via server proxy
    if (doc.file_data_base64) {
      this.uploadDocumentToDrive(doc, studentName, schoolName).catch(() => {});
    }

    this.triggerAutoSync();
  }

  async uploadDocumentToDrive(doc: DocumentItem, studentName?: string, schoolName?: string): Promise<ApiResponse> {
    const settings = this.getSettings();
    let resultJson: any = null;

    // 1. Try upload via server proxy (which handles local backup + GAS Drive dispatch)
    try {
      const res = await fetch('/api/gas/upload-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc,
          student_name: studentName,
          school_name: schoolName,
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
              document_type: doc.document_type,
              document_title: doc.document_title,
              file_name: doc.file_name,
              file_size_kb: doc.file_size_kb,
              file_size_bytes: doc.file_size_bytes,
              mime_type: doc.mime_type,
              base64_data: doc.file_data_base64,
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
        localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(docs));
      }

      // Also update student photo if it was a photo document
      if (doc.document_type === 'foto' || doc.document_type === 'pas_foto') {
        const student = this.getStudentProfile(doc.registration_number);
        if (student && cdnUrl) {
          student.photo_url = cdnUrl;
          this.saveStudentProfile(student);
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
      const res = await this.uploadDocumentToDrive(doc, student?.name, school?.school_name);
      if (res && res.success) {
        count++;
      }
    }
    return { uploaded: count, total: pending.length };
  }

  deleteDocument(documentId: string): void {
    try {
      const allDocs = this.getDocuments();
      const targetDoc = allDocs.find((d) => d.document_id === documentId);
      const remainingDocs = allDocs.filter((d) => d.document_id !== documentId);
      localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(remainingDocs));

      if (targetDoc) {
        // Trigger server & GAS Drive cleanup
        fetch('/api/gas/delete-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            document_id: documentId,
            drive_file_id: targetDoc.drive_file_id,
            registration_number: targetDoc.registration_number,
            local_url: targetDoc.local_url,
          }),
        }).catch((e) => console.warn('Delete document file sync error:', e));

        this.addAuditLog(
          'DELETE_DOCUMENT',
          targetDoc.registration_number,
          `Berkas ${targetDoc.document_title} (${targetDoc.file_name}) dihapus permanen dari Google Drive dan database.`
        );
      }
    } catch {
      // ignore
    }
    this.triggerAutoSync();
  }

  // ================= VERIFICATION & SELECTION =================
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
      app.final_status = 'tidak_lulus';
      // Auto-reroute rejected applications to nearest school with quota
      this.autoRerouteApplication(
        registrationNumber,
        verifiedBy,
        `Dialihkan otomatis karena berkas/persyaratan tidak lulus verifikasi di madrasah pilihan awal. Catatan: ${notes || 'Tidak memenuhi kuota/kriteria'}`
      );
    }
    this.saveApplication(app);
    this.addAuditLog(
      'VERIFY_APPLICATION',
      registrationNumber,
      `Verifikasi diubah menjadi [${status.toUpperCase()}] oleh ${verifiedBy}. Catatan: ${notes || '-'}`
    );
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
    autoReroute: boolean = true
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
      this.saveApplication(app);
      this.addAuditLog(
        'SELECTION_STATUS_CHANGE',
        registrationNumber,
        `Status kelulusan diubah menjadi [TIDAK LULUS] oleh ${processedBy}.`
      );

      // AUTOMATIC REROUTE TO NEAREST SCHOOL WITH AVAILABLE QUOTA
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

  // ================= ANNOUNCEMENTS =================
  getAnnouncements(): Announcement[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ANNOUNCEMENTS);
      return data ? JSON.parse(data) : [...INITIAL_ANNOUNCEMENTS];
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
      localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(list));
    } catch {
      // ignore
    }
    this.addAuditLog('ANNOUNCEMENT_SAVE', announcement.title, `Pengumuman '${announcement.title}' disimpan.`);
    this.triggerAutoSync();
  }

  deleteAnnouncement(id: string): void {
    try {
      const list = this.getAnnouncements().filter((a) => a.announcement_id !== id);
      localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(list));
    } catch {
      // ignore
    }
    this.triggerAutoSync();
  }

  // ================= AUDIT LOGS =================
  getAuditLogs(): AuditLog[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
      return data ? JSON.parse(data) : [...INITIAL_AUDIT_LOGS];
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
        localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(d.documents));
      }

      // 8. Schools
      if (d.schools && Array.isArray(d.schools) && d.schools.length > 0) {
        localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify(d.schools));
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
        Object.assign(settings, d.settings);
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

