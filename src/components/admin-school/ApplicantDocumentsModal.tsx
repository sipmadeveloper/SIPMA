import React, { useState } from 'react';
import {
  X,
  FileText,
  Download,
  FolderDown,
  Eye,
  CheckCircle,
  Clock,
  AlertCircle,
  FileCheck,
  ShieldCheck,
  ExternalLink,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react';
import { Application, StudentProfile, DocumentItem, School } from '../../types/sipma';
import { downloadDocumentFile, downloadAllStudentDocuments } from '../../utils/fileDownload';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { useFeedback } from '../../context/FeedbackContext';

interface Props {
  application: Application;
  student?: StudentProfile | null;
  documents: DocumentItem[];
  school: School;
  onClose: () => void;
  onRefreshData?: () => void;
}

export const ApplicantDocumentsModal: React.FC<Props> = ({
  application,
  student,
  documents,
  school,
  onClose,
  onRefreshData,
}) => {
  const { showToast, showAlert } = useFeedback();
  const [activePreviewDoc, setActivePreviewDoc] = useState<DocumentItem | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);

  const studentDocuments = documents.filter(
    (d) => d.registration_number === application.registration_number
  );

  const handleDownloadAll = () => {
    if (studentDocuments.length === 0) {
      showToast('Belum ada berkas untuk diunduh', 'warning');
      return;
    }
    downloadAllStudentDocuments(studentDocuments, student?.name || application.registration_number);
    showAlert(
      'Mengunduh Berkas',
      `Memulai pengunduhan ${studentDocuments.length} berkas calon murid ${student?.name || ''}...`,
      'success'
    );
  };

  const getDocCategoryLabel = (docType: string) => {
    const lower = (docType || '').toLowerCase();
    if (lower.includes('kartu_keluarga') || lower.includes('kk')) return 'Kartu Keluarga (KK)';
    if (lower.includes('akta')) return 'Akta Kelahiran';
    if (lower.includes('ijazah') || lower.includes('skl')) return 'Ijazah / SKL';
    if (lower.includes('kip') || lower.includes('pkh') || lower.includes('afirmasi')) return 'Dokumen Afirmasi (KIP/PKH)';
    if (lower.includes('prestasi') || lower.includes('sertifikat')) return 'Sertifikat Prestasi';
    if (lower.includes('mutasi') || lower.includes('sk_')) return 'Surat Tugas Mutasi';
    if (lower.includes('foto')) return 'Pas Foto 3x4';
    return docType || 'Dokumen Persyaratan';
  };

  const isPdf = (doc: DocumentItem) => {
    return (
      Boolean(doc.mime_type && doc.mime_type.includes('pdf')) ||
      Boolean(doc.file_name && doc.file_name.toLowerCase().endsWith('.pdf'))
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center shrink-0 border border-sky-200 shadow-2xs">
              <FileCheck className="w-5 h-5 text-sky-700" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-sky-800 bg-sky-100/70 px-2 py-0.5 rounded border border-sky-200">
                  Daftar Berkas & Dokumen Persyaratan
                </span>
                <span className="text-xs font-mono font-bold text-slate-500">
                  {application.registration_number}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 truncate mt-0.5">
                {student?.name || 'Calon Murid'}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer shrink-0"
            title="Tutup Modal Berkas"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* Top Action Bar */}
          <div className="flex items-center justify-between flex-wrap gap-3 p-4 bg-gradient-to-r from-sky-50 to-emerald-50 rounded-xl border border-sky-200/80 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold text-xs">
                {studentDocuments.length}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">
                  Total Berkas Terunggah
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  {studentDocuments.length > 0
                    ? `${studentDocuments.length} berkas persyaratan siap diverifikasi & diunduh`
                    : 'Belum ada dokumen yang diunggah oleh pendaftar ini'}
                </div>
              </div>
            </div>

            {studentDocuments.length > 0 && (
              <button
                type="button"
                onClick={handleDownloadAll}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                title="Unduh seluruh berkas calon murid ini sekaligus"
              >
                <FolderDown className="w-4 h-4" />
                <span>Unduh Semua Berkas</span>
              </button>
            )}
          </div>

          {/* Documents List */}
          {studentDocuments.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-300 p-8 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
                <FileText className="w-7 h-7 text-amber-600" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Tidak Ada Dokumen Terunggah</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  Calon murid belum melampirkan berkas dokumen digital pada saat pendaftaran online.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {studentDocuments.map((doc) => {
                const pdf = isPdf(doc);
                const fileUrl = doc.file_data_base64 || doc.drive_url || doc.local_url || '';
                const categoryLabel = getDocCategoryLabel(doc.document_type);

                return (
                  <div
                    key={doc.document_id}
                    className="p-4 bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                          pdf
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        <FileText className="w-5 h-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wider">
                            {categoryLabel}
                          </span>
                          <span
                            className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full capitalize ${
                              doc.verification_status === 'terverifikasi'
                                ? 'bg-emerald-100 text-emerald-800'
                                : doc.verification_status === 'perlu_perbaikan'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {doc.verification_status || 'menunggu'}
                          </span>
                        </div>

                        <div className="font-bold text-xs text-slate-900 mt-1 truncate" title={doc.file_name}>
                          {doc.document_title || doc.file_name}
                        </div>

                        <div className="flex items-center gap-2 text-[10.5px] text-slate-400 mt-0.5">
                          <span className="font-mono">{doc.file_size_kb || 0} KB</span>
                          <span>•</span>
                          <span>{new Date(doc.upload_time).toLocaleDateString('id-ID')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Actions for this document */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActivePreviewDoc(doc);
                          setZoomLevel(100);
                          setRotation(0);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
                        title="Lihat Pratinjau Dokumen Ini"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                        <span>Pratinjau</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => downloadDocumentFile(doc, student?.name)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
                        title="Unduh Berkas Ini"
                      >
                        <Download className="w-3.5 h-3.5 text-sky-600" />
                        <span>Unduh</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
            Jalur: <strong className="uppercase text-slate-800">{application.pathway}</strong>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* Sub-modal: Dedicated Document Preview */}
      {activePreviewDoc && (
        <div className="fixed inset-0 z-60 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Preview Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="w-5 h-5 text-emerald-700 shrink-0" />
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 truncate">
                    {activePreviewDoc.document_title || activePreviewDoc.file_name}
                  </h4>
                  <div className="text-[11px] text-slate-500">
                    {activePreviewDoc.registration_number} • {activePreviewDoc.file_size_kb || 0} KB
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(z + 25, 300))}
                  className="p-1.5 text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                  title="Perbesar"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(z - 25, 50))}
                  className="p-1.5 text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                  title="Perkecil"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-1.5 text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                  title="Putar 90 Derajat"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => downloadDocumentFile(activePreviewDoc, student?.name)}
                  className="p-1.5 text-sky-700 hover:bg-sky-100 rounded-lg cursor-pointer"
                  title="Unduh Dokumen Ini"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreviewDoc(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-200 rounded-lg cursor-pointer ml-2"
                  title="Tutup Pratinjau"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Preview Canvas */}
            <div className="flex-1 bg-slate-900 p-4 sm:p-6 overflow-auto flex items-center justify-center min-h-[350px]">
              {(() => {
                const pdf = isPdf(activePreviewDoc);
                const fileUrl = activePreviewDoc.file_data_base64 || activePreviewDoc.drive_url || activePreviewDoc.local_url || '';

                if (pdf) {
                  return (
                    <div className="text-center p-8 bg-slate-800 rounded-2xl border border-slate-700 max-w-md text-white space-y-3">
                      <FileText className="w-12 h-12 text-rose-400 mx-auto" />
                      <div>
                        <p className="font-bold text-sm">Dokumen Format PDF</p>
                        <p className="text-xs text-slate-400 mt-1">{activePreviewDoc.file_name}</p>
                      </div>
                      <div className="flex items-center justify-center gap-2 pt-2">
                        {fileUrl && (
                          <a
                            href={fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Buka di Tab Baru</span>
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => downloadDocumentFile(activePreviewDoc, student?.name)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Unduh PDF</span>
                        </button>
                      </div>
                    </div>
                  );
                }

                if (fileUrl) {
                  return (
                    <img
                      src={normalizeImageUrl(fileUrl)}
                      alt={activePreviewDoc.file_name}
                      style={{
                        transform: `scale(${zoomLevel / 100}) rotate(${rotation}deg)`,
                        transition: 'transform 0.2s ease',
                      }}
                      className="max-h-[70vh] max-w-full object-contain shadow-2xl rounded-lg"
                    />
                  );
                }

                return (
                  <div className="text-center text-slate-400 text-xs">
                    File data tidak tersedia untuk pratinjau langsung.
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
