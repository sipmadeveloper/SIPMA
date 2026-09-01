import * as XLSX from 'xlsx';
import {
  Application,
  StudentProfile,
  ParentData,
  SchoolOrigin,
  AddressData,
  School,
} from '../types/sipma';

export interface ExcelExportOptions {
  fileName?: string;
  sheetTitle?: string;
  schoolName?: string;
}

/**
 * Helper to auto-calculate column widths for XLSX sheets
 */
function calculateColWidths(rows: (string | number)[][]): { wch: number }[] {
  if (!rows || rows.length === 0) return [];
  const colWidths: number[] = [];

  rows.forEach((row) => {
    row.forEach((val, colIdx) => {
      const strVal = val !== undefined && val !== null ? String(val) : '';
      const cellLen = strVal.length;
      colWidths[colIdx] = Math.max(colWidths[colIdx] || 10, cellLen + 3);
    });
  });

  return colWidths.map((w) => ({ wch: Math.min(Math.max(w, 10), 60) }));
}

/**
 * Format pathway string with details (afirmasi, prestasi, mutasi)
 */
function getPathwayDetail(app: Application): string {
  if (app.pathway === 'afirmasi') {
    const cat = app.afirmasi_category === 'ekonomi_kurang_mampu' ? 'Ekonomi Kurang Mampu (KIP/PKH/KKS)' : 'Luar Zonasi (Dispensasi Jarak)';
    return `Afirmasi - ${cat}${app.dispensation_reason ? ` (${app.dispensation_reason})` : ''}`;
  }
  if (app.pathway === 'prestasi') {
    const pType = app.achievement_type === 'keagamaan_tahfidz' ? 'Tahfidz / Keagamaan' : app.achievement_type === 'akademik' ? 'Akademik' : 'Non-Akademik';
    const rank = app.achievement_rank ? ` - ${app.achievement_rank}` : '';
    const name = app.achievement_name ? ` (${app.achievement_name})` : '';
    const level = app.achievement_level ? ` Tingkat ${app.achievement_level}` : '';
    return `Prestasi ${pType}${name}${rank}${level}`;
  }
  if (app.pathway === 'mutasi') {
    const inst = app.mutation_parent_instansi ? ` Instansi: ${app.mutation_parent_instansi}` : '';
    const sk = app.mutation_letter_number ? ` (SK No: ${app.mutation_letter_number})` : '';
    return `Mutasi Orang Tua${inst}${sk}`;
  }
  return 'Zonasi Jarak Domisili Presisi';
}

/**
 * Export full applications, student bio, parent data, school origin & address into a neat multi-sheet Excel (.xlsx) file.
 */
