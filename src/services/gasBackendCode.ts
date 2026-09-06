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
 * =========================================================================
 * FUNGSI OTORISASI GOOGLE DRIVE & GOOGLE SHEETS
 * Jalankan fungsi ini SEKALI di Google Apps Script Editor (pilih authorizePermissions lalu klik Run/Jalankan)
 * untuk memberikan izin akses Google Drive (DriveApp) dan Google Sheets (SpreadsheetApp).
 * =========================================================================
 */
function authorizePermissions() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var driveFolder = DriveApp.getRootFolder();
    Logger.log("✓ Otorisasi Berhasil! Spreadsheet: " + ss.getName() + " | Folder Drive: " + driveFolder.getName());
    return "Otorisasi Berhasil!";
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
      var ss = SpreadsheetApp.openById(targetSpreadsheetId);
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
  var ss = SpreadsheetApp.openById(targetId);
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
 * Mengisi data awal madrasah dan admin jika database baru dibuat
 */
function seedInitialDataIfEmpty(ss) {
  var schoolSheet = ss.getSheetByName(SHEETS.SCHOOLS);
  if (schoolSheet && schoolSheet.getLastRow() <= 1) {
    schoolSheet.appendRow([
      "SCH-MAN1-JKT", "MAN 1 Jakarta Selatan", "MAN01", "131131740001", "20108345",
      "MA", "Jl. Wijaya Kusuma No. 48, Cilandak, Jakarta Selatan", "Cilandak Barat", "Cilandak", "Jakarta Selatan", "DKI Jakarta",
      -6.2842, 106.7978, 5.0, 180, 72, 36, 54, 18, "active", "Drs. H. Ahmad Fauzi, M.Pd", "021-7654321", "info@man1jaksel.sch.id"
    ]);
    schoolSheet.appendRow([
      "SCH-MTSN1-JKT", "MTsN 1 Jakarta Selatan", "MTS01", "121131740001", "20108346",
      "MTs", "Jl. Bangka VII No. 12, Pela Mampang, Jakarta Selatan", "Pela Mampang", "Mampang Prapatan", "Jakarta Selatan", "DKI Jakarta",
      -6.2514, 106.8211, 4.0, 160, 64, 32, 48, 16, "active", "Hj. Nurhayati, S.Ag", "021-7198765", "info@mtsn1jaksel.sch.id"
    ]);
    schoolSheet.appendRow([
      "SCH-MIN1-JKT", "MIN 1 Jakarta Selatan", "MIN01", "111131740001", "20108347",
      "MI", "Jl. Kemang Timur No. 3, Bangka, Jakarta Selatan", "Bangka", "Mampang Prapatan", "Jakarta Selatan", "DKI Jakarta",
      -6.2625, 106.8189, 3.0, 120, 48, 24, 36, 12, "active", "Dra. Siti Rahmah, M.Si", "021-7182345", "info@min1jaksel.sch.id"
    ]);
  }

  var usersSheet = ss.getSheetByName(SHEETS.USERS);
  if (usersSheet && usersSheet.getLastRow() <= 1) {
    var now = new Date().toISOString();
    usersSheet.appendRow([
      "USR-ADMIN-PUSAT", "", "Administrator Wilayah Kemenag", "admin@sipma.kemenag.go.id", "08119876543",
      "197801012005011001", "Kepala Sub Bagian PPDB", hashPassword("admin123"), "admin_pusat", "",
      "active", "", now, now
    ]);
    usersSheet.appendRow([
      "USR-PANITIA-MAN1", "", "Panitia PPDB MAN 1", "panitia@man1jaksel.sch.id", "081234567890",
      "198505122010012003", "Ketua Panitia PMB", hashPassword("panitia123"), "admin_sekolah", "SCH-MAN1-JKT",
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

  // 2. Sinkronkan Students
  if (data.students && typeof data.students === "object") {
    var studentList = Array.isArray(data.students) ? data.students : Object.values(data.students);
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
    var parentList = Array.isArray(data.parents) ? data.parents : Object.values(data.parents);
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
    var originList = Array.isArray(data.school_origins) ? data.school_origins : Object.values(data.school_origins);
    overwriteSheetData(ss.getSheetByName(SHEETS.SCHOOL_ORIGINS), DB_SCHEMA["SchoolOrigins"], originList.map(function(o) {
      return [
        o.origin_id || "", o.student_id || "", o.previous_level || "", o.school_name || "", o.npsn_nsm || "",
        o.school_status || "Swasta", o.school_address || "", o.graduation_year || "", o.diploma_number || ""
      ];
    }));
  }

  // 5. Sinkronkan Addresses
  if (data.addresses && typeof data.addresses === "object") {
    var addrList = Array.isArray(data.addresses) ? data.addresses : Object.values(data.addresses);
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
  var targetFolderId = rootFolderId || DRIVE_ROOT_FOLDER_ID;
  var rootFolder = null;
  
  try {
    if (targetFolderId && targetFolderId.length > 5 && targetFolderId.indexOf("MASUKKAN") === -1 && targetFolderId.indexOf("Sample") === -1) {
      rootFolder = DriveApp.getFolderById(targetFolderId);
    }
  } catch(e) {
    rootFolder = null;
  }

  // Fallback: cari atau buat folder SIPMA_Storage_PPDB di Google Drive utama jika root belum ada
  if (!rootFolder) {
    try {
      var defaultFolderName = "SIPMA_Storage_PPDB";
      var existingFolders = DriveApp.getRootFolder().getFoldersByName(defaultFolderName);
      while (existingFolders.hasNext()) {
        var ef = existingFolders.next();
        try {
          if (!ef.isTrashed()) {
            rootFolder = ef;
            break;
          }
        } catch(e) {}
      }
      if (!rootFolder) {
        rootFolder = DriveApp.getRootFolder().createFolder(defaultFolderName);
      }
    } catch(e) {}
  }

  var ss = SpreadsheetApp.openById(targetSpreadsheetId || SPREADSHEET_ID);
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
  var docSheet = ss.getSheetByName(SHEETS.DOCUMENTS);

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

  var rawBase64 = data.base64_data || "";
  var base64Content = rawBase64.indexOf(",") > -1 ? rawBase64.split(",")[1] : rawBase64;
  var decoded = Utilities.base64Decode(base64Content);
  
  var mimeType = data.mime_type || "application/octet-stream";
  if (!mimeType || mimeType === "application/octet-stream") {
    if (rawBase64.indexOf("data:image/jpeg") === 0 || rawBase64.indexOf("data:image/jpg") === 0) mimeType = "image/jpeg";
    else if (rawBase64.indexOf("data:image/png") === 0) mimeType = "image/png";
    else if (rawBase64.indexOf("data:image/webp") === 0) mimeType = "image/webp";
    else if (rawBase64.indexOf("data:application/pdf") === 0) mimeType = "application/pdf";
  }

  var ext = "pdf";
  if (data.file_name && data.file_name.indexOf(".") > -1) {
    var parts = data.file_name.split(".");
    ext = parts[parts.length - 1].toLowerCase();
  } else if (mimeType.indexOf("image/jpeg") > -1 || mimeType.indexOf("image/jpg") > -1) {
    ext = "jpg";
  } else if (mimeType.indexOf("image/png") > -1) {
    ext = "png";
  } else if (mimeType.indexOf("image/webp") > -1) {
    ext = "webp";
  }

  var fileId = "";
  var fileUrl = "";
  var directThumbnailUrl = "";

  // Penamaan file rapi & terstandarisasi
  var cleanStudentName = String(data.student_name || "Pendaftar").replace(/[^a-zA-Z0-9_\- ]/g, "").trim().replace(/\s+/g, "_") || "Pendaftar";
  var cleanReg = String(data.registration_number || "SIPMA").replace(/[^a-zA-Z0-9_\-]/g, "").trim() || "SIPMA";
  var cleanDocType = String(docType || "Dokumen").replace(/[^a-zA-Z0-9_\-]/g, "").trim().replace(/\s+/g, "_") || "Dokumen";

  var cleanFileName = "";
  if (isAccountFile) {
    var cleanAcc = String(data.account_name || data.student_name || "Pengguna").replace(/[^a-zA-Z0-9_\- ]/g, "").trim().replace(/\s+/g, "_");
    cleanFileName = "Foto_Profil_" + cleanAcc + "." + ext;
  } else if (isSchoolLogo) {
    var cleanSch = String(data.school_name || "Madrasah").replace(/[^a-zA-Z0-9_\- ]/g, "").trim().replace(/\s+/g, "_");
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
  for (var r = 1; r < existingRows.length; r++) {
    if (String(existingRows[r][1]).trim() === String(data.registration_number).trim() &&
        String(existingRows[r][2]).trim() === docType) {
      foundRowIndex = r + 1;
      docId = String(existingRows[r][0]); // Pertahankan docId asli
      break;
    }
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

  // 6. Pembaruan Foto Profil di Sheet Users untuk Akun Pengguna / Admin
  if (isAccountFile && directThumbnailUrl) {
    var userSheet = ss.getSheetByName(SHEETS.USERS);
    if (userSheet && userSheet.getLastRow() > 1) {
      var userRows = userSheet.getDataRange().getValues();
      var targetAccId = String(data.account_id || data.user_id || data.registration_number || "").trim();
      var targetAccName = String(data.account_name || data.student_name || "").trim();
      for (var u = 1; u < userRows.length; u++) {
        var rowUserId = String(userRows[u][0]).trim();
        var rowReg = String(userRows[u][1]).trim();
        var rowName = String(userRows[u][2]).trim();
        var rowEmail = String(userRows[u][3]).trim();
        if ((targetAccId && (rowUserId === targetAccId || rowReg === targetAccId || rowEmail === targetAccId)) ||
            (targetAccName && rowName.toLowerCase() === targetAccName.toLowerCase())) {
          // Kolom ke-12 adalah photo_url di Sheet Users
          userSheet.getRange(u + 1, 12).setValue(directThumbnailUrl);
          break;
        }
      }
    }
  }

  // 7. Pembaruan Pas Foto Calon Murid di Sheet Students (Kolom ke-19)
  if ((docType === "foto" || docType === "pas_foto" || docType === "foto_profil") && directThumbnailUrl) {
    var studentSheet = ss.getSheetByName(SHEETS.STUDENTS);
    if (studentSheet && studentSheet.getLastRow() > 1) {
      var studentRows = studentSheet.getDataRange().getValues();
      for (var s = 1; s < studentRows.length; s++) {
        if (String(studentRows[s][2]).trim() === String(data.registration_number).trim() || String(studentRows[s][0]).trim() === String(data.registration_number).trim()) {
          studentSheet.getRange(s + 1, 19).setValue(directThumbnailUrl);
          break;
        }
      }
    }
  }

  // 8. Pembaruan Logo Resmi Madrasah di Sheet Schools (Kolom ke-24)
  if (isSchoolLogo && directThumbnailUrl) {
    var schSheet = ss.getSheetByName(SHEETS.SCHOOLS);
    if (schSheet && schSheet.getLastRow() > 1) {
      var schRows = schSheet.getDataRange().getValues();
      for (var sc = 1; sc < schRows.length; sc++) {
        if (String(schRows[sc][0]).trim() === String(data.school_id || data.registration_number).trim() || 
            String(schRows[sc][1]).trim().toLowerCase() === String(data.school_name).trim().toLowerCase()) {
          schSheet.getRange(sc + 1, 24).setValue(directThumbnailUrl);
          break;
        }
      }
    }
  }

  // 9. Pembaruan Logo Aplikasi di Sheet Settings
  if (isAppLogo && directThumbnailUrl) {
    var settSheet = ss.getSheetByName(SHEETS.SETTINGS);
    if (settSheet) {
      var settRows = settSheet.getDataRange().getValues();
      var foundLogoSett = false;
      for (var st = 1; st < settRows.length; st++) {
        if (settRows[st][0] === "app_logo") {
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
    }
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
 * 5. HAPUS SATU DOKUMEN / FILE SPESIFIK DARI DRIVE & SHEETS
 */
function handleDeleteFile(data, spreadsheetId) {
  var driveFileId = data ? data.drive_file_id : "";
  var documentId = data ? data.document_id : "";
  var regNumber = data ? data.registration_number : "";
  var deleted = false;

  if (driveFileId && driveFileId.length > 5) {
    try {
      var f = DriveApp.getFileById(driveFileId);
      if (f) {
        f.setTrashed(true);
        deleted = true;
      }
    } catch(e) {}
  }

  var targetId = spreadsheetId || SPREADSHEET_ID;
  var ss = SpreadsheetApp.openById(targetId);
  var docSheet = ss.getSheetByName(SHEETS.DOCUMENTS);

  if (docSheet && docSheet.getLastRow() > 1) {
    var docRows = docSheet.getDataRange().getValues();
    for (var r = docRows.length - 1; r >= 1; r--) {
      var match = false;
      if (documentId && String(docRows[r][0]).trim() === String(documentId).trim()) match = true;
      if (driveFileId && String(docRows[r][5]).trim() === String(driveFileId).trim()) match = true;
      if (match) {
        docSheet.deleteRow(r + 1);
        break;
      }
    }
  }

  return {
    success: true,
    message: "File berhasil dihapus dari Google Drive dan database Documents.",
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
 * Utility Folder Drive Anti-Duplikasi
 * Mencegah pembuatan folder ganda / dobel dengan memeriksa folder aktif dan normalisasi nama.
 */
function getOrCreateFolder(parentFolder, rawName) {
  var name = String(rawName || "").trim().replace(/[\/\\:]/g, "-").replace(/\s+/g, " ");
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
  var yr = String(rawYear || "2026/2027").replace(/[\/\\:]/g, "-").trim();
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
  var cleanName = String(studentName || "Calon Murid").trim().replace(/[\/\\:]/g, "-").replace(/\s+/g, " ");
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
  var cleanName = String(accountName || "Akun Pengguna").trim().replace(/[\/\\:]/g, "-").replace(/\s+/g, " ");
  var cleanId = String(accountId || "").trim().replace(/[\/\\:]/g, "-");
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
    title: 'Deploy sebagai Web App',
    description: 'Klik tombol "Deploy" (Terapkan) > "New deployment" (Penerapan baru). Pilih type "Web app". Atur: Execute as: "Me" dan Who has access: "Anyone" (Siapa saja). Salin URL Web App yang berakhiran /exec.',
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
