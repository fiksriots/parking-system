import React, { useState, useEffect } from 'react';
import { DollarSign, Save, RefreshCw, AlertCircle, CheckCircle, Clock, Calendar } from 'lucide-react';

// ─── Interfaces ────────────────────────────────────────────────────────────────

interface VehicleTariff {
  billingMode: 'hourly' | 'daily';
  // Hourly mode fields
  firstHour: number;
  hourlyRate: number;
  // Daily mode fields
  dailyRate: number;
  // Shared
  lostTicketFine: number;
}

interface TariffData {
  car: VehicleTariff;
  motorcycle: VehicleTariff;
  truck: VehicleTariff;
  bus: VehicleTariff;
  gracePeriodMins: number;
  memberRegistrationFee: number;
  memberConversionFee: number;
  memberTopupPackages: Array<{ quota: number; price: number }>;
  memberMonthlyPackages: Array<{ months: number; label: string; price: number }>;
}

const DEFAULT_TARIFFS: TariffData = {
  car:        { billingMode: 'hourly', firstHour: 5000,  hourlyRate: 3000, dailyRate: 30000,  lostTicketFine: 50000 },
  motorcycle: { billingMode: 'hourly', firstHour: 2000,  hourlyRate: 1500, dailyRate: 15000,  lostTicketFine: 25000 },
  truck:      { billingMode: 'hourly', firstHour: 10000, hourlyRate: 5000, dailyRate: 60000,  lostTicketFine: 100000 },
  bus:        { billingMode: 'hourly', firstHour: 8000,  hourlyRate: 4000, dailyRate: 50000,  lostTicketFine: 80000 },
  gracePeriodMins: 10,
  memberRegistrationFee: 35000,
  memberConversionFee: 15000,
  memberTopupPackages: [
    { quota: 10, price: 50000 },
    { quota: 20, price: 95000 },
    { quota: 50, price: 230000 },
    { quota: 100, price: 450000 }
  ],
  memberMonthlyPackages: [
    { months: 1, label: '1 Bulan', price: 30000 },
    { months: 3, label: '3 Bulan', price: 80000 },
    { months: 6, label: '6 Bulan', price: 150000 },
    { months: 12, label: '1 Tahun', price: 280000 }
  ]
};

const VEHICLE_TYPES = [
  { key: 'motorcycle', label: 'Motor',       description: 'Sepeda Motor',    color: 'sky',     gradient: 'from-sky-500/20 to-sky-600/10',     border: 'border-sky-500/30',     emoji: '🏍️' },
  { key: 'car',        label: 'Mobil',       description: 'Kendaraan Roda 4',color: 'emerald', gradient: 'from-emerald-500/20 to-emerald-600/10', border: 'border-emerald-500/30', emoji: '🚗' },
  { key: 'truck',      label: 'Truck',       description: 'Kendaraan Berat', color: 'orange',  gradient: 'from-orange-500/20 to-orange-600/10', border: 'border-orange-500/30',  emoji: '🚛' },
  { key: 'bus',        label: 'Bus / Minibus', description: 'Angkutan Umum', color: 'violet',  gradient: 'from-violet-500/20 to-violet-600/10', border: 'border-violet-500/30',  emoji: '🚌' },
] as const;

type VehicleKey = 'car' | 'motorcycle' | 'truck' | 'bus';

// ─── Component ─────────────────────────────────────────────────────────────────

