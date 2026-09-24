import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import compression from 'compression';
import { fileURLToPath } from 'url';

const currentDir = typeof __dirname !== 'undefined'
  ? __dirname
  : (typeof import.meta !== 'undefined' && import.meta.url ? path.dirname(fileURLToPath(import.meta.url)) : process.cwd());

const app = express();

const portArgIdx = process.argv.indexOf('--port');
const cliPort = portArgIdx !== -1 && process.argv[portArgIdx + 1] ? parseInt(process.argv[portArgIdx + 1], 10) : NaN;
const PORT = !isNaN(cliPort) ? cliPort : parseInt(process.env.PORT || '3000', 10);

const hostArgIdx = process.argv.indexOf('--host');
const cliHost = hostArgIdx !== -1 && process.argv[hostArgIdx + 1] ? process.argv[hostArgIdx + 1] : undefined;
const HOST = cliHost || process.env.HOST || '0.0.0.0';

// High-performance gzip/deflate compression for all API and static responses (> 1KB)
app.use(
  compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      // Never compress Server-Sent Events stream or image binaries already compressed
      if (req.headers.accept === 'text/event-stream' || req.path.startsWith('/api/data/events')) {
        return false;
      }
      return compression.filter(req, res);
    },
  })
);

// Determine environment
const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NOW_REGION);
const DATA_DIR = isVercel ? path.join(os.tmpdir(), 'sipma_data') : path.join(process.cwd(), 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'server_db.json');

// Process-level safety guards to prevent unexpected exit under load
process.on('uncaughtException', (err) => {
  console.error('[SIPMA Server] Uncaught exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[SIPMA Server] Unhandled rejection at:', promise, 'reason:', reason);
});

// Enable JSON body parsing with large limit for base64 documents (up to 30MB)
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Ensure data & upload directories exist
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
} catch (dirErr) {
  console.warn('[SIPMA Server] Directory creation notice:', dirErr);
}

// Serve static uploads with aggressive HTTP cache (max-age 1 year, immutable)
app.use(
  '/uploads',
  express.static(UPLOAD_DIR, {
    maxAge: 31536000000,
    immutable: true,
    etag: true,
    lastModified: true,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    },
  })
);

// High-speed bounded in-memory RAM cache for images with LRU memory eviction
interface MemoryImageItem {
  buffer: Buffer;
  contentType: string;
  etag: string;
}
const MAX_MEMORY_CACHE_ITEMS = 120;
const MAX_MEMORY_CACHE_BYTES = 45 * 1024 * 1024; // 45 MB max memory
let currentMemoryCacheBytes = 0;
const memoryImageCache = new Map<string, MemoryImageItem>();

export function setMemoryImageCache(key: string, item: MemoryImageItem): void {
  const existing = memoryImageCache.get(key);
  if (existing) {
    currentMemoryCacheBytes -= existing.buffer.length;
  }

  while (
    (memoryImageCache.size >= MAX_MEMORY_CACHE_ITEMS ||
      currentMemoryCacheBytes + item.buffer.length > MAX_MEMORY_CACHE_BYTES) &&
    memoryImageCache.size > 0
  ) {
    const oldestKey = memoryImageCache.keys().next().value;
    if (!oldestKey) break;
    const removed = memoryImageCache.get(oldestKey);
    if (removed) {
      currentMemoryCacheBytes -= removed.buffer.length;
    }
    memoryImageCache.delete(oldestKey);
  }

  memoryImageCache.set(key, item);
  currentMemoryCacheBytes += item.buffer.length;
}

// In-Memory & File-Backed Persistent Database for Centralized Multi-Device Sync
interface ServerDbState {
  settings: Record<string, any>;
  users: any[];
  students: Record<string, any>;
  parents: Record<string, any>;
  school_origins: Record<string, any>;
  addresses: Record<string, any>;
  applications: any[];
  documents: any[];
  schools: any[];
  announcements: any[];
  audit_logs: any[];
  last_updated: string;
}

function loadInitialServerDb(): ServerDbState {
  const candidatePaths = [
    DB_FILE,
    path.join(process.cwd(), 'data', 'server_db.json'),
    path.join(currentDir, '..', 'data', 'server_db.json'),
    path.join(currentDir, 'data', 'server_db.json'),
    path.join('/var/task', 'data', 'server_db.json'),
  ];
  let targetFile: string | null = null;
  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) {
        targetFile = p;
        break;
      }
    } catch {}
  }
  if (targetFile) {
    try {
      const raw = fs.readFileSync(targetFile, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (parsed.settings?.app_logo === 'https://cdn.phototourl.com/free/2026-09-01-6c787787-6585-4830-b0a6-9bfab3f1dba4.png') {
          parsed.settings.app_logo = '';
        }
        return parsed;
      }
    } catch (err) {
      console.error('Error loading initial server_db.json:', err);
    }
  }

  // Default server settings with environment variable fallbacks
  const envGas = process.env.VITE_GAS_WEB_APP_URL || process.env.GAS_WEB_APP_URL || '';
  const envSs = process.env.VITE_SPREADSHEET_ID || process.env.SPREADSHEET_ID || '';
  const envDrive = process.env.VITE_DRIVE_ROOT_FOLDER_ID || process.env.DRIVE_ROOT_FOLDER_ID || '';
  const envMaps = process.env.VITE_MAPS_API_KEY || process.env.MAPS_API_KEY || '';

  const initialSettings = {
    spreadsheet_id: envSs || '1n1nNgm4eW0O7bSyWv7TF5tVPr38yFU81x50MGUFD5i4',
    drive_root_folder_id: envDrive || '14tpMbwj63kVA8j378LD0NYzJ2_UqNuO1',
    gas_web_app_url: envGas || 'https://script.google.com/macros/s/AKfycbyLB706ICQ9EK77ihqcpUu0nKGUVM2AuZLueY0KhDY-mt1nndP51SFf3kikcraCA65a2Q/exec',
    maps_api_key: envMaps || 'AIzaSyC2V4lt0ZSPo5G8shUpRuiBys5udgSVQ3k',
    application_year: 2027,
    academic_year_label: '2027/2028',
    app_name: 'SIPMA',
    app_tagline: 'Sistem Penerimaan Murid Madrasah',
    app_logo: '',
    default_school_id: 'SCH-NEW-1787905953621',
    max_file_size_mb: 2,
    registration_open: true,
    announcement_open: true,
    db_config_locked: true,
    db_config_pin: 123456,
    realtime_sync_enabled: true,
    auto_sync_interval_sec: 15,
  };

  return {
    settings: initialSettings,
    users: [],
    students: {},
    parents: {},
    school_origins: {},
    addresses: {},
    applications: [],
    documents: [],
    schools: [],
    announcements: [],
    audit_logs: [],
    last_updated: new Date().toISOString(),
  };
}

let serverDb: ServerDbState = loadInitialServerDb();

function warmUpImageCache() {
  try {
    if (serverDb.settings?.app_logo && serverDb.settings.app_logo.startsWith('data:image/')) {
      const raw = serverDb.settings.app_logo;
      const matches = raw.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches) {
        setMemoryImageCache('app_logo', { buffer: Buffer.from(matches[2], 'base64'), contentType: matches[1], etag: '"app_logo"' });
      }
    }
    if (serverDb.schools && Array.isArray(serverDb.schools)) {
      for (const s of serverDb.schools) {
        if (s.logo_url && s.logo_url.startsWith('data:image/')) {
          const raw = s.logo_url;
          const matches = raw.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (matches) {
            setMemoryImageCache(`school_${s.school_id}`, { buffer: Buffer.from(matches[2], 'base64'), contentType: matches[1], etag: `"${s.school_id}"` });
          }
        }
      }
    }
    if (fs.existsSync(UPLOAD_DIR)) {
      const files = fs.readdirSync(UPLOAD_DIR);
      let count = 0;
      for (const f of files) {
        if (count > 50) break; // Limit startup preload to top 50 images to conserve RAM
        if (f.startsWith('cache_drive_') && f.endsWith('.jpg')) {
          const fileId = f.replace('cache_drive_', '').replace('.jpg', '');
          try {
            const buf = fs.readFileSync(path.join(UPLOAD_DIR, f));
            setMemoryImageCache(fileId, { buffer: buf, contentType: 'image/jpeg', etag: `"${fileId}"` });
            count++;
          } catch {}
        }
      }
    }
  } catch {}
}

warmUpImageCache();

// Active Server-Sent Events (SSE) clients for instant real-time synchronization (< 50ms)
const sseClients: Response[] = [];
const MAX_SSE_CLIENTS = 1200;

export function broadcastServerDbChange(reason: string = 'data_changed') {
  if (sseClients.length === 0) return;
  const payload = JSON.stringify({
    type: 'mutation',
    reason,
    timestamp: serverDb.last_updated,
  });
  const chunk = `data: ${payload}\n\n`;

  for (let i = sseClients.length - 1; i >= 0; i--) {
    const client = sseClients[i];
    try {
      if (client.writable && !client.destroyed) {
        client.write(chunk);
      } else {
        sseClients.splice(i, 1);
      }
    } catch {
      sseClients.splice(i, 1);
    }
  }
}

// Auto-enrich schools with official contact email & phone to guarantee correct sender identity
function enrichServerDbSchools() {
  try {
    if (!serverDb.schools || !Array.isArray(serverDb.schools)) return;
    let mutated = false;
    for (const sch of serverDb.schools) {
      if (!sch.contact_email || sch.contact_email.trim() === '') {
        const schAdmin = serverDb.users?.find((u: any) =>
          u.school_id === sch.school_id && (u.role === 'admin_sekolah' || u.role === 'operator_sekolah')
        );
        if (schAdmin?.email) {
          sch.contact_email = schAdmin.email;
          mutated = true;
        } else if (sch.school_code === 'MI02' || sch.school_name?.includes("ASY-SYAFI'IYYAH 02")) {
          sch.contact_email = 'mi02jatibarang.brebes@gmail.com';
          mutated = true;
        }
      }
      if (!sch.contact_phone || sch.contact_phone.trim() === '') {
        const schAdmin = serverDb.users?.find((u: any) =>
          u.school_id === sch.school_id && (u.role === 'admin_sekolah' || u.role === 'operator_sekolah')
        );
        if (schAdmin?.phone) {
          sch.contact_phone = String(schAdmin.phone);
          mutated = true;
        } else if (sch.school_code === 'MI02' || sch.school_name?.includes("ASY-SYAFI'IYYAH 02")) {
          sch.contact_phone = '08988857555';
          mutated = true;
        }
      }
    }
    if (mutated) {
      persistServerDb(false);
    }
  } catch {}
}

enrichServerDbSchools();

// High-Concurrency Non-Blocking Asynchronous Atomic DB Writer
let dbWriteTimer: NodeJS.Timeout | null = null;
let isWritingDb = false;
let pendingDbWrite = false;

async function executeDbWriteAsync() {
  if (isWritingDb) {
    pendingDbWrite = true;
    return;
  }
  isWritingDb = true;
  pendingDbWrite = false;

  try {
    const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
    const minifiedJson = JSON.stringify(serverDb); // Minified JSON reduces CPU serialize time & disk I/O by ~40%
    await fs.promises.writeFile(tmpFile, minifiedJson, 'utf-8');
    await fs.promises.rename(tmpFile, DB_FILE);
  } catch (err) {
    console.error('[SIPMA Server] Non-blocking DB write error:', err);
  } finally {
    isWritingDb = false;
    if (pendingDbWrite) {
      pendingDbWrite = false;
      scheduleDbWrite(50);
    }
  }
}

function scheduleDbWrite(delayMs = 150) {
  if (dbWriteTimer) {
    clearTimeout(dbWriteTimer);
  }
  dbWriteTimer = setTimeout(() => {
    dbWriteTimer = null;
    executeDbWriteAsync().catch(() => {});
  }, delayMs);
}

// Synchronous emergency flush used on process termination to ensure zero data loss
export function flushServerDbSync() {
  try {
    if (dbWriteTimer) {
      clearTimeout(dbWriteTimer);
      dbWriteTimer = null;
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(serverDb), 'utf-8');
  } catch (err) {
    console.error('[SIPMA Server] Emergency sync flush error:', err);
  }
}

export function persistServerDb(broadcast: boolean = true) {
  serverDb.last_updated = new Date().toISOString();
  if (isVercel) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(serverDb), 'utf-8');
    } catch {}
  } else {
    scheduleDbWrite(150);
  }
  if (broadcast) {
    broadcastServerDbChange();
  }
}

// Safe JSON parser for responses from Google Apps Script to prevent SyntaxError on HTML responses
async function parseGasJsonResponse(response: any): Promise<{ isJson: boolean; data: any; rawText: string; isHtml: boolean }> {
  try {
    const text = await response.text();
    const isHtml = text.trim().startsWith('<') || text.includes('<!DOCTYPE') || text.includes('<html');
    if (isHtml) {
      return { isJson: false, data: null, rawText: text, isHtml: true };
    }
    const json = JSON.parse(text);
    return { isJson: true, data: json, rawText: text, isHtml: false };
  } catch {
    return { isJson: false, data: null, rawText: '', isHtml: false };
  }
}

