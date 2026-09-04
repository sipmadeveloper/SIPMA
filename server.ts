import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;
const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'server_db.json');

// Enable JSON body parsing with large limit for base64 documents (up to 30MB)
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Ensure data & upload directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Serve static uploads
app.use('/uploads', express.static(UPLOAD_DIR));

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
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch (err) {
      console.error('Error loading server_db.json:', err);
    }
  }

  // Default server settings with environment variable fallbacks
  const envGas = process.env.VITE_GAS_WEB_APP_URL || process.env.GAS_WEB_APP_URL || '';
  const envSs = process.env.VITE_SPREADSHEET_ID || process.env.SPREADSHEET_ID || '';
  const envDrive = process.env.VITE_DRIVE_ROOT_FOLDER_ID || process.env.DRIVE_ROOT_FOLDER_ID || '';
  const envMaps = process.env.VITE_MAPS_API_KEY || process.env.MAPS_API_KEY || '';

  const initialSettings = {
    spreadsheet_id: envSs || '1aBcDeFgHiJkLmNoPqRsTuVwXyZ_SIPMA2026_SampleID',
    drive_root_folder_id: envDrive || '1FolderId_SIPMA_Root_SampleStorage',
    gas_web_app_url: envGas || '',
    maps_api_key: envMaps || '',
    application_year: '2027',
    academic_year_label: '2027/2028',
    app_name: 'SIPMA',
    app_tagline: 'Sistem Penerimaan Murid Madrasah',
    app_logo: '',
    default_school_id: 'SCH-MAN1',
    max_file_size_mb: 5,
    registration_open: true,
    announcement_open: true,
    demo_mode: true,
    db_config_locked: true,
    db_config_pin: '123456',
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

function persistServerDb() {
  try {
    serverDb.last_updated = new Date().toISOString();
    fs.writeFileSync(DB_FILE, JSON.stringify(serverDb, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error persisting server_db.json:', err);
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
      const json = await postRes.json();
      if (json && json.success && json.data) {
        return { success: true, data: json.data, message: json.message };
      }
    }

    // Fallback to GET with query params
    const getUrl = `${gasUrl}?action=pullAllData&spreadsheet_id=${encodeURIComponent(spreadsheetId)}`;
    const getRes = await fetch(getUrl, { signal: AbortSignal.timeout(15000) });
    if (getRes.ok) {
      const json = await getRes.json();
      if (json && json.success && json.data) {
        return { success: true, data: json.data, message: json.message };
      }
    }

    return { success: false, message: 'Google Apps Script tidak mengembalikan data valid.' };
  } catch (err: any) {
    return { success: false, message: `Gagal menarik data dari GAS: ${err?.message || 'Timeout / Network Error'}` };
  }
}

const DEMO_STUDENT_IDS = new Set(['STD-001', 'STD-002', 'STD-003', 'STD-004', 'STD-005', 'STD-006']);
const DEMO_REG_PREFIX = 'SIPMA-MAN01-00000';

function isDemoStudentRecord(regOrKey: string, stdId?: string): boolean {
  if (regOrKey && typeof regOrKey === 'string' && regOrKey.startsWith(DEMO_REG_PREFIX)) return true;
  if (stdId && DEMO_STUDENT_IDS.has(stdId)) return true;
  if (regOrKey && DEMO_STUDENT_IDS.has(regOrKey)) return true;
  return false;
}

// Function to update serverDb from pulled GAS data
function mergeGasDataIntoServerDb(gasData: any): boolean {
  if (!gasData || typeof gasData !== 'object') return false;
  let mutated = false;

  if (gasData.users && Array.isArray(gasData.users) && gasData.users.length > 0) {
    serverDb.users = gasData.users.filter((u: any) => u.role !== 'calon_murid' || !isDemoStudentRecord(u?.registration_number));
    mutated = true;
  }
  if (gasData.students && typeof gasData.students === 'object') {
    const cleanStudents: Record<string, any> = {};
    for (const [k, v] of Object.entries(gasData.students)) {
      if (!isDemoStudentRecord(k, (v as any)?.student_id)) {
        cleanStudents[k] = v;
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
    serverDb.documents = gasData.documents.filter((d: any) => !isDemoStudentRecord(d?.registration_number, d?.student_id));
    mutated = true;
  }
  if (gasData.schools && Array.isArray(gasData.schools) && gasData.schools.length > 0) {
    serverDb.schools = gasData.schools;
    mutated = true;
  }
  if (gasData.announcements && Array.isArray(gasData.announcements)) {
    serverDb.announcements = gasData.announcements;
    mutated = true;
  }
  if (gasData.settings && typeof gasData.settings === 'object' && Object.keys(gasData.settings).length > 0) {
    serverDb.settings = { ...serverDb.settings, ...gasData.settings };
    mutated = true;
  }

  if (mutated) {
    persistServerDb();
  }
  return mutated;
}

// Async boot hydration from Google Apps Script if URL configured
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

// ================= API ROUTES =================

// 1. Health Check
app.get('/api/health', (req: Request, res: Response) => {
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
  const gasUrl = serverDb.settings?.gas_web_app_url;
  const ssId = serverDb.settings?.spreadsheet_id;

  // Auto-pull from GAS if requested or if server memory is empty but GAS URL exists
  if ((forcePull || (serverDb.applications.length === 0 && serverDb.users.length <= 2)) && gasUrl && gasUrl.startsWith('http')) {
    try {
      const gasResult = await pullDataFromGasDirectly(gasUrl, ssId || '');
      if (gasResult.success && gasResult.data) {
        mergeGasDataIntoServerDb(gasResult.data);
      }
    } catch {
      // continue returning existing serverDb
    }
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
      serverDb.users = payload.users.filter((u: any) => u.role !== 'calon_murid' || !isDemoStudentRecord(u?.registration_number));
    }
    if (payload.students !== undefined && typeof payload.students === 'object') {
      const cleanStudents: Record<string, any> = {};
      for (const [k, v] of Object.entries(payload.students)) {
        if (!isDemoStudentRecord(k, (v as any)?.student_id)) {
          cleanStudents[k] = v;
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
      serverDb.documents = payload.documents.filter((d: any) => !isDemoStudentRecord(d?.registration_number, d?.student_id));
    }
    if (payload.schools !== undefined && Array.isArray(payload.schools)) {
      serverDb.schools = payload.schools;
    }
    if (payload.announcements !== undefined && Array.isArray(payload.announcements)) {
      serverDb.announcements = payload.announcements;
    }
    if (payload.audit_logs !== undefined && Array.isArray(payload.audit_logs)) {
      serverDb.audit_logs = payload.audit_logs;
    }

    persistServerDb();

    // Auto-forward to Google Apps Script if URL is configured
    const gasUrl = serverDb.settings?.gas_web_app_url;
    let gasResult = null;
    if (gasUrl && gasUrl.startsWith('http') && payload.forwardToGas !== false) {
      try {
        const gasPayload = {
          action: 'syncAllData',
          spreadsheet_id: serverDb.settings?.spreadsheet_id,
          drive_root_folder_id: serverDb.settings?.drive_root_folder_id,
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

        gasResult = await gasRes.json();
      } catch (gasErr: any) {
        console.warn('Background GAS sync failed:', gasErr?.message);
      }
    }

    res.json({
      success: true,
      message: 'Data berhasil disinkronkan ke server dan disimpan permanen.',
      gas_synced: !!gasResult?.success,
      gas_message: gasResult?.message,
      last_updated: serverDb.last_updated,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Sync failed.' });
  }
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

    const result = await response.json();
    res.json(result);
  } catch (err: any) {
    console.error('GAS Proxy Error:', err);
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
}): string {
  let ext = '';
  if (params.originalFileName) {
    const m = params.originalFileName.match(/\.([a-zA-Z0-9]+)$/);
    if (m) ext = m[1].toLowerCase();
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

// 5. Direct Document Upload Proxy to Google Drive via GAS & Local Mirror
app.post('/api/gas/upload-file', async (req: Request, res: Response) => {
  const settings = serverDb.settings || {};
  const gasUrl = req.body.gas_web_app_url || settings.gas_web_app_url;
  const ssId = req.body.spreadsheet_id || settings.spreadsheet_id;
  const driveId = req.body.drive_root_folder_id || settings.drive_root_folder_id;

  try {
    const { doc, student_name, school_name } = req.body;
    if (!doc) {
      return res.status(400).json({ success: false, message: 'Data dokumen tidak ditemukan.' });
    }

    // Check if replacing an existing document to cleanup old files
    if (!serverDb.documents) serverDb.documents = [];
    const docIdx = serverDb.documents.findIndex(
      (d: any) =>
        d.document_id === doc.document_id ||
        (d.registration_number === doc.registration_number && d.document_type === doc.document_type)
    );
    const prevDoc = docIdx >= 0 ? serverDb.documents[docIdx] : null;

    if (prevDoc && prevDoc.local_url) {
      try {
        const oldPath = path.join(UPLOAD_DIR, path.basename(prevDoc.local_url));
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      } catch (e) {}
    }

    const standardFileName = formatStandardFileName({
      accountName: student_name || doc.student_name,
      registrationNumber: doc.registration_number,
      documentType: doc.document_type,
      documentTitle: doc.document_title,
      originalFileName: doc.file_name,
    });

    let localUrl = '';
    const safeDocName = standardFileName;

    if (doc.file_data_base64) {
      try {
        const raw = doc.file_data_base64;
        const matches = raw.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        const base64Data = matches ? matches[2] : raw.includes(',') ? raw.split(',')[1] : raw;
        const buffer = Buffer.from(base64Data, 'base64');
        const filePath = path.join(UPLOAD_DIR, safeDocName);
        fs.writeFileSync(filePath, buffer);
        localUrl = `/uploads/${safeDocName}`;
      } catch (localErr) {
        console.warn('Gagal menyimpan salinan file lokal:', localErr);
      }
    }

    let driveFileId = '';
    let driveUrl = localUrl;
    let viewUrl = localUrl;
    let gasSuccess = false;

    if (gasUrl && gasUrl.startsWith('http')) {
      try {
        const uploadPayload = {
          action: 'uploadDocument',
          spreadsheet_id: ssId,
          drive_root_folder_id: driveId,
          data: {
            registration_number: doc.registration_number,
            student_name: student_name || 'Calon Murid',
            school_name: school_name || 'Madrasah',
            document_type: doc.document_type,
            document_title: doc.document_title,
            file_name: standardFileName,
            file_size_kb: doc.file_size_kb || Math.round((doc.file_size_bytes || 0) / 1024),
            file_size_bytes: doc.file_size_bytes,
            mime_type: doc.mime_type,
            base64_data: doc.file_data_base64,
            old_drive_file_id: prevDoc?.drive_file_id || '',
          },
        };

        const response = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(uploadPayload),
        });

        const gasResult = await response.json();
        if (gasResult && gasResult.success) {
          gasSuccess = true;
          const fInfo = gasResult.file || gasResult.data || {};
          driveFileId = fInfo.drive_file_id || '';
          driveUrl = fInfo.thumbnail_url || (driveFileId ? `https://lh3.googleusercontent.com/d/${driveFileId}` : '') || fInfo.drive_url || fInfo.view_url || localUrl;
          viewUrl = fInfo.view_url || fInfo.thumbnail_url || driveUrl || localUrl;
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
        (d.registration_number === doc.registration_number && d.document_type === doc.document_type)
    );

    const effectiveDriveUrl = driveUrl || (driveFileId ? `https://lh3.googleusercontent.com/d/${driveFileId}` : '') || (targetDocIdx >= 0 ? serverDb.documents[targetDocIdx].drive_url : localUrl);

    const updatedDocItem = {
      ...doc,
      file_name: standardFileName,
      drive_file_id: driveFileId || (targetDocIdx >= 0 ? serverDb.documents[targetDocIdx].drive_file_id : ''),
      drive_url: effectiveDriveUrl,
      local_url: localUrl,
      upload_time: new Date().toISOString(),
    };

    if (targetDocIdx >= 0) {
      serverDb.documents[targetDocIdx] = { ...serverDb.documents[targetDocIdx], ...updatedDocItem };
    } else {
      serverDb.documents.push(updatedDocItem);
    }

    // If it's a student photo, update student photo_url & user record
    if (doc.document_type === 'foto' || doc.document_type === 'pas_foto') {
      const studentPhotoUrl = effectiveDriveUrl || localUrl;
      if (serverDb.students && serverDb.students[doc.registration_number]) {
        serverDb.students[doc.registration_number].photo_url = studentPhotoUrl;
      }
      if (serverDb.users) {
        const u = serverDb.users.find((usr: any) => usr.registration_number === doc.registration_number);
        if (u) {
          u.photo_url = studentPhotoUrl;
        }
      }
    }

    persistServerDb();

    return res.json({
      success: true,
      message: gasSuccess
        ? 'Berkas berhasil diunggah & tersimpan aman di Google Drive!'
        : 'Berkas berhasil disimpan di server penyimpanan.',
      gas_synced: gasSuccess,
      file: {
        document_id: doc.document_id,
        file_name: standardFileName,
        drive_file_id: driveFileId,
        drive_url: effectiveDriveUrl,
        local_url: localUrl,
        view_url: viewUrl,
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
  const settings = serverDb.settings || {};
  const gasUrl = req.body.gas_web_app_url || settings.gas_web_app_url;
  const ssId = req.body.spreadsheet_id || settings.spreadsheet_id;
  const driveId = req.body.drive_root_folder_id || settings.drive_root_folder_id;

  try {
    const { logo_type, id, name, base64_data, file_name } = req.body;
    if (!base64_data) {
      return res.status(400).json({ success: false, message: 'Data gambar logo tidak ditemukan.' });
    }

    let localUrl = '';
    const safeLogoName = `logo_${logo_type || 'custom'}_${(id || 'sys').replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}_${(file_name || 'logo.png').replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    try {
      const raw = base64_data;
      const matches = raw.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      const dataContent = matches ? matches[2] : raw.includes(',') ? raw.split(',')[1] : raw;
      const buffer = Buffer.from(dataContent, 'base64');
      const filePath = path.join(UPLOAD_DIR, safeLogoName);
      fs.writeFileSync(filePath, buffer);
      localUrl = `/uploads/${safeLogoName}`;
    } catch (localErr) {
      console.warn('Gagal menyimpan logo lokal:', localErr);
    }

    let driveFileId = '';
    let driveUrl = localUrl;
    let gasSuccess = false;

    if (gasUrl && gasUrl.startsWith('http')) {
      try {
        const uploadPayload = {
          action: 'uploadDocument',
          spreadsheet_id: ssId,
          drive_root_folder_id: driveId,
          data: {
            registration_number: logo_type === 'school' ? (id || 'SCHOOL') : 'SYSTEM',
            student_name: name || 'Logo SIPMA',
            school_name: logo_type === 'school' ? (name || 'Madrasah') : 'Branding SIPMA',
            document_type: logo_type === 'school' ? 'logo_sekolah' : 'logo_aplikasi',
            document_title: logo_type === 'school' ? `Logo Resmi ${name}` : 'Logo Aplikasi SIPMA',
            file_name: file_name || safeLogoName,
            base64_data: base64_data,
          },
        };

        const response = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(uploadPayload),
        });

        const gasResult = await response.json();
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

    const finalLogoUrl = driveUrl || (driveFileId ? `https://lh3.googleusercontent.com/d/${driveFileId}` : '') || localUrl;

    if (logo_type === 'school' && id) {
      if (serverDb.schools && Array.isArray(serverDb.schools)) {
        const sch = serverDb.schools.find((s: any) => s.school_id === id);
        if (sch) {
          sch.logo_url = finalLogoUrl;
        }
      }
    } else if (logo_type === 'app') {
      if (!serverDb.settings) serverDb.settings = {};
      serverDb.settings.app_logo = finalLogoUrl;
    }

    persistServerDb();

    return res.json({
      success: true,
      message: gasSuccess ? 'Logo berhasil diunggah dan tersimpan di Google Drive!' : 'Logo berhasil disimpan.',
      logo_url: finalLogoUrl,
      drive_file_id: driveFileId,
      local_url: localUrl,
      gas_synced: gasSuccess,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: `Gagal mengunggah logo: ${err?.message || 'Error'}` });
  }
});

// 5c. High-Speed Google Drive Image Proxy / Fallback Stream
app.get('/api/drive/image/:fileId', async (req: Request, res: Response) => {
  const { fileId } = req.params;
  if (!fileId || fileId.includes('..') || fileId.length < 5) {
    return res.status(400).send('Invalid file ID');
  }

  // 1. Check if we have local copy in uploads
  try {
    const files = fs.readdirSync(UPLOAD_DIR);
    const matched = files.find((f) => f.includes(fileId));
    if (matched) {
      return res.sendFile(path.join(UPLOAD_DIR, matched));
    }
  } catch {}

  // 2. Fetch from Google CDN / Thumbnail endpoint
  try {
    const targetUrl = `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1200`;
    const upstream = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (upstream.ok && upstream.headers.get('content-type')?.includes('image')) {
      const buffer = await upstream.arrayBuffer();
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.send(Buffer.from(buffer));
    }

    // Fallback to lh3 CDN
    const lh3Url = `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}`;
    const lh3Res = await fetch(lh3Url);
    if (lh3Res.ok && lh3Res.headers.get('content-type')?.includes('image')) {
      const buffer = await lh3Res.arrayBuffer();
      res.setHeader('Content-Type', lh3Res.headers.get('content-type') || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.send(Buffer.from(buffer));
    }

    // Redirect to direct drive stream as ultimate fallback
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
    const result = await response.json();
    res.json(result);
  } catch (err: any) {
    res.status(502).json({
      success: false,
      message: `Gagal menghubungi URL Google Apps Script: ${err?.message || 'Server GAS tidak merespons'}`,
      hint: 'Pastikan Anda telah menyalin dan men-Deploy seluruh kode Google Apps Script dari tab "Kode Script Google (Code.gs)" di menu Konfigurasi.',
    });
  }
});

// 7. Delete Single File/Document from Drive & Server
app.post('/api/gas/delete-file', async (req: Request, res: Response) => {
  try {
    const { drive_file_id, document_id, registration_number, local_url } = req.body;
    const settings = serverDb.settings || {};
    const gasUrl = req.body.gas_web_app_url || settings.gas_web_app_url;
    const ssId = req.body.spreadsheet_id || settings.spreadsheet_id;

    // 1. Delete local file from disk if present
    if (local_url && typeof local_url === 'string') {
      const fileName = path.basename(local_url);
      const filePath = path.join(UPLOAD_DIR, fileName);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) {}
      }
    }

    // 2. Remove document from serverDb
    if (serverDb.documents) {
      serverDb.documents = serverDb.documents.filter((d: any) => {
        if (document_id && d.document_id === document_id) return false;
        if (drive_file_id && d.drive_file_id === drive_file_id) return false;
        return true;
      });
      persistServerDb();
    }

    // 3. Forward delete action to Google Apps Script if configured
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
              drive_file_id,
              document_id,
              registration_number,
            },
          }),
        });
        gasResult = await gasRes.json();
      } catch (gasErr) {
        console.warn('Gagal menghapus file di GAS Drive:', gasErr);
      }
    }

    res.json({
      success: true,
      message: 'Berkas berhasil dihapus dari server dan Google Drive.',
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

    // Forward delete to Google Apps Script
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
        gasResult = await gasRes.json();
      } catch (gasErr: any) {
        console.warn('Gagal menghapus aplikasi di GAS:', gasErr?.message);
      }
    }

    res.json({
      success: true,
      message: `Data pendaftaran ${registration_number} dan semua file di Google Drive serta database berhasil dihapus otomatis.`,
      gas_synced: !!gasResult?.success,
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

    res.json({ success: true, message: 'Data madrasah dan file terkait berhasil dihapus.' });
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

    res.json({ success: true, message: 'Akun berhasil dihapus.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Error' });
  }
});

// ================= VITE MIDDLEWARE / STATIC ASSETS =================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SIPMA Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
