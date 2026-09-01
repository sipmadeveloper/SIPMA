import React, { useState } from 'react';
import { Bell, Plus, Trash2, CheckCircle2, User, Calendar, Pin } from 'lucide-react';
import { Announcement } from '../../types/sipma';

interface Props {
  announcements: Announcement[];
  canManage: boolean;
  currentUserEmail?: string;
  currentUserName?: string;
  onAddAnnouncement: (announcement: Announcement) => void;
  onDeleteAnnouncement?: (id: string) => void;
}

export const AnnouncementsView: React.FC<Props> = ({
  announcements,
  canManage,
  currentUserEmail,
  currentUserName,
  onAddAnnouncement,
  onDeleteAnnouncement,
}) => {
  const [showModal, setShowModal] = useState<boolean>(false);
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [targetRole, setTargetRole] = useState<'all' | 'calon_murid' | 'admin_sekolah'>('all');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    const newAnc: Announcement = {
      announcement_id: `ANC-${Date.now()}`,
      title,
      content,
      date: new Date().toISOString().split('T')[0],
      author_name: currentUserName || 'Panitia PPDB',
      target_role: targetRole,
      is_published: true,
    };

    onAddAnnouncement(newAnc);
    setTitle('');
    setContent('');
    setShowModal(false);
  };

  return (
    <div className="space-y-6" id="sipma-announcements">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
            Pusat Informasi & Edaran
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-0.5">Pengumuman Resmi PPDB Madrasah</h2>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Pengumuman Baru</span>
          </button>
        )}
      </div>

      {/* Announcements List */}
      <div className="grid grid-cols-1 gap-4">
        {announcements.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400">
            Belum ada pengumuman yang diterbitkan.
          </div>
        ) : (
          announcements.map((anc) => (
            <div
              key={anc.announcement_id}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3 relative hover:border-emerald-200 transition-colors"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{anc.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                      <span>{anc.author_name}</span>
                      <span>•</span>
                      <span className="font-mono">{anc.date}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase">
                    Target: {anc.target_role}
                  </span>

                  {canManage && onDeleteAnnouncement && (
                    <button
                      type="button"
                      onClick={() => onDeleteAnnouncement(anc.announcement_id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                      title="Hapus Pengumuman"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                {anc.content}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Buat Pengumuman */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in">
            <h3 className="font-bold text-base text-slate-900 border-b border-slate-100 pb-2">
              Terbitkan Pengumuman Baru
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Judul Pengumuman *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Jadwal Tes Baca Tulis Al-Qur'an (BTQ)..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Sasaran Pengumuman</label>
                <select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value as any)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold outline-none"
                >
                  <option value="all">Semua Pengguna & Calon Murid</option>
                  <option value="calon_murid">Khusus Calon Murid & Wali Murid</option>
                  <option value="admin_sekolah">Khusus Panitia Madrasah</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Isi Pesan Pengumuman *</label>
                <textarea
                  rows={5}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Tuliskan detail pengumuman secara jelas..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs"
                >
                  Terbitkan Sekarang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