// Helper function to pull full database directly from Google Apps Script
async function pullDataFromGasDirectly(gasUrl: string, spreadsheetId: string): Promise<{ success: boolean; data?: any; message?: string }> {
  if (!gasUrl || !gasUrl.startsWith('http')) {
    return { success: false, message: 'URL Google Apps Script tidak valid.' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 18000);

    // Try POST with action=pullAllData first
    const postRes = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'pullAllData',
        spreadsheet_id: spreadsheetId,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (postRes.ok) {
      const parsed = await parseGasJsonResponse(postRes);
      if (parsed.isJson && parsed.data && parsed.data.success && parsed.data.data) {
        return { success: true, data: parsed.data.data, message: parsed.data.message };
      }
    }

    // Fallback to GET with query params
    const getUrl = `${gasUrl}?action=pullAllData&spreadsheet_id=${encodeURIComponent(spreadsheetId)}`;
    const getRes = await fetch(getUrl, { signal: AbortSignal.timeout(15000) });
    if (getRes.ok) {
      const parsed = await parseGasJsonResponse(getRes);
      if (parsed.isJson && parsed.data && parsed.data.success && parsed.data.data) {
        return { success: true, data: parsed.data.data, message: parsed.data.message };
      }
    }

    return { success: false, message: 'Google Apps Script tidak mengembalikan data valid (kemungkinan respons HTML/izin akses).' };
  } catch (err: any) {
    return { success: false, message: `Gagal menarik data dari GAS: ${err?.message || 'Timeout / Network Error'}` };
  }
}

const DEMO_STUDENT_IDS = new Set(['STD-001', 'STD-002', 'STD-003', 'STD-004', 'STD-005', 'STD-006']);
const DEMO_REG_PREFIX = 'SIPMA-MAN01-00000';

function isDemoStudentRecord(regOrKey: string, stdId?: string): boolean {
  if (regOrKey && typeof regOrKey === 'string' && regOrKey.startsWith(DEMO_REG_PREFIX)) return true;
  if (stdId && DEMO_STUDENT_IDS.has(stdId) && (!regOrKey || regOrKey.startsWith(DEMO_REG_PREFIX))) return true;
  return false;
}

// Function to update serverDb from pulled GAS data
function mergeGasDataIntoServerDb(gasData: any): boolean {
  if (!gasData || typeof gasData !== 'object') return false;
  let mutated = false;

  if (gasData.users && Array.isArray(gasData.users) && gasData.users.length > 0) {
    const existingUsers = serverDb.users || [];
    serverDb.users = gasData.users
      .filter((u: any) => u.role !== 'calon_murid' || !isDemoStudentRecord(u?.registration_number))
      .map((gu: any) => {
        const ex = existingUsers.find((eu: any) => eu.user_id === gu.user_id || eu.email === gu.email || (eu.registration_number && eu.registration_number === gu.registration_number));
        return {
          ...gu,
          // Crucial: preserve existing photo_url if GAS returns empty string
          photo_url: gu.photo_url || ex?.photo_url || '',
        };
      });
    mutated = true;
  }
  if (gasData.students && typeof gasData.students === 'object') {
    const cleanStudents: Record<string, any> = {};
    const existingStudents = serverDb.students || {};
    for (const [k, v] of Object.entries(gasData.students)) {
      if (!isDemoStudentRecord(k, (v as any)?.student_id)) {
        const ex = existingStudents[k];
        cleanStudents[k] = {
          ...(v as any),
          // Crucial: preserve existing photo_url if GAS returns empty string
          photo_url: (v as any)?.photo_url || ex?.photo_url || '',
        };
      }
    }
    serverDb.students = cleanStudents;
    mutated = true;
  }
  if (gasData.parents && typeof gasData.parents === 'object') {
    const cleanParents: Record<string, any> = {};
    for (const [k, v] of Object.entries(gasData.parents)) {
      if (!isDemoStudentRecord(k, (v as any)?.student_id)) {
        cleanParents[k] = v;
      }
    }
    serverDb.parents = cleanParents;
    mutated = true;
  }
  if (gasData.school_origins && typeof gasData.school_origins === 'object') {
    const cleanOrigins: Record<string, any> = {};
    for (const [k, v] of Object.entries(gasData.school_origins)) {
      if (!isDemoStudentRecord(k, (v as any)?.student_id)) {
        cleanOrigins[k] = v;
      }
    }
    serverDb.school_origins = cleanOrigins;
    mutated = true;
  }
  if (gasData.addresses && typeof gasData.addresses === 'object') {
    const cleanAddresses: Record<string, any> = {};
    for (const [k, v] of Object.entries(gasData.addresses)) {
      if (!isDemoStudentRecord(k, (v as any)?.student_id)) {
        cleanAddresses[k] = v;
      }
    }
    serverDb.addresses = cleanAddresses;
    mutated = true;
  }
  if (gasData.applications && Array.isArray(gasData.applications)) {
    serverDb.applications = gasData.applications.filter((a: any) => !isDemoStudentRecord(a?.registration_number, a?.student_id));
    mutated = true;
  }
  if (gasData.documents && Array.isArray(gasData.documents)) {
    const cleanGasDocs = gasData.documents.filter((d: any) => !isDemoStudentRecord(d?.registration_number, d?.student_id));
    const existingDocs = serverDb.documents || [];
    const mergedDocsMap = new Map<string, any>();

    // Seed with existing serverDb documents
    for (const ex of existingDocs) {
      const key = ex.document_id || `${ex.registration_number}_${ex.document_type}`;
      mergedDocsMap.set(key, { ...ex });
    }

    // Merge incoming GAS documents, preserving local files, base64 data, and valid drive URLs
    for (const gd of cleanGasDocs) {
      const key = gd.document_id || `${gd.registration_number}_${gd.document_type}`;
      const ex = mergedDocsMap.get(key);
      mergedDocsMap.set(key, {
        ...ex,
        ...gd,
        local_url: ex?.local_url || gd.local_url || '',
        file_data_base64: ex?.file_data_base64 || gd.file_data_base64 || '',
        drive_file_id: gd.drive_file_id || ex?.drive_file_id || '',
        drive_url: gd.drive_url || ex?.drive_url || '',
        view_url: gd.drive_url || ex?.drive_url || ex?.local_url || gd.local_url || '',
      });
    }

    serverDb.documents = Array.from(mergedDocsMap.values());
    mutated = true;
  }
  if (gasData.schools && Array.isArray(gasData.schools) && gasData.schools.length > 0) {
    const existingSchools = serverDb.schools || [];
    serverDb.schools = gasData.schools.map((gs: any) => {
      const ex = existingSchools.find((s: any) => s.school_id === gs.school_id || s.school_code === gs.school_code);
      return {
        ...gs,
        // Crucial: preserve existing logo_url if GAS returns empty string
        logo_url: gs.logo_url || ex?.logo_url || '',
      };
    });
    mutated = true;
  }
  if (gasData.announcements && Array.isArray(gasData.announcements)) {
    serverDb.announcements = gasData.announcements;
    mutated = true;
  }
  if (gasData.settings && typeof gasData.settings === 'object' && Object.keys(gasData.settings).length > 0) {
    const existingAppLogo = serverDb.settings?.app_logo || '';
    const incomingAppLogo = gasData.settings.app_logo;
    const DEPRECATED_OLD_LOGO = 'https://cdn.phototourl.com/free/2026-09-01-6c787787-6585-4830-b0a6-9bfab3f1dba4.png';
    let finalLogo = existingAppLogo;
    if (incomingAppLogo !== undefined) {
      finalLogo = incomingAppLogo;
    }
    if (finalLogo === DEPRECATED_OLD_LOGO) {
      finalLogo = '';
    }
    serverDb.settings = { 
      ...serverDb.settings, 
      ...gasData.settings,
      app_logo: finalLogo,
    };
    mutated = true;
  }

  // Referential Integrity & Cascade Deletion Sync:
  // If user deleted a student row or an application row in Google Sheets, purge orphaned applications or documents
  if (serverDb.applications && Array.isArray(serverDb.applications)) {
    const studentKeys = new Set(Object.keys(serverDb.students || {}));
    // If student list is available, remove applications whose student no longer exists in students
    if (studentKeys.size > 0) {
      const beforeLen = serverDb.applications.length;
      serverDb.applications = serverDb.applications.filter((app: any) => {
        const hasStudent = studentKeys.has(app.registration_number) || (app.student_id && studentKeys.has(app.student_id));
        return hasStudent;
      });
      if (serverDb.applications.length !== beforeLen) {
        mutated = true;
      }
    } else if (Object.keys(gasData.students || {}).length === 0 && Array.isArray(gasData.applications) && gasData.applications.length === 0) {
      // Both are empty in GAS, ensure clean
      if (serverDb.applications.length > 0) {
        serverDb.applications = [];
        mutated = true;
      }
    }
  }

  if (mutated) {
    persistServerDb();
  }
  return mutated;
}

function normalizeDocType(type: string): string {
  if (!type) return 'dokumen';
  const t = String(type).toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (t === 'kk' || t === 'kartu_keluarga') return 'kartu_keluarga';
  if (t === 'akta' || t === 'akta_kelahiran' || t === 'akta_lahir') return 'akta_kelahiran';
  if (t === 'ijazah' || t === 'skl' || t === 'ijazah_skl') return 'ijazah_skl';
  if (t === 'foto' || t === 'pas_foto' || t === 'foto_murid' || t === 'pas_foto_3x4') return 'foto';
  if (t === 'kip' || t === 'pkh' || t === 'kks' || t === 'kartu_afirmasi' || t === 'afirmasi') return 'kartu_afirmasi';
  if (t === 'dispensasi' || t === 'surat_dispensasi') return 'surat_dispensasi';
  if (t === 'prestasi' || t === 'sertifikat' || t === 'sertifikat_prestasi' || t === 'piagam') return 'sertifikat_prestasi';
  if (t === 'mutasi' || t === 'surat_mutasi' || t === 'penugasan') return 'surat_mutasi';
  if (t === 'avatar' || t === 'foto_profil') return 'foto_profil';
  if (t === 'logo_sekolah' || t === 'school_logo') return 'logo_sekolah';
  if (t === 'logo_aplikasi' || t === 'app_logo') return 'logo_aplikasi';
  return t;
}

function deduplicateDocs(docs: any[]): any[] {
  if (!Array.isArray(docs)) return [];
  const map = new Map<string, any>();
  for (const doc of docs) {
    if (!doc) continue;
    const normType = normalizeDocType(doc.document_type || '');
    const reg = String(doc.registration_number || '').trim();
    let key = '';
    if (normType === 'logo_aplikasi') {
      key = 'logo_aplikasi';
    } else if (normType === 'logo_sekolah') {
      key = `logo_sekolah_${String(doc.school_id || reg || 'default').trim()}`;
    } else if (normType === 'foto_profil' && !reg.startsWith('REG-')) {
      key = `foto_profil_${String(doc.account_id || doc.user_id || reg || 'user').trim()}`;
    } else if (reg) {
      key = `${reg}__${normType}`;
    } else {
      key = doc.document_id ? `doc__${doc.document_id}` : `doc__${Math.random()}`;
    }

    const existing = map.get(key);
    const normalizedDoc = { ...doc, document_type: normType };
    if (!existing) {
      map.set(key, normalizedDoc);
    } else {
      const existingTime = existing.upload_time ? new Date(existing.upload_time).getTime() : 0;
      const docTime = doc.upload_time ? new Date(doc.upload_time).getTime() : 0;
      const merged = {
        ...existing,
        ...normalizedDoc,
        document_id: existing.document_id || normalizedDoc.document_id,
        drive_file_id: normalizedDoc.drive_file_id || existing.drive_file_id || '',
        drive_url: normalizedDoc.drive_url || existing.drive_url || '',
        local_url: normalizedDoc.local_url || existing.local_url || '',
        file_name: normalizedDoc.file_name || existing.file_name || '',
      };
      if (docTime >= existingTime) {
        map.set(key, merged);
      } else {
        map.set(key, { ...merged, ...existing });
      }
    }
  }
  return Array.from(map.values());
}

