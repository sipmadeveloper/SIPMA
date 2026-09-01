import React, { useState } from 'react';
import {
  Compass,
  MapPin,
  ShieldCheck,
  Award,
  Users,
  Search,
  CheckCircle2,
  ArrowRight,
  BookOpen,
  School as SchoolIcon,
  HelpCircle,
  Phone,
  Mail,
  ChevronDown,
  Calendar,
  ExternalLink,
  Trophy,
  Briefcase,
  HeartHandshake,
} from 'lucide-react';
import { School, Announcement, SystemSettings } from '../../types/sipma';
import { formatDistanceIndonesian } from '../../utils/geo';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { storageService } from '../../services/storageService';

interface Props {
  schools: School[];
  announcements: Announcement[];
  settings?: SystemSettings | null;
  onNavigateToLogin: () => void;
  onNavigateToRegister: () => void;
  onCheckStatus: (query: string) => void;
}

export const LandingPage: React.FC<Props> = ({
  schools,
  announcements,
  settings,
  onNavigateToLogin,
  onNavigateToRegister,
  onCheckStatus,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  const appName = settings?.app_name || 'SIPMA';
  const appTagline = settings?.app_tagline || 'Sistem Penerimaan Murid Madrasah';
  const appLogo = settings?.app_logo;
  const academicYearText =
    settings?.academic_year_label ||
    (settings?.application_year ? `${settings.application_year}/${parseInt(settings.application_year, 10) + 1}` : '2027/2028');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    onCheckStatus(searchQuery.trim());
  };

  const toggleFaq = (idx: number) => {
    setFaqOpen(faqOpen === idx ? null : idx);
  };

  const faqs = [
    {
      q: 'Apa itu Jalur Zonasi pada SIPMA Madrasah?',
      a: 'Jalur Zonasi memprioritaskan calon murid yang berdomisili paling dekat dengan lokasi madrasah tujuan berdasarkan titik koordinat GPS rumah yang divalidasi dengan Kartu Keluarga (KK).',
    },
    {
      q: 'Bagaimana cara menentukan titik koordinat rumah?',
      a: 'Saat mengisi formulir pendaftaran di langkah 5, Anda cukup menggeser pin merah pada peta interaktif Leaflet/OpenStreetMap tepat di atas atap rumah Anda atau menggunakan tombol "Gunakan Lokasi GPS Saya Saat Ini".',
    },
    {
      q: 'Apa saja dokumen yang wajib diunggah?',
      a: 'Dokumen wajib meliputi: Kartu Keluarga (KK), Akta Kelahiran, Pas Foto 3x4 berwarna dengan latar merah/biru, dan Surat Keterangan Lulus / Ijazah / Rapor, serta sertifikat/SK pendukung jika memilih jalur Prestasi atau Mutasi.',
    },
    {
      q: 'Apakah pendaftaran ini dipungut biaya?',
      a: 'Tidak, seluruh proses pendaftaran murid baru melalui SIPMA Madrasah sepenuhnya GRATIS dan transparan tanpa pungutan biaya.',
    },
    {
      q: 'Bagaimana cara mencetak bukti pendaftaran?',
      a: 'Setelah menyelesaikan seluruh tahap formulir dan menekan tombol Submit Final, Anda dapat mencetak Bukti Pendaftaran berformat resmi A4 lengkap dengan QR Code validasi langsung dari dashboard akun Anda.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col w-full overflow-x-hidden" id="sipma-landing-page">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-emerald-100/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {appLogo ? (
              <img
                src={normalizeImageUrl(appLogo)}
                alt={appName}
                className="w-9 h-9 sm:w-10 sm:h-10 object-contain rounded-xl border border-emerald-200/80 shadow-md bg-white p-0.5 shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-emerald-800 to-teal-600 text-white flex items-center justify-center font-black text-lg sm:text-xl shadow-md shrink-0">
                {appName.charAt(0) || 'S'}
              </div>
            )}
            <div className="min-w-0">
              <div className="font-black text-base sm:text-lg tracking-tight text-slate-900 leading-none truncate">
                {appName}
              </div>
              <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-emerald-800 truncate">
                {appTagline}
              </div>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-5 text-xs font-bold text-slate-600">
            <a href="#alur" className="hover:text-emerald-800 transition-colors">
              Alur Pendaftaran
            </a>
            <a href="#jalur" className="hover:text-emerald-800 transition-colors">
              Jalur & Kuota
            </a>
            <a href="#madrasah" className="hover:text-emerald-800 transition-colors">
              Madrasah Pilihan
            </a>
            <a href="#pengumuman" className="hover:text-emerald-800 transition-colors">
              Pengumuman
            </a>
            <a href="#faq" className="hover:text-emerald-800 transition-colors">
              Bantuan (FAQ)
            </a>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={onNavigateToLogin}
              className="px-3.5 sm:px-4 py-2 text-slate-700 hover:text-emerald-900 font-bold text-xs rounded-xl hover:bg-emerald-50 transition-colors cursor-pointer border border-transparent hover:border-emerald-200"
            >
              Masuk
            </button>

            <button
              type="button"
              onClick={onNavigateToRegister}
              className="px-3.5 sm:px-4 py-2 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
            >
              Daftar Baru
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-emerald-950 to-teal-950 text-white py-14 sm:py-20 lg:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-600/15 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto space-y-5 sm:space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-800/80 border border-emerald-400/40 text-emerald-200 text-[11px] sm:text-xs font-bold shadow-xs max-w-full backdrop-blur-xs">
              <Calendar className="w-3.5 h-3.5 shrink-0 text-emerald-300" />
              <span className="truncate">Penerimaan Peserta Didik Madrasah Tahun Ajaran {academicYearText}</span>
            </div>

            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight px-2 text-white drop-shadow-xs">
              Sistem Penerimaan Murid Baru Madrasah
            </h1>

            <p className="text-xs sm:text-sm lg:text-base text-emerald-100/90 leading-relaxed max-w-2xl mx-auto px-2 font-medium">
              Daftarkan putra-putri Anda ke Madrasah Ibtidaiyah (MI), Tsanawiyah (MTs), dan Aliyah (MA) unggulan secara transparan, akurat dengan peta zonasi koordinat rumah, dan terintegrasi secara digital.
            </p>

            {/* Quick Check Tracker Form */}
            <div className="pt-3 max-w-xl mx-auto w-full px-2">
              <form
                onSubmit={handleSearch}
                className="bg-white/95 backdrop-blur-xs p-1.5 sm:p-2 rounded-2xl shadow-xl flex flex-col sm:flex-row items-stretch sm:items-center gap-2 border border-emerald-200/80"
              >
                <div className="flex-1 flex items-center pl-2 sm:pl-3 gap-2">
                  <Search className="w-4 h-4 text-emerald-700 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Masukkan No. Pendaftaran atau NIK..."
                    className="w-full text-xs text-slate-900 placeholder:text-slate-400 outline-none bg-transparent font-semibold py-1.5"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 sm:px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Cek Status</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>
              <div className="text-[11px] text-emerald-200/80 mt-2 text-center font-medium">
                Atau langsung buat akun baru untuk memulai pengisian biodata dan dokumen.
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 px-2">
              <button
                type="button"
                onClick={onNavigateToRegister}
                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ring-2 ring-emerald-400/30"
              >
                <span>Daftar Calon Murid Baru</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onNavigateToLogin}
                className="w-full sm:w-auto px-6 py-3 bg-slate-900/80 hover:bg-slate-800 text-white font-bold text-xs rounded-xl border border-emerald-500/40 shadow-xs transition-colors cursor-pointer flex items-center justify-center backdrop-blur-xs"
              >
                Masuk Portal
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 5-Step Admission Flow */}
      <section id="alur" className="py-16 bg-gradient-to-b from-slate-50 via-emerald-50/20 to-white border-b border-emerald-100/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <div className="text-xs font-black text-emerald-800 uppercase tracking-wider">
              Tahapan Mudah & Transparan
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
              5 Langkah Alur Pendaftaran Madrasah
            </h2>
            <p className="text-xs text-slate-600">
              Ikuti alur pendaftaran secara teratur mulai dari pembuatan akun hingga pengumuman kelulusan.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              {
                step: '01',
                title: 'Buat Akun Calon Murid',
                desc: 'Daftar menggunakan Nama Lengkap, NIK, dan Email aktif untuk mendapatkan Nomor Pendaftaran unik.',
                color: 'from-emerald-500 to-teal-600',
                border: 'border-emerald-200/80 hover:border-emerald-400',
                bg: 'bg-white',
              },
              {
                step: '02',
                title: 'Lengkapi Biodata & Titik Peta',
                desc: 'Isi data pribadi, orang tua, sekolah asal, dan tentukan titik koordinat rumah di peta interaktif.',
                color: 'from-teal-600 to-cyan-600',
                border: 'border-teal-200/80 hover:border-teal-400',
                bg: 'bg-white',
              },
              {
                step: '03',
                title: 'Unggah Berkas Persyaratan',
                desc: 'Upload foto KK, Akta Kelahiran, Ijazah/SKL, dan Pas Foto secara digital ke sistem formulir.',
                color: 'from-indigo-500 to-blue-600',
                border: 'border-indigo-200/80 hover:border-indigo-400',
                bg: 'bg-white',
              },
              {
                step: '04',
                title: 'Verifikasi & Pemeringkatan',
                desc: 'Panitia madrasah memverifikasi berkas dan sistem memproses seleksi sesuai ketentuan jalur pilihan.',
                color: 'from-amber-500 to-orange-600',
                border: 'border-amber-200/80 hover:border-amber-400',
                bg: 'bg-white',
              },
              {
                step: '05',
                title: 'Pengumuman & Cetak Bukti',
                desc: 'Lihat status kelulusan di portal dan unduh / cetak Bukti Pendaftaran resmi ber-QR Code.',
                color: 'from-rose-500 to-pink-600',
                border: 'border-rose-200/80 hover:border-rose-400',
                bg: 'bg-white',
              },
            ].map((s) => (
              <div
                key={s.step}
                className={`p-5 rounded-2xl ${s.bg} border ${s.border} shadow-xs space-y-3 relative transition-all hover:shadow-md`}
              >
                <div className={`text-2xl font-black font-mono bg-gradient-to-r ${s.color} bg-clip-text text-transparent`}>
                  {s.step}
                </div>
                <h3 className="font-black text-sm text-slate-900">{s.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Jalur Pendaftaran Section - 4 Pathways */}
      <section id="jalur" className="py-16 bg-gradient-to-b from-white via-slate-50/80 to-emerald-50/20 border-b border-emerald-100/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <div className="text-xs font-black text-emerald-800 uppercase tracking-wider">
              Pilihan Kategori
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
              4 Pilihan Jalur Pendaftaran & Ketentuan
            </h2>
            <p className="text-xs text-slate-600">
              Tentukan jalur pendaftaran yang sesuai dengan kriteria domisili, prestasi, atau latar belakang calon murid.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {/* 1. Jalur Zonasi */}
            <div className="bg-gradient-to-br from-emerald-50/70 via-white to-white p-6 rounded-2xl border-2 border-emerald-400/80 shadow-xs space-y-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-200">
                  Jalur Utama (Reguler)
                </span>
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <Compass className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">1. Jalur Zonasi</h3>
                <div className="text-[11px] font-bold text-emerald-800">Prioritas Jarak Domisili Terdekat</div>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                Diperuntukkan bagi calon murid yang berdomisili di dalam wilayah radius zonasi madrasah. Pemeringkatan seleksi dihitung otomatis berdasarkan <strong>jarak tempuh garis lurus terdekat</strong> dari titik koordinat GPS rumah ke lokasi madrasah pilihan.
              </p>
              <div className="p-3.5 bg-emerald-100/60 rounded-xl text-xs text-emerald-950 space-y-1.5 border border-emerald-200/80">
                <div className="font-black text-emerald-950">Ketentuan & Syarat:</div>
                <div>• <strong>Kuota:</strong> Minimal 50% – 60% dari total daya tampung</div>
                <div>• <strong>Penentuan Titik:</strong> Titik koordinat GPS rumah akurat di peta interaktif</div>
                <div>• <strong>Dokumen:</strong> Kartu Keluarga (KK) diterbitkan minimal 1 tahun sebelum pendaftaran</div>
              </div>
            </div>

            {/* 2. Jalur Afirmasi */}
            <div className="bg-gradient-to-br from-purple-50/70 via-white to-white p-6 rounded-2xl border-2 border-purple-300/80 shadow-xs space-y-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full text-xs font-black bg-purple-100 text-purple-900 border border-purple-200">
                  Jalur Pemerataan
                </span>
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold">
                  <HeartHandshake className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">2. Jalur Afirmasi</h3>
                <div className="text-[11px] font-bold text-purple-800">Keluarga Prasejahtera & Disabilitas</div>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                Disediakan khusus untuk memberikan kesempatan pendidikan merata bagi calon murid dari keluarga ekonomi tidak mampu serta penyandang disabilitas yang memenuhi kriteria kelayakan madrasah.
              </p>
              <div className="p-3.5 bg-purple-100/60 rounded-xl text-xs text-purple-950 space-y-1.5 border border-purple-200/80">
                <div className="font-black text-purple-950">Ketentuan & Syarat:</div>
                <div>• <strong>Kuota:</strong> Hingga 15% – 20% dari daya tampung madrasah</div>
                <div>• <strong>Kriteria:</strong> Terdaftar dalam program bantuan sosial resmi pemerintah</div>
                <div>• <strong>Dokumen:</strong> Kartu Indonesia Pintar (KIP) / PKH / KKS / Bukti DTKS yang valid</div>
              </div>
            </div>

            {/* 3. Jalur Prestasi */}
            <div className="bg-gradient-to-br from-amber-50/70 via-white to-white p-6 rounded-2xl border-2 border-amber-300/80 shadow-xs space-y-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-200">
                  Jalur Keunggulan
                </span>
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <Trophy className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">3. Jalur Prestasi</h3>
                <div className="text-[11px] font-bold text-amber-800">Akademik, Non-Akademik & Tahfidz Al-Qur'an</div>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                Apresiasi bagi calon murid yang memiliki rekam jejak capaian kejuaraan sains, riset, olahraga, seni budaya, keagamaan, serta hafalan Al-Qur'an (Tahfidz) minimal tingkat Kabupaten/Kota hingga Internasional.
              </p>
              <div className="p-3.5 bg-amber-100/60 rounded-xl text-xs text-amber-950 space-y-1.5 border border-amber-200/80">
                <div className="font-black text-amber-950">Ketentuan & Syarat:</div>
                <div>• <strong>Kuota:</strong> Hingga 20% dari daya tampung madrasah</div>
                <div>• <strong>Tingkat Kejuaraan:</strong> Kab/Kota, Provinsi, Nasional, atau Internasional</div>
                <div>• <strong>Dokumen:</strong> Sertifikat/Piagam Kejuaraan resmi atau Syahadah Tahfidz</div>
              </div>
            </div>

            {/* 4. Jalur Mutasi */}
            <div className="bg-gradient-to-br from-blue-50/70 via-white to-white p-6 rounded-2xl border-2 border-blue-300/80 shadow-xs space-y-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-900 border border-blue-200">
                  Jalur Penugasan
                </span>
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
                  <Briefcase className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">4. Jalur Perpindahan Tugas Orang Tua (Mutasi)</h3>
                <div className="text-[11px] font-bold text-blue-800">Tugas Kedinasan & Maslahat Guru</div>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                Mengakomodasi calon murid yang berpindah tempat tinggal karena mengikuti perpindahan tugas resmi kedinasan orang tua/wali kerja (Instansi Pemerintah, TNI, POLRI, BUMN, atau Swasta), serta putra-putri guru madrasah.
              </p>
              <div className="p-3.5 bg-blue-100/60 rounded-xl text-xs text-blue-950 space-y-1.5 border border-blue-200/80">
                <div className="font-black text-blue-950">Ketentuan & Syarat:</div>
                <div>• <strong>Kuota:</strong> Hingga 5% – 10% dari daya tampung madrasah</div>
                <div>• <strong>Kriteria:</strong> Perpindahan tugas dinas yang dibuktikan surat resmi instansi</div>
                <div>• <strong>Dokumen:</strong> Surat Keputusan (SK) Mutasi / Surat Penugasan Orang Tua yang sah</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Madrasah Pilihan */}
      <section id="madrasah" className="py-16 bg-gradient-to-b from-white to-slate-50/80 border-b border-emerald-100/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-black text-emerald-800 uppercase tracking-wider">
                Satuan Pendidikan
              </div>
              <h2 className="text-2xl font-black text-slate-900 mt-0.5">
                Daftar Madrasah Terdaftar
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {schools.map((school) => (
              <div
                key={school.school_id}
                className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-xs space-y-3 hover:border-emerald-400 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {school.logo_url ? (
                      <img
                        src={normalizeImageUrl(school.logo_url)}
                        alt={school.school_name}
                        className="w-8 h-8 object-contain rounded-lg border border-emerald-200 bg-white p-0.5"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-xs">
                        {school.level || 'M'}
                      </div>
                    )}
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-900 border border-emerald-200">
                      Jenjang {school.level}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-slate-500 font-bold">NSM: {school.nsm}</span>
                </div>

                <h3 className="font-black text-sm text-slate-900 leading-snug">
                  {school.school_name}
                </h3>
                <p className="text-xs text-slate-600 line-clamp-2 font-medium">{school.address}</p>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-medium">
                  <div>
                    <span className="text-slate-500">Radius Zonasi:</span>{' '}
                    <strong className="text-slate-900">{school.zoning_radius_km} km</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Total Kuota:</span>{' '}
                    <strong className="text-emerald-800 font-black">
                      {school.quota_zonasi + school.quota_afirmasi + (school.quota_prestasi || 0) + (school.quota_mutasi || 0)} Murid
                    </strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pengumuman Terbaru */}
      {announcements.length > 0 && (
        <section id="pengumuman" className="py-16 bg-gradient-to-b from-slate-50/80 via-emerald-50/20 to-white border-b border-emerald-100/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <div className="text-center max-w-2xl mx-auto space-y-1">
              <div className="text-xs font-black text-emerald-800 uppercase tracking-wider">
                Informasi Resmi
              </div>
              <h2 className="text-2xl font-black text-slate-900">Pengumuman & Edaran PPDB</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
              {announcements.slice(0, 4).map((a) => (
                <div
                  key={a.announcement_id}
                  className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-xs space-y-2 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900">{a.title}</span>
                    <span className="text-[11px] font-mono text-emerald-800 font-bold">{a.date}</span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed font-medium">{a.content}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ Section */}
      <section id="faq" className="py-16 bg-white border-b border-emerald-100/70">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="text-xs font-black text-emerald-800 uppercase tracking-wider">
              Pusat Bantuan
            </div>
            <h2 className="text-2xl font-black text-slate-900">Pertanyaan yang Sering Diajukan</h2>
          </div>

          <div className="space-y-3">
            {faqs.map((f, idx) => (
              <div
                key={f.q}
                className="border border-slate-200/90 rounded-xl overflow-hidden bg-slate-50/50"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-4 text-left font-black text-xs text-slate-900 flex items-center justify-between gap-2 hover:bg-emerald-50/60 cursor-pointer transition-colors"
                >
                  <span>{f.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-500 transition-transform ${
                      faqOpen === idx ? 'rotate-180 text-emerald-800' : ''
                    }`}
                  />
                </button>
                {faqOpen === idx && (
                  <div className="p-4 pt-0 text-xs text-slate-700 leading-relaxed border-t border-emerald-100/80 bg-white font-medium">
                    {f.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-slate-950 via-emerald-950 to-slate-950 text-white py-12 border-t border-emerald-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-slate-300">
          <div className="flex items-center gap-3">
            {appLogo ? (
              <img
                src={normalizeImageUrl(appLogo)}
                alt={appName}
                className="w-8 h-8 object-contain rounded-lg border border-emerald-500/50 bg-white p-0.5"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-black">
                {appName.charAt(0) || 'S'}
              </div>
            )}
            <div>
              <div className="font-bold text-white">{appName} - {appTagline}</div>
              <div className="text-[11px] text-emerald-300/80">
                Madrasah Mandiri Berprestasi &bull; Sistem Informasi Digital Terpadu
              </div>
            </div>
          </div>

          <div className="text-center md:text-right text-[11px]">
            <div className="text-emerald-200/70">&copy; {new Date().getFullYear()} {appName}. Seluruh hak cipta dilindungi.</div>
          </div>
        </div>
      </footer>
    </div>
  );
};
