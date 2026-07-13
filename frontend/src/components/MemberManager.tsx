import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Check, X, Award, Search, Calendar, Hash, Phone, Mail, CreditCard, RefreshCw, ChevronUp, CalendarPlus, FileText, Printer } from 'lucide-react';

// ─── Interfaces ────────────────────────────────────────────────────────────────

interface Member {
  id: string;
  name: string;
  rfidCardNumber: string;
  memberType: 'monthly' | 'quota';
  expiryDate?: string;
  quotaTotal: number;
  quotaUsed: number;
  identityCard?: string;
  phoneNumber?: string;
  email?: string;
  status: string;
  createdAt?: string;
}

interface MemberTransaction {
  id: string;
  memberId: string;
  memberName: string;
  rfidCardNumber: string;
  transactionType: 'registration' | 'topup_quota' | 'renew_monthly' | 'change_type';
  amount: number;
  details: string;
  operatorUsername: string;
  timestamp: string;
}

// ─── Helper functions ──────────────────────────────────────────────────────────

const getExpiryInDays = (expiryDate?: string): number => {
  if (!expiryDate) return -1;
  return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000);
};

const addMonths = (months: number): string => {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
};

const getRenewFeeForMonths = (months: number, packages: any[]) => {
  if (!packages || packages.length === 0) return months * 30000;
  const pkg = packages.find(p => p.months === months);
  if (pkg) return pkg.price;
  const basePkg = packages.find(p => p.months === 1) || packages[0];
  const basePrice = basePkg ? basePkg.price : 30000;
  return months * basePrice;
};

const getTopupFeeForQuota = (quota: number, packages: any[]) => {
  if (!packages || packages.length === 0) return quota * 5000;
  const pkg = packages.find(p => p.quota === quota);
  if (pkg) return pkg.price;
  const basePkg = packages[0];
  const unitPrice = basePkg ? (basePkg.price / basePkg.quota) : 5000;
  return quota * unitPrice;
};

const printReceiptDirectly = (lines: string[]) => {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) return;

  const htmlContent = `
    <html>
      <head>
        <title>Struk Member RFID</title>
        <style>
          @page { margin: 0; size: auto; }
          body {
            font-family: monospace;
            font-size: 11px;
            line-height: 1.3;
            margin: 8px;
            padding: 0;
            color: #000;
            background-color: #fff;
          }
          .receipt-line {
            white-space: pre-wrap;
            word-break: break-all;
          }
        </style>
      </head>
      <body>
        ${lines.map(line => `<div class="receipt-line">${line || '&nbsp;'}</div>`).join('')}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() {
              window.parent.document.body.removeChild(window.frameElement);
            }, 500);
          };
        </script>
      </body>
    </html>
  `;

  doc.open();
  doc.write(htmlContent);
  doc.close();
};

const STATUS_STYLES: Record<string, string> = {
  active:    'bg-emerald-500/15 text-emerald-400',
  suspended: 'bg-amber-500/15 text-amber-400',
  expired:   'bg-rose-500/15 text-rose-400',
};

const defaultForm = () => ({
  name: '',
  rfidCardNumber: '',
  memberType: 'monthly' as 'monthly' | 'quota',
  expiryDate: addMonths(1),
  quotaTotal: 10,
  quotaUsed: 0,
  identityCard: '',
  phoneNumber: '',
  email: '',
  status: 'active',
  amountPaid: 30000, // Default registration fee
});

interface MemberManagerProps {
  initialMode?: 'manage' | 'conversion';
}

// ─── Component ─────────────────────────────────────────────────────────────────

