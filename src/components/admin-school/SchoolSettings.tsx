import React, { useState } from 'react';
import { Check, Save, School as SchoolIcon, Upload, Image as ImageIcon, Trash2, Calendar, Clock, MapPin, FileCheck, Info, RefreshCw, CheckCircle2 } from 'lucide-react';
import { School } from '../../types/sipma';
import { normalizeImageUrl, handleImageError, compressAndResizeImage } from '../../utils/imageUrl';
import { storageService } from '../../services/storageService';
import { SchoolLocationSettingMap } from '../map/SchoolLocationSettingMap';
import { useFeedback } from '../../context/FeedbackContext';

interface Props {
  school: School;
  onSave: (updatedSchool: School) => void;
}

export const SchoolSettings: React.FC<Props> = ({ school, onSave }) => {
  const { showAlert, showToast } = useFeedback();
  const safeSchool: School = school || {
    school_id: 'SCH-MAN1',
    npsn: '20100001',
    school_name: 'MAN 1 Kota Jakarta',
    level: 'MA',
    status: 'active',
    address: 'Jl. Madrasah No. 1',
    village: 'Pondok Indah',
    district: 'Kebayoran Lama',
    city: 'Jakarta Selatan',
    province: 'DKI Jakarta',
    latitude: -6.2655,
    longitude: 106.7844,
    radius_zonasi_km: 5,
    zoning_radius_km: 5,
    quota_total: 100,
    quota_zonasi: 50,
    quota_afirmasi: 20,
    quota_prestasi: 20,
    quota_mutasi: 10,
    quota_percentage_zonasi: 50,
    quota_percentage_afirmasi: 20,
    quota_percentage_prestasi: 20,
    quota_percentage_mutasi: 10,
  };

  const [formData, setFormData] = useState<School>({ ...safeSchool });
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState<boolean>(false);

  const handleUploadSchoolLogo = async (file: File) => {
    if (!file) return;
    setIsUploadingLogo(true);
    try {
      const compressed = await compressAndResizeImage(file, 800, 800, 0.88);
      const res = await storageService.uploadSchoolLogo(
        formData.school_id,
        formData.school_name,
        compressed.base64,
        compressed.fileName
      );
      setIsUploadingLogo(false);
      if (res.success && res.logo_url) {
        const updated = { ...formData, logo_url: res.logo_url };
        setFormData(updated);
        onSave(updated);
        showToast('Logo madrasah berhasil diunggah & tersimpan langsung ke database!', 'success');
      } else {
        showAlert('Gagal Unggah Logo', res.message || 'Terjadi kesalahan saat mengunggah.', 'error');
      }
    } catch (err: any) {
      setIsUploadingLogo(false);
      showAlert('Gagal Memproses Gambar', err?.message || 'Format gambar tidak dapat diproses.', 'error');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    setIsSaved(true);
    showToast('Pengaturan madrasah berhasil disimpan', 'success');
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="space-y-6" id="sipma-school-settings">
      <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
            Pengaturan Profil & Lokasi Zonasi
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-0.5">{safeSchool.school_name}</h2>
        </div>

        {isSaved && (
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
            ✓ Data Madrasah Berhasil Disimpan
          </span>
        )}
      </div>

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
          Identitas Madrasah
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Nama Madrasah *</label>
            <input
              type="text"
              value={formData.school_name}
              onChange={(e) => setFormData({ ...formData, school_name: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Kode Unik Madrasah *
              <span className="text-[10px] text-slate-400 font-normal ml-1">(Format No. Reg: SIPMA-KODE-URUT)</span>
            </label>
            <input
              type="text"
              value={formData.school_code || ''}
              onChange={(e) => setFormData({ ...formData, school_code: e.target.value.toUpperCase() })}
              placeholder="Contoh: MAN01, MTS01, MI01"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono uppercase font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Jenjang Madrasah</label>
            <select
              value={formData.level}
              onChange={(e) => setFormData({ ...formData, level: e.target.value as any })}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="MI">MI (Madrasah Ibtidaiyah)</option>
              <option value="MTs">MTs (Madrasah Tsanawiyah)</option>
              <option value="MA">MA (Madrasah Aliyah)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Nomor Statistik Madrasah (NSM)</label>
            <input
              type="text"
              value={formData.nsm}
              onChange={(e) => setFormData({ ...formData, nsm: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">NPSN</label>
            <input
              type="text"
              value={formData.npsn}
              onChange={(e) => setFormData({ ...formData, npsn: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Nama Kepala Madrasah</label>
            <input
              type="text"
              value={formData.principal_name}
              onChange={(e) => setFormData({ ...formData, principal_name: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">No. Kontak / Telepon</label>
            <input
              type="text"
              value={formData.contact_phone}
              onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <div className="sm:col-span-2 md:col-span-3">
            <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
              <label className="font-semibold text-slate-800 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-emerald-600" />
                <span>Logo Resmi Madrasah (Google Drive & Database Cloud)</span>
              </label>
              {formData.logo_url && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Tersimpan di Cloud Database
                </span>
              )}
            </div>
            <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                {formData.logo_url ? (
                  <div className="relative group shrink-0">
                    <img
                      src={normalizeImageUrl(formData.logo_url)}
                      alt="Logo Madrasah"
                      className="w-20 h-20 object-contain rounded-xl border-2 border-emerald-200 bg-white p-1.5 shadow-sm"
                      referrerPolicy="no-referrer"
                      onError={(e) => handleImageError(e, '/logo.png')}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const updated = { ...formData, logo_url: '' };
                        setFormData(updated);
                        onSave(updated);
                        showToast('Logo madrasah dihapus.', 'info');
                      }}
                      title="Hapus Logo Madrasah"
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
                            handleUploadSchoolLogo(file);
                            e.target.value = '';
                          }
                        }}
                      />
                    </label>

                    {formData.logo_url && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = { ...formData, logo_url: '' };
                          setFormData(updated);
                          onSave(updated);
                          showToast('Logo madrasah dihapus.', 'info');
                        }}
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
                      value={formData.logo_url || ''}
                      onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                      placeholder="Atau tempel URL logo: https://example.com/logo-madrasah.png"
                      className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        onSave(formData);
                        showToast('URL logo madrasah disimpan.', 'success');
                      }}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shrink-0 transition-colors"
                    >
                      Terapkan URL
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                Logo ini akan otomatis dicantumkan pada <strong>Kop Surat Bukti Pendaftaran</strong>, <strong>Surat Dispensasi</strong>, dan <strong>Surat Keterangan Hasil Seleksi (SKL)</strong>.
              </p>
            </div>
          </div>

          <div className="sm:col-span-2 md:col-span-3">
            <label className="block font-semibold text-slate-700 mb-1">Alamat Lengkap Madrasah</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Daya Tampung Kuota Zonasi (Murid)</label>
            <input
              type="number"
              min={1}
              value={formData.quota_zonasi}
              onChange={(e) => setFormData({ ...formData, quota_zonasi: parseInt(e.target.value) || 0 })}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Daya Tampung Kuota Afirmasi (Murid)</label>
            <input
              type="number"
              min={1}
              value={formData.quota_afirmasi}
              onChange={(e) => setFormData({ ...formData, quota_afirmasi: parseInt(e.target.value) || 0 })}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Daya Tampung Kuota Prestasi (Murid)</label>
            <input
              type="number"
              min={0}
              value={formData.quota_prestasi || 0}
              onChange={(e) => setFormData({ ...formData, quota_prestasi: parseInt(e.target.value) || 0 })}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Daya Tampung Kuota Mutasi (Murid)</label>
            <input
              type="number"
              min={0}
              value={formData.quota_mutasi || 0}
              onChange={(e) => setFormData({ ...formData, quota_mutasi: parseInt(e.target.value) || 0 })}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
        </div>

        {/* Section: Jadwal & Ketentuan Daftar Ulang */}
        <div className="pt-4 border-t border-slate-200/80 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Jadwal & Ketentuan Pelaksanaan Daftar Ulang
              </h3>
              <p className="text-[11px] text-slate-500">
                Informasi jadwal di bawah ini akan otomatis tercantum pada <strong>Surat Keterangan Diterima (Kelulusan Seleksi)</strong> yang dicetak dan diunduh oleh calon siswa yang lulus.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 text-xs bg-slate-50/80 p-4 sm:p-5 rounded-xl border border-slate-200">
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                <span>Tanggal Mulai Daftar Ulang</span>
              </label>
              <input
                type="date"
                value={formData.reregistration_start_date || ''}
                onChange={(e) => setFormData({ ...formData, reregistration_start_date: e.target.value })}
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Hari pertama layanan daftar ulang</span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-rose-600" />
                <span>Batas Akhir / Penutupan Daftar Ulang</span>
              </label>
              <input
                type="date"
                value={formData.reregistration_end_date || ''}
                onChange={(e) => setFormData({ ...formData, reregistration_end_date: e.target.value })}
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Batas akhir sebelum hak penerimaan dibatalkan</span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>Jam / Waktu Pelayanan</span>
              </label>
              <input
                type="text"
                value={formData.reregistration_time || ''}
                onChange={(e) => setFormData({ ...formData, reregistration_time: e.target.value })}
                placeholder="Contoh: 08.00 - 14.00 WIB (Senin - Sabtu)"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Jam operasional panitia di madrasah</span>
            </div>

            <div className="sm:col-span-2 md:col-span-3">
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-600" />
                <span>Ruangan / Lokasi Pelaksanaan Daftar Ulang</span>
              </label>
              <input
                type="text"
                value={formData.reregistration_location || ''}
                onChange={(e) => setFormData({ ...formData, reregistration_location: e.target.value })}
                placeholder="Contoh: Ruang Pelayanan Terpadu Satu Pintu (PTSP) / Sekretariat Panitia PPDB Gedung A Lantai 1"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div className="sm:col-span-2 md:col-span-3">
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5 text-emerald-700" />
                <span>Catatan / Persyaratan Khusus Tambahan</span>
              </label>
              <textarea
                rows={2}
                value={formData.reregistration_notes || ''}
                onChange={(e) => setFormData({ ...formData, reregistration_notes: e.target.value })}
                placeholder="Contoh: Wajib didampingi orang tua/wali, berseragam rapi, dan membawa seluruh berkas asli beserta fotokopi legalisir 2 rangkap."
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
              />
            </div>
          </div>

          {/* Live Preview of Reregistration Info on Acceptance Letter */}
          <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-1.5 text-xs text-emerald-950">
            <div className="font-bold flex items-center gap-1.5 text-emerald-900">
              <Info className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Preview Tampilan Jadwal Pada Surat Keterangan Diterima:</span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-emerald-200/80 font-serif text-[11.5px] leading-relaxed space-y-1 text-slate-800">
              <div>
                <strong>• Periode Pelaksanaan:</strong>{' '}
                {formData.reregistration_start_date && formData.reregistration_end_date
                  ? `${formData.reregistration_start_date} s.d. ${formData.reregistration_end_date}`
                  : formData.reregistration_start_date
                  ? `Mulai ${formData.reregistration_start_date}`
                  : 'Sesuai Pengumuman Resmi Madrasah'}
              </div>
              <div>
                <strong>• Waktu Pelayanan:</strong> {formData.reregistration_time || '08.00 - 14.00 WIB'}
              </div>
              <div>
                <strong>• Tempat / Lokasi:</strong>{' '}
                {formData.reregistration_location || `Sekretariat Panitia PPDB ${formData.school_name || 'Madrasah'}`}
              </div>
              {formData.reregistration_notes && (
                <div>
                  <strong>• Ketentuan Khusus:</strong> {formData.reregistration_notes}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Informasi Madrasah</span>
          </button>
        </div>
      </form>

      {/* Map Location & Radius Setting Component */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
          Titik Koordinat & Radius Zonasi di Peta
        </h3>
        <p className="text-xs text-slate-500">
          Geser penanda pin hijau ke titik lokasi madrasah dan atur radius lingkaran zonasi maksimal dalam kilometer.
        </p>

        <SchoolLocationSettingMap
          school={formData}
          onSaveLocation={(lat, lng, radius) => {
            const updated = {
              ...formData,
              latitude: lat,
              longitude: lng,
              zoning_radius_km: radius,
            };
            setFormData(updated);
            onSave(updated);
          }}
        />
      </div>
    </div>
  );
};
