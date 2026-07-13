import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { FileText, Download, BarChart2, TrendingUp, Calendar, RefreshCw } from 'lucide-react';

interface LogEntry {
  id: string;
  ticketCode: string;
  rfidCardNumber: string;
  plateNumber: string;
  entryTime: string;
  gateId: string;
  type: string;
  isExited: boolean;
}

export const ReportAnalytics: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch stats
      const statsRes = await fetch('http://localhost:3000/api/reports/stats');
      const statsData = await statsRes.json();
      setStats(statsData);

      // 2. Fetch hourly stats
      const hourlyRes = await fetch('http://localhost:3000/api/reports/hourly-stats');
      const hourlyData = await hourlyRes.json();
      setHourlyData(hourlyData);

      // 3. Fetch recent logs
      const logsRes = await fetch('http://localhost:3000/api/reports/recent-logs');
      const logsData = await logsRes.json();
      setRecentLogs(logsData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = () => {
    // Generate dummy Excel/CSV download for demo
    const headers = 'ID,TicketCode,RFIDCard,PlateNumber,EntryTime,Type,IsExited\n';
    const csvContent =
      headers +
      recentLogs
        .map(
          (l) =>
            `"${l.id}","${l.ticketCode || ''}","${l.rfidCardNumber || ''}","${l.plateNumber}","${l.entryTime}","${l.type}","${l.isExited}"`,
        )
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `laporan_parkir_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading || !stats) {
    return (
      <div className="h-64 flex items-center justify-center text-zinc-500 text-xs">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" />
        Memuat data laporan dan analytics...
      </div>
    );
  }

  // Format payment methods for Recharts
  const paymentChartData = [
    { name: 'Tunai (Cash)', value: stats.paymentMethods.cash },
    { name: 'QRIS Non-Tunai', value: stats.paymentMethods.qris },
    { name: 'Member Pre-paid', value: stats.paymentMethods.member },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-emerald-400" />
          Laporan Transaksi & Pendapatan
        </h2>
        <div className="flex gap-2">
          <button
            onClick={fetchData}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg transition"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={exportReport}
            className="bg-emerald-500 hover:bg-emerald-600 text-zinc-950 px-4 py-2 rounded-lg font-bold transition text-xs flex items-center gap-1.5"
          >
            <Download className="h-4 w-4" />
            Ekspor CSV (Excel)
          </button>
        </div>
      </div>

      {/* Analytics Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Traffic Area Chart */}
        <div className="glass rounded-xl p-5 space-y-4">
          <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            Volume Lalu Lintas Kendaraan (Per Jam)
          </h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMasuk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorKeluar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" />
                <XAxis dataKey="hour" stroke="#4b5563" fontSize={10} />
                <YAxis stroke="#4b5563" fontSize={10} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#121420', borderColor: '#ffffff10' }}
                  labelStyle={{ color: '#9ca3af' }}
                />
                <Area type="monotone" dataKey="masuk" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorMasuk)" name="Masuk" />
                <Area type="monotone" dataKey="keluar" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorKeluar)" name="Keluar" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue Share Bar Chart */}
        <div className="glass rounded-xl p-5 space-y-4">
          <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-purple-400" />
            Pendapatan Berdasarkan Metode Pembayaran
          </h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={paymentChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" />
                <XAxis dataKey="name" stroke="#4b5563" fontSize={10} />
                <YAxis stroke="#4b5563" fontSize={10} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#121420', borderColor: '#ffffff10' }}
                  formatter={(val: any) => `Rp ${val.toLocaleString('id-ID')}`}
                />
                <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Nominal (Rp)">
                  {/* Custom color overlays */}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Transacting Vehicles Table */}
      <div className="glass rounded-xl p-5">
        <h4 className="font-bold text-white text-sm mb-4 flex items-center gap-1.5">
          <FileText className="h-4 w-4 text-blue-400" />
          Data Transaksi Terbaru (20 Terakhir)
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/40 text-zinc-400 border-b border-white/5 uppercase tracking-wider font-bold">
              <tr>
                <th className="p-3">Kode Karcis</th>
                <th className="p-3">Plat Nomor</th>
                <th className="p-3">Waktu Masuk</th>
                <th className="p-3">Kategori</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-zinc-300">
              {recentLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-zinc-500">
                    Tidak ada transaksi parkir yang terdeteksi hari ini.
                  </td>
                </tr>
              ) : (
                recentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.01] transition">
                    <td className="p-3 font-mono font-semibold text-zinc-400">
                      {log.ticketCode || log.rfidCardNumber || '-'}
                    </td>
                    <td className="p-3 font-mono font-semibold text-white">{log.plateNumber}</td>
                    <td className="p-3">{new Date(log.entryTime).toLocaleString('id-ID')}</td>
                    <td className="p-3">
                      <span className="capitalize">{log.type}</span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          log.isExited
                            ? 'bg-zinc-800 text-zinc-400'
                            : 'bg-emerald-500/10 text-emerald-400'
                        }`}
                      >
                        {log.isExited ? 'SUDAH KELUAR' : 'DI DALAM AREA'}
                      </span>
                    </td>
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
