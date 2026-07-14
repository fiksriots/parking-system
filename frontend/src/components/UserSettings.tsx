import React, { useState, useEffect } from 'react';
import { Shield, Plus, Trash2, Check, AlertTriangle, Key } from 'lucide-react';

interface User {
  id: string;
  username: string;
  role: string;
  permissions: string[];
  createdAt: string;
}

interface UserSettingsProps {
  currentUser: { username: string; role: string } | null;
}

const AVAILABLE_PERMISSIONS = [
  { key: 'can_view_dashboard', label: 'Dashboard Live' },
  { key: 'can_simulate_gates', label: 'Sensor Simulator' },
  { key: 'can_operate_pos', label: 'Loket Kasir' },
  { key: 'can_manage_members', label: 'Member RFID' },
  { key: 'can_manage_tariffs', label: 'Keuangan (Tarif & Ledger)' },
  { key: 'can_manage_gates', label: 'Konfigurasi Gate' },
  { key: 'can_manage_users', label: 'Manajemen User & Izin' },
  { key: 'can_view_reports', label: 'Statistik Laporan' },
  { key: 'can_view_audit', label: 'Log Audit' },
];

const DEFAULT_PERMISSIONS_BY_ROLE: Record<string, string[]> = {
  admin: AVAILABLE_PERMISSIONS.map(p => p.key),
  spv: ['can_view_dashboard', 'can_operate_pos', 'can_manage_members', 'can_view_reports', 'can_view_audit'],
  operator: ['can_view_dashboard', 'can_simulate_gates', 'can_manage_gates'],
  cashier: ['can_operate_pos'],
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  spv: 'Supervisor (SPV)',
  operator: 'Operator / Teknisi',
  cashier: 'Penjaga Loket / Kasir',
};

