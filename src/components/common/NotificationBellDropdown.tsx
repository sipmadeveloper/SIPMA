import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  CheckCheck,
  Sparkles,
  Volume2,
  VolumeX,
  ExternalLink,
  GraduationCap,
  User,
  Clock,
  X,
} from 'lucide-react';
import { NewApplicantItem, isNotificationSoundEnabled, setNotificationSoundEnabled, playApplicantArrivalChime } from './NewApplicantNotificationBanner';
import { formatDistanceIndonesian } from '../../utils/geo';
import { normalizeImageUrl, handleImageError } from '../../utils/imageUrl';

interface Props {
  notifications: NewApplicantItem[];
  unreadCount: number;
  onOpenApplicant: (regNumber: string) => void;
  onMarkAllAsRead: () => void;
}

export const NotificationBellDropdown: React.FC<Props> = ({
  notifications,
  unreadCount,
  onOpenApplicant,
  onMarkAllAsRead,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(() => isNotificationSoundEnabled());
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const toggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !soundOn;
    setSoundOn(next);
    setNotificationSoundEnabled(next);
    if (next) {
      playApplicantArrivalChime();
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-xl border transition-all cursor-pointer ${
          isOpen
            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
            : 'text-slate-600 hover:text-emerald-800 hover:bg-slate-100 border-transparent hover:border-slate-200'
        }`}
        title="Notifikasi Pendaftar Baru Masuk"
        aria-label="Buka Notifikasi Pendaftar Baru"
        aria-expanded={isOpen}
      >
        <Bell className="w-4 h-4" />

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-600 text-[9px] font-black text-white shadow-xs animate-in zoom-in-50 duration-200">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-3.5 bg-gradient-to-r from-emerald-800 to-teal-800 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                <Bell className="w-4 h-4 text-emerald-100" />
              </div>
              <div>
                <h4 className="text-xs font-black tracking-tight leading-none">
                  Pendaftar Masuk Realtime
                </h4>
                <p className="text-[10px] text-emerald-200 mt-0.5">
                  {unreadCount > 0 ? `${unreadCount} pendaftar baru belum dibuka` : 'Semua pendaftar sudah ditinjau'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleSound}
                className="p-1.5 rounded-lg text-emerald-100 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
                title={soundOn ? 'Bunyi Notifikasi: Aktif' : 'Bunyi Notifikasi: Senyap'}
              >
                {soundOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5 opacity-60" />}
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-emerald-100 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
                title="Tutup"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Actions Ribbon */}
          {unreadCount > 0 && (
            <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-end text-xs">
              <button
                type="button"
                onClick={onMarkAllAsRead}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 ml-auto cursor-pointer"
              >
                <CheckCheck className="w-3 h-3 text-emerald-600" />
                <span>Tandai Semua Dibaca</span>
              </button>
            </div>
          )}

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 mx-auto flex items-center justify-center mb-2">
                  <Sparkles className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-slate-700">Belum Ada Pendaftar Baru</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-[220px] mx-auto leading-relaxed">
                  Notifikasi toast dan banner akan otomatis muncul segera saat calon murid baru mendaftar ke madrasah.
                </p>
              </div>
            ) : (
              notifications.slice(0, 10).map((item) => {
                const app = item.application;
                const stu = item.student;
                const timeAgo = formatTimeAgo(item.timestamp);

                return (
                  <div
                    key={item.id}
                    className="p-3 hover:bg-slate-50 transition-colors flex items-start gap-3 group"
                  >
                    {/* Avatar */}
                    <div className="shrink-0 mt-0.5">
                      {stu?.photo_url ? (
                        <img
                          src={normalizeImageUrl(stu.photo_url)}
                          alt={stu.name}
                          className="w-9 h-9 rounded-xl object-cover border border-slate-200"
                          referrerPolicy="no-referrer"
                          onError={(e) => handleImageError(e)}
                        />
                      ) : (
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                            stu?.gender === 'P'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          <User className="w-4 h-4" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-black text-slate-900 truncate">
                          {stu?.name || 'Calon Murid'}
                        </span>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                          {timeAgo}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                          {app.registration_number}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium capitalize">
                          &bull; {app.pathway}
                        </span>
                      </div>

                      {item.schoolName && (
                        <div className="text-[10px] text-slate-400 truncate mt-0.5 flex items-center gap-1">
                          <GraduationCap className="w-2.5 h-2.5" />
                          <span>{item.schoolName}</span>
                        </div>
                      )}

                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onOpenApplicant(app.registration_number);
                            setIsOpen(false);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                        >
                          <span>Buka Berkas</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

function formatTimeAgo(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'Baru saja';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m lalu`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}j lalu`;
  return `${Math.floor(diffHours / 24)}h lalu`;
}
