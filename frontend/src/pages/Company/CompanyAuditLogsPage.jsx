import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';

export default function CompanyAuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const loadLogs = async () => {
    try {
      setLoading(true);
      const res = await api.getAuditLogs(50, 1);
      if (res?.data?.logs) {
        setLogs(res.data.logs);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = searchTerm
    ? logs.filter((l) =>
        l.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.entity.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.actor?.fullName || '').toLowerCase().includes(searchTerm.toLowerCase())
      )
    : logs;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/30">
            Security & Governance
          </span>
          <h1 className="text-2xl font-black tracking-tight text-white mt-1">Enterprise Audit Trail</h1>
          <p className="text-xs text-slate-400 mt-1">
            Immutable system logs for role updates, payment verifications, contracts, and company settings changes.
          </p>
        </div>

        <div>
          <input
            type="text"
            placeholder="Search action, entity or staff..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3.5 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#F50046]"
          />
        </div>
      </div>

      <div className="bg-slate-800/40 rounded-xl border border-slate-700/60 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 animate-pulse text-xs">Loading immutable audit logs...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs italic">No audit records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-wider border-b border-slate-700/60">
                <tr>
                  <th className="p-3.5">Timestamp</th>
                  <th className="p-3.5">Action</th>
                  <th className="p-3.5">Actor / User</th>
                  <th className="p-3.5">Entity & ID</th>
                  <th className="p-3.5">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40">
                    <td className="p-3.5 text-slate-400 font-mono text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="p-3.5">
                      <span className="font-mono font-bold text-rose-400">{log.action}</span>
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-white">{log.actor?.fullName || 'System Automated'}</div>
                      <div className="text-[10px] text-slate-500">{log.actor?.role || 'SYSTEM'}</div>
                    </td>
                    <td className="p-3.5 font-mono text-slate-300">
                      <div>{log.entity}</div>
                      <div className="text-[10px] text-slate-500 truncate max-w-xs">{log.entityId}</div>
                    </td>
                    <td className="p-3.5 font-mono text-slate-400 text-[11px]">{log.ipAddress || '127.0.0.1'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
