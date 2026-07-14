import React, { useState, useEffect, useRef } from 'react';
import { Ticket, Smartphone, CreditCard, Award, RefreshCw, AlertCircle, Printer, Search, FileText, X } from 'lucide-react';

interface Gate {
  id: string;
  name: string;
  type: string;
  ipAddress: string;
  status: string;
}

interface Member {
  id: string;
  name: string;
  rfidCardNumber: string;
  status: string;
}

interface ActiveCar {
  id: string;
  ticketCode: string;
  plateNumber: string;
  entryTime: string;
  vehicleType?: string;
}

const printShiftReceiptDirectly = (shiftData: any) => {
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

  const { shift, cashRevenue, nonCashRevenue, expectedCash, transactions } = shiftData;

  const openDateStr = new Date(shift.openTime).toLocaleString('id-ID');
  const closeDateStr = shift.closeTime ? new Date(shift.closeTime).toLocaleString('id-ID') : '-';

  const lines = [
    '      STRUK BUKTI SETORAN      ',
    '        TUTUP SHIFT KASIR      ',
    '===============================',
    `Kasir     : ${shift.operatorUsername}`,
    `Buka Shift: ${openDateStr}`,
    `Tutup     : ${closeDateStr}`,
    '-------------------------------',
    `Modal Awal: Rp ${shift.startingFloat.toLocaleString('id-ID')}`,
    `Tunai Msk : Rp ${cashRevenue.toLocaleString('id-ID')}`,
    `Non-Tunai : Rp ${nonCashRevenue.toLocaleString('id-ID')}`,
    '-------------------------------',
    `Expected  : Rp ${expectedCash.toLocaleString('id-ID')}`,
    `Setoran   : Rp ${shift.depositAmount.toLocaleString('id-ID')}`,
    `Selisih   : Rp ${shift.discrepancy.toLocaleString('id-ID')}`,
    '===============================',
    'Status    : SHIFT CLOSED SUCCESS',
    '===============================',
    '        RINCIAN TRANSAKSI      ',
    '-------------------------------',
    ...(transactions || []).map((t: any) => {
      const timeStr = new Date(t.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      const desc = `${t.type} (${t.paymentMethod})`;
      return `${timeStr} ${desc.padEnd(12, ' ')} Rp${t.amount.toLocaleString('id-ID')}`;
    }),
    '===============================',
  ];

  const htmlContent = `
    <html>
      <head>
        <title>Struk Setoran Shift</title>
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

interface CashierBoothProps {
  socket: any;
  gates: Gate[];
  systemMode?: 'simulation' | 'production';
  currentUser?: { username: string; role: string; gateId?: string | null } | null;
}

export const CashierBooth: React.FC<CashierBoothProps> = ({ socket, gates, systemMode = 'simulation', currentUser }) => {
  const [selectedGateId, setSelectedGateId] = useState(currentUser?.gateId || '');

  useEffect(() => {
    if (currentUser?.gateId) {
      setSelectedGateId(currentUser.gateId);
    } else if (gates.length > 0 && !selectedGateId) {
      const firstExit = gates.find(g => g.type === 'exit');
      if (firstExit) {
        setSelectedGateId(firstExit.id);
      }
    }
  }, [currentUser, gates]);

  // Attendant selected checkout mode: 'TICKET' | 'RFID' | 'LOST'
  const [checkoutMode, setCheckoutMode] = useState<'TICKET' | 'RFID' | 'LOST'>('TICKET');

  // Input states
  const [scannedTicketCode, setScannedTicketCode] = useState('');
  const [selectedRfid, setSelectedRfid] = useState(''); // dropdown simulator
  const [typedRfid, setTypedRfid] = useState(''); // physical rfid input
  const [searchPlateNumber, setSearchPlateNumber] = useState('');
  const [selectedLostCarId, setSelectedLostCarId] = useState('');

  // Refs for auto-focusing inputs for hardware scanner speed
  const ticketInputRef = useRef<HTMLInputElement>(null);
  const rfidInputRef = useRef<HTMLInputElement>(null);
  const lostPlateInputRef = useRef<HTMLInputElement>(null);

  // Loaded lists
  const [activeCars, setActiveCars] = useState<ActiveCar[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [fineAmount, setFineAmount] = useState(50000);

  // Active billing details
  const [checkoutData, setCheckoutData] = useState<any>(null);
  const [manualPlateNumber, setManualPlateNumber] = useState('');
  const [identityCard, setIdentityCard] = useState('');
  const [stnkNumber, setStnkNumber] = useState('');

  // Payment Options
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QRIS'>('QRIS');
  const [cashReceived, setCashReceived] = useState('');
  const [showQrisCode, setShowQrisCode] = useState(false);

  // Indicators
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [printedReceipt, setPrintedReceipt] = useState<any>(null);

  // Cashier Shift Management States
  const [activeShift, setActiveShift] = useState<any>(null);
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [openShiftFloat, setOpenShiftFloat] = useState<number>(100000);
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [closeShiftDeposit, setCloseShiftDeposit] = useState<number>(0);
  const [shiftSummary, setShiftSummary] = useState<any>(null);
  const [loadingShift, setLoadingShift] = useState(true);
  const [shiftTransactions, setShiftTransactions] = useState<any[]>([]);
  const [loadingShiftTx, setLoadingShiftTx] = useState(false);

  const fetchActiveShift = async () => {
    if (!currentUser) return;
    setLoadingShift(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/users/shift/active/${currentUser.username}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.id) {
          setActiveShift(data);
          setShowOpenShiftModal(false);
        } else {
          setActiveShift(null);
          setShowOpenShiftModal(true);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingShift(false);
    }
  };

  const handleOpenShift = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/users/shift/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser.username,
          startingFloat: openShiftFloat,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success !== false) {
        setActiveShift(data.shift);
        setShowOpenShiftModal(false);
      } else {
        alert(data.message || 'Gagal membuka shift');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadShiftSummary = async () => {
    if (!activeShift) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/users/shift/summary/${activeShift.id}`);
      if (res.ok) {
        const data = await res.json();
        setShiftSummary(data);
        setCloseShiftDeposit(data.expectedCash);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchShiftTransactions = async (shiftId?: string) => {
    const id = shiftId || activeShift?.id;
    if (!id) return;
    setLoadingShiftTx(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/users/shift/transactions/${id}`);
      if (res.ok) {
        const data = await res.json();
        setShiftTransactions(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingShiftTx(false);
    }
  };

  const handleCloseShift = async () => {
    if (!activeShift) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/users/shift/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftId: activeShift.id,
          depositAmount: closeShiftDeposit,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success !== false) {
        // Print deposit receipt
        const fullShiftData = {
          shift: data.shift,
          cashRevenue: data.shift.cashRevenue,
          nonCashRevenue: data.shift.nonCashRevenue,
          expectedCash: data.expectedCash,
          transactions: data.transactions,
        };
        printShiftReceiptDirectly(fullShiftData);

        // Reset
        setActiveShift(null);
        setShiftSummary(null);
        setShowCloseShiftModal(false);
        setShowOpenShiftModal(true);
      } else {
        alert(data.message || 'Gagal menutup shift');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveShift();
  }, [currentUser]);

  useEffect(() => {
    if (activeShift?.id) {
      fetchShiftTransactions(activeShift.id);
    } else {
      setShiftTransactions([]);
    }
  }, [activeShift]);

  const exitGates = gates.filter((g) => g.type === 'exit');

  useEffect(() => {
    if (exitGates.length > 0 && !selectedGateId) {
      setSelectedGateId(exitGates[0].id);
    }
    fetchActiveCars();
    fetchMembers();
    fetchTariff();
  }, [gates]);

  // Autofocus inputs based on mode for hardware scanner convenience
  useEffect(() => {
    if (checkoutMode === 'TICKET') {
      ticketInputRef.current?.focus();
    } else if (checkoutMode === 'RFID') {
      rfidInputRef.current?.focus();
    } else if (checkoutMode === 'LOST') {
      lostPlateInputRef.current?.focus();
    }
  }, [checkoutMode]);

  // Keyboard Shortcuts F1, F2, F3
  useEffect(() => {
    const handleShortcuts = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setCheckoutMode('TICKET');
        resetBilling();
      } else if (e.key === 'F2') {
        e.preventDefault();
        setCheckoutMode('RFID');
        resetBilling();
      } else if (e.key === 'F3') {
        e.preventDefault();
        setCheckoutMode('LOST');
        resetBilling();
      }
    };

    window.addEventListener('keydown', handleShortcuts);
    return () => {
      window.removeEventListener('keydown', handleShortcuts);
    };
  }, []);

  const fetchActiveCars = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/reports/active-entries`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setActiveCars(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMembers = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/members`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setMembers(data);
        if (data.length > 0 && !selectedRfid) {
          setSelectedRfid(data[0].rfidCardNumber);
        }
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

  const resetBilling = () => {
    setCheckoutData(null);
    setManualPlateNumber('');
    setIdentityCard('');
    setStnkNumber('');
    setCashReceived('');
    setShowQrisCode(false);
    setErrorMessage('');
  };

  // Attendant Action A: Scan/Verify Ticket
  const handleVerifyTicket = () => {
    if (!scannedTicketCode) return;
    setIsLoading(true);
    setErrorMessage('');
    setPrintedReceipt(null);
    setCheckoutData(null);

    socket.emit('verify_ticket', { ticketCode: scannedTicketCode }, (res: any) => {
      setIsLoading(false);
      if (res?.success) {
        setCheckoutData({
          ...res,
          isLostTicket: false,
          totalToPay: res.fee,
        });
        setManualPlateNumber(res.entry.plateNumber || '');
        if (res.fee === 0) {
          setStatusMessage('Kendaraan berada dalam grace period. Tarif: Rp 0.');
        } else {
          setShowQrisCode(paymentMethod === 'QRIS');
        }
      } else {
        setErrorMessage(res?.message || 'Tiket tidak ditemukan atau sudah keluar.');
      }
    });
  };

  // Attendant Action B: Tap RFID card (either via dropdown simulator or physical USB RFID reader)
  const handleRfidTap = (rfidToUse?: string) => {
    const cardNo = rfidToUse || typedRfid || selectedRfid;
    if (!cardNo) return;
    
    setIsLoading(true);
    setErrorMessage('');
    setPrintedReceipt(null);
    setCheckoutData(null);

    socket.emit(
      'tap_rfid',
      {
        gateId: selectedGateId,
        rfidCardNumber: cardNo,
        cameraPhoto: 'MOCK_EXIT_RFID_POS_PHOTO',
      },
      (res: any) => {
        setIsLoading(false);
        if (res?.success) {
          setStatusMessage(`Member RFID "${res.member.name}" valid. Palang pintu keluar dibuka!`);
          setTypedRfid('');
          fetchActiveCars();
        } else {
          setErrorMessage(res?.message || 'Kartu member kadaluwarsa atau ditolak.');
        }
      }
    );
  };

  // Attendant Action C: Lost Ticket Plate Search
  const handleSearchLostTicketByPlate = () => {
    setErrorMessage('');
    setPrintedReceipt(null);
    setCheckoutData(null);

    let matchCar = activeCars.find(
      (c) => c.plateNumber.replace(/\s+/g, '').toLowerCase() === searchPlateNumber.replace(/\s+/g, '').toLowerCase()
    );

    if (!matchCar && selectedLostCarId) {
      matchCar = activeCars.find((c) => c.id === selectedLostCarId);
    }

    if (!matchCar) {
      setErrorMessage('Plat nomor kendaraan tidak ditemukan di dalam area parkir.');
      return;
    }

    setIsLoading(true);
    
    socket.emit('verify_ticket', { ticketCode: matchCar.ticketCode }, (res: any) => {
      setIsLoading(false);
      if (res?.success) {
        setCheckoutData({
          ...res,
          isLostTicket: true,
          normalFee: res.fee,
          fineAmount: fineAmount,
          totalToPay: res.fee + fineAmount,
        });
        setManualPlateNumber(matchCar.plateNumber);
        setShowQrisCode(paymentMethod === 'QRIS');
      } else {
        setErrorMessage('Gagal memuat rincian parkir kendaraan.');
      }
    });
  };

  // Confirm and Submit Payment POS transaction
  const handleSubmitPOS = async () => {
    if (!checkoutData) return;

    if (!manualPlateNumber.trim()) {
      setErrorMessage('Harap input plat nomor kendaraan.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    const operatorName = JSON.parse(localStorage.getItem('park_user') || '{}').username || 'operator';

    // Scenario A: Lost Ticket Process
    if (checkoutData.isLostTicket) {
      if (!identityCard.trim() || !stnkNumber.trim()) {
        setErrorMessage('Untuk karcis hilang, nomor KTP dan STNK wajib diisi.');
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/payment/lost-ticket`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gateId: selectedGateId,
            entryId: checkoutData.entry.id,
            identityCard,
            stnkNumber,
            operatorUsername: operatorName,
          }),
        });
        const result = await res.json();
        setIsLoading(false);

        if (res.ok && result.success !== false) {
          setStatusMessage('Denda Karcis Hilang berhasil diproses. Palang pintu keluar dibuka!');
          setPrintedReceipt({
            ticketCode: checkoutData.entry.ticketCode || 'DENDA_HILANG',
            plateNumber: manualPlateNumber,
            entryTime: checkoutData.entry.entryTime,
            exitTime: new Date().toISOString(),
            amount: checkoutData.totalToPay,
            paymentMethod: `${paymentMethod.toUpperCase()} (Denda Hilang)`,
            gateName: gates.find((g) => g.id === selectedGateId)?.name || 'Gate Keluar',
          });
          setCheckoutData(null);
          setSearchPlateNumber('');
          setSelectedLostCarId('');
          setIdentityCard('');
          setStnkNumber('');
          setCashReceived('');
          fetchActiveCars();
          fetchShiftTransactions();
        } else {
          setErrorMessage(result.message || 'Gagal memproses denda karcis hilang.');
        }
      } catch (e) {
        console.error(e);
        setIsLoading(false);
        setErrorMessage('Terjadi kesalahan koneksi database.');
      }
    } else {
      // Scenario B: Regular Ticket Process
      socket.emit(
        'make_payment',
        {
          gateId: selectedGateId,
          ticketCode: checkoutData.entry.ticketCode,
          paymentMethod: checkoutData.totalToPay === 0 ? 'Free (Grace)' : paymentMethod,
          amount: checkoutData.totalToPay,
          cameraPhoto: 'MOCK_EXIT_POS_PHOTO',
          plateNumber: manualPlateNumber,
        },
        (res: any) => {
          setIsLoading(false);
          if (res?.success) {
            setStatusMessage('Transaksi karcis keluar berhasil diproses. Palang pintu terbuka!');
            setPrintedReceipt({
              ticketCode: checkoutData.entry.ticketCode,
              plateNumber: manualPlateNumber,
              entryTime: checkoutData.entry.entryTime,
              exitTime: new Date().toISOString(),
              amount: checkoutData.totalToPay,
              paymentMethod: checkoutData.totalToPay === 0 ? 'Free (Grace)' : paymentMethod,
              gateName: gates.find((g) => g.id === selectedGateId)?.name || 'Gate Keluar',
            });
            setCheckoutData(null);
            setScannedTicketCode('');
            setCashReceived('');
            fetchActiveCars();
            fetchShiftTransactions();
          } else {
            setErrorMessage(res?.message || 'Gagal menyelesaikan transaksi karcis.');
          }
        }
      );
    }
  };

  const calculateChange = () => {
    if (!checkoutData) return 0;
    const change = parseFloat(cashReceived) - checkoutData.totalToPay;
    return isNaN(change) ? 0 : Math.max(0, change);
  };

  const getDurationString = (entryTimeStr: string) => {
    const entry = new Date(entryTimeStr);
    const diffMs = new Date().getTime() - entry.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours} Jam ${mins} Menit`;
  };

  // Triggers browser native print job on the thermal receipt block
  const handlePrintReceipt = () => {
    window.print();
  };

  if (loadingShift) {
    return (
      <div className="flex items-center justify-center p-12 text-zinc-500 font-medium text-xs gap-2">
        <RefreshCw className="h-4 w-4 animate-spin text-emerald-400" />
        Memuat status shift kasir...
      </div>
    );
  }

  if (showOpenShiftModal) {
    return (
      <div className="fixed inset-0 bg-[#090a0f] flex items-center justify-center p-4 z-40 animate-fadeIn">
        <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col scale-in">
          {/* Modal Header */}
          <div className="px-6 py-4 border-b border-white/5 bg-zinc-950/40 flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-emerald-400" />
            <div>
              <h3 className="font-extrabold text-sm text-white uppercase tracking-wider">
                Buka Shift Kasir
              </h3>
              <p className="text-[10px] text-zinc-500 font-medium">Masukan jumlah modal laci kasir.</p>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-6 space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-zinc-400 font-medium">Petugas Operator</label>
              <div className="w-full bg-zinc-950 border border-white/5 rounded-lg px-3 py-2 text-xs text-zinc-300 font-semibold uppercase">
                {currentUser?.username}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400 font-medium">Tanggal & Waktu</label>
              <div className="w-full bg-zinc-950 border border-white/5 rounded-lg px-3 py-2 text-xs text-zinc-500 font-mono">
                {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400 font-medium">Uang Modal Awal (Kembalian)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-mono">Rp</span>
                <input
                  type="text"
                  value={openShiftFloat.toLocaleString('id-ID')}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setOpenShiftFloat(val ? parseInt(val, 10) : 0);
                  }}
                  className="w-full bg-zinc-950 border border-white/10 rounded-lg pl-8 pr-3 py-2.5 text-sm text-white font-mono text-right focus:outline-none focus:border-emerald-500"
                />
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">Uang modal yang tersedia di laci kasir untuk uang kembalian.</p>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-4 bg-zinc-950 border-t border-white/5">
            <button
              onClick={handleOpenShift}
              disabled={isLoading}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold rounded-lg text-xs transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/10 disabled:opacity-50"
            >
              Buka Shift & Mulai Kerja
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Left panel POS */}
      <div className="lg:col-span-2 space-y-6 print:hidden">
        <div className="glass rounded-xl p-5 space-y-5">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div>
              <h3 className="text-lg font-bold text-white">Workstation Petugas Loket Keluar</h3>
              <p className="text-xs text-zinc-500">Konektivitas: Barcode Scanner (USB), RFID Card Reader, & Printer Thermal POS</p>
              {activeShift && (
                <div className="text-[10px] text-zinc-400 mt-1 flex items-center gap-1.5 font-medium">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Shift aktif sejak {new Date(activeShift.openTime).toLocaleTimeString('id-ID')} (Modal: Rp {activeShift.startingFloat.toLocaleString('id-ID')})</span>
                </div>
              )}
            </div>

            {activeShift && (
              <button
                type="button"
                onClick={() => { loadShiftSummary(); setShowCloseShiftModal(true); }}
                className="px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500 border border-rose-500/20 text-rose-400 hover:text-zinc-950 font-bold rounded-lg text-xs transition flex items-center gap-1.5 shadow-lg shadow-rose-500/5 shrink-0"
              >
                Tutup Shift
              </button>
            )}
            
            {/* Gate Lane Selector */}
            {currentUser?.gateId ? (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-zinc-500 font-bold uppercase tracking-wider font-mono">Pintu Keluar Aktif:</span>
                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg font-bold">
                  {gates.find((g) => g.id === selectedGateId)?.name || 'Gate Terpilih'}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400 font-semibold">Pintu Keluar Aktif:</span>
                <select
                  value={selectedGateId}
                  onChange={(e) => {
                    setSelectedGateId(e.target.value);
                    resetBilling();
                  }}
                  className="bg-zinc-950 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                >
                  {exitGates.length === 0 ? (
                    <option value="">-- Pintu Keluar Tidak Tersedia --</option>
                  ) : (
                    exitGates.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.status})
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}
          </div>

          {/* Feedback alerts */}
          {statusMessage && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-lg animate-fadeIn">
              {statusMessage}
            </div>
          )}
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg flex items-center gap-2 animate-fadeIn">
              <AlertCircle className="h-4 w-4 text-rose-400" />
              {errorMessage}
            </div>
          )}

          {/* Unified workflow mode tabs */}
          <div className="flex border border-white/5 p-1 rounded-lg bg-zinc-950/40">
            <button
              onClick={() => { setCheckoutMode('TICKET'); resetBilling(); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-md flex items-center justify-center gap-2 transition ${
                checkoutMode === 'TICKET' ? 'bg-emerald-500 text-zinc-950 shadow-md font-bold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Ticket className="h-4 w-4" />
              Karcis Harian [F1]
            </button>
            <button
              onClick={() => { setCheckoutMode('RFID'); resetBilling(); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-md flex items-center justify-center gap-2 transition ${
                checkoutMode === 'RFID' ? 'bg-emerald-500 text-zinc-950 shadow-md font-bold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Award className="h-4 w-4" />
              Member RFID [F2]
            </button>
            <button
              onClick={() => { setCheckoutMode('LOST'); resetBilling(); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-md flex items-center justify-center gap-2 transition ${
                checkoutMode === 'LOST' ? 'bg-emerald-500 text-zinc-950 shadow-md font-bold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <FileText className="h-4 w-4" />
              Karcis Hilang [F3]
            </button>
          </div>

          {/* Active Option Form Panel */}
          <div className="bg-zinc-900/20 border border-white/5 rounded-xl p-5">
            
            {checkoutMode === 'TICKET' && (
              <div className="space-y-4 max-w-md animate-fadeIn">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Ticket className="h-4.5 w-4.5 text-emerald-400" />
                  Alur Scan Barcode Karcis
                </div>
                
                {/* Simulator Helper Dropdown */}
                {systemMode !== 'production' && (
                  <div className="bg-zinc-950/20 border border-white/5 p-3 rounded-lg space-y-2">
                    <label className="block text-[10px] text-zinc-500 font-bold uppercase">Bantuan Demo (Pilih Karcis Terparkir):</label>
                    <select
                      value={scannedTicketCode}
                      onChange={(e) => {
                        setScannedTicketCode(e.target.value);
                        ticketInputRef.current?.focus();
                      }}
                      className="w-full bg-zinc-950 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    >
                      <option value="">-- Pilih Karcis Pengunjung --</option>
                      {activeCars
                        .filter((c) => c.ticketCode)
                        .map((c) => (
                          <option key={c.id} value={c.ticketCode}>
                            {c.ticketCode} ({c.plateNumber})
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] text-zinc-400 font-bold mb-1.5 uppercase">
                    Scan Barcode Karcis / Masukkan Kode:
                  </label>
                  <div className="flex gap-2">
                    <input
                      ref={ticketInputRef}
                      type="text"
                      placeholder="Gunakan Barcode Scanner USB..."
                      value={scannedTicketCode}
                      onChange={(e) => setScannedTicketCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleVerifyTicket();
                        }
                      }}
                      className="flex-1 bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono uppercase focus:outline-none focus:border-emerald-500 placeholder-zinc-700"
                    />
                    <button
                      onClick={handleVerifyTicket}
                      disabled={isLoading || !scannedTicketCode}
                      className="px-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-zinc-950 font-bold rounded-lg text-xs transition"
                    >
                      Cek Karcis
                    </button>
                  </div>
                  <span className="text-[10px] text-zinc-500 block mt-1">
                    * Barcode scanner USB akan otomatis menginput dan menekan Enter untuk validasi instan.
                  </span>
                </div>
              </div>
            )}

            {checkoutMode === 'RFID' && (
              <div className="space-y-4 max-w-md animate-fadeIn">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Award className="h-4.5 w-4.5 text-amber-400" />
                  Alur Reader Kartu RFID
                </div>
                
                {/* Simulator Helper Dropdown */}
                {systemMode !== 'production' && (
                  <div className="bg-zinc-950/20 border border-white/5 p-3 rounded-lg space-y-2">
                    <label className="block text-[10px] text-zinc-500 font-bold uppercase">Bantuan Demo (Pilih Kartu RFID):</label>
                    <select
                      value={selectedRfid}
                      onChange={(e) => {
                        setSelectedRfid(e.target.value);
                        setTypedRfid(e.target.value);
                        rfidInputRef.current?.focus();
                      }}
                      className="w-full bg-zinc-950 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    >
                      {members.map((m) => (
                        <option key={m.id} value={m.rfidCardNumber}>
                          {m.name} ({m.rfidCardNumber}) - {m.status}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] text-zinc-400 font-bold mb-1.5 uppercase font-mono">
                    Tap Kartu pada Reader RFID / Input Serial:
                  </label>
                  <div className="flex gap-2">
                    <input
                      ref={rfidInputRef}
                      type="text"
                      placeholder="Tempelkan kartu RFID pada reader..."
                      value={typedRfid}
                      onChange={(e) => setTypedRfid(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleRfidTap(typedRfid);
                        }
                      }}
                      className="flex-1 bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500 placeholder-zinc-700"
                    />
                    <button
                      onClick={() => handleRfidTap(typedRfid)}
                      disabled={isLoading || !typedRfid}
                      className="px-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-zinc-950 font-bold rounded-lg text-xs transition"
                    >
                      Tap Kartu
                    </button>
                  </div>
                  <span className="text-[10px] text-zinc-500 block mt-1">
                    * Tap kartu member pada sensor RFID reader USB akan otomatis menginput serial kartu dan meloloskan gate.
                  </span>
                </div>
              </div>
            )}

            {checkoutMode === 'LOST' && (
              <div className="space-y-4 max-w-md animate-fadeIn">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <FileText className="h-4.5 w-4.5 text-red-400" />
                  Alur Karcis Hilang (Cari Plat Nomor)
                </div>
                
                {systemMode !== 'production' && (
                  <div>
                    <label className="block text-[10px] text-zinc-500 font-bold mb-1 uppercase">Pilih Kendaraan Parkir di Area:</label>
                    <select
                      value={selectedLostCarId}
                      onChange={(e) => {
                        setSelectedLostCarId(e.target.value);
                        const matchingPlate = activeCars.find(c => c.id === e.target.value)?.plateNumber || '';
                        setSearchPlateNumber(matchingPlate);
                      }}
                      className="w-full bg-zinc-950 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    >
                      <option value="">-- Pilih Plat Kendaraan Terparkir --</option>
                      {activeCars.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.plateNumber} (Masuk: {new Date(c.entryTime).toLocaleTimeString('id-ID')})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] text-zinc-500 font-bold mb-1 uppercase">Atau Ketik Plat Nomor Kendaraan:</label>
                  <div className="flex gap-2">
                    <input
                      ref={lostPlateInputRef}
                      type="text"
                      placeholder="Masukkan Plat Nomor..."
                      value={searchPlateNumber}
                      onChange={(e) => setSearchPlateNumber(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSearchLostTicketByPlate();
                        }
                      }}
                      className="flex-1 bg-zinc-950 border border-white/10 rounded px-3 py-2 text-xs text-white font-mono uppercase focus:outline-none"
                    />
                    <button
                      onClick={handleSearchLostTicketByPlate}
                      disabled={isLoading || (!searchPlateNumber && !selectedLostCarId)}
                      className="px-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-zinc-950 font-bold rounded-lg text-xs transition flex items-center gap-1"
                    >
                      <Search className="h-3.5 w-3.5" />
                      Cari
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* POS Bill checkout summary details */}
          {checkoutData && (
            <div className="bg-zinc-900/40 p-5 rounded-xl border border-emerald-500/25 space-y-5 animate-fadeIn">
              
              <div className="flex justify-between items-start border-b border-white/5 pb-3">
                <div>
                  <span className="text-[10px] text-zinc-500 font-mono">Kode Tiket: {checkoutData.entry.ticketCode || 'RFID-MEMBER'}</span>
                  <h4 className="font-extrabold text-white text-md mt-1">Rincian Billing Checkout POS</h4>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-zinc-400">Total Biaya:</span>
                  <h3 className="text-xl font-black text-emerald-400">Rp {checkoutData.totalToPay.toLocaleString('id-ID')}</h3>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                
                {/* Visual Details & Manual Plate Input */}
                <div className="space-y-3 bg-zinc-950/30 p-4 rounded-lg border border-white/5">
                  <div className="flex justify-between border-b border-white/5 pb-1.5">
                    <span className="text-zinc-500">Waktu Masuk:</span>
                    <span className="text-zinc-300 font-semibold">{new Date(checkoutData.entry.entryTime).toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1.5">
                    <span className="text-zinc-500">Durasi Terparkir:</span>
                    <span className="text-zinc-300 font-semibold">{getDurationString(checkoutData.entry.entryTime)}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1.5">
                    <span className="text-zinc-500">Jenis Kendaraan:</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-white">
                      {checkoutData.entry.vehicleType === 'motorcycle' ? '🏍️ Motor'
                        : checkoutData.entry.vehicleType === 'truck' ? '🚛 Truck'
                        : checkoutData.entry.vehicleType === 'bus' ? '🚌 Bus/Minibus'
                        : '🚗 Mobil'}
                    </span>
                  </div>
                  
                  {checkoutData.isLostTicket && (
                    <div className="space-y-1 text-red-400 font-bold border-b border-white/5 pb-1.5">
                      <div className="flex justify-between text-zinc-500 font-normal">
                        <span>Tarif Normal:</span>
                        <span className="text-zinc-300">Rp {checkoutData.normalFee.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span>Denda Karcis Hilang:</span>
                        <span>Rp {checkoutData.fineAmount.toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  )}

                  {/* Manual Plate number input */}
                  <div className="space-y-1.5 pt-1.5">
                    <label className="block text-[10px] text-zinc-400 font-bold uppercase">
                      Input / Koreksi Plat Nomor Kendaraan:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Masukkan nomor plat..."
                      value={manualPlateNumber}
                      onChange={(e) => setManualPlateNumber(e.target.value.toUpperCase())}
                      className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono uppercase focus:outline-none focus:border-emerald-500"
                    />
                    {!manualPlateNumber.trim() && (
                      <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1 mt-1 animate-pulse">
                        * Wajib memasukkan plat nomor kendaraan!
                      </span>
                    )}
                  </div>
                </div>

                {/* Checkout Payment details & Lost ticket inputs */}
                <div className="space-y-4">
                  
                  {/* If Lost Ticket: Require STNK & KTP Card inputs */}
                  {checkoutData.isLostTicket && (
                    <div className="bg-rose-500/5 border border-rose-500/10 p-3.5 rounded-lg space-y-3 animate-fadeIn">
                      <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider block">Otorisasi Berkas STNK & KTP:</span>
                      
                      <div className="space-y-1">
                        <label className="block text-[10px] text-zinc-400 font-medium">Nomor Identitas (NIK KTP):</label>
                        <input
                          type="text"
                          required
                          placeholder="Contoh: 32750800000000"
                          value={identityCard}
                          onChange={(e) => setIdentityCard(e.target.value)}
                          className="w-full bg-zinc-950 border border-white/10 rounded px-2.5 py-1 text-xs text-white focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] text-zinc-400 font-medium">Nomor Seri STNK:</label>
                        <input
                          type="text"
                          required
                          placeholder="Contoh: STNK-999238"
                          value={stnkNumber}
                          onChange={(e) => setStnkNumber(e.target.value)}
                          className="w-full bg-zinc-950 border border-white/10 rounded px-2.5 py-1 text-xs text-white focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Payment selection */}
                  {checkoutData.totalToPay > 0 ? (
                    <>
                      <div className="space-y-1.5">
                        <label className="block text-[10px] text-zinc-400 font-bold uppercase">Pilih Metode Pembayaran:</label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => { setPaymentMethod('QRIS'); setShowQrisCode(true); }}
                            className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition ${
                              paymentMethod === 'QRIS'
                                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                                : 'bg-zinc-950 border-white/10 text-zinc-500'
                            }`}
                          >
                            <Smartphone className="h-3.5 w-3.5" />
                            QRIS (Digital)
                          </button>
                          <button
                            type="button"
                            onClick={() => { setPaymentMethod('CASH'); setShowQrisCode(false); }}
                            className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition ${
                              paymentMethod === 'CASH'
                                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                                : 'bg-zinc-950 border-white/10 text-zinc-500'
                            }`}
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            Tunai (Cash)
                          </button>
                        </div>
                      </div>

                      {/* Cash kembalian inputs / QRIS displays */}
                      {paymentMethod === 'CASH' ? (
                        <div className="space-y-1.5 animate-fadeIn">
                          <label className="block text-[10px] text-zinc-400 font-bold uppercase">Uang Diterima dari Pengendara (Rp):</label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              placeholder="Nominal uang..."
                              value={cashReceived}
                              onChange={(e) => setCashReceived(e.target.value)}
                              className="flex-1 bg-zinc-950 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
                            />
                            <div className="bg-zinc-800 border border-white/5 rounded-lg px-2.5 py-1 text-xs text-emerald-400 flex items-center font-bold">
                              Kembalian: Rp {calculateChange().toLocaleString('id-ID')}
                            </div>
                          </div>
                        </div>
                      ) : (
                        showQrisCode && (
                          <div className="bg-white p-2.5 rounded-lg border border-zinc-200 flex items-center justify-between gap-3 text-zinc-950 animate-fadeIn">
                            <div className="space-y-0.5">
                              <span className="text-[9px] uppercase tracking-wider font-black text-zinc-500">QRIS CASHIER POS</span>
                              <p className="text-xs font-bold leading-tight">Rp {checkoutData.totalToPay.toLocaleString('id-ID')}</p>
                              <span className="text-[9px] text-zinc-500">Tunjukkan QR code ke pengendara</span>
                            </div>
                            <div className="h-12 w-12 bg-zinc-200 border border-zinc-900 flex flex-wrap p-0.5 shadow-sm">
                              <div className="h-4 w-4 bg-zinc-950"></div>
                              <div className="h-4 w-4 bg-zinc-200"></div>
                              <div className="h-4 w-4 bg-zinc-950"></div>
                              <div className="h-4 w-4 bg-zinc-200"></div>
                              <div className="h-4 w-4 bg-zinc-950"></div>
                              <div className="h-4 w-4 bg-zinc-200"></div>
                            </div>
                          </div>
                        )
                      )}
                    </>
                  ) : (
                    <div className="h-full flex items-center justify-center p-4 border border-dashed border-emerald-500/20 bg-emerald-500/5 rounded-lg text-emerald-400 text-center font-semibold">
                      Karcis Dalam Masa Grace Period
                    </div>
                  )}

                </div>

              </div>

              {/* Checkout Submission POS Action */}
              <button
                onClick={handleSubmitPOS}
                disabled={
                  isLoading || 
                  !manualPlateNumber.trim() || 
                  (checkoutData.isLostTicket && (!identityCard.trim() || !stnkNumber.trim())) ||
                  (paymentMethod === 'CASH' && checkoutData.totalToPay > 0 && (!cashReceived || parseFloat(cashReceived) < checkoutData.totalToPay))
                }
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 font-black rounded-lg transition text-xs flex items-center justify-center gap-1.5 uppercase tracking-wider"
              >
                {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                Selesaikan Pembayaran, Cetak Struk & Buka Pintu
              </button>

            </div>
          )}

        </div>
      </div>

      {/* Right panel: Receipt printout emulation */}
      <div className="print:block lg:block">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 print:hidden">
          <Printer className="h-5 w-5 text-emerald-400" />
          Struk POS Petugas Loket
        </h3>

        {printedReceipt ? (
          <div className="space-y-4">
            <div id="print-area" className="bg-white text-zinc-900 font-mono p-5 rounded-lg border-b-4 border-dashed border-zinc-300 shadow-2xl relative max-w-sm mx-auto animate-ticketDown">
              <div className="text-center border-b-2 border-dashed border-zinc-300 pb-3">
                <h4 className="font-extrabold text-md tracking-wider">BUKTI BAYAR PARKIR</h4>
                <p className="text-[10px] text-zinc-500">{printedReceipt.gateName}</p>
              </div>
              <div className="py-4 space-y-1.5 text-xs text-left">
                <div className="flex justify-between">
                  <span>KARCIS:</span>
                  <span>{printedReceipt.ticketCode}</span>
                </div>
                <div className="flex justify-between">
                  <span>PLAT NOMOR:</span>
                  <span className="font-bold">{printedReceipt.plateNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>JAM MASUK:</span>
                  <span>{new Date(printedReceipt.entryTime).toLocaleTimeString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span>JAM KELUAR:</span>
                  <span>{new Date(printedReceipt.exitTime).toLocaleTimeString('id-ID')}</span>
                </div>
                <div className="flex justify-between border-t border-zinc-200 pt-1.5">
                  <span>METODE:</span>
                  <span className="font-bold">{printedReceipt.paymentMethod.toUpperCase()}</span>
                </div>
                <div className="flex justify-between border-b-2 border-zinc-900 pb-1 font-bold text-sm">
                  <span>TOTAL:</span>
                  <span>Rp {printedReceipt.amount.toLocaleString('id-ID')}</span>
                </div>
              </div>
              <div className="text-center text-[9px] text-zinc-500 leading-tight">
                TERIMA KASIH ATAS KUNJUNGAN ANDA<br />
                SEMOGA SELAMAT SAMPAI TUJUAN<br />
                (DICETAK DI LOKET PETUGAS KASIR)
              </div>
            </div>
            
            {/* Native print trigger button */}
            <button
              onClick={handlePrintReceipt}
              className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-lg text-xs transition flex items-center justify-center gap-1.5 print:hidden"
            >
              <Printer className="h-4 w-4 text-emerald-400" />
              Cetak Struk Fisik (Thermal)
            </button>
          </div>
        ) : (
          <div className="border border-dashed border-white/10 rounded-xl p-8 text-center text-zinc-600 text-xs min-h-[220px] flex flex-col items-center justify-center print:hidden">
            <Printer className="h-8 w-8 mb-2 opacity-30 text-zinc-500" />
            <p>Struk bukti pembayaran parkir dari POS petugas loket akan muncul di sini setelah transaksi kasir berhasil diselesaikan.</p>
          </div>
        )}
      {/* ── Close Shift Modal */}
      {showCloseShiftModal && shiftSummary && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fadeIn" onClick={() => setShowCloseShiftModal(false)}>
          <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col scale-in" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-white/5 bg-zinc-950/40 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-sm text-white uppercase tracking-wider">
                  Rekapitulasi Tutup Shift
                </h3>
                <p className="text-[10px] text-zinc-500">Konfirmasi total penerimaan setoran uang fisik laci kasir.</p>
              </div>
              <button type="button" onClick={() => setShowCloseShiftModal(false)} className="p-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 bg-zinc-950/50 p-4 rounded-xl border border-white/5">
                <div>
                  <span className="text-zinc-500">Buka Shift:</span>
                  <div className="font-semibold text-zinc-300 mt-0.5">{new Date(shiftSummary.shift.openTime).toLocaleTimeString('id-ID')}</div>
                </div>
                <div>
                  <span className="text-zinc-500">Kasir Petugas:</span>
                  <div className="font-bold text-white mt-0.5 uppercase">{shiftSummary.shift.operatorUsername}</div>
                </div>
              </div>

              <div className="space-y-2 border-t border-white/5 pt-3">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Modal Awal Kasir:</span>
                  <span className="font-mono text-white">Rp {shiftSummary.shift.startingFloat.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Pendapatan Tunai (Cash):</span>
                  <span className="font-mono text-emerald-400 font-bold">+ Rp {shiftSummary.cashRevenue.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Pendapatan Non-Tunai (QRIS):</span>
                  <span className="font-mono text-sky-400">+ Rp {shiftSummary.nonCashRevenue.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between border-t border-white/5 pt-2 font-bold text-sm">
                  <span className="text-zinc-300">Wajib Disetor (Cash):</span>
                  <span className="font-mono text-emerald-400">Rp {shiftSummary.expectedCash.toLocaleString('id-ID')}</span>
                </div>
              </div>

              <div className="space-y-1.5 border-t border-white/5 pt-3">
                <label className="text-xs text-zinc-400 font-semibold">Uang Fisik Diterima / Disetor</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-mono">Rp</span>
                  <input
                    type="text"
                    value={closeShiftDeposit.toLocaleString('id-ID')}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setCloseShiftDeposit(val ? parseInt(val, 10) : 0);
                    }}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm text-white font-mono text-right focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Discrepancy indicator */}
              {(() => {
                const diff = closeShiftDeposit - shiftSummary.expectedCash;
                return (
                  <div className={`p-3 rounded-lg border text-[11px] flex justify-between font-semibold ${
                    diff === 0 ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400'
                      : diff > 0 ? 'bg-sky-500/5 border-sky-500/10 text-sky-400'
                      : 'bg-rose-500/5 border-rose-500/10 text-rose-400'
                  }`}>
                    <span>Status Selisih Setoran:</span>
                    <span>
                      {diff === 0 ? 'COCOK (Rp 0)'
                        : diff > 0 ? `LEBIH (+ Rp ${diff.toLocaleString('id-ID')})`
                        : `KURANG (Rp ${diff.toLocaleString('id-ID')})`}
                    </span>
                  </div>
                );
              })()}

              {/* Transaction list during shift */}
              <div className="space-y-1.5 border-t border-white/5 pt-3">
                <label className="text-xs text-zinc-400 font-semibold">Log Transaksi Shift</label>
                <div className="max-h-32 overflow-y-auto border border-white/5 rounded-lg bg-zinc-950/60 p-2 space-y-1 font-mono text-[10px]">
                  {shiftSummary.transactions && shiftSummary.transactions.length === 0 ? (
                    <div className="text-zinc-600 text-center py-2">Tidak ada transaksi</div>
                  ) : (
                    shiftSummary.transactions.map((t: any) => (
                      <div key={t.id} className="flex justify-between text-zinc-400 hover:text-white border-b border-white/[0.02] pb-0.5 last:border-b-0">
                        <span className="truncate max-w-[240px]">{new Date(t.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} • {t.description}</span>
                        <span className="font-bold text-white shrink-0">Rp{t.amount.toLocaleString('id-ID')}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-zinc-950 border-t border-white/5 flex gap-2">
              <button onClick={() => setShowCloseShiftModal(false)} className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg text-xs font-semibold">
                Batal
              </button>
              <button
                onClick={handleCloseShift}
                disabled={isLoading}
                className="flex-1 py-2 bg-rose-500 hover:bg-rose-600 text-zinc-950 font-bold rounded-lg text-xs transition flex items-center justify-center gap-1.5 shadow-lg shadow-rose-500/10"
              >
                <Printer className="h-3.5 w-3.5" />
                Tutup Shift & Cetak
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* ── Shift Transaction History Panel ── */}
      {activeShift && (
        <div className="lg:col-span-3 glass rounded-xl p-5 space-y-4 print:hidden">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">History Transaksi Shift</h3>
              <span className="text-[10px] text-zinc-500 font-mono">Sejak buka shift: {new Date(activeShift.openTime).toLocaleTimeString('id-ID')}</span>
            </div>
            <button
              onClick={() => fetchShiftTransactions()}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingShiftTx ? 'animate-spin text-emerald-400' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Summary cards */}
          {shiftTransactions.length > 0 && (() => {
            const cashTotal = shiftTransactions.filter(t => t.paymentMethod && t.paymentMethod.toUpperCase().includes('CASH')).reduce((s, t) => s + (t.amount || 0), 0);
            const qrisTotal = shiftTransactions.filter(t => t.paymentMethod && t.paymentMethod.toUpperCase().includes('QRIS')).reduce((s, t) => s + (t.amount || 0), 0);
            const freeTotal = shiftTransactions.filter(t => t.paymentMethod && (t.paymentMethod.toLowerCase().includes('free') || t.amount === 0)).length;
            const grandTotal = shiftTransactions.reduce((s, t) => s + (t.amount || 0), 0);
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-zinc-950/60 border border-white/5 rounded-xl p-3 space-y-1">
                  <div className="text-[10px] text-zinc-500 uppercase font-semibold tracking-wider">Total Transaksi</div>
                  <div className="text-lg font-black text-white">{shiftTransactions.length}<span className="text-xs font-normal text-zinc-500 ml-1">transaksi</span></div>
                </div>
                <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3 space-y-1">
                  <div className="text-[10px] text-emerald-400/70 uppercase font-semibold tracking-wider">Pendapatan Cash</div>
                  <div className="text-base font-black text-emerald-400 font-mono">Rp {cashTotal.toLocaleString('id-ID')}</div>
                </div>
                <div className="bg-sky-500/5 border border-sky-500/10 rounded-xl p-3 space-y-1">
                  <div className="text-[10px] text-sky-400/70 uppercase font-semibold tracking-wider">Pendapatan QRIS</div>
                  <div className="text-base font-black text-sky-400 font-mono">Rp {qrisTotal.toLocaleString('id-ID')}</div>
                </div>
                <div className="bg-violet-500/5 border border-violet-500/10 rounded-xl p-3 space-y-1">
                  <div className="text-[10px] text-violet-400/70 uppercase font-semibold tracking-wider">Total Kotor</div>
                  <div className="text-base font-black text-violet-400 font-mono">Rp {grandTotal.toLocaleString('id-ID')}</div>
                  {freeTotal > 0 && <div className="text-[9px] text-zinc-600">{freeTotal}x grace/free</div>}
                </div>
              </div>
            );
          })()}

          {/* Transaction Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase text-zinc-500 font-semibold tracking-wider border-b border-white/5">
                  <th className="text-left pb-2 pr-4">#</th>
                  <th className="text-left pb-2 pr-4">Waktu</th>
                  <th className="text-left pb-2 pr-4">Plat Nomor</th>
                  <th className="text-left pb-2 pr-4">Tiket / Keterangan</th>
                  <th className="text-left pb-2 pr-4">Metode</th>
                  <th className="text-right pb-2">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {loadingShiftTx ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-zinc-600">
                      <RefreshCw className="h-4 w-4 animate-spin mx-auto text-emerald-400" />
                    </td>
                  </tr>
                ) : shiftTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-zinc-600">
                      <FileText className="h-6 w-6 mx-auto mb-2 opacity-20" />
                      <p>Belum ada transaksi pada shift ini</p>
                    </td>
                  </tr>
                ) : (
                  shiftTransactions.map((t: any, idx: number) => {
                    const methodUpper = (t.paymentMethod || '').toUpperCase();
                    const isCash = methodUpper.includes('CASH');
                    const isQris = methodUpper.includes('QRIS');
                    const isFree = t.amount === 0 || methodUpper.includes('FREE') || methodUpper.includes('GRACE');
                    return (
                      <tr key={t.id || idx} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors group">
                        <td className="py-2.5 pr-4 text-zinc-600 font-mono">{shiftTransactions.length - idx}</td>
                        <td className="py-2.5 pr-4 text-zinc-400 font-mono whitespace-nowrap">
                          {t.exitTime || t.createdAt
                            ? new Date(t.exitTime || t.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                            : '-'}
                        </td>
                        <td className="py-2.5 pr-4">
                          <span className="font-bold text-white font-mono tracking-widest text-[11px] bg-zinc-800 px-2 py-0.5 rounded">
                            {t.plateNumber || '-'}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-zinc-400 max-w-[160px] truncate">
                          {t.ticketCode || t.description || '-'}
                        </td>
                        <td className="py-2.5 pr-4">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isFree
                              ? 'bg-zinc-500/10 border-zinc-500/20 text-zinc-400'
                              : isCash
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                              : isQris
                              ? 'bg-sky-500/10 border-sky-500/20 text-sky-400'
                              : 'bg-violet-500/10 border-violet-500/20 text-violet-400'
                          }`}>
                            {isFree ? 'FREE' : isCash ? 'CASH' : isQris ? 'QRIS' : (t.paymentMethod || '-').toUpperCase()}
                          </span>
                        </td>
                        <td className={`py-2.5 text-right font-mono font-bold ${
                          isFree ? 'text-zinc-500' : isCash ? 'text-emerald-400' : isQris ? 'text-sky-400' : 'text-white'
                        }`}>
                          {isFree ? 'Rp 0' : `Rp ${(t.amount || 0).toLocaleString('id-ID')}`}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
