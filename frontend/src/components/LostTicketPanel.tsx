import React, { useState, useEffect } from 'react';
import { FileText, Check, RefreshCw, AlertTriangle } from 'lucide-react';

interface ActiveCar {
  id: string;
  ticketCode: string;
  plateNumber: string;
  entryTime: string;
  gateId: string;
}

interface Gate {
  id: string;
  name: string;
  type: string;
}

interface LostTicketPanelProps {
  currentUser: { username: string; role: string } | null;
  gates: Gate[];
}

export const LostTicketPanel: React.FC<LostTicketPanelProps> = ({ currentUser, gates }) => {
  const [activeCars, setActiveCars] = useState<ActiveCar[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState('');
  const [identityCard, setIdentityCard] = useState('');
  const [stnkNumber, setStnkNumber] = useState('');
  const [selectedGateId, setSelectedGateId] = useState('');
  const [fineAmount, setFineAmount] = useState(50000);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const exitGates = gates.filter((g) => g.type === 'exit');

  useEffect(() => {
    fetchActiveCars();
    fetchTariff();
    if (exitGates.length > 0 && !selectedGateId) {
      setSelectedGateId(exitGates[0].id);
    }
  }, [gates]);

  const fetchActiveCars = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/reports/active-entries`);
      const data = await res.json();
      setActiveCars(data);
      if (data.length > 0) {
        setSelectedEntryId(data[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTariff = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/payment/tariff`);
      const data = await res.json();
      setFineAmount(data.lostTicketFine);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (!selectedEntryId || !identityCard || !stnkNumber || !selectedGateId) {
      setError('Harap lengkapi semua isian formulir.');
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/payment/lost-ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gateId: selectedGateId,
          entryId: selectedEntryId,
          identityCard,
          stnkNumber,
          operatorUsername: currentUser?.username || 'admin',
        }),
      });

      const result = await res.json();

      if (res.ok && result.success !== false) {
        setMessage(`Denda karcis hilang diproses! Palang pintu keluar dibuka.`);
        clearForm();
        fetchActiveCars();
      } else {
        setError(result.message || 'Gagal memproses denda karcis hilang.');
      }
    } catch (e) {
      console.error(e);
      setError('Terjadi kesalahan koneksi saat memproses.');
    }
  };

  const clearForm = () => {
    setIdentityCard('');
    setStnkNumber('');
  };

  const selectedCar = activeCars.find((c) => c.id === selectedEntryId);

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-xl font-bold text-white flex items-center gap-2">
        <FileText className="h-5 w-5 text-amber-500" />
        Pemrosesan Karcis Hilang (Denda)
      </h2>

      {currentUser && currentUser.role !== 'admin' && currentUser.role !== 'supervisor' && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Otorisasi Diperlukan: Fitur ini hanya dapat dieksekusi oleh Supervisor atau Administrator.
        </div>
      )}

      {message && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-lg">
          {message}
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="glass rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Select car inside parking area */}
          <div className="space-y-1">
            <label className="block text-xs text-zinc-400 font-medium">Pilih Kendaraan Parkir:</label>
            <div className="flex gap-2">
              <select
                value={selectedEntryId}
                onChange={(e) => setSelectedEntryId(e.target.value)}
                className="flex-1 bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
              >
                {activeCars.length === 0 ? (
                  <option value="">-- Tidak ada mobil terparkir --</option>
                ) : (
                  activeCars.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.plateNumber} (Masuk: {new Date(c.entryTime).toLocaleTimeString('id-ID')})
                    </option>
                  ))
                )}
              </select>
              <button
                type="button"
                onClick={fetchActiveCars}
                className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg transition"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Target gate to open */}
          <div className="space-y-1">
            <label className="block text-xs text-zinc-400 font-medium">Buka Palang Gerbang Keluar:</label>
            <select
              value={selectedGateId}
              onChange={(e) => setSelectedGateId(e.target.value)}
              className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
            >
              {exitGates.length === 0 ? (
                <option value="">-- Tidak ada gate keluar --</option>
              ) : (
                exitGates.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {selectedCar && (
          <div className="bg-zinc-950/40 border border-white/5 rounded-lg p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-zinc-500">Waktu Masuk:</span>
              <span className="font-bold text-zinc-300">{new Date(selectedCar.entryTime).toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Plat Nomor:</span>
              <span className="font-mono font-bold text-white">{selectedCar.plateNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Kode Karcis Masuk:</span>
              <span className="font-mono text-zinc-400">{selectedCar.ticketCode || 'MEMBER RFID'}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Identity verification */}
          <div className="space-y-1">
            <label className="block text-xs text-zinc-400 font-medium">Nomor Identitas Pemilik (KTP/SIM):</label>
            <input
              type="text"
              required
              placeholder="Masukkan nomor NIK KTP..."
              value={identityCard}
              onChange={(e) => setIdentityCard(e.target.value)}
              className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* STNK verification */}
          <div className="space-y-1">
            <label className="block text-xs text-zinc-400 font-medium">Nomor STNK Kendaraan:</label>
            <input
              type="text"
              required
              placeholder="Masukkan nomor seri STNK..."
              value={stnkNumber}
              onChange={(e) => setStnkNumber(e.target.value)}
              className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Penalty details */}
        <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-4 flex justify-between items-center text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <div>
              <span className="font-bold text-white block">Denda Karcis Hilang</span>
              <span className="text-zinc-500">Tarif tetap denda kehilangan karcis parkir</span>
            </div>
          </div>
          <span className="text-lg font-extrabold text-amber-400">Rp {fineAmount.toLocaleString('id-ID')}</span>
        </div>

        <button
          type="submit"
          disabled={!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'supervisor')}
          className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-zinc-950 font-bold rounded-lg transition text-xs flex items-center justify-center gap-1.5"
        >
          <Check className="h-4 w-4" />
          Proses Denda & Buka Gerbang Keluar
        </button>
      </form>
    </div>
  );
};
