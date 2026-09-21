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
  mimeType?: string;
}): string {
  // Extract extension
  let ext = (params.extension || '').replace(/^\./, '').toLowerCase();
  if (!ext && params.originalFileName) {
    const extMatch = params.originalFileName.match(/\.([a-zA-Z0-9]+)$/);
    if (extMatch) {
      ext = extMatch[1].toLowerCase();
    }
  }

  // Derive from mimeType if available
  if (!ext && params.mimeType) {
    if (params.mimeType.includes('jpeg') || params.mimeType.includes('jpg')) ext = 'jpg';
    else if (params.mimeType.includes('png')) ext = 'png';
    else if (params.mimeType.includes('webp')) ext = 'webp';
    else if (params.mimeType.includes('pdf')) ext = 'pdf';
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
 * Normalize document type strings to canonical standards:
 * Prevents duplicate rows when matching documents (e.g. 'kk' vs 'kartu_keluarga', 'pas_foto' vs 'foto').
 */
export function normalizeDocumentType(type: string): string {
  if (!type) return 'dokumen';
  const t = String(type).toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (t === 'kk' || t === 'kartu_keluarga') return 'kartu_keluarga';
  if (t === 'akta' || t === 'akta_kelahiran' || t === 'akta_lahir') return 'akta_kelahiran';
  if (t === 'ijazah' || t === 'skl' || t === 'ijazah_skl') return 'ijazah_skl';
  if (t === 'foto' || t === 'pas_foto' || t === 'foto_murid' || t === 'pas_foto_3x4') return 'foto';
  if (t === 'kip' || t === 'pkh' || t === 'kks' || t === 'kartu_afirmasi' || t === 'afirmasi') return 'kartu_afirmasi';
  if (t === 'dispensasi' || t === 'surat_dispensasi') return 'surat_dispensasi';
  if (t === 'prestasi' || t === 'sertifikat' || t === 'sertifikat_prestasi' || t === 'piagam') return 'sertifikat_prestasi';
  if (t === 'mutasi' || t === 'surat_mutasi' || t === 'penugasan') return 'surat_mutasi';
  if (t === 'avatar' || t === 'foto_profil') return 'foto_profil';
  if (t === 'logo_sekolah' || t === 'school_logo') return 'logo_sekolah';
  if (t === 'logo_aplikasi' || t === 'app_logo') return 'logo_aplikasi';
  return t;
}

/**
 * Generate a unique deduplication key for a document item
 */
export function getDocumentUniqueKey(doc: {
  registration_number?: string;
  document_type?: string;
  document_id?: string;
  school_id?: string;
  user_id?: string;
  account_id?: string;
}): string {
  if (!doc) return '';
  const normType = normalizeDocumentType(doc.document_type || '');
  const reg = String(doc.registration_number || '').trim();

  if (normType === 'logo_aplikasi') return 'logo_aplikasi';
  if (normType === 'logo_sekolah') return `logo_sekolah_${String(doc.school_id || reg || 'default').trim()}`;
  if (normType === 'foto_profil' && !reg.startsWith('REG-')) {
    const acc = String(doc.account_id || doc.user_id || reg || 'user').trim();
    return `foto_profil_${acc}`;
  }

  if (reg) {
    return `${reg}__${normType}`;
  }

  return doc.document_id ? `doc__${doc.document_id}` : `doc__${Math.random()}`;
}

/**
 * Filter out duplicate documents, merging the most up-to-date metadata
 * and preserving existing document IDs and drive IDs.
 */
export function deduplicateDocuments<T extends { registration_number?: string; document_type?: string } = DocumentItem>(
  docs: T[]
): T[] {
  if (!Array.isArray(docs)) return [];
  const map = new Map<string, T>();

  for (const doc of docs) {
    if (!doc) continue;
    const key = getDocumentUniqueKey(doc);
    const existing = map.get(key);

    const normalizedDoc = {
      ...doc,
      document_type: normalizeDocumentType(doc.document_type || ''),
    } as T;

    if (!existing) {
      map.set(key, normalizedDoc);
    } else {
      const existingDoc = existing as any;
      const docAny = doc as any;
      const existingTime = existingDoc.upload_time ? new Date(existingDoc.upload_time).getTime() : 0;
      const docTime = docAny.upload_time ? new Date(docAny.upload_time).getTime() : 0;

      const merged = {
        ...existing,
        ...normalizedDoc,
        document_id: existingDoc.document_id || docAny.document_id,
        drive_file_id: docAny.drive_file_id || existingDoc.drive_file_id || '',
        drive_url: docAny.drive_url || existingDoc.drive_url || '',
        local_url: docAny.local_url || existingDoc.local_url || '',
        file_name: docAny.file_name || existingDoc.file_name || '',
      } as T;

      if (docTime >= existingTime) {
        map.set(key, merged);
      } else {
        map.set(key, { ...merged, ...existing } as T);
      }
    }
  }
  return Array.from(map.values());
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
