import React from 'react';
import {
  X,
  MapPin,
  Compass,
  CheckCircle2,
  XCircle,
  Copy,
  ExternalLink,
  Navigation,
  School as SchoolIcon,
} from 'lucide-react';
import { Application, StudentProfile, School, AddressData } from '../../types/sipma';
import { formatDistanceIndonesian, formatCoordinates, checkZoningCompliance } from '../../utils/geo';
import { InteractiveLocationPicker } from '../map/InteractiveLocationPicker';
import { useFeedback } from '../../context/FeedbackContext';

interface Props {
  application: Application;
  student?: StudentProfile | null;
  school: School;
  address?: AddressData | null;
  onClose: () => void;
}

export const ApplicantLocationModal: React.FC<Props> = ({
  application,
  student,
  school,
  address,
  onClose,
}) => {
  const { showToast } = useFeedback();
  const effectiveRadius = school?.zoning_radius_km || application.max_distance_km || 5.0;
  const isCompliant = checkZoningCompliance(application.distance_km, effectiveRadius) && application.zoning_status === 'memenuhi';

  const copyCoordinates = () => {
    const coords = `${application.latitude}, ${application.longitude}`;
    navigator.clipboard?.writeText(coords);
    showToast(`Koordinat (${coords}) disalin ke papan klip`, 'info');
  };

  const openGoogleMaps = () => {
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${application.latitude},${application.longitude}`,
      '_blank'
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200 shadow-2xs">
              <MapPin className="w-5 h-5 text-emerald-700" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded border border-emerald-200">
                  Peta Lokasi & Zonasi
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
            title="Tutup Peta Lokasi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* Status Zonasi Banner */}
          <div
            className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs ${
              isCompliant
                ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                : 'bg-rose-50/90 border-rose-300 text-rose-950'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  isCompliant ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'
                }`}
              >
                {isCompliant ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-wider">
                  {isCompliant ? '✓ Status: Memenuhi Kuota Zonasi' : '✕ Status: Di Luar Batas Radius Zonasi'}
                </div>
                <div className="text-xs font-semibold mt-0.5 opacity-90">
                  Jarak terukur: <strong>{formatDistanceIndonesian(application.distance_km)}</strong> • Batas radius madrasah: <strong>{effectiveRadius} km</strong>
                </div>
              </div>
            </div>

            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase shrink-0 shadow-2xs ${
                isCompliant
                  ? 'bg-emerald-700 text-white'
                  : 'bg-rose-700 text-white'
              }`}
            >
              {isCompliant ? 'Dalam Radius' : 'Luar Radius'}
            </span>
          </div>

          {/* Interactive Map View */}
          <div className="rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <InteractiveLocationPicker
              school={school}
              initialLat={application.latitude}
              initialLng={application.longitude}
              readOnly={true}
            />
          </div>

          {/* Location & Coordinates Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Student Home Address */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-emerald-700" />
                  Alamat Tempat Tinggal (Sesuai KK)
                </span>
              </div>
              <p className="text-xs text-slate-800 leading-relaxed font-medium">
                {address
                  ? `${address.street_address || '-'}, RT ${address.rt || '0'}/RW ${address.rw || '0'}, Kel. ${address.village || '-'}, Kec. ${address.district || '-'}, ${address.city || '-'}, ${address.province || '-'}`
                  : 'Data alamat belum lengkap'}
              </p>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                <span>Titik Koordinat Rumah:</span>
                <span className="font-mono font-bold text-slate-800">
                  {formatCoordinates(application.latitude, application.longitude)}
                </span>
              </div>
            </div>

            {/* Target School Info */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <SchoolIcon className="w-3.5 h-3.5 text-emerald-700" />
                  Madrasah Tujuan
                </span>
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                  {school.level}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-900 leading-relaxed">
                {school.school_name}
              </p>
              <p className="text-[11px] text-slate-500 leading-tight">
                {school.address}
              </p>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                <span>Koordinat Madrasah:</span>
                <span className="font-mono font-bold text-slate-800">
                  {formatCoordinates(school.latitude, school.longitude)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 px-6 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copyCoordinates}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
            >
              <Copy className="w-3.5 h-3.5 text-slate-500" />
              <span>Salin Koordinat</span>
            </button>
            <button
              type="button"
              onClick={openGoogleMaps}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              <span>Buka di Google Maps</span>
            </button>
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
    </div>
  );
};
