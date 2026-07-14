import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Check, ShieldAlert, Cpu, Printer, Video } from 'lucide-react';

interface Gate {
  id: string;
  name: string;
  type: string;
  ipAddress: string;
  printerIp?: string;
  cctvIp?: string;
  status: string;
}

interface GateConfiguratorProps {
  currentUser: { username: string; role: string } | null;
  gates: Gate[];
  refreshGates: () => void;
  systemMode: 'simulation' | 'production';
  setSystemMode: (mode: 'simulation' | 'production') => void;
}

export const GateConfigurator: React.FC<GateConfiguratorProps> = ({
  currentUser,
  gates,
  refreshGates,
  systemMode,
  setSystemMode,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState('entry');
  const [ipAddress, setIpAddress] = useState('192.168.1.100');
  const [printerIp, setPrinterIp] = useState('192.168.1.150');
  const [cctvIp, setCctvIp] = useState('rtsp://192.168.1.200/h264');
  const [status, setStatus] = useState('online');

  const [error, setError] = useState('');

  const [opPrinterIp, setOpPrinterIp] = useState('192.168.1.150');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/gates/settings`);
      if (res.ok) {
        const data = await res.json();
        setOpPrinterIp(data.operatorPrinterIp || '192.168.1.150');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveSettings = async (mode: 'simulation' | 'production', printerIpVal: string) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/gates/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemMode: mode, operatorPrinterIp: printerIpVal }),
      });
      if (res.ok) {
        setSystemMode(mode);
        setOpPrinterIp(printerIpVal);
        setError('Pengaturan sistem dan printer operator berhasil disimpan!');
        setTimeout(() => setError(''), 3000);
      }
    } catch (e) {
      console.error('Gagal menyimpan settings:', e);
      setError('Gagal menyimpan settings.');
    }
  };

  const handleToggleSystemMode = (mode: 'simulation' | 'production') => {
    handleSaveSettings(mode, opPrinterIp);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !ipAddress) return;

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/gates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, ipAddress, printerIp, cctvIp, status }),
      });
      if (res.ok) {
        setShowForm(false);
        clearForm();
        refreshGates();
      }
    } catch (e) {
      console.error(e);
      setError('Gagal membuat gate.');
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/gates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, ipAddress, printerIp, cctvIp, status }),
      });
      if (res.ok) {
        setEditingId(null);
        clearForm();
        refreshGates();
      }
    } catch (e) {
      console.error(e);
      setError('Gagal memperbarui gate.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus gate ini?')) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/gates/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        refreshGates();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const startEdit = (g: Gate) => {
    setEditingId(g.id);
    setName(g.name);
    setType(g.type);
    setIpAddress(g.ipAddress);
    setPrinterIp(g.printerIp || '192.168.1.150');
    setCctvIp(g.cctvIp || 'rtsp://192.168.1.200/h264');
    setStatus(g.status);
  };

  const clearForm = () => {
    setName('');
    setType('entry');
    setIpAddress('192.168.1.100');
    setPrinterIp('192.168.1.150');
    setCctvIp('rtsp://192.168.1.200/h264');
    setStatus('online');
    setError('');
  };

  const isNotAdmin = currentUser?.role !== 'admin';

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Cpu className="h-5 w-5 text-emerald-400" />
          Konfigurasi Gerbang Parkir (Multi-Gate)
        </h2>
        {!isNotAdmin && (
          <button
            onClick={() => {
              setShowForm(!showForm);
              setEditingId(null);
              clearForm();
            }}
            className="bg-emerald-500 hover:bg-emerald-600 text-zinc-950 px-4 py-2 rounded-lg font-bold transition text-xs flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5 stroke-[3]" />
            Tambah Gerbang
          </button>
        )}
      </div>

      {/* System Operational Mode Toggle Panel */}
      <div className="glass rounded-xl p-5 border border-white/5 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h4 className="font-extrabold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${systemMode === 'production' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}></span>
              Mode Operasional Sistem: <span className={systemMode === 'production' ? 'text-amber-400' : 'text-emerald-400'}>{systemMode === 'production' ? 'Produksi (Hardware Real)' : 'Simulasi (Sensor Virtual)'}</span>
            </h4>
            <p className="text-zinc-500 text-xs mt-1.5 leading-relaxed max-w-xl">
              Pilih <strong>Mode Simulasi</strong> untuk menjalankan simulasi virtual sensor gerbang di dashboard. Pilih <strong>Mode Produksi (LAN)</strong> untuk mengaktifkan cetak karcis fisik ke IP Printer (Port 9100) dan pengiriman perintah buka palang ke IP ESP32 Controller secara real-time.
            </p>
          </div>
          
          <div className="flex bg-zinc-950 p-1.5 rounded-lg border border-white/15 shrink-0 w-full md:w-auto">
            <button
              type="button"
              onClick={() => handleToggleSystemMode('simulation')}
              disabled={isNotAdmin}
              className={`flex-1 md:flex-initial px-4 py-2 rounded-md text-xs font-bold transition duration-200 ${
                systemMode === 'simulation'
                  ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/10'
                  : 'text-zinc-400 hover:text-white disabled:opacity-50'
              }`}
            >
              Mode Simulasi
            </button>
            <button
              type="button"
              onClick={() => handleToggleSystemMode('production')}
              disabled={isNotAdmin}
              className={`flex-1 md:flex-initial px-4 py-2 rounded-md text-xs font-bold transition duration-200 ${
                systemMode === 'production'
                  ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/10'
                  : 'text-zinc-400 hover:text-white disabled:opacity-50'
              }`}
            >
              Mode Produksi (LAN)
            </button>
          </div>
        </div>

        {/* IP Printer Operator Setting */}
        {!isNotAdmin && (
          <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div>
              <p className="font-bold text-white flex items-center gap-1.5">
                <Printer className="h-4 w-4 text-emerald-400" />
                IP Printer Thermal Operator
              </p>
              <p className="text-[10px] text-zinc-500">Printer yang mencetak struk transaksi pendaftaran, topup, dan konversi member.</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <input
                type="text"
                value={opPrinterIp}
                onChange={e => setOpPrinterIp(e.target.value)}
                placeholder="Contoh: 192.168.1.150"
                className="bg-zinc-950 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500 w-full sm:w-44 text-center"
              />
              <button
                type="button"
                onClick={() => handleSaveSettings(systemMode, opPrinterIp)}
                className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-bold transition hover:text-emerald-400 shrink-0"
              >
                Simpan IP Printer
              </button>
            </div>
          </div>
        )}
      </div>

      {isNotAdmin && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg flex items-center gap-2">
          <ShieldAlert className="h-4 w-4" />
          Otorisasi Diperlukan: Hanya Administrator yang berhak mengelola gerbang dan mengubah mode operasional sistem.
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg">
          {error}
        </div>
      )}

      {(showForm || editingId) && !isNotAdmin && (
        <form
          onSubmit={editingId ? (e) => { e.preventDefault(); handleUpdate(editingId); } : handleCreate}
          className="glass rounded-xl p-5 space-y-4 animate-fadeIn border border-white/5"
        >
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            {editingId ? 'Edit Konfigurasi Gerbang' : 'Tambah Gerbang Baru'}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] text-zinc-400 font-bold mb-1 uppercase">Nama Gerbang:</label>
              <input
                type="text"
                required
                placeholder="Contoh: Gate Masuk 3"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-400 font-bold mb-1 uppercase">Tipe Gerbang:</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="entry">Entry (Masuk)</option>
                <option value="exit">Exit (Keluar)</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-zinc-400 font-bold mb-1 uppercase">IP Address Controller (ESP32):</label>
              <input
                type="text"
                required
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-white/5 pt-3">
            <div>
              <label className="block text-[10px] text-zinc-400 font-bold mb-1 uppercase flex items-center gap-1">
                <Printer className="h-3 w-3 text-emerald-400" /> IP Printer Karcis:
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: 192.168.1.150"
                value={printerIp}
                onChange={(e) => setPrinterIp(e.target.value)}
                className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-400 font-bold mb-1 uppercase flex items-center gap-1">
                <Video className="h-3 w-3 text-emerald-400" /> RTSP / IP CCTV Camera:
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: rtsp://192.168.1.200/h264"
                value={cctvIp}
                onChange={(e) => setCctvIp(e.target.value)}
                className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-400 font-bold mb-1 uppercase">Status Hardware:</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="online">Online</option>
                <option value="offline">Offline</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                clearForm();
              }}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition text-xs font-bold"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold rounded-lg transition text-xs flex items-center gap-1"
            >
              <Check className="h-3.5 w-3.5" />
              Simpan Gerbang
            </button>
          </div>
        </form>
      )}

      {/* Multi-gate Card List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {gates.map((g) => (
          <div key={g.id} className="glass rounded-xl p-5 flex justify-between items-start border border-white/5 hover:border-emerald-500/10 transition duration-300">
            <div className="space-y-1">
              <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                g.type === 'entry' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
              }`}>
                {g.type === 'entry' ? 'Gerbang Masuk' : 'Gerbang Keluar'}
              </span>
              <h4 className="font-extrabold text-white text-md mt-1.5">{g.name}</h4>
              
              <div className="pt-2 space-y-1 text-xs text-zinc-400 font-mono">
                <p><span className="text-zinc-600">IP Controller:</span> {g.ipAddress}</p>
                <p><span className="text-zinc-600">IP Printer   :</span> {g.printerIp || '192.168.1.150'}</p>
                <p><span className="text-zinc-600">CCTV Camera  :</span> <span className="truncate max-w-[200px] inline-block align-bottom">{g.cctvIp || 'rtsp://192.168.1.200/h264'}</span></p>
              </div>

              <div className="flex items-center gap-1.5 mt-3 pt-1">
                <span className={`h-2 w-2 rounded-full ${g.status === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
                <span className="text-[10px] uppercase font-bold text-zinc-500">{g.status}</span>
              </div>
            </div>

            {!isNotAdmin && (
              <div className="flex gap-1.5">
                <button
                  onClick={() => startEdit(g)}
                  className="p-1.5 bg-zinc-800/40 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded transition"
                  title="Edit"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(g.id)}
                  className="p-1.5 bg-zinc-800/40 hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 rounded transition"
                  title="Hapus"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
