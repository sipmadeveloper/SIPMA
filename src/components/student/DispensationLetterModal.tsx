import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Printer,
  Download,
  ArrowLeft,
  X,
  FileDown,
  CheckCircle,
  ShieldCheck,
  FileText,
  Copy,
  Check,
} from 'lucide-react';
import { Application, StudentProfile, ParentData, SchoolOrigin, AddressData, School } from '../../types/sipma';
import { formatDistanceIndonesian, formatCoordinates } from '../../utils/geo';
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
  reason?: string;
}

export const DispensationLetterModal: React.FC<Props> = ({
  isOpen = true,
  onClose,
  student,
  parent,
  schoolOrigin,
  address,
  school,
  application,
  reason,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedNotification, setCopiedNotification] = useState<boolean>(false);

  const settings = storageService.getSettings();
  const currentUser = storageService.getCurrentUser();

  const regNum =
    student?.registration_number ||
    application?.registration_number ||
    currentUser?.registration_number ||
    `REG-PEND-${settings.application_year || '2026'}`;

  // Robust fallback data from storage or props
  const loadedStudent = student || storageService.getStudentProfile(regNum) || null;
  const loadedParent = parent || storageService.getParentData(regNum) || null;
  const loadedOrigin = schoolOrigin || storageService.getSchoolOrigin(regNum) || null;
  const loadedAddress = address || storageService.getAddressData(regNum) || null;

  const academicYearSafe =
    settings?.academic_year_label ||
    (settings?.application_year ? `${settings.application_year}/${parseInt(settings.application_year, 10) + 1}` : '2026/2027');

  // Automatic Name Population
  const studentSafeName =
    loadedStudent?.name ||
    student?.name ||
    currentUser?.name ||
    'Calon Murid Baru';

  const studentSafeReg = regNum;
  const studentSafeNik = loadedStudent?.nik || student?.nik || '-';
  const studentSafeNisn = loadedStudent?.nisn || student?.nisn || '-';
  const studentSafeGender = (loadedStudent?.gender || student?.gender) === 'L' ? 'Laki-laki' : (loadedStudent?.gender || student?.gender) === 'P' ? 'Perempuan' : '-';
  const studentSafeReligion = loadedStudent?.religion || student?.religion || 'Islam';
  const studentSafeBirth =
    (loadedStudent?.birth_place || student?.birth_place) && (loadedStudent?.birth_date || student?.birth_date)
      ? `${loadedStudent?.birth_place || student?.birth_place}, ${loadedStudent?.birth_date || student?.birth_date}`
      : loadedStudent?.birth_place || student?.birth_place || '-';

  // Parent / Father Name Automatic Population
  const applicantParentName =
    loadedParent?.father_name && loadedParent.father_status !== 'meninggal' && loadedParent.father_status !== 'tidak_diketahui' && loadedParent.father_name.trim() !== ''
      ? loadedParent.father_name
      : loadedParent?.mother_name && loadedParent.mother_name.trim() !== ''
      ? loadedParent.mother_name
      : loadedParent?.guardian_name && loadedParent.guardian_name.trim() !== ''
      ? loadedParent.guardian_name
      : loadedParent?.father_name || 'Orang Tua Calon Murid';

  const applicantParentNik =
    loadedParent?.father_nik && loadedParent.father_status !== 'tidak_diketahui' && loadedParent.father_nik.trim() !== ''
      ? loadedParent.father_nik
      : loadedParent?.mother_nik || loadedParent?.guardian_nik || '-';

  const applicantParentJob =
    loadedParent?.father_job && loadedParent.father_status !== 'tidak_diketahui' && loadedParent.father_job.trim() !== ''
      ? loadedParent.father_job
      : loadedParent?.mother_job || loadedParent?.guardian_job || 'Wiraswasta / Karyawan';

  const applicantParentPhone =
    loadedParent?.father_phone || loadedParent?.mother_phone || loadedParent?.guardian_phone || loadedStudent?.phone || currentUser?.phone || '-';

  const parentRoleLabel =
    loadedStudent?.living_status === 'wali_saudara'
      ? 'Wali Calon Murid'
      : loadedParent?.father_name && loadedParent.father_status !== 'meninggal'
      ? 'Ayah Kandung (Orang Tua)'
      : loadedParent?.mother_name
      ? 'Ibu Kandung (Orang Tua)'
      : 'Orang Tua / Ayah Calon Murid';

  const schoolOriginSafe =
    loadedOrigin?.previous_level === 'Belum Pernah Sekolah'
      ? 'Belum Pernah Sekolah'
      : loadedOrigin?.school_name || 'MTs / SMP Asal';
  const schoolOriginNpsn = loadedOrigin?.npsn_nsm || '-';

  const schoolNameSafe = school?.school_name || 'Madrasah Pilihan';
  const schoolAddressSafe = school?.address || 'Alamat Madrasah Pilihan';
  const schoolContactSafe = school?.contact_phone || '-';
  const schoolEmailSafe = school?.contact_email || '-';
  const schoolNsmSafe = school?.nsm || '-';
  const schoolNpsnSafe = school?.npsn || '-';
  const schoolRadiusSafe = school?.zoning_radius_km ?? application?.max_distance_km ?? 5;
  const distanceKmSafe = application?.distance_km ?? 0;
  const citySafe = loadedAddress?.city ? loadedAddress.city.replace(/Kota |Kabupaten /i, '') : 'Jakarta';
  const fullAddressSafe = loadedAddress?.street_address
    ? `${loadedAddress.street_address}${loadedAddress.rt ? `, RT ${loadedAddress.rt}` : ''}${loadedAddress.rw ? `/RW ${loadedAddress.rw}` : ''}${loadedAddress.village ? `, Kel. ${loadedAddress.village}` : ''}${loadedAddress.district ? `, Kec. ${loadedAddress.district}` : ''}${loadedAddress.city ? `, ${loadedAddress.city}` : ''}${loadedAddress.province ? `, ${loadedAddress.province}` : ''}`
    : 'Alamat Domisili Calon Murid Sesuai KK';

  const dispensationReasonSafe =
    reason ||
    application?.dispensation_reason ||
    'Calon murid memiliki komitmen dan minat yang sangat tinggi untuk menempuh pendidikan keagamaan serta program unggulan madrasah.';

  const todayStr = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  useEffect(() => {
    const qrPayload = JSON.stringify({
      app: 'SIPMA-DISPENSASI',
      doc: 'SURAT_PERMOHONAN_DISPENSASI',
      regNumber: studentSafeReg,
      name: studentSafeName,
      school: schoolNameSafe,
      pathway: 'afirmasi_luar_zonasi',
      distance: `${distanceKmSafe.toFixed(2)} km`,
      created: new Date().toISOString(),
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
  }, [studentSafeReg, studentSafeName, schoolNameSafe, distanceKmSafe]);

  if (isOpen === false) return null;

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
  <title>Surat Dispensasi - ${studentSafeReg}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm 20mm 15mm 20mm; }
    body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.4; color: #000; padding: 20px; }
    .kop { text-align: center; border-bottom: 3px double #000; padding-bottom: 8px; margin-bottom: 16px; }
    .kop-title { font-size: 14pt; font-weight: bold; text-transform: uppercase; }
    .kop-sub { font-size: 9.5pt; }
    .title { text-align: center; font-size: 12pt; font-weight: bold; text-decoration: underline; text-transform: uppercase; margin-bottom: 4px; }
    .sub-title { text-align: center; font-size: 10pt; font-weight: bold; margin-bottom: 16px; }
    .table-data { width: 100%; border-collapse: collapse; margin-top: 4px; margin-bottom: 12px; }
    .table-data td { font-size: 11pt; padding: 3px 0; vertical-align: top; }
    .table-data td.lbl { width: 190px; }
    .table-data td.sep { width: 15px; text-align: center; }
    .section-head { font-weight: bold; font-size: 11pt; margin-top: 10px; margin-bottom: 2px; border-bottom: 1px solid #000; padding-bottom: 2px; }
    ol { padding-left: 22px; margin: 6px 0 12px 0; }
    ol li { font-size: 11pt; margin-bottom: 5px; text-align: justify; }
    p.justify { text-align: justify; font-size: 11pt; margin-bottom: 8px; }
    .sig-table { width: 100%; border-collapse: collapse; margin-top: 25px; }
    .sig-table td { width: 50%; text-align: center; vertical-align: top; font-size: 11pt; }
    .materai { width: 110px; height: 55px; border: 1px dashed #666; margin: 10px auto; text-align: center; line-height: 55px; font-size: 8pt; color: #555; }
    .name-line { font-weight: bold; text-decoration: underline; margin-top: 5px; }
  </style>
</head>
<body>
  <div class="kop">
    <div class="kop-title">PANITIA PENERIMAAN MURID BARU (PPDB)</div>
    <div class="kop-title" style="font-size: 15pt;">${schoolNameSafe.toUpperCase()}</div>
    <div class="kop-sub">${schoolAddressSafe} | Telp: ${schoolContactSafe} | Email: ${schoolEmailSafe}</div>
    <div class="kop-sub" style="font-family: monospace;">NSM: ${schoolNsmSafe} | NPSN: ${schoolNpsnSafe}</div>
  </div>

  <div class="title">SURAT PERNYATAAN & PERMOHONAN DISPENSASI PENDAFTARAN</div>
  <div class="sub-title">JALUR AFIRMASI (LUAR ZONASI) - TAHUN AJARAN ${academicYearSafe}</div>

  <p class="justify">Yang bertanda tangan di bawah ini, kami selaku orang tua / wali dari calon murid baru:</p>

  <div class="section-head">A. DATA ORANG TUA / WALI PEMOHON</div>
  <table class="table-data">
    <tr><td class="lbl">Nama Lengkap</td><td class="sep">:</td><td><strong>${applicantParentName}</strong></td></tr>
    <tr><td class="lbl">Nomor Induk Kependudukan (NIK)</td><td class="sep">:</td><td>${applicantParentNik}</td></tr>
    <tr><td class="lbl">Pekerjaan</td><td class="sep">:</td><td>${applicantParentJob}</td></tr>
    <tr><td class="lbl">Nomor HP / WhatsApp</td><td class="sep">:</td><td>${applicantParentPhone}</td></tr>
    <tr><td class="lbl">Alamat Sesuai KK</td><td class="sep">:</td><td>${fullAddressSafe}</td></tr>
    <tr><td class="lbl">Hubungan Keluarga</td><td class="sep">:</td><td>${parentRoleLabel}</td></tr>
  </table>

  <div class="section-head">B. DATA CALON MURID BARU</div>
  <table class="table-data">
    <tr><td class="lbl">Nama Lengkap</td><td class="sep">:</td><td><strong>${studentSafeName}</strong></td></tr>
    <tr><td class="lbl">Nomor Pendaftaran</td><td class="sep">:</td><td><strong>${studentSafeReg}</strong></td></tr>
    <tr><td class="lbl">NIK / NISN</td><td class="sep">:</td><td>${studentSafeNik} / ${studentSafeNisn}</td></tr>
    <tr><td class="lbl">Tempat, Tanggal Lahir</td><td class="sep">:</td><td>${studentSafeBirth}</td></tr>
    <tr><td class="lbl">Madrasah / Sekolah Asal</td><td class="sep">:</td><td>${schoolOriginSafe} (NPSN: ${schoolOriginNpsn})</td></tr>
    <tr><td class="lbl">Madrasah Tujuan</td><td class="sep">:</td><td><strong>${schoolNameSafe}</strong></td></tr>
    <tr><td class="lbl">Jarak Rumah ke Madrasah</td><td class="sep">:</td><td><strong>${formatDistanceIndonesian(distanceKmSafe)}</strong> (Radius Zonasi: ${schoolRadiusSafe} km)</td></tr>
  </table>

  <div class="section-head">C. ALASAN & KOMITMEN DISPENSASI</div>
  <p class="justify" style="margin-top: 6px;">
    Dengan ini mengajukan <strong>PERMOHONAN DISPENSASI KHUSUS PENDAFTARAN LUAR ZONASI</strong> agar calon murid tersebut di atas dapat diikutsertakan dalam seleksi penerimaan murid baru di <strong>${schoolNameSafe}</strong> Tahun Ajaran ${academicYearSafe} dengan komitmen:
  </p>

  <ol>
    <li><strong>Alasan Permohonan:</strong> ${dispensationReasonSafe}</li>
    <li>Orang tua / wali bersedia dan sanggup menanggung seluruh sarana transportasi serta akomodasi harian murid tanpa kendala jarak.</li>
    <li>Sanggup mematuhi tata tertib, jadwal kegiatan belajar mengajar, serta seluruh program pembinaan keagamaan madrasah.</li>
    <li>Menjamin seluruh data serta dokumen yang dilampirkan adalah benar, sah, dan dapat dipertanggungjawabkan di hadapan hukum.</li>
  </ol>

  <p class="justify">
    Demikian surat permohonan dan pernyataan dispensasi ini kami buat dengan sebenarnya tanpa paksaan untuk dipergunakan sebagai dokumen kelengkapan pendaftaran.
  </p>

  <table class="sig-table">
    <tr>
      <td>
        <p>Mengetahui & Menyetujui,<br><strong>Calon Murid Baru</strong></p>
        <div style="height: 65px;"></div>
        <p class="name-line">( ${studentSafeName} )</p>
      </td>
      <td>
        <p>${citySafe}, ${todayStr}<br><strong>Orang Tua / Wali Pemohon</strong></p>
        <div class="materai">MATERAI 10.000</div>
        <p class="name-line">( ${applicantParentName} )</p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const handleDownloadPdf = () => {
    handlePrint();
  };

  const handleCopyText = () => {
    const textContent = `SURAT PERNYATAAN & PERMOHONAN DISPENSASI PENDAFTARAN
JALUR AFIRMASI (LUAR ZONASI) - TAHUN AJARAN 2026/2027

A. IDENTITAS ORANG TUA / WALI:
- Nama Lengkap: ${applicantParentName}
- NIK: ${applicantParentNik}
- Pekerjaan: ${applicantParentJob}
- Telepon/WA: ${applicantParentPhone}
- Alamat KK: ${fullAddressSafe}
- Hubungan: ${parentRoleLabel}

B. IDENTITAS CALON MURID:
- Nama Lengkap: ${studentSafeName}
- No. Pendaftaran: ${studentSafeReg}
- NIK / NISN: ${studentSafeNik} / ${studentSafeNisn}
- Tempat/Tgl Lahir: ${studentSafeBirth}
- Asal Sekolah: ${schoolOriginSafe}
- Madrasah Tujuan: ${schoolNameSafe}
- Jarak: ${formatDistanceIndonesian(distanceKmSafe)} (Radius Standar: ${schoolRadiusSafe} km)

C. ALASAN & KOMITMEN:
1. ${dispensationReasonSafe}
2. Sanggup memfasilitasi akomodasi dan transportasi harian.
3. Patuh tata tertib dan jadwal belajar madrasah.
4. Menjamin keabsahan data dan dokumen.

${citySafe}, ${todayStr}
Orang Tua / Wali: ${applicantParentName}
Calon Murid: ${studentSafeName}`;

    navigator.clipboard.writeText(textContent);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static">
      <div className="w-full max-w-4xl max-h-[96vh] overflow-y-auto space-y-6 print:max-h-none print:overflow-visible print:p-0 print:space-y-0" id="sipma-dispensation-view">
        
        {/* Action Bar (Identical style to Cetak Bukti Pendaftaran) */}
        <div className="print:hidden flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-sm sticky top-0 z-10">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Pendaftaran</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              title="Unduh dan simpan dokumen sebagai file PDF resmi (A4)"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <FileDown className="w-4 h-4 text-emerald-400" />
              <span>Unduh Format PDF</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              title="Cetak langsung ke printer atau Simpan sebagai PDF"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Surat Dispensasi (PDF)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer ml-1"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Official Printable Sheet (A4 format - identical to PrintBuktiPendaftaran) */}
        <div className="bg-white p-8 sm:p-12 rounded-2xl border border-slate-300 shadow-lg text-slate-900 print:border-none print:shadow-none print:p-0 print:m-0 print:rounded-none">
          
          {/* Kop Surat Resmi Madrasah */}
          <div className="flex items-center justify-between border-b-4 border-double border-slate-800 pb-5 mb-6">
            {school?.logo_url ? (
              <img
                src={school.logo_url}
                alt={schoolNameSafe}
                className="w-20 h-20 object-contain rounded-xl p-1 bg-white border border-slate-200 shadow-xs shrink-0"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-20 h-20 bg-emerald-700 text-white rounded-xl flex items-center justify-center font-bold text-3xl shadow-sm shrink-0">
                S
              </div>
            )}

            <div className="text-center flex-1 px-4">
              <div className="text-xs uppercase font-bold tracking-widest text-emerald-800">
                PANITIA PENERIMAAN MURID BARU (PPDB)
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
                {schoolNameSafe}
              </h1>
              <p className="text-xs text-slate-600 mt-1 max-w-xl mx-auto">
                {schoolAddressSafe} | Telp: {schoolContactSafe} | Email: {schoolEmailSafe}
              </p>
              <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                NSM: {schoolNsmSafe} | NPSN: {schoolNpsnSafe}
              </p>
            </div>

            <div className="w-20 h-20 hidden sm:block shrink-0 invisible pointer-events-none" aria-hidden="true" />
          </div>

          {/* Title */}
          <div className="text-center my-6">
            <h2 className="text-lg font-bold text-slate-900 uppercase underline decoration-2 underline-offset-4">
              SURAT PERNYATAAN & PERMOHONAN DISPENSASI PENDAFTARAN
            </h2>
            <div className="text-xs font-semibold text-slate-600 mt-1 uppercase">
              JALUR AFIRMASI (LUAR ZONASI) - TAHUN AJARAN {academicYearSafe}
            </div>
          </div>

          {/* Highlight Card: No Pendaftaran, Kategori Permohonan, & Status Jarak */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl mb-6">
            <div>
              <div className="text-[11px] font-bold text-emerald-900 uppercase">Nomor Pendaftaran</div>
              <div className="text-lg font-mono font-black text-emerald-800 tracking-wider mt-0.5">
                {studentSafeReg}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold text-emerald-900 uppercase">Kategori Permohonan</div>
              <div className="text-base font-bold text-slate-900 capitalize mt-0.5 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                Afirmasi (Luar Zonasi)
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold text-emerald-900 uppercase">Jarak Rumah ke Madrasah</div>
              <div className="text-sm font-bold text-emerald-800 mt-0.5">
                {formatDistanceIndonesian(distanceKmSafe)} (Radius {schoolRadiusSafe} km)
              </div>
            </div>
          </div>

          {/* Main Details Grid (Identical Structure: Photo + Sections) */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
            {/* Student Photo & QR */}
            <div className="sm:col-span-1 flex flex-col items-center space-y-4">
              <div className="w-36 h-48 border-2 border-slate-300 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center shadow-xs">
                {student?.photo_url ? (
                  <img
                    src={student.photo_url}
                    alt={studentSafeName}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="text-center p-3 text-slate-400 text-xs font-semibold">
                    Pas Foto
                    <br />
                    3 x 4 cm
                  </div>
                )}
              </div>

              <div className="text-center">
                {qrDataUrl && (
                  <img src={qrDataUrl} alt="QR Code Pendaftaran" className="w-24 h-24 mx-auto" />
                )}
                <div className="text-[10px] font-mono text-slate-500 mt-1">Scan untuk Validasi</div>
              </div>
            </div>

            {/* Structured Sections */}
            <div className="sm:col-span-3 space-y-4 text-xs">
              
              {/* Section A: Data Orang Tua / Wali */}
              <div>
                <h3 className="font-bold text-slate-800 text-sm border-b pb-1 mb-2">
                  A. DATA ORANG TUA / WALI PEMOHON
                </h3>
                <table className="w-full">
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 w-44 font-semibold text-slate-600">Nama Lengkap</td>
                      <td className="py-1.5 font-bold text-slate-900">: {applicantParentName}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 font-semibold text-slate-600">NIK (No. KTP)</td>
                      <td className="py-1.5 font-mono">: {applicantParentNik}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 font-semibold text-slate-600">Pekerjaan</td>
                      <td className="py-1.5">: {applicantParentJob}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 font-semibold text-slate-600">Nomor WhatsApp / Telp</td>
                      <td className="py-1.5 font-mono">: {applicantParentPhone}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 font-semibold text-slate-600">Alamat Sesuai KK</td>
                      <td className="py-1.5">: {fullAddressSafe}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 font-semibold text-slate-600">Hubungan Keluarga</td>
                      <td className="py-1.5">: {parentRoleLabel}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Section B: Data Calon Murid */}
              <div>
                <h3 className="font-bold text-slate-800 text-sm border-b pb-1 mb-2">
                  B. DATA CALON MURID BARU
                </h3>
                <table className="w-full">
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 w-44 font-semibold text-slate-600">Nama Lengkap</td>
                      <td className="py-1.5 font-bold text-slate-900">: {studentSafeName}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 font-semibold text-slate-600">Nomor Pendaftaran</td>
                      <td className="py-1.5 font-mono font-bold text-emerald-800">: {studentSafeReg}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 font-semibold text-slate-600">NIK / NISN</td>
                      <td className="py-1.5 font-mono">: {studentSafeNik} / {studentSafeNisn}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 font-semibold text-slate-600">Tempat, Tanggal Lahir</td>
                      <td className="py-1.5">: {studentSafeBirth}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 font-semibold text-slate-600">Jenis Kelamin / Agama</td>
                      <td className="py-1.5">: {studentSafeGender} / {studentSafeReligion}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 font-semibold text-slate-600">Madrasah / Sekolah Asal</td>
                      <td className="py-1.5 font-bold text-slate-900">: {schoolOriginSafe} (NPSN: {schoolOriginNpsn})</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 font-semibold text-slate-600">Madrasah Tujuan</td>
                      <td className="py-1.5 font-bold text-slate-900">: {schoolNameSafe}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 font-semibold text-slate-600">Jarak Rumah ke Madrasah</td>
                      <td className="py-1.5 font-bold text-emerald-800">
                        : {formatDistanceIndonesian(distanceKmSafe)} (Radius Standar {schoolRadiusSafe} km)
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Section C: Pernyataan & Komitmen */}
              <div>
                <h3 className="font-bold text-slate-800 text-sm border-b pb-1 mb-2">
                  C. PERNYATAAN & KOMITMEN DISPENSASI
                </h3>
                <p className="text-slate-700 leading-relaxed mb-2 text-justify">
                  Dengan ini mengajukan <strong>PERMOHONAN DISPENSASI KHUSUS JALUR AFIRMASI (LUAR ZONASI)</strong> agar calon murid tersebut di atas dapat diikutsertakan dalam seleksi penerimaan murid baru di <strong>{schoolNameSafe}</strong> Tahun Ajaran {academicYearSafe} dengan komitmen sebagai berikut:
                </p>

                <ol className="list-decimal pl-4 space-y-1 text-slate-800 text-justify">
                  <li>
                    <strong>Alasan Permohonan:</strong> {dispensationReasonSafe}
                  </li>
                  <li>
                    Orang tua / wali bersedia dan sanggup menanggung seluruh sarana transportasi serta akomodasi harian pulang-pergi calon murid tanpa kendala jarak.
                  </li>
                  <li>
                    Sanggup mematuhi seluruh tata tertib, ketentuan jam belajar, serta kurikulum dan program pembinaan keagamaan di madrasah.
                  </li>
                  <li>
                    Menjamin seluruh data dan berkas yang dilampirkan adalah benar, sah, dan dapat dipertanggungjawabkan di hadapan hukum.
                  </li>
                </ol>
              </div>

            </div>
          </div>

          {/* Tanda Tangan & Kotak Materai (Identical format to PrintBuktiPendaftaran) */}
          <div className="mt-10 pt-6 border-t border-slate-300 grid grid-cols-2 gap-8 text-xs">
            <div className="text-center">
              <div>Mengetahui & Menyetujui,</div>
              <div className="font-semibold text-slate-800">Calon Murid Baru</div>
              <div className="h-20 flex items-center justify-center">
                <span className="text-[11px] text-slate-400 italic">(Tanda Tangan)</span>
              </div>
              <div className="font-bold text-slate-900 border-b border-slate-400 inline-block px-8 pb-1">
                ( {studentSafeName} )
              </div>
            </div>

            <div className="text-center">
              <div>{citySafe}, {todayStr}</div>
              <div className="font-semibold text-slate-800">Orang Tua / Wali Pemohon</div>
              <div className="h-20 flex items-center justify-center">
                <div className="w-28 h-12 border border-dashed border-slate-500 bg-slate-50 flex flex-col items-center justify-center rounded text-[8.5px] font-bold text-slate-600 uppercase tracking-tight">
                  <span>MATERAI</span>
                  <span className="text-[7.5px] text-slate-500 font-normal">Rp 10.000</span>
                  <span className="text-[7px] text-slate-400 italic">(Tanda Tangan Kena Materai)</span>
                </div>
              </div>
              <div className="font-bold text-slate-900 border-b border-slate-400 inline-block px-8 pb-1">
                ( {applicantParentName} )
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="mt-8 pt-4 border-t border-dashed border-slate-300 text-[10px] text-slate-500 text-center">
            * Lembar surat permohonan dispensasi ini dibuat secara otomatis melalui Sistem Informasi Penerimaan Murid Madrasah (SIPMA). Harap dibubuhi Materai Rp 10.000 dan ditandatangani oleh orang tua/wali serta calon murid sebelum diunggah pada formulir pendaftaran.
          </div>
        </div>

      </div>
    </div>
  );
};
