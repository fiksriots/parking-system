import React, { useState, useEffect } from 'react';
import { DollarSign, Calendar, ArrowUpRight, ShieldAlert, Printer, RefreshCw } from 'lucide-react';

interface LedgerItem {
  id: string;
  timestamp: string;
  type: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  operator: string;
}

interface FinancialData {
  stats: {
    totalParkingRevenue: number;
    totalMemberRevenue: number;
    totalLostTicketRevenue: number;
    grandTotalRevenue: number;
    paymentMethods: { cash: number; qris: number; member: number };
  };
  ledger: LedgerItem[];
}

export const FinancialLedger: React.FC = () => {
  const [data, setData] = useState<FinancialData>({
    stats: {
      totalParkingRevenue: 0,
      totalMemberRevenue: 0,
      totalLostTicketRevenue: 0,
      grandTotalRevenue: 0,
      paymentMethods: { cash: 0, qris: 0, member: 0 },
    },
    ledger: [],
  });

  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchLedger();
  }, [startDate, endDate]);

  const fetchLedger = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || window.location.origin}/api/reports/financial-ledger?startDate=${startDate}&endDate=${endDate}`);
      if (res.ok) {
        setData(await res.json());
      } else {
        setError('Gagal memuat data keuangan.');
      }
    } catch (e) {
      setError('Terjadi kesalahan koneksi ke server.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDate = (days: number) => {
    const today = new Date();
    const endStr = today.toISOString().split('T')[0];
    
    const start = new Date();
    start.setDate(today.getDate() - days);
    const startStr = start.toISOString().split('T')[0];
    
    setStartDate(startStr);
    setEndDate(endStr);
  };

  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const dateRangeStr = startDate === endDate 
      ? new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
      : `${new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} s/d ${new Date(endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;

    const rows = data.ledger.map(item => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; font-family: monospace;">
          ${new Date(item.timestamp).toLocaleDateString('id-ID')} ${new Date(item.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; font-size: 10px; text-transform: uppercase;">
          ${item.category}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #444;">
          ${item.description}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; font-family: monospace; font-weight: bold; font-size: 10px; text-align: center;">
          ${item.paymentMethod}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; font-family: monospace; text-align: right; font-weight: bold;">
          Rp ${item.amount.toLocaleString('id-ID')}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #555;">
          ${item.operator}
        </td>
      </tr>
    `).join('');

    const htmlContent = `
      <html>
        <head>
          <title>Laporan Keuangan Parkir - ${dateRangeStr}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 30px; color: #333; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 3px double #333; padding-bottom: 15px; }
            .header h1 { margin: 0; font-size: 22px; text-transform: uppercase; letter-spacing: 1px; }
            .header p { margin: 5px 0 0; font-size: 12px; color: #666; font-weight: bold; }
            .meta { margin-bottom: 25px; font-size: 11px; line-height: 1.6; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
            th { background-color: #f8f9fa; padding: 12px 10px; border-bottom: 2px solid #333; text-align: left; text-transform: uppercase; font-weight: bold; }
            .summary-box { display: flex; justify-content: space-between; margin-top: 25px; border-top: 2px solid #333; padding-top: 15px; font-size: 11px; }
            .summary-box div { font-weight: bold; }
            .grand-total { font-size: 16px; font-weight: bold; color: #10b981; margin-top: 15px; border-top: 1px solid #eee; padding-top: 10px; text-align: right; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Laporan Arus Keuangan & Pendapatan Parkir</h1>
            <p>Sistem Parkir Manless Berbasis Web</p>
          </div>
          <div class="meta">
            <strong>Periode Laporan:</strong> ${dateRangeStr}<br/>
            <strong>Waktu Ekspor:</strong> ${new Date().toLocaleString('id-ID')}<br/>
            <strong>Total Transaksi:</strong> ${data.ledger.length} log arus kas
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 15%">Waktu</th>
                <th style="width: 18%">Kategori</th>
                <th style="width: 37%">Keterangan Arus Kas</th>
                <th style="width: 10%; text-align: center;">Metode</th>
                <th style="width: 12%; text-align: right;">Nominal</th>
                <th style="width: 8%">Operator</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>

          <div class="summary-box">
            <div>Pendapatan Parkir Mandiri: Rp ${data.stats.totalParkingRevenue.toLocaleString('id-ID')}</div>
            <div>Pendapatan Member RFID: Rp ${data.stats.totalMemberRevenue.toLocaleString('id-ID')}</div>
            <div>Pendapatan Denda Tiket Hilang: Rp ${data.stats.totalLostTicketRevenue.toLocaleString('id-ID')}</div>
          </div>

          <div class="grand-total">
            GRAND TOTAL PENDAPATAN BERSIH: Rp ${data.stats.grandTotalRevenue.toLocaleString('id-ID')}
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* ── Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-400" />
            Laporan & Arus Keuangan
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">Rekapitulasi total pendapatan, metode bayar, dan ledger transaksi cashflow.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={fetchLedger} disabled={loading}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg transition disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={handleExportPDF}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold rounded-lg text-xs transition flex items-center gap-1.5 shadow-lg shadow-emerald-500/10">
            <Printer className="h-3.5 w-3.5" /> Cetak & Unduh PDF
          </button>
        </div>
      </div>

      {/* ── Filters */}
      <div className="glass rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 border border-white/5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-zinc-950 border border-white/10 rounded-lg px-3 py-1.5">
            <Calendar className="h-3.5 w-3.5 text-zinc-500" />
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="bg-transparent border-0 text-xs text-white focus:outline-none focus:ring-0 w-28 font-mono" />
            <span className="text-zinc-600 text-xs">s/d</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="bg-transparent border-0 text-xs text-white focus:outline-none focus:ring-0 w-28 font-mono" />
          </div>

          <div className="flex items-center gap-1.5 bg-zinc-950 p-1 border border-white/5 rounded-lg">
            {[['Hari Ini', 0], ['Kemarin', 1], ['7 Hari', 7], ['30 Hari', 30]].map(([label, days]) => (
              <button key={label as string} onClick={() => handleQuickDate(days as number)}
                className="text-[10px] px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white font-bold rounded transition">
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="text-xs font-medium text-rose-400 bg-rose-500/5 px-3 py-1 rounded border border-rose-500/10 flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5" /> {error}
          </div>
        )}
      </div>

      {/* ── Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Grand Total */}
        <div className="glass rounded-xl p-5 border border-white/5 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 relative overflow-hidden">
          <div className="absolute -right-3 -top-3 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl" />
          <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Total Pendapatan Bersih</p>
          <p className="text-2xl font-black text-white font-mono mt-2">
            Rp {data.stats.grandTotalRevenue.toLocaleString('id-ID')}
          </p>
          <div className="flex items-center gap-1 mt-2 text-[10px] text-zinc-400">
            <ArrowUpRight className="h-3 w-3 text-emerald-400" />
            <span>Semua sumber cashflow parkir & member</span>
          </div>
        </div>

        {/* Parking Revenue */}
        <div className="glass rounded-xl p-5 border border-white/5 bg-zinc-900/40">
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Parkir Mandiri (Entry-Exit)</p>
          <p className="text-xl font-bold text-white font-mono mt-2">
            Rp {data.stats.totalParkingRevenue.toLocaleString('id-ID')}
          </p>
          <p className="text-[10px] text-zinc-500 mt-2">Pembayaran tiket lepas harian</p>
        </div>

        {/* Member Revenue */}
        <div className="glass rounded-xl p-5 border border-white/5 bg-zinc-900/40">
          <p className="text-[10px] text-violet-400 font-bold uppercase tracking-wider">Keanggotaan Member RFID</p>
          <p className="text-xl font-bold text-white font-mono mt-2">
            Rp {data.stats.totalMemberRevenue.toLocaleString('id-ID')}
          </p>
          <p className="text-[10px] text-zinc-500 mt-2">Pendaftaran, topup, & perpanjangan</p>
        </div>

        {/* Lost Ticket Revenue */}
        <div className="glass rounded-xl p-5 border border-white/5 bg-zinc-900/40">
          <p className="text-[10px] text-rose-400 font-bold uppercase tracking-wider">Denda Tiket Hilang</p>
          <p className="text-xl font-bold text-white font-mono mt-2">
            Rp {data.stats.totalLostTicketRevenue.toLocaleString('id-ID')}
          </p>
          <p className="text-[10px] text-zinc-500 mt-2">Arus masuk denda administratif kasir</p>
        </div>
      </div>

      {/* ── Breakdown and Table layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Side: Payment Method Breakdowns */}
        <div className="lg:col-span-1 glass rounded-xl p-5 border border-white/5 space-y-5">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-white/5 pb-2.5">
            Metode Pembayaran (Breakdown)
          </h3>
          <div className="space-y-4">
            {/* CASH */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-zinc-400">Tunai / Cash</span>
                <span className="text-white font-mono">Rp {data.stats.paymentMethods.cash.toLocaleString('id-ID')}</span>
              </div>
              <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full"
                  style={{
                    width: `${data.stats.grandTotalRevenue > 0 ? (data.stats.paymentMethods.cash / data.stats.grandTotalRevenue) * 100 : 0}%`
                  }} />
              </div>
            </div>

            {/* QRIS */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-zinc-400">QRIS / E-Wallet</span>
                <span className="text-white font-mono">Rp {data.stats.paymentMethods.qris.toLocaleString('id-ID')}</span>
              </div>
              <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-sky-500 rounded-full"
                  style={{
                    width: `${data.stats.grandTotalRevenue > 0 ? (data.stats.paymentMethods.qris / data.stats.grandTotalRevenue) * 100 : 0}%`
                  }} />
              </div>
            </div>

            {/* MEMBER balance card */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-zinc-400">Potong Saldo Member</span>
                <span className="text-white font-mono">Rp {data.stats.paymentMethods.member.toLocaleString('id-ID')}</span>
              </div>
              <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-violet-500 rounded-full"
                  style={{
                    width: `${data.stats.grandTotalRevenue > 0 ? (data.stats.paymentMethods.member / data.stats.grandTotalRevenue) * 100 : 0}%`
                  }} />
              </div>
            </div>
          </div>
          <div className="bg-zinc-950/60 p-4 rounded-xl text-center border border-white/5 space-y-1">
            <p className="text-[10px] text-zinc-500 font-bold uppercase">Rasio Non-Tunai</p>
            <p className="text-lg font-black text-emerald-400 font-mono">
              {data.stats.grandTotalRevenue > 0
                ? (((data.stats.paymentMethods.qris + data.stats.paymentMethods.member) / data.stats.grandTotalRevenue) * 100).toFixed(1)
                : 0}%
            </p>
          </div>
        </div>

        {/* Right Side: Ledger Table */}
        <div className="lg:col-span-2 glass rounded-xl overflow-hidden border border-white/5">
          <div className="px-5 py-4 border-b border-white/5 flex justify-between items-center bg-zinc-900/20">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Arus Kas & Buku Besar Keuangan
            </h3>
            <span className="text-[10px] px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded-full font-mono font-bold">
              {data.ledger.length} log
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-zinc-950 text-zinc-500 font-bold border-b border-white/5">
                  <th className="p-3">Waktu</th>
                  <th className="p-3">Kategori</th>
                  <th className="p-3">Rincian Arus Kas</th>
                  <th className="p-3 text-center">Metode</th>
                  <th className="p-3 text-right">Nominal</th>
                </tr>
              </thead>
              <tbody>
                {data.ledger.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-zinc-500 font-medium">
                      Tidak ada transaksi keuangan pada periode ini.
                    </td>
                  </tr>
                ) : (
                  data.ledger.map((item) => (
                    <tr key={item.id} className="border-b border-white/5 hover:bg-white/5 transition">
                      <td className="p-3 text-zinc-400 font-mono">
                        <div>{new Date(item.timestamp).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' })}</div>
                        <div className="text-[10px] text-zinc-600 mt-0.5">
                          {new Date(item.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          item.type.startsWith('member_') ? 'bg-violet-500/25 text-violet-300'
                            : item.type === 'lost_ticket_penalty' ? 'bg-rose-500/25 text-rose-300'
                            : 'bg-emerald-500/25 text-emerald-300'
                        }`}>
                          {item.category}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-zinc-200">{item.description}</div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">Op: {item.operator}</div>
                      </td>
                      <td className="p-3 text-center">
                        <span className="font-mono text-zinc-400 font-bold bg-zinc-950 px-2 py-0.5 rounded border border-white/5 text-[10px]">
                          {item.paymentMethod}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-white">
                        Rp {item.amount.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
