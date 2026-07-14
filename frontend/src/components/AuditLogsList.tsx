import React, { useState, useEffect } from 'react';
import { ShieldAlert, RefreshCw, Clock, Tag } from 'lucide-react';

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  timestamp: string;
  details: string;
}

export const AuditLogsList: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || window.location.origin}/api/reports/audit-logs`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setLogs(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center text-zinc-500 text-xs">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" />
        Memuat logs audit sistem...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-purple-400" />
          Log Audit Keamanan & Operasional
        </h2>
        <button
          onClick={fetchLogs}
          className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg transition"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/40 text-zinc-400 border-b border-white/5 uppercase tracking-wider font-bold">
              <tr>
                <th className="p-4">Tanggal & Waktu</th>
                <th className="p-4">Kode Aksi</th>
                <th className="p-4">Detail Aktivitas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-zinc-300">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-zinc-500">
                    Belum ada log audit yang dicatat.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.01] transition">
                    <td className="p-4 text-zinc-400 flex items-center gap-1.5 min-w-[180px]">
                      <Clock className="h-3.5 w-3.5 text-zinc-600" />
                      {new Date(log.timestamp).toLocaleString('id-ID')}
                    </td>
                    <td className="p-4">
                      <span className="bg-purple-500/10 text-purple-400 border border-purple-500/10 px-2.5 py-0.5 rounded font-bold font-mono text-[9px] flex items-center gap-1 w-fit">
                        <Tag className="h-2.5 w-2.5" />
                        {log.action}
                      </span>
                    </td>
                    <td className="p-4 text-zinc-200">{log.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
