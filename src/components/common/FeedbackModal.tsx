import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X, HelpCircle, Sparkles } from 'lucide-react';

export type FeedbackType = 'success' | 'error' | 'warning' | 'info' | 'confirm';

export interface ModalConfig {
  isOpen: boolean;
  type: FeedbackType;
  title: string;
  message: string;
  details?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  title?: string;
  durationMs?: number;
}

interface FeedbackModalProps {
  config: ModalConfig | null;
  onClose: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ config, onClose }) => {
  if (!config || !config.isOpen) return null;

  const {
    type,
    title,
    message,
    details,
    confirmLabel = type === 'confirm' ? 'Lanjutkan' : 'Mengerti',
    cancelLabel = 'Batal',
    onConfirm,
    onCancel,
  } = config;

  const getStyle = () => {
    switch (type) {
      case 'success':
        return {
          icon: CheckCircle2,
          iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-200 ring-4 ring-emerald-500/10',
          btnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20',
          accentColor: 'text-emerald-900',
        };
      case 'error':
        return {
          icon: AlertCircle,
          iconBg: 'bg-rose-50 text-rose-600 border-rose-200 ring-4 ring-rose-500/10',
          btnClass: 'bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20',
          accentColor: 'text-rose-900',
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          iconBg: 'bg-amber-50 text-amber-600 border-amber-200 ring-4 ring-amber-500/10',
          btnClass: 'bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20',
          accentColor: 'text-amber-900',
        };
      case 'confirm':
        return {
          icon: HelpCircle,
          iconBg: 'bg-blue-50 text-blue-600 border-blue-200 ring-4 ring-blue-500/10',
          btnClass: 'bg-slate-900 hover:bg-slate-800 text-white shadow-md shadow-slate-900/20',
          accentColor: 'text-slate-900',
        };
      case 'info':
      default:
        return {
          icon: Info,
          iconBg: 'bg-indigo-50 text-indigo-600 border-indigo-200 ring-4 ring-indigo-500/10',
          btnClass: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20',
          accentColor: 'text-indigo-900',
        };
    }
  };

  const style = getStyle();
  const Icon = style.icon;

  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    onClose();
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 text-center relative animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Close icon on corner */}
        <button
          type="button"
          onClick={handleCancel}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon Header */}
        <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-xs ${style.iconBg}`}>
            <Icon className="w-7 h-7" />
          </div>
        </div>

        {/* Title */}
        <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-snug">
          {title}
        </h3>

        {/* Message */}
        <div className="text-xs sm:text-sm text-slate-600 mt-2.5 font-normal leading-relaxed text-balance">
          {message}
        </div>

        {/* Optional Details Box */}
        {details && (
          <div className="mt-3.5 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-left text-xs text-slate-700 font-mono overflow-auto max-h-32">
            {details}
          </div>
        )}

        {/* Actions */}
        <div className={`mt-6 flex items-center gap-3 ${type === 'confirm' ? 'justify-end' : 'justify-center'}`}>
          {type === 'confirm' && (
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              {cancelLabel}
            </button>
          )}

          <button
            type="button"
            onClick={handleConfirm}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              type === 'confirm' ? 'flex-1' : 'w-full'
            } ${style.btnClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export const ToastContainer: React.FC<{
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}> = ({ toasts, onDismiss }) => {
  if (!toasts || toasts.length === 0) return null;

  // Show the latest toast centered in a modal dialogue presentation
  const activeToast = toasts[toasts.length - 1];
  const totalQueued = toasts.length;

  const getToastStyle = () => {
    switch (activeToast.type) {
      case 'success':
        return {
          icon: CheckCircle2,
          iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-200 ring-4 ring-emerald-500/10',
          btnBg: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20',
          titleColor: 'text-emerald-950',
          progressBar: 'bg-emerald-500',
          defaultTitle: 'Pemberitahuan Sukses',
        };
      case 'error':
        return {
          icon: AlertCircle,
          iconBg: 'bg-rose-50 text-rose-600 border-rose-200 ring-4 ring-rose-500/10',
          btnBg: 'bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20',
          titleColor: 'text-rose-950',
          progressBar: 'bg-rose-500',
          defaultTitle: 'Terjadi Kendala',
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          iconBg: 'bg-amber-50 text-amber-600 border-amber-200 ring-4 ring-amber-500/10',
          btnBg: 'bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20',
          titleColor: 'text-amber-950',
          progressBar: 'bg-amber-500',
          defaultTitle: 'Pemberitahuan Penting',
        };
      case 'info':
      default:
        return {
          icon: Info,
          iconBg: 'bg-indigo-50 text-indigo-600 border-indigo-200 ring-4 ring-indigo-500/10',
          btnBg: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20',
          titleColor: 'text-indigo-950',
          progressBar: 'bg-indigo-500',
          defaultTitle: 'Informasi Sistem',
        };
    }
  };

  const style = getToastStyle();
  const Icon = style.icon;

  return (
    <div
      className="fixed inset-0 z-[99990] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        className="bg-white rounded-3xl max-w-sm sm:max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 text-center relative overflow-hidden animate-in zoom-in-95 duration-200"
        role="alertdialog"
      >
        {/* Close Button Top Right */}
        <button
          type="button"
          onClick={() => onDismiss(activeToast.id)}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          title="Tutup Notifikasi"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Queue badge if multiple toasts */}
        {totalQueued > 1 && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-600 mb-3">
            <Sparkles className="w-3 h-3 text-emerald-600" />
            <span>Pemberitahuan {totalQueued} Baru</span>
          </div>
        )}

        {/* Centered Icon Header */}
        <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-3.5">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-xs ${style.iconBg}`}>
            <Icon className="w-7 h-7" />
          </div>
        </div>

        {/* Title */}
        <h3 className={`text-base sm:text-lg font-black tracking-tight leading-snug ${style.titleColor}`}>
          {activeToast.title || style.defaultTitle}
        </h3>

        {/* Message */}
        <p className="text-xs sm:text-sm text-slate-600 mt-2.5 font-normal leading-relaxed text-balance">
          {activeToast.message}
        </p>

        {/* Action Button */}
        <div className="mt-6">
          <button
            type="button"
            onClick={() => onDismiss(activeToast.id)}
            className={`w-full py-2.5 px-5 rounded-xl font-bold text-xs transition-all cursor-pointer ${style.btnBg}`}
          >
            {totalQueued > 1 ? 'Lanjutkan ke Pesan Berikutnya' : 'Mengerti'}
          </button>
        </div>
      </div>
    </div>
  );
};

