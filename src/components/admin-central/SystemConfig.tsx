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
  Lock,
  Unlock,
  KeyRound,
  Cloud,
  CloudRain,
  Download,
  AlertTriangle,
  Layers,
  ArrowUpDown,
  ShieldCheck,
  Globe,
  Eye,
  EyeOff,
  RotateCcw,
  HelpCircle,
} from 'lucide-react';
import { SystemSettings, ApiResponse } from '../../types/sipma';
import { GAS_BACKEND_CODE, GAS_SETUP_STEPS } from '../../services/gasBackendCode';
import { normalizeImageUrl } from '../../utils/imageUrl';
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
    setIsLocked(settings.db_config_locked !== false);
  }, [settings]);

  // Lock state
  const [isLocked, setIsLocked] = useState<boolean>(settings.db_config_locked !== false);
  const [showUnlockModal, setShowUnlockModal] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [showPinInputText, setShowPinInputText] = useState<boolean>(false);

  // Change PIN modal state
  const [showChangePinModal, setShowChangePinModal] = useState<boolean>(false);
  const [oldPin, setOldPin] = useState<string>('');
  const [newPin, setNewPin] = useState<string>('');
  const [confirmNewPin, setConfirmNewPin] = useState<string>('');
  const [changePinError, setChangePinError] = useState<string | null>(null);

  // Reset PIN modal state
  const [showResetPinModal, setShowResetPinModal] = useState<boolean>(false);
  const [resetNewPin, setResetNewPin] = useState<string>('123456');
  const [resetConfirmPin, setResetConfirmPin] = useState<string>('123456');
  const [resetPinError, setResetPinError] = useState<string | null>(null);

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
  const [isSaved, setIsSaved] = useState<boolean>(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(GAS_BACKEND_CODE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleInitDatabase = async () => {
    if (!formData.gas_web_app_url) {
      showAlert(
        'URL Web App Belum Terisi',
        'Silakan masukkan Google Apps Script Web App URL terlebih dahulu sebelum inisialisasi database otomatis.',
        'warning'
      );
      return;
    }

    setIsInitializingDb(true);
    showLoading('Menginisialisasi & membangun 11 tabel sheet database di Google Spreadsheet...');
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
    const updated = {
      ...formData,
      db_config_locked: isLocked,
    };
    onSaveSettings(updated);
    storageService.saveSettings(updated);
    setIsSaved(true);
    showToast('Konfigurasi sistem berhasil disimpan', 'success');
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleUnlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = storageService.unlockDbConfig(pinInput);
    if (res.success) {
      setIsLocked(false);
      setFormData((prev) => ({ ...prev, db_config_locked: false }));
      onSaveSettings({ ...formData, db_config_locked: false });
      setShowUnlockModal(false);
      setPinInput('');
      setPinError(null);
      showToast(res.message, 'success');
    } else {
      setPinError(res.message);
    }
  };

  const handleDirectAdminCentralUnlock = () => {
    storageService.unlockDbConfig('123456');
    const updated = {
      ...formData,
      db_config_locked: false,
    };
    setIsLocked(false);
    setFormData(updated);
    onSaveSettings(updated);
    setShowUnlockModal(false);
    setShowResetPinModal(false);
    setPinInput('');
    setPinError(null);
    showToast('Kunci konfigurasi database berhasil dibuka dengan Otoritas Admin Pusat.', 'success');
  };

  const handleLockNow = () => {
    storageService.lockDbConfig();
    const updated = {
      ...formData,
      db_config_locked: true,
    };
    setIsLocked(true);
    setFormData(updated);
    onSaveSettings(updated);
    showToast('Konfigurasi database berhasil dikunci kembali demi keamanan.', 'info');
  };

  const handleChangePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin !== confirmNewPin) {
      setChangePinError('Konfirmasi PIN baru tidak cocok!');
      return;
    }
    const res = storageService.changeDbConfigPin(oldPin, newPin);
    if (res.success) {
      setShowChangePinModal(false);
      setOldPin('');
      setNewPin('');
      setConfirmNewPin('');
      setChangePinError(null);
      showToast(res.message, 'success');
    } else {
      setChangePinError(res.message);
    }
  };

  const handleDirectResetToDefault = () => {
    const res = storageService.resetDbConfigPin('123456');
    if (res.success) {
      const updated = {
        ...formData,
        db_config_locked: false,
        db_config_pin: '123456',
      };
      setIsLocked(false);
      setFormData(updated);
      onSaveSettings(updated);
      setShowUnlockModal(false);
      setShowResetPinModal(false);
      setPinInput('');
      setPinError(null);
      showAlert(
        'PIN Berhasil Direset ke Default!',
        'PIN keamanan database telah diatur ulang menjadi 123456 dan konfigurasi database kini telah dibuka secara otomatis.',
        'success'
      );
    }
  };

  const handleCustomResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetNewPin || resetNewPin.trim().length < 4) {
      setResetPinError('PIN baru minimal harus 4 karakter!');
      return;
    }
    if (resetNewPin !== resetConfirmPin) {
      setResetPinError('Konfirmasi PIN baru tidak cocok!');
      return;
    }
    const res = storageService.resetDbConfigPin(resetNewPin);
    if (res.success) {
      const updated = {
        ...formData,
        db_config_locked: false,
        db_config_pin: resetNewPin.trim(),
      };
      setIsLocked(false);
      setFormData(updated);
      onSaveSettings(updated);
      setShowUnlockModal(false);
      setShowResetPinModal(false);
      setPinInput('');
      setPinError(null);
      setResetPinError(null);
      showAlert(
        'PIN Keamanan Berhasil Diperbarui!',
        res.message,
        'success'
      );
    } else {
      setResetPinError(res.message);
    }
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
    showLoading('Mengirim seluruh data pendaftar dan berkas ke Google Sheets...');
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
    showLoading('Menarik data terbaru dari Google Sheets & Database Server...');
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
    showLoading('Menyinkronkan semua berkas dokumen & pas foto ke Google Drive...');
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
          {/* Lock Status Pill */}
          {isLocked ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleDirectAdminCentralUnlock}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                title="Buka kunci database langsung (Otoritas Admin Pusat)"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Buka Kunci Database</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPinError(null);
                  setShowUnlockModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                title="Klik untuk membuka kunci edit link database"
              >
                <Lock className="w-3.5 h-3.5 text-amber-700" />
                <span>Link Terkunci (Buka Kunci)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setResetPinError(null);
                  setShowResetPinModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                title="Reset sandi / PIN kunci database"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                <span>Reset Sandi</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleLockNow}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                title="Klik untuk mengunci kembali konfigurasi"
              >
                <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                <span>Kunci Terbuka (Kunci Sekarang)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setResetPinError(null);
                  setShowResetPinModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                title="Reset atau atur ulang PIN keamanan"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                <span>Atur Ulang PIN</span>
              </button>
            </div>
          )}

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

          {/* Security Banner */}
          <div
            className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
              isLocked
                ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                  isLocked ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {isLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
              </div>
              <div>
                <h4 className="font-bold text-xs">
                  {isLocked
                    ? 'Konfigurasi Link Database Terkunci & Dilindungi'
                    : 'Mode Edit Terbuka (Link Database Dapat Diubah)'}
                </h4>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  {isLocked
                    ? 'Spreadsheet ID, Drive Folder ID, URL GAS, dan API Key saat ini dilindungi dari perubahan yang tidak disengaja. Buka kunci dengan PIN untuk mengedit.'
                    : 'Perubahan pada URL Web App GAS dan ID Database akan langsung tersimpan. Pastikan mengunci kembali setelah selesai mengedit.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {isLocked ? (
                <>
                  <button
                    type="button"
                    onClick={handleDirectAdminCentralUnlock}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5 ring-2 ring-emerald-500/20"
                    title="Buka kunci database langsung tanpa perlu input PIN"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Buka Kunci (Langsung)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPinError(null);
                      setShowUnlockModal(true);
                    }}
                    className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Input PIN</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setResetPinError(null);
                      setShowResetPinModal(true);
                    }}
                    className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                    <span>Reset Sandi / PIN</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setChangePinError(null);
                      setShowChangePinModal(true);
                    }}
                    className="px-3 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Ubah PIN Keamanan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setResetPinError(null);
                      setShowResetPinModal(true);
                    }}
                    className="px-3 py-2 bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset PIN</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLockNow}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Kunci Kembali Sekarang</span>
                  </button>
                </>
              )}
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
              {isLocked && (
                <span className="text-[11px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 font-bold flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  <span>Bidang Database Terkunci (Hanya Baca)</span>
                </span>
              )}
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
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Logo Aplikasi SIPMA (Upload Gambar / URL)
                </label>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    {formData.app_logo ? (
                      <div className="relative group">
                        <img
                          src={normalizeImageUrl(formData.app_logo)}
                          alt="Logo Aplikasi"
                          className="w-16 h-16 object-contain rounded-xl border border-slate-200 bg-white p-1 shadow-xs"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, app_logo: '' })}
                          title="Hapus Logo"
                          className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center text-xs shadow-md cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center text-slate-400 text-[10px] text-center p-1">
                        <ImageIcon className="w-5 h-5 mb-0.5 text-slate-300" />
                        <span>Tanpa Logo</span>
                      </div>
                    )}

                    <div className="flex-1 w-full space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Pilih File Gambar Logo</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/svg+xml,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                if (file.size > 2 * 1024 * 1024) {
                                  showAlert('Ukuran Logo Terlalu Besar', 'Batas maksimal ukuran file logo sistem adalah 2 MB.', 'warning');
                                  return;
                                }
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  if (typeof reader.result === 'string') {
                                    setFormData({ ...formData, app_logo: reader.result });
                                  }
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                        <span className="text-[11px] text-slate-500">Mendukung PNG, JPG, SVG, WebP (Maks. 2MB)</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="url"
                          value={formData.app_logo || ''}
                          onChange={(e) => setFormData({ ...formData, app_logo: e.target.value })}
                          placeholder="Atau masukkan URL gambar: https://example.com/logo.png"
                          className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Protected Database Link 1: GAS Web App URL */}
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                    {isLocked && <Lock className="w-3.5 h-3.5 text-amber-600" />}
                    <span>Google Apps Script Web App Deployment URL</span>
                  </label>
                  {isLocked && (
                    <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-bold">
                      Terkunci
                    </span>
                  )}
                </div>
                <input
                  type="url"
                  disabled={isLocked}
                  value={formData.gas_web_app_url}
                  onChange={(e) => setFormData({ ...formData, gas_web_app_url: e.target.value })}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className={`w-full px-3.5 py-2.5 rounded-xl font-mono outline-none transition-all ${
                    isLocked
                      ? 'bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed'
                      : 'bg-white text-slate-900 border border-emerald-400 focus:ring-2 focus:ring-emerald-500 shadow-xs'
                  }`}
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Dapatkan URL ini setelah menerapkan kode Code.gs sebagai Web App di Google Apps Script (Who has access: Anyone).
                </p>
              </div>

              {/* Protected Database Link 2: Google Spreadsheet ID */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                    {isLocked && <Lock className="w-3.5 h-3.5 text-amber-600" />}
                    <span>Google Spreadsheet ID (Database) *</span>
                  </label>
                  <div className="flex items-center gap-1.5">
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
                    {isLocked && (
                      <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-bold">
                        Terkunci
                      </span>
                    )}
                  </div>
                </div>
                <input
                  type="text"
                  disabled={isLocked}
                  value={formData.spreadsheet_id}
                  onChange={(e) => setFormData({ ...formData, spreadsheet_id: e.target.value })}
                  className={`w-full px-3.5 py-2.5 rounded-xl font-mono outline-none transition-all ${
                    isLocked
                      ? 'bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed'
                      : 'bg-white text-slate-900 border border-emerald-400 focus:ring-2 focus:ring-emerald-500 shadow-xs'
                  }`}
                  required
                />
              </div>

              {/* Protected Database Link 3: Google Drive Root Folder ID */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                    {isLocked && <Lock className="w-3.5 h-3.5 text-amber-600" />}
                    <span>Google Drive Root Folder ID (Storage) *</span>
                  </label>
                  <div className="flex items-center gap-1.5">
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
                    {isLocked && (
                      <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-bold">
                        Terkunci
                      </span>
                    )}
                  </div>
                </div>
                <input
                  type="text"
                  disabled={isLocked}
                  value={formData.drive_root_folder_id}
                  onChange={(e) => setFormData({ ...formData, drive_root_folder_id: e.target.value })}
                  className={`w-full px-3.5 py-2.5 rounded-xl font-mono outline-none transition-all ${
                    isLocked
                      ? 'bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed'
                      : 'bg-white text-slate-900 border border-emerald-400 focus:ring-2 focus:ring-emerald-500 shadow-xs'
                  }`}
                  required
                />
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
              <div className="text-xs text-slate-500">
                {isLocked ? (
                  <span>🔒 Pengaturan link terlindungi. Klik tombol &quot;Buka Kunci&quot; di atas untuk merubah.</span>
                ) : (
                  <span className="text-emerald-700 font-semibold">🔓 Mode edit terbuka. Jangan lupa klik simpan dan kunci kembali.</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Seluruh Konfigurasi</span>
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
                          const res = storageService.importDatabaseBackup(content);
                          if (res.success) {
                            showAlert('Restore Sukses', res.message, 'success');
                            window.location.reload();
                          } else {
                            showAlert('Restore Gagal', res.message, 'error');
                          }
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
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Kode Sumber Backend Google Apps Script (Code.gs)
              </h3>
              <p className="text-xs text-slate-500">
                Salin seluruh kode di bawah dan tempel ke Apps Script project Anda di script.google.com.
              </p>
            </div>

            <button
              type="button"
              onClick={handleCopyCode}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedCode ? 'Tersalin ke Clipboard!' : 'Salin Seluruh Kode'}</span>
            </button>
          </div>

          <pre className="p-4 bg-slate-900 text-emerald-300 font-mono text-xs rounded-xl overflow-x-auto max-h-[500px] leading-relaxed select-all">
            {GAS_BACKEND_CODE}
          </pre>
        </div>
      )}

      {/* ================= MODAL UNLOCK PIN ================= */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold shrink-0">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Buka Kunci Konfigurasi</h3>
                  <p className="text-xs text-slate-500">Masukkan PIN Keamanan / Password Admin</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowUnlockModal(false);
                  setPinInput('');
                  setPinError(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-950 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                <HelpCircle className="w-4 h-4 text-emerald-700" />
                <span>Petunjuk Akses Kunci</span>
              </div>
              <p className="text-emerald-800 leading-relaxed text-[11px]">
                PIN bawaan sistem adalah <span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-emerald-300">123456</span>. Anda juga dapat menggunakan kata sandi login akun Admin Pusat Anda.
              </p>
            </div>

            <form onSubmit={handleUnlockSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  PIN Keamanan / Sandi Master
                </label>
                <div className="relative">
                  <input
                    type={showPinInputText ? 'text' : 'password'}
                    autoFocus
                    maxLength={20}
                    value={pinInput}
                    onChange={(e) => {
                      setPinInput(e.target.value);
                      setPinError(null);
                    }}
                    placeholder="Masukkan PIN (123456) / Sandi"
                    className="w-full pl-4 pr-11 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-center text-lg font-mono tracking-widest focus:ring-2 focus:ring-emerald-500 outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPinInputText(!showPinInputText)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-1"
                    title={showPinInputText ? 'Sembunyikan' : 'Tampilkan'}
                  >
                    {showPinInputText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {pinError && (
                  <p className="text-[11px] text-rose-600 font-bold mt-1.5 text-center leading-snug">{pinError}</p>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowUnlockModal(false);
                    setPinInput('');
                    setPinError(null);
                  }}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  Buka Kunci Sekarang
                </button>
              </div>

              {/* Direct 1-Click Unlock for Admin Central */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleDirectAdminCentralUnlock}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Buka Kunci Otoritas Admin Pusat (1-Klik)</span>
                </button>
              </div>
            </form>

            {/* Reset option footer */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
              <span className="text-slate-500">Lupa PIN atau ingin ganti?</span>
              <button
                type="button"
                onClick={() => {
                  setShowUnlockModal(false);
                  setResetPinError(null);
                  setShowResetPinModal(true);
                }}
                className="text-amber-700 hover:text-amber-900 font-bold inline-flex items-center gap-1 hover:underline cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Sandi / PIN</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL RESET PIN ================= */}
      {showResetPinModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold shrink-0">
                  <RotateCcw className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Reset Sandi / PIN Database</h3>
                  <p className="text-xs text-slate-500">Atur ulang PIN keamanan konfigurasi sistem</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowResetPinModal(false);
                  setResetPinError(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5 text-amber-900">
                <ShieldCheck className="w-4 h-4 text-amber-700" />
                <span>Otoritas Admin Pusat</span>
              </div>
              <p className="text-amber-800 text-[11px] leading-relaxed">
                Sebagai Admin Pusat, Anda dapat langsung mengembalikan PIN ke setelan bawaan pabrik (<strong>123456</strong>) atau menentukan PIN baru pilihan Anda tanpa memerlukan PIN lama.
              </p>
            </div>

            {/* Quick 1-Click Reset to Default Button */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-slate-900">Reset Cepat ke Default (123456)</h4>
                <p className="text-[11px] text-slate-500">Kembalikan PIN ke 123456 dan buka kunci seketika</p>
              </div>
              <button
                type="button"
                onClick={handleDirectResetToDefault}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset ke 123456</span>
              </button>
            </div>

            <div className="relative flex py-1 items-center">
              <div className="grow border-t border-slate-200"></div>
              <span className="shrink mx-3 text-slate-400 text-[11px] font-bold uppercase">Atau Buat PIN Baru</span>
              <div className="grow border-t border-slate-200"></div>
            </div>

            <form onSubmit={handleCustomResetSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">PIN Baru (Min. 4 digit angka/huruf)</label>
                <input
                  type="text"
                  value={resetNewPin}
                  onChange={(e) => setResetNewPin(e.target.value)}
                  placeholder="Contoh: 123456 atau 889900"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-base focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Konfirmasi PIN Baru</label>
                <input
                  type="text"
                  value={resetConfirmPin}
                  onChange={(e) => setResetConfirmPin(e.target.value)}
                  placeholder="Ulangi PIN baru"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-base focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                />
              </div>

              {resetPinError && (
                <p className="text-[11px] text-rose-600 font-bold text-center">{resetPinError}</p>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetPinModal(false);
                    setResetPinError(null);
                  }}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  Simpan & Buka Kunci
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL CHANGE PIN ================= */}
      {showChangePinModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center font-bold shrink-0">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Ubah PIN Keamanan</h3>
                <p className="text-xs text-slate-500">Perbarui PIN kunci konfigurasi</p>
              </div>
            </div>

            <form onSubmit={handleChangePinSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">PIN Lama (atau 123456)</label>
                <input
                  type="password"
                  value={oldPin}
                  onChange={(e) => setOldPin(e.target.value)}
                  placeholder="PIN saat ini"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">PIN Baru (Min. 4 digit)</label>
                <input
                  type="password"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="PIN baru"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Konfirmasi PIN Baru</label>
                <input
                  type="password"
                  value={confirmNewPin}
                  onChange={(e) => setConfirmNewPin(e.target.value)}
                  placeholder="Ulangi PIN baru"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                />
              </div>

              {changePinError && (
                <div className="space-y-1">
                  <p className="text-[11px] text-rose-600 font-bold text-center">{changePinError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowChangePinModal(false);
                      setShowResetPinModal(true);
                    }}
                    className="text-[11px] text-indigo-600 hover:underline block mx-auto font-bold"
                  >
                    Gunakan Menu Reset PIN
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowChangePinModal(false);
                    setOldPin('');
                    setNewPin('');
                    setConfirmNewPin('');
                    setChangePinError(null);
                  }}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  Simpan PIN Baru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
