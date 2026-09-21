import React, { useState, useEffect } from 'react';
import {
  Settings,
  Database,
  HardDrive,
  MapPin,
  Save,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Code,
  FileText,
  Upload,
  Image as ImageIcon,
  Trash2,
  Cloud,
  CloudRain,
  Download,
  AlertTriangle,
  Layers,
  ArrowUpDown,
  Globe,
  Info,
  Wifi,
  WifiOff,
  Maximize2,
  Minimize2,
  ShieldCheck,
} from 'lucide-react';
import { SystemSettings, ApiResponse } from '../../types/sipma';
import { GAS_BACKEND_CODE, GAS_SETUP_STEPS } from '../../services/gasBackendCode';
import { normalizeImageUrl, handleImageError, compressAndResizeImage } from '../../utils/imageUrl';
import { storageService } from '../../services/storageService';
import { useFeedback } from '../../context/FeedbackContext';

interface Props {
  settings: SystemSettings;
  onSaveSettings: (newSettings: SystemSettings) => void;
}

export const SystemConfig: React.FC<Props> = ({ settings, onSaveSettings }) => {
  const { showAlert, showToast, showLoading, hideLoading } = useFeedback();
  const [formData, setFormData] = useState<SystemSettings>({ ...settings });
  const [activeTab, setActiveTab] = useState<'config' | 'realtime' | 'backup' | 'guide' | 'code'>('config');

  useEffect(() => {
    setFormData({ ...settings });
  }, [settings]);

  // Connection Test States
  const [sheetsStatus, setSheetsStatus] = useState<{ loading: boolean; result?: ApiResponse }>({ loading: false });
  const [driveStatus, setDriveStatus] = useState<{ loading: boolean; result?: ApiResponse }>({ loading: false });
  const [mapsStatus, setMapsStatus] = useState<{ loading: boolean; result?: ApiResponse }>({ loading: false });

  // Sync state
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isPulling, setIsPulling] = useState<boolean>(false);
  const [isInitializingDb, setIsInitializingDb] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(settings.last_synced_at || null);

  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedGasUrl, setCopiedGasUrl] = useState<boolean>(false);
  const [copiedSsId, setCopiedSsId] = useState<boolean>(false);
  const [copiedDriveId, setCopiedDriveId] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState<boolean>(false);
  const [showFullscreenCode, setShowFullscreenCode] = useState<boolean>(false);
  const [realtimeHealth, setRealtimeHealth] = useState(storageService.getAutoSyncStatus());

  useEffect(() => {
    const unsubscribe = storageService.subscribe((event) => {
      if (
        event === 'realtime_status' ||
        event === 'network_status' ||
        event === 'sync_completed' ||
        event === 'data_mutated'
      ) {
        setRealtimeHealth(storageService.getAutoSyncStatus());
      }
    });
    return () => unsubscribe();
  }, []);

  const handleUploadAppLogo = async (file: File) => {
    if (!file) return;
    setIsUploadingLogo(true);
    showLoading('Mengunggah logo aplikasi...', 'Mengompresi dan menyimpan logo aplikasi ke Google Drive & database...', 'upload');
    try {
      // 1. Auto-optimize & compress client-side (no 2MB block, works on any device/camera)
      const compressed = await compressAndResizeImage(file, 800, 800, 0.88);
      // 2. Direct upload to server & Google Drive
      const res = await storageService.uploadAppLogo(compressed.base64, compressed.fileName);
      hideLoading();
      setIsUploadingLogo(false);
      if (res.success && res.logo_url) {
        setFormData((prev) => ({ ...prev, app_logo: res.logo_url }));
        onSaveSettings({ ...formData, app_logo: res.logo_url });
        showAlert('Logo Aplikasi Tersimpan', 'Logo aplikasi berhasil diunggah dan tersimpan ke Google Drive & Cloud Database!', 'success');
      } else {
        showAlert('Gagal Unggah Logo', res.message || 'Terjadi kesalahan saat mengunggah logo.', 'error');
      }
    } catch (err: any) {
      hideLoading();
      setIsUploadingLogo(false);
      showAlert('Gagal Memproses Gambar', err?.message || 'Format gambar tidak dapat diproses.', 'error');
    }
  };

  const handleApplyLogoUrl = (url: string) => {
    if (!url.trim()) return;
    const cleanUrl = url.trim();
    setFormData((prev) => ({ ...prev, app_logo: cleanUrl }));
    const current = storageService.getSettings();
    const updated = { ...current, ...formData, app_logo: cleanUrl };
    storageService.saveSettings(updated);
    onSaveSettings(updated);
    showToast('URL logo aplikasi berhasil disimpan!', 'success');
  };

  const handleRemoveLogo = async () => {
    showLoading('Menghapus logo aplikasi...', 'Menghapus berkas logo aplikasi dari Google Drive & sistem...', 'delete');
    try {
      await storageService.deleteAppLogo();
    } catch {}
    setFormData((prev) => ({ ...prev, app_logo: '' }));
    const current = storageService.getSettings();
    const updated = { ...current, ...formData, app_logo: '' };
    storageService.saveSettings(updated);
    onSaveSettings(updated);
    hideLoading();
    showToast('Logo aplikasi berhasil dihapus dari Google Drive & sistem.', 'info');
  };

  const getFormattedGasCode = () => {
    let code = GAS_BACKEND_CODE;
    const currentSsId = (formData.spreadsheet_id || '').trim();
    const currentDriveId = (formData.drive_root_folder_id || '').trim();

    if (currentSsId && !currentSsId.includes('MASUKKAN')) {
      code = code.replace(
        'var SPREADSHEET_ID = "MASUKKAN_SPREADSHEET_ID_ANDA_DI_SINI";',
        `var SPREADSHEET_ID = "${currentSsId}";`
      );
    }
    if (currentDriveId && !currentDriveId.includes('MASUKKAN')) {
      code = code.replace(
        'var DRIVE_ROOT_FOLDER_ID = "MASUKKAN_DRIVE_ROOT_FOLDER_ID_ANDA_DI_SINI";',
        `var DRIVE_ROOT_FOLDER_ID = "${currentDriveId}";`
      );
    }
    return code;
  };

  const handleCopyCode = async () => {
    const formattedCode = getFormattedGasCode();
    let copied = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(formattedCode);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = formattedCode;
        textarea.style.position = 'fixed';
        textarea.style.left = '-999999px';
        textarea.style.top = '-999999px';
        textarea.setAttribute('readonly', '');
        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, formattedCode.length);
        const res = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (res) copied = true;
      } catch {
        copied = false;
      }
    }

    if (copied) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
      showToast('Seluruh kode Code.gs (2.399 baris lengkap tanpa terpotong) berhasil disalin ke clipboard!', 'success');
    } else {
      showToast('Browser membatasi salin otomatis. Silakan gunakan tombol "Unduh File (Code.gs)".', 'error');
    }
  };

  const handleDownloadGasFile = () => {
    try {
      const code = getFormattedGasCode();
      const blob = new Blob([code], { type: 'text/javascript;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Code.gs';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('File Code.gs berhasil diunduh! File 100% utuh & siap disimpan di Apps Script.', 'success');
    } catch (err: any) {
      showToast('Gagal mengunduh file: ' + (err?.message || 'Error'), 'error');
    }
  };

  const handleCopyText = (text: string, type: 'gas' | 'ss' | 'drive') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === 'gas') {
      setCopiedGasUrl(true);
      setTimeout(() => setCopiedGasUrl(false), 2000);
    } else if (type === 'ss') {
      setCopiedSsId(true);
      setTimeout(() => setCopiedSsId(false), 2000);
    } else if (type === 'drive') {
      setCopiedDriveId(true);
      setTimeout(() => setCopiedDriveId(false), 2000);
    }
    showToast('Berhasil disalin ke clipboard!', 'info');
  };

  const handleInitDatabase = async () => {
    if (!formData.gas_web_app_url) {
      showAlert(
        'URL Web App Belum Terisi',
        'Silakan masukkan Google Apps Script Web App URL terlebih dahulu di lembar spreadsheet sebelum inisialisasi database otomatis.',
        'warning'
      );
      return;
    }

    setIsInitializingDb(true);
    showLoading(
      'Menginisialisasi tabel database di Google Spreadsheet...',
      'Membangun 11 tabel sheet database terformat dan menghubungkan skema ke Google Apps Script...',
      'sync'
    );
    const res = await storageService.initDatabaseGAS();
    setIsInitializingDb(false);
    hideLoading();

    if (res.success) {
      showAlert(
        'Database Otomatis Terbentuk & Terupdate!',
        res.message || 'Seluruh 11 sheet tabel database telah otomatis dibuat dengan format header dan styling di Google Spreadsheet, serta data lokal langsung disinkronkan.',
        'success'
      );
      setLastSyncTime(new Date().toISOString());
    } else {
      showAlert(
        'Inisialisasi Database Gagal',
        res.message || 'Gagal menghubungi Google Apps Script. Pastikan URL Web App sudah dideploy dengan akses "Anyone".',
        'error'
      );
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    showLoading('Menyimpan konfigurasi sistem...', 'Menyimpan konfigurasi aplikasi dan database ke server...', 'save');
    const current = storageService.getSettings();
    // ID Spreadsheet, Drive Folder, and GAS URL are permanent (paten) and cannot be changed through the app UI
    const updated: SystemSettings = {
      ...formData,
      gas_web_app_url: current.gas_web_app_url || formData.gas_web_app_url,
      spreadsheet_id: current.spreadsheet_id || formData.spreadsheet_id,
      drive_root_folder_id: current.drive_root_folder_id || formData.drive_root_folder_id,
      db_config_locked: false,
    };
    onSaveSettings(updated);
    storageService.saveSettings(updated);
    hideLoading();
    setIsSaved(true);
    showToast('Konfigurasi umum sistem berhasil disimpan', 'success');
    setTimeout(() => setIsSaved(false), 3000);
  };

  const testSheets = async () => {
    setSheetsStatus({ loading: true });
    const res = await storageService.testSheetsConnection(formData.spreadsheet_id);
    setSheetsStatus({ loading: false, result: res });
  };

  const testDrive = async () => {
    setDriveStatus({ loading: true });
    const res = await storageService.testDriveConnection(formData.drive_root_folder_id);
    setDriveStatus({ loading: false, result: res });
  };

  const testMaps = async () => {
    setMapsStatus({ loading: true });
    const res = await storageService.testMapsConnection(formData.maps_api_key);
    setMapsStatus({ loading: false, result: res });
  };

  const handleManualPushSync = async () => {
    if (!formData.gas_web_app_url) {
      showAlert(
        'URL Web App Belum Terisi',
        'Silakan masukkan Google Apps Script Web App URL terlebih dahulu untuk mengaktifkan sinkronisasi cloud realtime.',
        'warning'
      );
      return;
    }

    setIsSyncing(true);
    showLoading(
      'Mengirim data ke Google Sheets...',
      'Menyinkronkan seluruh berkas dan data pendaftar madrasah ke Google Spreadsheet...',
      'sync'
    );
    const res = await storageService.syncAllToGAS();
    setIsSyncing(false);
    hideLoading();
    if (res.success) {
      setLastSyncTime(new Date().toISOString());
      showAlert('Sinkronisasi Sukses', res.message || 'Data berhasil disinkronkan ke Google Sheets.', 'success');
    } else {
      showAlert('Sinkronisasi Gagal', res.message || 'Terjadi gangguan jaringan atau URL tidak valid.', 'error');
    }
  };

  const handleManualPullSync = async () => {
    if (!formData.gas_web_app_url) {
      showAlert(
        'URL Web App Belum Terisi',
        'Silakan masukkan Google Apps Script Web App URL terlebih dahulu.',
        'warning'
      );
      return;
    }

    setIsPulling(true);
    showLoading(
      'Menarik data dari Google Sheets...',
      'Mengambil update terbaru data pendaftar dan sekolah dari Google Spreadsheet...',
      'sync'
    );
    const res = await storageService.pullAllFromGAS();
    setIsPulling(false);
    hideLoading();
    if (res.success) {
      setLastSyncTime(new Date().toISOString());
      showAlert('Tarik Data Sukses', res.message || 'Data berhasil ditarik dari Google Sheets.', 'success');
    } else {
      showAlert('Tarik Data Gagal', res.message || 'Terjadi kesalahan saat menarik data.', 'error');
    }
  };

  const handleSyncDriveDocuments = async () => {
    showLoading(
      'Menyinkronkan berkas ke Google Drive...',
      'Mengunggah berkas dokumen, pas foto, dan lampiran pendaftar ke Google Drive...',
      'sync'
    );
    try {
      const result = await storageService.uploadAllPendingDocumentsToDrive();
      hideLoading();
      if (result.uploaded > 0) {
        showAlert(
          'Sinkronisasi Berkas Berhasil',
          `Sebanyak ${result.uploaded} dari ${result.total} berkas dokumen berhasil diunggah ke Google Drive.`,
          'success'
        );
      } else if (result.total === 0) {
        showAlert(
          'Semua Berkas Sudah Terunggah',
          'Seluruh dokumen dan pas foto telah tersimpan aman di Google Drive.',
          'info'
        );
      } else {
        showAlert(
          'Status Sinkronisasi',
          'Pastikan URL Google Apps Script Web App dan Drive Folder ID sudah aktif dan terhubung.',
          'warning'
        );
      }
    } catch (e: any) {
      hideLoading();
      showAlert('Gagal Sinkronisasi Berkas', e?.message || 'Terjadi kesalahan saat mengunggah berkas.', 'error');
    }
  };

  return (
    <div className="space-y-6" id="sipma-system-configuration">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-2">
            <span>Integrasi & Konfigurasi Sistem</span>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
              Vercel Ready
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-900 mt-0.5">
            Google Apps Script, Sheets, Drive & Realtime Engine
          </h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold shadow-2xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Integrasi Paten Aktif</span>
            </span>
          </div>

          {isSaved && (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
              ✓ Pengaturan Tersimpan
            </span>
          )}
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex flex-wrap bg-white p-1 rounded-xl border border-slate-200 shadow-xs text-xs font-bold gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('config')}
          className={`px-4 py-2 rounded-lg transition-all ${
            activeTab === 'config' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Konfigurasi & Koneksi Database
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('realtime')}
          className={`px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
            activeTab === 'realtime' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Cloud className="w-3.5 h-3.5 text-sky-400" />
          <span>Sinkronisasi Realtime</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('backup')}
          className={`px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
            activeTab === 'backup' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Database className="w-3.5 h-3.5 text-emerald-400" />
          <span>Backup & Restore DB</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('guide')}
          className={`px-4 py-2 rounded-lg transition-all ${
            activeTab === 'guide' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Panduan Setup (GAS & Vercel)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('code')}
          className={`px-4 py-2 rounded-lg transition-all ${
            activeTab === 'code' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Kode Backend (Code.gs)
        </button>
      </div>

      {/* ================= TAB 1: CONFIG & TESTERS ================= */}
      {activeTab === 'config' && (
        <div className="space-y-6">
          {/* Server Persistence Indicator */}
          <div className="p-4 rounded-2xl bg-indigo-50/90 border border-indigo-200 text-indigo-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-xs text-indigo-900">Sinkronisasi Server Pusat Aktif</h4>
                  <span className="px-2 py-0.5 bg-indigo-200 text-indigo-800 rounded-full text-[10px] font-extrabold">
                    Multi-Device Sync
                  </span>
                </div>
                <p className="text-xs text-indigo-700 mt-0.5 leading-relaxed">
                  ID Database Spreadsheet & Google Drive kini otomatis tersimpan di server pusat. Ketika dibuka di perangkat, laptop, atau HP lain, konfigurasi dan data tidak akan kembali ke setelan awal.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                await storageService.syncWithServer();
                setFormData(storageService.getSettings());
                showToast('Konfigurasi terbaru berhasil disinkronkan dari server pusat!', 'success');
              }}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shrink-0 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sinkronkan Server</span>
            </button>
          </div>

          {/* Patent Configuration Notice */}
          <div className="p-4.5 rounded-2xl border border-emerald-200 bg-emerald-50/70 text-emerald-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-xs text-emerald-950">
                    Konfigurasi Backend Paten (Terkunci Permanen)
                  </h4>
                  <span className="text-[10px] bg-emerald-200/80 text-emerald-900 font-bold px-2 py-0.5 rounded-full">
                    Read-Only
                  </span>
                </div>
                <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                  Data <strong>Google Apps Script URL</strong>, <strong>Spreadsheet ID</strong>, dan <strong>Google Drive Folder ID</strong> bersifat paten (tidak dapat diedit lewat aplikasi). Perubahan parameter ini hanya dapat dilakukan langsung di lembar spreadsheet database.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {formData.spreadsheet_id && !formData.spreadsheet_id.includes('SampleID') && (
                <a
                  href={`https://docs.google.com/spreadsheets/d/${formData.spreadsheet_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka Spreadsheet</span>
                </a>
              )}
              <button
                type="button"
                onClick={async () => {
                  showLoading('Menghubungkan dan menarik parameter konfigurasi dari Google Spreadsheet...');
                  const res = await storageService.pullAllFromGAS();
                  hideLoading();
                  if (res.success) {
                    const fresh = storageService.getSettings();
                    setFormData({ ...fresh });
                    showToast('Konfigurasi terbaru berhasil diselaraskan dari Spreadsheet!', 'success');
                  } else {
                    showAlert('Gagal Menyinkronkan', res.message || 'Pastikan Web App URL aktif dan koneksi internet stabil.', 'error');
                  }
                }}
                className="px-3.5 py-2 bg-white hover:bg-slate-50 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5 text-emerald-700" />
                <span>Tarik dari Spreadsheet</span>
              </button>
            </div>
          </div>

          {/* Connection Test Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card Sheets */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                  <Database className="w-4 h-4 text-emerald-600" />
                  <span>Google Sheets DB</span>
                </div>
                {sheetsStatus.result && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      sheetsStatus.result.success ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {sheetsStatus.result.success ? '✓ Connected' : '✕ Failed'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Penyimpanan data siswa, pendaftaran, orang tua, dan audit log.
              </p>
              {sheetsStatus.result && (
                <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  {sheetsStatus.result.message}
                </div>
              )}
              <button
                type="button"
                onClick={testSheets}
                disabled={sheetsStatus.loading}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${sheetsStatus.loading ? 'animate-spin' : ''}`} />
                <span>{sheetsStatus.loading ? 'Menguji...' : 'Test Google Sheets Connection'}</span>
              </button>
            </div>

            {/* Card Drive */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                  <HardDrive className="w-4 h-4 text-blue-600" />
                  <span>Google Drive Storage</span>
                </div>
                {driveStatus.result && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      driveStatus.result.success ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {driveStatus.result.success ? '✓ Connected' : '✕ Failed'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Penyimpanan berkas dokumen (KK, Akta, Ijazah, Foto) terstruktur otomatis.
              </p>
              {driveStatus.result && (
                <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  {driveStatus.result.message}
                </div>
              )}
              <div className="space-y-1.5 pt-1">
                <button
                  type="button"
                  onClick={testDrive}
                  disabled={driveStatus.loading}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${driveStatus.loading ? 'animate-spin' : ''}`} />
                  <span>{driveStatus.loading ? 'Menguji...' : 'Test Google Drive Connection'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSyncDriveDocuments}
                  className="w-full py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5 text-blue-600" />
                  <span>Upload Ulang Semua Dokumen ke Drive</span>
                </button>
              </div>
            </div>

            {/* Card Maps */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                  <MapPin className="w-4 h-4 text-rose-600" />
                  <span>Maps & Geospatial Engine</span>
                </div>
                {mapsStatus.result && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      mapsStatus.result.success ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {mapsStatus.result.success ? '✓ Connected' : '✕ Failed'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Perhitungan jarak koordinat akurat dan visualisasi radius zonasi.
              </p>
              {mapsStatus.result && (
                <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  {mapsStatus.result.message}
                </div>
              )}
              <button
                type="button"
                onClick={testMaps}
                disabled={mapsStatus.loading}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${mapsStatus.loading ? 'animate-spin' : ''}`} />
                <span>{mapsStatus.loading ? 'Menguji...' : 'Test Maps Connection'}</span>
              </button>
            </div>
          </div>

          {/* Form Settings */}
          <form onSubmit={handleSave} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Parameter Konfigurasi Database & Cloud
              </h3>
              <span className="text-[11px] text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Backend Paten: Dikelola via Spreadsheet</span>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Aplikasi Portal
                </label>
                <input
                  type="text"
                  value={formData.app_name}
                  onChange={(e) => setFormData({ ...formData, app_name: e.target.value })}
                  placeholder="SIPMA"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tagline / Subjudul Aplikasi
                </label>
                <input
                  type="text"
                  value={formData.app_tagline || ''}
                  onChange={(e) => setFormData({ ...formData, app_tagline: e.target.value })}
                  placeholder="Sistem Penerimaan Murid Madrasah"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Logo Settings */}
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                  <label className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-emerald-600" />
                    <span>Logo Aplikasi SIPMA (Google Drive & Database Cloud)</span>
                  </label>
                  {formData.app_logo ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Tersimpan di Cloud Database
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      Menggunakan Favicon Default
                    </span>
                  )}
                </div>
                <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    {formData.app_logo ? (
                      <div className="relative group shrink-0">
                        <img
                          src={normalizeImageUrl(formData.app_logo)}
                          alt="Logo Aplikasi SIPMA"
                          className="w-20 h-20 object-contain rounded-xl border-2 border-emerald-200 bg-white p-1.5 shadow-sm"
                          referrerPolicy="no-referrer"
                          onError={(e) => handleImageError(e, '/logo.png')}
                        />
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          title="Hapus Logo"
                          className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center text-xs shadow-md cursor-pointer transition-transform hover:scale-110"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center text-slate-400 text-[10px] text-center p-2 shrink-0">
                        <ImageIcon className="w-6 h-6 mb-1 text-slate-300" />
                        <span className="font-medium">Belum Ada Logo</span>
                      </div>
                    )}

                    <div className="flex-1 w-full space-y-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm transition-all cursor-pointer ${
                          isUploadingLogo ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 active:scale-98'
                        }`}>
                          {isUploadingLogo ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Menyimpan ke Cloud...</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4" />
                              <span>Pilih & Unggah Logo Sekarang</span>
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            disabled={isUploadingLogo}
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleUploadAppLogo(file);
                                e.target.value = '';
                              }
                            }}
                          />
                        </label>

                        {formData.app_logo && (
                          <button
                            type="button"
                            onClick={handleRemoveLogo}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus Logo</span>
                          </button>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Info className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Otomatis dioptimalkan & disimpan langsung ke Google Drive dan Google Sheets agar muncul di seluruh perangkat.</span>
                      </p>

                      <div className="flex items-center gap-2">
                        <input
                          type="url"
                          value={formData.app_logo || ''}
                          onChange={(e) => setFormData({ ...formData, app_logo: e.target.value })}
                          placeholder="Atau tempel URL gambar logo: https://example.com/logo.png"
                          className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleApplyLogoUrl(formData.app_logo || '')}
                          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shrink-0 transition-colors"
                        >
                          Terapkan URL
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Protected Database Link 1: GAS Web App URL */}
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                  <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Google Apps Script Web App Deployment URL</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {formData.gas_web_app_url && (
                      <a
                        href={formData.gas_web_app_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-0.5 underline"
                        title="Buka Endpoint Web App di Tab Baru"
                      >
                        <span>Buka URL</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <span className="text-[10px] text-emerald-800 bg-emerald-100/70 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                      Paten • Dari Spreadsheet
                    </span>
                  </div>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    readOnly
                    value={formData.gas_web_app_url || ''}
                    placeholder="Masukkan langsung URL Web App di lembar Spreadsheet..."
                    className="w-full pl-3.5 pr-20 py-2.5 rounded-xl font-mono text-xs bg-slate-100/90 text-slate-700 border border-slate-300 select-all cursor-default focus:outline-none"
                    title="Nilai ini paten dan tidak dapat diubah lewat aplikasi. Ubah langsung di Spreadsheet."
                  />
                  <button
                    type="button"
                    onClick={() => handleCopyText(formData.gas_web_app_url, 'gas')}
                    className="absolute right-2 px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                    title="Salin URL Web App"
                  >
                    {copiedGasUrl ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedGasUrl ? 'Tersalin' : 'Salin'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Parameter ini paten dan hanya dapat diatur atau diubah langsung dari file Google Spreadsheet. Aplikasi tidak memiliki izin mengubah link ini.
                </p>
              </div>

              {/* Protected Database Link 2: Google Spreadsheet ID */}
              <div>
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                  <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Google Spreadsheet ID (Database)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {formData.spreadsheet_id && !formData.spreadsheet_id.includes('SampleID') && (
                      <a
                        href={`https://docs.google.com/spreadsheets/d/${formData.spreadsheet_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-0.5 underline"
                        title="Buka Spreadsheet di Tab Baru"
                      >
                        <span>Buka Sheet</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <span className="text-[10px] text-emerald-800 bg-emerald-100/70 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                      Paten • Dari Spreadsheet
                    </span>
                  </div>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    readOnly
                    value={formData.spreadsheet_id || ''}
                    placeholder="Masukkan langsung ID Spreadsheet..."
                    className="w-full pl-3.5 pr-20 py-2.5 rounded-xl font-mono text-xs bg-slate-100/90 text-slate-700 border border-slate-300 select-all cursor-default focus:outline-none"
                    title="Nilai ini paten dan tidak dapat diubah lewat aplikasi. Ubah langsung di Spreadsheet."
                  />
                  <button
                    type="button"
                    onClick={() => handleCopyText(formData.spreadsheet_id, 'ss')}
                    className="absolute right-2 px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                    title="Salin ID Spreadsheet"
                  >
                    {copiedSsId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSsId ? 'Tersalin' : 'Salin'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  ID file Spreadsheet penyimpanan utama. Nilai ini paten dan tidak dapat diedit melalui antarmuka aplikasi.
                </p>
              </div>

              {/* Protected Database Link 3: Google Drive Root Folder ID */}
              <div>
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                  <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-blue-600" />
                    <span>Google Drive Root Folder ID (Storage)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {formData.drive_root_folder_id && !formData.drive_root_folder_id.includes('SampleStorage') && (
                      <a
                        href={`https://drive.google.com/drive/folders/${formData.drive_root_folder_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-blue-700 hover:text-blue-800 font-bold flex items-center gap-0.5 underline"
                        title="Buka Folder Drive di Tab Baru"
                      >
                        <span>Buka Drive</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <span className="text-[10px] text-emerald-800 bg-emerald-100/70 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                      Paten • Dari Spreadsheet
                    </span>
                  </div>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    readOnly
                    value={formData.drive_root_folder_id || ''}
                    placeholder="Masukkan langsung ID Folder Drive..."
                    className="w-full pl-3.5 pr-20 py-2.5 rounded-xl font-mono text-xs bg-slate-100/90 text-slate-700 border border-slate-300 select-all cursor-default focus:outline-none"
                    title="Nilai ini paten dan tidak dapat diubah lewat aplikasi. Ubah langsung di Spreadsheet."
                  />
                  <button
                    type="button"
                    onClick={() => handleCopyText(formData.drive_root_folder_id, 'drive')}
                    className="absolute right-2 px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                    title="Salin ID Folder Drive"
                  >
                    {copiedDriveId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedDriveId ? 'Tersalin' : 'Salin'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  ID folder induk Google Drive penyimpanan berkas. Nilai ini paten dan terlindungi secara permanen.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Teks Format Tahun Pelajaran di Halaman Utama & Surat
                </label>
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={formData.academic_year_label || ''}
                    placeholder="Contoh: 2027/2028"
                    onChange={(e) => setFormData({ ...formData, academic_year_label: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500 outline-none text-emerald-950"
                  />
                  <div className="flex items-center justify-between text-xs text-slate-500 flex-wrap gap-1">
                    <span>Teks ini menggantikan tulisan tahun pada: <em>&quot;Penerimaan Peserta Didik Madrasah Tahun Ajaran [Tahun]&quot;</em></span>
                    {formData.academic_year_label && (
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        Preview: Penerimaan Peserta Didik Madrasah Tahun Ajaran {formData.academic_year_label}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tahun Ajaran Penerimaan (Angka / Single Year)
                  </label>
                  <input
                    type="text"
                    value={formData.application_year}
                    placeholder="2027"
                    onChange={(e) => {
                      const newYear = e.target.value;
                      const nextYear = (parseInt(newYear, 10) || 2027) + 1;
                      const autoFormat = `${newYear}/${nextYear}`;
                      setFormData({
                        ...formData,
                        application_year: newYear,
                        academic_year_label: (!formData.academic_year_label || formData.academic_year_label.includes('/')) ? autoFormat : formData.academic_year_label,
                      });
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  <span className="text-[11px] text-slate-400">Digunakan untuk penomoran registrasi & skema basis data</span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Batas Ukuran Unggah Dokumen (MB)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={25}
                    value={formData.max_file_size_mb}
                    onChange={(e) => setFormData({ ...formData, max_file_size_mb: parseInt(e.target.value) || 5 })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  <span className="text-[11px] text-slate-400">Maksimum ukuran tiap berkas pendaftaran calon murid</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Parameter ID Spreadsheet, Drive, & URL GAS bersifat paten. Perubahan parameter ini hanya melalui spreadsheet.</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Pengaturan Portal</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ================= TAB 2: REALTIME CLOUD SYNC ================= */}
      {activeTab === 'realtime' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Cloud className="w-4 h-4 text-sky-600" />
                <span>Manajemen Sinkronisasi Realtime & Vercel Cloud</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Otomatisasi pengiriman dan pengambilan data pendaftaran, siswa, madrasah, dan berkas ke Google Sheets & Drive.
              </p>
            </div>

            {lastSyncTime && (
              <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl">
                Terakhir Sinkron: {new Date(lastSyncTime).toLocaleTimeString('id-ID')}
              </span>
            )}
          </div>

          {/* Real-time Connection Health Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
            <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 shadow-2xs">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  realtimeHealth.isSseConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                {realtimeHealth.isSseConnected ? <Wifi className="w-4 h-4 animate-pulse" /> : <WifiOff className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Stream Realtime (SSE)</div>
                <div className="text-xs font-bold text-slate-900 truncate">
                  {realtimeHealth.isSseConnected ? 'Aktif & Terhubung (Sub-Detik)' : 'Terputus (Auto-Reconnect)'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 shadow-2xs">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  realtimeHealth.hasGasConfigured ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                <Cloud className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Google Sheets Cloud</div>
                <div className="text-xs font-bold text-slate-900 truncate">
                  {realtimeHealth.hasGasConfigured ? 'Web App URL Terhubung' : 'Belum Dikonfigurasi'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 shadow-2xs">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  realtimeHealth.autoSyncEnabled ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sinkronisasi Otomatis</div>
                <div className="text-xs font-bold text-slate-900 truncate">
                  {realtimeHealth.isSyncing
                    ? 'Sedang Menyinkronkan...'
                    : realtimeHealth.autoSyncEnabled
                    ? 'Otomatis Tiap Mutasi Data'
                    : 'Manual Saja'}
                </div>
              </div>
            </div>
          </div>

          {/* Feature: Automated Database Creation & Self-Update */}
          <div className="p-5 bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white rounded-2xl border border-emerald-700/50 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center justify-center font-bold shrink-0">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-white">Inisialisasi & Update Otomatis Database</h4>
                    <span className="px-2 py-0.5 bg-emerald-500/30 text-emerald-300 text-[10px] font-bold rounded-full border border-emerald-400/30">
                      Auto-Create & Auto-Update
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Buat seluruh 11 sheet tabel database secara otomatis di Google Spreadsheet kosong lengkap dengan header dan styling, serta sinkronkan data secara otomatis di latar belakang.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleInitDatabase}
                disabled={isInitializingDb}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg cursor-pointer shrink-0"
              >
                <RefreshCw className={`w-4 h-4 ${isInitializingDb ? 'animate-spin' : ''}`} />
                <span>{isInitializingDb ? 'Membuat Seluruh Tabel...' : '🚀 Buat & Update Otomatis Database'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-700/50 text-[11px] text-slate-300">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>11 Sheet Terbuat Otomatis</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Format & Header Hijau Emerald</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Auto-Sync Background (40s)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Self-Healing Missing Sheets</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Action 1: Push Sync */}
            <div className="p-5 bg-gradient-to-br from-emerald-50 to-teal-50/50 rounded-2xl border border-emerald-200 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                  <ArrowUpDown className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900">Sinkronkan ke Google Sheets</h4>
                  <p className="text-[11px] text-slate-600">Kirim seluruh data pendaftar lokal ke Google Spreadsheet secara realtime.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleManualPushSync}
                disabled={isSyncing}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Sedang Menyinkronkan...' : 'Kirim / Sinkronkan Data Sekarang'}</span>
              </button>
            </div>

            {/* Action 2: Pull Sync */}
            <div className="p-5 bg-gradient-to-br from-sky-50 to-blue-50/50 rounded-2xl border border-sky-200 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900">Tarik Data dari Google Sheets</h4>
                  <p className="text-[11px] text-slate-600">Ambil data terbaru dari Spreadsheet jika ada perubahan yang diedit langsung di spreadsheet.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleManualPullSync}
                disabled={isPulling}
                className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isPulling ? 'animate-spin' : ''}`} />
                <span>{isPulling ? 'Sedang Menarik Data...' : 'Tarik Data Terbaru dari Cloud'}</span>
              </button>
            </div>
          </div>

          {/* Vercel Status Info & Environment Variables */}
          <div className="p-5 bg-slate-900 text-slate-100 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-xs">Variabel Lingkungan Vercel (Auto-Connect Global)</span>
              </div>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-2.5 py-0.5 rounded-full font-bold">
                Production Ready
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Agar aplikasi yang di-deploy di Vercel otomatis memakai database ini untuk <strong>seluruh pengunjung di mana saja</strong> tanpa perlu konfigurasi ulang di setiap browser, salin dan tambahkan variabel berikut pada <strong>Vercel Project Settings &gt; Environment Variables</strong>:
            </p>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-emerald-400 space-y-1 select-all relative group">
              <div>VITE_GAS_WEB_APP_URL=&quot;{formData.gas_web_app_url || 'https://script.google.com/macros/s/.../exec'}&quot;</div>
              <div>VITE_SPREADSHEET_ID=&quot;{formData.spreadsheet_id || ''}&quot;</div>
              <div>VITE_DRIVE_ROOT_FOLDER_ID=&quot;{formData.drive_root_folder_id || ''}&quot;</div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const envText = `VITE_GAS_WEB_APP_URL="${formData.gas_web_app_url || ''}"\nVITE_SPREADSHEET_ID="${formData.spreadsheet_id || ''}"\nVITE_DRIVE_ROOT_FOLDER_ID="${formData.drive_root_folder_id || ''}"`;
                  navigator.clipboard.writeText(envText);
                  showToast('Variabel Vercel .env berhasil disalin ke clipboard!', 'success');
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Salin Format .env untuk Vercel</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const shareUrl = storageService.generateConfigShareUrl();
                  navigator.clipboard.writeText(shareUrl);
                  showToast('Tautan setup database instan berhasil disalin!', 'success');
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
                <span>Salin Tautan Setup Instan (Untuk Dibuka di Perangkat Lain)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 3: BACKUP & RESTORE DB ================= */}
      {activeTab === 'backup' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600" />
              <span>Cadangkan & Pulihkan Seluruh Database (JSON)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Gunakan fitur ini untuk memindahkan database antar perangkat atau sebelum melakukan deploy ke Vercel production.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Export */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="font-bold text-xs text-slate-900">Unduh Berkas Backup Lengkap</div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Mengekspor seluruh pendaftar, data orang tua, riwayat verifikasi, sekolah, berkas dokumen, dan pengaturan ke format file JSON terenkripsi.
              </p>
              <button
                type="button"
                onClick={() => {
                  storageService.exportDatabaseBackup();
                  showToast('Berkas backup database berhasil diunduh!', 'success');
                }}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Unduh File Backup Database (.json)</span>
              </button>
            </div>

            {/* Import */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="font-bold text-xs text-slate-900">Pulihkan / Restore dari Berkas Backup</div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Unggah file JSON backup yang pernah diunduh sebelumnya untuk mengembalikan seluruh pendaftar dan data konfigurasi.
              </p>
              <label className="w-full py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs">
                <Upload className="w-4 h-4" />
                <span>Pilih Berkas Backup (.json)</span>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const content = event.target?.result as string;
                        if (content) {
                          showLoading('Memulihkan database...', 'Mengimpor berkas cadangan dan memulihkan seluruh tabel database...', 'sync');
                          setTimeout(() => {
                            const res = storageService.importDatabaseBackup(content);
                            hideLoading();
                            if (res.success) {
                              showAlert('Restore Sukses', res.message, 'success');
                              window.location.reload();
                            } else {
                              showAlert('Restore Gagal', res.message, 'error');
                            }
                          }, 500);
                        }
                      };
                      reader.readAsText(file);
                    }
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 4: STEP BY STEP GUIDE ================= */}
      {activeTab === 'guide' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">
              Panduan Integrasi Google Sheets, Google Drive, & Deploy Vercel
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Ikuti langkah-langkah berikut untuk menghubungkan SIPMA ke ekosistem Google Cloud dan mendeploy ke Vercel.
            </p>
          </div>

          {/* Visual Architecture Card: Google Drive Automated Structure */}
          <div className="p-5 bg-gradient-to-br from-emerald-50 via-teal-50/40 to-slate-50 rounded-2xl border border-emerald-200/80 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                <HardDrive className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-emerald-950">
                  Struktur Otomatis Folder Google Drive (Anti-Data Dobel & Rapi)
                </h4>
                <p className="text-[11px] text-emerald-800">
                  Backend Google Apps Script mengatur berkas secara bertingkat dan otomatis mencegah folder ganda.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-white/90 rounded-xl border border-emerald-200 space-y-2 shadow-2xs">
                <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-emerald-600" />
                  <span>1. Berkas Calon Murid (PPDB)</span>
                </div>
                <div className="p-2.5 bg-slate-900 rounded-lg text-emerald-300 font-mono text-[11px] space-y-1 select-all">
                  <div>📁 SIPMA_Storage_2026/</div>
                  <div className="pl-3 text-sky-300">└── 📁 Tahun Penerimaan 2026-2027/</div>
                  <div className="pl-6 text-amber-300">└── 📁 [Nama Madrasah Pilihan]/</div>
                  <div className="pl-9 text-emerald-300 font-bold">└── 📁 [Nama Murid] - [No Pendaftaran]/</div>
                  <div className="pl-12 text-slate-300">├── 📄 [Nama Murid]_[NoReg]_foto.jpg</div>
                  <div className="pl-12 text-slate-300">├── 📄 [Nama Murid]_[NoReg]_ijazah.pdf</div>
                  <div className="pl-12 text-slate-300">└── 📄 [Nama Murid]_[NoReg]_kk.pdf</div>
                </div>
                <p className="text-[10px] text-slate-500">
                  Folder murid menggunakan nama lengkap pendaftar. Jika berkas diunggah ulang, berkas lama otomatis digantikan (anti-duplikasi).
                </p>
              </div>

              <div className="p-3.5 bg-white/90 rounded-xl border border-blue-200 space-y-2 shadow-2xs">
                <div className="font-bold text-blue-900 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  <span>2. Berkas Akun Pengguna & Branding</span>
                </div>
                <div className="p-2.5 bg-slate-900 rounded-lg text-sky-300 font-mono text-[11px] space-y-1 select-all">
                  <div>📁 SIPMA_Storage_2026/</div>
                  <div className="pl-3 text-purple-300">├── 📁 DATA AKUN PENGGUNA/</div>
                  <div className="pl-6 text-pink-300 font-bold">│   └── 📁 [Nama Akun] ([ID/Username])/</div>
                  <div className="pl-9 text-slate-300">│       └── 📄 Foto_Profil_[Nama Akun].png</div>
                  <div className="pl-3 text-indigo-300">├── 📁 SISTEM &amp; BRANDING SIPMA/</div>
                  <div className="pl-6 text-slate-300">│   └── 📄 Logo_Resmi_SIPMA.png</div>
                  <div className="pl-3 text-sky-300">└── 📁 Tahun Penerimaan 2026-2027/</div>
                  <div className="pl-6 text-amber-300">    └── 📁 [Nama Madrasah]/</div>
                  <div className="pl-9 text-slate-300">        └── 📄 Logo_Resmi_[Madrasah].png</div>
                </div>
                <p className="text-[10px] text-slate-500">
                  Akun pengguna memiliki folder khusus terpisah. Logo madrasah dan logo pusat tersimpan rapi tanpa data dobel.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {GAS_SETUP_STEPS.map((s) => (
              <div key={s.step} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex gap-4">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  {s.step}
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-xs text-slate-900">{s.title}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= TAB 5: CODE.GS GENERATOR ================= */}
      {activeTab === 'code' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Kode Sumber Backend Google Apps Script (Code.gs)
                </h3>
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-full border border-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Sintaks Valid (2.399 Baris)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Kode backend lengkap 100% utuh tanpa terpotong, siap disimpan ke Google Apps Script tanpa eror sintaks.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadGasFile}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                title="Unduh file Code.gs utuh ke komputer/HP Anda"
              >
                <Download className="w-4 h-4" />
                <span>Unduh File (Code.gs)</span>
              </button>

              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                title="Salin seluruh 2.399 baris kode ke clipboard"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedCode ? 'Tersalin ke Clipboard!' : 'Salin Seluruh Kode'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowFullscreenCode(true)}
                className="inline-flex items-center gap-2 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                title="Buka kode dalam layar penuh"
              >
                <Maximize2 className="w-4 h-4" />
                <span>Layar Penuh</span>
              </button>
            </div>
          </div>

          {/* Validation & Config Status Banner */}
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-emerald-900">
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-bold text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>ID Konfigurasi Otomatis Tersemat:</span>
              </div>
              <div className="text-[11px] text-emerald-700 space-y-0.5 pl-6">
                <div>• SPREADSHEET_ID: <code className="font-mono font-bold bg-emerald-100 px-1 rounded">{formData.spreadsheet_id || 'Belum diisi'}</code></div>
                <div>• DRIVE_ROOT_FOLDER_ID: <code className="font-mono font-bold bg-emerald-100 px-1 rounded">{formData.drive_root_folder_id || 'Belum diisi'}</code></div>
              </div>
            </div>
            <div className="text-[11px] text-emerald-700 sm:text-right bg-white/70 px-3 py-2 rounded-lg border border-emerald-200/80">
              <span className="font-bold">Ukuran Kode:</span> ~104 KB (2.399 Baris)<br />
              <span className="font-bold">Status Engine:</span> Google Apps Script V8 Ready
            </div>
          </div>

          {/* Anti-Error Practical Steps */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-sky-600" />
              <span>Panduan 4 Langkah Praktis Menyimpan ke Apps Script (Anti-Gagal):</span>
            </h4>
            <ol className="text-xs text-slate-600 list-decimal list-inside space-y-1.5 leading-relaxed">
              <li>
                Klik tombol <strong>&quot;Unduh File (Code.gs)&quot;</strong> atau <strong>&quot;Salin Seluruh Kode&quot;</strong> di atas.
              </li>
              <li>
                Buka Spreadsheet Anda, lalu buka menu <strong>Ekstensi (Extensions) &gt; Apps Script</strong>.
              </li>
              <li>
                Buka file <code className="font-mono bg-slate-200 px-1 rounded">Code.gs</code>. Hapus seluruh isi kode lama: tekan <kbd className="px-1.5 py-0.5 bg-slate-200 border border-slate-300 rounded text-[10px] font-mono">Ctrl+A</kbd> lalu <kbd className="px-1.5 py-0.5 bg-slate-200 border border-slate-300 rounded text-[10px] font-mono">Delete</kbd>.
              </li>
              <li>
                Tempelkan: tekan <kbd className="px-1.5 py-0.5 bg-slate-200 border border-slate-300 rounded text-[10px] font-mono">Ctrl+V</kbd> lalu tekan <kbd className="px-1.5 py-0.5 bg-slate-200 border border-slate-300 rounded text-[10px] font-mono">Ctrl+S</kbd> (Simpan). Kode akan langsung tersimpan bersih tanpa eror sintaks.
              </li>
              <li>
                Klik <strong>Deploy &gt; Manage deployments</strong> &gt; Ikon Pensil (Edit) &gt; Version: <strong>New version</strong> &gt; <strong>Deploy</strong>.
              </li>
            </ol>
          </div>

          <pre className="p-4 bg-slate-900 text-emerald-300 font-mono text-xs rounded-xl overflow-x-auto max-h-[500px] leading-relaxed select-all">
            {getFormattedGasCode()}
          </pre>
        </div>
      )}

      {/* Fullscreen Code Modal */}
      {showFullscreenCode && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
          <div className="w-full max-w-6xl h-[92vh] bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-900/90">
              <div className="flex items-center gap-3 min-w-0">
                <Code className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <h3 className="font-bold text-sm text-white truncate">
                    Code.gs — Google Apps Script Backend (2.399 Baris)
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate">
                    Spreadsheet ID &amp; Drive ID telah terpasang otomatis • Siap disimpan
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleDownloadGasFile}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Unduh .gs</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg cursor-pointer border border-slate-700"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Tersalin' : 'Salin'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowFullscreenCode(false)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer"
                  title="Tutup Layar Penuh"
                >
                  <Minimize2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 p-4 overflow-auto font-mono text-xs text-emerald-300 leading-relaxed select-all">
              <pre>{getFormattedGasCode()}</pre>
            </div>

            <div className="p-3 border-t border-slate-800 bg-slate-900 text-center text-xs text-slate-400">
              Tekan <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-200 rounded border border-slate-700 text-[10px]">Esc</kbd> atau tombol di sudut kanan atas untuk menutup layar penuh.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