export const TariffConfig: React.FC = () => {
  const [tariffs, setTariffs] = useState<TariffData>(DEFAULT_TARIFFS);
  const [gracePeriodMins, setGracePeriodMins] = useState(10);
  const [activeVehicle, setActiveVehicle] = useState<VehicleKey>('car');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchTariff(); }, []);

  const fetchTariff = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/payment/tariff`);
      const data = await res.json();
      setTariffs({
        car:        mergeVehicle(data.car,        DEFAULT_TARIFFS.car),
        motorcycle: mergeVehicle(data.motorcycle, DEFAULT_TARIFFS.motorcycle),
        truck:      mergeVehicle(data.truck,       DEFAULT_TARIFFS.truck),
        bus:        mergeVehicle(data.bus,         DEFAULT_TARIFFS.bus),
        gracePeriodMins: data.gracePeriodMins ?? 10,
        memberRegistrationFee: data.memberRegistrationFee ?? DEFAULT_TARIFFS.memberRegistrationFee,
        memberConversionFee: data.memberConversionFee ?? DEFAULT_TARIFFS.memberConversionFee,
        memberTopupPackages: data.memberTopupPackages ?? DEFAULT_TARIFFS.memberTopupPackages,
        memberMonthlyPackages: data.memberMonthlyPackages ?? DEFAULT_TARIFFS.memberMonthlyPackages,
      });
      setGracePeriodMins(data.gracePeriodMins ?? 10);
    } catch (e) {
      setError('Gagal memuat konfigurasi tarif.');
    }
  };

  const mergeVehicle = (remote: any, defaults: VehicleTariff): VehicleTariff => ({
    billingMode:    remote?.billingMode    ?? defaults.billingMode,
    firstHour:      remote?.firstHour      ?? defaults.firstHour,
    hourlyRate:     remote?.hourlyRate     ?? defaults.hourlyRate,
    dailyRate:      remote?.dailyRate      ?? defaults.dailyRate,
    lostTicketFine: remote?.lostTicketFine ?? defaults.lostTicketFine,
  });

  const updateField = (key: keyof VehicleTariff, value: any) => {
    setTariffs(prev => ({
      ...prev,
      [activeVehicle]: { ...prev[activeVehicle], [key]: value },
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(''); setError(''); setSaving(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/payment/tariff`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...tariffs, gracePeriodMins: Number(gracePeriodMins) }),
      });
      if (res.ok) {
        setMessage('Konfigurasi tarif semua jenis kendaraan berhasil diperbarui!');
        setTimeout(() => setMessage(''), 4000);
      } else {
        setError('Gagal memperbarui tarif.');
      }
    } catch {
      setError('Terjadi kesalahan koneksi.');
    } finally {
      setSaving(false);
    }
  };

  const cur = tariffs[activeVehicle];
  const activeInfo = VEHICLE_TYPES.find(v => v.key === activeVehicle)!;

  // Example fee calculations
  const calcHourly = (hours: number) =>
    hours <= 0 ? 0 : hours === 1 ? cur.firstHour : cur.firstHour + (hours - 1) * cur.hourlyRate;
  const calcDaily = (days: number) => days * cur.dailyRate;

  return (
    <div className="space-y-6 max-w-7xl">

      {/* ── Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-emerald-400" />
          Konfigurasi Tarif Parkir
        </h2>
        <button type="button" onClick={fetchTariff}
          className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg transition">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* ── Notifications */}
      {message && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-lg flex items-center gap-2 animate-fadeIn">
          <CheckCircle className="h-4 w-4 flex-shrink-0" />{message}
        </div>
      )}
      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />{error}
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: Vehicle Config */}
        <div className="space-y-6">
          {/* ── Vehicle Type Selector */}
          <div className="glass rounded-xl p-4">
            <p className="text-xs text-zinc-400 font-semibold mb-3 uppercase tracking-wider">Pilih Jenis Kendaraan</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {VEHICLE_TYPES.map(vt => {
            const isActive = activeVehicle === vt.key;
            const vtTariff = tariffs[vt.key as VehicleKey];
            const modeLabel = vtTariff.billingMode === 'daily' ? 'Hari' : 'Jam';
            const rateVal = vtTariff.billingMode === 'daily' ? vtTariff.dailyRate : vtTariff.firstHour;
            return (
              <button key={vt.key} type="button"
                onClick={() => setActiveVehicle(vt.key as VehicleKey)}
                className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200 ${
                  isActive
                    ? `bg-gradient-to-b ${vt.gradient} ${vt.border} shadow-lg`
                    : 'bg-zinc-900/50 border-white/5 hover:border-white/15 hover:bg-zinc-800/50'
                }`}>
                {isActive && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
                <span className="text-2xl">{vt.emoji}</span>
                <div className="text-center">
                  <div className={`text-xs font-bold ${isActive ? 'text-white' : 'text-zinc-400'}`}>{vt.label}</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">{vt.description}</div>
                </div>
                <div className={`text-[10px] font-mono font-semibold ${isActive ? 'text-emerald-300' : 'text-zinc-500'}`}>
                  Rp {rateVal.toLocaleString('id-ID')}/{modeLabel}
                </div>
                {/* Billing mode badge */}
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                  vtTariff.billingMode === 'daily'
                    ? 'bg-violet-500/20 text-violet-300'
                    : 'bg-sky-500/20 text-sky-300'
                }`}>
                  {vtTariff.billingMode === 'daily' ? '📅 Per Hari' : '⏱️ Per Jam'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tariff form inputs */}

        {/* Billing Mode Toggle */}
        <div className={`glass rounded-xl p-5 border ${activeInfo.border}`}>
          <div className="flex items-center gap-3 mb-5">
            <span className="text-3xl">{activeInfo.emoji}</span>
            <div>
              <h3 className="text-lg font-bold text-white">{activeInfo.label}</h3>
              <p className="text-xs text-zinc-500">{activeInfo.description}</p>
            </div>
          </div>

          {/* ── Mode selector */}
          <div className="mb-6">
            <p className="text-xs text-zinc-400 font-semibold mb-3 uppercase tracking-wider">
              Mode Penghitungan Tarif
            </p>
            <div className="grid grid-cols-2 gap-3">

              {/* Per Jam */}
              <button type="button"
                onClick={() => updateField('billingMode', 'hourly')}
                className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                  cur.billingMode === 'hourly'
                    ? 'bg-sky-500/15 border-sky-500/50 shadow-lg shadow-sky-500/10'
                    : 'bg-zinc-900/50 border-white/5 hover:border-white/15'
                }`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  cur.billingMode === 'hourly' ? 'bg-sky-500/20' : 'bg-zinc-800'
                }`}>
                  <Clock className={`h-5 w-5 ${cur.billingMode === 'hourly' ? 'text-sky-400' : 'text-zinc-500'}`} />
                </div>
                <div className="text-left">
                  <div className={`text-sm font-bold ${cur.billingMode === 'hourly' ? 'text-white' : 'text-zinc-400'}`}>
                    Per Jam
                  </div>
                  <div className="text-[10px] text-zinc-500 leading-tight mt-0.5">
                    Dihitung per jam, makin lama makin besar
                  </div>
                  {cur.billingMode === 'hourly' && (
                    <span className="mt-1 inline-block text-[9px] bg-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded-full font-bold">
                      ✓ AKTIF
                    </span>
                  )}
                </div>
              </button>

              {/* Per Hari */}
              <button type="button"
                onClick={() => updateField('billingMode', 'daily')}
                className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                  cur.billingMode === 'daily'
                    ? 'bg-violet-500/15 border-violet-500/50 shadow-lg shadow-violet-500/10'
                    : 'bg-zinc-900/50 border-white/5 hover:border-white/15'
                }`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  cur.billingMode === 'daily' ? 'bg-violet-500/20' : 'bg-zinc-800'
                }`}>
                  <Calendar className={`h-5 w-5 ${cur.billingMode === 'daily' ? 'text-violet-400' : 'text-zinc-500'}`} />
                </div>
                <div className="text-left">
                  <div className={`text-sm font-bold ${cur.billingMode === 'daily' ? 'text-white' : 'text-zinc-400'}`}>
                    Per Hari
                  </div>
                  <div className="text-[10px] text-zinc-500 leading-tight mt-0.5">
                    Tarif flat per 24 jam, cocok untuk inap
                  </div>
                  {cur.billingMode === 'daily' && (
                    <span className="mt-1 inline-block text-[9px] bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded-full font-bold">
                      ✓ AKTIF
                    </span>
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* ── Tariff inputs (conditional based on mode) */}
          {cur.billingMode === 'hourly' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                  ⏱️ Tarif Jam Pertama
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-mono">Rp</span>
                  <input type="number" min="0" step="500" required
                    value={cur.firstHour}
                    onChange={e => updateField('firstHour', Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-sky-500 transition" />
                </div>
                <p className="text-[10px] text-zinc-600">Biaya di jam pertama parkir</p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                  ⏱️ Tarif Per Jam Berikutnya
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-mono">Rp</span>
                  <input type="number" min="0" step="500" required
                    value={cur.hourlyRate}
                    onChange={e => updateField('hourlyRate', Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-sky-500 transition" />
                </div>
                <p className="text-[10px] text-zinc-600">Jam ke-2 dan seterusnya</p>
              </div>

              {/* Hourly example calc */}
              <div className="col-span-full bg-zinc-950/60 rounded-lg p-3 border border-white/5">
                <p className="text-[10px] text-zinc-500 font-semibold mb-2 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Contoh Kalkulasi Per Jam
                </p>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[1, 2, 3, 6].map(h => (
                    <div key={h} className="bg-zinc-900 rounded-lg p-2">
                      <div className="text-[10px] text-zinc-500">{h} jam</div>
                      <div className="text-xs font-bold text-white font-mono">Rp {calcHourly(h).toLocaleString('id-ID')}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                  📅 Tarif Per Hari (24 Jam)
                </label>
                <div className="relative max-w-xs">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-mono">Rp</span>
                  <input type="number" min="0" step="1000" required
                    value={cur.dailyRate}
                    onChange={e => updateField('dailyRate', Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-violet-500/30 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-violet-500 transition" />
                </div>
                <p className="text-[10px] text-zinc-600">
                  Tarif flat tiap 24 jam (setelah grace period). Dihitung per hari penuh.
                </p>
              </div>

              {/* Daily example calc */}
              <div className="bg-zinc-950/60 rounded-lg p-3 border border-white/5">
                <p className="text-[10px] text-zinc-500 font-semibold mb-2 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Contoh Kalkulasi Per Hari
                </p>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[1, 2, 3, 7].map(d => (
                    <div key={d} className="bg-zinc-900 rounded-lg p-2">
                      <div className="text-[10px] text-zinc-500">{d} hari</div>
                      <div className="text-xs font-bold text-white font-mono">Rp {calcDaily(d).toLocaleString('id-ID')}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Explain daily billing */}
              <div className="bg-violet-500/5 border border-violet-500/15 rounded-lg p-3 text-xs text-zinc-400 space-y-1">
                <p className="font-semibold text-violet-300">ℹ️ Cara Kerja Mode Per Hari:</p>
                <ul className="space-y-0.5 text-zinc-500 list-disc list-inside">
                  <li>0 – {gracePeriodMins} menit pertama: <span className="text-emerald-400">GRATIS</span> (grace period)</li>
                  <li>Setiap kelipatan 24 jam = 1 hari penuh dikenakan tarif</li>
                  <li>Sisa kurang dari 24 jam tetap dihitung 1 hari</li>
                </ul>
              </div>
            </div>
          )}

          {/* ── Lost Ticket Fine (shared for both modes) */}
          <div className="mt-4 pt-4 border-t border-white/5">
            <div className="space-y-2">
              <label className="block text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                ⚠️ Denda Karcis Hilang
              </label>
              <div className="relative max-w-xs">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-mono">Rp</span>
                <input type="number" min="0" step="1000" required
                  value={cur.lostTicketFine}
                  onChange={e => updateField('lostTicketFine', Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-rose-500/20 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-rose-500 transition" />
              </div>
              <p className="text-[10px] text-zinc-600">Denda jika pengunjung kehilangan karcis masuk</p>
            </div>
          </div>
        </div>

        {/* ── Grace Period */}
        <div className="glass rounded-xl p-5 border border-white/5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <label className="text-sm font-bold text-white">⏱️ Grace Period (Menit)</label>
              <p className="text-xs text-zinc-500 mt-0.5">
                Kendaraan keluar sebelum batas ini tidak dikenai tarif. Berlaku untuk semua jenis &amp; mode.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setGracePeriodMins(Math.max(0, gracePeriodMins - 5))}
                className="w-8 h-8 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-bold transition">−</button>
              <input type="number" min="0" max="60"
                value={gracePeriodMins}
                onChange={e => setGracePeriodMins(Number(e.target.value))}
                className="w-16 bg-zinc-950 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white font-mono text-center focus:outline-none focus:border-emerald-500" />
              <button type="button" onClick={() => setGracePeriodMins(Math.min(60, gracePeriodMins + 5))}
                className="w-8 h-8 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-bold transition">+</button>
              <span className="text-xs text-zinc-400">menit</span>
            </div>
          </div>
        </div>

        {/* ── Summary table */}
        <div className="glass rounded-xl p-5 border border-white/5">
          <p className="text-xs text-zinc-400 font-semibold mb-3 uppercase tracking-wider">
            Ringkasan Semua Tarif Kendaraan
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-500 border-b border-white/5">
                  <th className="text-left py-2 pr-3 font-semibold">Kendaraan</th>
                  <th className="text-center py-2 px-2 font-semibold">Mode</th>
                  <th className="text-right py-2 px-2 font-semibold">Tarif Utama</th>
                  <th className="text-right py-2 px-2 font-semibold">Jam Lanjut / Hari ke-2</th>
                  <th className="text-right py-2 pl-2 font-semibold">Denda Hilang</th>
                </tr>
              </thead>
              <tbody>
                {VEHICLE_TYPES.map(vt => {
                  const vtTariff = tariffs[vt.key as VehicleKey];
                  const isActive = activeVehicle === vt.key;
                  const isDaily = vtTariff.billingMode === 'daily';
                  return (
                    <tr key={vt.key}
                      className={`border-b border-white/5 cursor-pointer hover:bg-white/5 transition ${isActive ? 'bg-white/5' : ''}`}
                      onClick={() => setActiveVehicle(vt.key as VehicleKey)}>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2">
                          <span>{vt.emoji}</span>
                          <span className={`font-semibold ${isActive ? 'text-white' : 'text-zinc-400'}`}>{vt.label}</span>
                          {isActive && <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold">EDIT</span>}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                          isDaily ? 'bg-violet-500/20 text-violet-300' : 'bg-sky-500/20 text-sky-300'
                        }`}>
                          {isDaily ? '📅 Hari' : '⏱️ Jam'}
                        </span>
                      </td>
                      <td className="text-right py-2.5 px-2 font-mono text-white">
                        Rp {(isDaily ? vtTariff.dailyRate : vtTariff.firstHour).toLocaleString('id-ID')}
                        <span className="text-zinc-500 ml-1">/{isDaily ? 'hari' : 'jam₁'}</span>
                      </td>
                      <td className="text-right py-2.5 px-2 font-mono text-zinc-300">
                        {isDaily
                          ? <span className="text-zinc-500 text-[10px]">+Rp {vtTariff.dailyRate.toLocaleString('id-ID')}/hari</span>
                          : <span>Rp {vtTariff.hourlyRate.toLocaleString('id-ID')}<span className="text-zinc-500 ml-1">/jam</span></span>
                        }
                      </td>
                      <td className="text-right py-2.5 pl-2 font-mono text-rose-400">
                        Rp {vtTariff.lostTicketFine.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        </div> {/* End Left Column */}

        {/* Right Column: Member Config */}
        <div className="space-y-6">

        {/* ── Member Tariff Packages Config */}
        <div className="glass rounded-xl p-5 border border-white/5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5 border-b border-white/5 pb-2.5">
            💳 Tarif & Paket Keanggotaan Member RFID
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Registration Fee */}
            <div className="space-y-2 md:col-span-2">
              <label className="block text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                📝 Biaya Pendaftaran / Registrasi Member Baru
              </label>
              <div className="relative max-w-xs">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-mono">Rp</span>
                <input type="text"
                  value={(tariffs.memberRegistrationFee || 0).toLocaleString('id-ID')}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '');
                    setTariffs(prev => ({ ...prev, memberRegistrationFee: val ? parseInt(val, 10) : 0 }));
                  }}
                  className="w-full bg-zinc-950 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500 transition" />
              </div>
              <p className="text-[10px] text-zinc-500">Biaya dasar saat pendaftaran member baru pertama kali</p>
            </div>

            {/* Conversion Admin Fee */}
            <div className="space-y-2 md:col-span-2">
              <label className="block text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                🔄 Biaya Administrasi Konversi Jenis Member
              </label>
              <div className="relative max-w-xs">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-mono">Rp</span>
                <input type="text"
                  value={(tariffs.memberConversionFee || 0).toLocaleString('id-ID')}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '');
                    setTariffs(prev => ({ ...prev, memberConversionFee: val ? parseInt(val, 10) : 0 }));
                  }}
                  className="w-full bg-zinc-950 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500 transition" />
              </div>
              <p className="text-[10px] text-zinc-500">Biaya admin saat melakukan migrasi tipe Bulanan &harr; Kuota</p>
            </div>

            {/* Top-up Quota Packages */}
            <div className="space-y-3">
              <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                🎫 Paket Top-up Kuota (4 Paket)
              </p>
              <div className="space-y-2">
                {(tariffs.memberTopupPackages || []).map((pkg, idx) => (
                  <div key={idx} className="flex gap-2 items-center bg-zinc-950/40 p-2 rounded-lg border border-white/5">
                    <div className="flex-1 flex items-center gap-1">
                      <input type="number" min="1"
                        value={pkg.quota}
                        onChange={e => {
                          const updated = [...tariffs.memberTopupPackages];
                          updated[idx].quota = Number(e.target.value);
                          setTariffs(prev => ({ ...prev, memberTopupPackages: updated }));
                        }}
                        className="w-12 bg-zinc-950 border border-white/10 rounded px-2 py-1 text-xs text-center text-white font-mono" />
                      <span className="text-[10px] text-zinc-500">masuk</span>
                    </div>
                    <div className="flex-2 flex items-center relative">
                      <span className="absolute left-2 text-[10px] text-zinc-500 font-mono">Rp</span>
                      <input type="text"
                        value={pkg.price.toLocaleString('id-ID')}
                        onChange={e => {
                          const val = e.target.value.replace(/\D/g, '');
                          const updated = [...tariffs.memberTopupPackages];
                          updated[idx].price = val ? parseInt(val, 10) : 0;
                          setTariffs(prev => ({ ...prev, memberTopupPackages: updated }));
                        }}
                        className="w-24 bg-zinc-950 border border-white/10 rounded pl-6 pr-2 py-1 text-xs text-right text-white font-mono" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Monthly Renewal Packages */}
            <div className="space-y-3">
              <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                📅 Paket Perpanjang Bulanan (4 Paket)
              </p>
              <div className="space-y-2">
                {(tariffs.memberMonthlyPackages || []).map((pkg, idx) => (
                  <div key={idx} className="flex gap-2 items-center bg-zinc-950/40 p-2 rounded-lg border border-white/5">
                    <div className="flex-1 flex items-center gap-1">
                      <input type="number" min="1"
                        value={pkg.months}
                        onChange={e => {
                          const updated = [...tariffs.memberMonthlyPackages];
                          updated[idx].months = Number(e.target.value);
                          updated[idx].label = `${updated[idx].months} Bulan`;
                          setTariffs(prev => ({ ...prev, memberMonthlyPackages: updated }));
                        }}
                        className="w-10 bg-zinc-950 border border-white/10 rounded px-1.5 py-1 text-xs text-center text-white font-mono" />
                      <input type="text"
                        value={pkg.label}
                        onChange={e => {
                          const updated = [...tariffs.memberMonthlyPackages];
                          updated[idx].label = e.target.value;
                          setTariffs(prev => ({ ...prev, memberMonthlyPackages: updated }));
                        }}
                        className="w-16 bg-zinc-950 border border-white/10 rounded px-1.5 py-1 text-[10px] text-zinc-300 font-medium" />
                    </div>
                    <div className="flex-2 flex items-center relative">
                      <span className="absolute left-2 text-[10px] text-zinc-500 font-mono">Rp</span>
                      <input type="text"
                        value={pkg.price.toLocaleString('id-ID')}
                        onChange={e => {
                          const val = e.target.value.replace(/\D/g, '');
                          const updated = [...tariffs.memberMonthlyPackages];
                          updated[idx].price = val ? parseInt(val, 10) : 0;
                          setTariffs(prev => ({ ...prev, memberMonthlyPackages: updated }));
                        }}
                        className="w-24 bg-zinc-950 border border-white/10 rounded pl-6 pr-2 py-1 text-xs text-right text-white font-mono" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Save */}
        <button type="submit" disabled={saving}
          className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-60 text-zinc-950 font-bold rounded-xl transition flex items-center justify-center gap-2 text-sm shadow-lg shadow-emerald-500/20">
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Menyimpan...' : 'Simpan Semua Konfigurasi Tarif'}
        </button>

        </div> {/* End Right Column */}
      </form>
    </div>
  );
};
