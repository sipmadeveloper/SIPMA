import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  X,
  FlipHorizontal,
  Upload,
  Keyboard,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Scan,
  RefreshCw,
  Sparkles,
  Zap,
} from 'lucide-react';
import { parseVerificationQr, playScanSuccessChime } from '../../utils/qrVerification';
import { storageService } from '../../services/storageService';
import { Application, StudentProfile } from '../../types/sipma';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (registrationNumber: string) => void;
  schoolId?: string;
}

export const QRScannerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onScanSuccess,
  schoolId,
}) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'upload' | 'manual'>('camera');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [manualInput, setManualInput] = useState<string>('');
  const [detectedResult, setDetectedResult] = useState<{
    regNumber: string;
    studentName?: string;
    schoolName?: string;
    pathway?: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const hasTriggeredRef = useRef<boolean>(false);

  // Stop camera stream safely
  const stopCamera = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  }, []);

  // Handle successful match
  const handleFoundRegistration = useCallback(
    (regNumber: string) => {
      if (hasTriggeredRef.current) return;
      hasTriggeredRef.current = true;

      playScanSuccessChime();

      // Look up student details for preview feedback
      const allApps = storageService.getApplications();
      const allStudents = storageService.getStudentsMap();
      const allSchools = storageService.getSchools();

      const matchedApp = allApps.find(
        (a) => a.registration_number.toLowerCase() === regNumber.toLowerCase()
      );
      const matchedStudent = matchedApp ? allStudents[matchedApp.registration_number] : null;
      const matchedSchool = matchedApp
        ? allSchools.find((s) => s.school_id === matchedApp.school_id)
        : null;

      setDetectedResult({
        regNumber: matchedApp?.registration_number || regNumber,
        studentName: matchedStudent?.name || 'Calon Murid',
        schoolName: matchedSchool?.school_name,
        pathway: matchedApp?.pathway,
      });

      // Automatically trigger verification flow after short feedback animation
      setTimeout(() => {
        stopCamera();
        onScanSuccess(matchedApp?.registration_number || regNumber);
        onClose();
      }, 700);
    },
    [onScanSuccess, onClose, stopCamera]
  );

  // Scan frame loop
  const scanLoop = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || hasTriggeredRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        const parsed = parseVerificationQr(code.data);
        if (parsed && parsed.regNumber) {
          handleFoundRegistration(parsed.regNumber);
          return;
        }
      }
    }

    if (!hasTriggeredRef.current) {
      animFrameIdRef.current = requestAnimationFrame(scanLoop);
    }
  }, [handleFoundRegistration]);

  // Start camera stream
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);
    hasTriggeredRef.current = false;
    setDetectedResult(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Akses kamera tidak didukung di browser ini.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setIsScanning(true);
        animFrameIdRef.current = requestAnimationFrame(scanLoop);
      }
    } catch (err: any) {
      console.warn('Camera error:', err);
      let msg = 'Gagal mengakses kamera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Izin kamera ditolak. Silakan izinkan akses kamera di pengaturan browser.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'Kamera tidak ditemukan pada perangkat ini.';
      }
      setCameraError(msg);
      setIsScanning(false);
    }
  }, [facingMode, stopCamera, scanLoop]);

  // Handle active tab or open/close state
  useEffect(() => {
    if (isOpen) {
      hasTriggeredRef.current = false;
      setDetectedResult(null);
      if (activeTab === 'camera') {
        startCamera();
      }
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab, facingMode, startCamera, stopCamera]);

  // Toggle front/back camera
  const handleToggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Decode from uploaded image file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });

        if (code && code.data) {
          const parsed = parseVerificationQr(code.data);
          if (parsed && parsed.regNumber) {
            handleFoundRegistration(parsed.regNumber);
          } else {
            alert('QR code terdeteksi namun format nomor pendaftaran tidak valid.');
          }
        } else {
          alert('Tidak dapat mendeteksi QR Code dari gambar yang diunggah. Pastikan QR code terlihat jelas dan terang.');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Handle manual input submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    const parsed = parseVerificationQr(manualInput.trim()) || {
      regNumber: manualInput.trim(),
      sourceType: 'raw' as const,
    };
    handleFoundRegistration(parsed.regNumber);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 my-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-800 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center text-white">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight">
                Pindai QR Bukti Pendaftaran
              </h3>
              <p className="text-xs text-emerald-200 mt-0.5">
                Verifikasi otomatis berkas calon murid SIPMA
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="flex border-b border-slate-100 bg-slate-50/75 p-1 gap-1 text-xs font-bold text-slate-600">
          <button
            type="button"
            onClick={() => setActiveTab('camera')}
            className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'camera'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'hover:bg-slate-100 text-slate-600'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Kamera Live</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'upload'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'hover:bg-slate-100 text-slate-600'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Unggah Foto QR</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'manual'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'hover:bg-slate-100 text-slate-600'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>Barcode / Manual</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6">
          {/* 1. CAMERA TAB */}
          {activeTab === 'camera' && (
            <div className="space-y-4">
              <div className="relative aspect-square max-h-[320px] mx-auto rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center shadow-inner border-2 border-emerald-500/30">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  playsInline
                  muted
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Viewfinder Target Box Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-56 h-56 border-2 border-emerald-400 rounded-2xl relative shadow-lg">
                    {/* Corner accents */}
                    <div className="absolute -top-1.5 -left-1.5 w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl-sm" />
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr-sm" />
                    <div className="absolute -bottom-1.5 -left-1.5 w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl-sm" />
                    <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br-sm" />

                    {/* Animated Scanning Laser Line */}
                    {isScanning && !detectedResult && (
                      <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_10px_#10b981] animate-pulse relative top-1/2 -translate-y-1/2" />
                    )}
                  </div>
                </div>

                {/* Camera Error Message */}
                {cameraError && (
                  <div className="absolute inset-0 bg-slate-900/90 text-white p-6 flex flex-col items-center justify-center text-center space-y-3">
                    <AlertCircle className="w-10 h-10 text-rose-400" />
                    <div className="text-xs text-slate-200">{cameraError}</div>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Coba Lagi
                    </button>
                  </div>
                )}

                {/* Detected Success Overlay */}
                {detectedResult && (
                  <div className="absolute inset-0 bg-emerald-950/85 backdrop-blur-xs text-white p-6 flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-200">
                    <div className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg mb-2">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                      QR Terverifikasi Resmi
                    </div>
                    <div className="text-base font-extrabold text-white mt-1">
                      {detectedResult.studentName}
                    </div>
                    <div className="text-xs font-mono text-emerald-200 mt-0.5">
                      {detectedResult.regNumber}
                    </div>
                    <div className="text-[11px] text-slate-300 mt-2">
                      Membuka proses verifikasi berkas...
                    </div>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleToggleFacingMode}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  title="Ganti Kamera Depan / Belakang"
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                  <span>Kamera: {facingMode === 'environment' ? 'Belakang' : 'Depan'}</span>
                </button>

                <div className="text-[11px] text-slate-500 font-medium text-right">
                  Arahkan kotak ke QR Code pada lembar bukti cetak
                </div>
              </div>
            </div>
          )}

          {/* 2. UPLOAD FILE TAB */}
          {activeTab === 'upload' && (
            <div className="space-y-4 text-center py-4">
              <label
                htmlFor="qr-file-input"
                className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/50 hover:bg-emerald-50 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all"
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800">
                    Pilih Berkas atau Seret Foto QR Code
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Mendukung format JPG, PNG, WEBP (foto bukti pendaftaran fisik)
                  </div>
                </div>
                <input
                  id="qr-file-input"
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* 3. MANUAL / BARCODE GUN TAB */}
          {activeTab === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-4 py-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nomor Pendaftaran / Input Barcode Scanner
                </label>
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Contoh: SIPMA-MI02-000001 atau REG-..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                  autoFocus
                />
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Bisa menggunakan alat <em>Barcode Scanner Gun USB</em> atau ketik nomor pendaftaran lalu tekan Enter.
                </p>
              </div>

              <button
                type="submit"
                disabled={!manualInput.trim()}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Buka Verifikasi Berkas</span>
              </button>
            </form>
          )}

          {/* Security note */}
          <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5 text-[11px] text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong>Validasi Cepat:</strong> Setiap bukti pendaftaran memiliki kode unik QR
              yang terenkripsi. Saat dipindai oleh Panitia, formulir verifikasi berkas langsung terbuka otomatis.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
