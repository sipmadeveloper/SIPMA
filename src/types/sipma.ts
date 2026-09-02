export type UserRole = 'admin_pusat' | 'admin_sekolah' | 'operator_sekolah' | 'calon_murid';

export type PathwayType = 'zonasi' | 'afirmasi' | 'prestasi' | 'mutasi';

export type VerificationStatus = 'menunggu' | 'perlu_perbaikan' | 'terverifikasi' | 'ditolak';

export type SelectionStatus = 'menunggu' | 'lulus' | 'tidak_lulus';

export type ApplicationStatus = 'draft' | 'submitted' | 'perlu_perbaikan' | 'terverifikasi' | 'lulus' | 'tidak_lulus';

export interface User {
  user_id: string;
  registration_number?: string;
  name: string;
  email: string;
  phone: string;
  nip?: string;
  position?: string;
  photo_url?: string;
  password_hash?: string;
  role: UserRole;
  school_id?: string; // If admin_sekolah or student registered to a school
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface StudentProfile {
  student_id: string;
  user_id: string;
  registration_number: string;
  name: string;
  nik: string;
  nisn: string;
  gender: 'L' | 'P';
  birth_place: string;
  birth_date: string;
  religion: string;
  family_card_number: string;
  child_order: number;
  total_siblings: number;
  family_status: string; // Anak Kandung, Anak Angkat, dsb.
  hobby?: string; // Hobi calon murid
  living_status?: 'orang_tua_kandung' | 'ayah_kandung' | 'ibu_kandung' | 'wali_saudara' | 'pesantren_asrama'; // Status tempat tinggal
  phone: string;
  email: string;
  photo_url?: string;
}

export interface ParentData {
  parent_id: string;
  student_id: string;
  // Ayah
  father_name: string;
  father_status?: 'hidup' | 'meninggal' | 'tidak_diketahui';
  father_nik: string;
  father_birth_place: string;
  father_birth_date: string;
  father_education: string;
  father_job: string;
  father_income: string;
  father_phone: string;
  // Ibu
  mother_name: string;
  mother_status?: 'hidup' | 'meninggal' | 'tidak_diketahui';
  mother_nik: string;
  mother_birth_place: string;
  mother_birth_date: string;
  mother_education: string;
  mother_job: string;
  mother_income: string;
  mother_phone: string;
  // Wali (diisi bila tinggal bersama wali/saudara)
  guardian_name?: string;
  guardian_nik?: string;
  guardian_relation?: string; // Kakek/Nenek, Paman/Bibi, Kakak, Saudara, dsb.
  guardian_birth_place?: string;
  guardian_birth_date?: string;
  guardian_education?: string;
  guardian_job?: string;
  guardian_income?: string;
  guardian_phone?: string;
  guardian_address?: string;
}

export interface SchoolOrigin {
  origin_id: string;
  student_id: string;
  previous_level?: 'Belum Pernah Sekolah' | 'RA/TK' | 'MI/SD' | 'MTs/SMP' | 'Pesantren/Lainnya' | string;
  school_name: string;
  npsn_nsm: string;
  school_status?: 'Negeri' | 'Swasta';
  school_address: string;
  graduation_year: string;
  diploma_number?: string;
}

export interface AddressData {
  address_id: string;
  student_id: string;
  street_address: string;
  rt: string;
  rw: string;
  village: string; // Kelurahan/Desa
  district: string; // Kecamatan
  city: string; // Kab/Kota
  province: string; // Provinsi
  postal_code: string;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  address_notes?: string;
  distance_km: number;
  is_within_radius: boolean;
  calculated_at?: string;
}

export interface DocumentItem {
  document_id: string;
  registration_number: string;
  student_id: string;
  document_type:
    | 'foto'
    | 'pas_foto'
    | 'kartu_keluarga'
    | 'akta_kelahiran'
    | 'ijazah_skl'
    | 'kartu_afirmasi'
    | 'surat_dispensasi'
    | 'sertifikat_prestasi'
    | 'surat_mutasi'
    | 'surat_keterangan'
    | string;
  document_title: string;
  file_name: string;
  file_size_kb: number;
  file_size_bytes?: number;
  mime_type?: string;
  drive_file_id?: string;
  drive_url?: string;
  local_url?: string;
  file_data_base64?: string; // for preview / upload transfer
  upload_time: string;
  verification_status: VerificationStatus;
  notes?: string;
}

export interface Application {
  application_id: string;
  registration_number: string;
  user_id: string;
  student_id: string;
  school_id: string;
  admission_year: string;
  pathway: PathwayType;
  submission_date?: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  max_distance_km: number;
  zoning_status: 'memenuhi' | 'tidak_memenuhi';
  verification_status: VerificationStatus;
  selection_status: SelectionStatus;
  final_status: ApplicationStatus;
  verification_notes?: string;
  score?: number; // e.g. ranking score
  // Afirmasi fields
  afirmasi_category?: 'ekonomi_kurang_mampu' | 'luar_zonasi';
  dispensation_reason?: string;
  // Prestasi fields
  achievement_type?: 'akademik' | 'non_akademik' | 'keagamaan_tahfidz' | 'keagamaan';
  achievement_name?: string;
  achievement_level?: 'sekolah' | 'kabupaten_kota' | 'provinsi' | 'nasional' | 'internasional';
  achievement_rank?: string; // e.g. "Juara 1", "Juara 2", "Tahfidz 5 Juz"
  // Mutasi fields
  mutation_parent_instansi?: string; // Instansi / Kantor tempat pindah tugas
  mutation_letter_number?: string; // Nomor Surat Tugas / SK Mutasi
  mutation_letter_date?: string; // Tanggal surat mutasi
  // Auto-Reroute / Pelimpahan Kuota Otomatis
  original_school_id?: string;
  is_auto_rerouted?: boolean;
  reroute_reason?: string;
  rerouted_at?: string;
  transfer_history?: {
    transferred_at: string;
    from_school_id: string;
    from_school_name: string;
    to_school_id: string;
    to_school_name: string;
    reason: string;
    distance_km: number;
  }[];
  step_completed: number; // 1 to 9
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

export interface School {
  school_id: string;
  school_name: string;
  school_code?: string; // Kode Unik Madrasah (e.g. MAN01, MTS01, MI01) untuk format no. pendaftaran
  nsm?: string;
  npsn: string;
  level: 'MI' | 'MTs' | 'MA';
  address: string;
  village?: string;
  district?: string;
  city?: string;
  province?: string;
  latitude: number;
  longitude: number;
  zoning_radius_km: number;
  radius_zonasi_km?: number;
  quota_total?: number;
  quota_zonasi: number;
  quota_afirmasi: number;
  quota_prestasi: number;
  quota_mutasi: number;
  quota_percentage_zonasi?: number;
  quota_percentage_afirmasi?: number;
  quota_percentage_prestasi?: number;
  quota_percentage_mutasi?: number;
  status: 'active' | 'inactive';
  principal_name?: string;
  headmaster_nip?: string;
  contact_phone?: string;
  contact_email?: string;
  logo_url?: string;
  // Re-registration schedule (Jadwal & Ketentuan Daftar Ulang)
  reregistration_start_date?: string;
  reregistration_end_date?: string;
  reregistration_time?: string;
  reregistration_location?: string;
  reregistration_notes?: string;
}

export interface SystemSettings {
  spreadsheet_id: string;
  drive_root_folder_id: string;
  gas_web_app_url: string;
  maps_api_key: string;
  application_year: string;
  academic_year_label?: string; // Teks format tahun pelajaran yang ditampilkan di antarmuka (e.g. 2027/2028)
  app_name: string;
  app_tagline?: string;
  app_logo?: string;
  default_school_id: string;
  max_file_size_mb: number;
  registration_open: boolean;
  announcement_open: boolean;
  demo_mode: boolean;
  db_config_locked?: boolean;
  db_config_pin?: string;
  realtime_sync_enabled?: boolean;
  auto_sync_interval_sec?: number;
  last_synced_at?: string;
}

export interface Announcement {
  announcement_id: string;
  title: string;
  content: string;
  date: string;
  is_published: boolean;
  target_role: 'all' | 'calon_murid' | 'admin_sekolah' | 'operator_sekolah';
  school_id?: string;
  author_name: string;
}

export interface AuditLog {
  log_id: string;
  timestamp: string;
  user_id: string;
  username: string;
  user_email?: string;
  role: UserRole;
  user_role?: UserRole;
  action: string;
  target: string;
  description: string;
  details?: string;
  ip?: string;
  ip_address?: string;
  status: 'success' | 'warning' | 'error';
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errorCode?: string;
  file?: any;
  gas_synced?: boolean;
  localOnly?: boolean;
}
