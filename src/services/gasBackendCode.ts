/**
 * Complete Google Apps Script (GAS) Backend Code Generator and Documentation
 * This code can be copied directly into script.google.com and deployed as a Web App.
 * Provides automatic database initialization, schema creation, seed population, and realtime bidirectional sync.
 */

export const GAS_BACKEND_CODE = `/**
 * =========================================================================
 * SIPMA - SISTEM PENERIMAAN MURID MADRASAH
 * Google Apps Script Backend (Code.gs)
 * =========================================================================
 * Versi: 2.0.0 Production Auto-Database & Auto-Update Engine
 * Integrasi: Google Sheets (Database Otomatis) & Google Drive (File Storage)
 * Fitur:
 *   - Auto-Create Database: Membuat seluruh sheet, kolom header, dan data awal secara otomatis
 *   - Auto-Update: Sinkronisasi realtime otomatis dua arah (Push & Pull)
 *   - Self-Healing: Otomatis memperbaiki atau membuat sheet yang belum ada saat dipanggil
 * =========================================================================
 */

// ================= KONFIGURASI UTAMA =================
// Masukkan ID Spreadsheet dan Folder Root Google Drive Anda di bawah ini
var SPREADSHEET_ID = "MASUKKAN_SPREADSHEET_ID_ANDA_DI_SINI";
var DRIVE_ROOT_FOLDER_ID = "MASUKKAN_DRIVE_ROOT_FOLDER_ID_ANDA_DI_SINI";
/**
 * Helper Membuka atau Menghubungkan Google Spreadsheet secara Cerdas & Mandiri (Self-Healing)
 */
function getOrOpenSpreadsheet(targetSpreadsheetId) {
  var ss = null;
  var tid = String(targetSpreadsheetId || "").trim();
  if (tid && tid.indexOf("MASUKKAN") === -1 && tid.indexOf("Sample") === -1 && tid.length > 10) {
    try { ss = SpreadsheetApp.openById(tid); } catch(e) {}
  }
  if (!ss && SPREADSHEET_ID && SPREADSHEET_ID.indexOf("MASUKKAN") === -1 && SPREADSHEET_ID.indexOf("Sample") === -1 && SPREADSHEET_ID.length > 10) {
    try { ss = SpreadsheetApp.openById(SPREADSHEET_ID); } catch(e) {}
  }
  if (!ss) {
    try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch(e) {}
  }
  if (!ss) {
    try {
      var files = DriveApp.getFilesByName("SIPMA_Database_PPDB");
      while (files.hasNext()) {
        var f = files.next();
        if (!f.isTrashed()) {
          ss = SpreadsheetApp.open(f);
          break;
        }
      }
    } catch(e) {}
  }
  if (!ss) {
    try {
      ss = SpreadsheetApp.create("SIPMA_Database_PPDB");
    } catch(e) {}
  }
  return ss;
}

/**
 * Helper Membuka atau Menghubungkan Root Folder Google Drive secara Cerdas & Mandiri (Self-Healing)
 */
function getOrOpenRootFolder(targetFolderId) {
  var rootFolder = null;
  var fid = String(targetFolderId || "").trim();
  if (fid && fid.indexOf("MASUKKAN") === -1 && fid.indexOf("Sample") === -1 && fid.length > 10) {
    try { rootFolder = DriveApp.getFolderById(fid); } catch(e) {}
  }
  if (!rootFolder && DRIVE_ROOT_FOLDER_ID && DRIVE_ROOT_FOLDER_ID.indexOf("MASUKKAN") === -1 && DRIVE_ROOT_FOLDER_ID.indexOf("Sample") === -1 && DRIVE_ROOT_FOLDER_ID.length > 10) {
    try { rootFolder = DriveApp.getFolderById(DRIVE_ROOT_FOLDER_ID); } catch(e) {}
  }
  if (!rootFolder) {
    try {
      var defaultFolderName = "SIPMA_Storage_PPDB";
      var existingFolders = DriveApp.getRootFolder().getFoldersByName(defaultFolderName);
      while (existingFolders.hasNext()) {
        var ef = existingFolders.next();
        if (!ef.isTrashed()) {
          rootFolder = ef;
          break;
        }
      }
      if (!rootFolder) {
        rootFolder = DriveApp.getRootFolder().createFolder(defaultFolderName);
      }
    } catch(e) {}
  }
  return rootFolder;
}


/**
 * =========================================================================
 * FUNGSI OTORISASI GOOGLE DRIVE & GOOGLE SHEETS
 * Jalankan fungsi ini SEKALI di Google Apps Script Editor (pilih authorizePermissions lalu klik Run/Jalankan)
 * untuk memberikan izin akses Google Drive (DriveApp) dan Google Sheets (SpreadsheetApp).
 * =========================================================================
 */
function authorizePermissions() {
  try {
    var driveFolder = DriveApp.getRootFolder();
    var ss = getOrOpenSpreadsheet(SPREADSHEET_ID);
    var ssName = ss ? ss.getName() : "Spreadsheet Siap";
    Logger.log("✓ Otorisasi Berhasil! Spreadsheet: " + ssName + " | Folder Drive: " + driveFolder.getName());
    return "Otorisasi Berhasil! Izin akses Google Drive dan Google Sheets aktif.";
  } catch (e) {
    Logger.log("Error otorisasi: " + e.toString());
    return "Error: " + e.toString();
  }
}

// Nama-nama Sheet Database
var SHEETS = {
  USERS: "Users",
  STUDENTS: "Students",
  PARENTS: "Parents",
  SCHOOL_ORIGINS: "SchoolOrigins",
  ADDRESSES: "Addresses",
  APPLICATIONS: "Applications",
  DOCUMENTS: "Documents",
  SCHOOLS: "Schools",
  SETTINGS: "Settings",
  ANNOUNCEMENTS: "Announcements",
  AUDIT_LOG: "AuditLog"
};

// Definisi Struktur Kolom (Schema) Seluruh Tabel Database
var DB_SCHEMA = {
  "Users": [
    "user_id", "registration_number", "name", "email", "phone", 
    "nip", "position", "password_hash", "role", "school_id", 
    "status", "photo_url", "created_at", "updated_at"
  ],
  "Students": [
    "student_id", "user_id", "registration_number", "name", "nik", 
    "nisn", "gender", "birth_place", "birth_date", "religion", 
    "family_card_number", "child_order", "total_siblings", "family_status", 
    "hobby", "living_status", "phone", "email", "photo_url"
  ],
  "Parents": [
    "parent_id", "student_id", "father_name", "father_status", "father_nik", 
    "father_birth_place", "father_birth_date", "father_education", "father_job", "father_income", "father_phone", 
    "mother_name", "mother_status", "mother_nik", "mother_birth_place", "mother_birth_date", "mother_education", "mother_job", "mother_income", "mother_phone", 
    "guardian_name", "guardian_nik", "guardian_relation", "guardian_birth_place", "guardian_birth_date", "guardian_education", "guardian_job", "guardian_income", "guardian_phone", "guardian_address"
  ],
  "SchoolOrigins": [
    "origin_id", "student_id", "previous_level", "school_name", "npsn_nsm", 
    "school_status", "school_address", "graduation_year", "diploma_number"
  ],
  "Addresses": [
    "address_id", "student_id", "province", "city", "district", 
    "subdistrict", "neighborhood", "rt_rw", "full_address", "postal_code", 
    "latitude", "longitude"
  ],
  "Applications": [
    "application_id", "registration_number", "user_id", "student_id", "school_id", 
    "admission_year", "pathway", "submission_date", "latitude", "longitude", 
    "distance_km", "max_distance_km", "zoning_status", "verification_status", 
    "selection_status", "final_status", "verification_notes", "score", 
    "afirmasi_category", "dispensation_reason", "achievement_type", "achievement_name", 
    "achievement_level", "achievement_rank", "mutation_parent_instansi", 
    "mutation_letter_number", "mutation_letter_date", "step_completed", "is_locked", 
    "created_at", "updated_at"
  ],
  "Documents": [
    "document_id", "registration_number", "document_type", "file_name", 
    "file_size_kb", "drive_file_id", "drive_url", "upload_time", 
    "verification_status", "notes"
  ],
  "Schools": [
    "school_id", "school_name", "school_code", "nsm", "npsn", 
    "level", "address", "village", "district", "city", "province", 
    "latitude", "longitude", "zoning_radius_km", "quota_total", 
    "quota_zonasi", "quota_afirmasi", "quota_prestasi", "quota_mutasi", 
    "status", "principal_name", "contact_phone", "contact_email", "logo_url"
  ],
  "Settings": [
    "setting_key", "setting_value", "description", "updated_at"
  ],
  "Announcements": [
    "announcement_id", "title", "content", "category", "target_role", 
    "school_id", "is_published", "created_at", "author_name"
  ],
  "AuditLog": [
    "log_id", "timestamp", "user_id", "username", "role", 
    "action", "target", "description", "status"
  ]
};

/**
 * Handle HTTP GET Requests (Healthcheck, Auto-Init, Pull Data)
 */
function doGet(e) {
  var action = e && e.parameter ? e.parameter.action : "ping";
  var targetSpreadsheetId = (e && e.parameter && e.parameter.spreadsheet_id) ? e.parameter.spreadsheet_id : SPREADSHEET_ID;
  var result = { success: false, message: "Aksi tidak dikenal" };

  try {
    if (action === "ping" || action === "testConnection") {
      result = {
        success: true,
        message: "Koneksi Google Apps Script SIPMA berhasil aktif & terhubung!",
        timestamp: new Date().toISOString(),
        version: "2.0.0"
      };
    } else if (action === "testSheets") {
      var ss = getOrOpenSpreadsheet(targetSpreadsheetId);
      ensureAllSheetsExist(ss);
      result = {
        success: true,
        message: "Koneksi Google Sheets berhasil! Nama Spreadsheet: " + ss.getName(),
        sheets: ss.getSheets().map(function(s) { return s.getName(); }),
        totalSheets: ss.getSheets().length
      };
    } else if (action === "testDrive") {
      var targetFolderId = (e && e.parameter && e.parameter.folder_id) ? e.parameter.folder_id : DRIVE_ROOT_FOLDER_ID;
      var folder = DriveApp.getFolderById(targetFolderId);
      result = {
        success: true,
        message: "Koneksi Google Drive berhasil! Nama folder: " + folder.getName(),
        folderId: folder.getId()
      };
    } else if (action === "initDatabase") {
      result = initDatabaseSchema(targetSpreadsheetId);
    } else if (action === "pullAllData" || action === "pull") {
      result = handlePullAllData(targetSpreadsheetId);
    }
  } catch (err) {
    result = {
      success: false,
      message: "Terjadi kesalahan pada Server GAS: " + err.toString()
    };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle HTTP POST Requests (Auto-Sync, Save, Register, Upload, Verify)
 */
function doPost(e) {
  var response = { success: false, message: "Format request tidak valid" };
  
  try {
    var rawData = e.postData.contents;
    var payload = JSON.parse(rawData);
    var action = payload.action;
    var targetSpreadsheetId = payload.spreadsheet_id || SPREADSHEET_ID;

    switch (action) {
      case "initDatabase":
        response = initDatabaseSchema(targetSpreadsheetId);
        break;
      case "syncAllData":
      case "autoSync":
        response = handleSyncAllData(payload);
        break;
      case "pullAllData":
      case "pull":
        response = handlePullAllData(targetSpreadsheetId);
        break;
      case "saveApplication":
        response = handleSaveApplication(payload.data, targetSpreadsheetId);
        break;
      case "uploadDocument":
        response = handleUploadDocument(payload.data, payload.drive_root_folder_id || DRIVE_ROOT_FOLDER_ID, targetSpreadsheetId);
        break;
      case "sendNotificationEmail":
      case "sendEmail":
        response = handleSendNotificationEmail(payload.data, targetSpreadsheetId);
        break;
      case "verifyApplication":
        response = handleVerifyApplication(payload.data, targetSpreadsheetId);
        break;
      case "processSelection":
        response = handleProcessSelection(payload.data, targetSpreadsheetId);
        break;
      case "resetPassword":
        response = handleResetPassword(payload.data, targetSpreadsheetId);
        break;
      case "saveSchool":
        response = handleSaveSchool(payload.data, targetSpreadsheetId);
        break;
      case "saveAnnouncement":
        response = handleSaveAnnouncement(payload.data, targetSpreadsheetId);
        break;
      case "deleteApplication":
        response = handleDeleteApplication(payload.data, targetSpreadsheetId, payload.drive_root_folder_id || DRIVE_ROOT_FOLDER_ID);
        break;
      case "deleteDocument":
      case "deleteFile":
        response = handleDeleteFile(payload.data, targetSpreadsheetId);
        break;
      case "deleteSchool":
        response = handleDeleteSchool(payload.data, targetSpreadsheetId);
        break;
      case "deleteUser":
        response = handleDeleteUser(payload.data, targetSpreadsheetId);
        break;
      default:
        response = { success: false, message: "Aksi '" + action + "' tidak dikenali" };
    }
  } catch (err) {
    response = {
      success: false,
      message: "Server Error: " + err.toString()
    };
  }

  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 1. INISIALISASI DATABASE OTOMATIS (AUTO-CREATE & SELF-HEALING)
 * Membuat seluruh 11 tabel sheet, memformat warna header hijau emerald, dan mengisi data awal jika kosong.
 */
function initDatabaseSchema(spreadsheetId) {
  var targetId = spreadsheetId || SPREADSHEET_ID;
  var ss = getOrOpenSpreadsheet(targetId); if (!ss) return { success: false, message: "Spreadsheet tidak dapat dibuka" };
  var createdSheets = [];
  var existingSheets = [];

  for (var sheetName in DB_SCHEMA) {
    var headers = DB_SCHEMA[sheetName];
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      // Buat Header Row
      sheet.appendRow(headers);
      
      // Format Header Style: Emerald Green Theme
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#059669"); // Emerald-600
      headerRange.setFontColor("#ffffff");
      headerRange.setFontSize(10);
      sheet.setFrozenRows(1);

      createdSheets.push(sheetName);
    } else {
      // Pastikan baris header terpasang
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(headers);
        var hr = sheet.getRange(1, 1, 1, headers.length);
        hr.setFontWeight("bold");
        hr.setBackground("#059669");
        hr.setFontColor("#ffffff");
        sheet.setFrozenRows(1);
      }
      existingSheets.push(sheetName);
    }
  }

  // Hapus Sheet default 'Sheet1' jika ada dan sheet lain sudah terbuat
  var sheet1 = ss.getSheetByName("Sheet1");
  if (sheet1 && ss.getSheets().length > 1) {
    try { ss.deleteSheet(sheet1); } catch(e) {}
  }

  // Isi data benih (seed initial data) otomatis jika Users masih kosong
  seedInitialDataIfEmpty(ss);

  return {
    success: true,
    message: "Database SIPMA berhasil diinisialisasi secara otomatis!",
    createdSheets: createdSheets,
    existingSheets: existingSheets,
    totalTables: Object.keys(DB_SCHEMA).length,
    timestamp: new Date().toISOString()
  };
}

/**
 * Memastikan seluruh sheet tersedia sebelum operasi baca/tulis (Self-Healing)
 */
function ensureAllSheetsExist(ss) {
  for (var sheetName in DB_SCHEMA) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(DB_SCHEMA[sheetName]);
      var hr = sheet.getRange(1, 1, 1, DB_SCHEMA[sheetName].length);
      hr.setFontWeight("bold");
      hr.setBackground("#059669");
      hr.setFontColor("#ffffff");
      sheet.setFrozenRows(1);
    }
  }
}

/**
 * Mengisi data awal admin jika database baru dibuat (tanpa data madrasah/user/siswa uji coba)
 */
function seedInitialDataIfEmpty(ss) {
  var usersSheet = ss.getSheetByName(SHEETS.USERS);
  if (usersSheet && usersSheet.getLastRow() <= 1) {
    var now = new Date().toISOString();
    usersSheet.appendRow([
      "USR-ADMIN-PUSAT", "", "Administrator Pusat PPDB", "adminpusatsipma@gmail.com", "085747520003",
      "", "Admin Pusat", hashPassword("sipma123"), "admin_pusat", "",
      "active", "", now, now
    ]);
  }

  var annSheet = ss.getSheetByName(SHEETS.ANNOUNCEMENTS);
  if (annSheet && annSheet.getLastRow() <= 1) {
    annSheet.appendRow([
      "ANC-001", "Jadwal Pelaksanaan Pendaftaran Murid Baru 2026/2027",
      "Pendaftaran resmi dibuka melalui Jalur Zonasi, Afirmasi, Prestasi, dan Mutasi Tugas. Pastikan seluruh dokumen discan jelas.",
      "informasi", "all", "", "true", new Date().toISOString(), "Sekretariat PPDB Kemenag"
    ]);
  }
}

/**
 * 2. AUTO-UPDATE SINKRONISASI MASSAL (PUSH SYNC DARI FRONTEND KE GOOGLE SHEETS)
 */
function handleSyncAllData(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (lockErr) {
    return {
      success: false,
      message: "Server Google Apps Script sedang sibuk memproses antrean sinkronisasi lain. Silakan coba beberapa saat lagi."
    };
  }

  try {
    var targetSpreadsheetId = payload.spreadsheet_id || SPREADSHEET_ID;
    var ss = SpreadsheetApp.openById(targetSpreadsheetId);
    ensureAllSheetsExist(ss);
    var data = payload.data || {};

  // 1. Sinkronkan Users
  if (data.users && Array.isArray(data.users)) {
    overwriteSheetData(ss.getSheetByName(SHEETS.USERS), DB_SCHEMA["Users"], data.users.map(function(u) {
      return [
        u.user_id || "", u.registration_number || "", u.name || "", u.email || "", u.phone || "",
        u.nip || "", u.position || "", u.password_hash || "", u.role || "calon_murid", u.school_id || "",
        u.status || "active", u.photo_url || "", u.created_at || new Date().toISOString(), u.updated_at || new Date().toISOString()
      ];
    }));
  }

  // Helper robust extraction for dictionary/objects
  function getObjectValues(obj) {
    if (!obj) return [];
    if (Array.isArray(obj)) return obj;
    var list = [];
    for (var k in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) {
        list.push(obj[k]);
      }
    }
    return list;
  }

  // 2. Sinkronkan Students
  if (data.students && typeof data.students === "object") {
    var studentList = getObjectValues(data.students);
    overwriteSheetData(ss.getSheetByName(SHEETS.STUDENTS), DB_SCHEMA["Students"], studentList.map(function(s) {
      return [
        s.student_id || "", s.user_id || "", s.registration_number || "", s.name || "", s.nik || "",
        s.nisn || "", s.gender || "L", s.birth_place || "", s.birth_date || "", s.religion || "Islam",
        s.family_card_number || "", s.child_order || 1, s.total_siblings || 1, s.family_status || "Anak Kandung",
        s.hobby || "", s.living_status || "orang_tua_kandung", s.phone || "", s.email || "", s.photo_url || ""
      ];
    }));
  }

  // 3. Sinkronkan Parents
  if (data.parents && typeof data.parents === "object") {
    var parentList = getObjectValues(data.parents);
    overwriteSheetData(ss.getSheetByName(SHEETS.PARENTS), DB_SCHEMA["Parents"], parentList.map(function(p) {
      return [
        p.parent_id || "", p.student_id || "", p.father_name || "", p.father_status || "hidup", p.father_nik || "",
        p.father_birth_place || "", p.father_birth_date || "", p.father_education || "", p.father_job || "", p.father_income || "", p.father_phone || "",
        p.mother_name || "", p.mother_status || "hidup", p.mother_nik || "", p.mother_birth_place || "", p.mother_birth_date || "", p.mother_education || "", p.mother_job || "", p.mother_income || "", p.mother_phone || "",
        p.guardian_name || "", p.guardian_nik || "", p.guardian_relation || "", p.guardian_birth_place || "", p.guardian_birth_date || "", p.guardian_education || "", p.guardian_job || "", p.guardian_income || "", p.guardian_phone || "", p.guardian_address || ""
      ];
    }));
  }

  // 4. Sinkronkan SchoolOrigins
  if (data.school_origins && typeof data.school_origins === "object") {
    var originList = getObjectValues(data.school_origins);
    overwriteSheetData(ss.getSheetByName(SHEETS.SCHOOL_ORIGINS), DB_SCHEMA["SchoolOrigins"], originList.map(function(o) {
      return [
        o.origin_id || "", o.student_id || "", o.previous_level || "", o.school_name || "", o.npsn_nsm || "",
        o.school_status || "Swasta", o.school_address || "", o.graduation_year || "", o.diploma_number || ""
      ];
    }));
  }

  // 5. Sinkronkan Addresses
  if (data.addresses && typeof data.addresses === "object") {
    var addrList = getObjectValues(data.addresses);
    overwriteSheetData(ss.getSheetByName(SHEETS.ADDRESSES), DB_SCHEMA["Addresses"], addrList.map(function(a) {
      return [
        a.address_id || "", a.student_id || "", a.province || "", a.city || "", a.district || "",
        a.subdistrict || "", a.neighborhood || "", a.rt_rw || "", a.full_address || "", a.postal_code || "",
        a.latitude || 0, a.longitude || 0
      ];
    }));
  }

  // 6. Sinkronkan Applications
  if (data.applications && Array.isArray(data.applications)) {
    overwriteSheetData(ss.getSheetByName(SHEETS.APPLICATIONS), DB_SCHEMA["Applications"], data.applications.map(function(app) {
      return [
        app.application_id || "", app.registration_number || "", app.user_id || "", app.student_id || "", app.school_id || "",
        app.admission_year || "2026", app.pathway || "zonasi", app.submission_date || "", app.latitude || 0, app.longitude || 0,
        app.distance_km || 0, app.max_distance_km || 5.0, app.zoning_status || "memenuhi", app.verification_status || "menunggu",
        app.selection_status || "menunggu", app.final_status || "draft", app.verification_notes || "", app.score || 0,
        app.afirmasi_category || "", app.dispensation_reason || "", app.achievement_type || "", app.achievement_name || "",
        app.achievement_level || "", app.achievement_rank || "", app.mutation_parent_instansi || "",
        app.mutation_letter_number || "", app.mutation_letter_date || "", app.step_completed || 1, app.is_locked ? "true" : "false",
        app.created_at || new Date().toISOString(), app.updated_at || new Date().toISOString()
      ];
    }));
  }

  // 7. Sinkronkan Documents
  if (data.documents && Array.isArray(data.documents)) {
    overwriteSheetData(ss.getSheetByName(SHEETS.DOCUMENTS), DB_SCHEMA["Documents"], data.documents.map(function(doc) {
      return [
        doc.document_id || "", doc.registration_number || "", doc.document_type || "", doc.file_name || "",
        doc.file_size_kb || 0, doc.drive_file_id || "", doc.drive_url || "", doc.upload_time || new Date().toISOString(),
        doc.verification_status || "menunggu", doc.notes || ""
      ];
    }));
  }

  // 8. Sinkronkan Schools
  if (data.schools && Array.isArray(data.schools)) {
    overwriteSheetData(ss.getSheetByName(SHEETS.SCHOOLS), DB_SCHEMA["Schools"], data.schools.map(function(sch) {
      return [
        sch.school_id || "", sch.school_name || "", sch.school_code || "", sch.nsm || "", sch.npsn || "",
        sch.level || "MA", sch.address || "", sch.village || "", sch.district || "", sch.city || "", sch.province || "",
        sch.latitude || 0, sch.longitude || 0, sch.zoning_radius_km || 5.0, sch.quota_total || 0,
        sch.quota_zonasi || 0, sch.quota_afirmasi || 0, sch.quota_prestasi || 0, sch.quota_mutasi || 0,
        sch.status || "active", sch.principal_name || "", sch.contact_phone || "", sch.contact_email || "", sch.logo_url || ""
      ];
    }));
  }

  // 9. Sinkronkan Announcements
  if (data.announcements && Array.isArray(data.announcements)) {
    overwriteSheetData(ss.getSheetByName(SHEETS.ANNOUNCEMENTS), DB_SCHEMA["Announcements"], data.announcements.map(function(anc) {
      return [
        anc.announcement_id || "", anc.title || "", anc.content || "", anc.category || "informasi", anc.target_role || "all",
        anc.school_id || "", anc.is_published ? "true" : "false", anc.created_at || new Date().toISOString(), anc.author_name || ""
      ];
    }));
  }

  // 10. Sinkronkan Settings
  if (data.settings && typeof data.settings === "object") {
    var settingsRows = [];
    for (var key in data.settings) {
      if (typeof data.settings[key] !== "object") {
        settingsRows.push([key, String(data.settings[key]), "", new Date().toISOString()]);
      }
    }
    overwriteSheetData(ss.getSheetByName(SHEETS.SETTINGS), DB_SCHEMA["Settings"], settingsRows);
  }

  // 11. Sinkronkan AuditLog
  if (data.audit_logs && Array.isArray(data.audit_logs)) {
    overwriteSheetData(ss.getSheetByName(SHEETS.AUDIT_LOG), DB_SCHEMA["AuditLog"], data.audit_logs.slice(0, 150).map(function(log) {
      return [
        log.log_id || "", log.timestamp || new Date().toISOString(), log.user_id || "", log.username || "",
        log.role || "", log.action || "", log.target || "", log.description || "", log.status || "success"
      ];
    }));
  }

  return {
    success: true,
    message: "Sinkronisasi realtime seluruh database (termasuk penghapusan & penambahan) berhasil!",
    syncedAt: new Date().toISOString()
  };
  } finally {
    try {
      lock.releaseLock();
    } catch(e) {}
  }
}

/**
 * 3. TARIK DATA LENGKAP DARI GOOGLE SHEETS KE FRONTEND (PULL SYNC)
 */
function handlePullAllData(spreadsheetId) {
  var targetId = spreadsheetId || SPREADSHEET_ID;
  var ss = SpreadsheetApp.openById(targetId);
  ensureAllSheetsExist(ss);

  var settingsRows = readSheetAsObjects(ss.getSheetByName(SHEETS.SETTINGS));
  var settingsMap = {};
  for (var s = 0; s < settingsRows.length; s++) {
    var sr = settingsRows[s];
    if (sr && sr.setting_key) {
      settingsMap[sr.setting_key] = sr.setting_value;
    }
  }

  var result = {
    users: readSheetAsObjects(ss.getSheetByName(SHEETS.USERS)),
    students: arrayToMap(readSheetAsObjects(ss.getSheetByName(SHEETS.STUDENTS)), "registration_number"),
    parents: arrayToMap(readSheetAsObjects(ss.getSheetByName(SHEETS.PARENTS)), "student_id"),
    school_origins: arrayToMap(readSheetAsObjects(ss.getSheetByName(SHEETS.SCHOOL_ORIGINS)), "student_id"),
    addresses: arrayToMap(readSheetAsObjects(ss.getSheetByName(SHEETS.ADDRESSES)), "student_id"),
    applications: readSheetAsObjects(ss.getSheetByName(SHEETS.APPLICATIONS)),
    documents: readSheetAsObjects(ss.getSheetByName(SHEETS.DOCUMENTS)),
    schools: readSheetAsObjects(ss.getSheetByName(SHEETS.SCHOOLS)),
    announcements: readSheetAsObjects(ss.getSheetByName(SHEETS.ANNOUNCEMENTS)),
    settings: settingsMap,
    pulled_at: new Date().toISOString()
  };

  return {
    success: true,
    message: "Data realtime berhasil ditarik dari Google Sheets!",
    data: result
  };
}

/**
 * Helper: Tulis ulang baris sheet secara efisien, rapi, dan menghapus baris lama saat data dihapus
 */
function overwriteSheetData(sheet, headers, rows) {
  if (!sheet) return;
  var lastRow = sheet.getLastRow();
  var maxCols = Math.max(headers.length, sheet.getLastColumn() || 1);
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, maxCols).clearContent();
  }
  if (rows && rows.length > 0) {
    var neededRows = rows.length + 1;
    var currentMaxRows = sheet.getMaxRows();
    if (neededRows > currentMaxRows) {
      sheet.insertRowsAfter(currentMaxRows, neededRows - currentMaxRows);
    }
    var currentMaxCols = sheet.getMaxColumns();
    if (headers.length > currentMaxCols) {
      sheet.insertColumnsAfter(currentMaxCols, headers.length - currentMaxCols);
    }
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

/**
 * Helper: Baca Sheet menjadi Array of Objects dengan konversi tipe & tanggal yang aman
 */
function readSheetAsObjects(sheet) {
  if (!sheet || sheet.getLastRow() <= 1) return [];
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var results = [];

  for (var i = 1; i < values.length; i++) {
    var obj = {};
    var hasValidData = false;
    for (var j = 0; j < headers.length; j++) {
      var headerKey = headers[j];
      if (!headerKey) continue;
      var val = values[i][j];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, "GMT+7", "yyyy-MM-dd'T'HH:mm:ss'Z'");
      } else if (val === null || val === undefined) {
        val = "";
      }
      if (val !== "" && val !== null && val !== undefined) {
        hasValidData = true;
      }
      obj[headerKey] = val;
    }
    if (hasValidData) {
      results.push(obj);
    }
  }
  return results;
}

/**
 * Helper: Array ke Map Object dengan Key tertentu
 */
function arrayToMap(arr, keyField) {
  var map = {};
  for (var i = 0; i < arr.length; i++) {
    var item = arr[i];
    var k = item[keyField];
    if (k) {
      map[k] = item;
    }
  }
  return map;
}

/**
 * Ekstraksi Drive File ID dari berbagai bentuk URL Google Drive
 */
function extractDriveIdFromAnyUrl(url) {
  if (!url || typeof url !== "string") return "";
  var trimmed = String(url).trim();
  var m1 = trimmed.match(new RegExp("/d/([a-zA-Z0-9_-]+)"));
  if (m1 && m1[1]) return m1[1];
  var m2 = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2 && m2[1]) return m2[1];
  var m3 = trimmed.match(new RegExp("/file/d/([a-zA-Z0-9_-]+)"));
  if (m3 && m3[1]) return m3[1];
  if (trimmed.length >= 20 && trimmed.indexOf("/") === -1 && trimmed.indexOf(".") === -1 && trimmed.indexOf(" ") === -1 && trimmed.indexOf("DOC-") !== 0) {
    return trimmed;
  }
  return "";
}

/**
 * Normalisasi Document Type di GAS untuk menjamin Zero Duplicate
 */
function normalizeDocumentTypeGAS(type) {
  if (!type) return "dokumen";
  var t = String(type).toLowerCase().trim().replace(/[\\s-]+/g, "_");
  if (t === "kk" || t === "kartu_keluarga") return "kartu_keluarga";
  if (t === "akta" || t === "akta_kelahiran" || t === "akta_lahir") return "akta_kelahiran";
  if (t === "ijazah" || t === "skl" || t === "ijazah_skl") return "ijazah_skl";
  if (t === "foto" || t === "pas_foto" || t === "foto_murid" || t === "pas_foto_3x4") return "foto";
  if (t === "kip" || t === "pkh" || t === "kks" || t === "kartu_afirmasi" || t === "afirmasi") return "kartu_afirmasi";
  if (t === "dispensasi" || t === "surat_dispensasi") return "surat_dispensasi";
  if (t === "prestasi" || t === "sertifikat" || t === "sertifikat_prestasi" || t === "piagam") return "sertifikat_prestasi";
  if (t === "mutasi" || t === "surat_mutasi" || t === "penugasan") return "surat_mutasi";
  if (t === "avatar" || t === "foto_profil") return "foto_profil";
  if (t === "logo_sekolah" || t === "school_logo") return "logo_sekolah";
  if (t === "logo_aplikasi" || t === "app_logo") return "logo_aplikasi";
  return t;
}

/**
 * 3. UPLOAD DOKUMEN KE GOOGLE DRIVE & SINKRONISASI DATABASE GOOGLE SHEETS
 * Sesuai Urutan Hirarki Otomatis:
 * - Berkas Calon Murid:
 *   [Nama Folder Sesuai Tahun Penerimaan] => [Folder Sesuai Nama Setiap Madrasahnya] => [Folder Sesuai Nama Setiap Murid yang Mendaftar] => Isi Folder Data Muridnya
 * - Database Berkas Akun Pengguna:
 *   [Folder Khusus: DATA AKUN PENGGUNA] => [Folder Nama Akun Khusus] => Isi File dari Akun yang Bersangkutan
 * - Berkas Logo Madrasah:
 *   [Folder Tahun Penerimaan] => [Folder Nama Madrasah] => Logo Resmi Madrasah
 * - Berkas Logo Aplikasi SIPMA:
 *   [Folder Khusus: SISTEM & BRANDING SIPMA] => Logo Resmi Aplikasi
 * 
 * Proteksi Anti-Duplikasi & Kerapian (Zero Duplicate Policy):
 * - Memeriksa folder aktif (non-trashed) sebelum membuat baru
 * - Menghapus berkas lama sejenis dari Google Drive jika mengunggah ulang
 * - Memperbarui baris data di Google Sheets (in-place update), tidak menambah baris ganda
 */
function handleUploadDocument(data, rootFolderId, targetSpreadsheetId) {
  var rootFolder = getOrOpenRootFolder(rootFolderId);
  
// Root folder resolved via getOrOpenRootFolder

  var ss = getOrOpenSpreadsheet(targetSpreadsheetId || SPREADSHEET_ID);
  ensureAllSheetsExist(ss);

  var docType = String(data.document_type || "dokumen").trim();
  
  // Identifikasi kategori berkas: Berkas Calon Murid vs Akun vs Logo
  var isAccountFile = (data.is_account === true) || 
                      (data.logo_type === "user") || 
                      (docType === "avatar") || 
                      (docType === "dokumen_akun") || 
                      (docType === "tanda_tangan") ||
                      (docType === "foto_profil" && (!data.registration_number || String(data.registration_number).indexOf("REG-") !== 0));
  var isSchoolLogo = (data.is_school_logo === true) || (data.logo_type === "school") || (docType === "logo_sekolah");
  var isAppLogo = (data.is_app_logo === true) || (data.logo_type === "app") || (docType === "logo_aplikasi");

  var destFolder = rootFolder;

  try {
    if (rootFolder) {
      if (isAccountFile) {
        // Hirarki Akun: DATA AKUN PENGGUNA => Folder Nama Akun Khusus
        var accountsBaseFolder = getOrCreateFolder(rootFolder, "DATA AKUN PENGGUNA");
        var accountName = String(data.account_name || data.student_name || data.name || "Akun Pengguna").trim();
        var accountId = String(data.account_id || data.user_id || data.registration_number || "").trim();
        destFolder = getOrCreateAccountFolder(accountsBaseFolder, accountName, accountId);
      } else if (isAppLogo) {
        // Hirarki Aplikasi: SISTEM & BRANDING SIPMA
        destFolder = getOrCreateFolder(rootFolder, "SISTEM & BRANDING SIPMA");
      } else {
        // Hirarki Calon Murid:
        // 1. Nama folder sesuai tahun penerimaan
        var rawYear = data.application_year || data.admission_year || getSettingValueFromSheet(ss, "academic_year_label") || getSettingValueFromSheet(ss, "application_year") || "2026/2027";
        var yearFolder = getOrCreateYearFolder(rootFolder, rawYear);

        // 2. Folder sesuai nama setiap madrasahnya
        var schoolName = String(data.school_name || "").trim();
        if (!schoolName || schoolName.toLowerCase() === "madrasah") {
          schoolName = getSchoolNameById(ss, data.school_id) || "Madrasah Terdaftar";
        }
        var schoolFolder = getOrCreateFolder(yearFolder, schoolName);

        if (isSchoolLogo) {
          destFolder = schoolFolder;
        } else {
          // 3. Folder sesuai nama setiap murid yang mendaftar
          destFolder = getOrCreateApplicantFolder(schoolFolder, data.registration_number, data.student_name);
        }
      }
    }
  } catch (driveFolderErr) {
    Logger.log("Drive folder creation error: " + driveFolderErr.toString());
    destFolder = rootFolder;
  }

  // 4. Proteksi Anti-Duplikasi File di Google Drive:
  // Hapus berkas sejenis atau yang sama jika sudah ada di folder tujuan
  if (destFolder) {
    try {
      var childFiles = destFolder.getFiles();
      while (childFiles.hasNext()) {
        var existingFile = childFiles.next();
        try {
          if (!existingFile.isTrashed()) {
            var exName = existingFile.getName().toLowerCase();
            var shouldTrash = false;

            if (data.old_drive_file_id && existingFile.getId() === data.old_drive_file_id) {
              shouldTrash = true;
            } else if (isAccountFile) {
              if (docType === "avatar" || docType === "foto_profil") {
                if (exName.indexOf("foto_profil") > -1 || exName.indexOf("avatar") > -1) shouldTrash = true;
              }
            } else if (isSchoolLogo) {
              if (exName.indexOf("logo") > -1) shouldTrash = true;
            } else if (isAppLogo) {
              if (exName.indexOf("logo") > -1) shouldTrash = true;
            } else {
              // Untuk berkas calon murid: bersihkan jenis dokumen yang sama
              var cleanDocTypeLower = docType.toLowerCase().replace(/[^a-z0-9]/g, "_");
              if (exName.indexOf(cleanDocTypeLower) > -1 || exName.indexOf(docType.toLowerCase()) > -1) {
                shouldTrash = true;
              }
            }

            if (shouldTrash) {
              existingFile.setTrashed(true);
            }
          }
        } catch(e) {}
      }
    } catch(errScan) {}
  }

  // Hapus berkas lama jika ID-nya terdaftar di Sheet Documents
  var oldDriveFileId = data.old_drive_file_id || "";
  var docSheet = ss ? ss.getSheetByName(SHEETS.DOCUMENTS) : null;

  if (docSheet && docSheet.getLastRow() > 1 && data.registration_number) {
    var existingDocRows = docSheet.getDataRange().getValues();
    for (var er = 1; er < existingDocRows.length; er++) {
      if (String(existingDocRows[er][1]).trim() === String(data.registration_number).trim() &&
          String(existingDocRows[er][2]).trim() === docType) {
        var prevFileId = String(existingDocRows[er][5]).trim();
        if (prevFileId && prevFileId.length > 5 && prevFileId !== "LOCAL_STORAGE") {
          try {
            var oldFileObj = DriveApp.getFileById(prevFileId);
            if (oldFileObj && !oldFileObj.isTrashed()) oldFileObj.setTrashed(true);
          } catch(e) {}
        }
        break;
      }
    }
  }

  if (oldDriveFileId && oldDriveFileId.length > 5 && oldDriveFileId !== "LOCAL_STORAGE") {
    try {
      var of = DriveApp.getFileById(oldDriveFileId);
      if (of && !of.isTrashed()) of.setTrashed(true);
    } catch(e) {}
  }

  var rawBase64 = String(data.base64_data || "");
  var base64Content = rawBase64.indexOf(",") > -1 ? rawBase64.split(",")[1] : rawBase64;
  // Clean base64 string: convert spaces to +, strip whitespace, ensure 4-byte padding
  base64Content = base64Content.replace(/\\s/g, "").replace(/ /g, "+");
  var pad = base64Content.length % 4;
  if (pad === 2) base64Content += "==";
  else if (pad === 3) base64Content += "=";

  var decoded = Utilities.base64Decode(base64Content);
  
  // Inspect magic bytes to guarantee 100% genuine MIME type & prevent file corruption in Drive
  var mimeType = String(data.mime_type || "").toLowerCase().trim();
  var ext = "";

  if (decoded && decoded.length >= 4) {
    var b0 = decoded[0] & 0xFF;
    var b1 = decoded[1] & 0xFF;
    var b2 = decoded[2] & 0xFF;
    var b3 = decoded[3] & 0xFF;

    if (b0 === 0x89 && b1 === 0x50 && b2 === 0x4E && b3 === 0x47) {
      mimeType = "image/png";
      ext = "png";
    } else if (b0 === 0xFF && b1 === 0xD8) {
      mimeType = "image/jpeg";
      ext = "jpg";
    } else if (b0 === 0x25 && b1 === 0x50 && b2 === 0x44 && b3 === 0x46) {
      mimeType = "application/pdf";
      ext = "pdf";
    } else if (b0 === 0x52 && b1 === 0x49 && b2 === 0x46 && b3 === 0x46) {
      mimeType = "image/webp";
      ext = "webp";
    }
  }

  if (!mimeType || mimeType === "application/octet-stream") {
    if (rawBase64.indexOf("data:image/jpeg") === 0 || rawBase64.indexOf("data:image/jpg") === 0) mimeType = "image/jpeg";
    else if (rawBase64.indexOf("data:image/png") === 0) mimeType = "image/png";
    else if (rawBase64.indexOf("data:image/webp") === 0) mimeType = "image/webp";
    else if (rawBase64.indexOf("data:application/pdf") === 0) mimeType = "application/pdf";
  }

  if (!ext) {
    if (data.file_name && data.file_name.indexOf(".") > -1) {
      var parts = data.file_name.split(".");
      ext = parts[parts.length - 1].toLowerCase();
    } else if (mimeType.indexOf("jpeg") > -1 || mimeType.indexOf("jpg") > -1) {
      ext = "jpg";
    } else if (mimeType.indexOf("png") > -1) {
      ext = "png";
    } else if (mimeType.indexOf("webp") > -1) {
      ext = "webp";
    } else if (mimeType.indexOf("pdf") > -1) {
      ext = "pdf";
    } else if (docType === "foto" || docType === "pas_foto" || docType === "foto_profil") {
      ext = "jpg";
      mimeType = "image/jpeg";
    } else if (isSchoolLogo || isAppLogo) {
      ext = "png";
      mimeType = "image/png";
    } else {
      ext = "pdf";
      mimeType = "application/pdf";
    }
  }

  var fileId = "";
  var fileUrl = "";
  var directThumbnailUrl = "";

  // Penamaan file rapi & terstandarisasi
  var cleanStudentName = String(data.student_name || "Pendaftar").replace(/[^a-zA-Z0-9_ -]/g, "").trim().replace(/\\s+/g, "_") || "Pendaftar";
  var cleanReg = String(data.registration_number || "SIPMA").replace(/[^a-zA-Z0-9_\-]/g, "").trim() || "SIPMA";
  var cleanDocType = String(docType || "Dokumen").replace(/[^a-zA-Z0-9_\-]/g, "").trim().replace(/\\s+/g, "_") || "Dokumen";

  var cleanFileName = "";
  if (isAccountFile) {
    var cleanAcc = String(data.account_name || data.student_name || "Pengguna").replace(/[^a-zA-Z0-9_ -]/g, "").trim().replace(/\\s+/g, "_");
    cleanFileName = "Foto_Profil_" + cleanAcc + "." + ext;
  } else if (isSchoolLogo) {
    var cleanSch = String(data.school_name || "Madrasah").replace(/[^a-zA-Z0-9_ -]/g, "").trim().replace(/\\s+/g, "_");
    cleanFileName = "Logo_Resmi_" + cleanSch + "." + ext;
  } else if (isAppLogo) {
    cleanFileName = "Logo_Resmi_SIPMA." + ext;
  } else {
    // Format Berkas Calon Murid: [Nama Murid]_[No Pendaftaran]_[Jenis Dokumen].[ext]
    cleanFileName = cleanStudentName + "_" + cleanReg + "_" + cleanDocType + "." + ext;
  }

  try {
    var blob = Utilities.newBlob(decoded, mimeType, cleanFileName);
    if (destFolder) {
      var file = destFolder.createFile(blob);
      try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch(e) {}

      fileId = file.getId();
      fileUrl = file.getUrl();
      directThumbnailUrl = "https://lh3.googleusercontent.com/d/" + fileId;

      // Hapus berkas lama bernama sama di folder tujuan agar tidak menumpuk
      try {
        var sameFiles = destFolder.getFilesByName(cleanFileName);
        while (sameFiles.hasNext()) {
          var sf = sameFiles.next();
          if (sf.getId() !== fileId) {
            try { sf.setTrashed(true); } catch(e) {}
          }
        }
      } catch(e) {}
    } else {
      fileId = "LOCAL_STORAGE";
      fileUrl = "";
      directThumbnailUrl = "";
    }
  } catch (driveErr) {
    Logger.log("DriveApp Error: " + driveErr.toString());
    fileId = "LOCAL_STORAGE";
    fileUrl = "";
    directThumbnailUrl = "";
  }

  // 5. Anti-Data Dobel di Sheet Documents: Perbarui baris yang cocok atau buat baru
  var docId = "DOC-" + Utilities.getUuid().substring(0, 8);
  var existingRows = docSheet.getDataRange().getValues();
  var foundRowIndex = -1;
  var oldSheetDriveFileId = "";
  var normDocType = normalizeDocumentTypeGAS(docType);

  for (var r = 1; r < existingRows.length; r++) {
    var rowDocType = String(existingRows[r][2] || "").trim();
    if (String(existingRows[r][1]).trim() === String(data.registration_number).trim() &&
        (rowDocType === docType || normalizeDocumentTypeGAS(rowDocType) === normDocType)) {
      foundRowIndex = r + 1;
      docId = String(existingRows[r][0]); // Pertahankan docId asli
      oldSheetDriveFileId = String(existingRows[r][5] || "").trim();
      break;
    }
  }

  // Bersihkan berkas lama di Google Drive jika ada berkas sebelumnya yang tergantikan
  if (oldSheetDriveFileId && oldSheetDriveFileId.length > 5 && oldSheetDriveFileId !== fileId && oldSheetDriveFileId !== "LOCAL_STORAGE") {
    try {
      var oldFDoc = DriveApp.getFileById(oldSheetDriveFileId);
      if (oldFDoc && !oldFDoc.isTrashed()) oldFDoc.setTrashed(true);
    } catch(e) {}
  }
  var clientOldDriveId = String(data.old_drive_file_id || "").trim();
  if (clientOldDriveId && clientOldDriveId.length > 5 && clientOldDriveId !== fileId && clientOldDriveId !== "LOCAL_STORAGE") {
    try {
      var oldFClient = DriveApp.getFileById(clientOldDriveId);
      if (oldFClient && !oldFClient.isTrashed()) oldFClient.setTrashed(true);
    } catch(e) {}
  }

  var docRowData = [
    docId,
    data.registration_number || "",
    docType,
    cleanFileName,
    Math.round((data.file_size_bytes || (data.file_size_kb ? data.file_size_kb * 1024 : 0)) / 1024),
    fileId,
    fileUrl,
    new Date().toISOString(),
    "menunggu",
    ""
  ];

  if (foundRowIndex > 1) {
    docSheet.getRange(foundRowIndex, 1, 1, docRowData.length).setValues([docRowData]);
  } else {
    docSheet.appendRow(docRowData);
  }

  // 6. Pembaruan Foto Profil di Sheet Users untuk Akun Pengguna / Siswa / Admin
  var isAnyPhoto = isAccountFile || docType === "foto" || docType === "pas_foto" || docType === "foto_profil";
  if (isAnyPhoto && directThumbnailUrl) {
    var userSheet = ss ? ss.getSheetByName(SHEETS.USERS) : null;
    if (userSheet && userSheet.getLastRow() > 1) {
      var userRows = userSheet.getDataRange().getValues();
      var targetAccId = String(data.account_id || data.user_id || data.registration_number || "").trim();
      var targetAccName = String(data.account_name || data.student_name || "").trim();
      var targetReg = String(data.registration_number || "").trim();

      for (var u = 1; u < userRows.length; u++) {
        var rowUserId = String(userRows[u][0]).trim();
        var rowReg = String(userRows[u][1]).trim();
        var rowName = String(userRows[u][2]).trim();
        var rowEmail = String(userRows[u][3]).trim();

        var matchesUser = false;
        if (targetAccId && (rowUserId === targetAccId || rowReg === targetAccId || rowEmail === targetAccId)) {
          matchesUser = true;
        } else if (targetReg && (rowReg === targetReg || rowUserId === targetReg)) {
          matchesUser = true;
        } else if (targetAccName && rowName.toLowerCase() === targetAccName.toLowerCase()) {
          matchesUser = true;
        }

        if (matchesUser) {
          // Bersihkan file foto lama dari Drive jika ada
          var prevUserPhoto = String(userRows[u][11] || "").trim();
          var prevUserPhotoId = extractDriveIdFromAnyUrl(prevUserPhoto);
          if (prevUserPhotoId && prevUserPhotoId.length > 5 && prevUserPhotoId !== fileId && prevUserPhotoId !== "LOCAL_STORAGE") {
            try { DriveApp.getFileById(prevUserPhotoId).setTrashed(true); } catch(e) {}
          }
          // Kolom ke-12 adalah photo_url di Sheet Users
          userSheet.getRange(u + 1, 12).setValue(directThumbnailUrl);
          break;
        }
      }
    }
  }

  // 7. Pembaruan Pas Foto Calon Murid di Sheet Students (Kolom ke-19)
  if (isAnyPhoto && directThumbnailUrl) {
    var studentSheet = ss ? ss.getSheetByName(SHEETS.STUDENTS) : null;
    if (studentSheet && studentSheet.getLastRow() > 1) {
      var studentRows = studentSheet.getDataRange().getValues();
      var regTarget = String(data.registration_number || data.account_id || "").trim();
      for (var s = 1; s < studentRows.length; s++) {
        var sReg = String(studentRows[s][2]).trim();
        var sId = String(studentRows[s][0]).trim();
        if ((regTarget && (sReg === regTarget || sId === regTarget)) ||
            (cleanStudentName && String(studentRows[s][3] || "").trim().toLowerCase() === cleanStudentName.toLowerCase())) {
          // Bersihkan file foto murid lama dari Drive jika ada
          var prevStdPhoto = String(studentRows[s][18] || "").trim();
          var prevStdPhotoId = extractDriveIdFromAnyUrl(prevStdPhoto);
          if (prevStdPhotoId && prevStdPhotoId.length > 5 && prevStdPhotoId !== fileId && prevStdPhotoId !== "LOCAL_STORAGE") {
            try { DriveApp.getFileById(prevStdPhotoId).setTrashed(true); } catch(e) {}
          }
          studentSheet.getRange(s + 1, 19).setValue(directThumbnailUrl);
          break;
        }
      }
    }
  }

  // 8. Pembaruan Logo Resmi Madrasah di Sheet Schools (Kolom ke-24)
  if (isSchoolLogo && directThumbnailUrl) {
    var schSheet = ss ? ss.getSheetByName(SHEETS.SCHOOLS) : null;
    if (schSheet && schSheet.getLastRow() > 1) {
      var schRows = schSheet.getDataRange().getValues();
      for (var sc = 1; sc < schRows.length; sc++) {
        if (String(schRows[sc][0]).trim() === String(data.school_id || data.registration_number).trim() || 
            String(schRows[sc][1]).trim().toLowerCase() === String(data.school_name).trim().toLowerCase()) {
          // Bersihkan logo lama madrasah dari Drive jika ada
          var prevSchLogo = String(schRows[sc][23] || "").trim();
          var prevSchLogoId = extractDriveIdFromAnyUrl(prevSchLogo);
          if (prevSchLogoId && prevSchLogoId.length > 5 && prevSchLogoId !== fileId && prevSchLogoId !== "LOCAL_STORAGE") {
            try { DriveApp.getFileById(prevSchLogoId).setTrashed(true); } catch(e) {}
          }
          schSheet.getRange(sc + 1, 24).setValue(directThumbnailUrl);
          break;
        }
      }
    }
  }

  // 9. Pembaruan Logo Aplikasi di Sheet Settings
  if (isAppLogo && directThumbnailUrl) {
    var settSheet = ss ? ss.getSheetByName(SHEETS.SETTINGS) : null;
    if (settSheet) {
      var settRows = settSheet.getDataRange().getValues();
      var foundLogoSett = false;
      for (var st = 1; st < settRows.length; st++) {
        if (settRows[st][0] === "app_logo") {
          // Bersihkan logo aplikasi lama dari Drive jika ada
          var prevAppLogo = String(settRows[st][1] || "").trim();
          var prevAppLogoId = extractDriveIdFromAnyUrl(prevAppLogo);
          if (prevAppLogoId && prevAppLogoId.length > 5 && prevAppLogoId !== fileId && prevAppLogoId !== "LOCAL_STORAGE") {
            try { DriveApp.getFileById(prevAppLogoId).setTrashed(true); } catch(e) {}
          }
          settSheet.getRange(st + 1, 2).setValue(directThumbnailUrl);
          foundLogoSett = true;
          break;
        }
      }
      if (!foundLogoSett) {
        settSheet.appendRow(["app_logo", directThumbnailUrl, "Logo Resmi Aplikasi SIPMA", new Date().toISOString()]);
      }
    }
  }

  return {
    success: true,
    message: "Dokumen berhasil tersimpan rapi di Google Drive dan Google Sheets tanpa data dobel!",
    file: {
      document_id: docId,
      file_name: cleanFileName,
      drive_file_id: fileId,
      drive_url: directThumbnailUrl,
      view_url: directThumbnailUrl,
      thumbnail_url: directThumbnailUrl
    },
    data: {
      document_id: docId,
      file_name: cleanFileName,
      drive_file_id: fileId,
      drive_url: directThumbnailUrl,
      view_url: directThumbnailUrl,
      thumbnail_url: directThumbnailUrl
    },
    logo_url: directThumbnailUrl
  };
}

/**
 * Helper: Hapus baris di sheet yang kolom tertentu cocok dengan targetValue (dari bawah ke atas)
 */
function deleteRowsMatchingColumn(sheet, colIndex1Based, targetValue) {
  if (!sheet || sheet.getLastRow() <= 1 || !targetValue) return 0;
  var values = sheet.getDataRange().getValues();
  var deletedCount = 0;
  for (var r = values.length - 1; r >= 1; r--) {
    if (String(values[r][colIndex1Based - 1]).trim() === String(targetValue).trim()) {
      sheet.deleteRow(r + 1);
      deletedCount++;
    }
  }
  return deletedCount;
}

/**
 * 4. PENGHAPUSAN OTOMATIS DATA PENDAFTAR & SEMUA BERKAS DRIVE (CLEANUP ENGINE)
 * Memastikan semua file di Google Drive dan semua baris di Google Sheets terhapus bersih tanpa menumpuk.
 */
function handleDeleteApplication(data, spreadsheetId, rootFolderId) {
  var regNumber = (data && data.registration_number) ? String(data.registration_number).trim() : "";
  var studentId = (data && data.student_id) ? String(data.student_id).trim() : "";
  var driveFileIds = (data && data.drive_file_ids && Array.isArray(data.drive_file_ids)) ? data.drive_file_ids : [];
  
  var deletedFilesCount = 0;
  var targetId = spreadsheetId || SPREADSHEET_ID;
  var ss = SpreadsheetApp.openById(targetId);
  ensureAllSheetsExist(ss);

  // 1. Hapus semua file di Google Drive berdasarkan drive_file_id
  for (var i = 0; i < driveFileIds.length; i++) {
    var fId = driveFileIds[i];
    if (fId && fId.length > 5) {
      try {
        var file = DriveApp.getFileById(fId);
        if (file) {
          file.setTrashed(true); // Pindahkan ke Sampah (Trash) Drive agar tidak memakan ruang
          deletedFilesCount++;
        }
      } catch (e) {}
    }
  }

  // 2. Cari dan hapus berkas pendaftar dari Sheet Documents di Google Sheets
  var docSheet = ss.getSheetByName(SHEETS.DOCUMENTS);
  if (docSheet && docSheet.getLastRow() > 1 && regNumber) {
    var docRows = docSheet.getDataRange().getValues();
    for (var r = docRows.length - 1; r >= 1; r--) {
      if (String(docRows[r][1]).trim() === regNumber) {
        var sheetDriveId = String(docRows[r][5]).trim();
        if (sheetDriveId && sheetDriveId.length > 5 && driveFileIds.indexOf(sheetDriveId) === -1) {
          try {
            var f = DriveApp.getFileById(sheetDriveId);
            if (f) {
              f.setTrashed(true);
              deletedFilesCount++;
            }
          } catch(e) {}
        }
        docSheet.deleteRow(r + 1);
      }
    }
  }

  // 3. Cari dan hapus subfolder pendaftar di Google Drive jika ada (misal: "REG-... - Nama Siswa")
  if (regNumber) {
    try {
      var folderMatches = DriveApp.searchFolders('title contains "' + regNumber + '" and trashed = false');
      while (folderMatches.hasNext()) {
        var folder = folderMatches.next();
        folder.setTrashed(true);
      }
    } catch(e) {}
  }

  // 4. Hapus baris dari seluruh tabel database Google Sheets
  if (regNumber) {
    deleteRowsMatchingColumn(ss.getSheetByName(SHEETS.APPLICATIONS), 2, regNumber); // Applications: registration_number
    deleteRowsMatchingColumn(ss.getSheetByName(SHEETS.STUDENTS), 3, regNumber); // Students: registration_number
    deleteRowsMatchingColumn(ss.getSheetByName(SHEETS.USERS), 2, regNumber); // Users: registration_number
  }

  if (studentId) {
    deleteRowsMatchingColumn(ss.getSheetByName(SHEETS.STUDENTS), 1, studentId);
    deleteRowsMatchingColumn(ss.getSheetByName(SHEETS.PARENTS), 2, studentId);
    deleteRowsMatchingColumn(ss.getSheetByName(SHEETS.SCHOOL_ORIGINS), 2, studentId);
    deleteRowsMatchingColumn(ss.getSheetByName(SHEETS.ADDRESSES), 2, studentId);
  }

  return {
    success: true,
    message: "Data pendaftaran " + regNumber + " dan seluruh file di Google Drive serta database Sheets berhasil dihapus permanen secara otomatis.",
    registration_number: regNumber,
    deleted_files_count: deletedFilesCount
  };
}

/**
 * 5. HAPUS SATU DOKUMEN / FILE SPESIFIK DARI DRIVE & SHEETS SECARA CASCADE
 */
function handleDeleteFile(data, spreadsheetId) {
  var driveFileId = data ? (data.drive_file_id || extractDriveIdFromAnyUrl(data.file_url)) : "";
  var documentId = data ? data.document_id : "";
  var regNumber = data ? data.registration_number : "";
  var docType = data ? String(data.document_type || "").trim() : "";
  var isAccount = data ? (data.is_account === true || data.logo_type === "user") : false;
  var isSchool = data ? (data.is_school_logo === true || data.logo_type === "school") : false;
  var isApp = data ? (data.is_app_logo === true || data.logo_type === "app") : false;
  var deleted = false;

  var targetId = spreadsheetId || SPREADSHEET_ID;
  var ss = SpreadsheetApp.openById(targetId);
  var docSheet = ss.getSheetByName(SHEETS.DOCUMENTS);

  // Jika driveFileId belum ada, cari barisnya di Sheet Documents
  var normTargetDocType = docType ? normalizeDocumentTypeGAS(docType) : "";
  if (docSheet && docSheet.getLastRow() > 1) {
    var docRows = docSheet.getDataRange().getValues();
    for (var r = docRows.length - 1; r >= 1; r--) {
      var match = false;
      var rowDocType = String(docRows[r][2] || "").trim();
      if (documentId && String(docRows[r][0]).trim() === String(documentId).trim()) match = true;
      if (driveFileId && String(docRows[r][5]).trim() === String(driveFileId).trim()) match = true;
      if (regNumber && normTargetDocType && String(docRows[r][1]).trim() === String(regNumber).trim() && (rowDocType === docType || normalizeDocumentTypeGAS(rowDocType) === normTargetDocType)) match = true;
      if (match) {
        if (!driveFileId) {
          driveFileId = String(docRows[r][5]).trim();
        }
        if (!docType) {
          docType = rowDocType;
        }
        if (!regNumber) {
          regNumber = String(docRows[r][1]).trim();
        }
        docSheet.deleteRow(r + 1);
      }
    }
  }

  // Hapus berkas dari Google Drive secara permanen / trash
  if (driveFileId && driveFileId.length > 5 && driveFileId !== "LOCAL_STORAGE") {
    try {
      var f = DriveApp.getFileById(driveFileId);
      if (f && !f.isTrashed()) {
        f.setTrashed(true);
        deleted = true;
      }
    } catch(e) {}
  }

  // Jika foto profil akun / foto siswa yang dihapus, bersihkan di Sheet Users & Students
  var isPhoto = isAccount || docType === "foto" || docType === "pas_foto" || docType === "foto_profil";
  if (isPhoto) {
    var studentSheet = ss.getSheetByName(SHEETS.STUDENTS);
    if (studentSheet && studentSheet.getLastRow() > 1) {
      var sRows = studentSheet.getDataRange().getValues();
      for (var s = 1; s < sRows.length; s++) {
        var sReg = String(sRows[s][2]).trim();
        var sPhoto = String(sRows[s][18]).trim();
        if ((regNumber && sReg === String(regNumber).trim()) || (driveFileId && sPhoto.indexOf(driveFileId) !== -1)) {
          studentSheet.getRange(s + 1, 19).setValue("");
        }
      }
    }
    var userSheet = ss.getSheetByName(SHEETS.USERS);
    if (userSheet && userSheet.getLastRow() > 1) {
      var uRows = userSheet.getDataRange().getValues();
      var accId = data ? String(data.account_id || regNumber || "").trim() : "";
      for (var u = 1; u < uRows.length; u++) {
        var uId = String(uRows[u][0]).trim();
        var uReg = String(uRows[u][1]).trim();
        var uPhoto = String(uRows[u][11]).trim();
        if ((accId && (uId === accId || uReg === accId)) || (driveFileId && uPhoto.indexOf(driveFileId) !== -1)) {
          userSheet.getRange(u + 1, 12).setValue("");
        }
      }
    }
  }

  // Jika logo madrasah dihapus, bersihkan di Sheet Schools
  if (isSchool || docType === "logo_sekolah") {
    var schSheet = ss.getSheetByName(SHEETS.SCHOOLS);
    if (schSheet && schSheet.getLastRow() > 1) {
      var scRows = schSheet.getDataRange().getValues();
      var schId = data ? String(data.school_id || "").trim() : "";
      for (var sc = 1; sc < scRows.length; sc++) {
        var rowSchId = String(scRows[sc][0]).trim();
        var rowSchLogo = String(scRows[sc][23]).trim();
        if ((schId && rowSchId === schId) || (driveFileId && rowSchLogo.indexOf(driveFileId) !== -1)) {
          schSheet.getRange(sc + 1, 24).setValue("");
        }
      }
    }
  }

  // Jika logo aplikasi dihapus, bersihkan di Sheet Settings
  if (isApp || docType === "logo_aplikasi") {
    var settSheet = ss.getSheetByName(SHEETS.SETTINGS);
    if (settSheet && settSheet.getLastRow() > 1) {
      var settRows = settSheet.getDataRange().getValues();
      for (var st = 1; st < settRows.length; st++) {
        if (settRows[st][0] === "app_logo") {
          settSheet.getRange(st + 1, 2).setValue("");
          break;
        }
      }
    }
  }

  return {
    success: true,
    message: "File berhasil dihapus dari Google Drive dan database Google Sheets.",
    drive_file_id: driveFileId,
    deleted_from_drive: deleted
  };
}

/**
 * 6. HAPUS DATA MADRASAH & SEMUA BERKAS TERIKAT
 */
function handleDeleteSchool(data, spreadsheetId) {
  var schoolId = data ? data.school_id : "";
  var driveFileIds = (data && data.drive_file_ids && Array.isArray(data.drive_file_ids)) ? data.drive_file_ids : [];
  var regNumbers = (data && data.registration_numbers && Array.isArray(data.registration_numbers)) ? data.registration_numbers : [];

  for (var i = 0; i < driveFileIds.length; i++) {
    var fId = driveFileIds[i];
    if (fId && fId.length > 5) {
      try {
        var file = DriveApp.getFileById(fId);
        if (file) file.setTrashed(true);
      } catch(e) {}
    }
  }

  var ss = SpreadsheetApp.openById(spreadsheetId || SPREADSHEET_ID);
  if (schoolId) {
    deleteRowsMatchingColumn(ss.getSheetByName(SHEETS.SCHOOLS), 1, schoolId);
    deleteRowsMatchingColumn(ss.getSheetByName(SHEETS.USERS), 10, schoolId); // users school_id
    deleteRowsMatchingColumn(ss.getSheetByName(SHEETS.APPLICATIONS), 5, schoolId); // apps school_id
  }

  for (var j = 0; j < regNumbers.length; j++) {
    var rNum = regNumbers[j];
    deleteRowsMatchingColumn(ss.getSheetByName(SHEETS.STUDENTS), 3, rNum);
    deleteRowsMatchingColumn(ss.getSheetByName(SHEETS.DOCUMENTS), 2, rNum);
  }

  return {
    success: true,
    message: "Madrasah " + schoolId + " beserta semua file dan data pendaftar terkait berhasil dihapus permanen.",
    school_id: schoolId
  };
}

/**
 * 7. HAPUS AKUN PENGGUNA
 */
function handleDeleteUser(data, spreadsheetId) {
  var userId = data ? data.user_id : "";
  var regNum = data ? data.registration_number : "";
  var ss = SpreadsheetApp.openById(spreadsheetId || SPREADSHEET_ID);

  if (userId) {
    deleteRowsMatchingColumn(ss.getSheetByName(SHEETS.USERS), 1, userId);
  }
  if (regNum) {
    deleteRowsMatchingColumn(ss.getSheetByName(SHEETS.USERS), 2, regNum);
  }

  return {
    success: true,
    message: "Akun pengguna berhasil dihapus dari database Users.",
    user_id: userId
  };
}

/**
 * 8. NOTIFIKASI EMAIL OTOMATIS (TERPICU PADA PERUBAHAN VERIFIKASI BERKAS ATAU STATUS KELULUSAN)
 */
function handleSendNotificationEmail(data, targetSpreadsheetId) {
  if (!data) return { success: false, message: "Data notifikasi kosong" };
  var email = (data.email || "").trim();
  var studentName = data.student_name || "Calon Murid";
  var regNumber = data.registration_number || "";
  var schoolName = data.school_name || "Madrasah";
  var schoolEmail = (data.school_email || "").trim();
  var schoolPhone = (data.school_phone || "").trim();
  var schoolAddress = (data.school_address || "").trim();
  var eventType = data.event_type || "verification"; // "registration_submitted" | "verification" | "selection" | "announcement" | "transfer"
  var newStatus = String(data.new_status || "").toLowerCase();
  var notes = data.notes || "";
  var pathway = data.pathway || "";
  var appName = data.app_name || "SIPMA PPDB Madrasah";
  var appLogoUrl = (data.app_logo_url && data.app_logo_url.indexOf("6c787787-6585-4830-b0a6-9bfab3f1dba4") === -1) ? data.app_logo_url : "";

  // Validasi email penerima
  if (!email || email.indexOf("@") === -1 || email.indexOf(".") === -1) {
    return { success: false, message: "Alamat email penerima tidak valid: " + email };
  }

  var subject = "";
  var statusBadge = "";
  var badgeColor = "#059669";
  var headline = "";
  var detailHtml = "";

  // 1. TAHAP PENDAFTARAN BERHASIL DISERAHKAN
  if (eventType === "registration_submitted" || eventType === "submission") {
    subject = "[PPDB " + schoolName + "] Bukti Pengajuan Pendaftaran: " + studentName + " (" + regNumber + ")";
    statusBadge = "PENDAFTARAN BERHASIL DIAJUKAN";
    badgeColor = "#059669"; // Emerald
    headline = "Formulir pendaftaran Anda telah berhasil diserahkan ke Panitia PPDB " + schoolName + ".";
    detailHtml = "<p>Data biodata diri, data orang tua/wali, titik lokasi tempat tinggal, serta dokumen berkas persyaratan Anda telah tercatat di sistem panitia pemeriksa.</p>" +
      "<div style='background-color:#ecfdf5;border-left:4px solid #10b981;padding:14px;margin:14px 0;border-radius:6px;font-size:13px;color:#065f46;'>" +
      "<b>Langkah Selanjutnya:</b> Panitia PPDB " + schoolName + " akan memverifikasi kelengkapan dan keabsahan berkas yang Anda unggah. Pantau status berkas secara berkala melalui akun portal pendaftaran Anda." +
      "</div>" +
      "<p style='margin-top:10px;'>Nomor registrasi resmi Anda: <b>" + regNumber + "</b>.</p>";
  }
  // 1b. TAHAP PERBAIKAN BERKAS DISERAHKAN ULANG
  else if (eventType === "revision_submitted") {
    subject = "[PPDB " + schoolName + "] Bukti Penyerahan Berkas Perbaikan: " + studentName + " (" + regNumber + ")";
    statusBadge = "BERKAS PERBAIKAN DITERIMA";
    badgeColor = "#2563eb"; // Blue
    headline = "Perbaikan berkas dan data pendaftaran Anda telah berhasil diserahkan ke Panitia PPDB " + schoolName + ".";
    detailHtml = "<p>Dokumen revisi yang Anda unggah telah tercatat di sistem dan masuk kembali ke antrean verifikasi panitia pemeriksa.</p>" +
      "<div style='background-color:#eff6ff;border-left:4px solid #3b82f6;padding:12px;margin:12px 0;border-radius:6px;font-size:13px;color:#1e40af;'>" +
      "<b>Status Saat Ini:</b> Menunggu peninjauan ulang oleh Panitia PPDB " + schoolName + ". Anda akan menerima email notifikasi segera setelah berkas selesai diverifikasi." +
      "</div>";
  }
  // 2. TAHAP VERIFIKASI BERKAS
  else if (eventType === "verification") {
    if (newStatus === "terverifikasi") {
      subject = "[PPDB " + schoolName + "] Hasil Verifikasi Berkas: Terverifikasi (Lengkap) - " + studentName + " (" + regNumber + ")";
      statusBadge = "BERKAS TERVERIFIKASI (VALID)";
      badgeColor = "#059669"; // Emerald
      headline = "Kabar Baik: Seluruh berkas persyaratan pendaftaran Anda telah selesai diverifikasi oleh Panitia PPDB " + schoolName + ".";
      detailHtml = "<p>Seluruh dokumen dan berkas persyaratan yang Anda unggah telah diperiksa oleh panitia dan dinyatakan <b>LENGKAP, VALID & MEMENUHI SYARAT</b>.</p>" +
        "<div style='background-color:#ecfdf5;border-left:4px solid #10b981;padding:12px;margin:12px 0;border-radius:6px;font-size:13px;color:#065f46;'>" +
        "<b>Tahap Berikutnya:</b> Nama calon peserta didik kini secara resmi masuk ke tahap perangkingan dan seleksi penerimaan murid baru sesuai kuota jalur yang dipilih." +
        "</div>";
    } else if (newStatus === "perlu_perbaikan") {
      subject = "[PPDB " + schoolName + "] Catatan Verifikasi Berkas: Perlu Perbaikan - " + studentName + " (" + regNumber + ")";
      statusBadge = "PERLU PERBAIKAN BERKAS";
      badgeColor = "#d97706"; // Amber
      headline = "Perhatian: Terdapat berkas pendaftaran yang memerlukan perbaikan dari Anda.";
      detailHtml = "<p>Panitia pemeriksa berkas di <b>" + schoolName + "</b> memberikan catatan pada dokumen pendaftaran:</p>" +
        "<div style='background-color:#fef3c7;border-left:4px solid #f59e0b;padding:14px;margin:12px 0;border-radius:6px;font-size:14px;color:#92400e;line-height:1.5;'>" +
        "<b>Catatan Panitia:</b><br/>" + (notes || "Mohon periksa kembali kelengkapan dokumen dan unggah berkas pengganti yang lebih jelas.") +
        "</div>" +
        "<p><b>Tindakan Diperlukan:</b> Akses formulir pendaftaran Anda pada portal SIPMA, masuk ke menu unggah dokumen, lalu klik tombol <b>Ganti File</b> untuk mengunggah dokumen revisi agar pendaftaran Anda dapat segera disetujui.</p>";
    } else if (newStatus === "ditolak") {
      subject = "[PPDB " + schoolName + "] Hasil Verifikasi Berkas: Berkas Ditolak - " + studentName + " (" + regNumber + ")";
      statusBadge = "BERKAS DITOLAK";
      badgeColor = "#dc2626"; // Red
      headline = "Pemberitahuan hasil pemeriksaan berkas persyaratan administrasi pendaftaran.";
      detailHtml = "<p>Mohon maaf, berdasarkan verifikasi panitia di <b>" + schoolName + "</b>, berkas persyaratan yang diajukan belum dapat kami terima dengan catatan:</p>" +
        "<div style='background-color:#fee2e2;border-left:4px solid #ef4444;padding:12px;margin:12px 0;border-radius:6px;font-size:14px;color:#991b1b;'>" +
        "<b>Alasan Penolakan:</b> " + (notes || "Tidak memenuhi ketentuan kriteria administrasi yang dipersyaratkan.") +
        "</div>" +
        "<p>Akun pendaftaran Anda telah dibuka kembali. Anda dapat memperbaiki data atau memilih madrasah alternatif lain yang sesuai melalui portal SIPMA.</p>";
    }
  }
  // 3. TAHAP SELEKSI AKHIR & KELULUSAN
  else if (eventType === "selection") {
    if (newStatus === "lulus") {
      subject = "[PPDB " + schoolName + "] Pengumuman Kelulusan Seleksi: Dinyatakan LULUS - " + studentName + " (" + regNumber + ")";
      statusBadge = "SELAMAT, ANDA LULUS SELEKSI!";
      badgeColor = "#059669"; // Emerald
      headline = "Alhamdulillah! Anda secara resmi dinyatakan LULUS dalam seleksi penerimaan murid baru.";
      detailHtml = "<p>Panitia PPDB mengumumkan bahwa calon peserta didik:</p>" +
        "<div style='background-color:#ecfdf5;border:1px solid #a7f3d0;padding:14px 16px;border-radius:8px;margin:12px 0;font-size:14px;color:#065f46;'>" +
        "Nama Calon Murid: <b>" + studentName + "</b><br/>" +
        "Nomor Registrasi: <b>" + regNumber + "</b><br/>" +
        "Madrasah Diterima: <b>" + schoolName + "</b>" +
        (pathway ? ("<br/>Jalur: <b>" + pathway.toUpperCase() + "</b>") : "") +
        "</div>" +
        "<p><b>Instruksi Daftar Ulang:</b> Silakan masuk ke akun portal SIPMA Anda untuk mengunduh dan mencetak <b>Bukti Tanda Lulus Seleksi</b> serta melihat jadwal pelaksanaan daftar ulang di " + schoolName + ".</p>";
    } else if (newStatus === "tidak_lulus") {
      subject = "[PPDB " + schoolName + "] Pengumuman Hasil Seleksi: Belum Masuk Kuota - " + studentName + " (" + regNumber + ")";
      statusBadge = "TIDAK LULUS SELEKSI";
      badgeColor = "#64748b"; // Slate
      headline = "Pengumuman Hasil Seleksi Akhir PPDB Madrasah.";
      detailHtml = "<p>Terima kasih atas partisipasi Anda dalam proses seleksi penerimaan murid baru di <b>" + schoolName + "</b>.</p>" +
        "<p>Berdasarkan kuota daya tampung dan perangkingan seleksi akhir saat ini, calon peserta didik atas nama <b>" + studentName + "</b> (" + regNumber + ") belum masuk dalam kuota penerimaan di madrasah ini.</p>" +
        "<div style='background-color:#f1f5f9;border-left:4px solid #64748b;padding:12px;margin:12px 0;border-radius:6px;font-size:13px;color:#334155;'>" +
        "<b>Rekomendasi Lanjutan:</b> Sistem SIPMA menyediakan fitur pencarian madrasah alternatif terdekat yang masih memiliki sisa kuota. Silakan login ke portal SIPMA untuk melihat pilihan rekomendasi madrasah lain." +
        "</div>";
    } else if (newStatus === "cadangan" || newStatus === "waiting_list") {
      subject = "[PPDB " + schoolName + "] Informasi Status Cadangan (Waiting List) - " + studentName + " (" + regNumber + ")";
      statusBadge = "STATUS CADANGAN (WAITING LIST)";
      badgeColor = "#d97706"; // Amber
      headline = "Status Seleksi: Anda Masuk Daftar Cadangan / Waiting List.";
      detailHtml = "<p>Calon peserta didik atas nama <b>" + studentName + "</b> berada di daftar cadangan kuota penerimaan di <b>" + schoolName + "</b>.</p>" +
        "<p>Apabila terdapat peserta utama yang tidak melakukan daftar ulang hingga batas waktu yang ditentukan, panitia akan memanggil peserta dari daftar cadangan sesuai urutan perangkingan.</p>";
    }
  }
  // 4. PENGUMUMAN RESMI DARI MADRASAH
  else if (eventType === "announcement") {
    subject = "[PPDB " + schoolName + "] Pengumuman Resmi: " + (data.title || "Pemberitahuan Pendaftar");
    statusBadge = "PENGUMUMAN RESMI";
    badgeColor = "#2563eb"; // Blue
    headline = data.title || ("Pemberitahuan Resmi dari Panitia PPDB " + schoolName);
    detailHtml = "<div style='background-color:#eff6ff;border-left:4px solid #3b82f6;padding:14px;margin:12px 0;border-radius:6px;font-size:14px;color:#1e40af;line-height:1.6;'>" +
      (notes || data.announcement_content || "Terdapat pengumuman resmi terbaru terkait pelaksanaan PPDB di madrasah pilihan Anda.") +
      "</div>" +
      "<p>Informasi selengkapnya dapat dilihat langsung pada papan pengumuman di portal SIPMA.</p>";
  }
  // 5. PEMINDAHAN / PENGALIHAN BERKAS
  else if (eventType === "transfer" || eventType === "reroute") {
    subject = "[PPDB " + schoolName + "] Pemberitahuan Pemindahan Berkas Pendaftaran - " + studentName + " (" + regNumber + ")";
    statusBadge = "BERKAS DIALIHKAN";
    badgeColor = "#7c3aed"; // Purple
    headline = "Berkas pendaftaran Anda telah berhasil dialihkan ke madrasah tujuan baru.";
    detailHtml = "<p>Pendaftaran Anda atas nama <b>" + studentName + "</b> (" + regNumber + ") telah dialihkan ke <b>" + schoolName + "</b>.</p>" +
      "<div style='background-color:#f5f3ff;border-left:4px solid #8b5cf6;padding:12px;margin:12px 0;border-radius:6px;font-size:13px;color:#5b21b6;'>" +
      (notes || "Berkas pendaftaran siap ditinjau oleh Panitia PPDB madrasah tujuan baru.") +
      "</div>";
  }

  // Fallback subjek jika belum terisi
  if (!subject) {
    subject = "[PPDB " + schoolName + "] Pemberitahuan Pendaftaran - " + studentName + " (" + regNumber + ")";
    statusBadge = (newStatus || "PEMBERITAHUAN").toUpperCase();
    headline = "Terdapat pembaruan status pendaftaran Anda di sistem SIPMA.";
    detailHtml = "<p>" + (notes || "Silakan cek akun portal pendaftaran Anda untuk informasi lebih lengkap.") + "</p>";
  }

  var htmlBody = buildNotificationEmailHtml({
    appName: appName,
    appLogoUrl: appLogoUrl,
    schoolName: schoolName,
    schoolEmail: schoolEmail,
    schoolPhone: schoolPhone,
    schoolAddress: schoolAddress,
    studentName: studentName,
    regNumber: regNumber,
    pathway: pathway,
    statusBadge: statusBadge,
    badgeColor: badgeColor,
    headline: headline,
    detailHtml: detailHtml
  });

  // Plain-text alternative (Anti-Spam standard: avoids MIME_HTML_ONLY penalty)
  var plainTextBody = (appName || "SIPMA PPDB Madrasah") + "\\n" +
    "Panitia PPDB: " + schoolName + "\\n\\n" +
    "Yth. " + studentName + " (No. Reg: " + regNumber + ")\\n" +
    "Status: " + statusBadge + "\\n\\n" +
    headline + "\\n\\n" +
    (notes ? ("Catatan Panitia: " + notes + "\\n\\n") : "") +
    "Untuk informasi selengkapnya, silakan kunjungi portal SIPMA.\\n\\n" +
    "Panitia Penerimaan Peserta Didik Baru (PPDB)\\n" +
    schoolName + "\\n" +
    (schoolAddress ? ("Alamat: " + schoolAddress + "\\n") : "") +
    (schoolEmail ? ("Email: " + schoolEmail + "\\n") : "") +
    (schoolPhone ? ("Telp/WA: " + schoolPhone + "\\n") : "");

  // Konfigurasi pengirim email:
  // Nama Pengirim: Panitia PPDB [Nama Madrasah]
  // Reply-To: [Email Madrasah yang dipilih saat mendaftar]
  var senderDisplayName = schoolName ? ("Panitia PPDB " + schoolName) : (appName || "SIPMA PPDB Madrasah");
  var mailOptions = {
    to: email,
    subject: subject,
    body: plainTextBody,
    htmlBody: htmlBody,
    name: senderDisplayName
  };

  if (schoolEmail && schoolEmail.indexOf("@") > -1) {
    mailOptions.replyTo = schoolEmail;
    try {
      var aliases = GmailApp.getAliases();
      if (aliases && aliases.indexOf(schoolEmail) > -1) {
        mailOptions.from = schoolEmail;
      }
    } catch (aliasErr) {}
  }

  // Kirim dengan perlindungan error bertingkat (MailApp -> GmailApp -> error safe return)
  try {
    MailApp.sendEmail(mailOptions);
    return {
      success: true,
      message: "Email notifikasi berhasil dikirim via MailApp ke " + email,
      recipient: email,
      sender_name: senderDisplayName,
      sender_email: schoolEmail || "default",
      status: newStatus
    };
  } catch (errMail) {
    try {
      var gmailOptions = {
        htmlBody: htmlBody,
        name: senderDisplayName,
        replyTo: (schoolEmail && schoolEmail.indexOf("@") > -1) ? schoolEmail : undefined
      };
      try {
        var gAliases = GmailApp.getAliases();
        if (schoolEmail && gAliases && gAliases.indexOf(schoolEmail) > -1) {
          gmailOptions.from = schoolEmail;
        }
      } catch (e2) {}

      GmailApp.sendEmail(email, subject, plainTextBody, gmailOptions);
      return {
        success: true,
        message: "Email notifikasi berhasil dikirim via GmailApp ke " + email,
        recipient: email,
        sender_name: senderDisplayName,
        sender_email: schoolEmail || "default",
        status: newStatus
      };
    } catch (errGmail) {
      return {
        success: false,
        message: "Gagal mengirim email: " + (errMail ? errMail.toString() : errGmail ? errGmail.toString() : "Unknown error"),
        recipient: email
      };
    }
  }
}

/**
 * Format Template HTML Email Elegan, Rapi, & Kompatibel Semua Email Client
 * Bagian atas menampilkan Nama Aplikasi, Logo Aplikasi, serta Identitas Madrasah Pengirim
 */
function buildNotificationEmailHtml(params) {
  var appName = params.appName || "SIPMA";
  var appLogoUrl = (params.appLogoUrl && params.appLogoUrl.indexOf("6c787787-6585-4830-b0a6-9bfab3f1dba4") === -1) ? params.appLogoUrl : "";
  var schoolName = params.schoolName || "Madrasah";
  var schoolEmail = params.schoolEmail || "";
  var schoolPhone = params.schoolPhone || "";
  var schoolAddress = params.schoolAddress || "";
  var studentName = params.studentName || "Calon Murid";
  var regNumber = params.regNumber || "";
  var pathway = params.pathway || "";
  var statusBadge = params.statusBadge || "PEMBERITAHUAN";
  var badgeColor = params.badgeColor || "#059669";
  var headline = params.headline || "";
  var detailHtml = params.detailHtml || "";

  var pathwayLabel = pathway ? (pathway === 'zonasi' ? 'Zonasi' : pathway === 'afirmasi' ? 'Afirmasi' : pathway === 'prestasi' ? 'Prestasi' : pathway === 'mutasi' ? 'Perpindahan Orang Tua' : pathway) : '-';

  var logoCellHtml = appLogoUrl ?
    '<td width="56" valign="middle" style="padding-right:16px;"><img src="' + appLogoUrl + '" alt="' + appName + '" width="52" height="52" style="display:block;width:52px;height:52px;border-radius:12px;background-color:#ffffff;padding:2px;box-shadow:0 2px 6px rgba(0,0,0,0.2);object-fit:contain;" /></td>' :
    '<td width="56" valign="middle" style="padding-right:16px;"><div style="width:48px;height:48px;border-radius:12px;background-color:#047857;border:2px solid #10b981;color:#ffffff;font-size:22px;font-weight:800;text-align:center;line-height:48px;">' + (appName.charAt(0) || 'S') + '</div></td>';

  return '<!DOCTYPE html>' +
    '<html lang="id">' +
    '<head>' +
    '  <meta charset="UTF-8">' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '  <title>' + appName + ' - ' + statusBadge + '</title>' +
    '</head>' +
    '<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1e293b;line-height:1.6;">' +
    '  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9;padding:24px 12px;">' +
    '    <tr>' +
    '      <td align="center">' +
    '        <!-- Container Utama -->' +
    '        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 10px 25px -5px rgba(0,0,0,0.06);">' +
    '          ' +
    '          <!-- HEADER ATAS: LOGO APLIKASI & NAMA APLIKASI -->' +
    '          <tr>' +
    '            <td style="background-color:#065f46;padding:24px 28px;text-align:left;border-bottom:3px solid #047857;">' +
    '              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">' +
    '                <tr>' +
    logoCellHtml +
    '                  <td valign="middle">' +
    '                    <h1 style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:0.5px;line-height:1.2;">' + appName + '</h1>' +
    '                    <p style="margin:3px 0 0 0;font-size:12px;color:#a7f3d0;font-weight:500;letter-spacing:0.3px;">Sistem Informasi Penerimaan Murid Baru Madrasah</p>' +
    '                  </td>' +
    '                </tr>' +
    '              </table>' +
    '            </td>' +
    '          </tr>' +
    '          ' +
    '          <!-- BARIS IDENTITAS PENGIRIM: NAMA MADRASAH -->' +
    '          <tr>' +
    '            <td style="background-color:#f0fdf4;padding:12px 28px;border-bottom:1px solid #dcfce7;font-size:12px;color:#166534;">' +
    '              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">' +
    '                <tr>' +
    '                  <td>' +
    '                    <span style="font-weight:700;color:#065f46;">Pengirim Resmi:</span> Panitia PPDB <b>' + schoolName + '</b>' +
    '                    ' + (schoolEmail ? ('<br/><span style="color:#15803d;">Email Kontak: <b>' + schoolEmail + '</b></span>') : '') +
    '                  </td>' +
    '                </tr>' +
    '              </table>' +
    '            </td>' +
    '          </tr>' +
    '          ' +
    '          <!-- BADGE STATUS -->' +
    '          <tr>' +
    '            <td style="padding:24px 28px 12px 28px;text-align:center;">' +
    '              <span style="display:inline-block;padding:8px 20px;border-radius:9999px;font-size:13px;font-weight:800;letter-spacing:0.5px;color:#ffffff;background-color:' + badgeColor + ';box-shadow:0 2px 6px rgba(0,0,0,0.1);">' +
    '                ' + statusBadge +
    '              </span>' +
    '            </td>' +
    '          </tr>' +
    '          ' +
    '          <!-- KONTEN INTI -->' +
    '          <tr>' +
    '            <td style="padding:12px 28px 24px 28px;">' +
    '              <p style="font-size:15px;font-weight:700;color:#0f172a;margin:0 0 14px 0;">' +
    '                Yth. Calon Peserta Didik & Orang Tua / Wali: <u>' + studentName + '</u>' +
    '              </p>' +
    '              ' +
    '              <!-- KOTAK DATA RINGKASAN -->' +
    '              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:18px;font-size:13px;">' +
    '                <tr>' +
    '                  <td style="padding:10px 14px;color:#64748b;width:140px;border-bottom:1px solid #edf2f7;">Nomor Registrasi</td>' +
    '                  <td style="padding:10px 14px;font-weight:700;color:#0f172a;font-family:monospace;font-size:14px;border-bottom:1px solid #edf2f7;">' + regNumber + '</td>' +
    '                </tr>' +
    '                <tr>' +
    '                  <td style="padding:10px 14px;color:#64748b;border-bottom:1px solid #edf2f7;">Nama Murid</td>' +
    '                  <td style="padding:10px 14px;font-weight:700;color:#0f172a;border-bottom:1px solid #edf2f7;">' + studentName + '</td>' +
    '                </tr>' +
    '                <tr>' +
    '                  <td style="padding:10px 14px;color:#64748b;border-bottom:1px solid #edf2f7;">Madrasah Tujuan</td>' +
    '                  <td style="padding:10px 14px;font-weight:700;color:#065f46;border-bottom:1px solid #edf2f7;">' + schoolName + '</td>' +
    '                </tr>' +
    '                ' + (pathwayLabel !== '-' ? ('<tr><td style="padding:10px 14px;color:#64748b;">Jalur Pendaftaran</td><td style="padding:10px 14px;font-weight:600;color:#0f172a;">' + pathwayLabel + '</td></tr>') : '') +
    '              </table>' +
    '              ' +
    '              <!-- HEADLINE & DETAIL -->' +
    '              <p style="font-size:15px;line-height:1.6;font-weight:600;color:#1e293b;margin:0 0 12px 0;">' + headline + '</p>' +
    '              <div style="font-size:14px;line-height:1.65;color:#334155;">' + detailHtml + '</div>' +
    '              ' +
    '              <!-- TOMBOL AKSES PORTAL -->' +
    '              <div style="text-align:center;margin:28px 0 16px 0;">' +
    '                <a href="https://ais-pre-r6ibehii5xazujavc2lern-297916787355.asia-southeast1.run.app" target="_blank" style="display:inline-block;padding:12px 28px;background-color:#065f46;color:#ffffff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:700;letter-spacing:0.3px;box-shadow:0 4px 10px rgba(6,95,70,0.25);">' +
    '                  Masuk ke Portal Pendaftaran' +
    '                </a>' +
    '              </div>' +
    '            </td>' +
    '          </tr>' +
    '          ' +
    '          <!-- FOOTER: INFORMASI RESMI MADRASAH PENGIRIM -->' +
    '          <tr>' +
    '            <td style="background-color:#f8fafc;padding:20px 28px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;line-height:1.5;">' +
    '              <p style="margin:0 0 6px 0;font-weight:700;color:#334155;">Panitia Penerimaan Peserta Didik Baru (PPDB)</p>' +
    '              <p style="margin:0 0 4px 0;font-weight:600;color:#065f46;">' + schoolName + '</p>' +
    '              ' + (schoolAddress ? ('<p style="margin:0 0 4px 0;">Alamat: ' + schoolAddress + '</p>') : '') +
    '              ' + (schoolEmail || schoolPhone ? ('<p style="margin:0 0 4px 0;">' + (schoolEmail ? ('Email: ' + schoolEmail) : '') + (schoolEmail && schoolPhone ? ' | ' : '') + (schoolPhone ? ('Telp: ' + schoolPhone) : '') + '</p>') : '') +
    '              <p style="margin:12px 0 0 0;padding-top:10px;border-top:1px dashed #cbd5e1;font-size:11px;color:#94a3b8;text-align:center;">' +
    '                Notifikasi ini dikirimkan otomatis oleh ' + appName + ' kepada Calon Peserta Didik yang terdaftar. Untuk pertanyaan resmi, Anda dapat membalas (reply) langsung ke email madrasah di atas.' +
    '              </p>' +
    '            </td>' +
    '          </tr>' +
    '        </table>' +
    '      </td>' +
    '    </tr>' +
    '  </table>' +
    '</body>' +
    '</html>';
}

/**
 * 9. VERIFIKASI APLIKASI & AUTO NOTIFIKASI
 */
function handleVerifyApplication(data, spreadsheetId) {
  if (!data) return { success: false, message: "Data verifikasi kosong" };
  var regNum = data.registration_number;
  var status = data.verification_status || data.status;
  var notes = data.verification_notes || data.notes || "";
  var verifiedBy = data.verified_by || "Panitia";
  var ss = SpreadsheetApp.openById(spreadsheetId || SPREADSHEET_ID);
  var appSheet = ss.getSheetByName(SHEETS.APPLICATIONS);

  if (appSheet && regNum) {
    var dataRows = appSheet.getDataRange().getValues();
    for (var r = 1; r < dataRows.length; r++) {
      if (String(dataRows[r][0]) === String(regNum)) {
        appSheet.getRange(r + 1, 9).setValue(status); // verification_status
        appSheet.getRange(r + 1, 10).setValue(notes); // verification_notes
        if (status === "terverifikasi") {
          appSheet.getRange(r + 1, 13).setValue("terverifikasi");
        } else if (status === "perlu_perbaikan") {
          appSheet.getRange(r + 1, 13).setValue("perlu_perbaikan");
          appSheet.getRange(r + 1, 15).setValue(false); // unlock is_locked
        } else if (status === "ditolak") {
          appSheet.getRange(r + 1, 13).setValue("tidak_lulus");
        }
        break;
      }
    }
  }

  // Trigger automated email notification if email is provided
  if (data.email) {
    handleSendNotificationEmail({
      email: data.email,
      student_name: data.student_name,
      registration_number: regNum,
      school_name: data.school_name,
      event_type: "verification",
      new_status: status,
      notes: notes,
      app_name: data.app_name || "SIPMA"
    }, spreadsheetId);
  }

  return {
    success: true,
    message: "Status verifikasi berhasil diperbarui" + (data.email ? " dan notifikasi email terkirim" : "") + "."
  };
}

/**
 * 10. PROSES STATUS KELULUSAN & AUTO NOTIFIKASI
 */
function handleProcessSelection(data, spreadsheetId) {
  if (!data) return { success: false, message: "Data seleksi kosong" };
  var regNum = data.registration_number;
  var status = data.selection_status || data.status; // "lulus" | "tidak_lulus"
  var ss = SpreadsheetApp.openById(spreadsheetId || SPREADSHEET_ID);
  var appSheet = ss.getSheetByName(SHEETS.APPLICATIONS);

  if (appSheet && regNum) {
    var dataRows = appSheet.getDataRange().getValues();
    for (var r = 1; r < dataRows.length; r++) {
      if (String(dataRows[r][0]) === String(regNum)) {
        appSheet.getRange(r + 1, 11).setValue(status); // selection_status
        if (status === "lulus") {
          appSheet.getRange(r + 1, 13).setValue("lulus"); // final_status
        } else {
          appSheet.getRange(r + 1, 13).setValue("tidak_lulus");
        }
        break;
      }
    }
  }

  // Trigger automated email notification if email is provided
  if (data.email) {
    handleSendNotificationEmail({
      email: data.email,
      student_name: data.student_name,
      registration_number: regNum,
      school_name: data.school_name,
      event_type: "selection",
      new_status: status,
      notes: data.notes || "",
      app_name: data.app_name || "SIPMA"
    }, spreadsheetId);
  }

  return {
    success: true,
    message: "Status kelulusan berhasil diproses" + (data.email ? " dan notifikasi email terkirim" : "") + "."
  };
}

/**
 * 11. SIMPAN ATAU PERBARUI DATA PENDAFTARAN
 */
function handleSaveApplication(appData, spreadsheetId) {
  if (!appData) return { success: false, message: "Data pendaftaran kosong" };
  var ss = SpreadsheetApp.openById(spreadsheetId || SPREADSHEET_ID);
  ensureAllSheetsExist(ss);

  var regNum = appData.registration_number;
  if (!regNum) return { success: false, message: "Nomor registrasi tidak ditemukan" };

  var appSheet = ss.getSheetByName(SHEETS.APPLICATIONS);
  if (appSheet) {
    var rows = appSheet.getDataRange().getValues();
    var rowIndex = -1;
    for (var r = 1; r < rows.length; r++) {
      if (String(rows[r][1]).trim() === String(regNum).trim()) {
        rowIndex = r + 1;
        break;
      }
    }

    var rowValues = [
      appData.application_id || ("APP-" + regNum),
      regNum,
      appData.user_id || "",
      appData.student_id || "",
      appData.school_id || "",
      appData.admission_year || "2026",
      appData.pathway || "zonasi",
      appData.submission_date || new Date().toISOString(),
      appData.latitude || 0,
      appData.longitude || 0,
      appData.distance_km || 0,
      appData.max_distance_km || 5.0,
      appData.zoning_status || "memenuhi",
      appData.verification_status || "menunggu",
      appData.selection_status || "menunggu",
      appData.final_status || "draft",
      appData.verification_notes || "",
      appData.score || 0,
      appData.afirmasi_category || "",
      appData.dispensation_reason || "",
      appData.achievement_type || "",
      appData.achievement_name || "",
      appData.achievement_level || "",
      appData.achievement_rank || "",
      appData.mutation_parent_instansi || "",
      appData.mutation_letter_number || "",
      appData.mutation_letter_date || "",
      appData.step_completed || 1,
      appData.is_locked ? "true" : "false",
      appData.created_at || new Date().toISOString(),
      appData.updated_at || new Date().toISOString()
    ];

    if (rowIndex > 0) {
      appSheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      appSheet.appendRow(rowValues);
    }
  }

  return { success: true, message: "Data pendaftaran " + regNum + " berhasil disimpan", registration_number: regNum };
}

/**
 * 12. SIMPAN ATAU PERBARUI DATA MADRASAH
 */
function handleSaveSchool(schoolData, spreadsheetId) {
  if (!schoolData) return { success: false, message: "Data madrasah kosong" };
  var ss = SpreadsheetApp.openById(spreadsheetId || SPREADSHEET_ID);
  ensureAllSheetsExist(ss);
  var sheet = ss.getSheetByName(SHEETS.SCHOOLS);
  if (!sheet) return { success: false, message: "Sheet Schools tidak ditemukan" };

  var schoolId = schoolData.school_id || ("SCH-" + Date.now());
  var rows = sheet.getDataRange().getValues();
  var rowIndex = -1;
  for (var r = 1; r < rows.length; r++) {
    if (String(rows[r][0]).trim() === String(schoolId).trim()) {
      rowIndex = r + 1;
      break;
    }
  }

  var rowValues = [
    schoolId,
    schoolData.school_name || "",
    schoolData.school_code || "",
    schoolData.nsm || "",
    schoolData.npsn || "",
    schoolData.level || "MA",
    schoolData.address || "",
    schoolData.village || "",
    schoolData.district || "",
    schoolData.city || "",
    schoolData.province || "",
    schoolData.latitude || 0,
    schoolData.longitude || 0,
    schoolData.zoning_radius_km || 5.0,
    schoolData.quota_total || 0,
    schoolData.quota_zonasi || 0,
    schoolData.quota_afirmasi || 0,
    schoolData.quota_prestasi || 0,
    schoolData.quota_mutasi || 0,
    schoolData.status || "active",
    schoolData.principal_name || "",
    schoolData.contact_phone || "",
    schoolData.contact_email || "",
    schoolData.logo_url || ""
  ];

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }

  return { success: true, message: "Data madrasah berhasil disimpan", school_id: schoolId };
}

/**
 * 13. SIMPAN ATAU PERBARUI PENGUMUMAN
 */
function handleSaveAnnouncement(data, spreadsheetId) {
  if (!data) return { success: false, message: "Data pengumuman kosong" };
  var ss = SpreadsheetApp.openById(spreadsheetId || SPREADSHEET_ID);
  ensureAllSheetsExist(ss);
  var sheet = ss.getSheetByName(SHEETS.ANNOUNCEMENTS);
  if (!sheet) return { success: false, message: "Sheet Announcements tidak ditemukan" };

  var ancId = data.announcement_id || ("ANC-" + Date.now());
  var rows = sheet.getDataRange().getValues();
  var rowIndex = -1;
  for (var r = 1; r < rows.length; r++) {
    if (String(rows[r][0]).trim() === String(ancId).trim()) {
      rowIndex = r + 1;
      break;
    }
  }

  var rowValues = [
    ancId,
    data.title || "",
    data.content || "",
    data.category || "informasi",
    data.target_role || "all",
    data.school_id || "",
    data.is_published ? "true" : "false",
    data.created_at || new Date().toISOString(),
    data.author_name || ""
  ];

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }

  return { success: true, message: "Pengumuman berhasil disimpan", announcement_id: ancId };
}

/**
 * 14. RESET PASSWORD PENGGUNA
 */
function handleResetPassword(data, spreadsheetId) {
  if (!data) return { success: false, message: "Data reset password kosong" };
  var userId = data.user_id || "";
  var email = (data.email || "").toLowerCase().trim();
  var regNum = data.registration_number || "";
  var newPassword = data.new_password || "123456";

  var ss = SpreadsheetApp.openById(spreadsheetId || SPREADSHEET_ID);
  ensureAllSheetsExist(ss);
  var userSheet = ss.getSheetByName(SHEETS.USERS);
  if (!userSheet || userSheet.getLastRow() <= 1) {
    return { success: false, message: "Sheet Users kosong atau tidak ditemukan" };
  }

  var rows = userSheet.getDataRange().getValues();
  for (var r = 1; r < rows.length; r++) {
    var rowUserId = String(rows[r][0]).trim();
    var rowReg = String(rows[r][1]).trim();
    var rowEmail = String(rows[r][3]).toLowerCase().trim();

    if ((userId && rowUserId === userId) || (email && rowEmail === email) || (regNum && rowReg === regNum)) {
      userSheet.getRange(r + 1, 8).setValue(newPassword); // password_hash (column 8)
      userSheet.getRange(r + 1, 14).setValue(new Date().toISOString()); // updated_at (column 14)
      return {
        success: true,
        message: "Password untuk " + (rows[r][2] || email) + " berhasil direset.",
        new_password: newPassword
      };
    }
  }

  return { success: false, message: "Akun pengguna tidak ditemukan di database." };
}

/**
 * Utility Folder Drive Anti-Duplikasi
 * Mencegah pembuatan folder ganda / dobel dengan memeriksa folder aktif dan normalisasi nama.
 */
function getOrCreateFolder(parentFolder, rawName) {
  var name = String(rawName || "").trim().replace(new RegExp("[/\\\\:]", "g"), "-").replace(/\\s+/g, " ");
  if (!name) name = "General";

  // 1. Periksa kesamaan nama persis di antara folder yang tidak berada di sampah (non-trashed)
  var folders = parentFolder.getFoldersByName(name);
  while (folders.hasNext()) {
    var f = folders.next();
    try {
      if (!f.isTrashed()) {
        return f;
      }
    } catch(e) {
      return f;
    }
  }

  // 2. Periksa kesamaan nama case-insensitive pada folder anak untuk mencegah duplikasi huruf besar/kecil
  var childFolders = parentFolder.getFolders();
  while (childFolders.hasNext()) {
    var child = childFolders.next();
    try {
      if (!child.isTrashed() && child.getName().trim().toLowerCase() === name.toLowerCase()) {
        return child;
      }
    } catch(e) {}
  }

  return parentFolder.createFolder(name);
}

/**
 * Utility Folder Tahun Penerimaan Anti-Duplikasi
 * Menemukan atau membuat folder tahun penerimaan (e.g. "Tahun Penerimaan 2026-2027" atau "2026-2027")
 */
function getOrCreateYearFolder(rootFolder, rawYear) {
  var yr = String(rawYear || "2026/2027").replace(new RegExp("[/\\\\:]", "g"), "-").trim();
  var targetName = yr;
  if (targetName.toLowerCase().indexOf("tahun") === -1 && targetName.toLowerCase().indexOf("ppdb") === -1) {
    targetName = "Tahun Penerimaan " + yr;
  }

  var childFolders = rootFolder.getFolders();
  while (childFolders.hasNext()) {
    var child = childFolders.next();
    try {
      if (!child.isTrashed()) {
        var cName = child.getName().trim();
        if (cName.toLowerCase() === targetName.toLowerCase() || (yr.length >= 4 && cName.indexOf(yr) > -1)) {
          return child;
        }
      }
    } catch(e) {}
  }

  return getOrCreateFolder(rootFolder, targetName);
}

/**
 * Utility Folder Calon Murid Anti-Duplikasi
 * Sesuai Permintaan: "folder sesuai nama setiap murid yang mendaftar => isi folder data muridnya"
 * Format: "[Nama Murid] - [No Pendaftaran]"
 * Mencegah folder dobel dengan mencocokkan nomor registrasi dan nama pendaftar
 */
function getOrCreateApplicantFolder(schoolFolder, regNumber, studentName) {
  var cleanReg = String(regNumber || "Draft").trim();
  var cleanName = String(studentName || "Calon Murid").trim().replace(new RegExp("[/\\\\:]", "g"), "-").replace(/\\s+/g, " ");
  var targetFolderName = (cleanReg && cleanReg !== "Draft") ? (cleanName + " - " + cleanReg) : cleanName;

  var childFolders = schoolFolder.getFolders();
  while (childFolders.hasNext()) {
    var child = childFolders.next();
    try {
      if (!child.isTrashed()) {
        var fName = child.getName().trim();
        var isMatch = false;

        // 1. Cocokkan berdasarkan nomor registrasi unik
        if (cleanReg && cleanReg !== "Draft") {
          if (fName.indexOf(cleanReg) > -1 || fName.endsWith(cleanReg) || fName.startsWith(cleanReg)) {
            isMatch = true;
          }
        }

        // 2. Atau cocokkan berdasarkan nama murid persis
        if (!isMatch && cleanName && cleanName.toLowerCase() !== "calon murid") {
          if (fName.toLowerCase() === cleanName.toLowerCase() || fName.toLowerCase().startsWith(cleanName.toLowerCase() + " -")) {
            isMatch = true;
          }
        }

        if (isMatch) {
          // Selalu rapikan nama folder ke format standar [Nama Murid] - [No Pendaftaran]
          if (fName !== targetFolderName && cleanReg !== "Draft") {
            try { child.setName(targetFolderName); } catch(e) {}
          }
          return child;
        }
      }
    } catch(e) {}
  }

  return getOrCreateFolder(schoolFolder, targetFolderName);
}

/**
 * Utility Folder Akun Pengguna Anti-Duplikasi
 * Sesuai Permintaan: "Folder nama akun khusus untuk database yang berkaitan akun => isi file dari akun yang bersangkutan"
 * Format: "[Nama Akun] ([Username / User ID])"
 */
function getOrCreateAccountFolder(accountsBaseFolder, accountName, accountId) {
  var cleanName = String(accountName || "Akun Pengguna").trim().replace(new RegExp("[/\\\\:]", "g"), "-").replace(/\\s+/g, " ");
  var cleanId = String(accountId || "").trim().replace(new RegExp("[/\\\\:]", "g"), "-");
  var targetFolderName = cleanId ? (cleanName + " (" + cleanId + ")") : cleanName;

  var childFolders = accountsBaseFolder.getFolders();
  while (childFolders.hasNext()) {
    var child = childFolders.next();
    try {
      if (!child.isTrashed()) {
        var fName = child.getName().trim();
        var isMatch = false;

        if (cleanId && (fName.indexOf(cleanId) > -1 || fName.toLowerCase().indexOf(cleanId.toLowerCase()) > -1)) {
          isMatch = true;
        } else if (cleanName && cleanName.toLowerCase() !== "akun pengguna") {
          if (fName.toLowerCase() === cleanName.toLowerCase() || fName.toLowerCase().startsWith(cleanName.toLowerCase() + " (")) {
            isMatch = true;
          }
        }

        if (isMatch) {
          if (fName !== targetFolderName && cleanId) {
            try { child.setName(targetFolderName); } catch(e) {}
          }
          return child;
        }
      }
    } catch(e) {}
  }

  return getOrCreateFolder(accountsBaseFolder, targetFolderName);
}

/**
 * Helper: Ambil Nilai Pengaturan dari Sheet Settings
 */
function getSettingValueFromSheet(ss, key) {
  try {
    var sheet = ss.getSheetByName(SHEETS.SETTINGS);
    if (!sheet || sheet.getLastRow() <= 1) return "";
    var values = sheet.getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0]).trim() === String(key).trim()) {
        return String(values[i][1]).trim();
      }
    }
  } catch(e) {}
  return "";
}

/**
 * Helper: Ambil Nama Madrasah dari Sheet Schools berdasarkan school_id
 */
function getSchoolNameById(ss, schoolId) {
  if (!schoolId) return "";
  try {
    var sheet = ss.getSheetByName(SHEETS.SCHOOLS);
    if (!sheet || sheet.getLastRow() <= 1) return "";
    var values = sheet.getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0]).trim() === String(schoolId).trim()) {
        return String(values[i][1]).trim();
      }
    }
  } catch(e) {}
  return "";
}

/**
 * Helper Password Hash (SHA-256)
 */
function hashPassword(pass) {
  if (!pass) return "";
  var rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pass);
  var txtHash = "";
  for (var i = 0; i < rawHash.length; i++) {
    var val = rawHash[i];
    if (val < 0) val += 256;
    var byteStr = val.toString(16);
    if (byteStr.length == 1) byteStr = "0" + byteStr;
    txtHash += byteStr;
  }
  return txtHash;
}
`;