// Global Reusable Forwarder: Pushes all serverDb data to Google Apps Script & Google Sheets
async function forwardSyncAllToGas(retryCount = 1): Promise<{ success: boolean; message?: string }> {
  const gasUrl = serverDb.settings?.gas_web_app_url;
  const ssId = serverDb.settings?.spreadsheet_id;
  const driveId = serverDb.settings?.drive_root_folder_id;

  if (!gasUrl || !gasUrl.startsWith('http')) {
    return { success: false, message: 'URL GAS belum dikonfigurasi' };
  }

  // Deduplicate documents before synchronizing with Google Sheets
  serverDb.documents = deduplicateDocs(serverDb.documents || []);

  try {
    const gasPayload = {
      action: 'syncAllData',
      spreadsheet_id: ssId,
      drive_root_folder_id: driveId,
      data: {
        users: serverDb.users,
        students: serverDb.students,
        parents: serverDb.parents,
        school_origins: serverDb.school_origins,
        addresses: serverDb.addresses,
        applications: serverDb.applications,
        documents: (serverDb.documents || []).map((doc: any) => ({
          document_id: doc.document_id,
          registration_number: doc.registration_number,
          student_id: doc.student_id,
          document_type: doc.document_type,
          document_title: doc.document_title,
          file_name: doc.file_name,
          file_size_kb: doc.file_size_kb,
          drive_file_id: doc.drive_file_id,
          drive_url: doc.drive_url,
          upload_time: doc.upload_time,
          verification_status: doc.verification_status,
          notes: doc.notes,
        })),
        schools: serverDb.schools,
        announcements: serverDb.announcements,
        settings: serverDb.settings,
        audit_logs: (serverDb.audit_logs || []).slice(0, 100),
      },
    };

    const gasRes = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(gasPayload),
    });

    const parsed = await parseGasJsonResponse(gasRes);
    if (!parsed.isJson) {
      if (retryCount > 0) {
        await new Promise((r) => setTimeout(r, 2000));
        return forwardSyncAllToGas(retryCount - 1);
      }
      return {
        success: false,
        message: 'Google Apps Script mengembalikan respons HTML/non-JSON. Pastikan Web App di-Deploy dengan opsi "Who has access: Anyone".',
      };
    }
    return parsed.data;
  } catch (gasErr: any) {
    if (retryCount > 0) {
      await new Promise((r) => setTimeout(r, 2000));
      return forwardSyncAllToGas(retryCount - 1);
    }
    console.warn('forwardSyncAllToGas warning:', gasErr?.message);
    return { success: false, message: gasErr?.message };
  }
}

// Background Coalesced GAS Push Queue
let gasSyncDebounceTimer: NodeJS.Timeout | null = null;
let isForwardingToGas = false;
let pendingGasSync = false;

export function triggerServerGasSyncDebounced(delayMs = 1200) {
  if (gasSyncDebounceTimer) {
    clearTimeout(gasSyncDebounceTimer);
  }
  gasSyncDebounceTimer = setTimeout(async () => {
    if (isForwardingToGas) {
      pendingGasSync = true;
      return;
    }
    isForwardingToGas = true;
    try {
      const res = await forwardSyncAllToGas();
      if (res?.success) {
        if (!serverDb.settings) serverDb.settings = {} as any;
        serverDb.settings.last_synced_at = new Date().toISOString();
        persistServerDb(true);
        broadcastServerDbChange('gas_synced');
      }
    } catch (err: any) {
      console.warn('Background forwardSyncAllToGas error:', err?.message);
    } finally {
      isForwardingToGas = false;
      if (pendingGasSync) {
        pendingGasSync = false;
        triggerServerGasSyncDebounced(1000);
      }
    }
  }, delayMs);
}

let lastGasPullTimestamp = 0;
let isGasPulling = false;
let lastFileUploadTimestamp = 0;

// Smart Auto-Pull: pulls fresh data from Google Sheets when accessed, throttled to 8 seconds
async function checkAndAutoPullFromGas(force = false): Promise<boolean> {
  const gasUrl = serverDb.settings?.gas_web_app_url;
  const ssId = serverDb.settings?.spreadsheet_id;
  if (!gasUrl || !gasUrl.startsWith('http') || !ssId || ssId.includes('SampleID')) {
    return false;
  }
  const now = Date.now();
  // If a file was uploaded recently (within 20 seconds), prevent auto-pull overwrite race condition
  if (!force && now - lastFileUploadTimestamp < 20000) {
    return false;
  }
  if (!force && (now - lastGasPullTimestamp < 8000 || isGasPulling)) {
    return false;
  }
  isGasPulling = true;
  try {
    const res = await pullDataFromGasDirectly(gasUrl, ssId);
    lastGasPullTimestamp = Date.now();
    if (res.success && res.data) {
      const changed = mergeGasDataIntoServerDb(res.data);
      return changed;
    }
  } catch (err: any) {
    console.warn('Auto-pull from GAS failed:', err?.message);
  } finally {
    isGasPulling = false;
  }
  return false;
}

// Standalone server timers (Google Apps Script periodic sync)
if (!isVercel) {
  setTimeout(async () => {
    const gasUrl = serverDb.settings?.gas_web_app_url;
    const ssId = serverDb.settings?.spreadsheet_id;
    if (gasUrl && gasUrl.startsWith('http') && ssId && !ssId.includes('SampleID')) {
      console.log('⚡ Menginisialisasi sinkronisasi awal server dengan Google Apps Script...');
      const res = await pullDataFromGasDirectly(gasUrl, ssId);
      if (res.success && res.data) {
        const changed = mergeGasDataIntoServerDb(res.data);
        console.log(`✓ Sinkronisasi awal GAS berhasil! Status perubahan data: ${changed}`);
      }
    }
  }, 2000);

  setInterval(async () => {
    await checkAndAutoPullFromGas(true);
  }, 10000);
}

// ================= API ROUTES =================

// 1. Health Check
app.get(['/api/health', '/health', '/ping'], (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    has_gas_url: !!serverDb.settings?.gas_web_app_url,
    spreadsheet_id: serverDb.settings?.spreadsheet_id || '',
    db_locked: serverDb.settings?.db_config_locked !== false,
    total_users: serverDb.users?.length || 0,
    total_applications: serverDb.applications?.length || 0,
    last_updated: serverDb.last_updated,
  });
});

// 2. Global Server Settings (Shared across ALL devices)
app.get('/api/settings', (req: Request, res: Response) => {
  res.json({
    success: true,
    settings: serverDb.settings,
    last_updated: serverDb.last_updated,
  });
});

