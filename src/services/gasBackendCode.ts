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
      case "notifySchoolNewApplicant":
      case "notifySchool":
        response = handleNotifySchoolNewApplicant(payload.data, targetSpreadsheetId);
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
      case "openNewAcademicYear":
      case "rolloverAcademicYear":
        response = handleOpenNewAcademicYear(payload.data, targetSpreadsheetId, payload.drive_root_folder_id || DRIVE_ROOT_FOLDER_ID);
        break;
      case "cleanMissingDriveFiles":
      case "verifyDriveFiles":
        var targetSS = SpreadsheetApp.openById(targetSpreadsheetId);
        response = verifyAndCleanMissingDriveFiles(targetSS);
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
    var schemaHeaders = DB_SCHEMA[sheetName];
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(schemaHeaders);
      var hr = sheet.getRange(1, 1, 1, schemaHeaders.length);
      hr.setFontWeight("bold");
      hr.setBackground("#059669");
      hr.setFontColor("#ffffff");
      sheet.setFrozenRows(1);
    } else {
      var currentCols = sheet.getLastColumn();
      if (currentCols < schemaHeaders.length) {
        var diff = schemaHeaders.length - sheet.getMaxColumns();
        if (diff > 0) sheet.insertColumnsAfter(sheet.getMaxColumns(), diff);
      }
      var existingRow1 = sheet.getRange(1, 1, 1, Math.max(schemaHeaders.length, currentCols || 1)).getValues()[0];
      var isIdentical = true;
      for (var h = 0; h < schemaHeaders.length; h++) {
        if (existingRow1[h] !== schemaHeaders[h]) {
          isIdentical = false;
          break;
        }
      }
      if (!isIdentical) {
        sheet.getRange(1, 1, 1, schemaHeaders.length).setValues([schemaHeaders]);
        var hr2 = sheet.getRange(1, 1, 1, schemaHeaders.length);
        hr2.setFontWeight("bold");
        hr2.setBackground("#059669");
        hr2.setFontColor("#ffffff");
        sheet.setFrozenRows(1);
      }
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
        u.user_id || "", u.registration_number || "", u.name || "", u.email || "", formatPhoneForSheetGAS(u.phone),
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
        s.hobby || "", s.living_status || "orang_tua_kandung", formatPhoneForSheetGAS(s.phone), s.email || "", s.photo_url || ""
      ];
    }));
  }

  // 3. Sinkronkan Parents
  if (data.parents && typeof data.parents === "object") {
    var parentList = getObjectValues(data.parents);
    overwriteSheetData(ss.getSheetByName(SHEETS.PARENTS), DB_SCHEMA["Parents"], parentList.map(function(p) {
      return [
        p.parent_id || "", p.student_id || "", p.father_name || "", p.father_status || "hidup", p.father_nik || "",
        p.father_birth_place || "", p.father_birth_date || "", p.father_education || "", p.father_job || "", p.father_income || "", formatPhoneForSheetGAS(p.father_phone),
        p.mother_name || "", p.mother_status || "hidup", p.mother_nik || "", p.mother_birth_place || "", p.mother_birth_date || "", p.mother_education || "", p.mother_job || "", p.mother_income || "", formatPhoneForSheetGAS(p.mother_phone),
        p.guardian_name || "", p.guardian_nik || "", p.guardian_relation || "", p.guardian_birth_place || "", p.guardian_birth_date || "", p.guardian_education || "", p.guardian_job || "", p.guardian_income || "", formatPhoneForSheetGAS(p.guardian_phone), p.guardian_address || ""
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
        sch.status || "active", sch.principal_name || "", formatPhoneForSheetGAS(sch.contact_phone), sch.contact_email || "", sch.logo_url || ""
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

  // Auto-clean any files/photos that were deleted directly from Google Drive
  try {
    verifyAndCleanMissingDriveFiles(ss);
  } catch (cleanErr) {
    Logger.log("verifyAndCleanMissingDriveFiles error: " + cleanErr.toString());
  }

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
    students: arrayToMap(readSheetAsObjects(ss.getSheetByName(SHEETS.STUDENTS)), "registration_number", "student_id"),
    parents: arrayToMap(readSheetAsObjects(ss.getSheetByName(SHEETS.PARENTS)), "student_id", "registration_number"),
    school_origins: arrayToMap(readSheetAsObjects(ss.getSheetByName(SHEETS.SCHOOL_ORIGINS)), "student_id", "registration_number"),
    addresses: arrayToMap(readSheetAsObjects(ss.getSheetByName(SHEETS.ADDRESSES)), "student_id", "registration_number"),
    applications: readSheetAsObjects(ss.getSheetByName(SHEETS.APPLICATIONS)),
    documents: readSheetAsObjects(ss.getSheetByName(SHEETS.DOCUMENTS)),
    schools: readSheetAsObjects(ss.getSheetByName(SHEETS.SCHOOLS)),
    announcements: readSheetAsObjects(ss.getSheetByName(SHEETS.ANNOUNCEMENTS)),
    audit_logs: readSheetAsObjects(ss.getSheetByName(SHEETS.AUDIT_LOG)),
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
 * Normalisasi nomor HP / WhatsApp ke format '08...' di backend Google Apps Script.
 * Menjamin jika berawalan 08 ataupun +62 (atau 62) akan tetap tersimpan sebagai 08 di database Sheets
 * dan tidak berubah menjadi 62 atau angka tanpa awalan 0.
 */
function normalizeIndonesianPhoneGAS(phone) {
  if (phone === null || phone === undefined) return "";
  var str = String(phone).trim();
  if (!str) return "";
  if (str.indexOf("'") === 0) {
    str = str.substring(1).trim();
  }
  var hasPlus = str.indexOf("+") === 0;
  var digits = str.replace(/[^\d]/g, "");
  if (!digits) return "";
  if (hasPlus && digits.indexOf("62") === 0) {
    digits = "0" + digits.substring(2);
  } else if (digits.indexOf("62") === 0) {
    digits = "0" + digits.substring(2);
  } else if (digits.indexOf("8") === 0) {
    digits = "0" + digits;
  }
  return digits;
}

function formatPhoneForSheetGAS(phone) {
  var norm = normalizeIndonesianPhoneGAS(phone);
  if (!norm) return "";
  return "'" + norm;
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
  var currentMaxCols = sheet.getMaxColumns();
  if (headers.length > currentMaxCols) {
    sheet.insertColumnsAfter(currentMaxCols, headers.length - currentMaxCols);
  }
  // Selalu segarkan baris header agar skema kolom tidak pernah tertukar atau bergeser
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  var hr = sheet.getRange(1, 1, 1, headers.length);
  hr.setFontWeight("bold");
  hr.setBackground("#059669");
  hr.setFontColor("#ffffff");
  sheet.setFrozenRows(1);

  if (rows && rows.length > 0) {
    var neededRows = rows.length + 1;
    var currentMaxRows = sheet.getMaxRows();
    if (neededRows > currentMaxRows) {
      sheet.insertRowsAfter(currentMaxRows, neededRows - currentMaxRows);
    }
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);

    // Kunci format kolom teks murni (@) untuk seluruh kolom telepon/WA, NIK, NISN, dan nomor pendaftaran
    // agar awalan '08' tidak pernah dikonversi oleh Google Sheets menjadi angka atau '62'
    try {
      for (var c = 0; c < headers.length; c++) {
        var colName = String(headers[c] || "").toLowerCase();
        if (
          colName.indexOf("phone") > -1 ||
          colName.indexOf("kontak") > -1 ||
          colName === "nik" ||
          colName.indexOf("_nik") > -1 ||
          colName === "nisn" ||
          colName === "registration_number" ||
          colName === "family_card_number"
        ) {
          sheet.getRange(2, c + 1, rows.length, 1).setNumberFormat("@");
        }
      }
    } catch (fmtErr) {}
  }
}

/**
 * Helper: Baca Sheet menjadi Array of Objects dengan konversi tipe & tanggal yang aman
 */
function readSheetAsObjects(sheet) {
  if (!sheet || sheet.getLastRow() <= 1) return [];
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var sheetName = sheet.getName();
  var isUsersSheet = (sheetName === SHEETS.USERS || sheetName === "Users");
  var hasPhotoCol = headers.indexOf("photo_url") > -1;
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

      // Normalisasi nilai kolom: Jika telepon/WA, kembalikan ke format '08...' yang bersih
      var lowerKey = String(headerKey).toLowerCase();
      if (lowerKey.indexOf("phone") > -1 || lowerKey.indexOf("kontak") > -1) {
        val = normalizeIndonesianPhoneGAS(val);
      } else if (typeof val === "string" && val.indexOf("'") === 0) {
        val = val.substring(1);
      }

      obj[headerKey] = val;
    }

    // Auto-heal skema legacy Users: Jika header photo_url belum terpasang atau nilai created_at terisi URL foto
    if (isUsersSheet) {
      if (!hasPhotoCol && values[i].length > 11) {
        var col12Val = String(values[i][11] || "").trim();
        obj["photo_url"] = col12Val;
      } else if (obj["photo_url"] === undefined) {
        obj["photo_url"] = "";
      }
      if (obj["created_at"] && (String(obj["created_at"]).indexOf("http") === 0 || String(obj["created_at"]).indexOf("/uploads/") === 0)) {
        if (!obj["photo_url"]) obj["photo_url"] = obj["created_at"];
        obj["created_at"] = new Date().toISOString();
      }
    }

    if (hasValidData) {
      results.push(obj);
    }
  }
  return results;
}

/**
 * Helper: Array ke Map Object dengan Key tertentu (mendukung multiple alternate keys)
 */
function arrayToMap(arr, keyField, alternateKeyField) {
  var map = {};
  if (!arr || !Array.isArray(arr)) return map;
  for (var i = 0; i < arr.length; i++) {
    var item = arr[i];
    var k = item[keyField];
    if (k !== undefined && k !== null && k !== "") {
      var strK = String(k).trim();
      if (strK) map[strK] = item;
    }
    if (alternateKeyField) {
      var altK = item[alternateKeyField];
      if (altK !== undefined && altK !== null && altK !== "") {
        var strAltK = String(altK).trim();
        if (strAltK && !map[strAltK]) map[strAltK] = item;
      }
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
  var isDocPdf = false;
  var fileId = "";
  var fileUrl = "";
  var directThumbnailUrl = "";
  var cleanFileName = "";
  var docId = "DOC-" + Utilities.getUuid().substring(0, 8);
  var rootFolder = getOrOpenRootFolder(rootFolderId);
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
        } else if (data.use_category_folder === true || data.archive_mode === "category") {
          // Hirarki Terstruktur Berdasarkan Kategori Dokumen (KK, Akta, Ijazah, dsb.)
          var categoryFolderLabel = getCategoryFolderLabel(docType);
          var archivesRootFolder = getOrCreateFolder(schoolFolder, "ARSIP DIGITAL BERDASARKAN KATEGORI");
          destFolder = getOrCreateFolder(archivesRootFolder, categoryFolderLabel);
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

  // Penamaan file rapi & terstandarisasi
  var cleanStudentName = String(data.student_name || "Pendaftar").replace(/[^a-zA-Z0-9_ -]/g, "").trim().replace(/\s+/g, "_") || "Pendaftar";
  var cleanReg = String(data.registration_number || "SIPMA").replace(/[^a-zA-Z0-9_\-]/g, "").trim() || "SIPMA";
  var cleanDocType = String(docType || "Dokumen").replace(/[^a-zA-Z0-9_\-]/g, "").trim().replace(/\s+/g, "_") || "Dokumen";

  var isDocPdf = (ext === "pdf" || mimeType === "application/pdf" || String(cleanDocType).toLowerCase().indexOf("pdf") > -1);

  cleanFileName = "";
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
      var userHeaders = userRows[0];
      var userPhotoCol = userHeaders.indexOf("photo_url") + 1;
      if (userPhotoCol <= 0) {
        ensureAllSheetsExist(ss);
        userRows = userSheet.getDataRange().getValues();
        userHeaders = userRows[0];
        userPhotoCol = userHeaders.indexOf("photo_url") + 1;
        if (userPhotoCol <= 0) userPhotoCol = 12;
      }

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
          var prevUserPhoto = String(userRows[u][userPhotoCol - 1] || "").trim();
          var prevUserPhotoId = extractDriveIdFromAnyUrl(prevUserPhoto);
          if (prevUserPhotoId && prevUserPhotoId.length > 5 && prevUserPhotoId !== fileId && prevUserPhotoId !== "LOCAL_STORAGE") {
            try { DriveApp.getFileById(prevUserPhotoId).setTrashed(true); } catch(e) {}
          }
          userSheet.getRange(u + 1, userPhotoCol).setValue(directThumbnailUrl);
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
      var stdHeaders = studentRows[0];
      var stdPhotoCol = stdHeaders.indexOf("photo_url") + 1;
      if (stdPhotoCol <= 0) stdPhotoCol = 19;

      var regTarget = String(data.registration_number || data.account_id || "").trim();
      for (var s = 1; s < studentRows.length; s++) {
        var sReg = String(studentRows[s][2]).trim();
        var sId = String(studentRows[s][0]).trim();
        if ((regTarget && (sReg === regTarget || sId === regTarget)) ||
            (cleanStudentName && String(studentRows[s][3] || "").trim().toLowerCase() === cleanStudentName.toLowerCase())) {
          // Bersihkan file foto murid lama dari Drive jika ada
          var prevStdPhoto = String(studentRows[s][stdPhotoCol - 1] || "").trim();
          var prevStdPhotoId = extractDriveIdFromAnyUrl(prevStdPhoto);
          if (prevStdPhotoId && prevStdPhotoId.length > 5 && prevStdPhotoId !== fileId && prevStdPhotoId !== "LOCAL_STORAGE") {
            try { DriveApp.getFileById(prevStdPhotoId).setTrashed(true); } catch(e) {}
          }
          studentSheet.getRange(s + 1, stdPhotoCol).setValue(directThumbnailUrl);
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

  var isPdfSafe = (typeof isDocPdf !== "undefined" && Boolean(isDocPdf));
  var realDriveUrl = fileUrl || (fileId ? ("https://drive.google.com/file/d/" + fileId + "/view?usp=drivesdk") : "");
  return {
    success: true,
    message: "Dokumen berhasil tersimpan rapi di Google Drive dan Google Sheets tanpa data dobel!",
    file: {
      document_id: docId,
      file_name: cleanFileName,
      drive_file_id: fileId,
      drive_url: realDriveUrl,
      view_url: isPdfSafe ? realDriveUrl : (directThumbnailUrl || realDriveUrl),
      thumbnail_url: directThumbnailUrl || realDriveUrl
    },
    data: {
      document_id: docId,
      file_name: cleanFileName,
      drive_file_id: fileId,
      drive_url: realDriveUrl,
      view_url: isPdfSafe ? realDriveUrl : (directThumbnailUrl || realDriveUrl),
      thumbnail_url: directThumbnailUrl || realDriveUrl
    },
    logo_url: directThumbnailUrl || realDriveUrl
  };
}

/**
 * Helper: Hapus baris di sheet yang kolom tertentu cocok dengan targetValue (dari bawah ke atas)
 * Menangani konversi angka, teks, whitespace, dan artefak .0 dengan sangat presisi.
 */
function deleteRowsMatchingColumn(sheet, colIndex1Based, targetValue) {
  if (!sheet || sheet.getLastRow() <= 1 || !targetValue) return 0;
  var values = sheet.getDataRange().getValues();
  var deletedCount = 0;
  var target = String(targetValue).trim().toLowerCase();
  var targetClean = target.replace(/\.0$/, "");
  for (var r = values.length - 1; r >= 1; r--) {
    if (colIndex1Based - 1 < values[r].length) {
      var rawVal = values[r][colIndex1Based - 1];
      if (rawVal === null || rawVal === undefined) continue;
      var cellVal = String(rawVal).trim().toLowerCase();
      var cellValClean = cellVal.replace(/\.0$/, "");
      if (cellValClean === targetClean || cellVal === target) {
        sheet.deleteRow(r + 1);
        deletedCount++;
      }
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
  var studentName = (data && data.student_name) ? String(data.student_name).trim() : "";
  var driveFileIds = (data && data.drive_file_ids && Array.isArray(data.drive_file_ids)) ? data.drive_file_ids : [];
  
  var deletedFilesCount = 0;
  var targetId = spreadsheetId || SPREADSHEET_ID;
  var ss = SpreadsheetApp.openById(targetId);
  ensureAllSheetsExist(ss);

  // Jika studentId atau studentName belum ada, cari dari Sheet Students / Applications terlebih dahulu
  var userId = (data && data.user_id) ? String(data.user_id).trim() : "";
  if ((!studentId || !studentName || !userId) && regNumber) {
    var sSheet = ss.getSheetByName(SHEETS.STUDENTS);
    if (sSheet && sSheet.getLastRow() > 1) {
      var sRows = sSheet.getDataRange().getValues();
      for (var sr = 1; sr < sRows.length; sr++) {
        if (String(sRows[sr][2]).trim() === regNumber) {
          if (!studentId) studentId = String(sRows[sr][0]).trim();
          if (!studentName) studentName = String(sRows[sr][3]).trim();
          if (!userId) userId = String(sRows[sr][1]).trim();
          break;
        }
      }
    }
    var aSheet = ss.getSheetByName(SHEETS.APPLICATIONS);
    if (aSheet && aSheet.getLastRow() > 1) {
      var aRows = aSheet.getDataRange().getValues();
      for (var ar = 1; ar < aRows.length; ar++) {
        if (String(aRows[ar][1]).trim() === regNumber) {
          if (!studentId) studentId = String(aRows[ar][3]).trim();
          if (!userId) userId = String(aRows[ar][2]).trim();
          break;
        }
      }
    }
  }

  // 1. Hapus semua file di Google Drive berdasarkan drive_file_id
  for (var i = 0; i < driveFileIds.length; i++) {
    var fId = driveFileIds[i];
    if (fId && fId.length > 5 && fId !== "LOCAL_STORAGE") {
      try {
        var file = DriveApp.getFileById(fId);
        if (file) {
          file.setTrashed(true);
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

  // 3. Cari dan hapus seluruh berkas lepas di Google Drive yang memuat nomor registrasi
  if (regNumber) {
    var fileSearchQueries = [
      'title contains "' + regNumber + '" and trashed = false',
      'name contains "' + regNumber + '" and trashed = false'
    ];
    for (var fq = 0; fq < fileSearchQueries.length; fq++) {
      try {
        var filesFound = DriveApp.searchFiles(fileSearchQueries[fq]);
        while (filesFound.hasNext()) {
          var ff = filesFound.next();
          try {
            ff.setTrashed(true);
            deletedFilesCount++;
          } catch(e) {}
        }
      } catch(e) {}
    }
  }

  // 4. Cari dan hapus seluruh FOLDER DATA SISWA di Google Drive (beserta subfolder dan seluruh file di dalamnya)
  var folderQueries = [];
  if (regNumber) {
    folderQueries.push('title contains "' + regNumber + '" and trashed = false');
    folderQueries.push('name contains "' + regNumber + '" and trashed = false');
  }
  if (studentId) {
    folderQueries.push('title contains "' + studentId + '" and trashed = false');
    folderQueries.push('name contains "' + studentId + '" and trashed = false');
  }
  if (studentName && studentName.length >= 3 && studentName.toLowerCase() !== "calon murid" && studentName.toLowerCase() !== "pendaftar") {
    var cleanStudentNameQuery = studentName.replace(/"/g, '').trim();
    folderQueries.push('title contains "' + cleanStudentNameQuery + '" and trashed = false');
    folderQueries.push('name contains "' + cleanStudentNameQuery + '" and trashed = false');
  }

  var processedFolderIds = {};
  for (var fqi = 0; fqi < folderQueries.length; fqi++) {
    try {
      var folderMatches = DriveApp.searchFolders(folderQueries[fqi]);
      while (folderMatches.hasNext()) {
        var folder = folderMatches.next();
        var foldId = folder.getId();
        if (processedFolderIds[foldId]) continue;
        processedFolderIds[foldId] = true;

        var fName = folder.getName();
        // Validasi agar tidak menghapus folder induk umum seperti root PPDB, Madrasah, atau Tahun
        var isTargetStudentFolder = false;
        if (regNumber && fName.indexOf(regNumber) > -1) {
          isTargetStudentFolder = true;
        } else if (studentId && fName.indexOf(studentId) > -1) {
          isTargetStudentFolder = true;
        } else if (studentName && fName.toLowerCase().indexOf(studentName.toLowerCase()) > -1) {
          if (fName.indexOf("PPDB") === -1 && fName.indexOf("Tahun") === -1 && fName.indexOf("Madrasah") === -1) {
            isTargetStudentFolder = true;
          }
        }

        if (isTargetStudentFolder) {
          // Hapus seluruh file di dalam folder siswa
          try {
            var subFiles = folder.getFiles();
            while (subFiles.hasNext()) {
              try {
                var sf = subFiles.next();
                sf.setTrashed(true);
                deletedFilesCount++;
              } catch(e) {}
            }
          } catch(e) {}

          // Hapus seluruh subfolder (misal 01_KK, 02_AKTA, dll) dan isinya
          try {
            var subFolds = folder.getFolders();
            while (subFolds.hasNext()) {
              try {
                var sfold = subFolds.next();
                var sfoldFiles = sfold.getFiles();
                while (sfoldFiles.hasNext()) {
                  try {
                    sfoldFiles.next().setTrashed(true);
                    deletedFilesCount++;
                  } catch(e) {}
                }
                sfold.setTrashed(true);
              } catch(e) {}
            }
          } catch(e) {}

          // Pindahkan folder siswa ke Sampah Google Drive
          try {
            folder.setTrashed(true);
          } catch(e) {}
        }
      }
    } catch(e) {}
  }

  // 5. Telusuri folder hierarki induk root Google Drive (jika ada rootFolderId)
  var targetRootId = rootFolderId || DRIVE_ROOT_FOLDER_ID;
  if (targetRootId && targetRootId.length > 5) {
    try {
      var rootFold = DriveApp.getFolderById(targetRootId);
      if (rootFold) {
        var yrFolds = rootFold.getFolders();
        while (yrFolds.hasNext()) {
          var yf = yrFolds.next();
          var schFolds = yf.getFolders();
          while (schFolds.hasNext()) {
            var sf = schFolds.next();
            var appFolds = sf.getFolders();
            while (appFolds.hasNext()) {
              var af = appFolds.next();
              var afId = af.getId();
              if (processedFolderIds[afId]) continue;
              var afName = af.getName();
              if ((regNumber && afName.indexOf(regNumber) > -1) || (studentName && afName.indexOf(studentName) > -1)) {
                processedFolderIds[afId] = true;
                try {
                  var afFiles = af.getFiles();
                  while (afFiles.hasNext()) {
                    try { afFiles.next().setTrashed(true); deletedFilesCount++; } catch(e) {}
                  }
                  af.setTrashed(true);
                } catch(e) {}
              }
            }
          }
        }
      }
    } catch(rfErr) {}
  }

  // 6. Hapus seluruh baris data dari SELURUH tabel database Google Sheets secara akurat
  var deletedRowsCount = 0;
  if (regNumber) {
    deletedRowsCount += deleteRowsMatchingColumn(ss.getSheetByName(SHEETS.APPLICATIONS), 2, regNumber); // Applications: registration_number
    deletedRowsCount += deleteRowsMatchingColumn(ss.getSheetByName(SHEETS.STUDENTS), 3, regNumber); // Students: registration_number
    deletedRowsCount += deleteRowsMatchingColumn(ss.getSheetByName(SHEETS.DOCUMENTS), 2, regNumber); // Documents: registration_number
    deletedRowsCount += deleteRowsMatchingColumn(ss.getSheetByName(SHEETS.USERS), 2, regNumber); // Users: registration_number
    deletedRowsCount += deleteRowsMatchingColumn(ss.getSheetByName(SHEETS.PARENTS), 2, regNumber); // Parents: student_id / regNumber
    deletedRowsCount += deleteRowsMatchingColumn(ss.getSheetByName(SHEETS.SCHOOL_ORIGINS), 2, regNumber); // SchoolOrigins
    deletedRowsCount += deleteRowsMatchingColumn(ss.getSheetByName(SHEETS.ADDRESSES), 2, regNumber); // Addresses
  }

  if (studentId) {
    deletedRowsCount += deleteRowsMatchingColumn(ss.getSheetByName(SHEETS.APPLICATIONS), 4, studentId);
    deletedRowsCount += deleteRowsMatchingColumn(ss.getSheetByName(SHEETS.STUDENTS), 1, studentId);
    deletedRowsCount += deleteRowsMatchingColumn(ss.getSheetByName(SHEETS.USERS), 1, studentId);
    deletedRowsCount += deleteRowsMatchingColumn(ss.getSheetByName(SHEETS.PARENTS), 2, studentId);
    deletedRowsCount += deleteRowsMatchingColumn(ss.getSheetByName(SHEETS.SCHOOL_ORIGINS), 2, studentId);
    deletedRowsCount += deleteRowsMatchingColumn(ss.getSheetByName(SHEETS.ADDRESSES), 2, studentId);
  }

  if (userId || (data && data.user_id)) {
    var effectiveUserId = userId || data.user_id;
    deletedRowsCount += deleteRowsMatchingColumn(ss.getSheetByName(SHEETS.USERS), 1, effectiveUserId);
    deletedRowsCount += deleteRowsMatchingColumn(ss.getSheetByName(SHEETS.APPLICATIONS), 3, effectiveUserId);
    deletedRowsCount += deleteRowsMatchingColumn(ss.getSheetByName(SHEETS.STUDENTS), 2, effectiveUserId);
  }

  // Catat audit log penghapusan langsung di Sheet AuditLog
  try {
    var logSheet = ss.getSheetByName(SHEETS.AUDIT_LOG);
    if (logSheet) {
      logSheet.appendRow([
        "LOG-DEL-" + Date.now(),
        new Date().toISOString(),
        userId || "SYSTEM",
        studentName || "Panitia PPDB",
        "panitia",
        "DELETE_APPLICATION",
        regNumber,
        "Data pendaftaran " + regNumber + " (" + (studentName || "Siswa") + ") beserta seluruh file Google Drive dan baris Sheets berhasil dihapus permanen.",
        "success"
      ]);
    }
  } catch(eLog) {}

  return {
    success: true,
    message: "Data pendaftaran " + regNumber + " dan seluruh file serta folder data siswa di Google Drive dan Google Sheets berhasil dihapus permanen secara otomatis.",
    registration_number: regNumber,
    deleted_files_count: deletedFilesCount,
    deleted_rows_count: deletedRowsCount
  };
}

/**
 * 4b. BUKA TAHUN PENDAFTARAN BARU & AUTO-PURGE PENDAFTAR TIDAK LOLOS
 * - Pendaftar berstatus lolos/diterima diarsipkan permanen sesuai tahun ajaran
 * - Pendaftar yang TIDAK lolos otomatis dihapus seluruh berkasnya dari Google Drive & database Sheets
 */
function handleOpenNewAcademicYear(data, targetSpreadsheetId, rootFolderId) {
  var ss = getOrOpenSpreadsheet(targetSpreadsheetId);
  ensureAllSheetsExist(ss);

  var newYear = (data && data.new_application_year) ? String(data.new_application_year).trim() : "2027";
  var newYearLabel = (data && data.new_academic_year_label) ? String(data.new_academic_year_label).trim() : (newYear + "/" + (parseInt(newYear, 10) + 1));
  
  var appSheet = ss.getSheetByName(SHEETS.APPLICATIONS);
  var unacceptedRegNumbers = [];
  var unacceptedStudentIds = [];
  var acceptedRegNumbers = [];
  
  if (appSheet && appSheet.getLastRow() > 1) {
    var rows = appSheet.getDataRange().getValues();
    for (var r = 1; r < rows.length; r++) {
      var reg = String(rows[r][1] || "").trim();
      var sId = String(rows[r][3] || "").trim();
      var selStatus = String(rows[r][14] || "").trim().toLowerCase();
      var finStatus = String(rows[r][15] || "").trim().toLowerCase();
      
      var isLolos = (selStatus === "lulus" || finStatus === "lulus");
      if (isLolos) {
        if (reg) acceptedRegNumbers.push(reg);
      } else {
        if (reg) unacceptedRegNumbers.push(reg);
        if (sId) unacceptedStudentIds.push(sId);
      }
    }
  }

  // 1. Bersihkan seluruh file dan data dari pendaftar tidak lolos dari Drive & Sheets
  var deletedFilesCount = 0;
  for (var u = 0; u < unacceptedRegNumbers.length; u++) {
    var unreg = unacceptedRegNumbers[u];
    var unsid = unacceptedStudentIds[u] || "";
    var res = handleDeleteApplication({ registration_number: unreg, student_id: unsid }, targetSpreadsheetId, rootFolderId);
    deletedFilesCount += (res && res.deleted_files_count) || 0;
  }

  // 2. Perbarui Setting Tahun Ajaran Baru di Sheet Settings
  var settSheet = ss.getSheetByName(SHEETS.SETTINGS);
  if (settSheet && settSheet.getLastRow() > 1) {
    var sRows = settSheet.getDataRange().getValues();
    for (var s = 1; s < sRows.length; s++) {
      var key = String(sRows[s][0] || "").trim();
      if (key === "application_year") {
        settSheet.getRange(s + 1, 2).setValue(newYear);
      } else if (key === "academic_year_label") {
        settSheet.getRange(s + 1, 2).setValue(newYearLabel);
      } else if (key === "registration_open") {
        settSheet.getRange(s + 1, 2).setValue("true");
      }
    }
  }

  return {
    success: true,
    message: "Tahun ajaran baru " + newYearLabel + " berhasil dibuka. " + unacceptedRegNumbers.length + " pendaftar tidak lolos telah otomatis dihapus dari Google Drive dan database Sheets. " + acceptedRegNumbers.length + " pendaftar lolos berhasil disimpan sebagai arsip permanen.",
    archived_accepted_count: acceptedRegNumbers.length,
    purged_unaccepted_count: unacceptedRegNumbers.length,
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
  var isPhoto = isAccount || docType === "foto" || docType === "pas_foto" || docType === "foto_profil" || (driveFileId && driveFileId.length > 5);
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
  if (isSchool || docType === "logo_sekolah" || (driveFileId && driveFileId.length > 5)) {
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
  if (isApp || docType === "logo_aplikasi" || (driveFileId && driveFileId.length > 5)) {
    var settSheet = ss.getSheetByName(SHEETS.SETTINGS);
    if (settSheet && settSheet.getLastRow() > 1) {
      var settRows = settSheet.getDataRange().getValues();
      for (var st = 1; st < settRows.length; st++) {
        if (settRows[st][0] === "app_logo") {
          var currentAppLogo = String(settRows[st][1] || "").trim();
          if (isApp || docType === "logo_aplikasi" || (driveFileId && currentAppLogo.indexOf(driveFileId) !== -1)) {
            settSheet.getRange(st + 1, 2).setValue("");
          }
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
 * 5b. AUTO-HEAL: VERIFIKASI & BERSIHKAN BERKAS YANG HILANG/DIHAPUS DARI DRIVE
 * Memeriksa apakah berkas di Google Drive masih ada dan aktif (bukan di tong sampah/hilang).
 * Jika berkas di Google Drive sudah tidak ada (dihapus langsung lewat Google Drive oleh pengguna/admin),
 * sistem secara otomatis menghapus data referensi berkas dari seluruh Sheet (Documents, Users, Students, Schools, Settings)
 * agar sistem bersih dan dapat langsung menerima berkas/gambar baru dan memasukkannya ke Google Drive.
 */
function verifyAndCleanMissingDriveFiles(ss) {
  if (!ss) return { success: false, cleaned: 0 };
  var cleanedCount = 0;
  var checkedDriveIds = {};

  function checkDriveActive(fid) {
    if (!fid || fid === "LOCAL_STORAGE" || fid.length < 15) return false;
    if (checkedDriveIds[fid] !== undefined) return checkedDriveIds[fid];
    try {
      var file = DriveApp.getFileById(fid);
      var active = file && !file.isTrashed();
      checkedDriveIds[fid] = active;
      return active;
    } catch (err) {
      checkedDriveIds[fid] = false;
      return false;
    }
  }

  try {
    // 1. Periksa Sheet Documents
    var docSheet = ss.getSheetByName(SHEETS.DOCUMENTS);
    if (docSheet && docSheet.getLastRow() > 1) {
      var docRows = docSheet.getDataRange().getValues();
      for (var d = docRows.length - 1; d >= 1; d--) {
        var dFid = String(docRows[d][5] || "").trim();
        if (dFid && dFid !== "LOCAL_STORAGE" && dFid.length > 15) {
          if (!checkDriveActive(dFid)) {
            docSheet.deleteRow(d + 1);
            cleanedCount++;
          }
        }
      }
    }

    // 2. Periksa Foto Profil di Sheet Users
    var userSheet = ss.getSheetByName(SHEETS.USERS);
    if (userSheet && userSheet.getLastRow() > 1) {
      var uRows = userSheet.getDataRange().getValues();
      var uHeaders = uRows[0];
      var uPhotoCol = uHeaders.indexOf("photo_url") + 1;
      if (uPhotoCol <= 0) uPhotoCol = 12;
      for (var u = 1; u < uRows.length; u++) {
        var uPhotoUrl = String(uRows[u][uPhotoCol - 1] || "").trim();
        var uFid = extractDriveIdFromAnyUrl(uPhotoUrl);
        if (uFid && uFid !== "LOCAL_STORAGE" && uFid.length > 15) {
          if (!checkDriveActive(uFid)) {
            userSheet.getRange(u + 1, uPhotoCol).setValue("");
            cleanedCount++;
          }
        }
      }
    }

    // 3. Periksa Pas Foto di Sheet Students
    var stdSheet = ss.getSheetByName(SHEETS.STUDENTS);
    if (stdSheet && stdSheet.getLastRow() > 1) {
      var sRows = stdSheet.getDataRange().getValues();
      var sHeaders = sRows[0];
      var sPhotoCol = sHeaders.indexOf("photo_url") + 1;
      if (sPhotoCol <= 0) sPhotoCol = 19;
      for (var s = 1; s < sRows.length; s++) {
        var sPhotoUrl = String(sRows[s][sPhotoCol - 1] || "").trim();
        var sFid = extractDriveIdFromAnyUrl(sPhotoUrl);
        if (sFid && sFid !== "LOCAL_STORAGE" && sFid.length > 15) {
          if (!checkDriveActive(sFid)) {
            stdSheet.getRange(s + 1, sPhotoCol).setValue("");
            cleanedCount++;
          }
        }
      }
    }

    // 4. Periksa Logo Resmi di Sheet Schools
    var schSheet = ss.getSheetByName(SHEETS.SCHOOLS);
    if (schSheet && schSheet.getLastRow() > 1) {
      var schRows = schSheet.getDataRange().getValues();
      for (var sc = 1; sc < schRows.length; sc++) {
        var schLogoUrl = String(schRows[sc][23] || "").trim();
        var scFid = extractDriveIdFromAnyUrl(schLogoUrl);
        if (scFid && scFid !== "LOCAL_STORAGE" && scFid.length > 15) {
          if (!checkDriveActive(scFid)) {
            schSheet.getRange(sc + 1, 24).setValue("");
            cleanedCount++;
          }
        }
      }
    }

    // 5. Periksa Logo Aplikasi di Sheet Settings
    var settSheet = ss.getSheetByName(SHEETS.SETTINGS);
    if (settSheet && settSheet.getLastRow() > 1) {
      var settRows = settSheet.getDataRange().getValues();
      for (var st = 1; st < settRows.length; st++) {
        if (settRows[st][0] === "app_logo") {
          var appLogoUrl = String(settRows[st][1] || "").trim();
          var aFid = extractDriveIdFromAnyUrl(appLogoUrl);
          if (aFid && aFid !== "LOCAL_STORAGE" && aFid.length > 15) {
            if (!checkDriveActive(aFid)) {
              settSheet.getRange(st + 1, 2).setValue("");
              cleanedCount++;
            }
          }
          break;
        }
      }
    }
  } catch (scanErr) {
    Logger.log("verifyAndCleanMissingDriveFiles warning: " + scanErr.toString());
  }

  return { success: true, cleaned: cleanedCount };
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
    deleteRowsMatchingColumn(ss.getSheetByName(SHEETS.PARENTS), 2, rNum);
    deleteRowsMatchingColumn(ss.getSheetByName(SHEETS.SCHOOL_ORIGINS), 2, rNum);
    deleteRowsMatchingColumn(ss.getSheetByName(SHEETS.ADDRESSES), 2, rNum);
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
 * 8. NOTIFIKASI EMAIL OTOMATIS (TERPICU PADA SELURUH TAHAP PENDAFTARAN, VERIFIKASI, SELEKSI, DAN SURAT)
 * Pengirim resmi menggunakan nama madrasah tujuan dan Reply-To diarahkan langsung ke email madrasah tujuan.
 * Saat ada pendaftar baru, sistem secara otomatis juga mengirimkan email notifikasi ke email panitia madrasah tujuan.
 */
function handleSendNotificationEmail(data, targetSpreadsheetId) {
  if (!data) return { success: false, message: "Data notifikasi kosong" };
  var ss = getOrOpenSpreadsheet(targetSpreadsheetId || SPREADSHEET_ID);

  var email = (data.email || "").trim();
  var studentName = data.student_name || "Calon Murid";
  var regNumber = data.registration_number || "";
  var eventType = data.event_type || "verification"; // "registration_submitted" | "revision_submitted" | "verification" | "selection" | "announcement" | "transfer" | "acceptance_letter" | "dispensation_letter" | "password_reset"
  var newStatus = String(data.new_status || "").toLowerCase();
  var notes = data.notes || "";
  var pathway = data.pathway || "";
  var appName = data.app_name || "SIPMA PPDB Madrasah";
  var appLogoUrl = (data.app_logo_url && data.app_logo_url.indexOf("6c787787-6585-4830-b0a6-9bfab3f1dba4") === -1) ? data.app_logo_url : "";

  // Ambil data sekolah secara mandiri dari database jika belum lengkap
  var schoolInfo = getSchoolInfoById(ss, data.school_id, regNumber);
  var schoolName = (data.school_name || schoolInfo.school_name || "Madrasah").trim();
  var schoolEmail = (data.school_email || schoolInfo.school_email || "").trim();
  var schoolPhone = (data.school_phone || schoolInfo.school_phone || "").trim();
  var schoolAddress = (data.school_address || schoolInfo.school_address || "").trim();

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
  // 6. PENERBITAN SURAT BUKTI KELULUSAN / TANDA DITERIMA
  else if (eventType === "acceptance_letter") {
    subject = "[PPDB " + schoolName + "] Surat Tanda Diterima Resmi: " + studentName + " (" + regNumber + ")";
    statusBadge = "SURAT BUKTI DITERIMA RESMI";
    badgeColor = "#059669"; // Emerald
    headline = "Surat Tanda Diterima resmi calon murid baru telah diterbitkan oleh Panitia PPDB " + schoolName + ".";
    detailHtml = "<p>Dokumen Surat Keputusan Penerimaan Murid Baru atas nama <b>" + studentName + "</b> (" + regNumber + ") dengan verifikasi QR-Code resmi telah siap.</p>" +
      "<div style='background-color:#ecfdf5;border-left:4px solid #10b981;padding:12px;margin:12px 0;border-radius:6px;font-size:13px;color:#065f46;'>" +
      (notes || "Silakan login ke portal SIPMA untuk mengunduh dan mencetak dokumen Tanda Bukti Diterima resmi sebagai syarat daftar ulang.") +
      "</div>";
  }
  // 7. SURAT DISPENSASI RESMI
  else if (eventType === "dispensation_letter") {
    subject = "[PPDB " + schoolName + "] Surat Dispensasi Pendaftaran Disetujui: " + studentName + " (" + regNumber + ")";
    statusBadge = "SURAT DISPENSASI RESMI";
    badgeColor = "#d97706"; // Amber
    headline = "Surat dispensasi resmi telah disetujui dan diterbitkan oleh Panitia PPDB " + schoolName + ".";
    detailHtml = "<p>Permohonan dispensasi untuk pendaftaran atas nama <b>" + studentName + "</b> (" + regNumber + ") telah diverifikasi dan disetujui panitia.</p>" +
      "<div style='background-color:#fef3c7;border-left:4px solid #f59e0b;padding:12px;margin:12px 0;border-radius:6px;font-size:13px;color:#92400e;'>" +
      (notes || "Surat dispensasi telah tercatat dalam sistem dan dapat diunduh pada portal SIPMA.") +
      "</div>";
  }
  // 8. RESET PASSWORD / INFORMASI AKUN
  else if (eventType === "password_reset" || eventType === "account_update") {
    subject = "[PPDB " + schoolName + "] Informasi Kredensial & Reset Kata Sandi Akun - " + studentName + " (" + regNumber + ")";
    statusBadge = "KATA SANDI AKUN DIPERBARUI";
    badgeColor = "#2563eb"; // Blue
    headline = "Kata sandi akun portal pendaftaran Anda telah berhasil diperbarui oleh Panitia PPDB " + schoolName + ".";
    detailHtml = "<p>Berikut adalah informasi pembaruan akun pendaftaran Anda:</p>" +
      "<div style='background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px;margin:12px 0;font-size:14px;color:#1e40af;'>" +
      (notes || "Silakan login ke portal SIPMA dengan kata sandi baru Anda dan simpan dengan aman.") +
      "</div>" +
      "<p style='font-size:13px;color:#64748b;'>Demi keamanan akun Anda, segera ganti kata sandi setelah berhasil login.</p>";
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
    "Jika ada pertanyaan atau ingin menanggapi pesan ini, Anda dapat LANGSUNG MEMBALAS (REPLY) email ini ke panitia di: " + (schoolEmail || "-") + "\\n\\n" +
    "Untuk informasi selengkapnya, silakan kunjungi portal SIPMA.\\n\\n" +
    "Panitia Penerimaan Peserta Didik Baru (PPDB)\\n" +
    schoolName + "\\n" +
    (schoolAddress ? ("Alamat: " + schoolAddress + "\\n") : "") +
    (schoolEmail ? ("Email: " + schoolEmail + "\\n") : "") +
    (schoolPhone ? ("Telp/WA: " + schoolPhone + "\\n") : "");

  // Konfigurasi pengirim email:
  // Nama Pengirim: Panitia PPDB [Nama Madrasah]
  // Reply-To: [Email Madrasah yang dipilih saat mendaftar] -> Pendaftar bisa langsung membalas ke email madrasah
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
  var studentSendSuccess = false;
  var studentSendMsg = "";
  try {
    MailApp.sendEmail(mailOptions);
    studentSendSuccess = true;
    studentSendMsg = "Email notifikasi berhasil dikirim via MailApp ke " + email;
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
      studentSendSuccess = true;
      studentSendMsg = "Email notifikasi berhasil dikirim via GmailApp ke " + email;
    } catch (errGmail) {
      studentSendSuccess = false;
      studentSendMsg = "Gagal mengirim email: " + (errMail ? errMail.toString() : errGmail ? errGmail.toString() : "Unknown error");
    }
  }

  // OTOMATIS: Kirim pesan email notifikasi ke email madrasah tujuan saat ada pendaftar baru
  var schoolAlertResult = null;
  if ((eventType === "registration_submitted" || eventType === "submission" || data.notify_school === true) && schoolEmail && schoolEmail.indexOf("@") > -1) {
    try {
      schoolAlertResult = handleNotifySchoolNewApplicant({
        registration_number: regNumber,
        student_name: studentName,
        student_email: email,
        pathway: pathway,
        school_id: data.school_id,
        school_name: schoolName,
        school_email: schoolEmail,
        school_phone: schoolPhone,
        school_address: schoolAddress,
        nik: data.nik || "",
        nisn: data.nisn || "",
        school_origin: data.school_origin || data.previous_school || "",
        parent_name: data.parent_name || "",
        student_phone: data.student_phone || data.phone || "",
        distance_km: data.distance_km || 0,
        submission_date: data.submission_date,
        app_name: appName,
        app_logo_url: appLogoUrl
      }, targetSpreadsheetId);
    } catch (schErr) {
      Logger.log("Auto notify school error: " + schErr.toString());
    }
  }

  // Jika pendaftar menyerahkan perbaikan berkas, beri tahu panitia madrasah juga
  if (eventType === "revision_submitted" && schoolEmail && schoolEmail.indexOf("@") > -1) {
    try {
      var revSubject = "[PPDB Berkas Revisi Masuk] Penyerahan Berkas Perbaikan: " + studentName + " (" + regNumber + ")";
      var revPlain = "Yth. Panitia PPDB " + schoolName + ",\\n\\n" +
        "Calon murid atas nama " + studentName + " (" + regNumber + ") telah menyerahkan perbaikan berkas pendaftaran melalui portal SIPMA.\\n\\n" +
        "Silakan masuk ke Dashboard Admin/Operator Madrasah SIPMA untuk meninjau dan memverifikasi berkas perbaikan tersebut.\\n\\n" +
        (notes ? ("Catatan: " + notes + "\\n\\n") : "") +
        "Anda dapat langsung membalas email ini untuk berkomunikasi dengan pendaftar di: " + email;
      var revMail = {
        to: schoolEmail,
        subject: revSubject,
        body: revPlain,
        name: "SIPMA PPDB - Berkas Revisi",
        replyTo: (email && email.indexOf("@") > -1) ? email : undefined
      };
      try { MailApp.sendEmail(revMail); } catch (eRev) {}
    } catch (eRev2) {}
  }

  return {
    success: studentSendSuccess,
    message: studentSendMsg + (schoolAlertResult ? " | Notifikasi madrasah: " + schoolAlertResult.message : ""),
    recipient: email,
    sender_name: senderDisplayName,
    sender_email: schoolEmail || "default",
    status: newStatus,
    school_alert: schoolAlertResult
  };
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
    '                    <p style="margin:3px 0 0 0;font-size:12px;color:#a7f3d0;font-weight:500;letter-spacing:0.3px;">Penerimaan Murid Baru Madrasah</p>' +
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
 * 8b. NOTIFIKASI EMAIL RESMI KE MADRASAH TUJUAN SAAT ADA PENDAFTAR BARU MASUK
 * Menjamin email resmi dikirim ke email madrasah dengan replyTo disetel ke email calon murid,
 * sehingga pihak madrasah dapat langsung menekan tombol "Balas" / "Reply" di aplikasi email mereka.
 */
function handleNotifySchoolNewApplicant(data, spreadsheetId) {
  if (!data) return { success: false, message: "Data pendaftar baru kosong" };

  var regNum = String(data.registration_number || "").trim();
  var studentName = String(data.student_name || "Calon Murid").trim();
  var studentEmail = String(data.student_email || data.email || "").trim();
  var pathway = String(data.pathway || "zonasi").trim();
  var schoolId = String(data.school_id || "").trim();
  var schoolName = String(data.school_name || "").trim();
  var targetSchoolEmail = String(data.school_email || "").trim();
  var schoolPhone = String(data.school_phone || "").trim();
  var schoolAddress = String(data.school_address || "").trim();
  var nik = String(data.nik || "-").trim();
  var nisn = String(data.nisn || "-").trim();
  var schoolOrigin = String(data.school_origin || data.previous_school || "-").trim();
  var parentName = String(data.parent_name || "-").trim();
  var studentPhone = String(data.student_phone || data.phone || "-").trim();
  var distanceKm = data.distance_km !== undefined ? (typeof data.distance_km === 'number' ? data.distance_km.toFixed(2) : data.distance_km) : "";
  var submissionDate = data.submission_date || (Utilities.formatDate(new Date(), "GMT+7", "dd MMMM yyyy HH:mm") + " WIB");
  var appName = String(data.app_name || "SIPMA PPDB").trim();
  var appLogoUrl = (data.app_logo_url && data.app_logo_url.indexOf("6c787787-6585-4830-b0a6-9bfab3f1dba4") === -1) ? data.app_logo_url : "";

  var ss = getOrOpenSpreadsheet(spreadsheetId || SPREADSHEET_ID);
  
  // Jika targetSchoolEmail belum ada atau tidak valid, cari dari sheet Schools di Google Sheets
  if (!targetSchoolEmail || targetSchoolEmail.indexOf("@") === -1) {
    var schSheet = ss ? ss.getSheetByName(SHEETS.SCHOOLS) : null;
    if (schSheet && schSheet.getLastRow() > 1) {
      var schRows = schSheet.getDataRange().getValues();
      for (var s = 1; s < schRows.length; s++) {
        var rowSchId = String(schRows[s][0] || "").trim();
        var rowSchName = String(schRows[s][1] || "").trim();
        var match = false;
        if (schoolId && (rowSchId === schoolId || rowSchId.toLowerCase() === schoolId.toLowerCase())) match = true;
        if (schoolName && (rowSchName.toLowerCase() === schoolName.toLowerCase())) match = true;
        if (match) {
          if (!targetSchoolEmail) targetSchoolEmail = String(schRows[s][22] || "").trim(); // Col 23: contact_email
          if (!schoolName) schoolName = rowSchName;
          if (!schoolPhone) schoolPhone = String(schRows[s][21] || "").trim(); // Col 22: contact_phone
          if (!schoolAddress) schoolAddress = String(schRows[s][6] || "").trim(); // Col 7: address
          break;
        }
      }
    }
  }

  // Jika masih kosong, cari user admin/operator sekolah di sheet Users
  if (!targetSchoolEmail || targetSchoolEmail.indexOf("@") === -1) {
    var uSheet = ss ? ss.getSheetByName(SHEETS.USERS) : null;
    if (uSheet && uSheet.getLastRow() > 1) {
      var uRows = uSheet.getDataRange().getValues();
      for (var u = 1; u < uRows.length; u++) {
        var uRole = String(uRows[u][8] || "").trim();
        var uSchId = String(uRows[u][9] || "").trim();
        var uEmail = String(uRows[u][3] || "").trim();
        if ((uRole === "admin_sekolah" || uRole === "operator_sekolah") && (schoolId && uSchId === schoolId) && uEmail.indexOf("@") > -1) {
          targetSchoolEmail = uEmail;
          break;
        }
      }
    }
  }

  // Jika tetap tidak ditemukan email madrasah, log dan laporkan
  if (!targetSchoolEmail || targetSchoolEmail.indexOf("@") === -1) {
    return {
      success: false,
      message: "Tidak dapat mengirim notifikasi pendaftar baru: Email madrasah tujuan tidak ditemukan."
    };
  }

  var pathwayName = pathway === "zonasi" ? "Zonasi" :
                    pathway === "afirmasi" ? "Afirmasi" :
                    pathway === "prestasi" ? "Prestasi" :
                    pathway === "mutasi" ? "Perpindahan Tugas Orang Tua" : pathway;

  var emailSubject = "[PPDB Pendaftar Baru] Pendaftaran Masuk: " + studentName + " (" + regNum + ") - Jalur " + pathwayName;

  var plainText = "Yth. Kepala Madrasah & Panitia PPDB " + (schoolName || "Madrasah") + ",\n\n" +
    "Sistem SIPMA memberitahukan bahwa terdapat Calon Peserta Didik Baru yang resmi mendaftar ke madrasah Anda dengan rincian sebagai berikut:\n\n" +
    "- Nomor Registrasi : " + regNum + "\n" +
    "- Nama Lengkap     : " + studentName + "\n" +
    "- Jalur PPDB       : " + pathwayName + "\n" +
    "- NIK / NISN       : " + nik + " / " + nisn + "\n" +
    "- Asal Sekolah     : " + schoolOrigin + "\n" +
    "- Orang Tua / Wali : " + parentName + "\n" +
    "- No. Kontak / WA  : " + studentPhone + "\n" +
    "- Email Pendaftar  : " + (studentEmail || "-") + "\n" +
    (distanceKm ? ("- Jarak ke Madrasah: " + distanceKm + " km\n") : "") +
    "- Waktu Submit     : " + submissionDate + "\n\n" +
    "Silakan buka portal Admin / Operator Madrasah SIPMA untuk memverifikasi dokumen persyaratan calon murid ini.\n\n" +
    (studentEmail ? "PENTING: Anda dapat langsung menekan tombol Balas (Reply) pada email ini untuk membalas ke email pendaftar (" + studentEmail + ").\n\n" : "") +
    "--\n" +
    "Pemberitahuan Otomatis " + appName + "\n" +
    "Kementerian Agama Republik Indonesia";

  var htmlBody = buildSchoolAlertEmailHtml({
    appName: appName,
    appLogoUrl: appLogoUrl,
    schoolName: schoolName || "Madrasah Pilihan",
    targetSchoolEmail: targetSchoolEmail,
    regNum: regNum,
    studentName: studentName,
    studentEmail: studentEmail,
    pathwayName: pathwayName,
    nik: nik,
    nisn: nisn,
    schoolOrigin: schoolOrigin,
    parentName: parentName,
    studentPhone: studentPhone,
    distanceKm: distanceKm,
    submissionDate: submissionDate
  });

  var mailOptions = {
    to: targetSchoolEmail,
    subject: emailSubject,
    body: plainText,
    htmlBody: htmlBody,
    name: "SIPMA PPDB - Pendaftar Baru"
  };

  // Reply-To disetel ke email calon murid sehingga pihak madrasah dapat langsung membalas
  if (studentEmail && studentEmail.indexOf("@") > -1) {
    mailOptions.replyTo = studentEmail;
  }

  var sendSuccess = false;
  var sendMsg = "";
  try {
    MailApp.sendEmail(mailOptions);
    sendSuccess = true;
    sendMsg = "Email notifikasi pendaftar baru berhasil dikirim via MailApp ke " + targetSchoolEmail;
  } catch (errMail) {
    try {
      var gmailOptions = {
        htmlBody: htmlBody,
        name: "SIPMA PPDB - Pendaftar Baru"
      };
      if (studentEmail && studentEmail.indexOf("@") > -1) {
        gmailOptions.replyTo = studentEmail;
      }
      GmailApp.sendEmail(targetSchoolEmail, emailSubject, plainText, gmailOptions);
      sendSuccess = true;
      sendMsg = "Email notifikasi pendaftar baru berhasil dikirim via GmailApp ke " + targetSchoolEmail;
    } catch (errGmail) {
      sendSuccess = false;
      sendMsg = "Gagal mengirim email ke madrasah: " + (errMail ? errMail.toString() : errGmail ? errGmail.toString() : "Error");
    }
  }

  return {
    success: sendSuccess,
    message: sendMsg,
    school_email: targetSchoolEmail,
    school_name: schoolName,
    registration_number: regNum,
    student_name: studentName,
    reply_to: studentEmail
  };
}

/**
 * Format Template HTML Email Khusus Notifikasi Pendaftar Baru untuk Admin/Operator Madrasah
 */
function buildSchoolAlertEmailHtml(params) {
  var appName = params.appName || "SIPMA PPDB";
  var appLogoUrl = params.appLogoUrl || "";
  var schoolName = params.schoolName || "Madrasah";
  var targetSchoolEmail = params.targetSchoolEmail || "";
  var regNum = params.regNum || "";
  var studentName = params.studentName || "";
  var studentEmail = params.studentEmail || "";
  var pathwayName = params.pathwayName || "Zonasi";
  var nik = params.nik || "-";
  var nisn = params.nisn || "-";
  var schoolOrigin = params.schoolOrigin || "-";
  var parentName = params.parentName || "-";
  var studentPhone = params.studentPhone || "-";
  var distanceKm = params.distanceKm || "";
  var submissionDate = params.submissionDate || "";

  var logoCellHtml = appLogoUrl ?
    '<td width="56" valign="middle" style="padding-right:16px;"><img src="' + appLogoUrl + '" alt="' + appName + '" width="52" height="52" style="display:block;width:52px;height:52px;border-radius:12px;background-color:#ffffff;padding:2px;box-shadow:0 2px 6px rgba(0,0,0,0.2);object-fit:contain;" /></td>' :
    '<td width="56" valign="middle" style="padding-right:16px;"><div style="width:48px;height:48px;border-radius:12px;background-color:#047857;border:2px solid #10b981;color:#ffffff;font-size:22px;font-weight:800;text-align:center;line-height:48px;">' + (appName.charAt(0) || 'S') + '</div></td>';

  return '<!DOCTYPE html>' +
    '<html lang="id">' +
    '<head>' +
    '  <meta charset="UTF-8">' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '  <title>Notifikasi Pendaftar Baru - ' + schoolName + '</title>' +
    '</head>' +
    '<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,\'Helvetica Neue\',Arial,sans-serif;color:#1e293b;-webkit-font-smoothing:antialiased;">' +
    '  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;padding:28px 12px;">' +
    '    <tr>' +
    '      <td align="center">' +
    '        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 25px -5px rgba(0,0,0,0.08),0 8px 10px -6px rgba(0,0,0,0.04);border:1px solid #e2e8f0;">' +
    '          <tr>' +
    '            <td style="background:linear-gradient(135deg,#064e3b 0%,#047857 50%,#059669 100%);padding:28px;color:#ffffff;">' +
    '              <table width="100%" cellpadding="0" cellspacing="0" border="0">' +
    '                <tr>' +
    '                  ' + logoCellHtml +
    '                  <td valign="middle">' +
    '                    <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#a7f3d0;margin-bottom:4px;">Notifikasi Resmi PPDB Madrasah</div>' +
    '                    <h1 style="margin:0;font-size:20px;font-weight:800;line-height:1.2;color:#ffffff;">' + appName + '</h1>' +
    '                    <div style="font-size:13px;color:#ecfdf5;margin-top:4px;font-weight:500;">Pemberitahuan Pendaftar Baru Masuk</div>' +
    '                  </td>' +
    '                </tr>' +
    '              </table>' +
    '            </td>' +
    '          </tr>' +
    '          <tr>' +
    '            <td style="padding:28px 28px 20px 28px;">' +
    '              <div style="display:inline-block;padding:6px 14px;background-color:#ecfdf5;border:1px solid #a7f3d0;border-radius:9999px;font-size:12px;font-weight:700;color:#047857;margin-bottom:16px;">' +
    '                📌 CALON PESERTA DIDIK BARU RESMI MENDAFTAR' +
    '              </div>' +
    '              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#334155;">' +
    '                Yth. <strong>Kepala Madrasah & Tim Panitia PPDB ' + schoolName + '</strong>,<br/>' +
    '                Sistem SIPMA menginformasikan bahwa seorang calon peserta didik baru telah resmi menyelesaikan formulir dan mengajukan berkas pendaftaran ke madrasah Anda dengan data sebagai berikut:' +
    '              </p>' +
    '              <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin-bottom:20px;">' +
    '                <table width="100%" cellpadding="6" cellspacing="0" border="0" style="font-size:13px;line-height:1.6;">' +
    '                  <tr><td width="38%" style="color:#64748b;font-weight:600;">No. Pendaftaran</td><td width="62%" style="font-weight:800;font-size:14px;letter-spacing:0.5px;color:#047857;">' + regNum + '</td></tr>' +
    '                  <tr><td style="color:#64748b;font-weight:600;border-top:1px dashed #e2e8f0;">Nama Calon Siswa</td><td style="color:#0f172a;font-weight:700;border-top:1px dashed #e2e8f0;">' + studentName + '</td></tr>' +
    '                  <tr><td style="color:#64748b;font-weight:600;border-top:1px dashed #e2e8f0;">Jalur Pendaftaran</td><td style="color:#0f172a;font-weight:700;border-top:1px dashed #e2e8f0;"><span style="background-color:#e0e7ff;color:#3730a3;padding:2px 8px;border-radius:6px;font-size:12px;">' + pathwayName + '</span></td></tr>' +
    '                  <tr><td style="color:#64748b;font-weight:600;border-top:1px dashed #e2e8f0;">NIK / NISN</td><td style="color:#0f172a;border-top:1px dashed #e2e8f0;">' + nik + ' / ' + nisn + '</td></tr>' +
    '                  <tr><td style="color:#64748b;font-weight:600;border-top:1px dashed #e2e8f0;">Asal Madrasah/Sekolah</td><td style="color:#0f172a;border-top:1px dashed #e2e8f0;">' + schoolOrigin + '</td></tr>' +
    '                  <tr><td style="color:#64748b;font-weight:600;border-top:1px dashed #e2e8f0;">Orang Tua / Wali</td><td style="color:#0f172a;border-top:1px dashed #e2e8f0;">' + parentName + '</td></tr>' +
    '                  <tr><td style="color:#64748b;font-weight:600;border-top:1px dashed #e2e8f0;">No. Kontak / WA</td><td style="color:#0f172a;border-top:1px dashed #e2e8f0;">' + studentPhone + '</td></tr>' +
    '                  <tr><td style="color:#64748b;font-weight:600;border-top:1px dashed #e2e8f0;">Email Pendaftar</td><td style="color:#047857;font-weight:700;border-top:1px dashed #e2e8f0;">' + (studentEmail || "-") + '</td></tr>' +
    (distanceKm ? ('<tr><td style="color:#64748b;font-weight:600;border-top:1px dashed #e2e8f0;">Jarak Domisili</td><td style="color:#0f172a;font-weight:600;border-top:1px dashed #e2e8f0;">' + distanceKm + ' km</td></tr>') : '') +
    '                  <tr><td style="color:#64748b;font-weight:600;border-top:1px dashed #e2e8f0;">Waktu Submit</td><td style="color:#64748b;border-top:1px dashed #e2e8f0;">' + submissionDate + '</td></tr>' +
    '                </table>' +
    '              </div>' +
    '              <div style="background-color:#ecfdf5;border:1px solid #10b981;border-radius:10px;padding:14px 16px;margin-bottom:20px;">' +
    '                <table width="100%" cellpadding="0" cellspacing="0" border="0">' +
    '                  <tr>' +
    '                    <td width="28" valign="top" style="font-size:18px;line-height:1;">✉️</td>' +
    '                    <td style="font-size:13px;line-height:1.5;color:#065f46;">' +
    '                      <strong>Fitur Balas Langsung (Direct Reply):</strong><br/>' +
    '                      Anda dapat langsung menekan tombol <strong>Balas (Reply)</strong> pada aplikasi email Anda (Gmail/Outlook/Yahoo/dsb.) untuk mengirim pesan balasan resmi langsung ke alamat email pendaftar: <strong>' + (studentEmail || 'pendaftar') + '</strong>.' +
    '                    </td>' +
    '                  </tr>' +
    '                </table>' +
    '              </div>' +
    '              <p style="margin:0;font-size:13px;color:#475569;line-height:1.6;">' +
    '                Harap segera membuka Dashboard Operator Madrasah SIPMA untuk memverifikasi keabsahan dokumen dan data pendaftar ini.' +
    '              </p>' +
    '            </td>' +
    '          </tr>' +
    '          <tr>' +
    '            <td style="background-color:#f8fafc;padding:18px 28px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;line-height:1.5;text-align:center;">' +
    '              <p style="margin:0 0 4px 0;font-weight:700;color:#334155;">' + appName + ' • Penerimaan Murid Baru Madrasah</p>' +
    '              <p style="margin:0;color:#94a3b8;font-size:11px;">Notifikasi dikirimkan ke email resmi madrasah: ' + targetSchoolEmail + '</p>' +
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
  var regNum = String(data.registration_number || "").trim();
  var status = data.verification_status || data.status;
  var notes = data.verification_notes || data.notes || "";
  var verifiedBy = data.verified_by || "Panitia";
  var ss = SpreadsheetApp.openById(spreadsheetId || SPREADSHEET_ID);
  var appSheet = ss.getSheetByName(SHEETS.APPLICATIONS);

  if (appSheet && regNum) {
    var dataRows = appSheet.getDataRange().getValues();
    for (var r = 1; r < dataRows.length; r++) {
      var rowReg = String(dataRows[r][1] || "").trim();
      var rowAppId = String(dataRows[r][0] || "").trim();
      if (rowReg === regNum || rowAppId === regNum) {
        appSheet.getRange(r + 1, 14).setValue(status); // Column 14: verification_status
        appSheet.getRange(r + 1, 17).setValue(notes);  // Column 17: verification_notes
        if (status === "terverifikasi") {
          appSheet.getRange(r + 1, 16).setValue("terverifikasi"); // Column 16: final_status
          appSheet.getRange(r + 1, 29).setValue("true");          // Column 29: is_locked
        } else if (status === "perlu_perbaikan") {
          appSheet.getRange(r + 1, 16).setValue("perlu_perbaikan");
          appSheet.getRange(r + 1, 29).setValue("false");         // unlock for student editing
        } else if (status === "ditolak") {
          appSheet.getRange(r + 1, 16).setValue("ditolak");
          appSheet.getRange(r + 1, 29).setValue("false");         // unlock so student can choose alternate school
        }
        appSheet.getRange(r + 1, 31).setValue(new Date().toISOString()); // Column 31: updated_at
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
      school_email: data.school_email,
      school_phone: data.school_phone,
      school_address: data.school_address,
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
  var regNum = String(data.registration_number || "").trim();
  var status = data.selection_status || data.status; // "lulus" | "tidak_lulus" | "cadangan"
  var ss = SpreadsheetApp.openById(spreadsheetId || SPREADSHEET_ID);
  var appSheet = ss.getSheetByName(SHEETS.APPLICATIONS);

  if (appSheet && regNum) {
    var dataRows = appSheet.getDataRange().getValues();
    for (var r = 1; r < dataRows.length; r++) {
      var rowReg = String(dataRows[r][1] || "").trim();
      var rowAppId = String(dataRows[r][0] || "").trim();
      if (rowReg === regNum || rowAppId === regNum) {
        appSheet.getRange(r + 1, 15).setValue(status); // Column 15: selection_status
        appSheet.getRange(r + 1, 16).setValue(status); // Column 16: final_status
        appSheet.getRange(r + 1, 31).setValue(new Date().toISOString()); // Column 31: updated_at
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
      school_email: data.school_email,
      school_phone: data.school_phone,
      school_address: data.school_address,
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

    var existingCreatedAt = (rowIndex > 0 && rows[rowIndex - 1][29]) ? rows[rowIndex - 1][29] : (appData.created_at || new Date().toISOString());

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
      existingCreatedAt,
      new Date().toISOString()
    ];

    if (rowIndex > 0) {
      appSheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      appSheet.appendRow(rowValues);
    }
  }

  // Sinkronkan data murid ke Sheet Students jika disertakan
  var stdData = appData.student || {};
  if (stdData.name || appData.student_name || stdData.nik || stdData.nisn) {
    var stdSheet = ss.getSheetByName(SHEETS.STUDENTS);
    if (stdSheet) {
      var sRows = stdSheet.getDataRange().getValues();
      var sRowIdx = -1;
      var targetStdId = stdData.student_id || appData.student_id || ("STD-" + regNum);
      for (var s = 1; s < sRows.length; s++) {
        if (String(sRows[s][2]).trim() === String(regNum).trim() || String(sRows[s][0]).trim() === String(targetStdId).trim()) {
          sRowIdx = s + 1;
          break;
        }
      }
      var stdRowValues = [
        targetStdId,
        stdData.user_id || appData.user_id || "",
        regNum,
        stdData.name || appData.student_name || "",
        stdData.nik || "",
        stdData.nisn || "",
        stdData.gender || "L",
        stdData.birth_place || "",
        stdData.birth_date || "",
        stdData.religion || "Islam",
        stdData.family_card_number || "",
        stdData.child_order || 1,
        stdData.total_siblings || 1,
        stdData.family_status || "Anak Kandung",
        stdData.hobby || "",
        stdData.living_status || "orang_tua_kandung",
        formatPhoneForSheetGAS(stdData.phone || appData.student_phone),
        stdData.email || appData.student_email || "",
        stdData.photo_url || ""
      ];
      if (sRowIdx > 0) {
        stdSheet.getRange(sRowIdx, 1, 1, stdRowValues.length).setValues([stdRowValues]);
      } else {
        stdSheet.appendRow(stdRowValues);
      }
    }
  }

  // Sinkronkan data Orang Tua / Wali ke Sheet Parents jika disertakan
  var prtData = appData.parents || appData.parent || {};
  if (prtData.father_name || prtData.mother_name || prtData.guardian_name || appData.father_name || appData.mother_name) {
    var prtSheet = ss.getSheetByName(SHEETS.PARENTS);
    if (prtSheet) {
      var pRows = prtSheet.getDataRange().getValues();
      var pRowIdx = -1;
      var targetParentStdId = (stdData && stdData.student_id) || appData.student_id || ("STD-" + regNum);
      for (var p = 1; p < pRows.length; p++) {
        var rowStdId = String(pRows[p][1]).trim();
        var rowParentId = String(pRows[p][0]).trim();
        if (rowStdId === String(targetParentStdId).trim() || rowStdId === String(regNum).trim() || (prtData.parent_id && rowParentId === String(prtData.parent_id).trim())) {
          pRowIdx = p + 1;
          break;
        }
      }
      var parentRowValues = [
        prtData.parent_id || ("PRT-" + regNum),
        targetParentStdId,
        prtData.father_name || appData.father_name || "",
        prtData.father_status || "hidup",
        prtData.father_nik || appData.father_nik || "",
        prtData.father_birth_place || "",
        prtData.father_birth_date || "",
        prtData.father_education || "",
        prtData.father_job || appData.father_job || "",
        prtData.father_income || "",
        formatPhoneForSheetGAS(prtData.father_phone || appData.father_phone),
        prtData.mother_name || appData.mother_name || "",
        prtData.mother_status || "hidup",
        prtData.mother_nik || appData.mother_nik || "",
        prtData.mother_birth_place || "",
        prtData.mother_birth_date || "",
        prtData.mother_education || "",
        prtData.mother_job || appData.mother_job || "",
        prtData.mother_income || "",
        formatPhoneForSheetGAS(prtData.mother_phone || appData.mother_phone),
        prtData.guardian_name || appData.guardian_name || "",
        prtData.guardian_nik || "",
        prtData.guardian_relation || "",
        prtData.guardian_birth_place || "",
        prtData.guardian_birth_date || "",
        prtData.guardian_education || "",
        prtData.guardian_job || "",
        prtData.guardian_income || "",
        formatPhoneForSheetGAS(prtData.guardian_phone),
        prtData.guardian_address || ""
      ];
      if (pRowIdx > 0) {
        prtSheet.getRange(pRowIdx, 1, 1, parentRowValues.length).setValues([parentRowValues]);
      } else {
        prtSheet.appendRow(parentRowValues);
      }
    }
  }

  // Sinkronkan data Asal Sekolah ke Sheet SchoolOrigins jika disertakan
  var oriData = appData.school_origins || appData.school_origin || {};
  if (oriData.school_name || appData.school_origin_name || appData.previous_school) {
    var oriSheet = ss.getSheetByName(SHEETS.SCHOOL_ORIGINS);
    if (oriSheet) {
      var oRows = oriSheet.getDataRange().getValues();
      var oRowIdx = -1;
      var targetOriStdId = (stdData && stdData.student_id) || appData.student_id || ("STD-" + regNum);
      for (var o = 1; o < oRows.length; o++) {
        var rowOriStdId = String(oRows[o][1]).trim();
        if (rowOriStdId === String(targetOriStdId).trim() || rowOriStdId === String(regNum).trim()) {
          oRowIdx = o + 1;
          break;
        }
      }
      var oriRowValues = [
        oriData.origin_id || ("ORI-" + regNum),
        targetOriStdId,
        oriData.previous_level || appData.previous_level || "MI",
        oriData.school_name || appData.school_origin_name || appData.previous_school || "",
        oriData.npsn_nsm || appData.school_origin_npsn || "",
        oriData.school_status || "Swasta",
        oriData.school_address || "",
        oriData.graduation_year || appData.graduation_year || "2026",
        oriData.diploma_number || appData.diploma_number || ""
      ];
      if (oRowIdx > 0) {
        oriSheet.getRange(oRowIdx, 1, 1, oriRowValues.length).setValues([oriRowValues]);
      } else {
        oriSheet.appendRow(oriRowValues);
      }
    }
  }

  // Sinkronkan data Alamat ke Sheet Addresses jika disertakan
  var adrData = appData.addresses || appData.address || {};
  if (adrData.full_address || adrData.province || adrData.city || appData.full_address) {
    var adrSheet = ss.getSheetByName(SHEETS.ADDRESSES);
    if (adrSheet) {
      var aRows = adrSheet.getDataRange().getValues();
      var aRowIdx = -1;
      var targetAdrStdId = (stdData && stdData.student_id) || appData.student_id || ("STD-" + regNum);
      for (var a = 1; a < aRows.length; a++) {
        var rowAdrStdId = String(aRows[a][1]).trim();
        if (rowAdrStdId === String(targetAdrStdId).trim() || rowAdrStdId === String(regNum).trim()) {
          aRowIdx = a + 1;
          break;
        }
      }
      var adrRowValues = [
        adrData.address_id || ("ADR-" + regNum),
        targetAdrStdId,
        adrData.province || "",
        adrData.city || "",
        adrData.district || "",
        adrData.subdistrict || "",
        adrData.neighborhood || "",
        adrData.rt_rw || "",
        adrData.full_address || appData.full_address || "",
        adrData.postal_code || "",
        adrData.latitude || appData.latitude || 0,
        adrData.longitude || appData.longitude || 0
      ];
      if (aRowIdx > 0) {
        adrSheet.getRange(aRowIdx, 1, 1, adrRowValues.length).setValues([adrRowValues]);
      } else {
        adrSheet.appendRow(adrRowValues);
      }
    }
  }

  // Jika pendaftaran baru diajukan atau flag notifikasi aktif, picu notifikasi resmi ke madrasah
  if (appData.notify_school === true || appData.is_new_registration === true) {
    try {
      handleNotifySchoolNewApplicant({
        registration_number: regNum,
        student_name: (stdData && stdData.name) || appData.student_name,
        student_email: (stdData && stdData.email) || appData.student_email,
        pathway: appData.pathway || "zonasi",
        school_id: appData.school_id,
        school_name: appData.school_name,
        school_email: appData.school_email,
        school_phone: appData.school_phone,
        school_address: appData.school_address,
        nik: (stdData && stdData.nik) || appData.nik,
        nisn: (stdData && stdData.nisn) || appData.nisn,
        school_origin: (oriData && oriData.school_name) || appData.school_origin_name,
        parent_name: (prtData && (prtData.father_name || prtData.mother_name)) || appData.father_name,
        student_phone: (stdData && stdData.phone) || appData.student_phone,
        distance_km: appData.distance_km || 0,
        submission_date: appData.submission_date,
        app_name: appData.app_name || "SIPMA",
        app_logo_url: appData.app_logo_url
      }, spreadsheetId);
    } catch (eSchNotif) {
      Logger.log("SaveApplication auto notify school warning: " + eSchNotif.toString());
    }
  }

  // Sinkronkan data Dokumen ke Sheet Documents jika disertakan
  if (appData.documents && Array.isArray(appData.documents)) {
    var docSheet = ss.getSheetByName(SHEETS.DOCUMENTS);
    if (docSheet) {
      for (var d = 0; d < appData.documents.length; d++) {
        var doc = appData.documents[d];
        if (!doc) continue;
        var docId = doc.document_id || ("DOC-" + regNum + "-" + d);
        var docRows = docSheet.getDataRange().getValues();
        var dRowIdx = -1;
        for (var dr = 1; dr < docRows.length; dr++) {
          if (String(docRows[dr][0]).trim() === String(docId).trim() ||
              (String(docRows[dr][1]).trim() === String(regNum).trim() && String(docRows[dr][2]).trim() === String(doc.document_type).trim())) {
            dRowIdx = dr + 1;
            break;
          }
        }
        var docValues = [
          docId,
          regNum,
          doc.document_type || "dokumen",
          doc.file_name || "",
          doc.file_size_kb || 0,
          doc.drive_file_id || "",
          doc.drive_url || doc.view_url || "",
          doc.upload_time || new Date().toISOString(),
          doc.verification_status || "menunggu",
          doc.notes || ""
        ];
        if (dRowIdx > 0) {
          docSheet.getRange(dRowIdx, 1, 1, docValues.length).setValues([docValues]);
        } else {
          docSheet.appendRow(docValues);
        }
      }
    }
  }

  // Catat audit log penyimpanan di Google Sheets
  try {
    var auditSheet = ss.getSheetByName(SHEETS.AUDIT_LOG);
    if (auditSheet) {
      auditSheet.appendRow([
        "LOG-SAVE-" + Date.now(),
        new Date().toISOString(),
        appData.user_id || "SYSTEM",
        (stdData && stdData.name) || appData.student_name || "Calon Murid",
        "calon_murid",
        "SAVE_APPLICATION",
        regNum,
        "Data formulir pendaftaran " + regNum + " berhasil disimpan dan disinkronkan ke Google Sheets.",
        "success"
      ]);
    }
  } catch(eAud) {}

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
    formatPhoneForSheetGAS(schoolData.contact_phone),
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
 * Label Kategori Folder Arsip Digital Google Drive Terstruktur
 * Mengelompokkan dokumen ke subfolder:
 * 01_KARTU_KELUARGA_KK, 02_AKTA_KELAHIRAN, 03_IJAZAH_SKL, dll.
 */
function getCategoryFolderLabel(docType) {
  var t = String(docType || "").toLowerCase().trim().replace(/[\s-]+/g, "_");
  if (t === "kk" || t === "kartu_keluarga") return "01_KARTU_KELUARGA_KK";
  if (t === "akta" || t === "akta_kelahiran" || t === "akta_lahir") return "02_AKTA_KELAHIRAN";
  if (t === "ijazah" || t === "skl" || t === "ijazah_skl") return "03_IJAZAH_SKL";
  if (t === "foto" || t === "pas_foto" || t === "foto_murid" || t === "pas_foto_3x4") return "04_PAS_FOTO";
  if (t === "kip" || t === "pkh" || t === "kks" || t === "kartu_afirmasi" || t === "afirmasi") return "05_DOKUMEN_AFIRMASI";
  if (t === "prestasi" || t === "sertifikat" || t === "sertifikat_prestasi" || t === "piagam") return "06_SERTIFIKAT_PRESTASI";
  if (t === "mutasi" || t === "surat_mutasi" || t === "penugasan") return "07_SURAT_MUTASI";
  return "08_DOKUMEN_PENDUKUNG_LAINNYA";
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
 * Helper: Ambil Data Kontak Lengkap Madrasah dari Database Sheets (Nama, Email, Telp, Alamat)
 */
function getSchoolInfoById(ss, schoolId, regNumber) {
  var schoolInfo = {
    school_name: "Madrasah",
    school_email: "",
    school_phone: "",
    school_address: ""
  };
  if (!ss) return schoolInfo;

  var targetSchoolId = schoolId || "";
  if (!targetSchoolId && regNumber) {
    var aSheet = ss.getSheetByName(SHEETS.APPLICATIONS);
    if (aSheet && aSheet.getLastRow() > 1) {
      var aRows = aSheet.getDataRange().getValues();
      for (var ar = 1; ar < aRows.length; ar++) {
        if (String(aRows[ar][1]).trim() === String(regNumber).trim()) {
          targetSchoolId = String(aRows[ar][4]).trim();
          break;
        }
      }
    }
  }

  var sSheet = ss.getSheetByName(SHEETS.SCHOOLS);
  if (sSheet && sSheet.getLastRow() > 1) {
    var sRows = sSheet.getDataRange().getValues();
    for (var sr = 1; sr < sRows.length; sr++) {
      var sId = String(sRows[sr][0]).trim();
      if ((targetSchoolId && sId === targetSchoolId) || (!targetSchoolId && sr === 1)) {
        schoolInfo.school_name = String(sRows[sr][1] || "").trim() || "Madrasah";
        schoolInfo.school_address = String(sRows[sr][6] || "").trim();
        schoolInfo.school_phone = String(sRows[sr][21] || sRows[sr][22] || "").trim();
        schoolInfo.school_email = String(sRows[sr][22] || sRows[sr][23] || "").trim();
        break;
      }
    }
  }

  if (!schoolInfo.school_email && targetSchoolId) {
    var uSheet = ss.getSheetByName(SHEETS.USERS);
    if (uSheet && uSheet.getLastRow() > 1) {
      var uRows = uSheet.getDataRange().getValues();
      for (var ur = 1; ur < uRows.length; ur++) {
        var uSchId = String(uRows[ur][9]).trim();
        var uRole = String(uRows[ur][8]).trim();
        var uEmail = String(uRows[ur][3]).trim();
        if (uSchId === targetSchoolId && (uRole === "admin_sekolah" || uRole === "operator_sekolah") && uEmail.indexOf("@") > -1) {
          schoolInfo.school_email = uEmail;
          break;
        }
      }
    }
  }

  if (!schoolInfo.school_email) {
    schoolInfo.school_email = "mi02jatibarang.brebes@gmail.com";
  }
  if (!schoolInfo.school_phone) {
    schoolInfo.school_phone = "08988857555";
  }

  return schoolInfo;
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