export const GAS_SETUP_STEPS = [
  {
    step: 1,
    title: 'Buat Google Spreadsheet Baru (Database)',
    description: 'Buka sheets.google.com, buat spreadsheet baru bernama "SIPMA Database 2026", lalu salin Spreadsheet ID dari URL (string panjang antara /d/ dan /edit). Anda tidak perlu membuat sheet manual karena sistem akan membuatnya secara otomatis!',
  },
  {
    step: 2,
    title: 'Buat Folder Root di Google Drive (Penyimpanan Berkas)',
    description: 'Buka drive.google.com, buat folder baru bernama "SIPMA_Storage_2026", lalu salin Folder ID dari URL browser.',
  },
  {
    step: 3,
    title: 'Buka Google Apps Script',
    description: 'Di dalam Spreadsheet yang baru dibuat, klik menu Extensions (Ekstensi) > Apps Script, atau buka script.google.com.',
  },
  {
    step: 4,
    title: 'Tempel Kode Backend (Code.gs)',
    description: 'Hapus kode default di Code.gs dan salin template kode backend versi 2.0 yang sudah disiapkan pada tab Kode Backend. Ganti SPREADSHEET_ID dan DRIVE_ROOT_FOLDER_ID dengan ID Anda.',
  },
  {
    step: 5,
    title: 'Deploy sebagai Web App & Berikan Izin Akses Email',
    description: 'Klik tombol "Deploy" (Terapkan) > "New deployment" (Penerapan baru). Pilih type "Web app". Atur: Execute as: "Me" dan Who has access: "Anyone" (Siapa saja). Klik "Deploy", lalu klik "Authorize access" (izinkan akses Spreadsheet, Drive, dan Kirim Email Notifikasi PPDB atas nama madrasah). Salin URL Web App yang berakhiran /exec.',
  },
  {
    step: 6,
    title: 'Buka Kunci Konfigurasi & Inisialisasi Otomatis',
    description: 'Buka tab Konfigurasi Database di SIPMA, buka kunci dengan PIN Anda, masukkan Web App URL, Spreadsheet ID, dan Drive Folder ID. Lalu klik "⚡ Inisialisasi Database Otomatis". Sistem akan langsung membuat 11 tabel sheet lengkap dengan warna, header, dan data awal!',
  },
  {
    step: 7,
    title: 'Deploy ke Vercel (Production Global)',
    description: 'Ekspor proyek ke GitHub atau unggah repositori ke vercel.com. Tambahkan Environment Variables VITE_GAS_WEB_APP_URL, VITE_SPREADSHEET_ID, dan VITE_DRIVE_ROOT_FOLDER_ID di Vercel agar database otomatis terhubung untuk semua pengunjung.',
  },
  {
    step: 8,
    title: 'Auto-Update & Realtime Sinkronisasi Aktif',
    description: 'Setiap kali ada pendaftaran baru, verifikasi berkas, perubahan status seleksi, atau upload dokumen, sistem akan langsung mengupdate Google Sheets dan Google Drive secara otomatis di latar belakang.',
  },
];