export function exportApplicantsToExcel(
  applications: Application[],
  students: Record<string, StudentProfile>,
  parents: Record<string, ParentData>,
  schoolOrigins: Record<string, SchoolOrigin>,
  addresses: Record<string, AddressData>,
  schools: School[],
  options?: ExcelExportOptions
) {
  const schoolMap = new Map(schools.map((s) => [s.school_id, s]));
  const exportDate = new Date();
  const dateStr = exportDate.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const timeStr = exportDate.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // 1. Prepare Main Data Table Header and Rows
  const headers = [
    'No',
    'No. Pendaftaran',
    'Nama Lengkap Calon Siswa',
    'NIK',
    'NISN',
    'Jenis Kelamin',
    'Tempat Lahir',
    'Tanggal Lahir',
    'Agama',
    'No. Kartu Keluarga',
    'Anak Ke',
    'Jumlah Saudara',
    'Status Dalam Keluarga',
    'Hobi',
    'Status Tempat Tinggal',
    'Madrasah Pilihan',
    'Jalur Pendaftaran',
    'Detail Jalur & Bukti',
    'Jarak ke Madrasah (km)',
    'Radius Maks Zonasi (km)',
    'Status Zonasi',
    'Pelimpahan Kuota (Auto-Reroute)',
    'Nama Sekolah Asal',
    'NPSN / NSM Sekolah Asal',
    'Jenjang Asal',
    'Alamat Sekolah Asal',
    'Tahun Lulus',
    'No. Ijazah / SKL',
    'Nama Ayah',
    'Status Ayah',
    'NIK Ayah',
    'Pendidikan Ayah',
    'Pekerjaan Ayah',
    'Penghasilan Ayah',
    'No. HP Ayah',
    'Nama Ibu',
    'Status Ibu',
    'NIK Ibu',
    'Pendidikan Ibu',
    'Pekerjaan Ibu',
    'Penghasilan Ibu',
    'No. HP Ibu',
    'Nama Wali',
    'Hubungan Wali',
    'No. HP Wali',
    'Alamat Domisili',
    'RT',
    'RW',
    'Kelurahan / Desa',
    'Kecamatan',
    'Kabupaten / Kota',
    'Provinsi',
    'Kode Pos',
    'Latitude Koordinat',
    'Longitude Koordinat',
    'Status Verifikasi Berkas',
    'Catatan Tim Verifikator',
    'Hasil Seleksi Akhir',
    'Tanggal Pendaftaran',
  ];

  const rows: (string | number)[][] = [headers];

  applications.forEach((app, index) => {
    const student = students[app.registration_number];
    const parent = parents[app.registration_number];
    const origin = schoolOrigins[app.registration_number];
    const address = addresses[app.registration_number];
    const targetSchool = schoolMap.get(app.school_id);

    const genderText = student?.gender === 'L' ? 'Laki-laki' : student?.gender === 'P' ? 'Perempuan' : '-';
    const livingStatusText =
      student?.living_status === 'orang_tua_kandung'
        ? 'Bersama Orang Tua Kandung'
        : student?.living_status === 'ayah_kandung'
        ? 'Bersama Ayah Kandung'
        : student?.living_status === 'ibu_kandung'
        ? 'Bersama Ibu Kandung'
        : student?.living_status === 'wali_saudara'
        ? 'Bersama Wali / Saudara'
        : student?.living_status === 'pesantren_asrama'
        ? 'Pesantren / Asrama'
        : '-';

    const verificationText =
      app.verification_status === 'terverifikasi'
        ? 'Terverifikasi (Lengkap & Sah)'
        : app.verification_status === 'menunggu'
        ? 'Menunggu Verifikasi'
        : app.verification_status === 'perlu_perbaikan'
        ? 'Perlu Perbaikan Dokumen'
        : 'Ditolak';

    const finalStatusText =
      app.final_status === 'lulus'
        ? 'LULUS SELEKSI'
        : app.final_status === 'tidak_lulus'
        ? 'TIDAK LULUS'
        : 'Dalam Proses / Belum Diumumkan';

    const rerouteInfo = app.is_auto_rerouted
      ? `Ya (Dialihkan ke ${targetSchool?.school_name || app.school_id})`
      : 'Tidak';

    rows.push([
      index + 1,
      app.registration_number || '-',
      student?.name || '-',
      student?.nik ? `'${student.nik}` : '-',
      student?.nisn ? `'${student.nisn}` : '-',
      genderText,
      student?.birth_place || '-',
      student?.birth_date || '-',
      student?.religion || 'Islam',
      student?.family_card_number ? `'${student.family_card_number}` : '-',
      student?.child_order || 1,
      student?.total_siblings || 1,
      student?.family_status || 'Anak Kandung',
      student?.hobby || '-',
      livingStatusText,
      targetSchool?.school_name || app.school_id,
      app.pathway.toUpperCase(),
      getPathwayDetail(app),
      app.distance_km !== undefined ? Number(app.distance_km.toFixed(2)) : 0,
      app.max_distance_km || targetSchool?.zoning_radius_km || 5,
      app.zoning_status === 'memenuhi' ? 'MEMENUHI ZONASI' : 'MELEBIHI BATAS ZONASI',
      rerouteInfo,
      origin?.school_name || '-',
      origin?.npsn_nsm ? `'${origin.npsn_nsm}` : '-',
      origin?.previous_level || '-',
      origin?.school_address || '-',
      origin?.graduation_year || '-',
      origin?.diploma_number || '-',
      parent?.father_name || '-',
      parent?.father_status || 'hidup',
      parent?.father_nik ? `'${parent.father_nik}` : '-',
      parent?.father_education || '-',
      parent?.father_job || '-',
      parent?.father_income || '-',
      parent?.father_phone ? `'${parent.father_phone}` : '-',
      parent?.mother_name || '-',
      parent?.mother_status || 'hidup',
      parent?.mother_nik ? `'${parent.mother_nik}` : '-',
      parent?.mother_education || '-',
      parent?.mother_job || '-',
      parent?.mother_income || '-',
      parent?.mother_phone ? `'${parent.mother_phone}` : '-',
      parent?.guardian_name || '-',
      parent?.guardian_relation || '-',
      parent?.guardian_phone ? `'${parent.guardian_phone}` : '-',
      address?.street_address || '-',
      address?.rt ? `'${address.rt}` : '-',
      address?.rw ? `'${address.rw}` : '-',
      address?.village || '-',
      address?.district || '-',
      address?.city || '-',
      address?.province || '-',
      address?.postal_code || '-',
      app.latitude || 0,
      app.longitude || 0,
      verificationText,
      app.verification_notes || '-',
      finalStatusText,
      app.created_at ? new Date(app.created_at).toLocaleDateString('id-ID') : '-',
    ]);
  });

  // 2. Prepare Statistics & Summary Sheet Rows
  const totalApps = applications.length;
  const countZonasi = applications.filter((a) => a.pathway === 'zonasi').length;
  const countAfirmasi = applications.filter((a) => a.pathway === 'afirmasi').length;
  const countPrestasi = applications.filter((a) => a.pathway === 'prestasi').length;
  const countMutasi = applications.filter((a) => a.pathway === 'mutasi').length;

  const countVerified = applications.filter((a) => a.verification_status === 'terverifikasi').length;
  const countPending = applications.filter((a) => a.verification_status === 'menunggu').length;
  const countFix = applications.filter((a) => a.verification_status === 'perlu_perbaikan').length;
  const countRejected = applications.filter((a) => a.verification_status === 'ditolak').length;

  const countLulus = applications.filter((a) => a.final_status === 'lulus').length;
  const countTidakLulus = applications.filter((a) => a.final_status === 'tidak_lulus').length;
  const countProses = totalApps - countLulus - countTidakLulus;

  const countLaki = applications.filter((a) => students[a.registration_number]?.gender === 'L').length;
  const countPerempuan = applications.filter((a) => students[a.registration_number]?.gender === 'P').length;

  const statsRows: (string | number)[][] = [
    ['LAPORAN REKAPITULASI PENERIMAAN MURID BARU MADRASAH (SIPMA)'],
    ['Sistem Informasi Penerimaan Murid Baru Madrasah'],
    [''],
    ['PARAMETER LAPORAN', 'KETERANGAN'],
    ['Satuan Pendidikan / Madrasah', options?.schoolName || 'Seluruh Satuan Pendidikan Madrasah'],
    ['Waktu Unduh / Export', `${dateStr}, Pukul ${timeStr} WIB`],
    ['Total Seluruh Pendaftar', totalApps],
    [''],
    ['REKAPITULASI BERDASARKAN JALUR PENDAFTARAN', 'JUMLAH SISWA', 'PERSENTASE (%)'],
    ['Jalur Zonasi Presisi', countZonasi, totalApps > 0 ? `${((countZonasi / totalApps) * 100).toFixed(1)}%` : '0%'],
    ['Jalur Afirmasi (KIP/Dispensasi)', countAfirmasi, totalApps > 0 ? `${((countAfirmasi / totalApps) * 100).toFixed(1)}%` : '0%'],
    ['Jalur Prestasi (Akademik/Tahfidz)', countPrestasi, totalApps > 0 ? `${((countPrestasi / totalApps) * 100).toFixed(1)}%` : '0%'],
    ['Jalur Mutasi Tugas Orang Tua', countMutasi, totalApps > 0 ? `${((countMutasi / totalApps) * 100).toFixed(1)}%` : '0%'],
    ['TOTAL', totalApps, '100%'],
    [''],
    ['STATUS VERIFIKASI DOKUMEN', 'JUMLAH SISWA', 'PERSENTASE (%)'],
    ['Terverifikasi (Lengkap & Sah)', countVerified, totalApps > 0 ? `${((countVerified / totalApps) * 100).toFixed(1)}%` : '0%'],
    ['Menunggu Verifikasi', countPending, totalApps > 0 ? `${((countPending / totalApps) * 100).toFixed(1)}%` : '0%'],
    ['Perlu Perbaikan Dokumen', countFix, totalApps > 0 ? `${((countFix / totalApps) * 100).toFixed(1)}%` : '0%'],
    ['Ditolak', countRejected, totalApps > 0 ? `${((countRejected / totalApps) * 100).toFixed(1)}%` : '0%'],
    [''],
    ['HASIL SELEKSI AKHIR', 'JUMLAH SISWA', 'PERSENTASE (%)'],
    ['Lulus Seleksi', countLulus, totalApps > 0 ? `${((countLulus / totalApps) * 100).toFixed(1)}%` : '0%'],
    ['Tidak Lulus', countTidakLulus, totalApps > 0 ? `${((countTidakLulus / totalApps) * 100).toFixed(1)}%` : '0%'],
    ['Dalam Proses Seleksi', countProses, totalApps > 0 ? `${((countProses / totalApps) * 100).toFixed(1)}%` : '0%'],
    [''],
    ['KOMPOSISI GENDER', 'JUMLAH SISWA', 'PERSENTASE (%)'],
    ['Laki-laki (L)', countLaki, totalApps > 0 ? `${((countLaki / totalApps) * 100).toFixed(1)}%` : '0%'],
    ['Perempuan (P)', countPerempuan, totalApps > 0 ? `${((countPerempuan / totalApps) * 100).toFixed(1)}%` : '0%'],
  ];

  // 3. Create Workbook & Add Sheets
  const wb = XLSX.utils.book_new();

  // Data Sheet
  const wsData = XLSX.utils.aoa_to_sheet(rows);
  wsData['!cols'] = calculateColWidths(rows);
  XLSX.utils.book_append_sheet(wb, wsData, 'Data Pendaftar Lengkap');

  // Summary Sheet
  const wsStats = XLSX.utils.aoa_to_sheet(statsRows);
  wsStats['!cols'] = [
    { wch: 42 },
    { wch: 30 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, wsStats, 'Ringkasan & Statistik');

  // 4. Generate File Name & Trigger Download
  const cleanSchool = (options?.schoolName || 'SIPMA')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 30);
  const formattedDate = exportDate.toISOString().split('T')[0];
  const finalFileName = options?.fileName || `Rekap_Pendaftar_${cleanSchool}_${formattedDate}.xlsx`;

  XLSX.writeFile(wb, finalFileName);
}

