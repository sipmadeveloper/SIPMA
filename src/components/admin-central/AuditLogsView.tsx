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
    <div className="space-y-6" id="sipma-audit-logs">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
            Sistem Keamanan & Riwayat Aktivitas
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-0.5">Audit Trail & Activity Logs</h2>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-80 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari email, aksi, atau detail..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
        >
          <option value="all">Semua Role</option>
          <option value="calon_murid">Calon Murid</option>
          <option value="admin_sekolah">Admin Sekolah</option>
          <option value="admin_pusat">Admin Pusat</option>
        </select>
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