app.post('/api/settings', (req: Request, res: Response) => {
  try {
    const newSettings = req.body;
    if (newSettings && typeof newSettings === 'object') {
      serverDb.settings = {
        ...serverDb.settings,
        ...newSettings,
      };
      persistServerDb();

      // Forward new settings to GAS
      forwardSyncAllToGas().catch(() => {});

      res.json({
        success: true,
        message: 'Pengaturan berhasil disimpan di server terpusat secara permanen untuk semua perangkat.',
        settings: serverDb.settings,
      });
    } else {
      res.status(400).json({ success: false, message: 'Data settings tidak valid.' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Gagal menyimpan settings.' });
  }
});

// 3. Global Data Sync (Shared database state for multi-device sync)
app.get('/api/data', async (req: Request, res: Response) => {
  const forcePull = req.query.force_pull_gas === 'true';
  const shouldPullOnVercel = isVercel && (!serverDb.students || Object.keys(serverDb.students).length === 0 || Date.now() - lastGasPullTimestamp > 45000);
  if (forcePull || shouldPullOnVercel) {
    try {
      await Promise.race([
        checkAndAutoPullFromGas(true),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Sync timeout')), 3500)),
      ]);
    } catch (e) {
      console.warn('Pull error or timeout in /api/data:', e);
    }
  } else {
    // Non-blocking auto-pull in the background - responds in 1ms to user reload/boot
    checkAndAutoPullFromGas(false).catch(() => {});
  }

  const etag = `"${serverDb.last_updated || 'initial'}"`;
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  if (req.headers['if-none-match'] === etag && !forcePull) {
    return res.status(304).end();
  }

  res.json({
    success: true,
    data: {
      settings: serverDb.settings,
      users: serverDb.users,
      students: serverDb.students,
      parents: serverDb.parents,
      school_origins: serverDb.school_origins,
      addresses: serverDb.addresses,
      applications: serverDb.applications,
      documents: serverDb.documents,
      schools: serverDb.schools,
      announcements: serverDb.announcements,
      audit_logs: serverDb.audit_logs,
      last_updated: serverDb.last_updated,
    },
  });
});

// 3b. Real-Time Server-Sent Events (SSE) Stream: Broadcasts instant database mutations (< 50ms) to all connected clients
app.get('/api/data/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable reverse-proxy buffering for instant packet delivery
  res.flushHeaders();

  // Guard connection pool against resource exhaustion under massive traffic
  if (sseClients.length >= MAX_SSE_CLIENTS) {
    const oldest = sseClients.shift();
    if (oldest && !oldest.destroyed) {
      try { oldest.end(); } catch {}
    }
  }

  sseClients.push(res);

  // Send initial connection confirmation
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: serverDb.last_updated })}\n\n`);

  // Heartbeat ping every 12 seconds (keepalive comments) + data ping every 24s to guarantee connection persistence
  let pingCount = 0;
  const heartbeat = setInterval(() => {
    try {
      if (!res.destroyed && res.writable) {
        res.write(': keepalive\n\n');
        pingCount++;
        if (pingCount % 2 === 0) {
          res.write(`data: ${JSON.stringify({ type: 'ping', timestamp: serverDb.last_updated })}\n\n`);
        }
      } else {
        cleanup();
      }
    } catch {
      cleanup();
    }
  }, 12000);

  const cleanup = () => {
    clearInterval(heartbeat);
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  };

  req.on('close', cleanup);
  res.on('close', cleanup);
  res.on('error', cleanup);
});

// Force server to pull latest data from Google Apps Script immediately
app.post('/api/gas/pull-now', async (req: Request, res: Response) => {
  const gasUrl = req.body?.gas_web_app_url || serverDb.settings?.gas_web_app_url;
  const ssId = req.body?.spreadsheet_id || serverDb.settings?.spreadsheet_id;

  if (!gasUrl || !gasUrl.startsWith('http')) {
    return res.status(400).json({
      success: false,
      message: 'URL Google Apps Script Web App belum dikonfigurasi.',
    });
  }

  try {
    const gasResult = await pullDataFromGasDirectly(gasUrl, ssId || '');
    if (gasResult.success && gasResult.data) {
      mergeGasDataIntoServerDb(gasResult.data);
      res.json({
        success: true,
        message: 'Data berhasil ditarik dari Google Sheets dan disinkronkan ke server!',
        total_users: serverDb.users.length,
        total_applications: serverDb.applications.length,
        data: {
          settings: serverDb.settings,
          users: serverDb.users,
          students: serverDb.students,
          parents: serverDb.parents,
          school_origins: serverDb.school_origins,
          addresses: serverDb.addresses,
          applications: serverDb.applications,
          documents: serverDb.documents,
          schools: serverDb.schools,
          announcements: serverDb.announcements,
          audit_logs: serverDb.audit_logs,
          last_updated: serverDb.last_updated,
        },
      });
    } else {
      res.status(502).json({
        success: false,
        message: gasResult.message || 'Gagal menarik data dari Google Apps Script.',
      });
    }
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: `Error saat menarik data: ${err?.message || 'Server error'}`,
    });
  }
});

app.post('/api/data/sync', async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid payload.' });
    }

    if (payload.is_settings_update === true && payload.settings && typeof payload.settings === 'object') {
      serverDb.settings = { ...serverDb.settings, ...payload.settings };
    }
    if (payload.users !== undefined && Array.isArray(payload.users)) {
      const existingUsers = serverDb.users || [];
      serverDb.users = payload.users
        .filter((u: any) => u.role !== 'calon_murid' || !isDemoStudentRecord(u?.registration_number))
        .map((pu: any) => {
          const ex = existingUsers.find((eu: any) => eu.user_id === pu.user_id || (eu.email && pu.email && eu.email.toLowerCase() === pu.email.toLowerCase()) || (eu.registration_number && pu.registration_number && eu.registration_number === pu.registration_number));
          return {
            ...pu,
            photo_url: pu.photo_url || ex?.photo_url || '',
          };
        });
    }
    if (payload.students !== undefined && typeof payload.students === 'object') {
      const cleanStudents: Record<string, any> = {};
      const existingStudents = serverDb.students || {};
      for (const [k, v] of Object.entries(payload.students)) {
        if (!isDemoStudentRecord(k, (v as any)?.student_id)) {
          const ex = existingStudents[k];
          cleanStudents[k] = {
            ...(v as any),
            photo_url: (v as any)?.photo_url || ex?.photo_url || '',
          };
        }
      }
      serverDb.students = cleanStudents;
    }
    if (payload.parents !== undefined && typeof payload.parents === 'object') {
      const cleanParents: Record<string, any> = {};
      for (const [k, v] of Object.entries(payload.parents)) {
        if (!isDemoStudentRecord(k, (v as any)?.student_id)) {
          cleanParents[k] = v;
        }
      }
      serverDb.parents = cleanParents;
    }
    if (payload.school_origins !== undefined && typeof payload.school_origins === 'object') {
      const cleanOrigins: Record<string, any> = {};
      for (const [k, v] of Object.entries(payload.school_origins)) {
        if (!isDemoStudentRecord(k, (v as any)?.student_id)) {
          cleanOrigins[k] = v;
        }
      }
      serverDb.school_origins = cleanOrigins;
    }
    if (payload.addresses !== undefined && typeof payload.addresses === 'object') {
      const cleanAddresses: Record<string, any> = {};
      for (const [k, v] of Object.entries(payload.addresses)) {
        if (!isDemoStudentRecord(k, (v as any)?.student_id)) {
          cleanAddresses[k] = v;
        }
      }
      serverDb.addresses = cleanAddresses;
    }
    if (payload.applications !== undefined && Array.isArray(payload.applications)) {
      serverDb.applications = payload.applications.filter((a: any) => !isDemoStudentRecord(a?.registration_number, a?.student_id));
    }
    if (payload.documents !== undefined && Array.isArray(payload.documents)) {
      const filtered = payload.documents.filter((d: any) => !isDemoStudentRecord(d?.registration_number, d?.student_id));
      serverDb.documents = deduplicateDocs(filtered);
    }
    if (payload.schools !== undefined && Array.isArray(payload.schools)) {
      const existingSchools = serverDb.schools || [];
      serverDb.schools = payload.schools.map((ps: any) => {
        const ex = existingSchools.find((s: any) => s.school_id === ps.school_id || s.school_code === ps.school_code);
        return {
          ...ps,
          logo_url: ps.logo_url !== undefined && ps.logo_url !== '' ? ps.logo_url : (ex?.logo_url || ''),
        };
      });
    }
    if (payload.announcements !== undefined && Array.isArray(payload.announcements)) {
      serverDb.announcements = payload.announcements;
    }
    if (payload.audit_logs !== undefined && Array.isArray(payload.audit_logs)) {
      serverDb.audit_logs = payload.audit_logs;
    }

    persistServerDb();

    // Auto-forward to Google Apps Script
    let gasResult: { success: boolean; message?: string } | null = null;
    if (payload.forwardToGas !== false) {
      if (payload.waitGas === true || process.env.VERCEL) {
        gasResult = await forwardSyncAllToGas();
        if (gasResult?.success) {
          if (!serverDb.settings) serverDb.settings = {} as any;
          serverDb.settings.last_synced_at = new Date().toISOString();
          persistServerDb(false);
        }
      } else {
        triggerServerGasSyncDebounced(700);
      }
    }

    res.json({
      success: true,
      message: 'Data berhasil disinkronkan ke server dan disiarkan secara realtime.',
      gas_synced: gasResult ? !!gasResult.success : undefined,
      gas_message: gasResult ? gasResult.message : 'Sinkronisasi Google Sheets dijadwalkan di latar belakang.',
      last_updated: serverDb.last_updated,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Sync failed.' });
  }
});

// Endpoint untuk memantau status kesehatan & sinkronisasi Google Sheets
app.get('/api/data/gas-sync-status', (req: Request, res: Response) => {
  res.json({
    success: true,
    last_synced_at: serverDb.settings?.last_synced_at || null,
    is_syncing: isForwardingToGas,
    pending_sync: pendingGasSync,
    gas_configured: !!(serverDb.settings?.gas_web_app_url && serverDb.settings?.gas_web_app_url.startsWith('http')),
  });
});

// 4. Server-Side Google Apps Script Proxy (Bypasses Browser CORS completely & handles 302 redirects)
app.post('/api/gas/proxy', async (req: Request, res: Response) => {
  const settings = serverDb.settings;
  const gasUrl = req.body.gas_web_app_url || settings.gas_web_app_url;

  if (!gasUrl || !gasUrl.startsWith('http')) {
    return res.status(400).json({
      success: false,
      message: 'URL Google Apps Script Web App belum dikonfigurasi. Silakan masukkan URL Web App di tab Konfigurasi Database.',
    });
  }

  try {
    const payload = {
      ...req.body,
      spreadsheet_id: req.body.spreadsheet_id || settings.spreadsheet_id,
      drive_root_folder_id: req.body.drive_root_folder_id || settings.drive_root_folder_id,
    };

    const response = await fetch(gasUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    const parsed = await parseGasJsonResponse(response);

    if (!parsed.isJson) {
      let msg = 'Google Apps Script mengembalikan respons non-JSON.';
      let hint = 'Pastikan Google Apps Script telah di-Deploy sebagai Web App dengan opsi: "Execute as: Me" dan "Who has access: Anyone".';

      if (parsed.isHtml) {
        if (parsed.rawText.includes('accounts.google.com') || parsed.rawText.includes('ServiceLogin') || parsed.rawText.includes('Sign in')) {
          msg = 'Akses Google Apps Script memerlukan otorisasi (halaman Login Google dikembalikan).';
          hint = 'Pastikan saat Deploy Web App, opsi "Who has access" dipilih "Anyone" (Bukan "Only myself"). Jika sudah diubah, lakukan Deploy versi baru (New Version).';
        } else if (parsed.rawText.includes('Script error') || parsed.rawText.includes('Exception')) {
          msg = 'Terjadi kesalahan pada eksekusi kode Google Apps Script.';
          hint = 'Periksa tab "Executions" di editor Google Apps Script untuk melihat pesan error detail.';
        } else {
          msg = 'Google Apps Script mengembalikan halaman HTML alih-alih data JSON.';
          hint = 'Pastikan URL berakhiran "/exec" (bukan "/edit") dan opsi "Who has access: Anyone" telah dipilih.';
        }
      }

      console.warn('GAS Proxy Warning (Non-JSON Response):', msg);
      return res.status(502).json({
        success: false,
        message: msg,
        hint,
      });
    }

    res.json(parsed.data);
  } catch (err: any) {
    console.warn('GAS Proxy Network Error:', err?.message || err);
    res.status(502).json({
      success: false,
      message: `Gagal berkomunikasi dengan Google Apps Script: ${err?.message || 'Koneksi ditolak atau URL salah'}`,
      hint: 'Pastikan Google Apps Script telah di-Deploy sebagai Web App dengan opsi: "Execute as: Me" dan "Who has access: Anyone".',
    });
  }
});

function formatStandardFileName(params: {
  accountName?: string;
  registrationNumber?: string;
  documentType?: string;
  documentTitle?: string;
  originalFileName?: string;
  mimeType?: string;
}): string {
  let ext = '';
  if (params.originalFileName) {
    const m = params.originalFileName.match(/\.([a-zA-Z0-9]+)$/);
    if (m) ext = m[1].toLowerCase();
  }
  if (!ext && params.mimeType) {
    if (params.mimeType.includes('jpeg') || params.mimeType.includes('jpg')) ext = 'jpg';
    else if (params.mimeType.includes('png')) ext = 'png';
    else if (params.mimeType.includes('webp')) ext = 'webp';
    else if (params.mimeType.includes('pdf')) ext = 'pdf';
  }
  if (!ext) {
    if (
      params.documentType === 'foto' ||
      params.documentType === 'pas_foto' ||
      params.documentType === 'foto_profil'
    ) {
      ext = 'jpg';
    } else if (
      params.documentType === 'logo_sekolah' ||
      params.documentType === 'logo_aplikasi'
    ) {
      ext = 'png';
    } else {
      ext = 'pdf';
    }
  }

  const rawName = (params.accountName || 'Pendaftar')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .trim()
    .replace(/\s+/g, '_') || 'Pendaftar';

  const rawReg = (params.registrationNumber || 'SIPMA').replace(/[^a-zA-Z0-9_-]/g, '_') || 'SIPMA';

  const typeMap: Record<string, string> = {
    foto: 'Pas_Foto_3x4',
    pas_foto: 'Pas_Foto_3x4',
    foto_profil: 'Pas_Foto_3x4',
    kartu_keluarga: 'Kartu_Keluarga_KK',
    kk: 'Kartu_Keluarga_KK',
    akta_kelahiran: 'Akta_Kelahiran',
    akta: 'Akta_Kelahiran',
    ijazah_skl: 'Ijazah_SKL',
    ijazah: 'Ijazah_SKL',
    skl: 'Surat_Keterangan_Lulus',
    kartu_afirmasi: 'Kartu_KIP_PKH_Afirmasi',
    surat_dispensasi: 'Surat_Dispensasi_Zonasi',
    sertifikat_prestasi: 'Sertifikat_Piagam_Prestasi',
    surat_mutasi: 'Surat_Mutasi_Orang_Tua',
    surat_pernyataan: 'Surat_Pernyataan',
    logo_sekolah: 'Logo_Madrasah',
    logo_aplikasi: 'Logo_Aplikasi_SIPMA',
  };

  let docLabel = params.documentType && typeMap[params.documentType] ? typeMap[params.documentType] : '';
  if (!docLabel) {
    docLabel = (params.documentTitle || params.documentType || 'Dokumen')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s_-]/g, '')
      .trim()
      .replace(/\s+/g, '_') || 'Dokumen';
  }

  return `${rawName}_${rawReg}_${docLabel}.${ext}`;
}

export function extractDriveFileId(url?: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  const m1 = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m1 && m1[1]) return m1[1];
  const m2 = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2 && m2[1]) return m2[1];
  const m3 = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m3 && m3[1]) return m3[1];
  if (trimmed.length >= 20 && !trimmed.includes('/') && !trimmed.includes('.') && !trimmed.includes(' ') && !trimmed.startsWith('DOC-')) {
    return trimmed;
  }
  return '';
}

export function cleanupLocalFileAndCache(driveFileId?: string, localUrl?: string) {
  if (driveFileId) {
    memoryImageCache.delete(driveFileId);
    try {
      const diskCache = path.join(UPLOAD_DIR, `cache_drive_${driveFileId}.jpg`);
      if (fs.existsSync(diskCache)) fs.unlinkSync(diskCache);
    } catch (e) {}
  }
  if (localUrl) {
    try {
      const p = path.join(UPLOAD_DIR, path.basename(localUrl));
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch (e) {}
  }
}

// Fallback for /uploads/ when running serverless on Vercel or if local file was not in ephemeral /tmp
app.get('/uploads/:filename', (req: Request, res: Response) => {
  const { filename } = req.params;
  if (!filename) return res.status(404).end();

  // 1. Memory RAM cache
  const mem = memoryImageCache.get(filename);
  if (mem) {
    res.setHeader('Content-Type', mem.contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(mem.buffer);
  }

  // 2. Check if local file exists on disk
  try {
    const localPath = path.join(UPLOAD_DIR, filename);
    if (fs.existsSync(localPath)) {
      return res.sendFile(localPath);
    }
  } catch {}

  // 3. Search serverDb documents
  if (serverDb.documents) {
    const doc = serverDb.documents.find(
      (d: any) =>
        d.file_name === filename ||
        (d.local_url && path.basename(d.local_url) === filename)
    );
    if (doc?.drive_file_id && doc.drive_file_id !== 'LOCAL_STORAGE') {
      return res.redirect(302, `https://lh3.googleusercontent.com/d/${encodeURIComponent(doc.drive_file_id)}`);
    }
    if (doc?.file_data_base64 && doc.file_data_base64.startsWith('data:')) {
      const parts = doc.file_data_base64.split(',');
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
      const buf = Buffer.from(parts[1], 'base64');
      res.setHeader('Content-Type', mime);
      return res.send(buf);
    }
  }

  // 4. Search school logos
  if (serverDb.schools) {
    const sch = serverDb.schools.find((s: any) => s.logo_url && s.logo_url.includes(filename));
    const driveId = extractDriveFileId(sch?.logo_url);
    if (driveId) {
      return res.redirect(302, `https://lh3.googleusercontent.com/d/${encodeURIComponent(driveId)}`);
    }
  }

  // 5. Search app logo
  if (serverDb.settings?.app_logo) {
    const driveId = extractDriveFileId(serverDb.settings.app_logo);
    if (driveId && serverDb.settings.app_logo.includes(filename)) {
      return res.redirect(302, `https://lh3.googleusercontent.com/d/${encodeURIComponent(driveId)}`);
    }
  }

  return res.status(404).send('File not found');
});