/**
 * Export selection results specifically sorted by ranking/distance/score.
 */
export function exportSelectionResultsToExcel(
  school: School,
  pathway: string,
  applications: Application[],
  students: Record<string, StudentProfile>,
  schoolOrigins: Record<string, SchoolOrigin>
) {
  const exportDate = new Date();
  const dateStr = exportDate.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const headers = [
    'Peringkat',
    'No. Pendaftaran',
    'Nama Lengkap',
    'NISN',
    'Asal Sekolah',
    'Jarak ke Madrasah (km)',
    'Status Zonasi',
    'Skor / Portofolio',
    'Status Verifikasi',
    'Hasil Seleksi',
  ];

  const rows: (string | number)[][] = [
    [`HASIL SELEKSI PENERIMAAN MURID BARU - JALUR ${pathway.toUpperCase()}`],
    [`Madrasah: ${school.school_name}`],
    [`Tanggal Export: ${dateStr}`],
    [''],
    headers,
  ];

  applications.forEach((app, idx) => {
    const student = students[app.registration_number];
    const origin = schoolOrigins[app.registration_number];
    rows.push([
      idx + 1,
      app.registration_number,
      student?.name || '-',
      student?.nisn ? `'${student.nisn}` : '-',
      origin?.school_name || '-',
      app.distance_km !== undefined ? Number(app.distance_km.toFixed(2)) : 0,
      app.zoning_status === 'memenuhi' ? 'Memenuhi Zonasi' : 'Luar Zonasi',
      app.score !== undefined ? app.score : '-',
      app.verification_status,
      app.selection_status === 'lulus' ? 'LULUS' : app.selection_status === 'tidak_lulus' ? 'TIDAK LULUS' : 'MENUNGGU',
    ]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = calculateColWidths(rows.slice(4));
  XLSX.utils.book_append_sheet(wb, ws, `Hasil Seleksi ${pathway.toUpperCase()}`);

  const fileName = `Hasil_Seleksi_${school.school_name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${pathway}_${exportDate.toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
