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
} from '../types/sipma';

export const INITIAL_SCHOOLS: School[] = [
  {
    school_id: 'SCH-NEW-1787905953621',
    school_name: "MI ASY-SYAFI'IYYAH 02",
    school_code: 'MI02',
    nsm: '111233290186',
    npsn: '60713692',
    level: 'MI',
    address: "Jl. KH. Sya'roni, No. 13 Jatibarang Lor, Kec. Jatibarang Kab. Brebes",
    village: 'Jatibarang Lor',
    district: 'Jatibarang',
    city: 'Kabupaten Brebes',
    province: 'Jawa Tengah',
    latitude: -6.9641503891899825,
    longitude: 109.0566363288334,
    zoning_radius_km: 0.5,
    quota_total: 64,
    quota_zonasi: 30,
    quota_afirmasi: 20,
    quota_prestasi: 10,
    quota_mutasi: 4,
    status: 'active',
    principal_name: 'Makhfud, S.Pd.',
    headmaster_nip: '',
    contact_phone: '08988857555',
    contact_email: 'mi02jatibarang.brebes@gmail.com',
  },
];

export const INITIAL_USERS: User[] = [
  {
    user_id: 'USR-ADMIN-PUSAT',
    name: 'Administrator Pusat PPDB',
    email: 'adminpusat@gmail.com',
    phone: '085747520003',
    role: 'admin_pusat',
    status: 'active',
    created_at: '2026-01-01T08:00:00Z',
    updated_at: '2026-01-01T08:00:00Z',
  },
  {
    user_id: 'USR-ADM-MI02-MTEE79SF',
    name: 'Abdurrahman Wahid',
    email: 'mi02jatibarang.brebes@gmail.com',
    phone: '08988857555',
    role: 'admin_sekolah',
    school_id: 'SCH-NEW-1787905953621',
    status: 'active',
    created_at: '2026-08-29T13:04:38.223Z',
    updated_at: '2026-08-31T03:22:27.195Z',
  },
];

export const INITIAL_STUDENTS: Record<string, StudentProfile> = {};

export const INITIAL_PARENTS: Record<string, ParentData> = {};

export const INITIAL_SCHOOL_ORIGINS: Record<string, SchoolOrigin> = {};

export const INITIAL_ADDRESSES: Record<string, AddressData> = {};

export const INITIAL_APPLICATIONS: Application[] = [];

export const INITIAL_DOCUMENTS: DocumentItem[] = [];

export const INITIAL_ANNOUNCEMENTS: Announcement[] = [
  {
    announcement_id: 'ANC-001',
    title: 'Pembukaan Penerimaan Murid Baru (PPDB) Madrasah TP 2026/2027',
    content: 'Pendaftaran murid baru dibuka untuk 4 jalur: Jalur Zonasi, Afirmasi, Prestasi (Akademik/Non-Akademik/Tahfidz), dan Mutasi (Perpindahan Tugas Orang Tua/Wali). Calon peserta didik dimohon mempersiapkan dokumen persyaratan asli.',
    date: '2026-02-01',
    is_published: true,
    target_role: 'all',
    author_name: 'Panitia Pusat Kemenag',
  },
  {
    announcement_id: 'ANC-002',
    title: 'Petunjuk Teknis Penentuan Titik Koordinat Rumah Jalur Zonasi',
    content: 'Bagi pendaftar Jalur Zonasi, pastikan titik penanda (marker) pada peta interaktif berada tepat di atas atap rumah tempat tinggal sesuai alamat pada Kartu Keluarga (KK). Radius zonasi maksimal adalah 5,00 km.',
    date: '2026-02-03',
    is_published: true,
    target_role: 'calon_murid',
    school_id: 'SCH-MAN1',
    author_name: 'Panitia PPDB MAN 1',
  },
  {
    announcement_id: 'ANC-003',
    title: 'Jadwal Verifikasi Portofolio Jalur Prestasi dan Berkas Mutasi',
    content: 'Calon peserta didik Jalur Prestasi (KSM, OSN, Tahfidz) dan Jalur Mutasi (SK Penugasan Orang Tua) wajib memastikan dokumen pendukung terunggah jelas untuk verifikasi keaslian oleh panitia seleksi madrasah.',
    date: '2026-02-10',
    is_published: true,
    target_role: 'calon_murid',
    school_id: 'SCH-MAN1',
    author_name: 'Panitia PPDB MAN 1',
  },
];

export const INITIAL_SETTINGS: SystemSettings = {
  spreadsheet_id: '1n1nNgm4eW0O7bSyWv7TF5tVPr38yFU81x50MGUFD5i4',
  drive_root_folder_id: '14tpMbwj63kVA8j378LD0NYzJ2_UqNuO1',
  gas_web_app_url: 'https://script.google.com/macros/s/AKfycbyLB706ICQ9EK77ihqcpUu0nKGUVM2AuZLueY0KhDY-mt1nndP51SFf3kikcraCA65a2Q/exec',
  maps_api_key: 'AIzaSyC2V4lt0ZSPo5G8shUpRuiBys5udgSVQ3k',
  application_year: '2027',
  academic_year_label: '2027/2028',
  app_name: 'SIPMA',
  app_tagline: 'Sistem Penerimaan Murid Madrasah',
  app_logo: 'https://cdn.phototourl.com/free/2026-09-01-6c787787-6585-4830-b0a6-9bfab3f1dba4.png',
  default_school_id: 'SCH-NEW-1787905953621',
  max_file_size_mb: 2,
  registration_open: true,
  announcement_open: true,
  demo_mode: false,
  db_config_locked: true,
  db_config_pin: '123456',
  realtime_sync_enabled: true,
  auto_sync_interval_sec: 15,
};

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    log_id: 'LOG-001',
    timestamp: '2026-02-01T08:00:00Z',
    user_id: 'USR-ADMIN-PUSAT',
    username: 'admin.pusat@kemenag.go.id',
    role: 'admin_pusat',
    action: 'SYSTEM_INIT',
    target: 'Database & Settings',
    description: 'Inisialisasi sistem penerimaan murid madrasah tahun ajaran 2026/2027.',
    status: 'success',
  },
];
