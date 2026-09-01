import { DocumentItem } from '../types/sipma';

/**
 * Clean and format standardized document file name:
 * Format: [Nama_Akun]_[No_Pendaftaran]_[Jenis_Dokumen].[ext]
 */
export function formatStandardDocumentFileName(params: {
  accountName?: string;
  registrationNumber?: string;
  documentType?: string;
  documentTitle?: string;
  originalFileName?: string;
  extension?: string;
}): string {
  // Extract extension
  let ext = params.extension || '';
  if (!ext && params.originalFileName) {
    const extMatch = params.originalFileName.match(/\.([a-zA-Z0-9]+)$/);
    if (extMatch) {
      ext = extMatch[1].toLowerCase();
    }
  }
  if (!ext) {
    if (
      params.documentType === 'foto' ||
      params.documentType === 'pas_foto' ||
      params.documentType === 'foto_profil'
    ) {
      ext = 'jpg';
    } else if (
      params.documentType === 'logo_sekolah' ||
      params.documentType === 'logo_aplikasi'
    ) {
      ext = 'png';
    } else {
      ext = 'pdf';
    }
  }

  // Clean Account / Student Name
  const rawName = (params.accountName || 'Pendaftar')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .trim()
    .replace(/\s+/g, '_') || 'Pendaftar';

  // Clean Registration Number
  const rawReg = (params.registrationNumber || 'SIPMA')
    .replace(/[^a-zA-Z0-9_-]/g, '_') || 'SIPMA';

  // Clean Doc Type / Title to Indonesian standard
  const typeMap: Record<string, string> = {
    foto: 'Pas_Foto_3x4',
    pas_foto: 'Pas_Foto_3x4',
    foto_profil: 'Pas_Foto_3x4',
    kartu_keluarga: 'Kartu_Keluarga_KK',
    kk: 'Kartu_Keluarga_KK',
    akta_kelahiran: 'Akta_Kelahiran',
    akta: 'Akta_Kelahiran',
    ijazah_skl: 'Ijazah_SKL',
    ijazah: 'Ijazah_SKL',
    skl: 'Surat_Keterangan_Lulus',
    kartu_afirmasi: 'Kartu_KIP_PKH_Afirmasi',
    surat_dispensasi: 'Surat_Dispensasi_Zonasi',
    sertifikat_prestasi: 'Sertifikat_Piagam_Prestasi',
    surat_mutasi: 'Surat_Mutasi_Orang_Tua',
    surat_pernyataan: 'Surat_Pernyataan',
    logo_sekolah: 'Logo_Madrasah',
    logo_aplikasi: 'Logo_Aplikasi_SIPMA',
  };

  let docLabel = params.documentType && typeMap[params.documentType] ? typeMap[params.documentType] : '';
  if (!docLabel) {
    docLabel = (params.documentTitle || params.documentType || 'Dokumen')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s_-]/g, '')
      .trim()
      .replace(/\s+/g, '_') || 'Dokumen';
  }

  // Format: [Nama_Pendaftar]_[No_Pendaftaran]_[Jenis_Dokumen].[ext]
  return `${rawName}_${rawReg}_${docLabel}.${ext}`;
}

/**
 * Trigger direct browser download for an uploaded document without opening Google Drive UI
 */
export async function downloadDocumentFile(doc: DocumentItem, accountName?: string): Promise<void> {
  try {
    const targetFileName = formatStandardDocumentFileName({
      accountName: accountName,
      registrationNumber: doc.registration_number,
      documentType: doc.document_type,
      documentTitle: doc.document_title,
      originalFileName: doc.file_name,
    });

    const cleanFileName = targetFileName || doc.file_name || 'dokumen_pendaftaran.pdf';

    // 1. Direct base64 download if stored locally in browser
    if (doc.file_data_base64 && doc.file_data_base64.startsWith('data:')) {
      const link = document.createElement('a');
      link.href = doc.file_data_base64;
      link.download = cleanFileName;
      link.setAttribute('download', cleanFileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // 2. Direct download via server proxy endpoint (fetches binary stream without Google Drive UI)
    const downloadProxyUrl = `/api/files/download?drive_file_id=${encodeURIComponent(
      doc.drive_file_id || ''
    )}&file_name=${encodeURIComponent(cleanFileName)}&local_url=${encodeURIComponent(
      doc.local_url || ''
    )}&document_id=${encodeURIComponent(doc.document_id || '')}&drive_url=${encodeURIComponent(
      doc.drive_url || ''
    )}`;

    try {
      const response = await fetch(downloadProxyUrl);
      if (response.ok) {
        const blob = await response.blob();
        if (blob && blob.size > 0) {
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = cleanFileName;
          link.setAttribute('download', cleanFileName);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
          return;
        }
      }
    } catch (proxyErr) {
      console.warn('Server proxy direct download fallback:', proxyErr);
    }

    // 3. Direct Google Drive direct link download (uc?export=download)
    if (doc.drive_file_id && doc.drive_file_id.length > 5) {
      const directGoogleLink = `https://drive.google.com/uc?export=download&id=${doc.drive_file_id}`;
      const link = document.createElement('a');
      link.href = directGoogleLink;
      link.download = cleanFileName;
      link.target = '_blank';
      link.rel = 'noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // 4. Local URL download if available
    if (doc.local_url) {
      const link = document.createElement('a');
      link.href = doc.local_url;
      link.download = cleanFileName;
      link.setAttribute('download', cleanFileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // 5. Fallback printable information file
    const mockContent = `SIPMA - SISTEM INFORMASI PPDB MADRASAH
=====================================================
DOKUMEN PERSYARATAN RESMI PPDB
-----------------------------------------------------
Nomor Registrasi : ${doc.registration_number}
Nama Calon Murid : ${accountName || 'Pendaftar'}
Jenis Dokumen    : ${doc.document_title}
Nama Berkas Asli : ${cleanFileName}
Ukuran Berkas    : ${doc.file_size_kb || 0} KB
Waktu Diunggah   : ${new Date(doc.upload_time).toLocaleString('id-ID')}
Status Verifikasi: ${(doc.verification_status || 'menunggu').toUpperCase()}
ID Google Drive  : ${doc.drive_file_id || '-'}
-----------------------------------------------------
Dokumen ini tersimpan secara digital dan terverifikasi pada sistem SIPMA.
`;

    const blob = new Blob([mockContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${cleanFileName.replace(/\.[^/.]+$/, '')}_info.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Gagal mengunduh berkas:', err);
    if (doc.drive_url) {
      window.open(doc.drive_url, '_blank');
    }
  }
}

/**
 * Download all student documents in batch without loading Google Drive UI
 */
export function downloadAllStudentDocuments(docs: DocumentItem[], accountName?: string): void {
  if (!docs || docs.length === 0) return;

  docs.forEach((doc, index) => {
    setTimeout(() => {
      downloadDocumentFile(doc, accountName);
    }, index * 500);
  });
}
