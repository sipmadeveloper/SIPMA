import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bell,
  X,
  CheckCircle2,
  User,
  MapPin,
  Sparkles,
  Volume2,
  VolumeX,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  GraduationCap,
} from 'lucide-react';
import { Application, StudentProfile, School, PathwayType } from '../../types/sipma';
import { formatDistanceIndonesian } from '../../utils/geo';
import { normalizeImageUrl, handleImageError } from '../../utils/imageUrl';

export interface NewApplicantItem {
  id: string;
  registrationNumber: string;
  application: Application;
  student?: StudentProfile | null;
  schoolName?: string;
  timestamp: number;
}

// Sound notification preference helper
const SOUND_STORAGE_KEY = 'sipma_applicant_notify_sound';

export function isNotificationSoundEnabled(): boolean {
  try {
    const val = localStorage.getItem(SOUND_STORAGE_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function setNotificationSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(SOUND_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {}
}

// Gentle, professional notification chime using Web Audio API synthesis
export function playApplicantArrivalChime(): void {
  if (!isNotificationSoundEnabled()) return;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Tone 1: E5 (~659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.08, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Tone 2: A5 (~880 Hz) - uplifting melodic interval
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.1);
    gain2.gain.setValueAtTime(0.09, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.5);
  } catch {
    // Graceful fallback if autoplay restrictions prevent audio
  }
}

interface BannerProps {
  queue: NewApplicantItem[];
  schools: School[];
  onOpenApplicant: (regNumber: string) => void;
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
}

export const NewApplicantNotificationBanner: React.FC<BannerProps> = ({
  queue,
  schools,
  onOpenApplicant,
  onDismiss,
  onDismissAll,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [soundOn, setSoundOn] = useState(() => isNotificationSoundEnabled());
  const [progress, setProgress] = useState(100);

  const activeItem = queue[currentIndex] || queue[0];
  const autoDismissDuration = 12000; // 12 seconds per item

  // Keep index within bounds if items are dismissed
  useEffect(() => {
    if (currentIndex >= queue.length && queue.length > 0) {
      setCurrentIndex(queue.length - 1);
    }
  }, [queue.length, currentIndex]);

  // Reset progress bar whenever the active item changes
  useEffect(() => {
    setProgress(100);
  }, [activeItem?.id]);

  // Countdown timer with pause on hover
  useEffect(() => {
    if (!activeItem || isHovered) return;

    const intervalMs = 100;
    const step = (intervalMs / autoDismissDuration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= step) {
          clearInterval(timer);
          onDismiss(activeItem.id);
          return 0;
        }
        return prev - step;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [activeItem, isHovered, autoDismissDuration, onDismiss]);

  const toggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !soundOn;
    setSoundOn(next);
    setNotificationSoundEnabled(next);
  };

  if (!activeItem) return null;

  const app = activeItem.application;
  const student = activeItem.student;
  const school =
    schools.find((s) => s.school_id === app.school_id) ||
    (activeItem.schoolName ? { school_name: activeItem.schoolName } : null);

  const getPathwayBadge = (pathway?: PathwayType | string) => {
    switch (pathway) {
      case 'afirmasi':
        return { label: 'Jalur Afirmasi', color: 'bg-amber-100 text-amber-900 border-amber-300' };
      case 'prestasi':
        return { label: 'Jalur Prestasi', color: 'bg-purple-100 text-purple-900 border-purple-300' };
      case 'mutasi':
        return { label: 'Jalur Mutasi', color: 'bg-blue-100 text-blue-900 border-blue-300' };
      case 'zonasi':
      default:
        return { label: 'Jalur Zonasi', color: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
    }
  };

  const pathwayInfo = getPathwayBadge(app.pathway);
  const totalInQueue = queue.length;

  return (
    <aside
      aria-label="Pemberitahuan Pendaftar Baru"
      className="fixed top-20 right-3 sm:right-6 z-[9999] max-w-sm sm:max-w-md w-full pointer-events-auto"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="bg-white/98 backdrop-blur-md rounded-2xl shadow-2xl shadow-emerald-950/20 border-2 border-emerald-500/80 overflow-hidden ring-4 ring-emerald-500/10 transition-all transform animate-in slide-in-from-top-4 fade-in duration-300">
        {/* Animated Progress Bar */}
        <div className="w-full bg-slate-100 h-1 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 px-4 py-2.5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Pulsing Live Dot */}
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-300 ring-2 ring-white/50" />
            </span>
            <span className="font-extrabold text-xs tracking-wider uppercase text-emerald-100 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              Pendaftar Baru Masuk
            </span>
            {totalInQueue > 1 && (
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold text-white">
                {currentIndex + 1} dari {totalInQueue}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Sound Mute/Unmute */}
            <button
              type="button"
              onClick={toggleSound}
              className="p-1 rounded-lg text-emerald-100 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
              title={soundOn ? 'Bunyi Notifikasi: Aktif (Klik untuk matikan)' : 'Bunyi Notifikasi: Senyap (Klik untuk aktifkan)'}
              aria-label={soundOn ? 'Matikan Bunyi Notifikasi' : 'Nyalakan Bunyi Notifikasi'}
            >
              {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-emerald-300/80" />}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => onDismiss(activeItem.id)}
              className="p-1 rounded-lg text-emerald-100 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
              title="Tutup pemberitahuan ini"
              aria-label="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body Card */}
        <div className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            {/* Student Avatar / Photo */}
            <div className="shrink-0">
              {student?.photo_url ? (
                <img
                  src={normalizeImageUrl(student.photo_url)}
                  alt={student.name}
                  className="w-12 h-12 rounded-xl object-cover border-2 border-emerald-200 shadow-xs bg-slate-50"
                  referrerPolicy="no-referrer"
                  onError={(e) => handleImageError(e)}
                />
              ) : (
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-base shadow-xs ${
                    student?.gender === 'P'
                      ? 'bg-rose-100 text-rose-700 border border-rose-200'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  <User className="w-6 h-6" />
                </div>
              )}
            </div>

            {/* Applicant Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${pathwayInfo.color}`}>
                  {pathwayInfo.label}
                </span>
                {app.distance_km !== undefined && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                    <MapPin className="w-3 h-3 text-emerald-600" />
                    {formatDistanceIndonesian(app.distance_km)}
                  </span>
                )}
              </div>

              <h4 className="text-sm font-black text-slate-900 truncate mt-1">
                {student?.name || 'Calon Murid Baru'}
              </h4>

              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-600">
                <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  {app.registration_number}
                </span>
                {student?.gender && (
                  <span className="text-[11px] text-slate-500 font-medium">
                    ({student.gender === 'L' ? 'Laki-laki' : 'Perempuan'})
                  </span>
                )}
              </div>

              {school?.school_name && (
                <div className="text-[11px] text-slate-500 truncate mt-1 flex items-center gap-1">
                  <GraduationCap className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="truncate">{school.school_name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Queue Navigation if more than 1 */}
          {totalInQueue > 1 && (
            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 text-slate-500">
              <span>{totalInQueue} berkas masuk baru</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentIndex((prev) => (prev > 0 ? prev - 1 : totalInQueue - 1))}
                  className="p-1 hover:bg-slate-100 rounded text-slate-600 cursor-pointer"
                  title="Pendaftar sebelumnya"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono font-bold text-[11px] text-slate-700">
                  {currentIndex + 1} / {totalInQueue}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentIndex((prev) => (prev < totalInQueue - 1 ? prev + 1 : 0))}
                  className="p-1 hover:bg-slate-100 rounded text-slate-600 cursor-pointer"
                  title="Pendaftar berikutnya"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                onOpenApplicant(app.registration_number);
                onDismiss(activeItem.id);
              }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-md shadow-emerald-700/20 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Buka & Verifikasi Berkas</span>
            </button>

            {totalInQueue > 1 ? (
              <button
                type="button"
                onClick={onDismissAll}
                className="py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-semibold transition-colors cursor-pointer"
              >
                Tutup Semua
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onDismiss(activeItem.id)}
                className="py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-semibold transition-colors cursor-pointer"
              >
                Nanti
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
