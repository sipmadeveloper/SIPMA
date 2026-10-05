import React, { useState } from 'react';
import { History, Search, Filter, ShieldCheck, User, Calendar } from 'lucide-react';
import { AuditLog } from '../../types/sipma';

interface Props {
  logs: AuditLog[];
}

export const AuditLogsView: React.FC<Props> = ({ logs }) => {
  const [search, setSearch] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const filteredLogs = logs.filter((log) => {
    const s = search ? search.toLowerCase() : '';
    const matchSearch =
      !s ||
      (log.user_email?.toLowerCase() || '').includes(s) ||
      (log.action?.toLowerCase() || '').includes(s) ||
      (log.details?.toLowerCase() || '').includes(s);
    const matchRole = roleFilter === 'all' || log.user_role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div className="space-y-4" id="sipma-audit-logs">
      {/* Filter Bar (Compact & Practical) */}
      <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <div className="w-full sm:w-80 relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari email, aksi, atau detail..."
            className="w-full pl-8 pr-7 h-8.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            aria-label="Filter berdasarkan Role Akun"
            className="h-8.5 px-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
          >
            <option value="all">Semua Role</option>
            <option value="calon_murid">Calon Murid</option>
            <option value="admin_sekolah">Admin Sekolah</option>
            <option value="admin_pusat">Admin Pusat</option>
          </select>

          {(search || roleFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setRoleFilter('all');
              }}
              className="h-8.5 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4">Waktu</th>
                <th className="py-3.5 px-4">Pengguna</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Aktivitas (Action)</th>
                <th className="py-3.5 px-4">Detail Catatan</th>
                <th className="py-3.5 px-4 font-mono">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => (
                <tr key={log.log_id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString('id-ID')}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-900">
                    {log.user_email}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded font-bold uppercase text-[10px] bg-slate-100 text-slate-700">
                      {log.user_role ? log.user_role.replace('_', ' ') : 'USER'}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-emerald-800">
                    {log.action}
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    {log.details}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                    {log.ip_address || '127.0.0.1'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