// 5. Direct Document Upload Proxy to Google Drive via GAS & Local Mirror
app.post('/api/gas/upload-file', async (req: Request, res: Response) => {
  lastFileUploadTimestamp = Date.now();
  const settings = serverDb.settings || {};
  const gasUrl = (settings.gas_web_app_url && settings.gas_web_app_url.startsWith('http'))
    ? settings.gas_web_app_url
    : (req.body.gas_web_app_url || '');
  const ssId = settings.spreadsheet_id || req.body.spreadsheet_id || '';
  const driveId = settings.drive_root_folder_id || req.body.drive_root_folder_id || '';

  try {
    const { doc, student_name, school_name } = req.body;
    if (!doc) {
      return res.status(400).json({ success: false, message: 'Data dokumen tidak ditemukan.' });
    }

    // Normalize document type to avoid duplicates
    const normType = normalizeDocType(doc.document_type);
    doc.document_type = normType;

    // Check if replacing an existing document to cleanup old files from Drive & disk
    if (!serverDb.documents) serverDb.documents = [];
    const docIdx = serverDb.documents.findIndex(
      (d: any) =>
        d.document_id === doc.document_id ||
        (d.registration_number === doc.registration_number && normalizeDocType(d.document_type) === normType)
    );
    const prevDoc = docIdx >= 0 ? serverDb.documents[docIdx] : null;
    const oldDriveId = extractDriveFileId(
      prevDoc?.drive_file_id || prevDoc?.drive_url || doc.old_drive_file_id || req.body.old_drive_file_id
    );

    if (oldDriveId) {
      cleanupLocalFileAndCache(oldDriveId, prevDoc?.local_url);
    } else if (prevDoc && prevDoc.local_url) {
      cleanupLocalFileAndCache('', prevDoc.local_url);
    }

    // Preserve original document_id to avoid duplicating rows
    if (prevDoc && prevDoc.document_id) {
      doc.document_id = prevDoc.document_id;
    }

    let localUrl = '';
    let detectedMime = doc.mime_type || '';
    let detectedExt = '';

    if (doc.file_data_base64) {
      try {
        const raw = String(doc.file_data_base64);
        const commaIdx = raw.indexOf(',');
        let base64Data = commaIdx >= 0 ? raw.slice(commaIdx + 1) : raw;
        base64Data = base64Data.replace(/\s/g, '').replace(/ /g, '+');
        const pad = base64Data.length % 4;
        if (pad === 2) base64Data += '==';
        else if (pad === 3) base64Data += '=';

        const buffer = Buffer.from(base64Data, 'base64');

        // Inspect magic bytes to prevent file corruption
        if (buffer.length >= 4) {
          const b0 = buffer[0];
          const b1 = buffer[1];
          const b2 = buffer[2];
          const b3 = buffer[3];
          if (b0 === 0x89 && b1 === 0x50 && b2 === 0x4E && b3 === 0x47) {
            detectedMime = 'image/png';
            detectedExt = 'png';
          } else if (b0 === 0xFF && b1 === 0xD8) {
            detectedMime = 'image/jpeg';
            detectedExt = 'jpg';
          } else if (b0 === 0x25 && b1 === 0x50 && b2 === 0x44 && b3 === 0x46) {
            detectedMime = 'application/pdf';
            detectedExt = 'pdf';
          } else if (b0 === 0x52 && b1 === 0x49 && b2 === 0x46 && b3 === 0x46) {
            detectedMime = 'image/webp';
            detectedExt = 'webp';
          }
        }

        const standardFileName = formatStandardFileName({
          accountName: student_name || doc.student_name,
          registrationNumber: doc.registration_number,
          documentType: doc.document_type,
          documentTitle: doc.document_title,
          originalFileName: doc.file_name,
          mimeType: detectedMime,
        });

        const safeDocName = detectedExt && !standardFileName.endsWith(`.${detectedExt}`)
          ? standardFileName.replace(/\.[a-zA-Z0-9]+$/, `.${detectedExt}`)
          : standardFileName;

        const filePath = path.join(UPLOAD_DIR, safeDocName);
        fs.writeFileSync(filePath, buffer);
        localUrl = `/uploads/${safeDocName}`;

        // Update clean properties for upload
        doc.file_name = safeDocName;
        doc.mime_type = detectedMime || doc.mime_type;
      } catch (localErr) {
        console.warn('Gagal menyimpan salinan file lokal:', localErr);
      }
    }

    const standardFileName = doc.file_name || formatStandardFileName({
      accountName: student_name || doc.student_name,
      registrationNumber: doc.registration_number,
      documentType: doc.document_type,
      documentTitle: doc.document_title,
      originalFileName: doc.file_name,
      mimeType: detectedMime,
    });
    const safeDocName = standardFileName;

    // Clean up previous local file copy if re-uploading
    if (prevDoc && prevDoc.file_name && prevDoc.file_name !== safeDocName) {
      try {
        const oldPath = path.join(UPLOAD_DIR, prevDoc.file_name);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      } catch (e) {}
    }

    let driveFileId = '';
    let driveUrl = localUrl;
    let viewUrl = localUrl;
    let gasSuccess = false;

    if (gasUrl && gasUrl.startsWith('http')) {
      try {
        const isAccount = req.body.is_account || doc.document_type === 'foto_profil' || doc.document_type === 'avatar' || doc.document_type === 'dokumen_akun';
        const uploadPayload = {
          action: 'uploadDocument',
          spreadsheet_id: ssId,
          drive_root_folder_id: driveId,
          data: {
            registration_number: doc.registration_number,
            student_name: student_name || 'Calon Murid',
            school_name: school_name || 'Madrasah',
            application_year: req.body.application_year || settings.academic_year_label || settings.application_year || '2026/2027',
            document_type: doc.document_type,
            document_title: doc.document_title,
            file_name: standardFileName,
            file_size_kb: doc.file_size_kb || Math.round((doc.file_size_bytes || 0) / 1024),
            file_size_bytes: doc.file_size_bytes,
            mime_type: doc.mime_type,
            base64_data: doc.file_data_base64,
            old_drive_file_id: oldDriveId || prevDoc?.drive_file_id || '',
            is_account: isAccount,
            account_name: req.body.account_name || student_name || 'Pengguna',
            account_id: req.body.account_id || doc.registration_number || '',
          },
        };

        const response = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(uploadPayload),
        });

        const resText = await response.text();
        let gasResult: any = null;
        try {
          gasResult = JSON.parse(resText);
        } catch {
          console.warn('GAS File Upload response non-JSON');
        }

        if (gasResult && gasResult.success) {
          gasSuccess = true;
          const fInfo = gasResult.file || gasResult.data || {};
          driveFileId = fInfo.drive_file_id || '';
          const isPdf = (detectedMime && detectedMime.includes('pdf')) || standardFileName.toLowerCase().endsWith('.pdf');
          const realDriveViewUrl = driveFileId ? `https://drive.google.com/file/d/${driveFileId}/view?usp=drivesdk` : '';
          const directThumbUrl = (driveFileId && !isPdf) ? `https://lh3.googleusercontent.com/d/${driveFileId}` : '';
          driveUrl = realDriveViewUrl || fInfo.drive_url || localUrl;
          viewUrl = isPdf ? (realDriveViewUrl || localUrl) : (directThumbUrl || realDriveViewUrl || localUrl);
        }
      } catch (gasErr: any) {
        console.warn('Gagal upload ke Google Apps Script Drive:', gasErr?.message);
      }
    }

    // Update serverDb document record
    if (!serverDb.documents) serverDb.documents = [];
    const targetDocIdx = serverDb.documents.findIndex(
      (d: any) =>
        d.document_id === doc.document_id ||
        (d.registration_number === doc.registration_number && normalizeDocType(d.document_type) === normType)
    );

    const isPdf = (detectedMime && detectedMime.includes('pdf')) || standardFileName.toLowerCase().endsWith('.pdf');
    const realDriveViewUrl = driveFileId ? `https://drive.google.com/file/d/${driveFileId}/view?usp=drivesdk` : '';
    const directThumbUrl = (driveFileId && !isPdf) ? `https://lh3.googleusercontent.com/d/${driveFileId}` : '';
    const effectiveDriveUrl = realDriveViewUrl || driveUrl || (targetDocIdx >= 0 ? serverDb.documents[targetDocIdx].drive_url : localUrl);
    const effectiveViewUrl = isPdf ? (realDriveViewUrl || localUrl) : (directThumbUrl || effectiveDriveUrl || localUrl);

    const updatedDocItem = {
      ...doc,
      document_type: normType,
      file_name: standardFileName,
      drive_file_id: driveFileId || (targetDocIdx >= 0 ? serverDb.documents[targetDocIdx].drive_file_id : ''),
      drive_url: effectiveDriveUrl,
      view_url: effectiveViewUrl,
      thumbnail_url: directThumbUrl || effectiveDriveUrl,
      local_url: localUrl,
      upload_time: new Date().toISOString(),
    };

    if (targetDocIdx >= 0) {
      serverDb.documents[targetDocIdx] = { ...serverDb.documents[targetDocIdx], ...updatedDocItem };
    } else {
      serverDb.documents.push(updatedDocItem);
    }
    serverDb.documents = deduplicateDocs(serverDb.documents);

    // If it's a student or user photo, update student photo_url & user record across both tables
    const isPhotoDoc = doc.document_type === 'foto' || doc.document_type === 'pas_foto' || doc.document_type === 'foto_profil' || req.body.is_account;
    if (isPhotoDoc) {
      const studentPhotoUrl = effectiveDriveUrl || localUrl;
      const targetReg = doc.registration_number || req.body.account_id;
      if (serverDb.students && targetReg && serverDb.students[targetReg]) {
        serverDb.students[targetReg].photo_url = studentPhotoUrl;
      }
      if (serverDb.users) {
        const u = serverDb.users.find((usr: any) => 
          (targetReg && (usr.registration_number === targetReg || usr.user_id === targetReg)) ||
          (req.body.account_name && usr.name === req.body.account_name)
        );
        if (u) {
          u.photo_url = studentPhotoUrl;
          if (u.registration_number && serverDb.students && serverDb.students[u.registration_number]) {
            serverDb.students[u.registration_number].photo_url = studentPhotoUrl;
          }
        }
      }
    }

    persistServerDb();

    // Immediately push document row to Google Sheets database
    if (isVercel) {
      try {
        await forwardSyncAllToGas();
      } catch (e: any) {
        console.warn('Gagal sinkronisasi dokumen ke Spreadsheet on Vercel:', e?.message);
      }
    } else {
      forwardSyncAllToGas().catch((e) => console.warn('Gagal sinkronisasi dokumen ke Spreadsheet:', e?.message));
    }

    return res.json({
      success: true,
      message: gasSuccess
        ? 'Berkas berhasil diunggah & tersimpan aman di Google Drive dan Google Sheets!'
        : 'Berkas berhasil disimpan di server dan database Google Sheets.',
      gas_synced: gasSuccess,
      file: {
        document_id: doc.document_id,
        file_name: standardFileName,
        drive_file_id: driveFileId,
        drive_url: effectiveDriveUrl,
        local_url: isVercel && driveFileId ? '' : localUrl,
        view_url: viewUrl,
        thumbnail_url: directThumbUrl || effectiveDriveUrl,
      },
    });
  } catch (err: any) {
    console.error('GAS File Upload Proxy Error:', err);
    res.status(500).json({
      success: false,
      message: `Gagal mengunggah file ke Google Drive: ${err?.message || 'Error'}`,
    });
  }
});