export const MemberManager: React.FC<MemberManagerProps> = ({ initialMode = 'manage' }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [transactions, setTransactions] = useState<MemberTransaction[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'monthly' | 'quota'>('all');
  const [activeSubTab, setActiveSubTab] = useState<'list' | 'rekap'>('list');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Quota top-up state
  const [topupId, setTopupId] = useState<string | null>(null);
  const [topupAmount, setTopupAmount] = useState(10);
  const [topupFee, setTopupFee] = useState(50000); // Default fee for 10 entries

  // Monthly renewal state
  const [renewId, setRenewId] = useState<string | null>(null);
  const [renewMonths, setRenewMonths] = useState(1);
  const [renewFee, setRenewFee] = useState(30000); // Default fee for 1 month
  const [renewMessage, setRenewMessage] = useState('');

  // Cash received states for calculator
  const [regCashReceived, setRegCashReceived] = useState(0);
  const [topupCashReceived, setTopupCashReceived] = useState(0);
  const [renewCashReceived, setRenewCashReceived] = useState(0);
  const [convCashReceived, setConvCashReceived] = useState(0);

  // Dynamic Tariff Configuration from backend
  const [tariffConfig, setTariffConfig] = useState<any>({
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
  });

  const fetchTariffConfig = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/payment/tariff');
      if (res.ok) {
        const data = await res.json();
        setTariffConfig({
          memberRegistrationFee: data.memberRegistrationFee ?? 35000,
          memberConversionFee: data.memberConversionFee ?? 15000,
          memberTopupPackages: data.memberTopupPackages ?? [
            { quota: 10, price: 50000 },
            { quota: 20, price: 95000 },
            { quota: 50, price: 230000 },
            { quota: 100, price: 450000 }
          ],
          memberMonthlyPackages: data.memberMonthlyPackages ?? [
            { months: 1, label: '1 Bulan', price: 30000 },
            { months: 3, label: '3 Bulan', price: 80000 },
            { months: 6, label: '6 Bulan', price: 150000 },
            { months: 12, label: '1 Tahun', price: 280000 }
          ]
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Conversion state (inline panel)
  const [conversionId, setConversionId] = useState<string | null>(null);
  const [convQuota, setConvQuota] = useState(10);
  const [convExpiry, setConvExpiry] = useState(addMonths(1));
  const [convFeeAmount, setConvFeeAmount] = useState(15000);
  const [convMessage, setConvMessage] = useState('');

  // Virtual Receipt Modal
  const [virtualReceipt, setVirtualReceipt] = useState<string[] | null>(null);

  // Get current logged-in operator
  const getOperator = () => {
    try {
      const user = JSON.parse(localStorage.getItem('park_user') || '{}');
      return user.username || 'operator';
    } catch {
      return 'operator';
    }
  };

  useEffect(() => {
    fetchMembers();
    fetchTransactions();
    fetchTariffConfig();
  }, []);

  // Auto-print receipt directly on popup open
  useEffect(() => {
    if (virtualReceipt) {
      printReceiptDirectly(virtualReceipt);
    }
  }, [virtualReceipt]);

  const fetchMembers = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/members');
      setMembers(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTransactions = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/members/transactions/rekap');
      if (res.ok) {
        setTransactions(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const setField = (key: string, value: any) => {
    setForm(prev => {
      const updated = { ...prev, [key]: value };
      // Adjust default registration amount based on memberType
      if (key === 'memberType') {
        updated.amountPaid = value === 'monthly' ? 30000 : 50000;
      }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // Validation
    if (!form.name.trim())           return setFormError('Nama wajib diisi');
    if (!form.rfidCardNumber.trim()) return setFormError('Nomor RFID wajib diisi');
    if (!form.identityCard.trim())   return setFormError('Nomor KTP wajib diisi');
    if (!form.phoneNumber.trim())    return setFormError('Nomor telepon wajib diisi');
    if (!form.email.trim())          return setFormError('Email wajib diisi');
    if (form.memberType === 'monthly' && !form.expiryDate)
      return setFormError('Masa berlaku wajib diisi untuk member bulanan');
    if (form.memberType === 'quota' && form.quotaTotal <= 0)
      return setFormError('Total kuota harus lebih dari 0');

    setSaving(true);
    try {
      const isEdit = !!editingId;
      const url = isEdit ? `http://localhost:3000/api/members/${editingId}` : 'http://localhost:3000/api/members';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = {
        name:           form.name.trim(),
        rfidCardNumber: form.rfidCardNumber.trim().toUpperCase(),
        memberType:     form.memberType,
        expiryDate:     form.memberType === 'monthly' ? form.expiryDate : undefined,
        quotaTotal:     form.memberType === 'quota'   ? form.quotaTotal  : 0,
        identityCard:   form.identityCard.trim(),
        phoneNumber:    form.phoneNumber.trim(),
        email:          form.email.trim().toLowerCase(),
        status:         form.status,
        amount:         isEdit ? (tariffConfig.memberConversionFee || 15000) : (tariffConfig.memberRegistrationFee || 35000),
        operatorUsername: getOperator(),
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (res.ok) {
        // Show thermal receipt modal for registrations
        if (result.receipt) {
          setVirtualReceipt(result.receipt);
        }
        closeForm();
        fetchMembers();
        fetchTransactions();
      } else {
        setFormError(result.message || 'Gagal menyimpan data member.');
      }
    } catch {
      setFormError('Koneksi error.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus member ini? Data tidak dapat dikembalikan.')) return;
    await fetch(`http://localhost:3000/api/members/${id}`, { method: 'DELETE' });
    fetchMembers();
    fetchTransactions();
  };

  const handleTopupSubmit = async (id: string) => {
    if (topupAmount <= 0) return;
    try {
      const res = await fetch(`http://localhost:3000/api/members/${id}/topup-quota`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addQuota: topupAmount,
          amount: topupFee,
          operatorUsername: getOperator(),
        }),
      });
      const result = await res.json();
      if (res.ok && result.receipt) {
        setVirtualReceipt(result.receipt);
      }
      setTopupId(null);
      fetchMembers();
      fetchTransactions();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRenewSubmit = async (id: string) => {
    if (renewMonths <= 0) return;
    setRenewMessage('');
    try {
      const res = await fetch(`http://localhost:3000/api/members/${id}/renew`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addMonths: renewMonths,
          amount: renewFee,
          operatorUsername: getOperator(),
        }),
      });
      const result = await res.json();
      if (result.success) {
        if (result.receipt) {
          setVirtualReceipt(result.receipt);
        }
        fetchMembers();
        fetchTransactions();
        setRenewId(null);
      } else {
        setRenewMessage(`❌ ${result.message || 'Gagal memperpanjang.'}`);
      }
    } catch (e) {
      console.error(e);
      setRenewMessage('❌ Terjadi kesalahan koneksi.');
    }
  };

  const handleConversionSubmit = async (id: string, targetType: 'monthly' | 'quota') => {
    setConvMessage('');
    const targetMember = members.find(m => m.id === id);
    if (!targetMember) return;

    try {
      const res = await fetch(`http://localhost:3000/api/members/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...targetMember,
          memberType: targetType,
          quotaTotal: targetType === 'quota' ? convQuota : undefined,
          expiryDate: targetType === 'monthly' ? convExpiry : undefined,
          amount: convFeeAmount,
          operatorUsername: getOperator(),
        }),
      });
      const result = await res.json();
      if (res.ok) {
        if (result.receipt) {
          setVirtualReceipt(result.receipt);
        }
        setConversionId(null);
        fetchMembers();
        fetchTransactions();
      } else {
        setConvMessage(`❌ ${result.message || 'Gagal melakukan konversi.'}`);
      }
    } catch {
      setConvMessage('❌ Terjadi kesalahan koneksi.');
    }
  };

  const handleReprintReceipt = async (t: MemberTransaction) => {
    // Generate the lines for reprint
    const cleanDate = new Date(t.timestamp).toLocaleString('id-ID');
    const headerType = t.transactionType === 'registration' ? 'REGISTRATION RECEIPT'
      : t.transactionType === 'topup_quota' ? 'TOP-UP RECEIPT'
      : t.transactionType === 'renew_monthly' ? 'RENEWAL RECEIPT'
      : 'CONVERSION RECEIPT';

    const lines = [
      '--------------------------------',
      '         PARKING MEMBER         ',
      `      ${headerType}      `,
      '         (DUPLIKAT)             ',
      '--------------------------------',
      `Tanggal    : ${cleanDate}`,
      `Operator   : ${t.operatorUsername}`,
      `Nama       : ${t.memberName}`,
      `Card RFID  : ${t.rfidCardNumber}`,
      `Biaya      : Rp ${t.amount.toLocaleString('id-ID')}`,
      `Detail     : ${t.details}`,
      '--------------------------------',
      '          TERIMA KASIH          ',
      '--------------------------------',
    ];

    setVirtualReceipt(lines);

    // Also trigger physical network print if on production
    try {
      const settingsRes = await fetch('http://localhost:3000/api/gates/settings');
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        if (settings.systemMode === 'production') {
          // Fire-and-forget network print request to operator printer via API if needed
          // Or print from frontend using device printer
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const todayStr = new Date().toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric'
    });

    const rows = transactions.map(t => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; font-family: monospace;">
          ${new Date(t.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">
          <strong>${t.memberName}</strong><br/>
          <span style="color: #666; font-family: monospace; font-size: 10px;">${t.rfidCardNumber}</span>
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; text-transform: uppercase; font-size: 10px; color: ${
          t.transactionType === 'registration' ? '#10b981'
            : t.transactionType === 'topup_quota' ? '#8b5cf6'
            : t.transactionType === 'renew_monthly' ? '#0ea5e9'
            : '#f59e0b'
        };">
          ${t.transactionType === 'registration' ? 'Registrasi'
            : t.transactionType === 'topup_quota' ? 'Top-up Kuota'
            : t.transactionType === 'renew_monthly' ? 'Perpanjang'
            : 'Konversi Tipe'}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #555;">
          ${t.details}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-family: monospace; font-weight: bold;">
          Rp ${t.amount.toLocaleString('id-ID')}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #555;">
          ${t.operatorUsername}
        </td>
      </tr>
    `).join('');

    const htmlContent = `
      <html>
        <head>
          <title>Laporan Transaksi Member RFID - ${todayStr}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 30px; color: #333; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 3px double #333; padding-bottom: 15px; }
            .header h1 { margin: 0; font-size: 22px; text-transform: uppercase; letter-spacing: 1px; }
            .header p { margin: 5px 0 0; font-size: 12px; color: #666; font-weight: bold; }
            .meta { margin-bottom: 25px; font-size: 11px; line-height: 1.6; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
            th { background-color: #f8f9fa; padding: 12px 10px; border-bottom: 2px solid #333; text-align: left; text-transform: uppercase; font-weight: bold; }
            .summary { margin-top: 30px; text-align: right; font-size: 14px; font-weight: bold; border-top: 2px solid #333; padding-top: 15px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Laporan Transaksi Harian Member RFID</h1>
            <p>Sistem Parkir Manless Berbasis Web</p>
          </div>
          <div class="meta">
            <strong>Tanggal Laporan:</strong> ${todayStr}<br/>
            <strong>Waktu Ekspor:</strong> ${new Date().toLocaleTimeString('id-ID')}<br/>
            <strong>Total Transaksi:</strong> ${transactions.length} transaksi
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 10%">Waktu</th>
                <th style="width: 25%">Nama / RFID</th>
                <th style="width: 15%">Tipe</th>
                <th style="width: 25%">Keterangan</th>
                <th style="width: 15%; text-align: right;">Biaya</th>
                <th style="width: 10%">Operator</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
          <div class="summary">
            Grand Total Penerimaan Harian: Rp ${grandTotalRevenue.toLocaleString('id-ID')}
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

  const openTopup = (id: string) => {
    setTopupId(id);
    setRenewId(null);
    setConversionId(null);
    setExpandedId(null);
    const defaultPkg = tariffConfig.memberTopupPackages[0];
    setTopupAmount(defaultPkg ? defaultPkg.quota : 10);
    setTopupFee(defaultPkg ? defaultPkg.price : 50000);
    setTopupCashReceived(0);
  };

  const openRenew = (id: string) => {
    setRenewId(id);
    setTopupId(null);
    setConversionId(null);
    setExpandedId(null);
    const defaultPkg = tariffConfig.memberMonthlyPackages[0];
    setRenewMonths(defaultPkg ? defaultPkg.months : 1);
    setRenewFee(defaultPkg ? defaultPkg.price : 30000);
    setRenewMessage('');
    setRenewCashReceived(0);
  };

  const openConversion = (id: string) => {
    setConversionId(id);
    setTopupId(null);
    setRenewId(null);
    setExpandedId(null);
    setConvQuota(10);
    setConvExpiry(addMonths(1));
    setConvFeeAmount(tariffConfig.memberConversionFee || 15000);
    setConvMessage('');
    setConvCashReceived(0);
  };

  const closeActions = () => {
    setTopupId(null);
    setRenewId(null);
    setConversionId(null);
  };

  const startEdit = (m: Member) => {
    setEditingId(m.id);
    setForm({
      name:           m.name,
      rfidCardNumber: m.rfidCardNumber,
      memberType:     m.memberType || 'monthly',
      expiryDate:     m.expiryDate ? new Date(m.expiryDate).toISOString().split('T')[0] : addMonths(1),
      quotaTotal:     m.quotaTotal || 0,
      quotaUsed:      m.quotaUsed  || 0,
      identityCard:   m.identityCard || '',
      phoneNumber:    m.phoneNumber  || '',
      email:          m.email        || '',
      status:         m.status,
      amountPaid:     0,
    });
    setShowForm(true);
    setFormError('');
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(defaultForm());
    setFormError('');
  };

  const filtered = members.filter(m => {
    const matchSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.rfidCardNumber.toLowerCase().includes(search.toLowerCase()) ||
      (m.phoneNumber || '').includes(search) ||
      (m.email || '').toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || m.memberType === filterType;
    return matchSearch && matchType;
  });

  const monthlyCount = members.filter(m => m.memberType === 'monthly').length;
  const quotaCount   = members.filter(m => m.memberType === 'quota').length;
  const activeCount  = members.filter(m => m.status === 'active').length;

  // Daily rekap calculations
  const totalRegistrationRevenue = transactions.filter(t => t.transactionType === 'registration').reduce((sum, t) => sum + t.amount, 0);
  const totalTopupRevenue        = transactions.filter(t => t.transactionType === 'topup_quota').reduce((sum, t) => sum + t.amount, 0);
  const totalRenewalRevenue      = transactions.filter(t => t.transactionType === 'renew_monthly').reduce((sum, t) => sum + t.amount, 0);
  const totalConversionRevenue   = transactions.filter(t => t.transactionType === 'change_type').reduce((sum, t) => sum + t.amount, 0);
  const grandTotalRevenue        = totalRegistrationRevenue + totalTopupRevenue + totalRenewalRevenue + totalConversionRevenue;

  return (
    <div className="space-y-6">

      {/* ── Header */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Award className="h-5 w-5 text-amber-400" />
          {initialMode === 'conversion' ? 'Konversi Jenis Keanggotaan Member' : 'Operasional Operator Member'}
        </h2>
        {initialMode !== 'conversion' && (
          <div className="flex gap-2">
            <button
              onClick={() => { closeForm(); setShowForm(true); }}
              className="bg-emerald-500 hover:bg-emerald-600 text-zinc-950 px-4 py-2 rounded-lg font-bold transition text-sm flex items-center gap-1.5 shadow-md shadow-emerald-500/10">
              <Plus className="h-4 w-4 stroke-[3]" />
              Daftarkan Member
            </button>
          </div>
        )}
      </div>

      {/* ── Sub Navigation Tabs */}
      {initialMode !== 'conversion' && (
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveSubTab('list')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 ${
              activeSubTab === 'list'
                ? 'border-emerald-500 text-emerald-400 font-extrabold'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}>
            📋 Daftar & Kelola Member
          </button>
          <button
            onClick={() => { setActiveSubTab('rekap'); fetchTransactions(); }}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 ${
              activeSubTab === 'rekap'
                ? 'border-emerald-500 text-emerald-400 font-extrabold'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}>
            📊 Rekap Transaksi Harian
          </button>
        </div>
      )}

      {activeSubTab === 'list' ? (
        <>
          {/* ── Stats */}
          {initialMode !== 'conversion' && (
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Total Aktif', value: activeCount,  icon: '✅', color: 'emerald' },
                { label: 'Bulanan',     value: monthlyCount, icon: '📅', color: 'sky' },
                { label: 'Kuota',       value: quotaCount,   icon: '🎫', color: 'violet' },
              ].map(s => (
                <div key={s.label} className="glass rounded-xl p-4 flex items-center gap-3">
                  <span className="text-2xl">{s.icon}</span>
                  <div>
                    <div className="text-2xl font-black text-white">{s.value}</div>
                    <div className="text-[10px] text-zinc-500">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Add / Edit Form */}
          {showForm && (
            <div className="glass rounded-xl p-6 space-y-5 animate-fadeIn border border-emerald-500/20">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white flex items-center gap-2">
                  {editingId ? <Edit2 className="h-4 w-4 text-amber-400" /> : <Plus className="h-4 w-4 text-emerald-400" />}
                  {editingId ? 'Edit / Konversi Tipe Member' : 'Pendaftaran Member Baru'}
                </h3>
                <button type="button" onClick={closeForm} className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg flex items-center gap-2">
                  ⚠️ {formError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* ── Jenis Member selector (Unlocked for conversions) */}
                <div>
                  <label className="text-xs text-zinc-400 font-semibold mb-2 block uppercase tracking-wider">Jenis Keanggotaan</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'monthly', emoji: '📅', title: 'Member Bulanan', desc: 'Akses tak terbatas selama masa berlaku' },
                      { key: 'quota',   emoji: '🎫', title: 'Member Kuota',   desc: 'Akses berdasarkan jumlah masuk yang dibeli' },
                    ].map(t => {
                      const isSelected = form.memberType === t.key;
                      const initialType = members.find(m => m.id === editingId)?.memberType || 'monthly';
                      const isChangingType = editingId && initialType !== t.key;

                      return (
                        <button key={t.key} type="button"
                          onClick={() => setField('memberType', t.key)}
                          className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'bg-emerald-500/15 border-emerald-500/40 shadow-lg'
                              : 'bg-zinc-900/50 border-white/5 hover:border-white/15'
                          }`}>
                          <span className="text-2xl mt-0.5">{t.emoji}</span>
                          <div>
                            <div className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-zinc-400'}`}>{t.title}</div>
                            <div className="text-[10px] text-zinc-500 mt-0.5">{t.desc}</div>
                            {isSelected && !isChangingType && <span className="mt-1 inline-block text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold">✓ AKTIF</span>}
                            {isSelected && isChangingType && <span className="mt-1 inline-block text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full font-bold">🔄 AKAN DIKONVERSI</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── Identitas */}
                <div className="space-y-3">
                  <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Data Identitas (Wajib)</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Nama */}
                    <div className="space-y-1">
                      <label className="text-xs text-zinc-400 font-medium">Nama Lengkap *</label>
                      <input type="text" required value={form.name}
                        onChange={e => setField('name', e.target.value)}
                        placeholder="Sesuai KTP"
                        className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
                    </div>

                    {/* RFID */}
                    <div className="space-y-1">
                      <label className="text-xs text-zinc-400 font-medium flex items-center gap-1"><CreditCard className="h-3 w-3" /> No. Kartu RFID *</label>
                      <input type="text" required value={form.rfidCardNumber}
                        onChange={e => setField('rfidCardNumber', e.target.value.toUpperCase())}
                        placeholder="RFID-XXXXX"
                        className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500" />
                    </div>

                    {/* KTP */}
                    <div className="space-y-1">
                      <label className="text-xs text-zinc-400 font-medium flex items-center gap-1"><Hash className="h-3 w-3" /> NIK KTP *</label>
                      <input type="text" required value={form.identityCard}
                        onChange={e => setField('identityCard', e.target.value)}
                        placeholder="16 digit NIK"
                        maxLength={16}
                        className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500" />
                    </div>

                    {/* Phone */}
                    <div className="space-y-1">
                      <label className="text-xs text-zinc-400 font-medium flex items-center gap-1"><Phone className="h-3 w-3" /> Nomor Telepon *</label>
                      <input type="tel" required value={form.phoneNumber}
                        onChange={e => setField('phoneNumber', e.target.value)}
                        placeholder="08xx-xxxx-xxxx"
                        className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
                    </div>

                    {/* Email */}
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-xs text-zinc-400 font-medium flex items-center gap-1"><Mail className="h-3 w-3" /> Email *</label>
                      <input type="email" required value={form.email}
                        onChange={e => setField('email', e.target.value)}
                        placeholder="email@contoh.com"
                        className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
                    </div>
                  </div>
                </div>

                {/* ── Masa berlaku / Kuota */}
                <div className="space-y-3 border-t border-white/5 pt-4">
                  {form.memberType === 'monthly' ? (
                    <div>
                      <label className="text-xs text-zinc-400 font-semibold mb-2 block uppercase tracking-wider flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Masa Berlaku
                      </label>
                      <div className="flex gap-2 mb-2 flex-wrap">
                        {[['1 Bln', 1], ['3 Bln', 3], ['6 Bln', 6], ['1 Thn', 12]].map(([label, m]) => (
                          <button key={label as string} type="button"
                            onClick={() => setField('expiryDate', addMonths(m as number))}
                            className="text-xs px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition font-semibold">
                            +{label}
                          </button>
                        ))}
                      </div>
                      <input type="date" required value={form.expiryDate}
                        onChange={e => setField('expiryDate', e.target.value)}
                        className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500" />
                    </div>
                  ) : (
                    !editingId ? (
                      <div>
                        <label className="text-xs text-zinc-400 font-semibold mb-2 block uppercase tracking-wider">
                          🎫 Jumlah Kuota Masuk
                        </label>
                        <div className="flex gap-2 mb-2 flex-wrap">
                          {[10, 20, 30, 50, 100].map(q => (
                            <button key={q} type="button"
                              onClick={() => setField('quotaTotal', q)}
                              className={`text-xs px-3 py-1 rounded-lg transition font-bold border ${
                                form.quotaTotal === q
                                  ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                                  : 'bg-zinc-800 border-white/5 hover:bg-zinc-700 text-zinc-400'
                              }`}>
                              {q}x
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => setField('quotaTotal', Math.max(1, form.quotaTotal - 1))}
                            className="w-9 h-9 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-bold">−</button>
                          <input type="number" min="1" required value={form.quotaTotal}
                            onChange={e => setField('quotaTotal', Number(e.target.value))}
                            className="w-20 bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono text-center focus:outline-none focus:border-violet-500" />
                          <button type="button" onClick={() => setField('quotaTotal', form.quotaTotal + 1)}
                            className="w-9 h-9 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-bold">+</button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-violet-500/5 border border-violet-500/10 rounded-lg p-3 text-xs text-zinc-400">
                        ℹ️ Saldo kuota saat ini: <span className="text-white font-bold">{form.quotaTotal - form.quotaUsed}x masuk</span>. Saldo hanya dapat ditambah melalui menu <strong>Top-up</strong> di tabel.
                      </div>
                    )
                  )}
                </div>

                {!editingId && (
                  <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-white uppercase tracking-wider">
                          Biaya Registrasi Pendaftaran
                        </p>
                        <p className="text-[10px] text-zinc-500">Sesuai tarif yang berlaku.</p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-emerald-400 font-mono">
                          Rp {(tariffConfig.memberRegistrationFee || 35000).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-white/5 pt-3">
                      <div>
                        <p className="text-xs font-bold text-white uppercase tracking-wider">
                          Uang Dibayarkan
                        </p>
                        <p className="text-[10px] text-zinc-500">Uang tunai diterima dari member.</p>
                      </div>
                      <div className="relative max-w-[160px]">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-mono">Rp</span>
                        <input type="text"
                          value={regCashReceived.toLocaleString('id-ID')}
                          onChange={e => {
                            const val = e.target.value.replace(/\D/g, '');
                            setRegCashReceived(val ? parseInt(val, 10) : 0);
                          }}
                          className="w-full bg-zinc-950 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white font-mono text-right focus:outline-none focus:border-emerald-500" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-white/5 pt-3">
                      <div>
                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                          Kembalian
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-bold font-mono ${
                          regCashReceived >= (tariffConfig.memberRegistrationFee || 35000) ? 'text-emerald-400' : 'text-zinc-500'
                        }`}>
                          Rp {Math.max(0, regCashReceived - (tariffConfig.memberRegistrationFee || 35000)).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Status */}
                <div className="grid grid-cols-2 gap-3 items-end">
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-400 font-medium">Status</label>
                    <select value={form.status} onChange={e => setField('status', e.target.value)}
                      className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none">
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                      <option value="expired">Expired</option>
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <button type="submit" disabled={saving}
                      className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-zinc-950 font-bold rounded-lg transition text-sm flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10">
                      {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      {editingId ? 'Simpan & Cetak' : 'Daftarkan & Cetak'}
                    </button>
                    <button type="button" onClick={closeForm}
                      className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg transition">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* ── Filters + Search */}
          <div className="glass rounded-xl overflow-hidden">
            <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row gap-3 items-center bg-zinc-950/20">
              <div className="relative flex-1">
                <Search className="h-4 w-4 text-zinc-500 absolute left-3 top-2.5" />
                <input type="text" placeholder="Cari nama, RFID, telepon, email..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-zinc-700" />
              </div>
              <div className="flex gap-1">
                {(['all', 'monthly', 'quota'] as const).map(t => (
                  <button key={t} onClick={() => setFilterType(t)}
                    className={`text-xs px-3 py-1.5 rounded-lg transition font-semibold ${
                      filterType === t ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/5' : 'bg-zinc-800 text-zinc-400 hover:text-white'
                    }`}>
                    {t === 'all' ? 'Semua' : t === 'monthly' ? '📅 Bulanan' : '🎫 Kuota'}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950/40 text-zinc-400 border-b border-white/5 uppercase tracking-wider font-bold">
                  <tr>
                    <th className="p-3">Nama / Identitas</th>
                    <th className="p-3">RFID</th>
                    <th className="p-3">Jenis</th>
                    <th className="p-3">Masa Aktif / Kuota</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-zinc-300">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-zinc-500">
                        Tidak ada data member yang ditemukan.
                      </td>
                    </tr>
                  ) : (
                    filtered.map(m => {
                      const daysLeft = getExpiryInDays(m.expiryDate);
                      const isMonthly = m.memberType !== 'quota';
                      const quotaLeft = (m.quotaTotal || 0) - (m.quotaUsed || 0);
                      const quotaPct  = m.quotaTotal > 0 ? (quotaLeft / m.quotaTotal) * 100 : 0;
                      const isExpanded = expandedId === m.id;

                      return (
                        <React.Fragment key={m.id}>
                          <tr className={`hover:bg-white/[0.02] transition cursor-pointer ${isExpanded ? 'bg-white/[0.03]' : ''}`}
                            onClick={() => setExpandedId(isExpanded ? null : m.id)}>
                            {/* Nama */}
                            <td className="p-3">
                              <div className="font-semibold text-white">{m.name}</div>
                              <div className="text-zinc-500 font-mono text-[10px] mt-0.5">{m.identityCard || '—'}</div>
                            </td>
                            {/* RFID */}
                            <td className="p-3 font-mono text-zinc-400">{m.rfidCardNumber}</td>
                            {/* Jenis */}
                            <td className="p-3">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                isMonthly ? 'bg-sky-500/15 text-sky-300' : 'bg-violet-500/15 text-violet-300'
                              }`}>
                                {isMonthly ? '📅 Bulanan' : '🎫 Kuota'}
                              </span>
                            </td>
                            {/* Masa aktif / Kuota */}
                            <td className="p-3">
                              {isMonthly ? (
                                m.expiryDate ? (
                                  <div>
                                    <div className="font-semibold">{new Date(m.expiryDate).toLocaleDateString('id-ID')}</div>
                                    <div className={`text-[10px] mt-0.5 ${daysLeft < 0 ? 'text-rose-400' : daysLeft < 7 ? 'text-amber-400' : 'text-zinc-500'}`}>
                                      {daysLeft < 0 ? 'Sudah kadaluwarsa' : `${daysLeft} hari lagi`}
                                    </div>
                                  </div>
                                ) : <span className="text-zinc-500">—</span>
                              ) : (
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className={`font-bold ${quotaLeft <= 0 ? 'text-rose-400' : quotaLeft <= 3 ? 'text-amber-400' : 'text-white'}`}>
                                      {quotaLeft}
                                    </span>
                                    <span className="text-zinc-500">/ {m.quotaTotal} sisa</span>
                                  </div>
                                  <div className="w-24 h-1.5 bg-zinc-800 rounded-full mt-1">
                                    <div className="h-1.5 rounded-full transition-all"
                                      style={{
                                        width: `${Math.max(0, quotaPct)}%`,
                                        background: quotaPct > 50 ? '#10b981' : quotaPct > 20 ? '#f59e0b' : '#f43f5e',
                                      }} />
                                  </div>
                                </div>
                              )}
                            </td>
                            {/* Status */}
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_STYLES[m.status] || ''}`}>
                                {m.status.toUpperCase()}
                              </span>
                            </td>
                            {/* Aksi */}
                            <td className="p-3">
                              <div className="flex justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                                {initialMode === 'conversion' ? (
                                  <button type="button" title="Konversi Jenis Keanggotaan"
                                    onClick={() => conversionId === m.id ? closeActions() : openConversion(m.id)}
                                    className={`p-1.5 rounded transition ${
                                      conversionId === m.id ? 'bg-amber-500/20 text-amber-400' : 'hover:bg-zinc-800 text-zinc-400 hover:text-amber-400'
                                    }`}>
                                    <RefreshCw className="h-3.5 w-3.5" />
                                  </button>
                                ) : (
                                  <>
                                    {isMonthly && (
                                      <button type="button" title="Perpanjang Masa Berlaku"
                                        onClick={() => renewId === m.id ? closeActions() : openRenew(m.id)}
                                        className={`p-1.5 rounded transition ${
                                          renewId === m.id ? 'bg-sky-500/20 text-sky-400' : 'hover:bg-zinc-800 text-zinc-400 hover:text-sky-400'
                                        }`}>
                                        <CalendarPlus className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                    {!isMonthly && (
                                      <button type="button" title="Top-up Kuota"
                                        onClick={() => topupId === m.id ? closeActions() : openTopup(m.id)}
                                        className={`p-1.5 rounded transition ${
                                          topupId === m.id ? 'bg-violet-500/20 text-violet-400' : 'hover:bg-zinc-800 text-zinc-400 hover:text-violet-400'
                                        }`}>
                                        <ChevronUp className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                    <button type="button" title="Edit / Konversi"
                                      onClick={() => startEdit(m)}
                                      className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded transition">
                                      <Edit2 className="h-3.5 w-3.5" />
                                    </button>
                                    <button type="button" title="Hapus"
                                      onClick={() => handleDelete(m.id)}
                                      className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 rounded transition">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* ── Panel Perpanjang Bulanan */}
                          {renewId === m.id && isMonthly && (
                            <tr className="bg-sky-500/5 border-t border-sky-500/20">
                              <td colSpan={6} className="px-5 py-4">
                                <div className="space-y-4">
                                  <div className="flex items-center gap-2">
                                    <CalendarPlus className="h-4 w-4 text-sky-400" />
                                    <span className="text-sm font-bold text-white">Perpanjang Masa Berlaku — {m.name}</span>
                                  </div>

                                  {renewMessage && (
                                    <div className="text-xs px-3 py-2 bg-rose-500/10 text-rose-400 rounded-lg font-semibold">
                                      {renewMessage}
                                    </div>
                                  )}

                                  <div className="flex flex-wrap gap-4 items-center">
                                    <div className="flex flex-wrap gap-1.5 items-center">
                                      <span className="text-xs text-zinc-500 mr-1">Tambah:</span>
                                      {(tariffConfig.memberMonthlyPackages || []).map((pkg: any) => (
                                        <button key={pkg.months} type="button"
                                          onClick={() => { setRenewMonths(pkg.months); setRenewFee(pkg.price); }}
                                          className={`text-xs px-3 py-1.5 rounded-lg font-bold border transition ${
                                            renewMonths === pkg.months
                                              ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                                              : 'bg-zinc-800 border-white/5 hover:border-sky-500/30 text-zinc-400'
                                          }`}>
                                          +{pkg.label}
                                        </button>
                                      ))}
                                      <input type="number" min="1" value={renewMonths}
                                        onChange={e => {
                                          const val = Number(e.target.value);
                                          setRenewMonths(val);
                                          setRenewFee(getRenewFeeForMonths(val, tariffConfig.memberMonthlyPackages));
                                        }}
                                        className="w-12 bg-zinc-950 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono text-center ml-2 focus:outline-none focus:border-sky-500" />
                                      <span className="text-xs text-zinc-500">bulan</span>
                                    </div>

                                    {/* Fee display (readOnly) */}
                                    <div className="flex items-center gap-2 bg-zinc-950/60 px-3 py-1.5 rounded-lg border border-white/5 font-semibold text-xs">
                                      <span className="text-zinc-500">Biaya:</span>
                                      <span className="text-sky-400 font-mono">
                                        Rp {renewFee.toLocaleString('id-ID')}
                                      </span>
                                    </div>

                                    {/* Cash received input */}
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-zinc-500">Uang Dibayar:</span>
                                      <div className="relative max-w-[130px]">
                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 font-mono">Rp</span>
                                        <input type="text"
                                          value={renewCashReceived.toLocaleString('id-ID')}
                                          onChange={e => {
                                            const val = e.target.value.replace(/\D/g, '');
                                            setRenewCashReceived(val ? parseInt(val, 10) : 0);
                                          }}
                                          className="w-full bg-zinc-950 border border-white/10 rounded-lg pl-7 pr-2 py-1 text-xs text-white font-mono text-right focus:outline-none focus:border-sky-500" />
                                      </div>
                                    </div>

                                    {/* Change display */}
                                    <div className="flex items-center gap-2 bg-zinc-950/60 px-3 py-1.5 rounded-lg border border-white/5 font-semibold text-xs">
                                      <span className="text-zinc-500">Kembalian:</span>
                                      <span className={`font-mono ${
                                        renewCashReceived >= renewFee ? 'text-emerald-400' : 'text-zinc-500'
                                      }`}>
                                        Rp {Math.max(0, renewCashReceived - renewFee).toLocaleString('id-ID')}
                                      </span>
                                    </div>
                                  </div>

                                  {m.expiryDate && (() => {
                                    const baseDate = new Date(m.expiryDate) > new Date() ? new Date(m.expiryDate) : new Date();
                                    baseDate.setMonth(baseDate.getMonth() + renewMonths);
                                    return (
                                      <div className="bg-zinc-950/60 rounded-lg p-3 text-xs flex flex-wrap gap-4">
                                        <div><div className="text-zinc-500 mb-0.5">Expired saat ini</div><div className="font-semibold text-zinc-300">{new Date(m.expiryDate).toLocaleDateString('id-ID')}</div></div>
                                        <div className="text-zinc-600">→</div>
                                        <div><div className="text-zinc-500 mb-0.5">Masa berlaku baru</div><div className="font-bold text-sky-300">{baseDate.toLocaleDateString('id-ID')}</div></div>
                                      </div>
                                    );
                                  })()}

                                  <div className="flex gap-2">
                                    <button onClick={() => handleRenewSubmit(m.id)}
                                      className="px-4 py-1.5 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-lg text-xs transition flex items-center gap-1.5">
                                      <CalendarPlus className="h-3.5 w-3.5" />
                                      Perpanjang & Cetak
                                    </button>
                                    <button onClick={closeActions}
                                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg text-xs transition">
                                      Batal
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}

                          {/* ── Panel Top-up Kuota */}
                          {topupId === m.id && !isMonthly && (
                            <tr className="bg-violet-500/5 border-t border-violet-500/20">
                              <td colSpan={6} className="px-5 py-4">
                                <div className="space-y-4">
                                  <div className="flex items-center gap-2">
                                    <ChevronUp className="h-4 w-4 text-violet-400" />
                                    <span className="text-sm font-bold text-white">Top-up Kuota — {m.name}</span>
                                  </div>

                                  <div className="flex flex-wrap gap-4 items-center">
                                    <div className="flex flex-wrap gap-1.5 items-center">
                                      <span className="text-xs text-zinc-500 mr-1">Tambah:</span>
                                      {(tariffConfig.memberTopupPackages || []).map((pkg: any) => (
                                        <button key={pkg.quota} type="button"
                                          onClick={() => { setTopupAmount(pkg.quota); setTopupFee(pkg.price); }}
                                          className={`text-xs px-3 py-1.5 rounded-lg font-bold border transition ${
                                            topupAmount === pkg.quota
                                              ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                                              : 'bg-zinc-800 border-white/5 hover:border-violet-500/30 text-zinc-400'
                                          }`}>
                                          +{pkg.quota}x
                                        </button>
                                      ))}
                                      <input type="number" min="1" value={topupAmount}
                                        onChange={e => {
                                          const val = Number(e.target.value);
                                          setTopupAmount(val);
                                          setTopupFee(getTopupFeeForQuota(val, tariffConfig.memberTopupPackages));
                                        }}
                                        className="w-12 bg-zinc-950 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono text-center ml-2 focus:outline-none focus:border-violet-500" />
                                      <span className="text-xs text-zinc-500">masuk</span>
                                    </div>

                                    {/* Fee display (readOnly) */}
                                    <div className="flex items-center gap-2 bg-zinc-950/60 px-3 py-1.5 rounded-lg border border-white/5 font-semibold text-xs">
                                      <span className="text-zinc-500">Biaya:</span>
                                      <span className="text-violet-400 font-mono">
                                        Rp {topupFee.toLocaleString('id-ID')}
                                      </span>
                                    </div>

                                    {/* Cash received input */}
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-zinc-500">Uang Dibayar:</span>
                                      <div className="relative max-w-[130px]">
                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 font-mono">Rp</span>
                                        <input type="text"
                                          value={topupCashReceived.toLocaleString('id-ID')}
                                          onChange={e => {
                                            const val = e.target.value.replace(/\D/g, '');
                                            setTopupCashReceived(val ? parseInt(val, 10) : 0);
                                          }}
                                          className="w-full bg-zinc-950 border border-white/10 rounded-lg pl-7 pr-2 py-1 text-xs text-white font-mono text-right focus:outline-none focus:border-violet-500" />
                                      </div>
                                    </div>

                                    {/* Change display */}
                                    <div className="flex items-center gap-2 bg-zinc-950/60 px-3 py-1.5 rounded-lg border border-white/5 font-semibold text-xs">
                                      <span className="text-zinc-500">Kembalian:</span>
                                      <span className={`font-mono ${
                                        topupCashReceived >= topupFee ? 'text-emerald-400' : 'text-zinc-500'
                                      }`}>
                                        Rp {Math.max(0, topupCashReceived - topupFee).toLocaleString('id-ID')}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="bg-zinc-950/60 rounded-lg p-3 text-xs flex gap-6">
                                    <div><div className="text-zinc-500 mb-0.5">Saat ini</div><div className="font-bold text-white">{(m.quotaTotal||0)-(m.quotaUsed||0)}x sisa</div></div>
                                    <div className="text-zinc-600">+</div>
                                    <div><div className="text-zinc-500 mb-0.5">Ditambah</div><div className="font-bold text-violet-300">{topupAmount}x</div></div>
                                    <div className="text-zinc-600">=</div>
                                    <div><div className="text-zinc-500 mb-0.5">Setelah top-up</div><div className="font-bold text-emerald-400">{(m.quotaTotal||0)-(m.quotaUsed||0)+topupAmount}x sisa</div></div>
                                  </div>

                                  <div className="flex gap-2">
                                    <button onClick={() => handleTopupSubmit(m.id)}
                                      className="px-4 py-1.5 bg-violet-500 hover:bg-violet-600 text-white font-bold rounded-lg text-xs transition flex items-center gap-1.5">
                                      <ChevronUp className="h-3.5 w-3.5" />
                                      Top-up & Cetak
                                    </button>
                                    <button onClick={closeActions}
                                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg text-xs transition">
                                      Batal
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}

                          {/* ── Panel Konversi Jenis Keanggotaan */}
                          {conversionId === m.id && (
                            <tr className="bg-amber-500/5 border-t border-amber-500/20">
                              <td colSpan={6} className="px-5 py-4">
                                <div className="space-y-4">
                                  <div className="flex items-center gap-2">
                                    <RefreshCw className="h-4 w-4 text-amber-400" />
                                    <span className="text-sm font-bold text-white">Konversi Jenis Keanggotaan — {m.name}</span>
                                  </div>

                                  {convMessage && (
                                    <div className="text-xs px-3 py-2 bg-rose-500/10 text-rose-400 rounded-lg font-semibold">
                                      {convMessage}
                                    </div>
                                  )}

                                  <div className="bg-zinc-950/60 rounded-lg p-3 text-xs space-y-1.5 max-w-xl">
                                    <div className="flex justify-between"><span className="text-zinc-500">Mode Saat Ini:</span> <span className="font-bold text-white">{isMonthly ? '📅 Bulanan' : '🎫 Kuota'}</span></div>
                                    <div className="flex justify-between"><span className="text-zinc-500">Mode Baru Setelah Konversi:</span> <span className="font-bold text-emerald-400">{isMonthly ? '🎫 Kuota' : '📅 Bulanan'}</span></div>
                                  </div>

                                  <div className="flex flex-wrap gap-4 items-center">
                                    {isMonthly ? (
                                      /* Converting Monthly -> Quota: Choose Quota */
                                      <div className="flex flex-wrap gap-1.5 items-center">
                                        <span className="text-xs text-zinc-500 mr-1">Kuota Awal:</span>
                                        {[10, 20, 50, 100].map(q => (
                                          <button key={q} type="button"
                                            onClick={() => setConvQuota(q)}
                                            className={`text-xs px-3 py-1.5 rounded-lg font-bold border transition ${
                                              convQuota === q
                                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                                                : 'bg-zinc-800 border-white/5 hover:border-amber-500/30 text-zinc-400'
                                            }`}>
                                            {q}x
                                          </button>
                                        ))}
                                        <input type="number" min="1" value={convQuota}
                                          onChange={e => setConvQuota(Number(e.target.value))}
                                          className="w-12 bg-zinc-950 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono text-center ml-2" />
                                        <span className="text-xs text-zinc-500">masuk</span>
                                      </div>
                                    ) : (
                                      /* Converting Quota -> Monthly: Choose Expiry */
                                      <div className="flex flex-wrap gap-1.5 items-center font-medium">
                                        <span className="text-xs text-zinc-500 mr-1">Masa Berlaku Baru:</span>
                                        {[['1 Bln', 1], ['3 Bln', 3], ['6 Bln', 6]].map(([label, mo]) => (
                                          <button key={label as string} type="button"
                                            onClick={() => setConvExpiry(addMonths(mo as number))}
                                            className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition font-semibold animate-fadeIn">
                                            +{label}
                                          </button>
                                        ))}
                                        <input type="date" required value={convExpiry}
                                          onChange={e => setConvExpiry(e.target.value)}
                                          className="bg-zinc-950 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono text-center ml-2 focus:outline-none focus:border-amber-500" />
                                      </div>
                                    )}

                                    {/* Fee display (readOnly) */}
                                    <div className="flex items-center gap-2 bg-zinc-950/60 px-3 py-1.5 rounded-lg border border-white/5 font-semibold text-xs">
                                      <span className="text-zinc-500">Biaya Admin:</span>
                                      <span className="text-amber-400 font-mono">
                                        Rp {convFeeAmount.toLocaleString('id-ID')}
                                      </span>
                                    </div>

                                    {/* Cash received input */}
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-zinc-500">Uang Dibayar:</span>
                                      <div className="relative max-w-[130px]">
                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 font-mono">Rp</span>
                                        <input type="text"
                                          value={convCashReceived.toLocaleString('id-ID')}
                                          onChange={e => {
                                            const val = e.target.value.replace(/\D/g, '');
                                            setConvCashReceived(val ? parseInt(val, 10) : 0);
                                          }}
                                          className="w-full bg-zinc-950 border border-white/10 rounded-lg pl-7 pr-2 py-1 text-xs text-white font-mono text-right focus:outline-none focus:border-amber-500" />
                                      </div>
                                    </div>

                                    {/* Change display */}
                                    <div className="flex items-center gap-2 bg-zinc-950/60 px-3 py-1.5 rounded-lg border border-white/5 font-semibold text-xs">
                                      <span className="text-zinc-500">Kembalian:</span>
                                      <span className={`font-mono ${
                                        convCashReceived >= convFeeAmount ? 'text-emerald-400' : 'text-zinc-500'
                                      }`}>
                                        Rp {Math.max(0, convCashReceived - convFeeAmount).toLocaleString('id-ID')}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex gap-2">
                                    <button onClick={() => handleConversionSubmit(m.id, isMonthly ? 'quota' : 'monthly')}
                                      className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold rounded-lg text-xs transition flex items-center gap-1.5">
                                      <RefreshCw className="h-3.5 w-3.5" />
                                      Konversi Sekarang & Cetak
                                    </button>
                                    <button onClick={closeActions}
                                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg text-xs transition">
                                      Batal
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}

                          {/* Expanded detail row */}
                          {isExpanded && !topupId && !renewId && !conversionId && (
                            <tr className="bg-zinc-950/40 animate-fadeIn">
                              <td colSpan={6} className="px-4 py-3">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                  <div>
                                    <div className="text-zinc-500 mb-0.5 flex items-center gap-1"><Phone className="h-3 w-3" /> Telepon</div>
                                    <div className="text-white font-semibold">{m.phoneNumber || '—'}</div>
                                  </div>
                                  <div>
                                    <div className="text-zinc-500 mb-0.5 flex items-center gap-1"><Mail className="h-3 w-3" /> Email</div>
                                    <div className="text-white font-semibold">{m.email || '—'}</div>
                                  </div>
                                  <div>
                                    <div className="text-zinc-500 mb-0.5 flex items-center gap-1"><Hash className="h-3 w-3" /> NIK KTP</div>
                                    <div className="text-white font-mono font-semibold">{m.identityCard || '—'}</div>
                                  </div>
                                  <div>
                                    <div className="text-zinc-500 mb-0.5">Terdaftar</div>
                                    <div className="text-white font-semibold">
                                      {m.createdAt ? new Date(m.createdAt).toLocaleDateString('id-ID') : '—'}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* 📊 daily transaction rekap tab */
        <div className="space-y-6 animate-fadeIn">
          {/* Stats today summary */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {[
              { label: 'Registrasi Member', val: totalRegistrationRevenue, count: transactions.filter(t => t.transactionType === 'registration').length, emoji: '➕', color: 'text-emerald-400' },
              { label: 'Top-up Kuota', val: totalTopupRevenue, count: transactions.filter(t => t.transactionType === 'topup_quota').length, emoji: '🎫', color: 'text-violet-400' },
              { label: 'Perpanjang Bulanan', val: totalRenewalRevenue, count: transactions.filter(t => t.transactionType === 'renew_monthly').length, emoji: '📅', color: 'text-sky-400' },
              { label: 'Konversi Tipe', val: totalConversionRevenue, count: transactions.filter(t => t.transactionType === 'change_type').length, emoji: '🔄', color: 'text-amber-400' },
              { label: 'Grand Total Revenue', val: grandTotalRevenue, count: transactions.length, emoji: '💰', color: 'text-white' },
            ].map((st, i) => (
              <div key={st.label} className={`glass rounded-xl p-4 border border-white/5 ${i === 4 ? 'bg-gradient-to-b from-emerald-500/10 to-emerald-600/5 border-emerald-500/20' : ''}`}>
                <div className="flex justify-between items-start">
                  <span className="text-xl">{st.emoji}</span>
                  <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full font-bold">
                    {st.count}x
                  </span>
                </div>
                <div className="text-[10px] text-zinc-500 mt-2 font-semibold uppercase tracking-wider">{st.label}</div>
                <div className={`text-md font-black mt-0.5 ${st.color}`}>
                  Rp {st.val.toLocaleString('id-ID')}
                </div>
              </div>
            ))}
          </div>

          {/* List of transactions for today */}
          <div className="glass rounded-xl overflow-hidden border border-white/5">
            <div className="p-4 border-b border-white/5 bg-zinc-950/20 flex justify-between items-center">
              <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-emerald-400" />
                Daftar Transaksi Operator Hari Ini ({transactions.length})
              </h4>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportPDF}
                  className="bg-emerald-500 hover:bg-emerald-600 text-zinc-950 px-3 py-1.5 rounded-lg font-extrabold text-[10px] uppercase transition flex items-center gap-1.5 shadow-md shadow-emerald-500/10"
                >
                  <Printer className="h-3 w-3 stroke-[2.5]" />
                  Cetak & Unduh PDF
                </button>
                <button onClick={fetchTransactions} className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition">
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950/40 text-zinc-400 border-b border-white/5 uppercase tracking-wider font-bold">
                  <tr>
                    <th className="p-3">Waktu</th>
                    <th className="p-3">Nama Member / RFID</th>
                    <th className="p-3">Tipe Transaksi</th>
                    <th className="p-3">Keterangan</th>
                    <th className="p-3 text-right">Biaya / Tarik</th>
                    <th className="p-3">Operator</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-zinc-300">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-10 text-center text-zinc-500">
                        Belum ada aktivitas pendaftaran atau top-up member hari ini.
                      </td>
                    </tr>
                  ) : (
                    transactions.map(t => (
                      <tr key={t.id} className="hover:bg-white/[0.02] transition">
                        <td className="p-3 font-mono text-zinc-500">
                          {new Date(t.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-white">{t.memberName}</div>
                          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{t.rfidCardNumber}</div>
                        </td>
                        <td className="p-3">
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            t.transactionType === 'registration' ? 'bg-emerald-500/15 text-emerald-400'
                              : t.transactionType === 'topup_quota' ? 'bg-violet-500/15 text-violet-300'
                              : t.transactionType === 'renew_monthly' ? 'bg-sky-500/15 text-sky-300'
                              : 'bg-amber-500/15 text-amber-400'
                          }`}>
                            {t.transactionType === 'registration' ? 'Registrasi'
                              : t.transactionType === 'topup_quota' ? 'Top-up Kuota'
                              : t.transactionType === 'renew_monthly' ? 'Perpanjang'
                              : 'Konversi Tipe'}
                          </span>
                        </td>
                        <td className="p-3 text-zinc-400 font-medium">{t.details}</td>
                        <td className="p-3 text-right font-mono font-bold text-white">
                          Rp {t.amount.toLocaleString('id-ID')}
                        </td>
                        <td className="p-3 font-medium text-zinc-400">{t.operatorUsername}</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleReprintReceipt(t)}
                            className="p-1 hover:bg-zinc-800 text-zinc-500 hover:text-white rounded transition inline-flex items-center gap-1 text-[10px]"
                            title="Cetak Ulang Struk">
                            <Printer className="h-3 w-3" /> Cetak Ulang
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Virtual Monospace Monospace Thermal Receipt Modal */}
      {virtualReceipt && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 animate-fadeIn" onClick={() => setVirtualReceipt(null)}>
          <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col scale-in" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-white/5 flex justify-between items-center bg-zinc-950/40">
              <span className="font-extrabold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                <Printer className="h-4 w-4 text-emerald-400" />
                Struk Thermal Operator
              </span>
              <button type="button" onClick={() => setVirtualReceipt(null)} className="p-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Virtual Monospace Receipt Layout */}
            <div className="p-6 bg-white text-zinc-950 overflow-y-auto flex-1 font-mono text-xs flex flex-col items-center">
              <div className="w-full max-w-[260px] whitespace-pre select-all text-center leading-tight">
                {virtualReceipt.map((line, idx) => (
                  <div key={idx} className="text-left w-full truncate">{line}</div>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-zinc-950 border-t border-white/5 flex gap-2">
              <button onClick={() => printReceiptDirectly(virtualReceipt)}
                className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold rounded-lg text-xs transition flex items-center justify-center gap-1.5">
                <Printer className="h-4 w-4" />
                Cetak Struk (Thermal)
              </button>
              <button onClick={() => setVirtualReceipt(null)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg text-xs transition font-semibold">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
