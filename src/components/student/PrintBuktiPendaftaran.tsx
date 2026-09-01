import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Printer,
  Download,
  ArrowLeft,
  CheckCircle,
  School as SchoolIcon,
  ShieldCheck,
  FileDown,
  Copy,
  Check,
  ExternalLink,
  Info,
} from 'lucide-react';
import { Application, StudentProfile, ParentData, SchoolOrigin, AddressData, School } from '../../types/sipma';
import { formatDistanceIndonesian, formatCoordinates } from '../../utils/geo';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { storageService } from '../../services/storageService';

interface Props {
  application?: Partial<Application> | null;
  student?: Partial<StudentProfile> | null;
  parent?: Partial<ParentData> | null;
  schoolOrigin?: Partial<SchoolOrigin> | null;
  address?: Partial<AddressData> | null;
  school?: Partial<School> | null;
  onBack: () => void;
}

export const PrintBuktiPendaftaran: React.FC<Props> = ({
  application,
  student,
  parent,
  schoolOrigin,
  address,
  school,
  onBack,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [printAlert, setPrintAlert] = useState<string | null>(null);
  const printableRef = useRef<HTMLDivElement>(null);

  // Safe Guarded Fallbacks
  const settings = storageService.getSettings();
  const academicYearSafe =
    settings?.academic_year_label ||
    (application?.admission_year ? `${application.admission_year}/${parseInt(application.admission_year, 10) + 1}` : '2027/2028');
  const regNumberSafe = application?.registration_number || student?.registration_number || `REG-SIPMA-${settings.application_year || '2027'}`;
  const studentNameSafe = student?.name || 'Calon Siswa SIPMA';
  const studentNikSafe = student?.nik || '-';
  const studentNisnSafe = student?.nisn || '-';
  const studentBirthPlaceSafe = student?.birth_place || '-';
  const studentBirthDateSafe = student?.birth_date || '-';
  const studentGenderSafe = student?.gender === 'L' ? 'Laki-laki' : student?.gender === 'P' ? 'Perempuan' : '-';
  const studentReligionSafe = student?.religion || 'Islam';
  const studentKkSafe = student?.family_card_number || '-';
  const studentPhoneSafe = student?.phone || '-';
  const studentEmailSafe = student?.email || '-';

  const hasSchool = Boolean(application?.school_id);
  const schoolNameSafe = hasSchool ? (school?.school_name || 'Madrasah Pilihan SIPMA') : '- (Belum Memilih Madrasah)';
  const schoolAddressSafe = hasSchool ? (school?.address || '-') : '-';
  const schoolPhoneSafe = hasSchool ? (school?.contact_phone || '-') : '-';
  const schoolEmailSafe = hasSchool ? (school?.contact_email || '-') : '-';
  const schoolNsmSafe = hasSchool ? (school?.nsm || '-') : '-';
  const schoolNpsnSafe = hasSchool ? (school?.npsn || '-') : '-';
  const schoolPrincipalSafe = hasSchool ? (school?.principal_name || 'Kepala Madrasah') : 'Kepala Madrasah';

  const pathwaySafe = application?.pathway || 'zonasi';
  const pathwayUpper = pathwaySafe.toUpperCase();
  const distanceKmSafe = application?.distance_km ?? 0;
  const maxDistanceKmSafe = application?.max_distance_km ?? school?.zoning_radius_km ?? 5.0;
  const zoningStatusSafe = application?.zoning_status === 'memenuhi' ? 'MEMENUHI ZONASI' : 'MELEBIHI BATAS ZONASI';

  const originSchoolNameSafe =
    schoolOrigin?.previous_level === 'Belum Pernah Sekolah'
      ? 'Belum Pernah Sekolah'
      : schoolOrigin?.school_name || 'Madrasah / Sekolah Asal';
  const originNpsnSafe = schoolOrigin?.previous_level === 'Belum Pernah Sekolah' ? '-' : (schoolOrigin?.npsn_nsm || '-');
  const originAddressSafe = schoolOrigin?.school_address || '-';
  const originGradYearSafe = schoolOrigin?.graduation_year || '-';

  const fatherNameSafe = parent?.father_name || '-';
  const fatherJobSafe = parent?.father_job || '-';
  const motherNameSafe = parent?.mother_name || '-';
  const motherJobSafe = parent?.mother_job || '-';

  const fullAddressSafe = address?.street_address
    ? `${address.street_address}${address.rt ? `, RT ${address.rt}` : ''}${address.rw ? `/RW ${address.rw}` : ''}${address.village ? `, Kel. ${address.village}` : ''}${address.district ? `, Kec. ${address.district}` : ''}${address.city ? `, ${address.city}` : ''}${address.province ? `, ${address.province}` : ''}`
    : '-';

  const finalStatusSafe =
    application?.final_status === 'lulus'
      ? 'LULUS SELEKSI'
      : application?.final_status === 'tidak_lulus'
      ? 'TIDAK LULUS'
      : application?.final_status === 'terverifikasi'
      ? 'BERKAS TERVERIFIKASI'
      : application?.final_status === 'perlu_perbaikan'
      ? 'PERLU PERBAIKAN'
      : application?.final_status === 'submitted'
      ? 'MENUNGGU VERIFIKASI'
      : 'DRAF PENDAFTARAN';

  const todayStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Generate QR Code with safety
  useEffect(() => {
    try {
      const qrPayload = JSON.stringify({
        app: 'SIPMA-PPDB',
        regNumber: regNumberSafe,
        name: studentNameSafe,
        school: schoolNameSafe,
        pathway: pathwaySafe,
        distance: `${distanceKmSafe.toFixed(2)} km`,
        status: finalStatusSafe,
        generated: new Date().toISOString(),
      });

      QRCode.toDataURL(qrPayload, {
        width: 150,
        margin: 1,
        color: {
          dark: '#064e3b',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => {
          console.warn('QR fallback:', err);
        });
    } catch (e) {
      console.warn('QR Exception:', e);
    }
  }, [regNumberSafe, studentNameSafe, schoolNameSafe, pathwaySafe, distanceKmSafe, finalStatusSafe]);

  // Method 1: Standard Window Print with graceful fallback
  const handlePrint = () => {
    try {
      window.print();
    } catch (err) {
      console.error('Direct window.print() failed:', err);
      handlePrintDedicatedWindow();
    }
  };

  // Dedicated Window Print fallback if direct print fails
  const handlePrintDedicatedWindow = () => {
    const htmlContent = generatePrintableHtml();
    const printWindow = window.open('', '_blank', 'width=850,height=900');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    } else {
      setPrintAlert(
        'Pop-up cetak diblokir browser. Silakan izinkan pop-up atau gunakan tombol "Unduh Word (.doc)" untuk mencetak dokumen.'
      );
      setTimeout(() => setPrintAlert(null), 6000);
    }
  };

  // Method 2: Download Microsoft Word (.doc)
  const handleDownloadWordDoc = () => {
    const docContent = `
<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8">
  <title>Bukti Pendaftaran - ${regNumberSafe}</title>
  <style>
    @page Section1 { size: 595.3pt 841.9pt; margin: 2.0cm 2.0cm 2.0cm 2.0cm; }
    div.Section1 { page: Section1; font-family: Arial, sans-serif; font-size: 10pt; line-height: 1.3; }
    h1 { font-size: 14pt; margin: 0; text-align: center; }
    h2 { font-size: 12pt; margin: 4px 0; text-align: center; text-decoration: underline; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 8px; }
    td { padding: 4px; vertical-align: top; font-size: 9.5pt; }
    .header-table td { border: none; padding: 2px; }
    .data-table td { border-bottom: 1px solid #ddd; padding: 5px; }
    .section-title { font-weight: bold; font-size: 10pt; background-color: #f0fdf4; padding: 4px 8px; border-left: 4px solid #16a34a; margin-top: 10px; }
    .stamp { border: 2px solid #16a34a; color: #16a34a; font-weight: bold; padding: 6px 12px; display: inline-block; font-size: 9pt; }
  </style>
</head>
<body>
<div class="Section1">
  <table class="header-table" style="border-bottom: 3px double #000; padding-bottom: 8px; margin-bottom: 12px;">
    <tr>
      <td style="text-align: center;">
        <div style="font-size: 9pt; font-weight: bold; color: #047857; letter-spacing: 1px;">PANITIA PENERIMAAN MURID BARU (PPDB) MADRASAH</div>
        <h1 style="font-size: 15pt; font-weight: bold; margin-top: 2px;">${schoolNameSafe.toUpperCase()}</h1>
        <div style="font-size: 8.5pt; color: #555;">${schoolAddressSafe} | Telp: ${schoolPhoneSafe} | Email: ${schoolEmailSafe}</div>
        <div style="font-size: 8pt; color: #666; font-family: monospace;">NSM: ${schoolNsmSafe} | NPSN: ${schoolNpsnSafe}</div>
      </td>
    </tr>
  </table>

  <h2>BUKTI PENDAFTARAN RESMI PENERIMAAN MURID BARU</h2>
  <div style="text-align: center; font-size: 9pt; color: #555; margin-bottom: 14px;">TAHUN AJARAN ${academicYearSafe} • DIVERIFIKASI RESMI SISTEM SIPMA</div>

  <table style="background-color: #ecfdf5; border: 1px solid #a7f3d0; margin-bottom: 12px;">
    <tr>
      <td style="width: 33%;">
        <div style="font-size: 8pt; color: #065f46; font-weight: bold;">NOMOR PENDAFTARAN:</div>
        <div style="font-size: 12pt; font-weight: bold; font-family: monospace; color: #065f46;">${regNumberSafe}</div>
      </td>
      <td style="width: 33%;">
        <div style="font-size: 8pt; color: #065f46; font-weight: bold;">JALUR PENERIMAAN:</div>
        <div style="font-size: 11pt; font-weight: bold; color: #0f172a;">Jalur ${pathwaySafe.toUpperCase()}</div>
      </td>
      <td style="width: 33%;">
        <div style="font-size: 8pt; color: #065f46; font-weight: bold;">STATUS HASIL:</div>
        <div style="font-size: 11pt; font-weight: bold; color: #047857;">${finalStatusSafe}</div>
      </td>
    </tr>
  </table>

  <div class="section-title">A. DATA PRIBADI CALON MURID</div>
  <table class="data-table">
    <tr><td style="width: 30%; font-weight: bold;">Nama Lengkap</td><td>: <strong>${studentNameSafe}</strong></td></tr>
    <tr><td style="font-weight: bold;">NIK / NISN</td><td>: ${studentNikSafe} / ${studentNisnSafe}</td></tr>
    <tr><td style="font-weight: bold;">Tempat, Tanggal Lahir</td><td>: ${studentBirthPlaceSafe}, ${studentBirthDateSafe}</td></tr>
    <tr><td style="font-weight: bold;">Jenis Kelamin / Agama</td><td>: ${studentGenderSafe} / ${studentReligionSafe}</td></tr>
    <tr><td style="font-weight: bold;">No. Kartu Keluarga (KK)</td><td>: ${studentKkSafe}</td></tr>
    <tr><td style="font-weight: bold;">No. WhatsApp / Email</td><td>: ${studentPhoneSafe} / ${studentEmailSafe}</td></tr>
  </table>

  <div class="section-title">B. SEKOLAH ASAL & ORANG TUA</div>
  <table class="data-table">
    <tr><td style="width: 30%; font-weight: bold;">Sekolah / Madrasah Asal</td><td>: ${originSchoolNameSafe} (NPSN: ${originNpsnSafe})</td></tr>
    <tr><td style="font-weight: bold;">Nama Ayah / Pekerjaan</td><td>: ${fatherNameSafe} / ${fatherJobSafe}</td></tr>
    <tr><td style="font-weight: bold;">Nama Ibu / Pekerjaan</td><td>: ${motherNameSafe} / ${motherJobSafe}</td></tr>
  </table>

  <div class="section-title">C. ALAMAT DOMISILI & SISTEM ZONASI</div>
  <table class="data-table">
    <tr><td style="width: 30%; font-weight: bold;">Alamat Lengkap</td><td>: ${fullAddressSafe}</td></tr>
    <tr><td style="font-weight: bold;">Jarak ke Madrasah</td><td>: <strong>${formatDistanceIndonesian(distanceKmSafe)}</strong> (Maks. Zonasi: ${maxDistanceKmSafe} km - ${zoningStatusSafe})</td></tr>
  </table>

  <table style="margin-top: 30px; border: none;">
    <tr>
      <td style="width: 50%; text-align: center; border: none;">
        <div>Mengetahui,</div>
        <div style="font-weight: bold;">Orang Tua / Wali Calon Murid</div>
        <div style="height: 60px;"></div>
        <div>( ${fatherNameSafe !== '-' ? fatherNameSafe : motherNameSafe !== '-' ? motherNameSafe : '...........................................'} )</div>
      </td>
      <td style="width: 50%; text-align: center; border: none;">
        <div>Ditetapkan di ${school?.address ? school.address.split(',')[0] : 'Madrasah'}, ${todayStr}</div>
        <div style="font-weight: bold;">Panitia PPDB ${schoolNameSafe}</div>
        <div style="height: 15px;"></div>
        <div class="stamp">✓ TERVERIFIKASI SIPMA</div>
        <div style="height: 15px;"></div>
        <div>( ${schoolPrincipalSafe} )</div>
      </td>
    </tr>
  </table>

  <div style="margin-top: 20px; font-size: 8pt; color: #777; text-align: center; border-top: 1px dashed #ccc; padding-top: 8px;">
    * Dokumen ini sah dan dicetak otomatis melalui Sistem Penerimaan Murid Baru Madrasah (SIPMA).
  </div>
</div>
</body>
</html>
    `;

    const blob = new Blob([docContent], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bukti_Pendaftaran_${regNumberSafe}_${studentNameSafe.replace(/\s+/g, '_')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Method 5: Copy Summary text
  const handleCopySummary = () => {
    const summary = `=== BUKTI PENDAFTARAN PPDB MADRASAH (SIPMA) ===
No. Pendaftaran: ${regNumberSafe}
Nama Calon Siswa: ${studentNameSafe}
NIK: ${studentNikSafe} | NISN: ${studentNisnSafe}
Madrasah Pilihan: ${schoolNameSafe}
Jalur Pendaftaran: Jalur ${pathwayUpper}
Jarak ke Madrasah: ${formatDistanceIndonesian(distanceKmSafe)} (${zoningStatusSafe})
Asal Sekolah: ${originSchoolNameSafe}
Orang Tua: ${fatherNameSafe} / ${motherNameSafe}
Alamat: ${fullAddressSafe}
Status Hasil: ${finalStatusSafe}
Waktu Cetak: ${todayStr}`;

    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Helper to generate full self-contained styled HTML for print/download
  const generatePrintableHtml = (): string => {
    const studentPhoto = student?.photo_url ? normalizeImageUrl(student.photo_url) : '';
    const schoolLogo = school?.logo_url ? normalizeImageUrl(school.logo_url) : '';

    const photoTag = studentPhoto
      ? `<img src="${studentPhoto}" style="width: 120px; height: 160px; object-fit: cover; border-radius: 6px; border: 1px solid #cbd5e1;" />`
      : `<div style="width: 120px; height: 160px; border: 1px dashed #cbd5e1; border-radius: 6px; display: flex; align-items: center; justify-content: center; background: #f8fafc; font-size: 11px; color: #94a3b8; text-align: center;">Pas Foto<br>3 x 4 cm</div>`;

    const logoTag = schoolLogo
      ? `<img src="${schoolLogo}" style="width: 60px; height: 60px; object-fit: contain; border-radius: 8px;" />`
      : `<div style="width: 60px; height: 60px; background: #047857; color: white; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 22px;">M</div>`;

    const qrTag = qrDataUrl
      ? `<img src="${qrDataUrl}" style="width: 100px; height: 100px; object-fit: contain;" />`
      : '';

    return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Bukti Pendaftaran - ${regNumberSafe}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm 12mm 10mm 12mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #0f172a; margin: 0; padding: 20px; font-size: 12px; background: #fff; }
    .sheet { max-width: 800px; margin: 0 auto; background: #fff; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px double #1e293b; padding-bottom: 12px; margin-bottom: 16px; }
    .header-text { text-align: center; flex: 1; padding: 0 12px; }
    .header-text h1 { font-size: 18px; margin: 4px 0; text-transform: uppercase; font-weight: 800; }
    .header-text .subtitle { font-size: 10px; font-weight: bold; color: #047857; letter-spacing: 1.5px; }
    .header-text p { font-size: 10.5px; color: #475569; margin: 2px 0; }
    .title-box { text-align: center; margin: 14px 0 16px; }
    .title-box h2 { font-size: 14px; text-decoration: underline; margin: 0; font-weight: 800; letter-spacing: 0.5px; }
    .highlight-card { display: flex; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 10px 16px; justify-content: space-between; margin-bottom: 16px; }
    .highlight-card .item { flex: 1; }
    .highlight-card .item .label { font-size: 9px; font-weight: bold; color: #065f46; text-transform: uppercase; }
    .highlight-card .item .val { font-size: 13px; font-weight: 800; color: #064e3b; margin-top: 2px; }
    .content-grid { display: flex; gap: 20px; margin-bottom: 20px; }
    .photo-col { width: 130px; display: flex; flex-direction: column; align-items: center; gap: 12px; shrink: 0; }
    .data-col { flex: 1; }
    .section-title { font-size: 11px; font-weight: 800; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 4px; margin: 10px 0 6px; color: #1e293b; }
    table.data-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 6px; }
    table.data-table td { padding: 4px 0; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    table.data-table td.label-cell { width: 140px; font-weight: 600; color: #475569; }
    table.data-table td.val-cell { color: #0f172a; font-weight: 500; }
    .signatures { display: flex; justify-content: space-between; margin-top: 30px; padding-top: 16px; border-top: 1px solid #cbd5e1; }
    .sig-block { width: 45%; text-align: center; }
    .stamp { border: 1.5px solid #059669; color: #059669; font-size: 10px; font-weight: bold; padding: 4px 8px; border-radius: 4px; display: inline-block; margin: 8px 0; transform: rotate(-3deg); }
    .footer-note { margin-top: 16px; padding-top: 8px; border-top: 1px dashed #cbd5e1; font-size: 9px; color: #64748b; text-align: center; }
    @media print {
      body { padding: 0; }
      .sheet { border: none; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div style="width: 70px; text-align: center;">
        ${logoTag}
      </div>
      <div class="header-text">
        <div class="subtitle">PANITIA PENERIMAAN MURID BARU (PPDB)</div>
        <h1>${schoolNameSafe}</h1>
        <p>${schoolAddressSafe} | Telp: ${schoolPhoneSafe} | Email: ${schoolEmailSafe}</p>
        <p style="font-family: monospace; font-size: 9.5px;">NSM: ${schoolNsmSafe} | NPSN: ${schoolNpsnSafe}</p>
      </div>
      <div style="width: 70px;"></div>
    </div>

    <div class="title-box">
      <h2>BUKTI PENDAFTARAN RESMI PENERIMAAN MURID BARU (PPDB)</h2>
      <div style="font-size: 10px; font-weight: 600; color: #475569; margin-top: 2px;">TAHUN AJARAN ${academicYearSafe} • SISTEM INFORMASI MADRASAH (SIPMA)</div>
    </div>

    <div class="highlight-card">
      <div class="item">
        <div class="label">Nomor Pendaftaran</div>
        <div class="val" style="font-family: monospace;">${regNumberSafe}</div>
      </div>
      <div class="item">
        <div class="label">Jalur Pendaftaran</div>
        <div class="val">Jalur ${pathwayUpper}</div>
      </div>
      <div class="item">
        <div class="label">Status Verifikasi / Kelulusan</div>
        <div class="val">${finalStatusSafe}</div>
      </div>
    </div>

    <div class="content-grid">
      <div class="photo-col">
        ${photoTag}
        <div style="font-size: 9px; color: #64748b; text-align: center; font-family: monospace;">
          ID: ${regNumberSafe.split('-').pop() || 'SIPMA'}
        </div>
      </div>

      <div class="data-col">
        <div class="section-title">A. DATA PRIBADI CALON MURID</div>
        <table class="data-table">
          <tr><td class="label-cell">Nama Lengkap</td><td class="val-cell">: <strong>${studentNameSafe}</strong></td></tr>
          <tr><td class="label-cell">NIK / NISN</td><td class="val-cell">: ${studentNikSafe} / ${studentNisnSafe}</td></tr>
          <tr><td class="label-cell">Tempat, Tgl Lahir</td><td class="val-cell">: ${studentBirthPlaceSafe}, ${studentBirthDateSafe}</td></tr>
          <tr><td class="label-cell">Jenis Kelamin / Agama</td><td class="val-cell">: ${studentGenderSafe} / ${studentReligionSafe}</td></tr>
          <tr><td class="label-cell">No. Kartu Keluarga</td><td class="val-cell">: ${studentKkSafe}</td></tr>
          <tr><td class="label-cell">No. WhatsApp / Email</td><td class="val-cell">: ${studentPhoneSafe} / ${studentEmailSafe}</td></tr>
        </table>

        <div class="section-title">B. SEKOLAH ASAL & ORANG TUA</div>
        <table class="data-table">
          <tr><td class="label-cell">Madrasah / Sekolah Asal</td><td class="val-cell">: <strong>${originSchoolNameSafe}</strong> (NPSN: ${originNpsnSafe})</td></tr>
          <tr><td class="label-cell">Nama Ayah / Pekerjaan</td><td class="val-cell">: ${fatherNameSafe} / ${fatherJobSafe}</td></tr>
          <tr><td class="label-cell">Nama Ibu / Pekerjaan</td><td class="val-cell">: ${motherNameSafe} / ${motherJobSafe}</td></tr>
        </table>

        <div class="section-title">C. ALAMAT DOMISILI & SISTEM ZONASI</div>
        <table class="data-table">
          <tr><td class="label-cell">Alamat Tinggal</td><td class="val-cell">: ${fullAddressSafe}</td></tr>
          <tr><td class="label-cell">Jarak ke Madrasah</td><td class="val-cell">: <strong style="color: #047857;">${formatDistanceIndonesian(distanceKmSafe)}</strong> (Batas Radius Zonasi: ${maxDistanceKmSafe} km - ${zoningStatusSafe})</td></tr>
        </table>
      </div>
    </div>

    <div class="signatures">
      <div class="sig-block">
        <div>Mengetahui,</div>
        <div style="font-weight: bold;">Orang Tua / Wali Calon Murid</div>
        <div style="height: 55px;"></div>
        <div style="font-weight: bold; border-bottom: 1px solid #475569; display: inline-block; min-width: 180px;">
          ( ${fatherNameSafe !== '-' ? fatherNameSafe : motherNameSafe !== '-' ? motherNameSafe : '...........................................'} )
        </div>
      </div>

      <div class="sig-block">
        <div>Ditetapkan pada: ${todayStr}</div>
        <div style="font-weight: bold;">Panitia PPDB ${schoolNameSafe}</div>
        <div class="stamp">✓ DIVERIFIKASI RESMI SIPMA</div>
        <div style="height: 10px;"></div>
        <div style="font-weight: bold; border-bottom: 1px solid #475569; display: inline-block; min-width: 180px;">
          ( ${schoolPrincipalSafe} )
        </div>
      </div>
    </div>

    <div class="footer-note">
      * Lembar bukti pendaftaran ini dicetak otomatis dari Sistem Informasi Penerimaan Murid Madrasah (SIPMA). Harap disimpan dengan baik dan dibawa saat daftar ulang fisik.
    </div>
  </div>
</body>
</html>`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5" id="sipma-print-view">
      {/* Alert if popup was blocked */}
      {printAlert && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2 animate-in fade-in">
          <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium leading-relaxed">{printAlert}</div>
        </div>
      )}

      {/* Top Action Bar (Completely hidden in @media print) */}
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {/* Copy Summary Text */}
          <button
            type="button"
            onClick={handleCopySummary}
            title="Salin ringkasan data bukti pendaftaran"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Tersalin!' : 'Salin Teks'}</span>
          </button>

          {/* Download Word Document */}
          <button
            type="button"
            onClick={handleDownloadWordDoc}
            title="Unduh format Microsoft Word (.doc) untuk dicetak / diedit"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5 text-blue-400" />
            <span>Unduh Word (.doc)</span>
          </button>

          {/* Primary Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            title="Cetak langsung ke printer atau Simpan sebagai PDF (A4)"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Bukti Pendaftaran (A4 / PDF)</span>
          </button>
        </div>
      </div>

      {/* Official Printable Sheet (A4 format) */}
      <div
        ref={printableRef}
        id="sipma-print-sheet"
        className="bg-white p-8 sm:p-12 rounded-2xl border border-slate-300 shadow-md text-slate-900 print:border-none print:shadow-none print:p-0 print:m-0 print:rounded-none"
      >
        {/* Kop Surat Resmi Madrasah */}
        <div className="flex items-center justify-between border-b-4 border-double border-slate-800 pb-5 mb-6">
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
            <div className="text-[11px] uppercase font-bold tracking-widest text-emerald-800">
              PANITIA PENERIMAAN MURID BARU (PPDB)
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
              {schoolNameSafe}
            </h1>
            <p className="text-xs text-slate-600 mt-1 max-w-xl mx-auto">
              {schoolAddressSafe} | Telp: {schoolPhoneSafe} | Email: {schoolEmailSafe}
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
            BUKTI PENDAFTARAN RESMI PENERIMAAN MURID BARU (PPDB)
          </h2>
          <div className="text-xs font-semibold text-slate-600 mt-1">
            TAHUN AJARAN {academicYearSafe} • SISTEM INFORMASI MADRASAH (SIPMA)
          </div>
        </div>

        {/* Highlight Card: No Pendaftaran & Jalur */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl mb-6">
          <div>
            <div className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider">Nomor Pendaftaran</div>
            <div className="text-lg font-mono font-black text-emerald-800 tracking-wider mt-0.5">
              {regNumberSafe}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider">Jalur Penerimaan</div>
            <div className="text-base font-bold text-slate-900 capitalize mt-0.5 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
              Jalur {pathwaySafe}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider">Status Saat Ini</div>
            <div className="text-sm font-bold text-emerald-800 uppercase mt-0.5">
              {finalStatusSafe}
            </div>
          </div>
        </div>

        {/* Main Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
          {/* Student Photo & QR */}
          <div className="sm:col-span-1 flex flex-col items-center space-y-4">
            <div className="w-36 h-48 border-2 border-slate-300 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center shadow-xs">
              {student?.photo_url ? (
                <img
                  src={normalizeImageUrl(student.photo_url)}
                  alt={studentNameSafe}
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

          {/* Student Data Fields */}
          <div className="sm:col-span-3 space-y-4 text-xs">
            {/* Section A */}
            <div>
              <h3 className="font-bold text-slate-800 text-sm border-b pb-1 mb-2">
                A. DATA PRIBADI CALON MURID
              </h3>
              <table className="w-full">
                <tbody>
                  <tr className="border-b border-slate-100">
                    <td className="py-1.5 w-40 font-semibold text-slate-600">Nama Lengkap</td>
                    <td className="py-1.5 font-bold text-slate-900">: {studentNameSafe}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1.5 font-semibold text-slate-600">NIK / NISN</td>
                    <td className="py-1.5">: {studentNikSafe} / {studentNisnSafe}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1.5 font-semibold text-slate-600">Tempat, Tanggal Lahir</td>
                    <td className="py-1.5">: {studentBirthPlaceSafe}, {studentBirthDateSafe}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1.5 font-semibold text-slate-600">Jenis Kelamin / Agama</td>
                    <td className="py-1.5">: {studentGenderSafe} / {studentReligionSafe}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1.5 font-semibold text-slate-600">No. Kartu Keluarga (KK)</td>
                    <td className="py-1.5">: {studentKkSafe}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1.5 font-semibold text-slate-600">No. WhatsApp / Email</td>
                    <td className="py-1.5">: {studentPhoneSafe} / {studentEmailSafe}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section B */}
            <div>
              <h3 className="font-bold text-slate-800 text-sm border-b pb-1 mb-2">
                B. SEKOLAH ASAL & ORANG TUA
              </h3>
              <table className="w-full">
                <tbody>
                  <tr className="border-b border-slate-100">
                    <td className="py-1.5 w-40 font-semibold text-slate-600">Madrasah / Sekolah Asal</td>
                    <td className="py-1.5 font-bold text-slate-900">: {originSchoolNameSafe} (NPSN: {originNpsnSafe})</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1.5 font-semibold text-slate-600">Nama Ayah / Pekerjaan</td>
                    <td className="py-1.5">: {fatherNameSafe} / {fatherJobSafe}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1.5 font-semibold text-slate-600">Nama Ibu / Pekerjaan</td>
                    <td className="py-1.5">: {motherNameSafe} / {motherJobSafe}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section C */}
            <div>
              <h3 className="font-bold text-slate-800 text-sm border-b pb-1 mb-2">
                C. ALAMAT TINGGAL & SISTEM ZONASI
              </h3>
              <table className="w-full">
                <tbody>
                  <tr className="border-b border-slate-100">
                    <td className="py-1.5 w-40 font-semibold text-slate-600">Alamat Lengkap Domisili</td>
                    <td className="py-1.5">: {fullAddressSafe}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1.5 font-semibold text-slate-600">Titik Koordinat Rumah</td>
                    <td className="py-1.5 font-mono">: {formatCoordinates(application?.latitude, application?.longitude)}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1.5 font-semibold text-slate-600">Jarak ke Madrasah</td>
                    <td className="py-1.5 font-bold text-emerald-800">
                      : {formatDistanceIndonesian(distanceKmSafe)} (Maks. Zonasi {maxDistanceKmSafe} km - {zoningStatusSafe})
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section D: Khusus Jalur Prestasi / Mutasi */}
            {application?.pathway === 'prestasi' && (
              <div>
                <h3 className="font-bold text-amber-900 text-sm border-b border-amber-200 pb-1 mb-2">
                  D. KETERANGAN PRESTASI & PENGHARGAAN
                </h3>
                <table className="w-full">
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 w-40 font-semibold text-slate-600">Kategori & Tingkat</td>
                      <td className="py-1.5 font-bold text-slate-900">: {application.achievement_type?.toUpperCase()} (Tingkat {application.achievement_level?.toUpperCase() || '-'})</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 font-semibold text-slate-600">Nama Prestasi/Kejuaraan</td>
                      <td className="py-1.5">: {application.achievement_name || '-'}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 font-semibold text-slate-600">Peringkat / Capaian</td>
                      <td className="py-1.5 font-bold text-amber-800">: {application.achievement_rank || '-'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {application?.pathway === 'mutasi' && (
              <div>
                <h3 className="font-bold text-blue-900 text-sm border-b border-blue-200 pb-1 mb-2">
                  D. KETERANGAN PERPINDAHAN TUGAS ORANG TUA (MUTASI)
                </h3>
                <table className="w-full">
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 w-40 font-semibold text-slate-600">Instansi / Kantor Ortu</td>
                      <td className="py-1.5 font-bold text-slate-900">: {application.mutation_parent_instansi || '-'}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 font-semibold text-slate-600">Nomor SK / Surat Tugas</td>
                      <td className="py-1.5 font-mono">: {application.mutation_letter_number || '-'}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 font-semibold text-slate-600">Tanggal SK / Mulai Tugas</td>
                      <td className="py-1.5">: {application.mutation_letter_date || '-'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Tanda Tangan & Pernyataan */}
        <div className="mt-10 pt-6 border-t border-slate-300 grid grid-cols-2 gap-8 text-xs">
          <div className="text-center">
            <div>Mengetahui,</div>
            <div className="font-semibold text-slate-800">Orang Tua / Wali Calon Murid</div>
            <div className="h-20"></div>
            <div className="font-bold text-slate-900 border-b border-slate-400 inline-block px-8 pb-1">
              ( {fatherNameSafe !== '-' ? fatherNameSafe : motherNameSafe !== '-' ? motherNameSafe : '...........................................'} )
            </div>
          </div>

          <div className="text-center">
            <div>{school?.address ? school.address.split(',')[0] : 'Madrasah'}, {todayStr}</div>
            <div className="font-semibold text-slate-800">Panitia PPDB {schoolNameSafe}</div>
            <div className="h-20 flex items-center justify-center">
              <div className="border border-emerald-600 text-emerald-800 text-[10px] font-bold px-3 py-1 rounded-sm uppercase tracking-wider rotate-[-5deg]">
                ✓ DIVERIFIKASI DIGITAL SIPMA
              </div>
            </div>
            <div className="font-bold text-slate-900 border-b border-slate-400 inline-block px-8 pb-1">
              ( {schoolPrincipalSafe} )
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-8 pt-4 border-t border-dashed border-slate-300 text-[10px] text-slate-500 text-center">
          * Lembar bukti pendaftaran ini dicetak otomatis dari Sistem Informasi Penerimaan Murid Madrasah (SIPMA). Harap disimpan sebagai bukti pendaftaran resmi dan dibawa saat verifikasi berkas fisik jika diminta panitia.
        </div>
      </div>
    </div>
  );
};