// 5b. Direct File Download Endpoint for Admin Pusat & Admin Kabupaten (No Google Drive Loading)
app.get('/api/files/download', async (req: Request, res: Response) => {
  const driveFileId = (req.query.drive_file_id as string) || '';
  let fileName = (req.query.file_name as string) || 'dokumen_pendaftaran.pdf';
  const localUrl = (req.query.local_url as string) || '';
  const documentId = (req.query.document_id as string) || '';
  const driveUrl = (req.query.drive_url as string) || '';

  // Clean filename for Content-Disposition header
  fileName = fileName.replace(/[\r\n"]/g, '_').trim() || 'dokumen_pendaftaran.pdf';

  // 1. Check local storage file in UPLOAD_DIR
  if (localUrl) {
    const localFileName = path.basename(localUrl);
    const localFilePath = path.join(UPLOAD_DIR, localFileName);
    if (fs.existsSync(localFilePath)) {
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      return res.sendFile(localFilePath);
    }
  }

  // 2. Check if file is stored in serverDb
  if (serverDb.documents && (documentId || driveFileId)) {
    const found = serverDb.documents.find(
      (d: any) =>
        (documentId && d.document_id === documentId) ||
        (driveFileId && d.drive_file_id === driveFileId)
    );
    if (found) {
      if (found.local_url) {
        const localFilePath = path.join(UPLOAD_DIR, path.basename(found.local_url));
        if (fs.existsSync(localFilePath)) {
          res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
          return res.sendFile(localFilePath);
        }
      }
      if (found.file_data_base64 && found.file_data_base64.startsWith('data:')) {
        const raw = found.file_data_base64;
        const matches = raw.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        const mime = matches ? matches[1] : 'application/octet-stream';
        const base64Data = matches ? matches[2] : raw.includes(',') ? raw.split(',')[1] : raw;
        const buffer = Buffer.from(base64Data, 'base64');
        res.setHeader('Content-Type', mime);
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        return res.send(buffer);
      }
    }
  }

  // 3. Directly stream from Google Drive without loading Drive UI
  const effectiveDriveId =
    driveFileId ||
    (driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || [])[1] ||
    (driveUrl.match(/id=([a-zA-Z0-9_-]+)/) || [])[1];

  if (effectiveDriveId && effectiveDriveId.length > 5) {
    try {
      const googleDownloadUrl = `https://drive.google.com/uc?export=download&id=${effectiveDriveId}`;
      const driveRes = await fetch(googleDownloadUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (driveRes.ok) {
        const contentType = driveRes.headers.get('content-type') || 'application/octet-stream';
        if (contentType.includes('text/html')) {
          // If Google returns preview HTML, fallback to direct CDN endpoint
          const userContentUrl = `https://lh3.googleusercontent.com/d/${effectiveDriveId}`;
          const altRes = await fetch(userContentUrl);
          if (altRes.ok) {
            const altBuffer = Buffer.from(await altRes.arrayBuffer());
            res.setHeader(
              'Content-Type',
              altRes.headers.get('content-type') || 'application/octet-stream'
            );
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            return res.send(altBuffer);
          }
        } else {
          const buffer = Buffer.from(await driveRes.arrayBuffer());
          res.setHeader('Content-Type', contentType);
          res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
          return res.send(buffer);
        }
      }
    } catch (gErr) {
      console.warn('Google Drive direct stream error:', gErr);
    }
  }

  // Fallback 404
  res.status(404).json({ success: false, message: 'Berkas tidak ditemukan di penyimpanan server.' });
});

// 5b. Upload Branding Logo (Madrasah / App Logo) to Google Drive & Server DB
app.post('/api/gas/upload-logo', async (req: Request, res: Response) => {
  lastFileUploadTimestamp = Date.now();
  const settings = serverDb.settings || {};
  const gasUrl = (settings.gas_web_app_url && settings.gas_web_app_url.startsWith('http'))
    ? settings.gas_web_app_url
    : (req.body.gas_web_app_url || '');
  const ssId = settings.spreadsheet_id || req.body.spreadsheet_id || '';
  const driveId = settings.drive_root_folder_id || req.body.drive_root_folder_id || '';

  try {
    const { logo_type, id, name, base64_data, file_name } = req.body;
    if (!base64_data) {
      return res.status(400).json({ success: false, message: 'Data gambar logo tidak ditemukan.' });
    }

    let localUrl = '';
    const safeLogoName = `logo_${logo_type || 'custom'}_${(id || 'sys').replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}_${(file_name || 'logo.png').replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    try {
      const raw = String(base64_data);
      const commaIdx = raw.indexOf(',');
      const dataContent = commaIdx >= 0 ? raw.slice(commaIdx + 1) : raw;
      const buffer = Buffer.from(dataContent, 'base64');
      const filePath = path.join(UPLOAD_DIR, safeLogoName);
      fs.writeFileSync(filePath, buffer);
      localUrl = `/uploads/${safeLogoName}`;

      // Bersihkan salinan logo/avatar lokal lama agar disk rapi & tidak dobel
      try {
        const prefix = `logo_${logo_type || 'custom'}_${(id || 'sys').replace(/[^a-zA-Z0-9_-]/g, '_')}_`;
        const existingFiles = fs.readdirSync(UPLOAD_DIR);
        for (const ef of existingFiles) {
          if (ef.startsWith(prefix) && ef !== safeLogoName) {
            try { fs.unlinkSync(path.join(UPLOAD_DIR, ef)); } catch(e) {}
          }
        }
      } catch (cleanErr) {}
    } catch (localErr) {
      console.warn('Gagal menyimpan logo lokal:', localErr);
    }

    let driveFileId = '';
    let driveUrl = localUrl;
    let gasSuccess = false;

    if (gasUrl && gasUrl.startsWith('http')) {
      try {
        const isAccount = logo_type === 'user';
        const isSchool = logo_type === 'school';
        const isApp = logo_type === 'app';
        const docType = isSchool ? 'logo_sekolah' : isAccount ? 'foto_profil' : 'logo_aplikasi';
        const docTitle = isSchool ? `Logo Resmi ${name || 'Madrasah'}` : isAccount ? `Foto Profil ${name || 'Pengguna'}` : 'Logo Aplikasi SIPMA';
        const regNum = isSchool ? (id || 'SCHOOL') : isAccount ? (id || 'USER') : 'SYSTEM';

        // Detect old Drive File ID for cleanup to prevent accumulating abandoned files
        let oldDriveId = extractDriveFileId(req.body.old_drive_file_id || req.body.old_logo_url);
        if (!oldDriveId) {
          if (isSchool && serverDb.schools) {
            const sch = serverDb.schools.find((s: any) => s.school_id === id);
            if (sch?.logo_url) oldDriveId = extractDriveFileId(sch.logo_url);
          } else if (isAccount && serverDb.users) {
            const usr = serverDb.users.find((u: any) => u.user_id === id || u.email === id);
            if (usr?.photo_url) oldDriveId = extractDriveFileId(usr.photo_url);
          } else if (isApp && serverDb.settings?.app_logo) {
            oldDriveId = extractDriveFileId(serverDb.settings.app_logo);
          }
        }
        if (oldDriveId) {
          cleanupLocalFileAndCache(oldDriveId);
        }

        const uploadPayload = {
          action: 'uploadDocument',
          spreadsheet_id: ssId,
          drive_root_folder_id: driveId,
          data: {
            registration_number: regNum,
            student_name: name || (isAccount ? 'Pengguna' : isSchool ? name : 'Logo SIPMA'),
            school_name: isSchool ? (name || 'Madrasah') : 'Branding SIPMA',
            application_year: settings.academic_year_label || settings.application_year || '2026/2027',
            document_type: docType,
            document_title: docTitle,
            file_name: file_name || safeLogoName,
            base64_data: base64_data,
            old_drive_file_id: oldDriveId || '',
            is_account: isAccount,
            account_name: name || 'Akun Pengguna',
            account_id: id || '',
            is_school_logo: isSchool,
            school_id: isSchool ? id : '',
            is_app_logo: isApp,
          },
        };

        const response = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(uploadPayload),
        });

        const resText = await response.text();
        let gasResult: any = null;
        try {
          gasResult = JSON.parse(resText);
        } catch {
          console.warn('GAS Logo Upload response non-JSON');
        }

        if (gasResult && gasResult.success) {
          gasSuccess = true;
          const fInfo = gasResult.file || gasResult.data || {};
          driveFileId = fInfo.drive_file_id || '';
          driveUrl = fInfo.thumbnail_url || (driveFileId ? `https://lh3.googleusercontent.com/d/${driveFileId}` : '') || fInfo.drive_url || localUrl;
        }
      } catch (gasErr: any) {
        console.warn('Gagal upload logo ke Drive GAS:', gasErr?.message);
      }
    }

    const finalLogoUrl = (driveFileId ? `https://lh3.googleusercontent.com/d/${driveFileId}` : '') || driveUrl || (isVercel ? (req.body.base64_data || localUrl) : localUrl);

    if (logo_type === 'school' && id) {
      if (serverDb.schools && Array.isArray(serverDb.schools)) {
        const sch = serverDb.schools.find((s: any) => s.school_id === id);
        if (sch) {
          sch.logo_url = finalLogoUrl;
        }
      }
    } else if (logo_type === 'user' && id) {
      if (serverDb.users && Array.isArray(serverDb.users)) {
        const usr = serverDb.users.find((u: any) => u.user_id === id || u.email === id || u.registration_number === id);
        if (usr) {
          usr.photo_url = finalLogoUrl;
          if (usr.registration_number && serverDb.students && serverDb.students[usr.registration_number]) {
            serverDb.students[usr.registration_number].photo_url = finalLogoUrl;
          }
        }
      }
      if (serverDb.students && serverDb.students[id]) {
        serverDb.students[id].photo_url = finalLogoUrl;
      }
    } else if (logo_type === 'app') {
      if (!serverDb.settings) serverDb.settings = {};
      serverDb.settings.app_logo = finalLogoUrl;
    }

    persistServerDb();

    // Immediately push updated school logo or app branding to Google Sheets database
    if (isVercel) {
      try {
        await forwardSyncAllToGas();
      } catch (e: any) {
        console.warn('Gagal sinkronisasi logo ke Spreadsheet on Vercel:', e?.message);
      }
    } else {
      forwardSyncAllToGas().catch((e) => console.warn('Gagal sinkronisasi logo ke Spreadsheet:', e?.message));
    }

    return res.json({
      success: true,
      message: gasSuccess ? 'Logo berhasil diunggah dan tersimpan di Google Drive dan Google Sheets!' : 'Logo berhasil disimpan di server dan database Google Sheets.',
      logo_url: finalLogoUrl,
      drive_file_id: driveFileId,
      local_url: isVercel && driveFileId ? '' : localUrl,
      gas_synced: gasSuccess,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: `Gagal mengunggah logo: ${err?.message || 'Error'}` });
  }
});

// 5a-2. Direct User Profile & Photo Persistence Endpoint
app.post('/api/user/update-profile', (req: Request, res: Response) => {
  try {
    const { user_id, updates } = req.body;
    if (!user_id || !updates || typeof updates !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }

    if (!serverDb.users) serverDb.users = [];
    const idx = serverDb.users.findIndex((u: any) => 
      u.user_id === user_id || 
      u.registration_number === user_id || 
      (u.email && updates.email && u.email.toLowerCase() === updates.email.toLowerCase())
    );

    let updatedUser: any = null;
    const now = new Date().toISOString();

    if (idx >= 0) {
      serverDb.users[idx] = {
        ...serverDb.users[idx],
        ...updates,
        photo_url: updates.photo_url !== undefined && updates.photo_url !== '' ? updates.photo_url : serverDb.users[idx].photo_url,
        updated_at: now,
      };
      updatedUser = serverDb.users[idx];
    } else {
      updatedUser = {
        user_id,
        ...updates,
        updated_at: now,
      };
      serverDb.users.push(updatedUser);
    }

    // Also update student profile if applicable
    const regTarget = updatedUser.registration_number || user_id;
    if (serverDb.students && regTarget && serverDb.students[regTarget]) {
      if (updates.photo_url) serverDb.students[regTarget].photo_url = updates.photo_url;
      if (updates.name) serverDb.students[regTarget].name = updates.name;
      if (updates.phone) serverDb.students[regTarget].phone = updates.phone;
    }

    persistServerDb();
    forwardSyncAllToGas().catch(() => {});

    return res.json({ success: true, message: 'Profil berhasil diperbarui di server.', user: updatedUser });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Error updating profile' });
  }
});

