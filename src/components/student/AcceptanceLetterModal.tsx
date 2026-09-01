import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Printer,
  FileDown,
  ArrowLeft,
  X,
  CheckCircle2,
  Award,
  ShieldCheck,
  Building,
  Info,
  Calendar,
  Clock,
  Phone,
  FileCheck,
} from 'lucide-react';
import { Application, StudentProfile, ParentData, SchoolOrigin, AddressData, School } from '../../types/sipma';
import { formatDistanceIndonesian } from '../../utils/geo';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { storageService } from '../../services/storageService';

interface Props {
  isOpen?: boolean;
  onClose: () => void;
  student?: Partial<StudentProfile> | null;
  parent?: Partial<ParentData> | null;
  schoolOrigin?: Partial<SchoolOrigin> | null;
  address?: Partial<AddressData> | null;
  school?: Partial<School> | null;
  application?: Partial<Application> | null;
}

export const AcceptanceLetterModal: React.FC<Props> = ({
  isOpen = true,
  onClose,
  student: propStudent,
  parent: propParent,
  schoolOrigin: propSchoolOrigin,
  address: propAddress,
  school: propSchool,
  application: propApplication,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const settings = storageService.getSettings();
  const currentUser = storageService.getCurrentUser();

  const regNum =
    propApplication?.registration_number ||
    propStudent?.registration_number ||
    currentUser?.registration_number ||
    'SIPMA-2026-001';

  // Load latest state from storage if props are missing
  const student = propStudent || storageService.getStudentProfile(regNum) || {
    name: currentUser?.name || 'Calon Murid Baru',
    registration_number: regNum,
    nik: '3171012345670001',
    nisn: '0081234567',
    gender: 'L',
    birth_place: 'Jakarta',
    birth_date: '2010-05-14',
    phone: currentUser?.phone || '081234567890',
  };

  const parent = propParent || storageService.getParentData(regNum) || {
    father_name: 'Ahmad Fauzi',
    father_job: 'Wiraswasta',
    father_phone: '081234567890',
    mother_name: 'Siti Aminah',
  };

  const schoolOrigin = propSchoolOrigin || storageService.getSchoolOrigin(regNum) || {
    school_name: 'MTs Negeri 1 Jakarta',
    previous_level: 'MTs/SMP',
    npsn_nsm: '20104567',
  };

  const address = propAddress || storageService.getAddressData(regNum) || {
    street_address: 'Jl. Madrasah No. 12',
    rt: '01',
    rw: '05',
    village: 'Cilandak Timur',
    district: 'Pasar Minggu',
    city: 'Jakarta Selatan',
    province: 'DKI Jakarta',
  };

  const application = propApplication || storageService.getApplication(regNum) || {
    registration_number: regNum,
    school_id: 'SCH-MAN1',
    pathway: 'zonasi',
    final_status: 'lulus',
    distance_km: 0.85,
    max_distance_km: 5.0,
  };

  const schools = storageService.getSchools();
  const foundSchool =
    propSchool ||
    schools.find((s) => s.school_id === application.school_id) ||
    schools[0];

  const defaultSchoolFallback: Partial<School> & {
    school_name: string;
    level: string;
    address: string;
    contact_phone: string;
    contact_email: string;
    nsm: string;
    npsn: string;
    principal_name: string;
    headmaster_nip?: string;
    school_code?: string;
    school_id?: string;
  } = {
    school_name: 'MAN 1 JAKARTA SELATAN',
    level: 'MA',
    address: 'Jl. Madrasah No. 1, Cilandak Timur, Pasar Minggu, Jakarta Selatan',
    contact_phone: '(021) 7801234',
    contact_email: 'info@man1jaksel.sch.id',
    nsm: '131131740001',
    npsn: '20107890',
    principal_name: 'Dr. H. Ahmad Sanusi, M.Pd.',
    headmaster_nip: '197205121998031002',
    school_code: 'MAN01',
    school_id: 'SCH-MAN1',
  };

  const school = foundSchool || defaultSchoolFallback;

  const academicYearSafe =
    settings?.academic_year_label ||
    (settings?.application_year
      ? `${settings.application_year}/${parseInt(settings.application_year, 10) + 1}`
      : '2026/2027');

  const studentNameSafe = student?.name || currentUser?.name || 'Calon Murid Baru';
  const studentNikSafe = student?.nik || '-';
  const studentNisnSafe = student?.nisn || '-';
  const studentGenderSafe =
    student?.gender === 'L' ? 'Laki-laki' : student?.gender === 'P' ? 'Perempuan' : '-';
  const studentBirthSafe =
    student?.birth_place && student?.birth_date
      ? `${student.birth_place}, ${student.birth_date}`
      : student?.birth_place || student?.birth_date || '-';

  const fatherNameSafe = parent?.father_name && parent.father_status !== 'meninggal' && parent.father_status !== 'tidak_diketahui'
    ? parent.father_name
    : parent?.mother_name || parent?.guardian_name || (parent?.father_name ? parent.father_name : '-');

  const originSchoolSafe =
    schoolOrigin?.previous_level === 'Belum Pernah Sekolah'
      ? 'Belum Pernah Sekolah'
      : schoolOrigin?.school_name || 'MTs / SMP Asal';

  const pathwayUpper = (application?.pathway || 'zonasi').toUpperCase();
  const schoolNameSafe = school?.school_name || 'Madrasah Aliyah Negeri (MAN) 1';
  const schoolAddressSafe = school?.address || 'Alamat Madrasah';
  const schoolPhoneSafe = school?.contact_phone || '-';
  const schoolEmailSafe = school?.contact_email || '-';
  const schoolNsmSafe = school?.nsm || '-';
  const schoolNpsnSafe = school?.npsn || '-';
  const schoolPrincipalSafe = school?.principal_name || 'Dr. H. Ahmad Sanusi, M.Pd.';
  const schoolPrincipalNip = school?.headmaster_nip || '197205121998031002';
  const schoolCodeSafe = school?.school_code || (school?.school_id ? school.school_id.replace(/^SCH-/, '') : 'MAN01');

  const formatIndonesianDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return new Intl.DateTimeFormat('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }).format(d);
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const reregStartDate = formatIndonesianDate(school?.reregistration_start_date);
  const reregEndDate = formatIndonesianDate(school?.reregistration_end_date);
  const reregScheduleText =
    reregStartDate && reregEndDate
      ? `${reregStartDate} s.d. ${reregEndDate}`
      : reregStartDate
      ? `Mulai ${reregStartDate}`
      : 'Sesuai Pengumuman Resmi Panitia PPDB Madrasah';

  const reregTimeText = school?.reregistration_time || 'Pukul 08.00 - 14.00 WIB (Senin - Sabtu)';
  const reregLocationText = school?.reregistration_location || `Sekretariat Panitia PPDB di ${schoolNameSafe}`;
  const reregNotesText = school?.reregistration_notes || '';

  const letterNumberSafe = `421.1/PPDB-${schoolCodeSafe}/${settings?.application_year || '2026'}/${regNum.split('-').pop() || '001'}`;

  const todayStr = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  useEffect(() => {
    const qrPayload = JSON.stringify({
      app: 'SIPMA-KEMENAG',
      doc: 'SURAT_KETERANGAN_DITERIMA',
      letterNumber: letterNumberSafe,
      regNumber: regNum,
      name: studentNameSafe,
      nik: studentNikSafe,
      school: schoolNameSafe,
      pathway: pathwayUpper,
      decision: 'LULUS_DAN_DITERIMA',
      academicYear: academicYearSafe,
      verifiedDate: new Date().toISOString(),
    });

    QRCode.toDataURL(qrPayload, {
      width: 140,
      margin: 1,
      color: {
        dark: '#064e3b',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Error generating QR code:', err));
  }, [letterNumberSafe, regNum, studentNameSafe, schoolNameSafe, pathwayUpper, academicYearSafe]);

  if (!isOpen) return null;

  const handlePrint = () => {
    try {
      window.print();
    } catch (e) {
      console.warn('Window print error:', e);
      handlePrintDedicatedWindow();
    }
  };

  const handlePrintDedicatedWindow = () => {
    try {
      const win = window.open('', '_blank', 'width=850,height=900');
      if (win) {
        win.document.open();
        win.document.write(docContentHtml);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 500);
      }
    } catch (err) {
      console.error('Popup error:', err);
    }
  };

  const docContentHtml = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Surat Keterangan Diterima - ${regNum}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm 18mm 15mm 18mm; }
    body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; line-height: 1.35; color: #000; padding: 15px; }
    .kop { text-align: center; border-bottom: 3px double #000; padding-bottom: 6px; margin-bottom: 14px; }
    .kop-kemenag { font-size: 9pt; font-weight: bold; letter-spacing: 1px; color: #047857; }
    .kop-title { font-size: 14pt; font-weight: bold; text-transform: uppercase; margin: 2px 0; }
    .kop-sub { font-size: 8.5pt; color: #333; }
    .title { text-align: center; font-size: 12pt; font-weight: bold; text-decoration: underline; text-transform: uppercase; margin-bottom: 2px; }
    .nomor { text-align: center; font-size: 9.5pt; font-family: monospace; margin-bottom: 12px; }
    .table-data { width: 100%; border-collapse: collapse; margin-top: 4px; margin-bottom: 10px; }
    .table-data td { font-size: 10.5pt; padding: 2.5px 0; vertical-align: top; }
    .table-data td.lbl { width: 180px; }
    .table-data td.sep { width: 12px; text-align: center; }
    .box-decision { border: 2px solid #047857; background-color: #f0fdf4; padding: 8px 12px; text-align: center; margin: 12px 0; border-radius: 6px; }
    .decision-title { font-size: 13pt; font-weight: bold; color: #047857; letter-spacing: 1px; }
    .info-list { padding-left: 20px; margin: 6px 0; font-size: 9.5pt; }
    .info-list li { margin-bottom: 3px; }
    .sig-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    .sig-table td { width: 50%; text-align: center; vertical-align: top; font-size: 10pt; }
    .stamp { border: 2px solid #047857; color: #047857; font-weight: bold; padding: 4px 10px; display: inline-block; font-size: 8.5pt; border-radius: 4px; margin: 5px 0; }
    .name-line { font-weight: bold; text-decoration: underline; margin-top: 5px; }
  </style>
</head>
<body>
  <div class="kop">
    <div class="kop-kemenag">KEMENTERIAN AGAMA REPUBLIK INDONESIA</div>
    <div style="font-size: 10pt; font-weight: bold;">PANITIA PENERIMAAN PESERTA DIDIK BARU (PPDB)</div>
    <div class="kop-title">${schoolNameSafe.toUpperCase()}</div>
    <div class="kop-sub">${schoolAddressSafe} | Telp: ${schoolPhoneSafe} | Email: ${schoolEmailSafe}</div>
    <div class="kop-sub" style="font-family: monospace;">NSM: ${schoolNsmSafe} | NPSN: ${schoolNpsnSafe}</div>
  </div>

  <div class="title">SURAT KETERANGAN PENERIMAAN / KELULUSAN SELEKSI PPDB</div>
  <div class="nomor">Nomor: ${letterNumberSafe}</div>

  <p style="text-align: justify; margin-bottom: 8px; font-size: 10.5pt;">
    Berdasarkan hasil verifikasi berkas administrasi dan sidang pleno penetapan kelulusan Penerimaan Peserta Didik Baru (PPDB) Madrasah Tahun Ajaran ${academicYearSafe}, Kepala <strong>${schoolNameSafe}</strong> dengan ini menerangkan bahwa:
  </p>

  <table class="table-data">
    <tr><td class="lbl">Nama Lengkap Siswa</td><td class="sep">:</td><td><strong>${studentNameSafe}</strong></td></tr>
    <tr><td class="lbl">Nomor Pendaftaran</td><td class="sep">:</td><td><strong style="font-family: monospace;">${regNum}</strong></td></tr>
    <tr><td class="lbl">NIK / NISN</td><td class="sep">:</td><td>${studentNikSafe} / ${studentNisnSafe}</td></tr>
    <tr><td class="lbl">Tempat, Tanggal Lahir</td><td class="sep">:</td><td>${studentBirthSafe}</td></tr>
    <tr><td class="lbl">Jenis Kelamin</td><td class="sep">:</td><td>${studentGenderSafe}</td></tr>
    <tr><td class="lbl">Asal Sekolah / Madrasah</td><td class="sep">:</td><td>${originSchoolSafe}</td></tr>
    <tr><td class="lbl">Nama Orang Tua / Ayah</td><td class="sep">:</td><td>${fatherNameSafe}</td></tr>
    <tr><td class="lbl">Jalur Penerimaan</td><td class="sep">:</td><td><strong>Jalur ${pathwayUpper}</strong></td></tr>
  </table>

  <div class="box-decision">
    <div style="font-size: 10pt; font-weight: bold; color: #1e293b; margin-bottom: 2px;">DENGAN INI DINYATAKAN:</div>
    <div class="decision-title">LULUS & DITERIMA</div>
    <div style="font-size: 10pt; color: #334155; margin-top: 2px;">Sebagai Calon Peserta Didik Baru di <strong>${schoolNameSafe}</strong></div>
    <div style="font-size: 8.5pt; color: #047857; margin-top: 2px;">Tahun Ajaran ${academicYearSafe}</div>
  </div>

  <div style="font-weight: bold; font-size: 10pt; margin-top: 10px; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px;">JADWAL & KETENTUAN DAFTAR ULANG:</div>
  <table style="width: 100%; border-collapse: collapse; margin-top: 4px; margin-bottom: 6px; font-size: 9pt;">
    <tr>
      <td style="width: 160px; font-weight: bold; vertical-align: top; padding: 2px 0;">• Periode Pelaksanaan</td>
      <td style="width: 10px; vertical-align: top; padding: 2px 0;">:</td>
      <td style="vertical-align: top; padding: 2px 0; font-weight: bold; color: #047857;">${reregScheduleText}</td>
    </tr>
    <tr>
      <td style="font-weight: bold; vertical-align: top; padding: 2px 0;">• Waktu Pelayanan</td>
      <td style="vertical-align: top; padding: 2px 0;">:</td>
      <td style="vertical-align: top; padding: 2px 0;">${reregTimeText}</td>
    </tr>
    <tr>
      <td style="font-weight: bold; vertical-align: top; padding: 2px 0;">• Tempat / Ruangan</td>
      <td style="vertical-align: top; padding: 2px 0;">:</td>
      <td style="vertical-align: top; padding: 2px 0;">${reregLocationText}</td>
    </tr>
    ${reregNotesText ? `
    <tr>
      <td style="font-weight: bold; vertical-align: top; padding: 2px 0;">• Ketentuan Tambahan</td>
      <td style="vertical-align: top; padding: 2px 0;">:</td>
      <td style="vertical-align: top; padding: 2px 0;">${reregNotesText}</td>
    </tr>
    ` : ''}
  </table>

  <ol class="info-list">
    <li>Membawa cetakan resmi Surat Keterangan Diterima ini dan Bukti Pendaftaran ber-QR Code.</li>
    <li>Membawa berkas fisik asli dan fotokopi legalisir: Ijazah / SKL, Akta Kelahiran, Kartu Keluarga, dan pas foto 3x4 (3 lembar).</li>
    <li>Pelaksanaan daftar ulang bertempat di ${reregLocationText}.</li>
    <li>Apabila sampai batas waktu yang ditentukan calon murid tidak melakukan daftar ulang tanpa konfirmasi tertulis, maka hak penerimaan dianggap gugur / mengundurkan diri.</li>
  </ol>

  <table class="sig-table">
    <tr>
      <td style="width: 35%;">
        ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR Verification" style="width: 105px; height: 105px; border: 1px solid #ddd; padding: 2px;" />` : ''}
        <div style="font-size: 8pt; color: #64748b; font-family: monospace; margin-top: 2px;">QR Verifikasi Resmi SIPMA</div>
      </td>
      <td style="width: 65%;">
        <div>Ditetapkan di: ${school?.address ? school.address.split(',')[0] : 'Madrasah'}</div>
        <div>Pada tanggal: ${todayStr}</div>
        <div style="font-weight: bold; margin-top: 2px;">Kepala Madrasah,</div>
        <div class="stamp">✓ DITERIMA RESMI PPDB</div>
        <div style="height: 10px;"></div>
        <div class="name-line">${schoolPrincipalSafe}</div>
        <div style="font-size: 8.5pt; color: #555;">NIP. ${schoolPrincipalNip}</div>
      </td>
    </tr>
  </table>

  <div style="margin-top: 14px; font-size: 7.5pt; color: #64748b; text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 4px;">
    * Dokumen ini sah dan diterbitkan secara digital oleh Sistem Informasi Penerimaan Murid Madrasah (SIPMA) Kementerian Agama.
  </div>
</body>
</html>
  `;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static">
      <div
        className="w-full max-w-4xl max-h-[96vh] overflow-y-auto space-y-6 print:max-h-none print:overflow-visible print:p-0 print:space-y-0"
        id="sipma-acceptance-letter-view"
      >
        {/* Action Bar (Completely PDF-restricted) */}
        <div className="print:hidden flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm sticky top-0 z-10">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {/* Download PDF / Print as PDF (Strictly PDF only) */}
            <button
              type="button"
              onClick={handlePrint}
              title="Unduh dan simpan dokumen sebagai file PDF resmi (A4)"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <FileDown className="w-4 h-4 text-emerald-400" />
              <span>Unduh Format PDF</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              title="Cetak langsung ke printer atau Simpan sebagai PDF"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Surat Keterangan Diterima (PDF)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer ml-1"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Official Sheet (A4 format) */}
        <div
          id="sipma-acceptance-sheet"
          className="bg-white p-8 sm:p-12 rounded-2xl border border-slate-300 shadow-xl text-slate-900 print:border-none print:shadow-none print:p-0 print:m-0 print:rounded-none"
        >
          {/* Official Letterhead */}
          <div className="flex items-center justify-between border-b-4 border-double border-slate-900 pb-4 mb-6">
            {school?.logo_url ? (
              <img
                src={normalizeImageUrl(school.logo_url)}
                alt={schoolNameSafe}
                className="w-20 h-20 object-contain rounded-xl p-1 bg-white border border-slate-200 shadow-xs shrink-0"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-20 h-20 bg-emerald-700 text-white rounded-xl flex items-center justify-center font-bold text-3xl shadow-sm shrink-0">
                M
              </div>
            )}

            <div className="text-center flex-1 px-4">
              <div className="text-[11px] font-bold text-emerald-800 tracking-wider uppercase">
                KEMENTERIAN AGAMA REPUBLIK INDONESIA
              </div>
              <div className="text-xs font-bold text-slate-700 uppercase">
                PANITIA PENERIMAAN PESERTA DIDIK BARU (PPDB)
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase mt-0.5">
                {schoolNameSafe}
              </h1>
              <p className="text-xs text-slate-600 mt-1 max-w-xl mx-auto">
                {schoolAddressSafe} | Telp: {schoolPhoneSafe} | Email: {schoolEmailSafe}
              </p>
              <p className="text-[11px] text-slate-500 font-mono">
                NSM: {schoolNsmSafe} | NPSN: {schoolNpsnSafe}
              </p>
            </div>

            <div className="hidden sm:block w-20 shrink-0 text-center">
              <div className="w-16 h-16 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex flex-col items-center justify-center mx-auto shadow-xs">
                <Award className="w-7 h-7 text-emerald-700" />
                <span className="text-[9px] font-black uppercase mt-0.5">SIPMA</span>
              </div>
            </div>
          </div>

          {/* Title & Document Number */}
          <div className="text-center space-y-1 mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 underline uppercase tracking-tight">
              SURAT KETERANGAN PENERIMAAN / KELULUSAN SELEKSI PPDB
            </h2>
            <div className="text-xs text-slate-600 font-mono">
              Nomor: <strong className="text-slate-800">{letterNumberSafe}</strong>
            </div>
            <div className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 inline-block px-3 py-0.5 rounded-full border border-emerald-200">
              Tahun Ajaran {academicYearSafe}
            </div>
          </div>

          {/* Statement */}
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed text-justify mb-5">
            Berdasarkan hasil verifikasi dokumen persyaratan, pemenuhan kriteria seleksi, dan sidang pleno penetapan kelulusan Penerimaan Peserta Didik Baru (PPDB) Madrasah Tahun Ajaran {academicYearSafe}, Panitia PPDB <strong>{schoolNameSafe}</strong> dengan ini menerangkan secara resmi bahwa:
          </p>

          {/* Student Credentials Table */}
          <div className="bg-slate-50/80 p-4 sm:p-5 rounded-xl border border-slate-200 mb-6">
            <table className="w-full text-xs sm:text-sm">
              <tbody className="divide-y divide-slate-200/60">
                <tr>
                  <td className="py-1.5 font-semibold text-slate-600 w-44">Nama Lengkap Siswa</td>
                  <td className="py-1.5 font-bold text-slate-900">: {studentNameSafe}</td>
                </tr>
                <tr>
                  <td className="py-1.5 font-semibold text-slate-600">Nomor Registrasi Resmi</td>
                  <td className="py-1.5 font-mono font-bold text-emerald-800">: {regNum}</td>
                </tr>
                <tr>
                  <td className="py-1.5 font-semibold text-slate-600">NIK / NISN</td>
                  <td className="py-1.5 font-mono text-slate-800">: {studentNikSafe} / {studentNisnSafe}</td>
                </tr>
                <tr>
                  <td className="py-1.5 font-semibold text-slate-600">Tempat, Tanggal Lahir</td>
                  <td className="py-1.5 text-slate-800">: {studentBirthSafe}</td>
                </tr>
                <tr>
                  <td className="py-1.5 font-semibold text-slate-600">Jenis Kelamin</td>
                  <td className="py-1.5 text-slate-800">: {studentGenderSafe}</td>
                </tr>
                <tr>
                  <td className="py-1.5 font-semibold text-slate-600">Asal Madrasah / Sekolah</td>
                  <td className="py-1.5 font-semibold text-slate-900">: {originSchoolSafe}</td>
                </tr>
                <tr>
                  <td className="py-1.5 font-semibold text-slate-600">Nama Orang Tua / Ayah</td>
                  <td className="py-1.5 text-slate-800">: {fatherNameSafe}</td>
                </tr>
                <tr>
                  <td className="py-1.5 font-semibold text-slate-600">Jalur Pendaftaran</td>
                  <td className="py-1.5 font-bold text-emerald-800">: Jalur {pathwayUpper}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Formal Decision Box */}
          <div className="p-5 sm:p-6 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 rounded-2xl border-2 border-emerald-500 text-center space-y-1.5 mb-6 shadow-xs">
            <div className="text-xs uppercase tracking-widest font-bold text-slate-600">
              DENGAN INI DINYATAKAN
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-800 tracking-wide uppercase">
              LULUS & DITERIMA
            </div>
            <div className="text-xs sm:text-sm font-semibold text-slate-700">
              Sebagai Calon Murid Baru di <strong className="text-slate-900">{schoolNameSafe}</strong>
            </div>
            <div className="text-[11px] text-emerald-700 font-medium">
              Tahun Ajaran {academicYearSafe} • Jalur {pathwayUpper}
            </div>
          </div>

          {/* Daftar Ulang Guidelines & Schedule */}
          <div className="space-y-3 mb-8 text-xs text-slate-700">
            <div className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
              <FileCheck className="w-4 h-4 text-emerald-700" />
              <span>Jadwal & Ketentuan Pelaksanaan Daftar Ulang:</span>
            </div>

            <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 text-xs space-y-2 text-slate-800">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-2 border-b border-emerald-200/70">
                <div>
                  <div className="text-[10px] font-bold text-emerald-900 uppercase">Periode Daftar Ulang</div>
                  <div className="font-bold text-emerald-800 mt-0.5">{reregScheduleText}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-emerald-900 uppercase">Waktu Pelayanan</div>
                  <div className="font-medium text-slate-800 mt-0.5">{reregTimeText}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-emerald-900 uppercase">Lokasi / Tempat</div>
                  <div className="font-medium text-slate-800 mt-0.5">{reregLocationText}</div>
                </div>
              </div>

              {reregNotesText && (
                <div className="text-[11.5px] pt-1 text-slate-700">
                  <strong className="text-emerald-900">Catatan Khusus:</strong> {reregNotesText}
                </div>
              )}
            </div>

            <ol className="list-decimal list-inside space-y-1 pl-1 text-slate-600 leading-relaxed text-[11.5px]">
              <li>
                Membawa cetakan fisik <strong>Surat Keterangan Diterima</strong> ini beserta <strong>Bukti Pendaftaran</strong> resmi.
              </li>
              <li>
                Menyerahkan berkas fisik asli dan fotokopi legalisir: Ijazah/SKL, Akta Kelahiran, Kartu Keluarga, dan Pas Foto 3x4 (3 lembar).
              </li>
              <li>
                Melakukan daftar ulang langsung ke <strong>{reregLocationText}</strong>.
              </li>
              <li>
                Calon peserta didik yang tidak melakukan daftar ulang sampai batas waktu yang ditetapkan tanpa konfirmasi resmi dianggap mengundurkan diri.
              </li>
            </ol>
          </div>

          {/* Signatures & Stamp */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-end pt-4 border-t border-slate-200">
            <div className="flex flex-col items-center text-center space-y-2">
              {qrDataUrl && (
                <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-xs inline-block">
                  <img src={qrDataUrl} alt="QR Code Verifikasi" className="w-24 h-24" />
                </div>
              )}
              <div className="space-y-0.5">
                <div className="text-[10px] font-mono text-slate-500">KODE VERIFIKASI DIGITAL</div>
                <div className="text-xs font-bold text-emerald-800 font-mono">
                  {regNum}
                </div>
                <div className="text-[9px] text-slate-400">
                  Pindai QR untuk validasi keaslian dokumen di SIPMA
                </div>
              </div>
            </div>

            <div className="text-center space-y-1">
              <div className="text-xs text-slate-600">
                Ditetapkan di {school?.address ? school.address.split(',')[0] : 'Madrasah'}, {todayStr}
              </div>
              <div className="text-xs font-bold text-slate-900">
                Kepala Madrasah,
              </div>

              {/* Official Stamp */}
              <div className="py-2">
                <div className="inline-block px-3 py-1 rounded-lg border-2 border-emerald-700 text-emerald-800 text-xs font-black uppercase tracking-wider bg-emerald-50/60 rotate-[-3deg] shadow-xs">
                  ✓ TERVERIFIKASI & DITERIMA PPDB
                </div>
              </div>

              <div className="pt-2">
                <div className="font-bold text-sm text-slate-900 underline">
                  {schoolPrincipalSafe}
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  NIP. {schoolPrincipalNip}
                </div>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="mt-8 pt-3 border-t border-dashed border-slate-300 text-center text-[10px] text-slate-400">
            * Surat Keterangan Diterima ini sah dan diterbitkan secara digital oleh Sistem Informasi Penerimaan Murid Madrasah (SIPMA). Format resmi ini hanya dapat diunduh/dicetak dalam bentuk PDF.
          </div>
        </div>
      </div>
    </div>
  );
};