export const UserSettings: React.FC<UserSettingsProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [username, setUsername] = useState('');
  const [passwordHash, setPasswordHash] = useState('');
  const [role, setRole] = useState('cashier');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(DEFAULT_PERMISSIONS_BY_ROLE.cashier);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || window.location.origin}/api/users`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setUsers(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Pre-fill default permissions when a role is selected, but allow custom editing
  const handleRoleChange = (selectedRole: string) => {
    setRole(selectedRole);
    setSelectedPermissions(DEFAULT_PERMISSIONS_BY_ROLE[selectedRole] || []);
  };

  const togglePermission = (key: string) => {
    if (selectedPermissions.includes(key)) {
      setSelectedPermissions(selectedPermissions.filter(p => p !== key));
    } else {
      setSelectedPermissions([...selectedPermissions, key]);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (!username || !passwordHash) return;

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || window.location.origin}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          passwordHash,
          role,
          permissions: selectedPermissions,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(`Pengguna "${username}" berhasil dibuat dengan izin kustom.`);
        setUsername('');
        setPasswordHash('');
        setRole('cashier');
        setSelectedPermissions(DEFAULT_PERMISSIONS_BY_ROLE.cashier);
        setShowAddForm(false);
        fetchUsers();
        setTimeout(() => setMessage(''), 3000);
      } else {
        setError(data.message || 'Gagal membuat pengguna.');
      }
    } catch (e) {
      console.error(e);
      setError('Terjadi kesalahan koneksi.');
    }
  };

  const handleDelete = async (id: string, nameToDelete: string) => {
    if (nameToDelete === 'admin') {
      alert('Pengguna admin utama bawaan sistem tidak dapat dihapus.');
      return;
    }
    if (!confirm(`Apakah Anda yakin ingin menghapus pengguna "${nameToDelete}"?`)) return;

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || window.location.origin}/api/users/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (res.ok) {
        setMessage(`Pengguna "${nameToDelete}" berhasil dihapus.`);
        fetchUsers();
        setTimeout(() => setMessage(''), 3000);
      } else {
        setError(data.message || 'Gagal menghapus pengguna.');
      }
    } catch (e) {
      console.error(e);
      setError('Terjadi kesalahan koneksi.');
    }
  };

  const isNotAdmin = currentUser?.role !== 'admin';

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Shield className="h-5 w-5 text-emerald-400" />
          Manajemen Pengguna & Izin Akses (Custom Permissions)
        </h2>
        {!isNotAdmin && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-emerald-500 hover:bg-emerald-600 text-zinc-950 px-4 py-2 rounded-lg font-bold transition text-xs flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5 stroke-[3]" />
            Tambah User Baru
          </button>
        )}
      </div>

      {isNotAdmin && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Otorisasi Diperlukan: Hanya Administrator yang berhak mengelola akun pengguna sistem.
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

      {showAddForm && !isNotAdmin && (
        <form onSubmit={handleCreate} className="glass rounded-xl p-5 space-y-4 animate-fadeIn border border-white/5">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
            <Key className="h-4 w-4 text-emerald-400" />
            Form Tambah Pengguna Baru
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] text-zinc-400 mb-1 uppercase font-bold">Username:</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-400 mb-1 uppercase font-bold">Password:</label>
              <input
                type="password"
                required
                value={passwordHash}
                onChange={(e) => setPasswordHash(e.target.value)}
                className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-400 mb-1 uppercase font-bold">Tingkatan Pengguna (Role):</label>
              <select
                value={role}
                onChange={(e) => handleRoleChange(e.target.value)}
                className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="cashier">Penjaga Loket / Kasir</option>
                <option value="operator">Operator / Teknisi</option>
                <option value="spv">Supervisor (SPV)</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
          </div>

          {/* Custom Checklist Permissions */}
          <div className="border-t border-white/5 pt-3 space-y-2">
            <span className="block text-[10px] text-zinc-400 uppercase font-bold">
              Konfigurasi Izin Akses (Custom Permissions Checkbox):
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {AVAILABLE_PERMISSIONS.map((perm) => {
                const checked = selectedPermissions.includes(perm.key);
                return (
                  <label
                    key={perm.key}
                    className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition ${
                      checked 
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-white' 
                        : 'bg-zinc-950/40 border-white/5 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePermission(perm.key)}
                      className="accent-emerald-500 h-3.5 w-3.5 cursor-pointer rounded"
                    />
                    <span className="font-semibold">{perm.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition text-xs font-bold"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold rounded-lg transition text-xs flex items-center gap-1"
            >
              <Check className="h-3.5 w-3.5" />
              Simpan Pengguna
            </button>
          </div>
        </form>
      )}

      {/* Users table */}
      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-950/40 text-zinc-400 border-b border-white/5 uppercase tracking-wider font-bold">
            <tr>
              <th className="p-4">Username</th>
              <th className="p-4">Tingkatan (Role)</th>
              <th className="p-4">Izin Akses Custom (Permissions)</th>
              <th className="p-4">Dibuat Pada</th>
              {!isNotAdmin && <th className="p-4 text-right">Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-zinc-300">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-white/[0.02] transition">
                <td className="p-4 font-extrabold text-white text-sm">{u.username}</td>
                <td className="p-4">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    u.role === 'admin' 
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                      : u.role === 'spv' 
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                      : u.role === 'operator' 
                      ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' 
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}>
                    {ROLE_LABELS[u.role] || u.role}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex flex-wrap gap-1 max-w-md">
                    {Array.isArray(u.permissions) && u.permissions.length > 0 ? (
                      u.permissions.map((p) => {
                        const label = AVAILABLE_PERMISSIONS.find(ap => ap.key === p)?.label || p;
                        return (
                          <span key={p} className="text-[9px] px-1.5 py-0.5 bg-zinc-900 border border-white/5 rounded text-zinc-400">
                            {label}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-[10px] text-zinc-600 font-semibold italic">Tidak ada izin</span>
                    )}
                  </div>
                </td>
                <td className="p-4 text-zinc-500">{new Date(u.createdAt).toLocaleDateString('id-ID')}</td>
                {!isNotAdmin && (
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleDelete(u.id, u.username)}
                      disabled={u.username === 'admin'}
                      className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