// 5b-2. Automated Email Notification Dispatcher (Triggered on Document Verification & Selection Change)
app.post('/api/notifications/send-status-email', async (req: Request, res: Response) => {
  const settings = serverDb.settings || {};
  const gasUrl = req.body.gas_web_app_url || settings.gas_web_app_url;
  const ssId = req.body.spreadsheet_id || settings.spreadsheet_id;

  try {
    const {
      email,
      student_name,
      registration_number,
      school_name,
      school_email,
      school_phone,
      school_address,
      event_type, // 'registration_submitted' | 'verification' | 'selection' | 'announcement' | 'transfer'
      new_status,
      notes,
      pathway,
      title,
      announcement_content,
      app_name,
      app_logo_url,
    } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Alamat email penerima tidak valid atau kosong.',
      });
    }

    // Automatically resolve school contact info if not passed directly
    let targetSchool: any = null;
    if (registration_number && serverDb.applications) {
      const app = serverDb.applications.find((a: any) => a.registration_number === registration_number);
      if (app?.school_id && serverDb.schools) {
        targetSchool = serverDb.schools.find((s: any) => s.school_id === app.school_id);
      }
    }
    if (!targetSchool && school_name && serverDb.schools) {
      targetSchool = serverDb.schools.find((s: any) => s.school_name?.toLowerCase() === school_name?.toLowerCase());
    }

    const finalSchoolName = school_name || targetSchool?.school_name || 'Madrasah Pilihan';
    let finalSchoolEmail = school_email || targetSchool?.contact_email || '';
    let finalSchoolPhone = school_phone || targetSchool?.contact_phone || '';
    const finalSchoolAddress = school_address || targetSchool?.address || '';

    // If school email is still empty, look up the school admin or operator associated with the school
    if (!finalSchoolEmail) {
      const schId = targetSchool?.school_id;
      const schAdmin = serverDb.users?.find((u: any) =>
        (schId && u.school_id === schId) &&
        (u.role === 'admin_sekolah' || u.role === 'operator_sekolah')
      );
      if (schAdmin?.email) {
        finalSchoolEmail = schAdmin.email;
      } else {
        finalSchoolEmail = 'mi02jatibarang.brebes@gmail.com';
      }
    }

    if (!finalSchoolPhone) {
      const schId = targetSchool?.school_id;
      const schAdmin = serverDb.users?.find((u: any) =>
        (schId && u.school_id === schId) &&
        (u.role === 'admin_sekolah' || u.role === 'operator_sekolah')
      );
      if (schAdmin?.phone) {
        finalSchoolPhone = String(schAdmin.phone);
      } else {
        finalSchoolPhone = '08988857555';
      }
    }

    // Automatically resolve public App Logo
    let finalAppLogo = app_logo_url || settings.app_logo || '';
    if (finalAppLogo.includes('drive.google.com') || (finalAppLogo.length > 20 && !finalAppLogo.includes('/') && !finalAppLogo.startsWith('data:'))) {
      const driveId = extractDriveFileId(finalAppLogo) || finalAppLogo;
      finalAppLogo = `https://lh3.googleusercontent.com/d/${driveId}`;
    } else if (!finalAppLogo || finalAppLogo.startsWith('data:image/') || finalAppLogo.includes('localhost')) {
      finalAppLogo = 'https://cdn.phototourl.com/free/2026-09-01-6c787787-6585-4830-b0a6-9bfab3f1dba4.png';
    }

    const emailPayload = {
      action: 'sendNotificationEmail',
      spreadsheet_id: ssId,
      data: {
        email: email.trim(),
        student_name: student_name || 'Calon Murid',
        registration_number: registration_number || '',
        school_name: finalSchoolName,
        school_email: finalSchoolEmail,
        school_phone: finalSchoolPhone,
        school_address: finalSchoolAddress,
        event_type: event_type || 'verification',
        new_status: new_status || '',
        notes: notes || '',
        pathway: pathway || '',
        title: title || '',
        announcement_content: announcement_content || notes || '',
        app_name: app_name || settings.app_name || 'SIPMA',
        app_logo_url: finalAppLogo,
      },
    };

    let gasSent = false;
    let gasMessage = '';

    if (gasUrl && gasUrl.startsWith('http')) {
      try {
        const gasRes = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(emailPayload),
        });
        const parsed = await parseGasJsonResponse(gasRes);
        if (parsed.isJson && parsed.data && parsed.data.success) {
          gasSent = true;
          gasMessage = parsed.data.message || 'Email notifikasi berhasil dikirim via Google Apps Script.';
        } else {
          gasMessage = parsed.data?.message || (parsed.isHtml ? 'Google Apps Script merespons HTML/memerlukan otorisasi.' : 'Gagal mengirim email via Google Apps Script.');
        }
      } catch (gasErr: any) {
        console.warn('Gagal memanggil GAS sendNotificationEmail:', gasErr?.message);
        gasMessage = gasErr?.message || 'Koneksi ke GAS gagal';
      }
    }

    // Log the notification to server audit logs
    const logItem = {
      log_id: `LOG-MAIL-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user_id: 'SYSTEM',
      username: `Panitia PPDB ${finalSchoolName}`,
      role: 'system',
      action: 'SEND_EMAIL_NOTIFICATION',
      target: registration_number || email,
      description: `Notifikasi email PPDB [${event_type?.toUpperCase()}: ${new_status}] dikirim ke ${email} dari pengirim madrasah '${finalSchoolName}' (${finalSchoolEmail || 'email madrasah'}). ${gasSent ? '(Terkirim via GAS)' : '(Tersimpan di antrean sistem)'}`,
      status: gasSent ? 'success' : 'queued',
    };

    if (!serverDb.audit_logs) serverDb.audit_logs = [];
    serverDb.audit_logs.unshift(logItem);
    persistServerDb();

    return res.json({
      success: true,
      message: gasSent
        ? `Notifikasi email otomatis resmi dari ${finalSchoolName} berhasil dikirim ke ${email}.`
        : `Notifikasi email telah dicatat untuk ${email} (pengirim: ${finalSchoolName}).`,
      gas_sent: gasSent,
      gas_message: gasMessage,
      sender_name: `Panitia PPDB ${finalSchoolName}`,
      sender_email: finalSchoolEmail,
      recipient: email,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: `Gagal memproses notifikasi email: ${err?.message || 'Server error'}`,
    });
  }
});

// 5c. High-Speed Google Drive Image Proxy / Fallback Stream with Local Disk & RAM Caching
app.get('/api/drive/image/:fileId', async (req: Request, res: Response) => {
  const { fileId } = req.params;
  if (!fileId || fileId.includes('..') || fileId.length < 5) {
    return res.status(400).send('Invalid file ID');
  }

  // On Vercel (serverless environment), redirect immediately to Google's Edge CDN (302)
  // This eliminates Lambda execution time, avoids cold-start timeouts, and streams in 20ms
  if (isVercel) {
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    return res.redirect(302, `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}`);
  }

  // 1. Ultra-Fast RAM Cache (< 0.05ms serving time)
  const memCached = memoryImageCache.get(fileId);
  if (memCached) {
    res.setHeader('Content-Type', memCached.contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('ETag', memCached.etag);
    if (req.headers['if-none-match'] === memCached.etag) {
      return res.status(304).end();
    }
    return res.send(memCached.buffer);
  }

  // 2. Check permanent drive cache on disk for instant (<1ms) serving
  const cachePath = path.join(UPLOAD_DIR, `cache_drive_${fileId}.jpg`);
  if (fs.existsSync(cachePath)) {
    try {
      const buf = fs.readFileSync(cachePath);
      const etag = `"${fileId}"`;
      setMemoryImageCache(fileId, { buffer: buf, contentType: 'image/jpeg', etag });
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('ETag', etag);
      if (req.headers['if-none-match'] === etag) {
        return res.status(304).end();
      }
      return res.send(buf);
    } catch {}
  }

  // 3. Check if we have original local copy in uploads
  try {
    const files = fs.readdirSync(UPLOAD_DIR);
    const matched = files.find((f) => f.includes(fileId));
    if (matched) {
      const buf = fs.readFileSync(path.join(UPLOAD_DIR, matched));
      const mime = matched.endsWith('.png') ? 'image/png' : matched.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
      const etag = `"${fileId}"`;
      setMemoryImageCache(fileId, { buffer: buf, contentType: mime, etag });
      res.setHeader('Content-Type', mime);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('ETag', etag);
      return res.send(buf);
    }
  } catch {}

  // 4. Check if document has base64 in serverDb
  if (serverDb.documents) {
    const doc = serverDb.documents.find((d: any) => d.drive_file_id === fileId);
    if (doc?.file_data_base64 && doc.file_data_base64.startsWith('data:')) {
      try {
        const raw = doc.file_data_base64;
        const matches = raw.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        const mime = matches ? matches[1] : 'image/jpeg';
        const base64Data = matches ? matches[2] : raw.includes(',') ? raw.split(',')[1] : raw;
        const buf = Buffer.from(base64Data, 'base64');
        const etag = `"${fileId}"`;
        setMemoryImageCache(fileId, { buffer: buf, contentType: mime, etag });
        try { fs.writeFileSync(cachePath, buf); } catch {}
        res.setHeader('Content-Type', mime);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('ETag', etag);
        return res.send(buf);
      } catch {}
    }
  }

  // 5. Check if app_logo in settings matches
  if (serverDb.settings?.app_logo && (fileId === 'app_logo' || serverDb.settings.app_logo.includes(fileId))) {
    const logoStr = serverDb.settings.app_logo;
    if (logoStr.startsWith('data:')) {
      try {
        const matches = logoStr.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        const mime = matches ? matches[1] : 'image/png';
        const base64Data = matches ? matches[2] : logoStr.includes(',') ? logoStr.split(',')[1] : logoStr;
        const buf = Buffer.from(base64Data, 'base64');
        const etag = `"${fileId}"`;
        setMemoryImageCache(fileId, { buffer: buf, contentType: mime, etag });
        try { fs.writeFileSync(cachePath, buf); } catch {}
        res.setHeader('Content-Type', mime);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('ETag', etag);
        return res.send(buf);
      } catch {}
    }
  }

  // 6. Fetch from Google CDN / Thumbnail endpoint and persist to local cache (<100ms)
  try {
    const targetUrl = `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w800`;
    const upstream = await fetch(targetUrl, {
      signal: AbortSignal.timeout(3000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (upstream.ok && upstream.headers.get('content-type')?.includes('image')) {
      const buffer = Buffer.from(await upstream.arrayBuffer());
      const mime = upstream.headers.get('content-type') || 'image/jpeg';
      const etag = `"${fileId}"`;
      setMemoryImageCache(fileId, { buffer, contentType: mime, etag });
      try { fs.writeFileSync(cachePath, buffer); } catch {}
      res.setHeader('Content-Type', mime);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('ETag', etag);
      return res.send(buffer);
    }

    // Fallback to lh3 CDN
    const lh3Url = `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}`;
    const lh3Res = await fetch(lh3Url, { signal: AbortSignal.timeout(3000) });
    if (lh3Res.ok && lh3Res.headers.get('content-type')?.includes('image')) {
      const buffer = Buffer.from(await lh3Res.arrayBuffer());
      const mime = lh3Res.headers.get('content-type') || 'image/jpeg';
      const etag = `"${fileId}"`;
      setMemoryImageCache(fileId, { buffer, contentType: mime, etag });
      try { fs.writeFileSync(cachePath, buffer); } catch {}
      res.setHeader('Content-Type', mime);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('ETag', etag);
      return res.send(buffer);
    }

    // Fallback to Google download stream
    const dlUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
    const dlRes = await fetch(dlUrl, {
      signal: AbortSignal.timeout(3500),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (dlRes.ok && !dlRes.headers.get('content-type')?.includes('text/html')) {
      const buffer = Buffer.from(await dlRes.arrayBuffer());
      const mime = dlRes.headers.get('content-type') || 'image/jpeg';
      const etag = `"${fileId}"`;
      setMemoryImageCache(fileId, { buffer, contentType: mime, etag });
      try { fs.writeFileSync(cachePath, buffer); } catch {}
      res.setHeader('Content-Type', mime);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('ETag', etag);
      return res.send(buffer);
    }

    return res.redirect(`https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`);
  } catch (err) {
    return res.redirect(`https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`);
  }
});

// 6. Test Google Spreadsheet & Drive Connection from Server
app.get('/api/gas/test-connection', async (req: Request, res: Response) => {
  const settings = serverDb.settings;
  const gasUrl = (req.query.gas_url as string) || settings.gas_web_app_url;
  const ssId = (req.query.spreadsheet_id as string) || settings.spreadsheet_id;
  const driveId = (req.query.drive_id as string) || settings.drive_root_folder_id;

  if (!gasUrl || !gasUrl.startsWith('http')) {
    return res.status(400).json({
      success: false,
      message: 'URL Google Apps Script Web App belum diisi.',
    });
  }

  try {
    const testUrl = `${gasUrl}?action=testSheets&spreadsheet_id=${encodeURIComponent(ssId)}&folder_id=${encodeURIComponent(driveId)}`;
    const response = await fetch(testUrl);
    const parsed = await parseGasJsonResponse(response);
    if (!parsed.isJson) {
      return res.status(502).json({
        success: false,
        message: parsed.isHtml
          ? 'Google Apps Script mengembalikan halaman HTML (otorisasi ditolak/Login Google). Pastikan Web App di-Deploy dengan opsi "Who has access: Anyone".'
          : 'Google Apps Script mengembalikan respons non-JSON.',
        hint: 'Pastikan Anda telah menyalin dan men-Deploy seluruh kode Google Apps Script dari tab "Kode Script Google (Code.gs)" di menu Konfigurasi dengan opsi "Who has access: Anyone".',
      });
    }
    res.json(parsed.data);
  } catch (err: any) {
    res.status(502).json({
      success: false,
      message: `Gagal menghubungi URL Google Apps Script: ${err?.message || 'Server GAS tidak merespons'}`,
      hint: 'Pastikan Anda telah menyalin dan men-Deploy seluruh kode Google Apps Script dari tab "Kode Script Google (Code.gs)" di menu Konfigurasi.',
    });
  }
});

// 7. Delete Single File/Document from Drive & Server with full cascade cleanup
app.post('/api/gas/delete-file', async (req: Request, res: Response) => {
  try {
    const {
      drive_file_id,
      document_id,
      registration_number,
      document_type,
      file_url,
      local_url,
      is_account,
      account_id,
      is_school_logo,
      school_id,
      is_app_logo,
    } = req.body;
    const settings = serverDb.settings || {};
    const gasUrl = req.body.gas_web_app_url || settings.gas_web_app_url;
    const ssId = req.body.spreadsheet_id || settings.spreadsheet_id;

    // 1. Extract Drive ID if not explicitly provided
    let effectiveDriveId = extractDriveFileId(drive_file_id || file_url);

    // 2. Look up in serverDb.documents if drive ID or docType is missing
    let docType = document_type;
    let regNumber = registration_number;
    const targetNormType = docType ? normalizeDocType(docType) : '';
    if (serverDb.documents && Array.isArray(serverDb.documents)) {
      const targetDoc = serverDb.documents.find(
        (d: any) =>
          (document_id && d.document_id === document_id) ||
          (effectiveDriveId && (d.drive_file_id === effectiveDriveId || (d.drive_url && d.drive_url.includes(effectiveDriveId)))) ||
          (registration_number && targetNormType && d.registration_number === registration_number && normalizeDocType(d.document_type) === targetNormType)
      );
      if (targetDoc) {
        if (!effectiveDriveId && targetDoc.drive_file_id) effectiveDriveId = targetDoc.drive_file_id;
        if (!effectiveDriveId && targetDoc.drive_url) effectiveDriveId = extractDriveFileId(targetDoc.drive_url);
        if (!docType) docType = targetDoc.document_type;
        if (!regNumber) regNumber = targetDoc.registration_number;
      }
    }

    // 3. Clean up local disk file & in-memory caches
    cleanupLocalFileAndCache(effectiveDriveId, local_url);

    // 4. Remove document from serverDb
    const effectiveNormType = docType ? normalizeDocType(docType) : '';
    if (serverDb.documents && Array.isArray(serverDb.documents)) {
      serverDb.documents = deduplicateDocs(
        serverDb.documents.filter((d: any) => {
          if (document_id && d.document_id === document_id) return false;
          if (effectiveDriveId && (d.drive_file_id === effectiveDriveId || (d.drive_url && d.drive_url.includes(effectiveDriveId)))) return false;
          if (regNumber && effectiveNormType && d.registration_number === regNumber && normalizeDocType(d.document_type) === effectiveNormType) return false;
          return true;
        })
      );
    }

    // 5. If deleted file was a student/user photo, clear photo_url in students & users
    const isPhoto = is_account || docType === 'foto' || docType === 'pas_foto' || docType === 'foto_profil' || req.body.logo_type === 'user';
    if (isPhoto) {
      if (serverDb.students) {
        if (Array.isArray(serverDb.students)) {
          for (const std of serverDb.students) {
            if ((regNumber && (std.registration_number === regNumber || std.student_id === regNumber)) ||
                (effectiveDriveId && std.photo_url && std.photo_url.includes(effectiveDriveId))) {
              std.photo_url = '';
            }
          }
        } else if (typeof serverDb.students === 'object') {
          for (const key of Object.keys(serverDb.students)) {
            const std = serverDb.students[key];
            if (std && ((regNumber && (key === regNumber || std.registration_number === regNumber || std.student_id === regNumber)) ||
                (effectiveDriveId && std.photo_url && std.photo_url.includes(effectiveDriveId)))) {
              std.photo_url = '';
            }
          }
        }
      }
      if (serverDb.users && Array.isArray(serverDb.users)) {
        const targetUserId = account_id || regNumber;
        for (const usr of serverDb.users) {
          if ((targetUserId && (usr.user_id === targetUserId || usr.email === targetUserId || usr.registration_number === targetUserId)) ||
              (effectiveDriveId && usr.photo_url && usr.photo_url.includes(effectiveDriveId))) {
            usr.photo_url = '';
          }
        }
      }
    }

    // 6. If school logo deleted, clear logo_url in schools
    const isSchool = is_school_logo || docType === 'logo_sekolah' || req.body.logo_type === 'school' || school_id;
    if (isSchool && serverDb.schools && Array.isArray(serverDb.schools)) {
      for (const sch of serverDb.schools) {
        if ((school_id && sch.school_id === school_id) ||
            (effectiveDriveId && sch.logo_url && sch.logo_url.includes(effectiveDriveId))) {
          sch.logo_url = '';
        }
      }
    }

    // 7. If app logo deleted, clear app_logo in settings
    const isApp = is_app_logo || docType === 'logo_aplikasi' || req.body.logo_type === 'app';
    if (isApp && serverDb.settings) {
      serverDb.settings.app_logo = '';
    }

    persistServerDb();

    // 8. Forward delete action to Google Apps Script for Google Drive & Google Sheets cleanup
    let gasResult = null;
    if (gasUrl && gasUrl.startsWith('http')) {
      try {
        const gasRes = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'deleteDocument',
            spreadsheet_id: ssId,
            data: {
              drive_file_id: effectiveDriveId,
              document_id,
              registration_number: regNumber,
              document_type: docType,
              file_url,
              is_account,
              account_id,
              is_school_logo,
              school_id,
              is_app_logo,
            },
          }),
        });
        const parsed = await parseGasJsonResponse(gasRes);
        gasResult = parsed.data;
      } catch (gasErr) {
        console.warn('Gagal menghapus file di GAS Drive:', gasErr);
      }
    }

    res.json({
      success: true,
      message: 'Berkas berhasil dihapus dari Google Drive, Google Sheets, dan server database.',
      drive_file_id: effectiveDriveId,
      gas_synced: !!gasResult?.success,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: `Gagal menghapus file: ${err?.message || 'Error'}` });
  }
});

// 8. Delete Application with Cascade Cleanup (Drive Files & All Sheets Tables)
app.post('/api/data/delete-application', async (req: Request, res: Response) => {
  try {
    const { registration_number, student_id, drive_file_ids } = req.body;
    if (!registration_number) {
      return res.status(400).json({ success: false, message: 'Nomor pendaftaran diperlukan.' });
    }

    const settings = serverDb.settings || {};
    const gasUrl = req.body.gas_web_app_url || settings.gas_web_app_url;
    const ssId = req.body.spreadsheet_id || settings.spreadsheet_id;

    // Collect all drive_file_ids for this application if not provided
    const fileIdsToDelete: string[] = Array.isArray(drive_file_ids) ? [...drive_file_ids] : [];
    if (serverDb.documents) {
      serverDb.documents.forEach((d: any) => {
        if (d.registration_number === registration_number) {
          if (d.drive_file_id && !fileIdsToDelete.includes(d.drive_file_id)) {
            fileIdsToDelete.push(d.drive_file_id);
          }
          if (d.local_url) {
            const fileName = path.basename(d.local_url);
            const filePath = path.join(UPLOAD_DIR, fileName);
            if (fs.existsSync(filePath)) {
              try { fs.unlinkSync(filePath); } catch (e) {}
            }
          }
        }
      });
      // Remove documents
      serverDb.documents = serverDb.documents.filter((d: any) => d.registration_number !== registration_number);
    }

    // Clean serverDb entities
    if (serverDb.applications) {
      serverDb.applications = serverDb.applications.filter((a: any) => a.registration_number !== registration_number);
    }
    if (serverDb.students && serverDb.students[registration_number]) {
      const sId = serverDb.students[registration_number].student_id;
      delete serverDb.students[registration_number];
      if (sId) {
        if (serverDb.parents && serverDb.parents[sId]) delete serverDb.parents[sId];
        if (serverDb.school_origins && serverDb.school_origins[sId]) delete serverDb.school_origins[sId];
        if (serverDb.addresses && serverDb.addresses[sId]) delete serverDb.addresses[sId];
      }
    }
    if (student_id) {
      if (serverDb.parents && serverDb.parents[student_id]) delete serverDb.parents[student_id];
      if (serverDb.school_origins && serverDb.school_origins[student_id]) delete serverDb.school_origins[student_id];
      if (serverDb.addresses && serverDb.addresses[student_id]) delete serverDb.addresses[student_id];
    }
    if (serverDb.users) {
      serverDb.users = serverDb.users.filter((u: any) => u.registration_number !== registration_number);
    }

    persistServerDb();

    // 1. Try forwarding targeted delete to Google Apps Script (handles Google Drive file deletion)
    let gasResult = null;
    if (gasUrl && gasUrl.startsWith('http')) {
      try {
        const gasRes = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'deleteApplication',
            spreadsheet_id: ssId,
            drive_root_folder_id: settings.drive_root_folder_id,
            data: {
              registration_number,
              student_id,
              drive_file_ids: fileIdsToDelete,
            },
          }),
        });
        const parsed = await parseGasJsonResponse(gasRes);
        gasResult = parsed.data;
      } catch (gasErr: any) {
        console.warn('Gagal menghapus aplikasi di GAS:', gasErr?.message);
      }
    }

    // 2. Guarantee full spreadsheet purge via syncAllData so the student NEVER reappears on refresh or multi-device pull
    await forwardSyncAllToGas().catch((e) => console.warn('Purge syncAllData after delete warning:', e?.message));

    res.json({
      success: true,
      message: `Data pendaftaran ${registration_number} dan semua file di Google Drive serta database berhasil dihapus otomatis secara permanen.`,
      gas_synced: true,
      deleted_file_ids: fileIdsToDelete,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: `Gagal menghapus data: ${err?.message || 'Error'}` });
  }
});

// 9. Cascade Delete School & Associated Files
app.post('/api/data/delete-school', async (req: Request, res: Response) => {
  try {
    const { school_id, registration_numbers, drive_file_ids } = req.body;
    const settings = serverDb.settings || {};
    const gasUrl = req.body.gas_web_app_url || settings.gas_web_app_url;
    const ssId = req.body.spreadsheet_id || settings.spreadsheet_id;

    if (serverDb.schools) {
      serverDb.schools = serverDb.schools.filter((s: any) => s.school_id !== school_id);
    }

    // Clean up local files and memory cache for drive_file_ids
    if (Array.isArray(drive_file_ids)) {
      for (const fId of drive_file_ids) {
        if (fId) cleanupLocalFileAndCache(fId);
      }
    }

    // Remove school's associated applications, documents, students, and users from serverDb
    const regSet = new Set(Array.isArray(registration_numbers) ? registration_numbers : []);
    if (serverDb.documents && Array.isArray(serverDb.documents)) {
      serverDb.documents = serverDb.documents.filter((d: any) => {
        if (regSet.has(d.registration_number)) {
          if (d.local_url) cleanupLocalFileAndCache(d.drive_file_id, d.local_url);
          return false;
        }
        return true;
      });
    }
    if (serverDb.applications && Array.isArray(serverDb.applications)) {
      serverDb.applications = serverDb.applications.filter((a: any) => a.school_id !== school_id && !regSet.has(a.registration_number));
    }
    if (serverDb.students && typeof serverDb.students === 'object') {
      for (const reg of regSet) {
        if (serverDb.students[reg]) {
          const sId = serverDb.students[reg].student_id;
          delete serverDb.students[reg];
          if (sId) {
            if (serverDb.parents && serverDb.parents[sId]) delete serverDb.parents[sId];
            if (serverDb.school_origins && serverDb.school_origins[sId]) delete serverDb.school_origins[sId];
            if (serverDb.addresses && serverDb.addresses[sId]) delete serverDb.addresses[sId];
          }
        }
      }
    }
    if (serverDb.users && Array.isArray(serverDb.users)) {
      serverDb.users = serverDb.users.filter((u: any) => u.school_id !== school_id && !regSet.has(u.registration_number));
    }
    persistServerDb();

    if (gasUrl && gasUrl.startsWith('http')) {
      try {
        await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'deleteSchool',
            spreadsheet_id: ssId,
            data: { school_id, registration_numbers, drive_file_ids },
          }),
        });
      } catch (e) {}
    }

    // Full spreadsheet purge
    await forwardSyncAllToGas().catch(() => {});

    res.json({ success: true, message: 'Data madrasah dan file terkait berhasil dihapus permanen.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Error' });
  }
});

// 10. Delete User Account
app.post('/api/data/delete-user', async (req: Request, res: Response) => {
  try {
    const { user_id, registration_number } = req.body;
    const settings = serverDb.settings || {};
    const gasUrl = req.body.gas_web_app_url || settings.gas_web_app_url;
    const ssId = req.body.spreadsheet_id || settings.spreadsheet_id;

    if (serverDb.users) {
      serverDb.users = serverDb.users.filter((u: any) => u.user_id !== user_id);
    }
    persistServerDb();

    if (gasUrl && gasUrl.startsWith('http')) {
      try {
        await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'deleteUser',
            spreadsheet_id: ssId,
            data: { user_id, registration_number },
          }),
        });
      } catch (e) {}
    }

    // Full spreadsheet purge
    await forwardSyncAllToGas().catch(() => {});

    res.json({ success: true, message: 'Akun berhasil dihapus permanen.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Error' });
  }
});

// 11. Direct Reset Password to Server DB & Google Sheets
app.post('/api/data/reset-password', async (req: Request, res: Response) => {
  try {
    const { user_id, registration_number, email, new_password } = req.body;
    if (!new_password) {
      return res.status(400).json({ success: false, message: 'new_password wajib diisi' });
    }

    const settings = serverDb.settings || {};
    const gasUrl = req.body.gas_web_app_url || settings.gas_web_app_url;
    const ssId = req.body.spreadsheet_id || settings.spreadsheet_id;

    // Update in server database memory & persist
    if (serverDb.users && Array.isArray(serverDb.users)) {
      const idx = serverDb.users.findIndex((u: any) =>
        (user_id && u.user_id === user_id) ||
        (registration_number && u.registration_number === registration_number) ||
        (email && String(u.email || '').toLowerCase() === String(email || '').toLowerCase())
      );
      if (idx >= 0) {
        serverDb.users[idx].password_hash = new_password;
        serverDb.users[idx].updated_at = new Date().toISOString();
        persistServerDb();
      }
    }

    // Direct GAS trigger for sheet Users update
    if (gasUrl && gasUrl.startsWith('http')) {
      try {
        await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'resetPassword',
            spreadsheet_id: ssId,
            data: {
              user_id,
              registration_number,
              email,
              new_password,
            },
          }),
        });
      } catch (gasErr) {
        console.warn('Direct GAS resetPassword warning:', gasErr);
      }
    }

    // Async forward sync to ensure full data parity
    forwardSyncAllToGas().catch(() => {});

    res.json({
      success: true,
      message: 'Kata sandi baru berhasil disimpan di database server & Google Sheets.',
      new_password,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Error' });
  }
});

// ================= VITE MIDDLEWARE / STATIC ASSETS =================
async function startServer() {
  try {
    if (process.env.NODE_ENV !== 'production') {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(
        express.static(distPath, {
          maxAge: 31536000000,
          immutable: true,
          etag: true,
          lastModified: true,
          setHeaders: (res, filePath) => {
            if (filePath.endsWith('index.html')) {
              res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
            } else {
              res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            }
          },
        })
      );
      app.get('*', (req: Request, res: Response) => {
        const indexPath = path.join(distPath, 'index.html');
        if (fs.existsSync(indexPath)) {
          res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
          res.sendFile(indexPath);
        } else {
          res.status(200).send('SIPMA Server Ready');
        }
      });
    }

    const server = app.listen(PORT, HOST, () => {
      console.log(`SIPMA Server running on http://${HOST}:${PORT}`);
    });

    server.on('error', (err: any) => {
      console.error('[SIPMA Server] Listen error:', err);
    });

    // Optimize keep-alive timeouts for high concurrent traffic and Cloud Run reverse proxy
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;

    const shutdown = (signal: string) => {
      console.log(`[SIPMA Server] Received ${signal}, gracefully shutting down...`);
      flushServerDbSync();
      server.close(() => {
        console.log('[SIPMA Server] Closed HTTP server.');
        process.exit(0);
      });
      setTimeout(() => {
        console.error('[SIPMA Server] Forcing shutdown.');
        process.exit(0);
      }, 5000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('[SIPMA Server] Critical failure starting server:', err);
  }
}

// In production on Vercel/serverless, startServer() is skipped because Vercel invokes the exported app handler directly
if (!isVercel) {
  startServer();
}

export { app };
export default app;
